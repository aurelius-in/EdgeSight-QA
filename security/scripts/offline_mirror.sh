#!/usr/bin/env bash
set -euo pipefail
LIST=${1:-security/sbom/mirror.txt}
OUTDIR=${2:-_offline}
mkdir -p "$OUTDIR"
while IFS= read -r img; do
  [[ -z "$img" || "$img" =~ ^# ]] && continue
  safe=$(echo "$img" | tr '/:@' '____')
  echo "Pulling $img"
  docker pull "$img"
  echo "Saving $img to $OUTDIR/$safe.tar"
  docker save -o "$OUTDIR/$safe.tar" "$img"
done < "$LIST"