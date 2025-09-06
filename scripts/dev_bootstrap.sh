#!/usr/bin/env bash
set -euo pipefail

python3 -m venv .venv || true
source .venv/bin/activate || true
pip install --upgrade pip
echo "Dev environment bootstrapped."


