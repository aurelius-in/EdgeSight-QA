## Governance, Provenance, and Audit

### Run Manifest

Each run produces a manifest capturing model hash, dataset snapshot, config digest, container digests, device ID, and time window. Stored alongside decision logs.

### Decision Logs (Append-only, Signed)

- Format: JSON Lines; one record per decision/event.
- Signature: Ed25519 per-record signature; keypair generated on first boot and stored under `data/keys/`.
- Verification: `services/governance_exporter/generate_report.py` validates signatures during report generation.

### Report Generation

- CLI: `python generate_report.py --from YYYY-MM-DD --to YYYY-MM-DD --out report.md`
- Outputs: totals, detection counts, p95 latency, FPS, model/config fingerprints, optional confusion matrix.
- Template: Jinja2 at `templates/report.md.j2`.

### Retention & RBAC

- Logs and frames kept per policy (e.g., 30/90/365 days) with clear ownership.
- Exports require appropriate role; all exports are logged and signed.

### Standards Mapping (Informative)

- FDA 21 CFR Part 11: e-records/e-signatures alignment via signed logs and report attestation.
- HACCP/SQF friendly language: traceable decisions, retention policy, and access control.


