#!/usr/bin/env python3
"""
Run a lightweight verification suite for requirement-quality checks.

Outputs:
- data/output/verification_suite_report.json
- data/output/verification_suite_report.csv
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from evaluation.ambiguity_metric import AmbiguityMetric
from evaluation.clarity_readability_metric import ClarityReadabilityMetric
from evaluation.conflict_metric import ConflictMetric


def load_cases(path: Path) -> List[Dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def run_case(case: Dict[str, Any]) -> Dict[str, Any]:
    text = case.get("input_text", "")
    clarity = ClarityReadabilityMetric().score(text)
    ambiguity = AmbiguityMetric().score(text)
    conflict = ConflictMetric().analyze(text)

    passes = []
    if "expected_min_clarity" in case:
        passes.append(clarity >= float(case["expected_min_clarity"]))
    if "expected_min_conflict_score" in case:
        passes.append(conflict["score"] >= float(case["expected_min_conflict_score"]))
    if "expected_max_conflicts" in case:
        passes.append(conflict["conflict_count"] <= int(case["expected_max_conflicts"]))

    return {
        "id": case.get("id"),
        "name": case.get("name"),
        "clarity": clarity,
        "ambiguity": ambiguity,
        "conflict_score": conflict["score"],
        "conflict_count": conflict["conflict_count"],
        "status": "PASS" if all(passes) else "FAIL",
    }


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    cases_path = root / "tests" / "verification" / "test_cases_requirements.json"
    output_dir = root / "data" / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    cases = load_cases(cases_path)
    rows = [run_case(case) for case in cases]

    json_path = output_dir / "verification_suite_report.json"
    json_path.write_text(json.dumps(rows, indent=2), encoding="utf-8")

    csv_path = output_dir / "verification_suite_report.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["id", "name", "clarity", "ambiguity", "conflict_score", "conflict_count", "status"],
        )
        writer.writeheader()
        writer.writerows(rows)

    total = len(rows)
    passed = sum(1 for r in rows if r["status"] == "PASS")
    print(f"Verification suite complete: {passed}/{total} passed")
    print(f"JSON: {json_path}")
    print(f"CSV:  {csv_path}")


if __name__ == "__main__":
    main()

