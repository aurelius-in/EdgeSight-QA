## 8-Minute Demo Runbook

1. Deploy stack via Docker Compose.
2. Trigger sample capture (`POST /start` on capture service).
3. Watch UI: live events stream and overlays.
4. Verify MQTT message received (use `mosquitto_sub`).
5. Show Grafana (if configured) with latency/FPS.
6. Generate governance report for demo window.

Commands

```bash
# Bring up services
docker compose -f deploy/compose/docker-compose.yml up --build -d

# Start capture demo
curl -X POST http://localhost:9001/start

# Tail events
curl -N http://localhost:9004/events

# Subscribe to MQTT
mosquitto_sub -h localhost -t 'edgesight/#' -v

# Generate report (example)
docker compose -f deploy/compose/docker-compose.yml run --rm governance_exporter \
  python generate_report.py --from 2025-09-01 --to 2025-09-06 --out /data/report.md
```


