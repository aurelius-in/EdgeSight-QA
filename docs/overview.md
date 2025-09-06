## EdgeSight QA Overview

**Purpose**: Real-time edge computer vision for manufacturing quality assurance. Modular microservices: capture → preprocess → inference → results adapter, with governance and an operator UI.

### Primary Flow

PoE industrial camera(s) → capture → preprocess → on-device inference (ONNX Runtime / TensorRT) → results adapter (MQTT/OPC UA/webhook) → operator overlay and decision log.

### Non-functional Targets

- p95 end-to-end operator alert ≤ 200 ms
- Degraded safe behavior on network/camera failures
- Air-gap friendly deployment artifacts
- Health-gated promotions and canary rollout
- Auditability via signed decision logs (Ed25519)

### Architecture

```
[ Camera(s) ] → [ Capture ] → [ Preprocess ] → [ Inference ] → [ Results Adapter ] → [ MQTT/OPC UA/Webhook ]
                                                  ↘                                        ↘
                                              [ UI (SSE) ]                           [ Governance Log ]
```

### Tech Stack

- Python 3.10, FastAPI + Uvicorn, OpenCV, onnxruntime-gpu (TensorRT/CUDA/CPU fallback)
- paho-mqtt, asyncua (OPC UA stub), requests
- React + Vite operator UI
- Docker + Compose; Kubernetes/OpenShift + Helm; Terraform skeleton
- Prometheus metrics; structured JSON logs

### Interfaces

- HTTP JSON between services (local mode). Can evolve to gRPC / message bus.
- Health: GET `/healthz`, readiness: GET `/readyz`, metrics: GET `/metrics` (Prometheus)
- Events: Results adapter Server-Sent Events at GET `/events`

See also: `docs/rmodp.md`, `docs/governance-provenance.md`, and the root `README.md` for quickstart.


