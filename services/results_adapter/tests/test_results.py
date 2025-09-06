from services.results_adapter.governance import GovernanceLogger
from pathlib import Path


def test_governance_sign_and_verify(tmp_path: Path):
    gov = GovernanceLogger(base_dir=tmp_path)
    rec = {"frame_id": "f1", "detections": [], "model_hash": "m", "config_digest": "c"}
    gov.append_signed(rec)
    log = next((tmp_path / tmp_path.name if False else tmp_path).glob("**/decision.log.jsonl"))
    line = log.read_text().strip()
    wrapped = __import__('json').loads(line)
    assert gov.verify_record(wrapped)


