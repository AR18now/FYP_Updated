#!/usr/bin/env python3
"""
Evaluate SRS knowledge-base TXT files with practical quality metrics.

Metrics per document (0..1):
1) ieee_section_coverage   -> Introduction / Overall Description / Specific Requirements presence
2) fr_coverage             -> Functional requirement signal presence
3) nfr_coverage            -> Non-functional requirement signal presence
4) clarity_readability     -> sentence length heuristic
5) ambiguity_quality       -> inverse vague-term ratio
6) extraction_cleanliness  -> penalty for noisy artifacts (table/page noise markers)
7) content_adequacy        -> enough informative text length
8) duplication_quality     -> lower repeated-line ratio is better
9) heading_structure       -> expected heading density/order hints
10) numeric_specificity    -> measurable constraints presence
11) lexical_richness       -> vocabulary diversity proxy
12) weak_phrase_metric
13) optionality_metric
14) atomicity_metric
15) consistency_metric
16) verifiability_metric
17) requirement_uniqueness_metric
18) requirement_id_coverage_metric
19) readability_metric
20) requirement_density_metric

Output:
- data/output/kb_quality_report.json
- data/output/kb_quality_report.csv
- data/knowledge_base/kb_approved/*.txt
- data/knowledge_base/kb_approved_index.jsonl
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path
from typing import Dict, List, Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from input_processing.ambiguity_detection import AmbiguityDetector
from evaluation.requirements_text_linter import RequirementsTextLinter


class KBEvaluator:
    def __init__(self) -> None:
        self.ambiguity = AmbiguityDetector()
        self._requirements_linter = RequirementsTextLinter()
        self.section_tokens = [
            "introduction",
            "overall description",
            "specific requirements",
        ]
        self.fr_tokens = [
            "functional requirements",
            "functional requirement",
            "fr-",
            "shall",
            "must",
            "use case",
        ]
        self.nfr_tokens = [
            "non-functional requirements",
            "non functional requirements",
            "performance",
            "security",
            "reliability",
            "availability",
            "usability",
            "maintainability",
            "portability",
            "response time",
        ]
        self.noise_tokens = [
            "table ",
            "figure ",
            "chapter ",
            "page ",
            "copyright",
            "all rights reserved",
        ]
        self.weak_phrases = [
            "user-friendly",
            "easy to use",
            "etc",
            "and so on",
            "appropriate",
            "as needed",
            "as soon as possible",
            "quickly",
            "soon",
            "fast",
            "efficient",
            "robust",
            "scalable",
        ]
        self.optionality_words = ["may", "might", "could", "optional", "optionally"]
        self.conflict_pairs = [
            ("always", "never"),
            ("must", "optional"),
            ("required", "not required"),
            ("enable", "disable"),
            ("allow", "deny"),
            ("minimum", "maximum"),
        ]

    def evaluate_document(self, text: str) -> Dict[str, float]:
        cleaned = text or ""
        lowered = cleaned.lower()

        ieee_section_coverage = self._coverage_from_tokens(lowered, self.section_tokens)
        fr_coverage = self._fr_coverage(lowered)
        nfr_coverage = self._nfr_coverage(lowered)
        clarity_readability = self._clarity_score(cleaned)
        ambiguity_quality = self._ambiguity_score(cleaned)
        extraction_cleanliness = self._cleanliness_score(lowered)
        content_adequacy = self._content_adequacy_score(cleaned)
        duplication_quality = self._duplication_quality_score(cleaned)
        heading_structure = self._heading_structure_score(cleaned)
        numeric_specificity = self._numeric_specificity_score(cleaned)
        lexical_richness = self._lexical_richness_score(cleaned)
        requirements = self._extract_requirement_candidates(cleaned)
        weak_phrase_metric = self._weak_phrase_metric(cleaned)
        optionality_metric = self._optionality_metric(cleaned)
        atomicity_metric = self._atomicity_metric(requirements)
        consistency_metric = self._consistency_metric(cleaned)
        verifiability_metric = self._verifiability_metric(requirements)
        requirement_uniqueness_metric = self._requirement_uniqueness_metric(requirements)
        requirement_id_coverage_metric = self._requirement_id_coverage_metric(requirements)
        readability_metric = self._readability_metric(cleaned)
        requirement_density_metric = self._requirement_density_metric(cleaned, requirements)
        arm_metrics = self._requirements_linter.analyze(cleaned, requirements)

        score = (
            0.12 * ieee_section_coverage
            + 0.08 * fr_coverage
            + 0.08 * nfr_coverage
            + 0.07 * clarity_readability
            + 0.06 * ambiguity_quality
            + 0.05 * extraction_cleanliness
            + 0.05 * content_adequacy
            + 0.05 * duplication_quality
            + 0.06 * heading_structure
            + 0.05 * numeric_specificity
            + 0.03 * lexical_richness
            + 0.05 * weak_phrase_metric
            + 0.05 * optionality_metric
            + 0.05 * atomicity_metric
            + 0.06 * consistency_metric
            + 0.08 * verifiability_metric
            + 0.05 * requirement_uniqueness_metric
            + 0.04 * requirement_id_coverage_metric
            + 0.04 * readability_metric
            + 0.03 * requirement_density_metric
            + 0.06 * arm_metrics["arm_overall_score"]
        )

        result = {
            # Requested metric names
            "completeness_metric": round(ieee_section_coverage, 3),
            "structure_compliance_metric": round(heading_structure, 3),
            "clarity_metric": round(ambiguity_quality, 3),
            "weak_phrase_metric": round(weak_phrase_metric, 3),
            "optionality_metric": round(optionality_metric, 3),
            "atomicity_metric": round(atomicity_metric, 3),
            "consistency_metric": round(consistency_metric, 3),
            "verifiability_metric": round(verifiability_metric, 3),
            "requirement_uniqueness_metric": round(requirement_uniqueness_metric, 3),
            "requirement_id_coverage_metric": round(requirement_id_coverage_metric, 3),
            "readability_metric": round(readability_metric, 3),
            "requirement_density_metric": round(requirement_density_metric, 3),
            # Existing diagnostics
            "ieee_section_coverage": round(ieee_section_coverage, 3),
            "fr_coverage": round(fr_coverage, 3),
            "nfr_coverage": round(nfr_coverage, 3),
            "clarity_readability": round(clarity_readability, 3),
            "ambiguity_quality": round(ambiguity_quality, 3),
            "extraction_cleanliness": round(extraction_cleanliness, 3),
            "content_adequacy": round(content_adequacy, 3),
            "duplication_quality": round(duplication_quality, 3),
            "heading_structure": round(heading_structure, 3),
            "numeric_specificity": round(numeric_specificity, 3),
            "lexical_richness": round(lexical_richness, 3),
            "requirements_detected": len(requirements),
            "overall_score": round(max(0.0, min(1.0, score)), 3),
        }
        result.update(arm_metrics)
        return result

    def _coverage_from_tokens(self, lowered: str, tokens: List[str]) -> float:
        hits = sum(1 for t in tokens if t in lowered)
        return hits / max(len(tokens), 1)

    def _fr_coverage(self, lowered: str) -> float:
        # Presence + approximate count signal.
        presence = sum(1 for t in self.fr_tokens if t in lowered) / len(self.fr_tokens)
        likely_fr_lines = sum(
            1
            for line in lowered.splitlines()
            if re.search(r"\b(fr[- ]?\d+|functional requirement)\b", line)
            or (
                line.strip().startswith(("-", "*", "•"))
                and any(k in line for k in ["shall", "must", "allow", "enable"])
            )
        )
        count_bonus = min(1.0, likely_fr_lines / 8.0)
        return (0.6 * presence) + (0.4 * count_bonus)

    def _nfr_coverage(self, lowered: str) -> float:
        presence = sum(1 for t in self.nfr_tokens if t in lowered) / len(self.nfr_tokens)
        measurable_nfr = sum(
            1
            for line in lowered.splitlines()
            if any(k in line for k in ["performance", "security", "reliability", "availability", "usability"])
            and re.search(r"\b\d+(\.\d+)?\b|<\s*\d+|>\s*\d+|%", line)
        )
        count_bonus = min(1.0, measurable_nfr / 5.0)
        return (0.7 * presence) + (0.3 * count_bonus)

    def _clarity_score(self, text: str) -> float:
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
        if not sentences:
            return 0.0
        lengths = [len(re.findall(r"\b\w+\b", s)) for s in sentences]
        avg = sum(lengths) / len(lengths)
        if avg <= 10:
            base = 0.8
        elif avg <= 22:
            base = 1.0
        elif avg <= 32:
            base = 0.7
        else:
            base = 0.4
        very_long_ratio = sum(1 for n in lengths if n > 35) / len(lengths)
        return max(0.0, min(1.0, base - 0.4 * very_long_ratio))

    def _ambiguity_score(self, text: str) -> float:
        words = re.findall(r"\b\w+\b", text)
        total_words = max(len(words), 1)
        ambiguous = len(self.ambiguity.detect(text))
        return max(0.0, min(1.0, 1.0 - (ambiguous / total_words)))

    def _cleanliness_score(self, lowered: str) -> float:
        lines = [ln.strip() for ln in lowered.splitlines() if ln.strip()]
        if not lines:
            return 0.0
        noise_lines = 0
        for line in lines:
            if any(tok in line for tok in self.noise_tokens):
                noise_lines += 1
            if re.fullmatch(r"\d{1,3}", line):
                noise_lines += 1
        ratio = noise_lines / len(lines)
        return max(0.0, min(1.0, 1.0 - ratio))

    def _content_adequacy_score(self, text: str) -> float:
        words = re.findall(r"\b\w+\b", text)
        wc = len(words)
        # Strong SRS KB chunks usually need meaningful length.
        if wc >= 2000:
            return 1.0
        if wc >= 1200:
            return 0.85
        if wc >= 700:
            return 0.65
        if wc >= 350:
            return 0.45
        return 0.2

    def _duplication_quality_score(self, text: str) -> float:
        lines = [ln.strip().lower() for ln in text.splitlines() if ln.strip()]
        if not lines:
            return 0.0
        unique_ratio = len(set(lines)) / len(lines)
        return max(0.0, min(1.0, unique_ratio))

    def _heading_structure_score(self, text: str) -> float:
        lowered = text.lower()
        heading_hits = 0
        expected = [
            r"\b1\.?\s*introduction\b",
            r"\b2\.?\s*overall description\b",
            r"\b3\.?\s*specific requirements\b",
            r"\bfunctional requirements?\b",
            r"\bnon[- ]?functional requirements?\b",
        ]
        for pat in expected:
            if re.search(pat, lowered):
                heading_hits += 1
        return heading_hits / len(expected)

    def _numeric_specificity_score(self, text: str) -> float:
        lines = [ln.strip().lower() for ln in text.splitlines() if ln.strip()]
        if not lines:
            return 0.0
        candidate = [
            ln
            for ln in lines
            if any(k in ln for k in ["performance", "response time", "latency", "security", "availability", "reliability"])
        ]
        if not candidate:
            return 0.3
        measurable = sum(1 for ln in candidate if re.search(r"\b\d+(\.\d+)?\b|<\s*\d+|>\s*\d+|%", ln))
        return measurable / len(candidate)

    def _lexical_richness_score(self, text: str) -> float:
        tokens = [t.lower() for t in re.findall(r"[a-zA-Z]{3,}", text)]
        if not tokens:
            return 0.0
        ratio = len(set(tokens)) / len(tokens)
        # Normalize to practical SRS range.
        return max(0.0, min(1.0, ratio / 0.35))

    def _extract_requirement_candidates(self, text: str) -> List[str]:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        out: List[str] = []
        for ln in lines:
            lower = ln.lower()
            if re.search(r"\b(fr|nfr)[-_ ]?\d+\b", lower):
                out.append(ln)
                continue
            if any(k in lower for k in [" shall ", " must ", " should ", " may ", " could ", " might "]):
                out.append(ln)
                continue
            if ln.startswith(("-", "*", "•")) and any(k in lower for k in ["shall", "must", "allow", "enable", "provide"]):
                out.append(ln)
        # de-dup preserve order
        seen = set()
        uniq = []
        for ln in out:
            key = ln.lower()
            if key in seen:
                continue
            seen.add(key)
            uniq.append(ln)
        return uniq

    def _weak_phrase_metric(self, text: str) -> float:
        lowered = text.lower()
        words = max(len(re.findall(r"\b\w+\b", lowered)), 1)
        hits = sum(lowered.count(p) for p in self.weak_phrases)
        return max(0.0, min(1.0, 1.0 - (hits / words)))

    def _optionality_metric(self, text: str) -> float:
        lowered = text.lower()
        req_lines = self._extract_requirement_candidates(text)
        if not req_lines:
            return 0.5
        optional_hits = 0
        for ln in req_lines:
            l = ln.lower()
            if any(re.search(rf"\b{w}\b", l) for w in self.optionality_words):
                optional_hits += 1
        return max(0.0, min(1.0, 1.0 - (optional_hits / len(req_lines))))

    def _atomicity_metric(self, requirements: List[str]) -> float:
        if not requirements:
            return 0.5
        bad = 0
        for req in requirements:
            l = req.lower()
            # crude multi-action indicator
            connectors = len(re.findall(r"\b(and|or|then|also)\b", l))
            verbs = len(re.findall(r"\b(shall|must|allow|enable|provide|support|process|create|update|delete)\b", l))
            if connectors >= 2 and verbs >= 2:
                bad += 1
        return max(0.0, min(1.0, 1.0 - (bad / len(requirements))))

    def _consistency_metric(self, text: str) -> float:
        lowered = text.lower()
        conflicts = 0
        for a, b in self.conflict_pairs:
            if re.search(rf"\b{re.escape(a)}\b", lowered) and re.search(rf"\b{re.escape(b)}\b", lowered):
                conflicts += 1
        return max(0.0, min(1.0, 1.0 - (conflicts / max(len(self.conflict_pairs), 1))))

    def _verifiability_metric(self, requirements: List[str]) -> float:
        if not requirements:
            return 0.0
        measurable = 0
        for req in requirements:
            if re.search(r"\b\d+(\.\d+)?\b|<\s*\d+|>\s*\d+|<=\s*\d+|>=\s*\d+|%", req.lower()):
                measurable += 1
        return measurable / len(requirements)

    def _requirement_uniqueness_metric(self, requirements: List[str]) -> float:
        if not requirements:
            return 0.5
        duplicates = 0
        total_pairs = 0
        normalized = [re.sub(r"\s+", " ", r.lower()).strip() for r in requirements]
        for i in range(len(normalized)):
            for j in range(i + 1, len(normalized)):
                total_pairs += 1
                sim = SequenceMatcher(None, normalized[i], normalized[j]).ratio()
                if sim >= 0.88:
                    duplicates += 1
        if total_pairs == 0:
            return 1.0
        return max(0.0, min(1.0, 1.0 - (duplicates / total_pairs)))

    def _requirement_id_coverage_metric(self, requirements: List[str]) -> float:
        if not requirements:
            return 0.0
        with_id = sum(1 for r in requirements if re.search(r"\b(?:FR|NFR)[-_ ]?\d+\b", r, flags=re.IGNORECASE))
        return with_id / len(requirements)

    def _readability_metric(self, text: str) -> float:
        # requested metric: average sentence length
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
        if not sentences:
            return 0.0
        lengths = [len(re.findall(r"\b\w+\b", s)) for s in sentences]
        avg = sum(lengths) / len(lengths)
        # ideal 12-20 words
        if 12 <= avg <= 20:
            return 1.0
        if 9 <= avg < 12 or 20 < avg <= 25:
            return 0.8
        if 6 <= avg < 9 or 25 < avg <= 30:
            return 0.6
        return 0.4

    def _requirement_density_metric(self, text: str, requirements: List[str]) -> float:
        words = len(re.findall(r"\b\w+\b", text))
        if words == 0:
            return 0.0
        density = (len(requirements) / words) * 1000.0
        # heuristic target band: 8-25 requirement statements per 1000 words
        if 8 <= density <= 25:
            return 1.0
        if 5 <= density < 8 or 25 < density <= 35:
            return 0.75
        if 3 <= density < 5 or 35 < density <= 45:
            return 0.5
        return 0.25


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate TXT SRS knowledge base quality.")
    parser.add_argument("--kb_dir", default="data/knowledge_base/ieee830_ready")
    parser.add_argument("--json_out", default="data/output/kb_quality_report.json")
    parser.add_argument("--csv_out", default="data/output/kb_quality_report.csv")
    parser.add_argument("--approved_dir", default="data/knowledge_base/kb_approved")
    parser.add_argument("--approved_index", default="data/knowledge_base/kb_approved_index.jsonl")
    parser.add_argument("--pass_threshold", type=float, default=0.62)
    args = parser.parse_args()

    kb_dir = Path(args.kb_dir)
    json_out = Path(args.json_out)
    csv_out = Path(args.csv_out)
    approved_dir = Path(args.approved_dir)
    approved_index = Path(args.approved_index)

    json_out.parent.mkdir(parents=True, exist_ok=True)
    csv_out.parent.mkdir(parents=True, exist_ok=True)
    approved_dir.mkdir(parents=True, exist_ok=True)
    approved_index.parent.mkdir(parents=True, exist_ok=True)

    evaluator = KBEvaluator()
    txt_files = sorted([p for p in kb_dir.glob("*.txt") if p.is_file()])

    rows: List[Dict] = []
    for path in txt_files:
        text = path.read_text(encoding="utf-8", errors="ignore")
        metrics = evaluator.evaluate_document(text)
        passed = metrics["overall_score"] >= args.pass_threshold and metrics["ieee_section_coverage"] >= 0.66
        row = {"file": str(path), "passed": passed, **metrics}
        rows.append(row)

    rows.sort(key=lambda r: r["overall_score"], reverse=True)

    summary = {
        "kb_dir": str(kb_dir),
        "documents_total": len(rows),
        "documents_passed": sum(1 for r in rows if r["passed"]),
        "pass_threshold": args.pass_threshold,
        "average_score": round(sum(r["overall_score"] for r in rows) / max(len(rows), 1), 3),
        "rows": rows,
    }
    json_out.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    with csv_out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "rank",
                "file",
                "passed",
                "overall_score",
                "arm_overall_score",
                "arm_imperative_quality",
                "arm_weak_phrase_quality",
                "arm_optionality_quality",
                "arm_continuance_quality",
                "arm_directive_quality",
                "arm_incomplete_quality",
                "arm_ambiguity_quality",
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
            ]
        )
        for idx, row in enumerate(rows, start=1):
            writer.writerow(
                [
                    idx,
                    row["file"],
                    row["passed"],
                    row["overall_score"],
                    row["arm_overall_score"],
                    row["arm_imperative_quality"],
                    row["arm_weak_phrase_quality"],
                    row["arm_optionality_quality"],
                    row["arm_continuance_quality"],
                    row["arm_directive_quality"],
                    row["arm_incomplete_quality"],
                    row["arm_ambiguity_quality"],
                    row["completeness_metric"],
                    row["structure_compliance_metric"],
                    row["clarity_metric"],
                    row["weak_phrase_metric"],
                    row["optionality_metric"],
                    row["atomicity_metric"],
                    row["consistency_metric"],
                    row["verifiability_metric"],
                    row["requirement_uniqueness_metric"],
                    row["requirement_id_coverage_metric"],
                    row["readability_metric"],
                    row["requirement_density_metric"],
                    row["ieee_section_coverage"],
                    row["fr_coverage"],
                    row["nfr_coverage"],
                    row["clarity_readability"],
                    row["ambiguity_quality"],
                    row["extraction_cleanliness"],
                    row["content_adequacy"],
                    row["duplication_quality"],
                    row["heading_structure"],
                    row["numeric_specificity"],
                    row["lexical_richness"],
                ]
            )

    approved_docs: List[Dict[str, str]] = []
    for row in rows:
        if not row["passed"]:
            continue
        source = Path(row["file"])
        target = approved_dir / source.name
        text = source.read_text(encoding="utf-8", errors="ignore")
        target.write_text(text, encoding="utf-8")
        approved_docs.append(
            {
                "id": target.stem,
                "text": text,
                "source_file": str(source),
                "source_type": "ieee_830_template",
            }
        )

    with approved_index.open("w", encoding="utf-8") as f:
        for doc in approved_docs:
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")

    print(
        json.dumps(
            {
                "documents_total": summary["documents_total"],
                "documents_passed": summary["documents_passed"],
                "average_score": summary["average_score"],
                "json_report": str(json_out),
                "csv_report": str(csv_out),
                "approved_dir": str(approved_dir),
                "approved_index": str(approved_index),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

