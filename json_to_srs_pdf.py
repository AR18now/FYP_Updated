#!/usr/bin/env python3
"""
Convert SRS JSON to a PDF (or HTML fallback).

Accepts either of these shapes:
- { "sections": { "introduction": {...}, "overall_description": {...} }, ... }
- { "srs_sections": { "introduction": {...}, "overall_description": {...} }, ... }

Usage:
  python json_to_srs_pdf.py --input path/to/input.json --output out.pdf

Requires: weasyprint (for PDF). If unavailable, saves an HTML fallback.
"""

import argparse
import json
import logging
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict


@dataclass
class SRSDocument:
    document_id: str
    title: str
    version: str
    date: str
    author: str
    sections: Dict[str, Any]


def load_srs_from_json(input_path: str) -> SRSDocument:
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Accept both keys: 'sections' or 'srs_sections'
    sections = data.get("sections") or data.get("srs_sections") or {}
    intro = sections.get("introduction") or {}
    overall = sections.get("overall_description") or {}

    # Normalize minimal structure
    sections = {
        "introduction": {
            "purpose": intro.get("purpose", ""),
            "scope": intro.get("scope", ""),
            "definitions": intro.get("definitions", []),
            "references": intro.get("references", []),
            "overview": intro.get("overview", ""),
        },
        "overall_description": {
            "product_perspective": overall.get("product_perspective", ""),
            "product_functions": overall.get("product_functions", []),
            "user_characteristics": overall.get("user_characteristics", []),
            "constraints": overall.get("constraints", []),
            "assumptions": overall.get("assumptions", [] if isinstance(overall.get("assumptions"), list) else [overall.get("assumptions", "")] if overall.get("assumptions") else []),
            "dependencies": overall.get("dependencies", []),
        },
    }

    project = data.get("project_info", {})
    return SRSDocument(
        document_id=f"SRS-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
        title=project.get("title", "Software Requirements Specification"),
        version=project.get("version", "1.0"),
        date=datetime.now().strftime("%Y-%m-%d"),
        author=project.get("author", "Model-based Generator"),
        sections=sections,
    )


def render_html(srs: SRSDocument) -> str:
    intro = srs.sections.get("introduction", {})
    overall = srs.sections.get("overall_description", {})
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <title>{srs.title}</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 40px; line-height: 1.5; }}
    h1 {{ color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px; }}
    h2 {{ color: #34495e; margin-top: 30px; }}
    h3 {{ color: #7f8c8d; margin-top: 16px; }}
    .meta {{ background: #ecf0f1; padding: 12px; border-radius: 6px; }}
    ul {{ margin: 8px 0 16px 18px; }}
    li {{ margin: 4px 0; }}
  </style>
  </head>
<body>
  <h1>{srs.title}</h1>
  <div class=\"meta\">
    <div><strong>Document ID:</strong> {srs.document_id}</div>
    <div><strong>Version:</strong> {srs.version}</div>
    <div><strong>Date:</strong> {srs.date}</div>
    <div><strong>Author:</strong> {srs.author}</div>
  </div>

  <h2>1. Introduction</h2>
  <h3>1.1 Purpose</h3>
  <p>{intro.get('purpose','')}</p>
  <h3>1.2 Scope</h3>
  <p>{intro.get('scope','')}</p>
  <h3>1.3 Definitions</h3>
  <ul>{''.join(f'<li>{d}</li>' for d in intro.get('definitions', []))}</ul>
  <h3>1.4 References</h3>
  <ul>{''.join(f'<li>{r}</li>' for r in intro.get('references', []))}</ul>
  <h3>1.5 Overview</h3>
  <p>{intro.get('overview','')}</p>

  <h2>2. Overall Description</h2>
  <h3>2.1 Product Perspective</h3>
  <p>{overall.get('product_perspective','')}</p>
  <h3>2.2 Product Functions</h3>
  <ul>{''.join(f'<li>{f}</li>' for f in overall.get('product_functions', []))}</ul>
  <h3>2.3 User Characteristics</h3>
  <ul>{''.join(f'<li>{u}</li>' for u in overall.get('user_characteristics', []))}</ul>
  <h3>2.4 Constraints</h3>
  <ul>{''.join(f'<li>{c}</li>' for c in overall.get('constraints', []))}</ul>
  <h3>2.5 Assumptions</h3>
  <ul>{''.join(f'<li>{a}</li>' for a in overall.get('assumptions', []))}</ul>
  <h3>2.6 Dependencies</h3>
  <ul>{''.join(f'<li>{d}</li>' for d in overall.get('dependencies', []))}</ul>
</body>
</html>
"""


def save_pdf_or_html(html: str, output_path: str) -> str:
    """
    Convert HTML content to PDF using weasyprint, or save as HTML if PDF generation fails.
    
    Args:
        html: HTML content string to convert
        output_path: Desired output file path (should end with .pdf)
    
    Returns:
        Path to the generated file (PDF if successful, HTML if PDF generation failed)
    """
    output = Path(output_path)
    try:
        from weasyprint import HTML
        # Generate PDF with proper encoding
        HTML(string=html, encoding='utf-8').write_pdf(str(output))
        logging.info(f"PDF generated successfully: {output}")
        return str(output)
    except ImportError:
        logging.warning("weasyprint not installed. Saving HTML fallback.")
        html_path = output.with_suffix('.html')
        html_path.write_text(html, encoding='utf-8')
        return str(html_path)
    except Exception as e:
        logging.warning(f"PDF export failed ({e}). Saving HTML fallback.")
        html_path = output.with_suffix('.html')
        html_path.write_text(html, encoding='utf-8')
        return str(html_path)


def main():
    parser = argparse.ArgumentParser(description="Convert SRS JSON to PDF")
    parser.add_argument('--input', required=True, help='Path to input JSON')
    parser.add_argument('--output', default='srs_output.pdf', help='Output PDF path (or HTML fallback)')
    args = parser.parse_args()

    srs = load_srs_from_json(args.input)
    html = render_html(srs)
    out = save_pdf_or_html(html, args.output)
    print(f"SRS exported to: {out}")


if __name__ == '__main__':
    main()


