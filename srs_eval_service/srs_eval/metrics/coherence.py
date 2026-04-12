"""
Metric 5: Coherence & logical flow — section order, presence of structure, light readability heuristics.
Returns score 0–1.
"""
from __future__ import annotations

import re
from typing import Dict, List, Tuple

# Order we expect major sections to appear (first occurrence positions should increase)
ORDER_KEYS: List[Tuple[str, str]] = [
    ("introduction", r"\bintroduction\b"),
    ("overall", r"\boverall\s+description\b"),
    ("functional", r"\bfunctional\s+requirements\b"),
    ("nonfunctional", r"\bnon[-\s]?functional\s+requirements\b"),
]


def evaluate_coherence(srs_text: str) -> Dict:
    t = (srs_text or "").lower()
    pos: List[int] = []
    for _, pat in ORDER_KEYS:
        m = re.search(pat, t)
        pos.append(m.start() if m else -1)

    seq = [p for p in pos if p >= 0]
    if len(seq) >= 2:
        order_score = 1.0 if seq == sorted(seq) else 0.55
    elif len(seq) == 1:
        order_score = 0.65
    else:
        order_score = 0.4

    fr_n = len(re.findall(r"(?im)\bFR[-\s]?\d+", srs_text or ""))
    nfr_n = len(re.findall(r"(?im)\bNFR[-\s]?\d+", srs_text or ""))
    structure_score = min(1.0, (fr_n + nfr_n) / 8.0)

    paras = [p for p in re.split(r"\n\s*\n", srs_text or "") if len(p.strip()) > 40]
    if len(paras) >= 2:
        lens = [len(p) for p in paras]
        mean = sum(lens) / len(lens)
        var = sum((x - mean) ** 2 for x in lens) / len(lens)
        flow_score = 1.0 if var < (mean ** 2) * 2.5 else 0.75
    else:
        flow_score = 0.7

    score = 0.45 * order_score + 0.35 * structure_score + 0.20 * flow_score
    score = max(0.0, min(1.0, score))

    what = (
        "This is about readability and sensible structure: headings in a logical order, clear requirement IDs, "
        "and text that is not randomly chopped."
    )
    how = (
        "We reward finding the usual major sections in order, count structured requirement tags (FR/NFR), "
        "and lightly check whether paragraph sizes look reasonable."
    )

    warnings = []
    n_found = len(seq)
    if n_found < 3:
        warnings.append("Some standard section headings were not found clearly — coherence may suffer.")
    if order_score < 0.9 and n_found >= 2:
        warnings.append("Section headings may not appear in the usual order (Introduction → … → Functional → Non-functional).")

    return {
        "key": "coherence",
        "name": "Coherence & logical flow",
        "score": round(score, 4),
        "score_label": f"Structure score {score:.2f} / 1.0",
        "what_this_means": what,
        "how_calculated": how,
        "highlights": {
            "warnings": warnings,
            "examples": [{"type": "stats", "text": f"Found ~{fr_n} FR-style and ~{nfr_n} NFR-style labels."}],
        },
        "raw": {"order_score": order_score, "structure_score": structure_score, "flow_score": flow_score},
    }
