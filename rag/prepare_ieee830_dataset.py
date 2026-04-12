#!/usr/bin/env python3
"""
Prepare IEEE-830-focused knowledge base and quality evaluation from mixed reports.

Input:
  - A folder containing PDF/DOCX reports (for example: "DATASET SRS")

Output:
  - data/knowledge_base/ieee830_extracted/*.txt
  - data/knowledge_base/ieee830_index.jsonl
  - data/output/ieee830_dataset_evaluation.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from evaluation.evaluation_engine import SRSEvaluationEngine
from evaluation.manual_metrics_engine import ManualMetricsEngine


def _read_pdf(path: Path) -> str:
    # Try pypdf first, then PyPDF2 fallback.
    try:
        from pypdf import PdfReader  # type: ignore

        reader = PdfReader(str(path))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception:
        try:
            import PyPDF2  # type: ignore

            with path.open("rb") as handle:
                reader = PyPDF2.PdfReader(handle)
                return "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception:
            return ""


def _read_docx(path: Path) -> str:
    try:
        import docx  # type: ignore

        doc = docx.Document(str(path))
        return "\n".join(p.text for p in doc.paragraphs if p.text and p.text.strip())
    except Exception:
        return ""


def _clean_text(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_ieee_blocks(text: str) -> Dict[str, str]:
    """
    Extract only major IEEE 830 sections from long reports.
    """
    lowered = text.lower()
    markers: List[Tuple[str, str, List[str]]] = [
        ("introduction", "1. introduction", ["2. overall description", "overall description"]),
        ("overall_description", "2. overall description", ["3. specific requirements", "specific requirements"]),
        ("specific_requirements", "3. specific requirements", ["4.", "appendix", "references", "bibliography"]),
    ]

    sections: Dict[str, str] = {"introduction": "", "overall_description": "", "specific_requirements": ""}
    for key, start_marker, end_markers in markers:
        start_idx = lowered.find(start_marker)
        if start_idx < 0:
            # fallback: looser lookup without numbering
            simple_start = start_marker.split(". ", 1)[-1]
            start_idx = lowered.find(simple_start)
        if start_idx < 0:
            continue

        end_idx = len(text)
        for end_marker in end_markers:
            idx = lowered.find(end_marker, start_idx + 20)
            if idx >= 0:
                end_idx = min(end_idx, idx)
        section_text = text[start_idx:end_idx].strip()
        sections[key] = section_text
    return sections


def _parse_sections_to_structure(sections: Dict[str, str]) -> Dict:
    """
    Convert extracted blocks into the section structure expected by evaluators.
    """
    intro = sections.get("introduction", "")
    overall = sections.get("overall_description", "")
    specific = sections.get("specific_requirements", "")

    return {
        "introduction": {
            "purpose": _extract_line_after(intro, ["purpose"]),
            "scope": _extract_line_after(intro, ["scope"]),
            "definitions": _extract_bullets_after(intro, ["definition", "definitions", "acronym"]),
            "overview": _extract_line_after(intro, ["overview"]),
        },
        "overall_description": {
            "product_perspective": _extract_line_after(overall, ["product perspective"]),
            "product_functions": _extract_bullets_after(overall, ["product functions", "functions"]),
            "user_characteristics": _extract_bullets_after(overall, ["user characteristics", "user classes"]),
            "constraints": _extract_bullets_after(overall, ["constraints", "limitations"]),
            "assumptions": _extract_bullets_after(overall, ["assumptions", "dependencies"]),
            "dependencies": _extract_bullets_after(overall, ["dependencies"]),
        },
        "specific_requirements": {
            "functional_requirements": _extract_functional_requirements(specific),
            "software_system_attributes": {
                "reliability": _extract_line_after(specific, ["reliability"]),
                "availability": _extract_line_after(specific, ["availability"]),
                "security": _extract_line_after(specific, ["security"]),
                "maintainability": _extract_line_after(specific, ["maintainability"]),
                "portability": _extract_line_after(specific, ["portability"]),
                "usability": _extract_line_after(specific, ["usability"]),
            },
            "external_interface_requirements": {
                "user_interfaces": _extract_bullets_after(specific, ["user interfaces"]),
                "hardware_interfaces": _extract_bullets_after(specific, ["hardware interfaces"]),
                "software_interfaces": _extract_bullets_after(specific, ["software interfaces"]),
                "communication_interfaces": _extract_bullets_after(specific, ["communication interfaces"]),
            },
        },
    }


def _extract_line_after(text: str, labels: List[str]) -> str:
    lowered = text.lower()
    for label in labels:
        idx = lowered.find(label)
        if idx >= 0:
            snippet = text[idx : idx + 500]
            lines = [ln.strip(" -:\t") for ln in snippet.splitlines() if ln.strip()]
            if len(lines) > 1:
                return lines[1][:300]
    return ""


def _extract_bullets_after(text: str, labels: List[str]) -> List[str]:
    lowered = text.lower()
    for label in labels:
        idx = lowered.find(label)
        if idx < 0:
            continue
        snippet = text[idx : idx + 1200]
        lines = [ln.strip() for ln in snippet.splitlines() if ln.strip()]
        items: List[str] = []
        for ln in lines[1:]:
            if re.match(r"^\d+(\.\d+)*\s", ln):
                break
            if ln.startswith(("-", "*", "•")) or re.match(r"^\d+\)", ln):
                items.append(re.sub(r"^[-*•]\s*|^\d+\)\s*", "", ln).strip())
        if items:
            return items[:20]
    return []


def _extract_functional_requirements(specific_text: str) -> List[Dict[str, str]]:
    lines = [ln.strip() for ln in specific_text.splitlines() if ln.strip()]
    out: List[Dict[str, str]] = []
    fr_counter = 1
    in_fr_block = False
    for ln in lines:
        lower = ln.lower()
        if re.search(r"\bfunctional requirements?\b", lower):
            in_fr_block = True
            continue
        if re.search(r"\bnon[- ]?functional requirements?\b", lower):
            in_fr_block = False
            continue

        if "functional requirement" in lower or re.search(r"\bfr[- ]?\d+\b", lower):
            out.append({"id": f"FR-{fr_counter}", "description": ln})
            fr_counter += 1
        elif ln.startswith(("-", "*", "•")) and any(v in lower for v in ["shall", "must", "allow", "enable"]):
            out.append({"id": f"FR-{fr_counter}", "description": re.sub(r"^[-*•]\s*", "", ln)})
            fr_counter += 1
        elif in_fr_block and re.match(r"^\d+(\.\d+)*\s*[:\-)]?\s*", ln) and any(
            v in lower for v in ["shall", "must", "allow", "enable", "provide", "support"]
        ):
            out.append({"id": f"FR-{fr_counter}", "description": re.sub(r"^\d+(\.\d+)*\s*[:\-)]?\s*", "", ln)})
            fr_counter += 1
    return out


def _extract_nonfunctional_requirements(specific_text: str) -> List[str]:
    lines = [ln.strip() for ln in specific_text.splitlines() if ln.strip()]
    out: List[str] = []
    nfr_keywords = [
        "performance",
        "security",
        "reliability",
        "availability",
        "usability",
        "maintainability",
        "portability",
        "scalability",
        "response time",
        "latency",
        "throughput",
    ]
    in_nfr_block = False
    for ln in lines:
        lower = ln.lower()
        if re.search(r"\bnon[- ]?functional requirements?\b", lower):
            in_nfr_block = True
            continue
        if re.search(r"\bfunctional requirements?\b", lower) and "non" not in lower:
            if in_nfr_block:
                in_nfr_block = False
            continue
        if any(k in lower for k in nfr_keywords):
            out.append(ln)
            continue
        if in_nfr_block and (ln.startswith(("-", "*", "•")) or re.match(r"^\d+(\.\d+)*", ln)):
            out.append(ln)
    return out[:50]


def _to_markdown(path: Path, sections: Dict[str, str]) -> str:
    return (
        f"# {path.stem}\n\n"
        "## 1. Introduction\n\n"
        f"{sections.get('introduction', '')}\n\n"
        "## 2. Overall Description\n\n"
        f"{sections.get('overall_description', '')}\n\n"
        "## 3. Specific Requirements\n\n"
        f"{sections.get('specific_requirements', '')}\n"
    ).strip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Build IEEE 830 KB + evaluation from report dataset.")
    parser.add_argument("--dataset_dir", default="DATASET SRS")
    parser.add_argument("--kb_out_dir", default="data/knowledge_base/ieee830_extracted")
    parser.add_argument("--index_file", default="data/knowledge_base/ieee830_index.jsonl")
    parser.add_argument("--eval_out", default="data/output/ieee830_dataset_evaluation.json")
    args = parser.parse_args()

    dataset_dir = Path(args.dataset_dir)
    kb_out_dir = Path(args.kb_out_dir)
    index_file = Path(args.index_file)
    eval_out = Path(args.eval_out)

    kb_out_dir.mkdir(parents=True, exist_ok=True)
    index_file.parent.mkdir(parents=True, exist_ok=True)
    eval_out.parent.mkdir(parents=True, exist_ok=True)

    ieee_eval = SRSEvaluationEngine()
    manual_eval = ManualMetricsEngine()

    supported = {".pdf", ".docx"}
    files = [p for p in dataset_dir.iterdir() if p.is_file() and p.suffix.lower() in supported]

    index_rows: List[Dict] = []
    evaluations: List[Dict] = []

    for file_path in files:
        if file_path.suffix.lower() == ".pdf":
            text = _read_pdf(file_path)
        else:
            text = _read_docx(file_path)
        text = _clean_text(text)
        if not text:
            continue

        ieee_sections_raw = _extract_ieee_blocks(text)
        markdown_text = _to_markdown(file_path, ieee_sections_raw)
        out_txt = kb_out_dir / f"{file_path.stem}.txt"
        out_txt.write_text(markdown_text, encoding="utf-8")

        structured_sections = _parse_sections_to_structure(ieee_sections_raw)
        source_text = "\n".join(v for v in ieee_sections_raw.values() if v).strip() or text[:4000]
        extracted_nfr = _extract_nonfunctional_requirements(ieee_sections_raw.get("specific_requirements", ""))

        ieee_scores = ieee_eval.evaluate(
            user_requirements=source_text,
            srs_sections=structured_sections,
            srs_text=markdown_text,
        )
        structured_req = {
            "functional_requirements": structured_sections["specific_requirements"]["functional_requirements"],
            "non_functional_requirements": [
                {"refined_text": str(v)}
                for v in structured_sections["specific_requirements"]["software_system_attributes"].values()
                if str(v).strip()
            ] + [{"refined_text": nfr} for nfr in extracted_nfr],
            "user_requirements": [],
            "system_requirements": [],
        }
        manual_scores = manual_eval.evaluate(
            source_requirements_text=source_text,
            structured_requirements=structured_req,
            srs_sections=structured_sections,
            srs_text=markdown_text,
        )

        index_rows.append(
            {
                "id": file_path.stem,
                "text": markdown_text,
                "source_file": str(file_path),
                "source_type": "ieee_830_template",
            }
        )
        evaluations.append(
            {
                "file": str(file_path),
                "kb_text_file": str(out_txt),
                "ieee_scores": ieee_scores,
                "manual_scores": manual_scores,
                "detected_fr_count": len(structured_req["functional_requirements"]),
                "detected_nfr_count": len(structured_req["non_functional_requirements"]),
            }
        )

    with index_file.open("w", encoding="utf-8") as handle:
        for row in index_rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")

    summary = {
        "dataset_dir": str(dataset_dir),
        "processed_files": len(evaluations),
        "kb_output_dir": str(kb_out_dir),
        "index_file": str(index_file),
        "evaluations": evaluations,
    }
    eval_out.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"processed_files": len(evaluations), "index_file": str(index_file), "eval_out": str(eval_out)}, indent=2))


if __name__ == "__main__":
    main()

