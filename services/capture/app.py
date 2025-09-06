import os
import time
import threading
from typing import Optional

import uvicorn
from fastapi import FastAPI
from prometheus_client import Counter, Gauge, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response


app = FastAPI(title="EdgeSight QA - Capture")


frames_sent = Counter("capture_frames_sent_total", "Total frames sent to preprocess")
frames_dropped = Counter("capture_frames_dropped_total", "Total frames dropped due to buffer limits or errors")
latency_est_ms = Histogram("capture_latency_est_ms", "Estimated capture-to-send latency (ms)", buckets=(1,5,10,20,50,100,200,500))
running_gauge = Gauge("capture_running", "1 if capture loop is running, else 0")


_capture_thread: Optional[threading.Thread] = None
_stop_flag = threading.Event()
_ready = False


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
    fps_cap = float(os.getenv("FRAME_RATE_CAP", "10"))
    frame_interval = 1.0 / max(0.1, fps_cap)
    try:
        while not _stop_flag.is_set():
            t0 = time.perf_counter()
            # Demo mode: we do not actually capture here yet; just simulate a frame tick
            time.sleep(min(frame_interval, 0.005))
            frames_sent.inc()
            t1 = time.perf_counter()
            latency_est_ms.observe((t1 - t0) * 1000.0)
            # pace to fps
            dt = time.perf_counter() - t0
            if dt < frame_interval:
                time.sleep(frame_interval - dt)
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


