## RM-ODP Views for EdgeSight QA

### Enterprise View

- Goals: reduce scrap, increase first-pass yield; satisfy audit and compliance.
- Stakeholders: Quality, Operations, OT/IT, Compliance, Validation.
- Policies: release gates, error budgets, retention windows.

### Information View

- Artifacts: frames, detections, decision logs (signed JSONL), run manifest (model/data/config fingerprints).
- Events schema: `frame_id`, `ts`, `detections[]`, `model_hash`, `config_digest`, `latency_ms`.
- Retention: configurable (e.g., 30/90/365 days); RBAC on export.

### Computational View

- Services: capture, preprocess, inference, results_adapter, governance_exporter, operator UI.
- Contracts: HTTP JSON for local; MQTT/OPC UA to plant; SSE for UI.
- Cross-cutting: health/readiness, metrics, structured logs, config via env/YAML.

### Engineering View

- Packaging: OCI images; Docker Compose for local; Helm on Kubernetes/OpenShift.
- Ops: liveness/readiness probes; HPA-ready; GPU optional via `nvidia.com/gpu` resource.
- Air-gap: registry mirror, image bundles, chart export, documented sync.

### Technology View

- Compute: Jetson Orin NX or x86+GPU IPC.
- Cameras: PoE GigE/RTSP; lighting and lenses per station.
- Inference: ONNX Runtime with TensorRT EP if available, else CUDA, else CPU.
- Plant integration: MQTT (eclipse-mosquitto), OPC UA (asyncua stub), webhooks.

Diagrams intentionally simple; see `docs/overview.md` for the block diagram.


