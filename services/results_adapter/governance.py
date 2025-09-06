import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List

from nacl.signing import SigningKey, VerifyKey
from nacl.exceptions import BadSignatureError


@dataclass
class GovernanceLogger:
    base_dir: Path

    def __post_init__(self):
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.keys_dir = self.base_dir / "keys"
        self.keys_dir.mkdir(parents=True, exist_ok=True)
        self._ensure_keys()

    def _ensure_keys(self):
        sk_path = self.keys_dir / "ed25519.sk"
        pk_path = self.keys_dir / "ed25519.pk"
        if sk_path.exists() and pk_path.exists():
            self.signing_key = SigningKey(sk_path.read_bytes())
            self.verify_key = VerifyKey(pk_path.read_bytes())
        else:
            self.signing_key = SigningKey.generate()
            self.verify_key = self.signing_key.verify_key
            sk_path.write_bytes(bytes(self.signing_key))
            pk_path.write_bytes(bytes(self.verify_key))

    def _log_path(self, dt: datetime) -> Path:
        day_dir = self.base_dir / dt.strftime("%Y-%m-%d")
        day_dir.mkdir(parents=True, exist_ok=True)
        return day_dir / "decision.log.jsonl"

    def append_signed(self, record: Dict[str, Any]):
        data_bytes = json.dumps(record, sort_keys=True).encode()
        sig = self.signing_key.sign(data_bytes).signature.hex()
        wrapped = {"record": record, "sig": sig}
        p = self._log_path(datetime.utcnow())
        with p.open("a", encoding="utf-8") as f:
            f.write(json.dumps(wrapped) + "\n")

    def enforce_retention(self, days: int = 30) -> int:
        cutoff = datetime.utcnow().date() - timedelta(days=days)
        removed = 0
        for day_dir in self.base_dir.glob("*"):
            try:
                d = datetime.strptime(day_dir.name, "%Y-%m-%d").date()
            except ValueError:
                continue
            if d < cutoff:
                try:
                    for fp in day_dir.glob("*"):
                        fp.unlink(missing_ok=True)  # type: ignore[arg-type]
                    day_dir.rmdir()
                    removed += 1
                except Exception:
                    pass
        return removed

    def verify_record(self, wrapped: Dict[str, Any]) -> bool:
        try:
            data_bytes = json.dumps(wrapped["record"], sort_keys=True).encode()
            sig = bytes.fromhex(wrapped["sig"])
            self.verify_key.verify(data_bytes, sig)
            return True
        except (KeyError, BadSignatureError, ValueError):
            return False

    def summarize(self, date_from: str, date_to: str) -> Dict[str, Any]:
        start = datetime.strptime(date_from, "%Y-%m-%d").date()
        end = datetime.strptime(date_to, "%Y-%m-%d").date()
        totals = 0
        invalid = 0
        detections = 0
        latencies = []
        for day_dir in sorted(self.base_dir.glob("*")):
            try:
                d = datetime.strptime(day_dir.name, "%Y-%m-%d").date()
            except ValueError:
                continue
            if d < start or d > end:
                continue
            log = day_dir / "decision.log.jsonl"
            if not log.exists():
                continue
            for line in log.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                wrapped = json.loads(line)
                totals += 1
                if not self.verify_record(wrapped):
                    invalid += 1
                rec = wrapped.get("record", {})
                detections += len(rec.get("detections", []))
                if "latency_ms" in rec and isinstance(rec["latency_ms"], (int, float)):
                    latencies.append(float(rec["latency_ms"]))
        p95 = 0.0
        if latencies:
            latencies.sort()
            idx = int(0.95 * (len(latencies) - 1))
            p95 = latencies[idx]
        return {"total": totals, "invalid": invalid, "detections": detections, "latency_p95_ms": p95}


