import requests
import json

BASE = "http://localhost:8080"

def test_certify_green():
    event = {
        "camera_id": "cam-1",
        "ts": "2024-01-01T00:00:00Z",
        "bbox": [0.1,0.1,0.5,0.5],
        "score": 0.95,
        "class_name": "ok"
    }
    r = requests.post(f"{BASE}/v1/certify", json=event, timeout=5)
    assert r.status_code == 200
    out = r.json()
    assert out.get("lane") == "green"

if __name__ == "__main__":
    test_certify_green()
    print("ok")