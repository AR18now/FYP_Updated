#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from rag.evaluate_srs_kb import KBEvaluator


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify stored KB metrics by recomputing and diffing.")
    parser.add_argument("--report_json", default="data/output/kb_quality_report_all232.json")
    parser.add_argument("--tolerance", type=float, default=0.001)
    args = parser.parse_args()

    report_path = Path(args.report_json)
    payload = json.loads(report_path.read_text(encoding="utf-8"))
    rows: List[Dict] = payload.get("rows", [])
    evaluator = KBEvaluator()

    checked = 0
    mismatches = 0
    mismatch_examples: List[Dict] = []

    # Recompute and compare every numeric field present in row except counts/flags/file.
    skip_fields = {"file", "passed"}
    for row in rows:
        file_path = Path(row["file"])
        text = file_path.read_text(encoding="utf-8", errors="ignore")
        recalculated = evaluator.evaluate_document(text)

        checked += 1
        local_diffs = {}
        for key, value in row.items():
            if key in skip_fields:
                continue
            if isinstance(value, (int, float)) and key in recalculated:
                if abs(float(value) - float(recalculated[key])) > args.tolerance:
                    local_diffs[key] = {"stored": value, "recomputed": recalculated[key]}

        if local_diffs:
            mismatches += 1
            if len(mismatch_examples) < 10:
                mismatch_examples.append(
                    {"file": str(file_path), "differences": local_diffs}
                )

    result = {
        "report_json": str(report_path),
        "checked_rows": checked,
        "mismatch_rows": mismatches,
        "tolerance": args.tolerance,
        "status": "OK" if mismatches == 0 else "MISMATCH_FOUND",
        "examples": mismatch_examples,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

