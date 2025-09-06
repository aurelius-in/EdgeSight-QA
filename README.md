# EdgeSight QA

A modular, containerized edge computer vision system for industrial quality assurance. Ingests multi‑camera feeds, runs on‑device inference, writes results to plant systems (Ignition, MQTT, OPC UA), and streams events and metrics to storage for monitoring, retraining, and audit.

> Goal: repeatable inspection that scales from one line to many, with traceability, safe rollouts, and operator‑friendly outputs.

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
edgesight-qa/
├─ edge/
│  ├─ capture-service/
│  ├─ preprocess-service/
│  ├─ inference-service/
│  └─ results-adapter/
├─ ui/
│  └─ operator-app/
├─ deploy/
│  ├─ docker-compose.yml
│  ├─ k8s/
│  │  ├─ namespace.yaml
│  │  ├─ capture-deployment.yaml
│  │  ├─ preprocess-deployment.yaml
│  │  ├─ inference-deployment.yaml
│  │  ├─ adapter-deployment.yaml
│  │  └─ services.yaml
│  └─ openshift/
├─ config/
│  ├─ cameras.yaml
│  ├─ preprocess.yaml
│  ├─ model.yaml
│  └─ outputs.yaml
├─ ops/
│  ├─ grafana-dashboards/
│  ├─ prometheus-scrape.yaml
│  └─ scripts/
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ golden-frames/
└─ docs/
   ├─ architecture.png
   └─ provenance-report-template.md
```

## Quickstart

### Prerequisites

* Docker and Docker Compose
* Optional: NVIDIA Container Toolkit if using a GPU
* Git, Python 3.10+, Node 18+ for local builds

### 1) Clone and seed sample assets

```bash
git clone https://github.com/aurelius-in/edgesight-qa.git
cd edgesight-qa
mkdir -p data/frames data/events
cp samples/video/line1.mp4 data/sample.mp4
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

### 6) Run with Docker Compose

`deploy/docker-compose.yml`

```yaml
version: "3.8"
services:
  capture:
    build: ../edge/capture-service
    volumes:
      - ../config:/app/config
      - ../data:/app/data
    environment:
      - CAM_CONFIG=/app/config/cameras.yaml
    ports: ["9001:9001"]
  preprocess:
    build: ../edge/preprocess-service
    volumes:
      - ../config:/app/config
    environment:
      - PREPROC_CONFIG=/app/config/preprocess.yaml
    ports: ["9002:9002"]
  inference:
    build: ../edge/inference-service
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
    volumes:
      - ../config:/app/config
      - ../models:/app/models
    environment:
      - MODEL_CONFIG=/app/config/model.yaml
    ports: ["9003:9003"]
  adapter:
    build: ../edge/results-adapter
    volumes:
      - ../config:/app/config
      - ../data:/app/data
    environment:
      - OUTPUTS_CONFIG=/app/config/outputs.yaml
    ports: ["9004:9004", "1883:1883"]
  ui:
    build: ../ui/operator-app
    ports: ["5173:5173"]
```

Start the stack:

```bash
cd deploy
docker compose up --build
```

Open the Operator UI at `http://localhost:5173`.

## Configuration

* All services read a single YAML config file each
* Environment variables can override any YAML key with `DOT.SEPARATED.KEY=value`
* Hot reload is supported for non‑structural changes, for example threshold updates

## Deployment

### Kubernetes

`deploy/k8s/capture-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: capture, namespace: edgesight }
spec:
  replicas: 1
  selector: { matchLabels: { app: capture } }
  template:
    metadata: { labels: { app: capture } }
    spec:
      containers:
        - name: capture
          image: ghcr.io/aurelius-in/edgesight-capture:latest
          ports: [{ containerPort: 9001 }]
          volumeMounts:
            - name: config
              mountPath: /app/config
          livenessProbe: { httpGet: { path: /healthz, port: 9001 }, initialDelaySeconds: 10, periodSeconds: 10 }
          readinessProbe:{ httpGet: { path: /readyz,  port: 9001 }, initialDelaySeconds: 5,  periodSeconds: 5 }
      volumes:
        - name: config
          configMap: { name: edgesight-config }
```

Apply manifests:

```bash
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s
```

### OpenShift notes

* Use `DeploymentConfig` if required by policy
* Annotate pods for GPU scheduling where applicable
* Route Operator UI through an OpenShift Route

### Air gapped or restricted networks

* Use a local registry mirror
* Preload images on the edge device
* Sync events and frames to an on‑prem object store, then to cloud on schedule

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
