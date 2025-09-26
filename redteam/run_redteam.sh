#!/usr/bin/env bash
set -euo pipefail
DATE=$(date +%Y%m%d)
OUTDIR=redteam/reports/$DATE
mkdir -p "$OUTDIR"
REPORT="$OUTDIR/infra-chaos.md"
{
  echo "# Red-Team Infra Chaos Report ($DATE)"
  echo
  echo "## Policy test results"
  echo '```'
  if ! command -v conftest >/dev/null 2>&1; then
    echo "conftest not found; please install or run in CI workflow"
  else
    conftest test redteam/rollout/bad_overlays/*.yaml -p policy/opa || true
  fi
  echo '```'
} > "$REPORT"
echo "Report written to $REPORT"