#!/usr/bin/env python3
import argparse
import html
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Export KB metrics JSON to an HTML table report.")
    parser.add_argument("--input_json", default="data/output/kb_quality_report_all232.json")
    parser.add_argument("--output_html", default="data/output/kb_metrics_report_all232.html")
    args = parser.parse_args()

    src = Path(args.input_json)
    out = Path(args.output_html)
    payload = json.loads(src.read_text(encoding="utf-8"))
    rows = payload.get("rows", [])

    metric_columns = [
        "arm_overall_score",
        "arm_imperative_quality",
        "arm_weak_phrase_quality",
        "arm_optionality_quality",
        "arm_continuance_quality",
        "arm_directive_quality",
        "arm_incomplete_quality",
        "arm_ambiguity_quality",
        "arm_imperative_count",
        "arm_weak_phrase_count",
        "arm_option_count",
        "arm_continuance_count",
        "arm_directive_count",
        "arm_incomplete_count",
        "arm_ambiguity_count",
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
        "ieee_section_coverage",
        "fr_coverage",
        "nfr_coverage",
        "clarity_readability",
        "ambiguity_quality",
        "extraction_cleanliness",
        "content_adequacy",
        "duplication_quality",
        "heading_structure",
        "numeric_specificity",
        "lexical_richness",
        "requirements_detected",
    ]

    header_cells = ["file_name", "passed", *metric_columns]
    header_html = "".join(f"<th>{html.escape(col)}</th>" for col in header_cells)

    body_rows = []
    for row in rows:
        file_name = Path(row.get("file", "")).name
        cells = [file_name, str(row.get("passed", ""))]
        cells.extend(str(row.get(col, "")) for col in metric_columns)
        td = "".join(f"<td>{html.escape(cell)}</td>" for cell in cells)
        body_rows.append(f"<tr>{td}</tr>")

    table_body = "\n".join(body_rows)
    report_title = "SRS Knowledge Base Metrics Report"

    doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{report_title}</title>
  <style>
    body {{
      font-family: Arial, sans-serif;
      margin: 24px;
      background: #f8fafc;
      color: #0f172a;
    }}
    h1 {{
      margin-bottom: 8px;
    }}
    .meta {{
      margin-bottom: 16px;
      color: #334155;
    }}
    .table-wrap {{
      overflow: auto;
      border: 1px solid #cbd5e1;
      background: white;
    }}
    table {{
      border-collapse: collapse;
      min-width: 3200px;
      width: 100%;
      font-size: 13px;
    }}
    th, td {{
      border: 1px solid #e2e8f0;
      padding: 6px 8px;
      text-align: left;
      white-space: nowrap;
    }}
    th {{
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #f8fafc;
      z-index: 2;
    }}
    tr:nth-child(even) td {{
      background: #f8fafc;
    }}
  </style>
</head>
<body>
  <h1>{report_title}</h1>
  <div class="meta">
    <div><strong>Source:</strong> {html.escape(str(src))}</div>
    <div><strong>Total Documents:</strong> {len(rows)}</div>
    <div><strong>Average Score:</strong> {payload.get("average_score", "")}</div>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>{header_html}</tr>
      </thead>
      <tbody>
        {table_body}
      </tbody>
    </table>
  </div>
</body>
</html>
"""

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc, encoding="utf-8")
    print(json.dumps({"output_html": str(out), "rows": len(rows)}, indent=2))


if __name__ == "__main__":
    main()

