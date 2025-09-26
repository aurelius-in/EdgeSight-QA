# Operate & Rollback Playbook

- Health probes: /healthz, /metrics
- Degraded modes: drop non-critical outputs, backpressure queues
- Canary  rollback: use Argo Rollouts; revert digest on error budget breach
- Camera outage: alarm + switch to cached frames; mark events as degraded
- Model revert: pin previous digest and storageUri; restart inference