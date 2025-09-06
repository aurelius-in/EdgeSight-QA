import os
import time
import threading
from collections import deque
from typing import Optional, Deque, Tuple

import uvicorn
import requests
import cv2
from fastapi import FastAPI
from prometheus_client import Counter, Gauge, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response

from camera import CameraConfig, read_frames


app = FastAPI(title="EdgeSight QA - Capture")


frames_sent = Counter("capture_frames_sent_total", "Total frames sent to preprocess")
frames_dropped = Counter("capture_frames_dropped_total", "Total frames dropped due to buffer limits or errors")
latency_est_ms = Histogram("capture_latency_est_ms", "Estimated capture-to-send latency (ms)", buckets=(1,5,10,20,50,100,200,500))
running_gauge = Gauge("capture_running", "1 if capture loop is running, else 0")
send_failures = Counter("capture_send_failures_total", "Failed HTTP sends to preprocess")


_capture_thread: Optional[threading.Thread] = None
_stop_flag = threading.Event()
_ready = False
_buffer: Deque[Tuple[int, int, bytes]] = deque(maxlen=int(os.getenv("BUFFER_MAX", "50")))


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/readyz")
def readyz():
    return ({"status": "ready"} if _ready else Response(status_code=503))


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


def _capture_loop():
    global _ready
    running_gauge.set(1)
    _ready = True
    cfg = CameraConfig(
        source=os.getenv("CAMERA_URL", "file:/app/assets/sample.mp4"),
        fps_cap=float(os.getenv("FRAME_RATE_CAP", "10")),
        width=int(os.getenv("FRAME_WIDTH", "640")),
        height=int(os.getenv("FRAME_HEIGHT", "360")),
    )
    preprocess_url = os.getenv("PREPROCESS_URL", "http://preprocess:9002/frame")
    backoff = 0.2
    try:
        for frame_id, ts_ns, frame in read_frames(cfg):
            if _stop_flag.is_set():
                break
            ok, jpg = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
            if not ok:
                frames_dropped.inc()
                continue
            _buffer.append((frame_id, ts_ns, jpg.tobytes()))

            # send preview opportunistically
            try:
                preview_url = os.getenv("PREVIEW_URL", "http://results_adapter:9004/frame_preview")
                requests.post(preview_url, data=_buffer[-1][2], timeout=0.2)
            except Exception:
                pass

            # attempt to flush buffer
            while _buffer and not _stop_flag.is_set():
                fid, ts, payload = _buffer[0]
                t0 = time.perf_counter()
                try:
                    resp = requests.post(
                        preprocess_url,
                        data={"frame_id": str(fid), "ts_monotonic_ns": str(ts)},
                        files={"image": (f"{fid}.jpg", payload, "image/jpeg")},
                        timeout=1.5,
                    )
                    if resp.status_code >= 400:
                        raise RuntimeError(f"bad status {resp.status_code}")
                    frames_sent.inc()
                    latency_est_ms.observe((time.perf_counter() - t0) * 1000.0)
                    _buffer.popleft()
                    backoff = 0.2
                except Exception:
                    send_failures.inc()
                    # backoff and keep buffer (drop oldest if full handled by deque maxlen)
                    time.sleep(backoff)
                    backoff = min(backoff * 2, 2.0)
                    break
    finally:
        running_gauge.set(0)
        _ready = False


@app.post("/start")
def start():
    global _capture_thread
    if _capture_thread and _capture_thread.is_alive():
        return {"status": "already_running"}
    _stop_flag.clear()
    _capture_thread = threading.Thread(target=_capture_loop, daemon=True)
    _capture_thread.start()
    return {"status": "started"}


@app.post("/stop")
def stop():
    if not _capture_thread:
        return {"status": "not_running"}
    _stop_flag.set()
    return {"status": "stopping"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "9001")))


@app.on_event("startup")
def _maybe_autostart():
    if os.getenv("CAPTURE_AUTOSTART", "false").lower() in ("1", "true", "yes"):
        try:
            start()
        except Exception:
            pass


