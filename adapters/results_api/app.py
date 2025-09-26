from fastapi import FastAPI, Response
from .schemas import DetectionEvent
from pathlib import Path
import json
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from time import time

REQUEST_LATENCY = Histogram('results_api_request_latency_seconds', 'Latency', ['endpoint'])
EVENT_COUNTER = Counter('results_api_events_total', 'Events received')

app = FastAPI(title="EdgeSight QA Results API", version="0.1.2")

@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/v1/healthz")
@REQUEST_LATENCY.labels('/v1/healthz').time()
def healthz():
    return {"status": "ok"}

@app.post("/v1/event")
@REQUEST_LATENCY.labels('/v1/event').time()
def post_event(event: DetectionEvent):
    EVENT_COUNTER.inc()
    return {"accepted": True, "camera_id": event.camera_id, "ts": event.ts.isoformat()}

@app.post("/v1/certify")
@REQUEST_LATENCY.labels('/v1/certify').time()
def certify(event: DetectionEvent):
    lane = "green" if event.score >= 0.9 else ("yellow" if event.score >= 0.7 else "red")
    citations = []
    qf = Path("qa-cert/gold-questions.json")
    if qf.exists():
        try:
            questions = json.loads(qf.read_text())
            citations = [q.get("sop") for q in questions if q.get("sop")]
        except Exception:
            pass
    return {"lane": lane, "rationale": f"score={event.score}", "citations": citations[:3]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("adapters.results_api.app:app", host="0.0.0.0", port=8080, reload=True)
