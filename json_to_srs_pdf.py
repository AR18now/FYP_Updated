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
import base64
import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Dict
from xml.sax.saxutils import escape


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

    specific = sections.get("specific_requirements") or {}
    ext = specific.get("external_interface_requirements") or {}
    attrs = specific.get("software_system_attributes") or {}

    # Normalize full IEEE 830-oriented structure (preserve all available fields)
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
        "specific_requirements": {
            "external_interface_requirements": {
                "user_interfaces": ext.get("user_interfaces", []),
                "hardware_interfaces": ext.get("hardware_interfaces", []),
                "software_interfaces": ext.get("software_interfaces", []),
                "communication_interfaces": ext.get("communication_interfaces", []),
            },
            "functional_requirements": specific.get("functional_requirements", []),
            "performance_requirements": specific.get("performance_requirements", ""),
            "design_constraints": specific.get("design_constraints", ""),
            "software_system_attributes": {
                "reliability": attrs.get("reliability", ""),
                "availability": attrs.get("availability", ""),
                "security": attrs.get("security", ""),
                "maintainability": attrs.get("maintainability", ""),
                "portability": attrs.get("portability", ""),
                "usability": attrs.get("usability", ""),
            },
            "other_requirements": specific.get("other_requirements", {}),
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
    specific = srs.sections.get("specific_requirements", {})
    ext = specific.get("external_interface_requirements", {}) if isinstance(specific, dict) else {}
    attrs = specific.get("software_system_attributes", {}) if isinstance(specific, dict) else {}

    def _to_list(value):
        if value is None:
            return []
        if isinstance(value, list):
            return [str(v) for v in value if str(v).strip()]
        if isinstance(value, dict):
            out = []
            for k, v in value.items():
                if isinstance(v, list):
                    out.extend([f"{k}: {x}" for x in v if str(x).strip()])
                elif str(v).strip():
                    out.append(f"{k}: {v}")
            return out
        return [str(value)] if str(value).strip() else []

    fr_items = specific.get("functional_requirements", []) if isinstance(specific, dict) else []
    fr_rows = []
    for i, fr in enumerate(fr_items, start=1):
        if isinstance(fr, dict):
            fr_id = fr.get("id", f"FR-{i}")
            desc = fr.get("description", "")
            inp = fr.get("input", "")
            proc = fr.get("processing", "")
            outp = fr.get("output", "")
            pri = fr.get("priority", "")
        else:
            fr_id = f"FR-{i}"
            desc = str(fr)
            inp = proc = outp = pri = ""
        m = re.match(r"^\s*FR[- ]?(\d+)\s*$", str(fr_id), flags=re.IGNORECASE)
        if m:
            fr_id = f"FR-{int(m.group(1)):02d}"
        fr_rows.append(
            f"<tr><td>{escape(str(fr_id))}</td><td>{escape(str(desc))}</td><td>{escape(str(inp))}</td><td>{escape(str(proc))}</td><td>{escape(str(outp))}</td><td>{escape(str(pri))}</td></tr>"
        )
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <title>{srs.title}</title>
  <style>
    @page {{
      size: A4;
      margin: 24mm 18mm 20mm 18mm;
      @bottom-right {{
        content: "Page " counter(page) " of " counter(pages);
        font-size: 9pt;
        color: #475569;
      }}
    }}
    body {{ font-family: 'Times New Roman', Times, serif; margin: 0; line-height: 1.7; color: #0f172a; font-size: 12pt; }}
    h1 {{ margin: 0 0 10px; font-size: 24pt; font-weight: 800; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; }}
    h2 {{ font-size: 20pt; margin: 18px 0 8px; font-weight: 800; border-bottom: 1px solid #dbe3ee; padding-bottom: 4px; }}
    h3 {{ font-size: 16pt; margin: 14px 0 6px; font-weight: 800; }}
    h4 {{ font-size: 14pt; margin: 12px 0 5px; font-weight: 700; }}
    p {{ margin: 4px 0 10px; }}
    .cover {{ border: 1px solid #94a3b8; border-radius: 8px; padding: 14px 16px; margin: 0 0 14px; page-break-after: avoid; }}
    .cover-kicker {{ margin: 0 0 6px; font-size: 10pt; letter-spacing: 1pt; text-transform: uppercase; color: #475569; }}
    .cover-title {{ margin: 0 0 10px; font-size: 22pt; line-height: 1.25; font-weight: 700; color: #0f172a; border: 0; padding: 0; }}
    .rev-title {{ margin: 8px 0 5px; font-size: 11pt; font-weight: 700; color: #0f172a; }}
    .rev-table {{ width: 100%; border-collapse: collapse; font-size: 10.5pt; }}
    .rev-table th, .rev-table td {{ border: 1px solid #cbd5e1; padding: 6px 7px; text-align: left; vertical-align: top; }}
    .rev-table th {{ background: #f8fafc; font-weight: 700; }}
    .meta {{ background: #f8fafc; padding: 10px 12px; border: 1px solid #dbe3ee; border-radius: 6px; margin-bottom: 14px; }}
    .meta div {{ margin: 3px 0; }}
    ul {{ margin: 4px 0 10px 20px; padding-left: 4px; }}
    li {{ margin: 4px 0; }}
    .fr-table {{ width: 100%; border-collapse: collapse; font-size: 10.2pt; margin: 4px 0 12px; }}
    .fr-table th, .fr-table td {{ border: 1px solid #cbd5e1; padding: 6px 7px; text-align: left; vertical-align: top; }}
    .fr-table th {{ background: #f8fafc; font-weight: 700; }}
  </style>
  </head>
<body>
  <section class="cover">
    <p class="cover-kicker">Software Requirements Specification</p>
    <h1 class="cover-title">{srs.title}</h1>
    <p class="rev-title">Document Control</p>
    <table class="rev-table" role="presentation">
      <thead>
        <tr>
          <th style="width: 18%;">Version</th>
          <th style="width: 20%;">Date</th>
          <th style="width: 24%;">Author</th>
          <th>Change Summary</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{srs.version}</td>
          <td>{srs.date}</td>
          <td>{srs.author}</td>
          <td>Initial generated draft for structured review.</td>
        </tr>
      </tbody>
    </table>
  </section>

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

  <h2>3. Specific Requirements</h2>
  <h3>3.1 External Interface Requirements</h3>
  <h4>3.1.1 User Interfaces</h4>
  <ul>{''.join(f'<li>{escape(i)}</li>' for i in _to_list(ext.get('user_interfaces')))}</ul>
  <h4>3.1.2 Hardware Interfaces</h4>
  <ul>{''.join(f'<li>{escape(i)}</li>' for i in _to_list(ext.get('hardware_interfaces')))}</ul>
  <h4>3.1.3 Software Interfaces</h4>
  <ul>{''.join(f'<li>{escape(i)}</li>' for i in _to_list(ext.get('software_interfaces')))}</ul>
  <h4>3.1.4 Communication Interfaces</h4>
  <ul>{''.join(f'<li>{escape(i)}</li>' for i in _to_list(ext.get('communication_interfaces')))}</ul>

  <h3>3.2 Functional Requirements</h3>
  <table class="fr-table">
    <thead>
      <tr>
        <th style="width: 8%;">ID</th>
        <th style="width: 22%;">Description</th>
        <th style="width: 16%;">Input</th>
        <th style="width: 24%;">Processing</th>
        <th style="width: 20%;">Output</th>
        <th style="width: 10%;">Priority</th>
      </tr>
    </thead>
    <tbody>
      {''.join(fr_rows)}
    </tbody>
  </table>

  <h3>3.3 Non-Functional Requirements</h3>
  <ul>
    {''.join(
      f'<li><strong>{escape(label)}:</strong> {escape(str(value))}</li>'
      for label, value in [
        ('Usability', attrs.get('usability', '')),
        ('Reliability', attrs.get('reliability', '')),
        ('Performance', specific.get('performance_requirements', '')),
        ('Portability', attrs.get('portability', '')),
      ]
      if str(value).strip()
    )}
  </ul>

  <h3>3.4 General Constraints</h3>
  <ul>{''.join(f'<li>{escape(item)}</li>' for item in _to_list(overall.get('constraints')))}</ul>
</body>
</html>
"""


def _file_starts_with_pdf_magic(path: Path) -> bool:
    try:
        with open(path, "rb") as f:
            return f.read(5) == b"%PDF-"
    except OSError:
        return False


def _html_to_plain_text(html: str) -> str:
    """Strip tags for ReportLab fallback; keep line breaks readable."""
    text = re.sub(r"(?is)<script.*?>.*?</script>", "", html)
    text = re.sub(r"(?is)<style.*?>.*?</style>", "", text)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</p\s*>", "\n\n", text, flags=re.I)
    text = re.sub(r"</div\s*>", "\n", text, flags=re.I)
    text = re.sub(r"</h[1-6]\s*>", "\n\n", text, flags=re.I)
    text = re.sub(r"(?s)<[^>]+>", "", text)
    from html import unescape

    return unescape(text)


def _save_pdf_reportlab(html: str, output: Path) -> None:
    """Last-resort PDF using ReportLab (already pulled in by xhtml2pdf)."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer

    output.parent.mkdir(parents=True, exist_ok=True)
    plain = _html_to_plain_text(html)

    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "body",
        parent=styles["Normal"],
        fontSize=10,
        leading=13,
        spaceAfter=4,
    )

    story = []
    # Embedded PNG (e.g. use case diagram)
    m = re.search(
        r'src=["\']data:image/png;base64,([^"\']+)["\']',
        html,
        flags=re.I,
    )
    if m:
        try:
            raw = base64.standard_b64decode(m.group(1))
            from reportlab.lib.utils import ImageReader

            bio = BytesIO(raw)
            iw, ih = ImageReader(bio).getSize()
            max_w = A4[0] - inch * 1.5
            scale = min(1.0, max_w / float(iw))
            dw, dh = iw * scale, ih * scale
            story.append(Image(BytesIO(raw), width=dw, height=dh))
            story.append(Spacer(1, 12))
        except Exception as e:
            logging.warning("ReportLab: could not embed diagram image (%s)", e)

    # Body text
    chunks = [c.strip() for c in re.split(r"\n{2,}", plain) if c.strip()]
    if not chunks and plain.strip():
        chunks = [plain.strip()]
    for block in chunks:
        frag = escape(block).replace("\n", "<br/>")
        story.append(Paragraph(frag, body))
        story.append(Spacer(1, 6))

    doc = SimpleDocTemplate(
        str(output),
        pagesize=A4,
        rightMargin=inch * 0.75,
        leftMargin=inch * 0.75,
        topMargin=inch * 0.75,
        bottomMargin=inch * 0.75,
    )
    doc.build(story)


def _prepare_html_for_xhtml2pdf(html: str) -> str:
    """
    Downgrade modern CSS to xhtml2pdf-compatible HTML/CSS.
    xhtml2pdf does not support several CSS3 constructs used by WeasyPrint.
    """
    safe = html
    # For xhtml2pdf reliability on Windows, replace ALL custom CSS with a minimal safe stylesheet.
    safe_css = """
<style>
  @page { size: A4; margin: 20mm 16mm 18mm 16mm; }
  body { font-family: Times New Roman, serif; font-size: 12pt; line-height: 1.55; color: #111; }
  .cover { border: 2px solid #7b8cab; padding: 22pt 18pt; min-height: 220mm; }
  .cover-kicker { font-size: 10pt; letter-spacing: 1pt; text-transform: uppercase; text-align: center; color: #3a4a66; margin: 0 0 8pt 0; }
  .cover-title { font-size: 30pt; font-weight: bold; text-align: center; margin: 0 0 14pt 0; }
  .cover-subtitle { font-size: 12pt; font-weight: bold; text-align: center; color: #334155; margin: 0 0 14pt 0; }
  .rev-title { font-size: 12pt; font-weight: bold; text-align: center; margin: 8pt 0 6pt 0; }
  .rev-table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  .rev-table th, .rev-table td { border: 1px solid #7e8796; padding: 6px; vertical-align: top; }
  .rev-table th { background: #edf2fa; font-weight: bold; }
  .doc-header, .doc-header-top, .doc-strip { display: none; }
  h1 { font-size: 22pt; font-weight: bold; margin: 0 0 10pt 0; }
  h2 { font-size: 18pt; font-weight: bold; margin: 14pt 0 8pt 0; }
  h3 { font-size: 15pt; font-weight: bold; margin: 12pt 0 6pt 0; }
  h4 { font-size: 13pt; font-weight: bold; margin: 10pt 0 5pt 0; }
  p { margin: 4pt 0 8pt 0; }
  ul { margin: 4pt 0 8pt 16pt; }
  li { margin: 2pt 0; }
  .srs-h.section-break { page-break-before: always; }
  .toc-box { border: 1px solid #8f98a8; padding: 12px; margin: 0 0 12pt 0; page-break-after: always; min-height: 220mm; }
  .toc-title { font-size: 14pt; font-weight: bold; margin: 0 0 6pt 0; }
  .toc-list { margin: 0; padding-left: 16pt; }
  .toc-list li.d2 { margin-left: 8pt; }
  .toc-list li.d3, .toc-list li.d4, .toc-list li.d5 { margin-left: 16pt; }
  .k, .srs-k, .id, .srs-id, .srs-p.kv .k, .srs-p.fr .id { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt 0; }
  th, td { border: 1px solid #888; padding: 5px; vertical-align: top; text-align: left; }
  th { font-weight: bold; background: #f1f1f1; }
  .page-number { position: fixed; right: 0; bottom: 0; font-size: 9pt; color: #556070; }
  .doc-footer { margin-top: 14pt; border-top: 1px solid #cbd5e1; padding-top: 8pt; color: #64748b; font-size: 10pt; }
</style>
"""
    safe = re.sub(r"(?is)<style.*?>.*?</style>", safe_css, safe)
    # If input HTML has no <style>, inject one.
    if "<style>" not in safe.lower():
        safe = safe.replace("</head>", f"{safe_css}</head>")
    return safe


def save_pdf_or_html(html: str, output_path: str) -> str:
    """
    Convert HTML to PDF using styled renderers only:
    weasyprint (best) then xhtml2pdf. No plain-text fallback.
    """
    output = Path(output_path)

    try:
        from weasyprint import HTML

        HTML(string=html, encoding="utf-8").write_pdf(str(output))
        logging.info(f"PDF generated successfully (weasyprint): {output}")
        return str(output)
    except ImportError:
        logging.warning("weasyprint not installed; trying xhtml2pdf.")
    except Exception as e:
        logging.warning(f"weasyprint failed ({e}); trying xhtml2pdf.")

    try:
        from xhtml2pdf import pisa

        output.parent.mkdir(parents=True, exist_ok=True)
        xhtml2pdf_html = _prepare_html_for_xhtml2pdf(html)
        with open(output, "wb") as f:
            status = pisa.CreatePDF(xhtml2pdf_html, dest=f, encoding="utf-8")
        err_n = int(getattr(status, "err", 0) or 0)
        if err_n:
            logging.warning(
                "xhtml2pdf reported %d error(s); checking output file validity.",
                err_n,
            )
        if _file_starts_with_pdf_magic(output):
            logging.info(f"PDF generated successfully (xhtml2pdf): {output}")
            return str(output)
        raise RuntimeError("xhtml2pdf did not produce a valid PDF file")
    except ImportError:
        logging.warning("xhtml2pdf not installed; no more PDF backends.")
    except Exception as e:
        # Retry once with ultra-minimal HTML/CSS in case parser hits unsupported constructs.
        logging.warning("xhtml2pdf failed (%s); retrying with ultra-minimal CSS.", e)
        try:
            from xhtml2pdf import pisa

            minimal = re.sub(r"(?is)<style.*?>.*?</style>", "", html)
            minimal = minimal.replace(
                "</head>",
                "<style>@page{size:A4;margin:20mm 16mm 18mm 16mm;} body{font-family:Times New Roman, serif; font-size:12pt; line-height:1.5;} .cover{border:2px solid #7b8cab;padding:22pt 18pt;min-height:220mm;} .cover-kicker{font-size:10pt;letter-spacing:1pt;text-transform:uppercase;text-align:center;} .cover-title{font-size:28pt;font-weight:bold;text-align:center;} .cover-subtitle{font-size:12pt;font-weight:bold;text-align:center;} .rev-title{font-size:12pt;font-weight:bold;text-align:center;} .rev-table{width:100%;border-collapse:collapse;font-size:10.5pt;} .rev-table th,.rev-table td{border:1px solid #7e8796;padding:6px;vertical-align:top;} .rev-table th{background:#edf2fa;font-weight:bold;} .doc-header,.doc-header-top,.doc-strip{display:none;} h1{font-size:20pt;font-weight:bold;} h2{font-size:16pt;font-weight:bold;} h3{font-size:14pt;font-weight:bold;} h4{font-size:12pt;font-weight:bold;} p,li{font-size:12pt;} .srs-h.section-break{page-break-before:always;} .toc-box{border:1px solid #8f98a8;padding:12px;margin:0 0 12pt 0;page-break-after:always;min-height:220mm;} .toc-title{font-size:14pt;font-weight:bold;margin:0 0 6pt 0;} .toc-list{margin:0;padding-left:16pt;} .toc-list li.d2{margin-left:8pt;} .toc-list li.d3,.toc-list li.d4,.toc-list li.d5{margin-left:16pt;} .k,.srs-k,.id,.srs-id,.srs-p.kv .k,.srs-p.fr .id{font-weight:bold;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #999;padding:5px;vertical-align:top;} .page-number{position:fixed;right:0;bottom:0;font-size:9pt;color:#556070;} .doc-footer{margin-top:14pt;border-top:1px solid #cbd5e1;padding-top:8pt;color:#64748b;font-size:10pt;}</style></head>",
            )
            with open(output, "wb") as f:
                status = pisa.CreatePDF(minimal, dest=f, encoding="utf-8")
            err_n = int(getattr(status, "err", 0) or 0)
            if err_n:
                logging.warning("xhtml2pdf minimal retry reported %d error(s).", err_n)
            if _file_starts_with_pdf_magic(output):
                logging.info(f"PDF generated successfully (xhtml2pdf minimal retry): {output}")
                return str(output)
            raise RuntimeError("xhtml2pdf minimal retry did not produce a valid PDF file")
        except Exception as inner:
            logging.warning("xhtml2pdf minimal retry failed (%s); no more PDF backends.", inner)
    except Exception as e:
        logging.warning(f"xhtml2pdf failed ({e}); no more PDF backends.")

    raise RuntimeError(
        "PDF generation failed: no working styled PDF backend (weasyprint/xhtml2pdf). "
        "Install one of these backends to export SRS as PDF."
    )


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


