from fastapi import FastAPI
from .schemas import DetectionEvent
from pathlib import Path
import json

app = FastAPI(title="EdgeSight QA Results API", version="0.1.1")

@app.get("/v1/healthz")
def healthz():
    return {"status": "ok"}

@app.post("/v1/event")
def post_event(event: DetectionEvent):
    return {"accepted": True, "camera_id": event.camera_id, "ts": event.ts.isoformat()}

@app.post("/v1/certify")
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