"""
Metric 1: Required SRS sections present → score = fraction of required sections found.
"""
from __future__ import annotations

import re
from typing import Dict, List, Tuple

# Flexible patterns (case-insensitive) for IEEE-830-style SRS
SECTION_CHECKS: List[Tuple[str, List[str]]] = [
    ("Introduction", [r"\bintroduction\b", r"\b1\.\s*introduction\b"]),
    ("Overall Description", [r"\boverall\s+description\b", r"\b2\.\s*overall\b"]),
    ("Functional Requirements", [r"\bfunctional\s+requirements\b", r"\b3\.\s*functional\b", r"\bFR[-\s]?\d"]),
    ("Non-Functional Requirements", [r"\bnon[-\s]?functional\s+requirements\b", r"\b4\.\s*non[-\s]?functional\b", r"\bNFR[-\s]?\d"]),
]


def evaluate_instruction_adherence(srs_text: str) -> Dict:
    text = srs_text or ""
    lower = text.lower()
    found: List[str] = []
    missing: List[str] = []

    for name, patterns in SECTION_CHECKS:
        ok = any(re.search(p, lower, re.I) for p in patterns)
        if ok:
            found.append(name)
        else:
            missing.append(name)

    n = len(SECTION_CHECKS)
    score = len(found) / n if n else 0.0

    what = (
        "This checks whether your SRS looks like a complete document: the main chapters most teams expect "
        "(introduction, big-picture description, functional needs, and quality-type needs)."
    )
    how = (
        "We scan the text for section titles and common labels (like FR- / NFR-). "
        "Your score is the share of those four blocks that we could find."
    )

    warnings = [f"Missing or unclear section: {m}" for m in missing]

    return {
        "key": "instruction_adherence",
        "name": "Instruction Adherence",
        "score": round(score, 4),
        "score_label": f"{int(round(score * 100))}% of required sections",
        "what_this_means": what,
        "how_calculated": how,
        "highlights": {
            "warnings": warnings,
            "examples": [{"type": "found", "text": f"Detected: {', '.join(found) or 'none'}"}],
        },
        "raw": {"found_sections": found, "missing_sections": missing},
    }
