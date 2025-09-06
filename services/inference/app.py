import os
import io
import time
from typing import Dict, Any, List

import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
import uvicorn
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from infer import InferenceEngine


app = FastAPI(title="EdgeSight QA - Inference")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenTelemetry minimal bootstrap
def _init_tracing():
    import os
    if os.getenv("OTEL_ENABLED", "1").lower() in ("1", "true", "yes"):
        endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317")
        insecure = os.getenv("OTEL_EXPORTER_OTLP_INSECURE", "1").lower() in ("1", "true", "yes")
        resource = Resource.create({"service.name": os.getenv("OTEL_SERVICE_NAME", "inference")})
        provider = TracerProvider(resource=resource)
        exporter = OTLPSpanExporter(endpoint=endpoint, insecure=insecure)
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)
        FastAPIInstrumentor().instrument_app(app)

_init_tracing()

infer_ms = Histogram("model_infer_ms", "Model inference time (ms)", buckets=(1,5,10,20,50,100,200,500))
num_detections = Histogram("n_detections", "Number of detections per frame", buckets=(0,1,2,3,5,10))
gpu_in_use = Gauge("gpu_in_use", "1 if GPU EP active, else 0")

engine = InferenceEngine(os.getenv("MODEL_PATH", "/app/assets/yolov8n.onnx"))
gpu_in_use.set(1 if engine.gpu_in_use else 0)
_ready = engine.ready


@app.get("/healthz")
def healthz():
    return {"status": "ok", "model_loaded": engine.ready}


@app.get("/readyz")
def readyz():
    ok = engine.ready
    return ({"status": "ready"} if ok else Response(status_code=503))


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/infer")
def infer(frame_id: str = Form(...), ts_monotonic_ns: int = Form(...), tensor: UploadFile = File(...), shape: UploadFile = File(...), dtype: UploadFile = File(...)) -> Dict[str, Any]:
    tensor_bytes = tensor.file.read()
    shape_str = shape.file.read().decode().strip()
    # safe parse for shape like "[3, 360, 640]" or "(3,360,640)"
    clean = shape_str.strip().lstrip('([').rstrip(')]')
    shape_list = [int(x.strip()) for x in clean.split(',') if x.strip()]
    dtype_str = dtype.file.read().decode().strip()
    arr = np.frombuffer(tensor_bytes, dtype=np.dtype(dtype_str)).reshape(shape_list)
    t0 = time.perf_counter()
    detections = engine.run(arr)
    t1 = time.perf_counter()
    infer_ms.observe((t1 - t0) * 1000.0)
    num_detections.observe(len(detections))
    return {"frame_id": frame_id, "ts_monotonic_ns": ts_monotonic_ns, "detections": detections}


@app.patch("/config")
def patch_config(cfg: Dict[str, Any] = Body(...)):
    threshold = cfg.get("conf_threshold")
    offline_force = cfg.get("offline_force") or cfg.get("demo_force")
    updated = {}
    if threshold is not None:
        engine.set_threshold(float(threshold))
        updated["conf_threshold"] = engine.conf_threshold
    if offline_force is not None:
        engine.set_offline_force(bool(offline_force))
        updated["offline_force"] = engine.offline_force
    return {"updated": updated}


@app.get("/config")
def get_config():
    providers: list[str] = []
    try:
        providers = list(getattr(engine, "providers", []) or [])
    except Exception:
        providers = []
    return {
        "conf_threshold": engine.conf_threshold,
        "offline_force": engine.offline_force,
        "gpu_in_use": bool(engine.gpu_in_use),
        "providers": providers,
        "ready": bool(engine.ready),
    }


@app.get("/status")
def status():
    return get_config()


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "9003")))


