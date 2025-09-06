import os
import time
from dataclasses import dataclass
from typing import Optional, Iterator, Tuple

import cv2


@dataclass
class CameraConfig:
    source: str
    fps_cap: float
    width: int
    height: int


def open_capture(source: str) -> cv2.VideoCapture:
    if source.startswith("file:"):
        path = source.split(":", 1)[1]
        cap = cv2.VideoCapture(path)
    else:
        cap = cv2.VideoCapture(source)
    return cap


def read_frames(cfg: CameraConfig) -> Iterator[Tuple[int, int, 'cv2.Mat']]:
    cap = open_capture(cfg.source)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open camera source: {cfg.source}")
    frame_id = 0
    interval = 1.0 / max(0.1, cfg.fps_cap)
    try:
        while True:
            t0 = time.perf_counter()
            ok, frame = cap.read()
            if not ok or frame is None:
                # For file source, loop
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            if cfg.width > 0 and cfg.height > 0:
                frame = cv2.resize(frame, (cfg.width, cfg.height), interpolation=cv2.INTER_AREA)
            ts_ns = time.monotonic_ns()
            yield frame_id, ts_ns, frame
            frame_id += 1
            # pace to fps
            dt = time.perf_counter() - t0
            if dt < interval:
                time.sleep(interval - dt)
    finally:
        cap.release()


