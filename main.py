#!/usr/bin/env python3
"""
Full SRS pipeline controller.

Flow: input → clean → ambiguity → refine → generate SRS (model, no RAG)
      → evaluate → use case appendix (model output) → use case diagram.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

from evaluation.evaluation_engine import SRSEvaluationEngine
from evaluation.manual_metrics_engine import ManualMetricsEngine
from srs_model_generator import SRSModelGenerator
from generation.usecase_diagram_generator import UseCaseDiagramGenerator
from input_processing.ambiguity_detection import AmbiguityDetector
from input_processing.requirement_refinement import RequirementRefiner
from input_processing.text_cleaning import TextCleaner


def _separator(title: str) -> None:
    line = "=" * 72
    print(f"\n{line}\n{title}\n{line}\n")


def _load_requirements(args: argparse.Namespace) -> List[Dict[str, Any]]:
    if args.input_text:
        return [{"original_text": args.input_text}]
    if args.input_file:
        with open(args.input_file, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        if isinstance(payload, list):
            return payload
        return payload.get("results", [])
    # stdin: JSON array or single line as text
    raw = sys.stdin.read().strip()
    if not raw:
        raise ValueError("No input: use --input_text, --input_file, or pipe JSON/text to stdin.")
    try:
        payload = json.loads(raw)
        if isinstance(payload, list):
            return payload
        if isinstance(payload, dict) and payload.get("results"):
            return payload["results"]
    except json.JSONDecodeError:
        pass
    return [{"original_text": raw}]


def run_pipeline(
    vague_requirements: str,
    project_info: Dict[str, str],
    project_root: Path,
) -> Dict[str, Any]:
    """Execute all steps; returns aggregated result dict."""
    results: Dict[str, Any] = {}

    # --- Step 1: User input ---
    _separator("STEP 1: User requirements (input)")
    print(vague_requirements.strip() or "(empty)")
    results["step1_input"] = vague_requirements

    cleaner = TextCleaner()
    detector = AmbiguityDetector()
    refiner = RequirementRefiner()

    # --- Step 2: Clean text ---
    _separator("STEP 2: Clean text")
    cleaned = cleaner.clean(vague_requirements)
    print(cleaned or "(nothing after cleaning)")
    results["step2_cleaned_text"] = cleaned

    # --- Step 3: Detect ambiguity ---
    _separator("STEP 3: Detect ambiguity")
    ambiguity = detector.analyze_requirement(cleaned)
    print("Ambiguous words:", ambiguity.get("ambiguous_words", []))
    print("\nHighlighted:")
    print(ambiguity.get("highlighted_text", cleaned))
    print("\nSuggestion (example rewrite):")
    print(ambiguity.get("suggestion", "(none)"))
    results["step3_ambiguity"] = {
        "ambiguous_words": ambiguity.get("ambiguous_words"),
        "highlighted_text": ambiguity.get("highlighted_text"),
        "suggestion": ambiguity.get("suggestion"),
    }

    # --- Step 4: Refine requirements ---
    _separator("STEP 4: Refine requirements (structured JSON)")
    refined = refiner.refine_to_structured_json(cleaned)
    print(json.dumps(refined, indent=2, ensure_ascii=False))
    results["step4_structured_requirements"] = refined

    # Text passed to the model: prefer ambiguity suggestion else cleaned
    text_for_generation = str(ambiguity.get("suggestion") or cleaned).strip() or vague_requirements
    results["text_for_generation"] = text_for_generation

    # --- Step 5: Knowledge retrieval (disabled — use API SRS_GENERATION_MODE=rag for RAG) ---
    _separator("STEP 5: Knowledge retrieval")
    print(
        "Skipped. This CLI uses direct model SRS generation only. "
        "For retrieval-augmented generation, run the web API with SRS_GENERATION_MODE=rag in `.env`."
    )
    results["step5_retrieved_context"] = []

    # --- Step 6: Generate SRS ---
    _separator("STEP 6: Generate SRS (Replicate model, no RAG)")
    generation_input = [{"original_text": text_for_generation}]
    model_gen = SRSModelGenerator()
    srs = model_gen.generate_srs(generation_input, project_info=project_info)
    sections = srs.sections
    raw_text = getattr(srs, "raw_text", None) or sections.get("_raw_text", "") or ""
    print(f"Document ID: {srs.document_id}")
    print(f"Title: {srs.title}")
    print("\n--- SRS sections (summary) ---")
    print(json.dumps(sections, indent=2, ensure_ascii=False)[:8000])
    if len(json.dumps(sections, ensure_ascii=False)) > 8000:
        print("... (truncated; full sections in result object)")
    if raw_text:
        print("\n--- Raw SRS excerpt ---")
        print(raw_text[:3000] + ("..." if len(raw_text) > 3000 else ""))
    results["step6_srs"] = {
        "document_id": srs.document_id,
        "title": srs.title,
        "version": srs.version,
        "date": srs.date,
        "author": srs.author,
        "sections": sections,
        "raw_text": raw_text,
    }

    # --- Step 7: Evaluate SRS ---
    _separator("STEP 7: Evaluate SRS")
    evaluator = SRSEvaluationEngine()
    manual_evaluator = ManualMetricsEngine()
    srs_for_eval_text = raw_text if raw_text.strip() else json.dumps(sections, ensure_ascii=False)
    metrics_ieee = evaluator.evaluate(
        user_requirements=text_for_generation,
        srs_sections=sections,
        srs_text=srs_for_eval_text,
    )
    metrics_manual = manual_evaluator.evaluate(
        source_requirements_text=text_for_generation,
        structured_requirements=refined,
        srs_sections=sections,
        srs_text=srs_for_eval_text,
    )
    print("IEEE-style evaluation:")
    print(json.dumps(metrics_ieee, indent=2))
    print("\nManual custom evaluation:")
    print(json.dumps(metrics_manual, indent=2))
    results["step7_evaluation"] = {
        "ieee_metrics": metrics_ieee,
        "manual_metrics": metrics_manual,
    }

    # --- Step 8: Textual use cases (same Replicate completion as SRS — model appendix only) ---
    _separator("STEP 8: Textual use cases (from SRS model output)")
    bundle = getattr(srs, "textual_usecases_bundle", None) or {}
    uc_text = str(bundle.get("text") or "").strip()
    uc_source = str(bundle.get("source") or "").strip()
    out_uc = project_root / "outputs" / "textual_usecases.txt"
    results["step8_textual_use_cases"] = ""
    results["step8_usecase_file"] = ""
    results["step8_structured_usecases"] = []
    if uc_text and uc_source == "model_prompt_appendix":
        out_uc.parent.mkdir(parents=True, exist_ok=True)
        out_uc.write_text(uc_text, encoding="utf-8")
        print(uc_text)
        print(f"\nSaved file: {out_uc}")
        results["step8_textual_use_cases"] = uc_text
        results["step8_usecase_file"] = str(out_uc)
    else:
        print(
            "(No textual use case appendix from the model. Regenerate SRS or check delimiter output "
            "for <<<TEXTUAL_USE_CASES_APPENDIX>>> … <<<END_TEXTUAL_USE_CASES_APPENDIX>>>.)"
        )

    # --- Step 9: Use case diagram ---
    _separator("STEP 9: Generate use case diagram (PlantUML)")
    diagram_gen = UseCaseDiagramGenerator()
    if uc_text and uc_source == "model_prompt_appendix":
        diagram_result = diagram_gen.generate_and_render(
            uc_text,
            system_name=project_info.get("title", "System")[:40] or "System",
            output_dir=str(project_root / "data" / "output"),
            output_name=f"usecase_{srs.document_id.replace('-', '_')}",
        )
        print("PlantUML code:\n")
        print(diagram_result.get("plantuml_code", ""))
        print(f"\nStatus: {diagram_result.get('status')}")
        print(f"PUML file: {diagram_result.get('puml_file')}")
        if diagram_result.get("diagram_file"):
            print(f"PNG file: {diagram_result.get('diagram_file')}")
        if diagram_result.get("message"):
            print(f"Note: {diagram_result.get('message')}")
        results["step9_diagram"] = {
            k: v for k, v in diagram_result.items() if k != "plantuml_code"
        }
        results["step9_plantuml_code"] = diagram_result.get("plantuml_code", "")
    else:
        print("(Skipped: no model textual use case text.)")
        results["step9_diagram"] = {}
        results["step9_plantuml_code"] = ""

    return results


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Full pipeline: clean → ambiguity → refine → model SRS → evaluate → use cases → diagram (no RAG)"
    )
    parser.add_argument("--input_file", help="JSON file with requirements list or results")
    parser.add_argument("--input_text", help="Single vague requirements string")
    parser.add_argument("--project_title", default="Software Requirements Specification")
    parser.add_argument("--project_author", default="Module 1 Pipeline")
    parser.add_argument("--project_version", default="1.0")
    parser.add_argument("--dump_json", help="Optional path to save full pipeline JSON result")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent
    requirements_list = _load_requirements(args)
    merged_vague = "\n\n".join(
        str(
            r.get("original_text")
            or r.get("content")
            or r.get("text")
            or r.get("requirement")
            or ""
        ).strip()
        for r in requirements_list
    ).strip()
    if not merged_vague:
        raise ValueError("No requirement text found in input.")

    project_info = {
        "title": args.project_title,
        "author": args.project_author,
        "version": args.project_version,
    }

    _separator("PIPELINE START")
    print(f"Project: {project_info['title']} (v{project_info['version']})")

    try:
        full_result = run_pipeline(
            vague_requirements=merged_vague,
            project_info=project_info,
            project_root=project_root,
        )
    except Exception as exc:
        _separator("PIPELINE ERROR")
        print(f"{type(exc).__name__}: {exc}")
        raise

    _separator("PIPELINE COMPLETE")
    print("All steps finished. Summary keys:", ", ".join(sorted(full_result.keys())))

    if args.dump_json:
        out_path = Path(args.dump_json)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        serializable = _make_json_safe(full_result)
        out_path.write_text(json.dumps(serializable, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\nFull result written to: {out_path}")


def _make_json_safe(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _make_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_make_json_safe(v) for v in obj]
    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
    return str(obj)


if __name__ == "__main__":
    main()
