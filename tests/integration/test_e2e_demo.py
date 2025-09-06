import os, time, json
import requests


def test_e2e_demo_flow():
    # Use local compose in CI environment or assume running locally
    try:
        requests.post("http://localhost:9001/start", timeout=2)
    except Exception:
        pass
    # lower threshold and enable offline mode
    try:
        requests.patch("http://localhost:9003/config", json={"conf_threshold": 0.0, "offline_force": True}, timeout=2)
    except Exception:
        pass
    # wait and check adapter metrics
    deadline = time.time() + 20
    got = False
    while time.time() < deadline and not got:
        try:
            m = requests.get("http://localhost:9004/metrics", timeout=2).text
            if "results_received_total " in m:
                line = [l for l in m.splitlines() if l.startswith("results_received_total ")][0]
                val = float(line.split()[1])
                if val > 0:
                    # Also assert e2e histogram exists
                    assert "e2e_latency_ms_bucket" in m
                    got = True
                    break
        except Exception:
            pass
        time.sleep(1)
    assert got, "No results received in adapter metrics"


