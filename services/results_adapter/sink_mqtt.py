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
    try:
        publish.single(topic, payload=payload, hostname=host, port=port)
        return True
    except Exception:
        return False


