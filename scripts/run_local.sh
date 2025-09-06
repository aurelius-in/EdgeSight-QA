#!/usr/bin/env bash
set -euo pipefail

cp -n .env.example .env || true

docker compose -f deploy/compose/docker-compose.yml up --build -d
sleep 2
curl -s -X POST http://localhost:9001/start || true
echo "UI: http://localhost:5173 (if running)"


