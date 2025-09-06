from typing import Tuple
import os
import numpy as np
import cv2


def resize_image(image_bgr: np.ndarray, width: int, height: int) -> np.ndarray:
    return cv2.resize(image_bgr, (width, height), interpolation=cv2.INTER_AREA)


def to_rgb(image_bgr: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)


def normalize(image_rgb: np.ndarray, mean: Tuple[float, float, float], std: Tuple[float, float, float]) -> np.ndarray:
    image_float = image_rgb.astype(np.float32) / 255.0
    mean_arr = np.array(mean, dtype=np.float32)
    std_arr = np.array(std, dtype=np.float32)
    return (image_float - mean_arr) / std_arr


def hwc_to_chw(image_rgb: np.ndarray) -> np.ndarray:
    return np.transpose(image_rgb, (2, 0, 1))


def run_pipeline(image_bgr: np.ndarray) -> np.ndarray:
    width = int(os.getenv("FRAME_WIDTH", "640"))
    height = int(os.getenv("FRAME_HEIGHT", "360"))
    mean = tuple(float(x) for x in os.getenv("NORM_MEAN", "0.485,0.456,0.406").split(","))
    std = tuple(float(x) for x in os.getenv("NORM_STD", "0.229,0.224,0.225").split(","))
    resized = resize_image(image_bgr, width, height)
    rgb = to_rgb(resized)
    normed = normalize(rgb, mean, std)
    chw = hwc_to_chw(normed)
    return chw.astype(np.float32)


