import io
import os
import time
from typing import Dict, Any

import uvicorn
import numpy as np
import cv2
import httpx
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from prometheus_client import Counter, Gauge, Histogram, CONTENT_TYPE_LATEST, generate_latest

from ops import run_pipeline


app = FastAPI(title="EdgeSight QA - Preprocess")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

preprocess_counter = Counter("preprocess_frames_total", "Frames received for preprocessing")
preprocess_time_ms = Histogram("preprocess_time_ms", "Preprocess step time (ms)", buckets=(1,5,10,20,50,100,200))
queue_depth = Gauge("preprocess_queue_depth", "Naive queue depth gauge")

_ready = True


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/readyz")
def readyz():
    return ({"status": "ready"} if _ready else Response(status_code=503))


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/frame")
async def frame(frame_id: str = Form(...), ts_monotonic_ns: int = Form(...), image: UploadFile = File(...)) -> Dict[str, Any]:
    preprocess_counter.inc()
    queue_depth.inc()
    try:
        image_bytes = await image.read()
        np_arr = np.frombuffer(image_bytes, dtype=np.uint8)
        bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if bgr is None:
            return {"error": "invalid_image"}
        t0 = time.perf_counter()
        tensor = run_pipeline(bgr)
        t1 = time.perf_counter()
        preprocess_time_ms.observe((t1 - t0) * 1000.0)

        infer_url = os.getenv("INFERENCE_URL", "http://inference:9003/infer")
        payload = {
            "frame_id": frame_id,
            "ts_monotonic_ns": ts_monotonic_ns,
        }
        files = {
            "tensor": (f"{frame_id}.npy", io.BytesIO(tensor.tobytes()), "application/octet-stream"),
            "shape": ("shape.txt", str(list(tensor.shape)).encode(), "text/plain"),
            "dtype": ("dtype.txt", str(tensor.dtype).encode(), "text/plain"),
        }
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(infer_url, data=payload, files=files, timeout=5)
                resp.raise_for_status()
                result = resp.json()
            # Forward to results adapter
            results_url = os.getenv("RESULTS_URL", "http://results_adapter:9004/result")
            out = {
                "frame_id": result.get("frame_id", frame_id),
                "detections": result.get("detections", []),
                "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "model_hash": os.getenv("MODEL_HASH", "demo"),
                "config_digest": os.getenv("CONFIG_DIGEST", "demo"),
                "latency_ms": (time.perf_counter() - t0) * 1000.0,
            }
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(results_url, json=out, timeout=3)
            except Exception:
                pass
            return result
        except Exception:
            return {"frame_id": frame_id, "forwarded": False}
    finally:
        queue_depth.dec()


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "9002")))


