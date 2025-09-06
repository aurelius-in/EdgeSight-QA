from pathlib import Path
import json
from services.results_adapter.governance import GovernanceLogger


def test_append_and_verify(tmp_path: Path):
    gov = GovernanceLogger(base_dir=tmp_path)
    record = {"frame_id": "1", "ts": "2024-01-01T00:00:00Z", "detections": [], "model_hash": "h", "config_digest": "c", "threshold": 0.5, "latency_ms": 12.3}
    gov.append_signed(record)
    out = gov.summarize("2024-01-01", "2024-01-02")
    assert out["total_records"] >= 1
    assert out["invalid_signatures"] == 0


