import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional

import numpy as np


class InferenceEngine:
    def __init__(self, model_path: str):
        self.model_path = model_path
        # Minimal stub: real implementation would initialize onnxruntime with EP selection
        self.gpu_in_use = bool(int(os.getenv("GPU_IN_USE", "0")))
        self.ready = True
        self.config_path = Path(os.getenv("INFER_CONFIG_PATH", "./inference-config.json"))
        cfg = self._load_config()
        self.conf_threshold = cfg.get("conf_threshold", float(os.getenv("CONF_THRESHOLD", "0.5")))
        self.demo_force = cfg.get("demo_force", os.getenv("DEMO_FORCE", "0") in ("1", "true", "yes"))

    def run(self, tensor_chw: np.ndarray) -> List[Dict[str, Any]]:
        # Demo stub: optionally force one detection
        if self.demo_force:
            return [{"bbox": [10, 10, 50, 40], "score": 0.9, "class_id": 0}]
        # Otherwise emit one fake detection when average intensity crosses threshold
        avg = float(np.clip(tensor_chw.mean(), 0.0, 1.0))
        conf = max(0.0, min(1.0, avg))
        if conf >= self.conf_threshold:
            return [{"bbox": [10, 10, 50, 40], "score": conf, "class_id": 0}]
        return []

    def _load_config(self) -> Dict[str, Any]:
        try:
            if self.config_path.exists():
                data = json.loads(self.config_path.read_text(encoding="utf-8"))
                if not isinstance(data, dict):
                    return {}
                return data
        except Exception:
            return {}
        return {}

    def set_threshold(self, value: float) -> None:
        self.conf_threshold = float(value)
        try:
            self.config_path.write_text(json.dumps({
                "conf_threshold": self.conf_threshold,
                "demo_force": bool(self.demo_force)
            }, indent=2), encoding="utf-8")
        except Exception:
            # Best-effort persistence
            pass

    def set_demo_force(self, enabled: bool) -> None:
        self.demo_force = bool(enabled)
        try:
            self.config_path.write_text(json.dumps({
                "conf_threshold": self.conf_threshold,
                "demo_force": bool(self.demo_force)
            }, indent=2), encoding="utf-8")
        except Exception:
            pass


