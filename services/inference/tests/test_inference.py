import numpy as np

from services.inference.infer import InferenceEngine


def test_stub_detection_threshold():
    eng = InferenceEngine(model_path="dummy.onnx")
    arr = np.ones((3, 10, 10), dtype=np.float32) * 0.6
    det = eng.run(arr)
    assert len(det) == 1
    arr2 = np.zeros((3, 10, 10), dtype=np.float32)
    det2 = eng.run(arr2)
    assert len(det2) == 0


