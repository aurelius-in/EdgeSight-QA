#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=${1:-offline_bundle}
mkdir -p "$OUT_DIR"

echo "Exporting Docker images (build locally first)"
images=(capture preprocess inference results_adapter)
for img in "${images[@]}"; do
  tar_path="$OUT_DIR/$img.tar"
  echo "Saving $img to $tar_path"
  docker save "$img:latest" -o "$tar_path" || true
done

echo "Bundling Helm chart"
tar czf "$OUT_DIR/helm_edgesight_qa.tgz" -C deploy/helm edgesight-qa || true

echo "Done. Copy $OUT_DIR to air-gapped environment."


