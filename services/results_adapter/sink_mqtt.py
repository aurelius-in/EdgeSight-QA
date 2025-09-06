import os
from typing import Optional

try:
    import paho.mqtt.publish as publish
except Exception:  # pragma: no cover
    publish = None


def publish_mqtt(topic: str, payload: bytes) -> bool:
    if not publish:
        return False
    host = os.getenv("MQTT_BROKER", "localhost")
    port = int(os.getenv("MQTT_PORT", "1883"))
    username = os.getenv("MQTT_USERNAME")
    password = os.getenv("MQTT_PASSWORD")
    qos = int(os.getenv("MQTT_QOS", "0"))
    retain = os.getenv("MQTT_RETAIN", "false").lower() in ("1", "true", "yes")
    tls_enabled = os.getenv("MQTT_TLS_ENABLED", "false").lower() in ("1", "true", "yes")
    tls_insecure = os.getenv("MQTT_TLS_INSECURE", "false").lower() in ("1", "true", "yes")
    auth = None
    if username:
        auth = {"username": username, "password": password or ""}
    tls = None
    if tls_enabled:
        tls = {"insecure": tls_insecure}
    try:
        publish.single(
            topic,
            payload=payload,
            hostname=host,
            port=port,
            auth=auth,
            tls=tls,
            qos=qos,
            retain=retain,
        )
        return True
    except Exception:
        return False


