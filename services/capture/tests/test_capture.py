import time
from fastapi.testclient import TestClient


def test_health_and_startup():
    from services.capture.app import app  # import via repo path in CI
    client = TestClient(app)

    assert client.get("/healthz").status_code == 200
    r = client.post("/start")
    assert r.status_code == 200
    time.sleep(0.1)
    r2 = client.get("/readyz")
    assert r2.status_code in (200, 503)


