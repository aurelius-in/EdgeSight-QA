# EdgeSight QA

A modular, containerized edge computer vision system for industrial quality assurance. Ingests multi‑camera feeds, runs on‑device inference, writes results to plant systems (Ignition, MQTT, OPC UA), and streams events and metrics to storage for monitoring, retraining, and audit.

> Goal: repeatable inspection that scales from one line to many, with traceability, safe rollouts, and operator‑friendly outputs.

## Live operator view (16s)

<div align="center">
  <img src="esqa-preview.gif" alt="EdgeSight QA operator view" style="max-width: 100%; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,0.35);" />
  <br/>
  <img src="esqa-banner.png" alt="EdgeSight QA" width="640" />
</div>

What you’re seeing:

- Bounding boxes actively sweep, dart, and then settle as the detector interrogates candidate regions on the part. The main red box converges near the area of interest while smaller probes appear briefly, scan across the frame, and disappear as hypotheses are ruled out.
- The top controls show live telemetry relevant to operators:
  - p95 latency (ms): a rolling end‑to‑end measure of capture → preprocess → inference → publish; stays within the target envelope during the sequence.
  - Pre / Infer (ms): average preprocessing and model inference times, indicating where compute is spent.
  - FPS and Drops: actual capture rate and any dropped frames; stable during steady state.
  - Results / MQTT / OPC UA: cumulative publishes to plant systems; the “msg/s” dial on the telemetry card reflects the current outbound publish rate.
  - Threshold: the decision threshold you can adjust to tune sensitivity vs precision in real time.

The telemetry card to the right visualizes recent performance and signal mix:

- Latency trace: a compact sparkline of recent p95 values for quick trend recognition.
- Class mix bars: distribution of detection classes observed in the last window.
- Messages per second: current publish rate to plant systems.

---

## Contents

* [Why](#why)
* [Outcomes and SLOs](#outcomes-and-slos)
* [Architecture](#architecture)
* [Components](#components)
* [Data Contracts](#data-contracts)
* [Repository Layout](#repository-layout)
* [Quickstart](#quickstart)
* [Configuration](#configuration)
* [Deployment](#deployment)
* [Observability](#observability)
* [Provenance and Compliance](#provenance-and-compliance)
* [Testing](#testing)
* [Performance Tuning](#performance-tuning)
* [Security](#security)
* [Roadmap](#roadmap)
* [Related Work](#related-work)
* [License](#license)

---

## Why

Factories need inspection that is reliable, traceable, and easy to roll out. EdgeSight QA packages capture, preprocessing, inference, and results publication into small services that can be deployed on a Jetson or GPU industrial PC, tied into Ignition or other SCADA stacks, and monitored centrally.

## Outcomes and SLOs

* Operators see defect overlays or alarms in **≤ 200 ms** end‑to‑end at p95
* **99.9%** system uptime per line (target)
* False alarm rate within agreed budget, tracked over time
* Every decision is traceable to model version, data snapshot, and configuration
* Updates are health‑gated and automatically rolled back on error budget breach

## Architecture

```
[ PoE Cameras ] → [ Capture ] → [ Preprocess ] → [ Inference ] → [ Results Adapter ]
                                                             ↘
                                                   [ Events, Metrics, Frames ] → [ Storage / Cloud ]
                           ↘                                                         ↗
                        [ Operator UI ] ← [ Ignition / Alarms ] ← [ MQTT / OPC UA ]
```

* **Edge**: fast decisions, overlays, alarms, store‑and‑forward
* **Cloud or on‑prem object store**: events, sample frames, metrics, retraining

> Works online or with intermittent connectivity. All outputs are idempotent.

### RM‑ODP mapping (high level)

* **Enterprise**: reduce scrap, improve first‑pass yield, safety and compliance
* **Information**: events, detections, lineage metadata, retention policy
* **Computational**: four services, stable interfaces, explicit contracts
* **Engineering**: pods, probes, queues, network zones, air‑gap sync
* **Technology**: Jetson or GPU IPC, GigE/PoE cameras, ONNX Runtime or TensorRT, MQTT or OPC UA, Kubernetes or OpenShift

## Components

1. **Capture**

   * GigE, RTSP, or file source
   * Time sync, frame IDs, dropped‑frame counters
2. **Preprocess**

   * Resize, crop, normalize, color convert, masks
   * YAML‑driven pipeline, deterministic
3. **Inference**

   * ONNX Runtime or TensorRT on Jetson or GPU IPC
   * Model registry integration, warm start, batching if needed
4. **Results Adapter**

   * Publishes detections to Ignition via MQTT or OPC UA
   * Renders overlays for Operator UI
   * Persists events and frame snippets, emits Prometheus metrics
5. **Operator UI**

   * Live feed, bounding boxes, adjustable threshold, recent detections
   * Role based controls for acknowledge, tag, comment

## Data Contracts

### Detection Event (JSON)

```json
{
  "event_id": "a2b6ae8e-7b7a-4f6f-9a2a-1bc9d6d7f1ee",
  "ts_utc": "2025-09-06T12:34:56.789Z",
  "line_id": "line-3",
  "camera_id": "cam-A",
  "model": {"name": "defect-v7", "version": "7.2.1", "threshold": 0.62, "hash": "sha256:..."},
  "detections": [
    {"label": "scratch", "confidence": 0.83, "bbox": [412, 156, 64, 48]}
  ],
  "latency_ms": 142,
  "frame_ref": "frames/2025-09-06/line-3/cam-A/123456789.jpg",
  "provenance": {
    "container_digests": {"inference": "sha256:..."},
    "config_version": "preproc-1.3.0",
    "data_snapshot": "s3://bucket/datasets/steel-plates/v5/manifest.json"
  }
}
```

### MQTT Topics

```
factory/{site}/{line}/qa/events/{event_id}
factory/{site}/{line}/qa/alerts
factory/{site}/{line}/qa/metrics/*
```

### OPC UA Nodes (example)

```
ns=2;s=Factory.Lines.Line3.QA.LastEvent
ns=2;s=Factory.Lines.Line3.QA.AlertActive
ns=2;s=Factory.Lines.Line3.QA.Threshold
```

## Repository Layout

```
services/
  capture/
  preprocess/
  inference/
  results_adapter/
  governance_exporter/
ui/operator/
deploy/
  compose/docker-compose.yml
  k8s/base/*.yaml
  helm/edgesight-qa/*
  openshift/*.yaml
  terraform/*
assets/
scripts/
docs/
```

## Quickstart

### Prerequisites

* Docker and Docker Compose
* Optional: NVIDIA Container Toolkit if using a GPU
* Git, Python 3.10+, Node 18+ for local builds

### 1) Clone and seed demo assets

```bash
git clone https://github.com/your-org/edgesight-qa.git
cd edgesight-qa
./scripts/fetch_demo_model.sh assets  # Windows: run via WSL or manually download to assets/
```

### 2) Configure a synthetic camera

`config/cameras.yaml`

```yaml
site: sample-plant
line: line-1
cameras:
  - id: cam-A
    source: file:../data/sample.mp4
    fps: 20
    resolution: [1280, 720]
    time_sync: ntp.pool.org
```

### 3) Set preprocessing steps

`config/preprocess.yaml`

```yaml
pipeline:
  - op: resize
    width: 640
    height: 360
  - op: normalize
    mean: [0.485, 0.456, 0.406]
    std:  [0.229, 0.224, 0.225]
  - op: to_rgb
  - op: mask
    polygon: [[100,100], [540,100], [540,320], [100,320]]
```

### 4) Point to a model

`config/model.yaml`

```yaml
name: defect-v7
version: 7.2.1
format: onnx
path: models/defect-v7-7.2.1.onnx
threshold: 0.62
execution_provider: tensorrt
batch_size: 1
```

### 5) Outputs and plant integration

`config/outputs.yaml`

```yaml
operator_ui:
  enabled: true
  host: 0.0.0.0
  port: 5173

mqtt:
  enabled: true
  broker: mqtt://localhost:1883
  topic_base: factory/sample-plant/line-1/qa

opcua:
  enabled: false
  endpoint: opc.tcp://localhost:4840

storage:
  events_dir: data/events
  frames_dir: data/frames
  cloud:
    enabled: false
    provider: aws
    bucket: edgesight-events
```

### 2) Run with Docker Compose

Start the stack and demo:

```bash
docker compose -f deploy/compose/docker-compose.yml up --build -d
curl -X POST http://localhost:9001/start
open http://localhost:5173  # on Windows, browse manually
```

Open the Operator UI at `http://localhost:5173`. Events stream via SSE from the results adapter.

## Configuration

* All services read a single YAML config file each
* Environment variables can override any YAML key with `DOT.SEPARATED.KEY=value`
* Hot reload is supported for non‑structural changes, for example threshold updates

### MQTT configuration (results adapter)

Env vars:

```
MQTT_BROKER=mosquitto
MQTT_PORT=1883
MQTT_USERNAME= (optional)
MQTT_PASSWORD= (optional)
MQTT_QOS=1              # 0/1/2
MQTT_RETAIN=false       # retain flag for alerts
MQTT_TLS_ENABLED=false  # enable TLS
MQTT_TLS_INSECURE=false # allow insecure TLS (testing only)
CONF_THRESHOLD=0.5      # publish when any detection >= threshold
LINE_ID=line-1
```

Topics:

```
edgesight/line/{LINE_ID}/defect
```

### OPC UA configuration (results adapter)

Env vars:

```
OPCUA_ENABLED=0
OPCUA_ENDPOINT=opc.tcp://localhost:4840
OPCUA_DEFECT_NODE=ns=2;s=Factory.Lines.{line}.QA.LastEvent
```

When enabled, the adapter writes a JSON string payload to the configured node. Production deployments should use an address space agreed with controls and a trust store for TLS.

### Correlation IDs and tracing

The pipeline propagates an `X-Correlation-ID` header across services, echoed in SSE events and structured logs, to stitch metrics/logs together. OpenTelemetry can be enabled via envs to emit spans for capture → preprocess → inference → adapter.

Minimal collector setup (OTLP gRPC at 4317):

```
receivers:
  otlp:
    protocols:
      grpc:
exporters:
  logging: {}
service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [logging]
```

Env vars (services): `OTEL_ENABLED=1`, `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317`, `OTEL_EXPORTER_OTLP_INSECURE=1`, `OTEL_SERVICE_NAME=<service>`.

To see exemplars in Grafana, pair Prometheus with a traces backend (Grafana Tempo) and enable the OTEL→Tempo pipeline. Grafana can link metrics panels (e.g., e2e latency histograms) to spans when correlation IDs or trace IDs are present.

### Traces (Tempo + Grafana)

With docker-compose, a Tempo instance is included. Open Grafana (`http://localhost:3000`), then:

- Use the “Explore” tab, Tempo datasource, and query `{service.name="results-adapter"}` to browse recent traces.
- From the “EdgeSight QA” dashboard, click a point on the “E2E Latency p95/p99” graph; exemplars should pop and link to a trace.
- In the operator UI, each event includes a “View trace” link (when available) that opens the specific trace in Grafana Explore (Tempo datasource).

## Deployment

### Kubernetes / Helm

Apply base manifests:

```bash
kubectl apply -f deploy/k8s/base
```

Or install via Helm:

```bash
helm install edgesight-qa deploy/helm/edgesight-qa -n edgesight --create-namespace \
  --set image.repository=ghcr.io/your-org --set image.tag=latest
```

### OpenShift notes

* Use `DeploymentConfig` if required by policy
* Annotate pods for GPU scheduling where applicable
* Route Operator UI through an OpenShift Route

### Air‑gap packaging

Use the helper script to bundle images and charts:

```bash
./scripts/package_offline.sh
```

Load images on the target and configure a registry mirror or ImageContentSourcePolicy (OpenShift). See `deploy/helm/edgesight-qa/values.yaml` for environment overrides.

## Observability

Each service exposes Prometheus metrics at `/metrics`.

Key metrics:

```
edgesight_latency_ms{stage="capture→adapter"}
edgesight_fps{camera_id="cam-A"}
edgesight_false_alarm_rate
edgesight_model_confidence_bucket
edgesight_dropped_frames_total
edgesight_queue_backlog
```

Grafana dashboards are provided under `ops/grafana-dashboards`.

Logs are structured JSON and include `event_id`, `trace_id`, and `model.version`.

## Provenance and Compliance

* **Versioned artifacts**: model files, container digests, configuration hashes
* **SBOM** generation for each image
* **Signed releases** and optional cosign verification
* **Lineage logs**: requirement ID, story ID, code commit, container digest, model hash
* **Markdown report generation**: `docs/provenance-report-template.md` populated from logs

Report example front matter:

```yaml
report_id: prov-2025-09-06-001
period: 2025-09-01..2025-09-06
lines: [line-1]
models:
  - name: defect-v7
    version: 7.2.1
    hash: sha256:...
slis:
  latency_p95_ms: 175
  uptime: 99.95
  false_alarm_rate: 0.8%
```

## Testing

* **Unit tests** for preprocessing ops, schema validation, topic mapping
* **Integration tests** use a synthetic camera that replays video
* **Golden frames** validate boxes and scores within tolerance
* **Soak tests** run at target FPS for hours, verify p95 latency and no memory leaks
* **Failover tests** kill inference container and verify auto recovery and idempotent plant writes

Run tests:

```bash
pytest -q
```

## Ignition hookup notes

- MQTT topic: `edgesight/line/{line_id}/defect`
- Example payload includes `frame_id`, `detections[]`, `ts`, `model_hash`, `config_digest`.
- OPC UA: stub `write_defect_tag(line_id, payload)` provided; replace with plant tag writes.

## Troubleshooting

- Camera URL: set `CAMERA_URL=file:/app/assets/sample.mp4` for demo; RTSP URLs also supported.
- Time sync: ensure device NTP/PTP; pipeline uses monotonic timestamps.
- GPU: if using NVIDIA GPUs, install NVIDIA Container Toolkit; CPU fallback is supported.
- Permissions: bind‑mount `assets/` for model/video files; ensure readable by containers.
- Windows: if `scripts/fetch_demo_model.sh` cannot run, download a small ONNX model and a short MP4 clip into `assets/` manually.

## Performance Tuning

* Quantize to INT8, prune layers, prefer TensorRT on Jetson and NVIDIA GPUs
* Move preprocessing to GPU when possible
* Pin CPU affinities for capture and adapter
* Use zero‑copy buffers between preprocess and inference when available
* Batch small images if accuracy allows

## Security

* Secrets injected via Kubernetes Secrets or OpenShift equivalents
* Least privilege on MQTT and OPC UA
* RBAC for Operator UI actions, audit all state changes
* Network policies isolate services; only adapter speaks to plant systems

## Roadmap

* Multi‑line orchestration and fleet management
* Adapter plugins for Rockwell and Siemens stacks
* Built‑in drift detection and auto revalidation jobs
* Automated model registry integration and signed model promotion

## Related Work

* **PerceptionLab**: a camera pipeline lab with visualizations and thresholds, useful for tuning inspection settings.

  * [https://github.com/aurelius-in/perception-lab](https://github.com/aurelius-in/perception-lab)

## License

MIT. See `LICENSE` file.

## Acknowledgments

* Inductive Automation Ignition for SCADA integration patterns
* ONNX Runtime and TensorRT for efficient inference on edge devices

---

### Appendix: JIRA scaffold (copy as EPIC and stories)

```
EPIC: EdgeSight QA - Line 1 Pilot
- Story: Capture service with time sync and frame IDs
- Story: Preprocess pipeline with YAML config
- Story: Inference service with model registry and warm start
- Story: Results adapter with MQTT or OPC UA integration
- Story: Operator UI with overlays and threshold control
- Story: Metrics and logs across services, Grafana dashboards
- Story: Ignition alarm hookup and tag mapping
- Story: Rollout pipeline with canary and health gates
- Story: Provenance capture and markdown report generation
- Story: Performance and failover tests with golden frames
```

---

# Tailoring Guide: Denali & Fronterra (Food/Pharma) Readiness

This section distills **how EdgeSight QA maps to the needs of Denali’s AI Software BU** (Ignition-centric, AWS-friendly, regulated delivery with OpenShift/Kubernetes) **and to Fronterra** (food & beverage / process manufacturing with HACCP/SQF-style controls). Use it verbatim in RFPs, screenshares, or as a talking track.

## Who This Is For

* **Systems Integrators (e.g., Denali)** needing an **edge CV stack** that slots into **Ignition**, supports **air‑gapped or near‑air‑gapped** deployments, and scales from **1 line → 25+ lines** with repeatable practices.
* **Regulated manufacturers (e.g., pharma, food/bev like Fronterra)** that require **traceability, reproducibility, and data hygiene** with clear acceptance criteria (e.g., **99.99% accuracy target for advisory outputs** where required).

## Why It Fits (1‑page summary)

* **Plant‑ready:** MQTT/OPC UA adapters for Ignition; offline‑tolerant queues; operator overlays and alarms; time‑sync and device health baked in.
* **Regulatory‑aware:** Provenance ledger (model, data, config digests), e‑record/e‑sig hooks, retention policies, audit reports.
* **Platform‑native:** Kubernetes/OpenShift manifests; optional Terraform modules; artifact bundles for air‑gap installs.
* **Scale discipline:** Canary rollouts, health‑gated promotion, automated rollback; fleet metrics (latency, FPS, false‑alarm rate).

## Domain Use‑Cases (demo presets)

* **Pharma:** blister‑pack missing pill, vial cap/seal defect, label OCR mismatch, fill‑level variance.
* **Food & beverage:** foreign‑object detection, cap/crown mis‑seat, under/over‑fill, label skew/date‑code OCR.

> Tip: Include 2–3 domain presets in your `configs/` and a folder of example clips/images for instant demos.

---

## RM‑ODP Viewpack (AbbVie/regulated audiences)

**Enterprise view**: Business goal → Reduce defects/downtime; compliance → traceable decisions; stakeholders → quality, operations, validation.

**Information view**: Artifacts tracked → `dataset.hash`, `model.hash`, `config.digest`, `run.id`, `operator.id`, timestamps; retention & PHI/PII handling policy.

**Computational view**: Services → `capture`, `preprocess`, `inference`, `results‑adapter`, `governance‑exporter`; interfaces → gRPC/REST for internal; MQTT/OPC UA/REST for external.

**Engineering view**: Deploy → Kubernetes/OpenShift; packaging → OCI images; observability → Prometheus exporters + Grafana; storage → local TSDB + cloud sinks when available.

**Technology view**: Jetson Orin NX **or** x86+GPU IPC; PoE cameras + controlled lighting; NTP; secure boot (where supported); registry mirror for air‑gap.

Add these to `docs/rmodp.md` with one figure per view.

---

## IaC & Platform (

Kubernetes/OpenShift + Terraform)
**Manifests**

```
deploy/
  k8s/
    namespace.yaml
    capture-deploy.yaml
    preprocess-deploy.yaml
    inference-deploy.yaml
    results-adapter-deploy.yaml
    services/*.yaml
    hpa/*.yaml
  openshift/
    routes/*.yaml
    imagestreams/*.yaml
```

**Helm values (excerpt)**

```
imagePullPolicy: IfNotPresent
resources:
  requests: { cpu: "500m", memory: "1Gi" }
  limits:   { cpu: "2",    memory: "4Gi", nvidia.com/gpu: 1 }
probes:
  liveness:  /healthz
  readiness: /readyz
```

**Terraform skeleton** (`deploy/terraform/`)

* `providers.tf` (OpenShift/K8s + optional AWS/Azure)
* `main.tf` creates namespaces, secrets, configmaps, service accounts, RBAC
* `outputs.tf` exposes service endpoints for Ignition or gateway

**Air‑gap install**

* `./bin/package_offline.sh` to export Helm charts + images as tarballs
* Local registry mirror + `ImageContentSourcePolicy` (OpenShift)

---

## Provenance & Compliance Kit

Create `docs/provenance-report.md` describing:

* **Run manifest**: `run.json` (model hash, dataset hash, config digest, code commit, device ID, time window)
* **Append‑only decision log**: JSONL with signed entries (Ed25519), monotonic timestamps
* **Report generator**: `governance-exporter` converts logs → human‑readable PDF/Markdown; includes confusion matrix, p95 latency, FPS, error budget adherence
* **Policy examples**: retention (e.g., 30/90/365), operator access (RBAC), audit export (CSV/PDF, signature block)
* **Standards mapping (informative)**: FDA 21 CFR Part 11 (e‑records/e‑signatures), GxP/GMP concepts, HACCP/SQF controls (non‑normative guidance)

---

## Acceptance & Test Strategy (incl. 99.99% advisory target)

* **Performance gates**: p95 latency ≤ 200 ms, FPS ≥ target; health probes green for N hours across canary pool
* **Statistical accuracy gate** (advisory outputs): demonstrate ≥ 99.99% accuracy on N trials with **binomial CI ≥ target**; attach dataset card and sampling method
* **Stress & failover**: camera unplug/replug; network drop; disk‑full; thermal throttling; verify degraded but safe behavior
* **Traceability**: each test emits signed `run.json` + decision log for audit

Include sample `tests/` with pytest for services and a `soak.sh` script.

---

## Operator Workflow & Copilot (LLM + CV coexist)

* **Operator UI**: live overlay, threshold slider, last‑N events, “send to re‑inspect”.
* **Results adapter**: translates model output → Ignition tags/events; supports MQTT, OPC UA, and REST webhooks.
* **Language model copilot** (optional): natural‑language queries over logs (“show last 24h of cap‑mis‑seat at line 3”), retrieval‑augmented from decision logs; never alters edge decisions.

---

## Hardware BOM (reference)

* **Compute**: NVIDIA Jetson Orin NX **or** x86 IPC + RTX A2000/4000 (fan‑out via PoE switch)
* **Cameras**: Industrial PoE, fixed lens matched to working distance, polarizing filters as needed
* **Lighting**: ring/bar, diffusers; strobe option
* **Networking**: PoE switch, VLAN plan; NTP source
* **Enclosure**: IP‑rated; thermal plan; mounting hardware

Add `docs/bom.md` with part classes and lead‑time notes.

---

## Jira/Epics Breakdown (copy/paste)

**Epic: Edge capture to decision**

* Story: Implement camera capture service (multi‑camera, time‑sync, buffering)
* Story: Preprocessing pipeline with configurable steps
* Story: Inference service with ONNX Runtime/TensorRT; model registry integration
* Story: Results adapter with Ignition (MQTT/OPC UA) output + REST webhook
* Story: Health probes, metrics (Prometheus), structured logs

**Epic: Governance & provenance**

* Story: Run manifest + signed decision log
* Story: Governance exporter → PDF/Markdown
* Story: Retention & RBAC policy implementation

**Epic: Platform & rollout**

* Story: Helm charts + OpenShift routes; HPA
* Story: Canary rollout + auto‑rollback; CI/CD wiring
* Story: Air‑gap artifact bundling + registry mirror

---

## 8‑Minute Demo Runbook

1. **Pick a preset** (pharma or food/bev) → show overlays & adjustable threshold.
2. **Trigger stress** (toggle network/camera) → show degraded‑but‑safe behavior.
3. **Open Ignition** → event/alarm arrives; tag path shown.
4. **Open Grafana** → latency/FPS/false‑alarm trend.
5. **Open governance report** → signed decisions, model/data hashes.

---

## Two 30‑second spoken pitches

**For Denali**
“EdgeSight QA is a modular, containerized inspection stack that drops into Ignition and runs on Kubernetes or OpenShift on‑prem. It’s built for air‑gapped environments with registry mirroring, health‑gated rollouts, and a provenance ledger so every decision is auditable. We’ve packaged Terraform/Helm skeletons so your team can scale from one line to dozens without reinventing the deploy each time.”

**For Fronterra**
“EdgeSight QA targets food and beverage lines where downtime and quality drive margin. It flags under/over‑fill, cap mis‑seats, and label issues in real time on the device, then writes events to your plant systems even if the cloud link is down. A governance report ties each decision back to the model and data used, which supports HACCP/SQF style audits while keeping operators focused on simple overlays and alarms.”

---

## Links to Related Tools

* **PerceptionLab** – experiment and tune pipelines before production (thresholds, overlays, latency visuals).
* **This repo** – production‑style modules and deployment path.

> After the demo, share PerceptionLab to show you have **more than one** CV tool, then bring them back to EdgeSight QA for the production story.
