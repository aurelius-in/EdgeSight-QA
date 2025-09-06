import os
import numpy as np
from services.inference.infer import InferenceEngine


def test_offline_force_detection(monkeypatch):
    monkeypatch.setenv('OFFLINE_FORCE', '1')
    eng = InferenceEngine(model_path='does-not-matter.onnx')
    t = np.zeros((3, 8, 8), dtype=np.float32)
    dets = eng.run(t)
    assert dets and dets[0]['score'] >= 0.5


def test_thresholding(monkeypatch):
    monkeypatch.setenv('OFFLINE_FORCE', '0')
    eng = InferenceEngine(model_path='does-not-matter.onnx')
    eng.set_threshold(0.2)
    t = np.ones((3, 8, 8), dtype=np.float32) * 0.3
    dets = eng.run(t)
    assert len(dets) == 1
    eng.set_threshold(0.9)
    dets = eng.run(t)
    assert len(dets) == 0


