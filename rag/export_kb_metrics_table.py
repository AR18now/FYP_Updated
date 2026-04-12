#!/usr/bin/env python3
import csv
import json
from pathlib import Path


def main() -> None:
    src = Path("data/output/kb_quality_report.json")
    csv_out = Path("data/output/kb_metrics_table_per_file.csv")
    md_out = Path("data/output/kb_metrics_table_per_file.md")

    data = json.loads(src.read_text(encoding="utf-8"))
    rows = data.get("rows", [])

    metric_cols = [
        "completeness_metric",
        "structure_compliance_metric",
        "clarity_metric",
        "weak_phrase_metric",
        "optionality_metric",
        "atomicity_metric",
        "consistency_metric",
        "verifiability_metric",
        "requirement_uniqueness_metric",
        "requirement_id_coverage_metric",
        "readability_metric",
        "requirement_density_metric",
        "overall_score",
    ]

    csv_out.parent.mkdir(parents=True, exist_ok=True)
    with csv_out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["file_name", *metric_cols])
        for r in rows:
            file_name = Path(r.get("file", "")).name
            writer.writerow([file_name, *[r.get(c, "") for c in metric_cols]])

    # Markdown table
    header = ["file_name", *metric_cols]
    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(["---"] * len(header)) + " |",
    ]
    for r in rows:
        file_name = Path(r.get("file", "")).name
        vals = [str(r.get(c, "")) for c in metric_cols]
        lines.append("| " + " | ".join([file_name, *vals]) + " |")
    md_out.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(json.dumps({"csv": str(csv_out), "markdown": str(md_out), "rows": len(rows)}, indent=2))


if __name__ == "__main__":
    main()

