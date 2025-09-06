import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

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

    def verify_record(self, wrapped: Dict[str, Any]) -> bool:
        try:
            data_bytes = json.dumps(wrapped["record"], sort_keys=True).encode()
            sig = bytes.fromhex(wrapped["sig"])
            self.verify_key.verify(data_bytes, sig)
            return True
        except (KeyError, BadSignatureError, ValueError):
            return False


