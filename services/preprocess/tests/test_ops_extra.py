import os
import numpy as np
import cv2
from services.preprocess.ops import resize_image, to_rgb, normalize, hwc_to_chw, run_pipeline


def test_resize_and_color():
    img = np.zeros((10, 20, 3), dtype=np.uint8)
    r = resize_image(img, 40, 30)
    assert r.shape == (30, 40, 3)
    rgb = to_rgb(r)
    assert rgb.shape == (30, 40, 3)


def test_normalize_and_chw():
    img = np.ones((4, 6, 3), dtype=np.uint8) * 128
    norm = normalize(img, (0.5, 0.5, 0.5), (0.25, 0.25, 0.25))
    assert np.isclose(norm.mean(), (128/255 - 0.5)/0.25, atol=1e-3)
    chw = hwc_to_chw(img)
    assert chw.shape == (3, 4, 6)


def test_run_pipeline_env(monkeypatch):
    monkeypatch.setenv('FRAME_WIDTH', '64')
    monkeypatch.setenv('FRAME_HEIGHT', '32')
    monkeypatch.setenv('NORM_MEAN', '0.5,0.5,0.5')
    monkeypatch.setenv('NORM_STD', '0.25,0.25,0.25')
    img = np.random.randint(0, 255, (50, 50, 3), dtype=np.uint8)
    out = run_pipeline(img)
    assert out.shape == (3, 32, 64)
    assert out.dtype == np.float32


