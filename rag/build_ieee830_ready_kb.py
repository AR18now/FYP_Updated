#!/usr/bin/env python3
"""
Build a 'ready' knowledge base from the dataset evaluation output.

Inputs:
  - data/output/ieee830_dataset_evaluation.json

Outputs:
  - data/output/ieee830_dataset_summary.csv   (ranked)
  - data/knowledge_base/ieee830_ready/*.txt   (top docs copied)
  - data/knowledge_base/ieee830_ready_index.jsonl
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any, Dict, List, Tuple


def _combined_score(ieee: Dict[str, float], manual: Dict[str, float]) -> float:
    # Favor IEEE section completeness/structure for KB usefulness,
    # plus manual clarity (readability) and testability where available.
    return float(
        (0.35 * ieee.get("completeness", 0.0))
        + (0.15 * ieee.get("structure", 0.0))
        + (0.10 * ieee.get("clarity", 0.0))
        + (0.20 * manual.get("clarity", 0.0))
        + (0.10 * manual.get("testability", 0.0))
        + (0.10 * manual.get("ambiguity", 0.0))
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Create ranked CSV + ready KB from dataset evaluation JSON.")
    parser.add_argument("--eval_json", default="data/output/ieee830_dataset_evaluation.json")
    parser.add_argument("--summary_csv", default="data/output/ieee830_dataset_summary.csv")
    parser.add_argument("--ready_dir", default="data/knowledge_base/ieee830_ready")
    parser.add_argument("--ready_index", default="data/knowledge_base/ieee830_ready_index.jsonl")
    parser.add_argument("--top_n", type=int, default=25)
    parser.add_argument("--min_ieee_completeness", type=float, default=0.25)
    args = parser.parse_args()

    eval_json = Path(args.eval_json)
    summary_csv = Path(args.summary_csv)
    ready_dir = Path(args.ready_dir)
    ready_index = Path(args.ready_index)

    payload = json.loads(eval_json.read_text(encoding="utf-8"))
    evaluations: List[Dict[str, Any]] = payload.get("evaluations", [])

    rows: List[Tuple[float, Dict[str, Any]]] = []
    for ev in evaluations:
        ieee = ev.get("ieee_scores", {}) or {}
        manual = ev.get("manual_scores", {}) or {}
        score = _combined_score(ieee, manual)
        rows.append((score, ev))

    rows.sort(key=lambda x: x[0], reverse=True)

    summary_csv.parent.mkdir(parents=True, exist_ok=True)
    with summary_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "rank",
                "combined_score",
                "file",
                "kb_text_file",
                "ieee_completeness",
                "ieee_structure",
                "ieee_clarity",
                "ieee_relevance",
                "manual_clarity",
                "manual_ambiguity",
                "manual_testability",
                "manual_completeness",
                "manual_consistency",
                "manual_relevance",
            ]
        )
        for i, (score, ev) in enumerate(rows, start=1):
            ieee = ev.get("ieee_scores", {}) or {}
            manual = ev.get("manual_scores", {}) or {}
            writer.writerow(
                [
                    i,
                    round(score, 4),
                    ev.get("file", ""),
                    ev.get("kb_text_file", ""),
                    ieee.get("completeness", 0.0),
                    ieee.get("structure", 0.0),
                    ieee.get("clarity", 0.0),
                    ieee.get("relevance", 0.0),
                    manual.get("clarity", 0.0),
                    manual.get("ambiguity", 0.0),
                    manual.get("testability", 0.0),
                    manual.get("completeness", 0.0),
                    manual.get("consistency", 0.0),
                    manual.get("relevance", 0.0),
                ]
            )

    ready_dir.mkdir(parents=True, exist_ok=True)
    ready_index.parent.mkdir(parents=True, exist_ok=True)

    selected: List[Dict[str, str]] = []
    kept = 0
    for score, ev in rows:
        if kept >= args.top_n:
            break
        ieee = ev.get("ieee_scores", {}) or {}
        if float(ieee.get("completeness", 0.0)) < args.min_ieee_completeness:
            continue
        kb_text_file = Path(str(ev.get("kb_text_file", "")))
        if not kb_text_file.exists():
            continue

        target = ready_dir / kb_text_file.name
        text = kb_text_file.read_text(encoding="utf-8", errors="ignore")
        target.write_text(text, encoding="utf-8")

        selected.append(
            {
                "id": target.stem,
                "text": text,
                "source_file": str(ev.get("file", "")),
                "source_type": "ieee_830_template",
            }
        )
        kept += 1

    with ready_index.open("w", encoding="utf-8") as f:
        for row in selected:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(
        json.dumps(
            {
                "summary_csv": str(summary_csv),
                "ready_dir": str(ready_dir),
                "ready_index": str(ready_index),
                "selected_docs": kept,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

