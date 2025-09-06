import json
from pathlib import Path
from datetime import datetime
from nacl.signing import SigningKey

from services.governance_exporter.generate_report import find_logs, verify_and_aggregate


def test_verify_and_aggregate(tmp_path: Path):
    # create key
    keys = tmp_path / "keys"
    keys.mkdir(parents=True)
    sk = SigningKey.generate()
    (keys / "ed25519.sk").write_bytes(bytes(sk))
    (keys / "ed25519.pk").write_bytes(bytes(sk.verify_key))
    # create log
    day = tmp_path / datetime.utcnow().strftime("%Y-%m-%d")
    day.mkdir()
    p = day / "decision.log.jsonl"
    rec = {"detections": [{"score": 0.9}]}
    sig = sk.sign(json.dumps(rec, sort_keys=True).encode()).signature.hex()
    p.write_text(json.dumps({"record": rec, "sig": sig}) + "\n")
    logs = find_logs(tmp_path, datetime.utcnow().date(), datetime.utcnow().date())
    from nacl.signing import VerifyKey
    vk = VerifyKey((keys / "ed25519.pk").read_bytes())
    summary = verify_and_aggregate(logs, vk)
    assert summary["total"] == 1 and summary["detections"] == 1


