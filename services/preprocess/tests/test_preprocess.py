import numpy as np
import cv2

from services.preprocess.ops import resize_image, to_rgb, normalize, hwc_to_chw


def test_ops_basic():
    img = np.zeros((100, 200, 3), dtype=np.uint8)
    img[:, :] = (0, 128, 255)  # BGR
    resized = resize_image(img, 50, 25)
    assert resized.shape == (25, 50, 3)
    rgb = to_rgb(resized)
    assert rgb.shape == (25, 50, 3)
    normed = normalize(rgb, (0.5, 0.5, 0.5), (0.5, 0.5, 0.5))
    assert normed.dtype == np.float32
    chw = hwc_to_chw(normed)
    assert chw.shape == (3, 25, 50)


