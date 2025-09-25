import os
import json
import time
from typing import Dict
import paho.mqtt.client as mqtt

MQTT_HOST = os.getenv('MQTT_HOST', 'localhost')
MQTT_PORT = int(os.getenv('MQTT_PORT', '1883'))
MQTT_USERNAME = os.getenv('MQTT_USERNAME')
MQTT_PASSWORD = os.getenv('MQTT_PASSWORD')
MQTT_TOPIC_BASE = os.getenv('MQTT_TOPIC_BASE', 'edgesight/qa')
MQTT_CLIENT_ID = os.getenv('MQTT_CLIENT_ID', 'edgesight-qa-publisher')

_client: mqtt.Client | None = None


def _get_client() -> mqtt.Client:
    global _client
    if _client is not None:
        return _client
    client = mqtt.Client(client_id=MQTT_CLIENT_ID, clean_session=True)
    if MQTT_USERNAME and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=30)
    client.loop_start()
    _client = client
    return client


def publish_detection_summary(event: Dict) -> None:
    camera_id = event.get('camera_id', 'unknown')
    topic = f"{MQTT_TOPIC_BASE}/cameras/{camera_id}/events"
    payload = {
        'camera_id': camera_id,
        'ts': event.get('ts'),
        'score': event.get('score'),
        'class_name': event.get('class_name'),
        'frame_id': event.get('frame_id'),
        'run_id': event.get('run_id'),
    }
    client = _get_client()
    client.publish(topic, json.dumps(payload), qos=1, retain=False)


if __name__ == '__main__':
    demo = {
        'camera_id': 'cam-1',
        'ts': '2024-01-01T00:00:00Z',
        'score': 0.93,
        'class_name': 'ok',
        'frame_id': 'f-1'
    }
    publish_detection_summary(demo)
    time.sleep(1)