#!/usr/bin/env bash
set -euo pipefail

ASSETS_DIR=${1:-assets}
mkdir -p "$ASSETS_DIR"

MODEL_URL="https://github.com/onnx/models/raw/main/vision/classification/mobilenet/model/mobilenetv2-7.onnx"
OUT="$ASSETS_DIR/yolov8n.onnx"

echo "Fetching demo ONNX model (MobileNetV2 as placeholder)"
curl -L "$MODEL_URL" -o "$OUT" || {
  echo "Download failed, creating dummy placeholder"
  echo "placeholder" > "$OUT"
}

echo "Creating tiny sample.mp4 placeholder"
ffmpeg -f lavfi -i color=c=gray:s=320x240:d=0.2 -vf "drawbox=10:10:50:40:red@0.5:t=fill" -r 5 "$ASSETS_DIR/sample.mp4" -y 2>/dev/null || true

echo "Done."


