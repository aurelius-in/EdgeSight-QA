import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from prometheus_client import Counter, CONTENT_TYPE_LATEST, generate_latest

from sink_mqtt import publish_mqtt
from sink_opcua import write_defect_tag
from sink_webhook import send_webhook
from governance import GovernanceLogger


app = FastAPI(title="EdgeSight QA - Results Adapter")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

results_received = Counter("results_received_total", "Results received from inference")
mqtt_published = Counter("mqtt_published_total", "MQTT messages published")
opcua_published = Counter("opcua_published_total", "OPC UA writes attempted")
webhook_sent = Counter("webhook_sent_total", "Webhook posts sent")
governance_signed = Counter("governance_signed_total", "Governance records signed")

gov = GovernanceLogger(base_dir=Path(os.getenv("GOVERNANCE_DIR", "/app/data/governance")))

subscribers = []
import asyncio
# removed unused imports

OPCUA_ENABLED = os.getenv("OPCUA_ENABLED", "false").lower() in ("1", "true", "yes")

@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/readyz")
def readyz():
    return {"status": "ready"}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/result")
async def result(request: Request):
    payload = await request.json()
    results_received.inc()
    line_id = os.getenv("LINE_ID", "line-1")
    threshold = float(os.getenv("CONF_THRESHOLD", "0.5"))
    detections = payload.get("detections", [])
    ts = payload.get("ts") or datetime.utcnow().isoformat() + "Z"
    fire = any(d.get("score", 0.0) >= threshold for d in detections)

    if fire:
        topic = f"edgesight/line/{line_id}/defect"
        if publish_mqtt(topic, json.dumps(payload).encode()):
            mqtt_published.inc()
        if OPCUA_ENABLED:
            try:
                ok = await write_defect_tag(line_id, payload)
                if ok:
                    opcua_published.inc()
            except Exception:
                pass
        if send_webhook(os.getenv("WEBHOOK_URL", ""), payload):
            webhook_sent.inc()

    record = {
        "frame_id": payload.get("frame_id"),
        "ts": ts,
        "detections": detections,
        "model_hash": payload.get("model_hash", "unknown"),
        "config_digest": payload.get("config_digest", "unknown"),
        "threshold": threshold,
        "latency_ms": payload.get("latency_ms"),
    }
    gov.append_signed(record)
    governance_signed.inc()

    event = json.dumps({
        "ts": ts,
        "frame_id": record["frame_id"],
        "detections": detections
    })
    # structured log to stdout
    try:
        print(json.dumps({"event": "result", "frame_id": record["frame_id"], "ts": ts, "num_detections": len(detections)}), flush=True)
    except Exception:
        pass
    for queue in subscribers:
        queue.append(event)
    return {"status": "ok"}


@app.get("/events")
async def events():
    queue = []
    subscribers.append(queue)

    async def event_stream():
        try:
            last_ping = time.time()
            while True:
                if queue:
                    msg = queue.pop(0)
                    yield f"data: {msg}\n\n"
                # heartbeat every 10s
                now = time.time()
                if now - last_ping > 10:
                    yield ": keep-alive\n\n"
                    last_ping = now
                await asyncio.sleep(0.2)
        except Exception:
            pass
        finally:
            subscribers.remove(queue)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


_last_frame: bytes = b""


@app.post("/frame_preview")
async def frame_preview(request: Request):
    global _last_frame
    # Accept raw JPEG bytes
    _last_frame = await request.body()
    return {"status": "stored", "size": len(_last_frame)}


@app.get("/last_frame")
def last_frame():
    if not _last_frame:
        return Response(status_code=404)
    return Response(content=_last_frame, media_type="image/jpeg")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "9004")))


@app.get("/governance/summary")
def governance_summary(date_from: str, date_to: str):
    return gov.summarize(date_from, date_to)


@app.get("/config")
def get_config():
    return {"opcua_enabled": OPCUA_ENABLED}


@app.patch("/config")
async def patch_config(body: Dict[str, Any]):
    global OPCUA_ENABLED
    changed = {}
    if "opcua_enabled" in body:
        OPCUA_ENABLED = bool(body["opcua_enabled"])
        changed["opcua_enabled"] = OPCUA_ENABLED
    return {"updated": changed}


