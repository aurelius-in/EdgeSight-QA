import argparse
import json
from datetime import datetime, date
from pathlib import Path
from statistics import median
from typing import List, Dict, Any

from jinja2 import Environment, FileSystemLoader
from nacl.signing import VerifyKey


def find_logs(base_dir: Path, start: date, end: date) -> List[Path]:
    paths = []
    for p in base_dir.iterdir():
        try:
            d = datetime.strptime(p.name, "%Y-%m-%d").date()
        except ValueError:
            continue
        if start <= d <= end:
            f = p / "decision.log.jsonl"
            if f.exists():
                paths.append(f)
    return sorted(paths)


def load_verify_key(keys_dir: Path) -> VerifyKey:
    pk_path = keys_dir / "ed25519.pk"
    return VerifyKey(pk_path.read_bytes())


def verify_and_aggregate(logs: List[Path], vk: VerifyKey) -> Dict[str, Any]:
    total = 0
    detections = 0
    latencies = []
    for log in logs:
        for line in log.read_text().splitlines():
            wrapped = json.loads(line)
            data = json.dumps(wrapped["record"], sort_keys=True).encode()
            sig = bytes.fromhex(wrapped["sig"])
            vk.verify(data, sig)
            total += 1
            detections += len(wrapped["record"].get("detections", []))
            if "latency_ms" in wrapped["record"]:
                latencies.append(wrapped["record"]["latency_ms"])
    p95 = 0
    if latencies:
        latencies.sort()
        idx = int(0.95 * (len(latencies) - 1))
        p95 = latencies[idx]
    return {"total": total, "detections": detections, "latency_p95_ms": p95}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="date_from", required=True)
    ap.add_argument("--to", dest="date_to", required=True)
    ap.add_argument("--out", dest="out", required=True)
    ap.add_argument("--base", dest="base", default="/app/data/governance")
    args = ap.parse_args()

    start = datetime.strptime(args.date_from, "%Y-%m-%d").date()
    end = datetime.strptime(args.date_to, "%Y-%m-%d").date()
    base = Path(args.base)
    logs = find_logs(base, start, end)
    if not logs:
        raise SystemExit("no logs in range")
    vk = load_verify_key(base / "keys")
    summary = verify_and_aggregate(logs, vk)

    env = Environment(loader=FileSystemLoader(str(Path(__file__).parent / "templates")))
    tmpl = env.get_template("report.md.j2")
    out_text = tmpl.render(period=f"{args.date_from}..{args.date_to}", summary=summary)
    Path(args.out).write_text(out_text, encoding="utf-8")


if __name__ == "__main__":
    main()


