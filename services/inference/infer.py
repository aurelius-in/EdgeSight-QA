import os
from typing import List, Dict, Any

import numpy as np


class InferenceEngine:
    def __init__(self, model_path: str):
        self.model_path = model_path
        # Minimal stub: real implementation would initialize onnxruntime with EP selection
        self.gpu_in_use = bool(int(os.getenv("GPU_IN_USE", "0")))
        self.ready = True

    def run(self, tensor_chw: np.ndarray) -> List[Dict[str, Any]]:
        # Demo stub: emit one fake detection when average intensity crosses threshold
        conf_threshold = float(os.getenv("CONF_THRESHOLD", "0.5"))
        avg = float(np.clip(tensor_chw.mean(), 0.0, 1.0))
        conf = max(0.0, min(1.0, avg))
        if conf >= conf_threshold:
            return [{"bbox": [10, 10, 50, 40], "score": conf, "class_id": 0}]
        return []


