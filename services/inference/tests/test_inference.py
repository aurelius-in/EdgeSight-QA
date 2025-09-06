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


def test_runtime_threshold_update(tmp_path):
    # point config into temp path
    os = __import__('os')
    os.environ['INFER_CONFIG_PATH'] = str(tmp_path / 'inference-config.json')
    eng = InferenceEngine(model_path="dummy.onnx")
    eng.set_threshold(0.9)
    arr = np.ones((3, 10, 10), dtype=np.float32) * 0.8
    assert eng.run(arr) == []
    eng.set_threshold(0.7)
    assert len(eng.run(arr)) == 1


