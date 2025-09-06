import requests


def send_webhook(url: str, payload) -> bool:
    if not url:
        return False
    try:
        r = requests.post(url, json=payload, timeout=3)
        return r.status_code < 400
    except Exception:
        return False


