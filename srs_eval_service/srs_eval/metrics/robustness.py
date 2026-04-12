"""
Metric 6: Robustness — small prompt changes should not completely rewrite meaning; compare SRS embeddings.
"""
from __future__ import annotations

from typing import Dict, List

import numpy as np

from srs_eval.embedding_utils import encode_texts


def evaluate_robustness(srs_for_variant_a: str, srs_for_variant_b: str) -> Dict:
    a = (srs_for_variant_a or "").strip()
    b = (srs_for_variant_b or "").strip()
    if not a or not b:
        return {
            "key": "robustness",
            "name": "Robustness",
            "score": 0.5,
            "score_label": "Insufficient data",
            "what_this_means": "Small wording changes in the prompt should not produce totally unrelated SRS documents.",
            "how_calculated": "We compare SRS outputs from two slightly different phrasings of the same idea.",
            "highlights": {"warnings": ["Could not compare two SRS versions."], "examples": []},
            "raw": {},
        }

    ea, eb = encode_texts([a[:12000], b[:12000]])
    pn = np.linalg.norm(ea) or 1e-9
    qn = np.linalg.norm(eb) or 1e-9
    sim = float(np.dot(ea, eb) / (pn * qn))
    score = max(0.0, min(1.0, sim))

    what = (
        "In real life people rephrase the same need. This checks whether the model stays steady when the prompt "
        "is only lightly edited."
    )
    how = (
        "We create two slightly different versions of your description, generate an SRS for each, and measure how similar "
        "the two documents are overall."
    )

    warnings = [] if score > 0.72 else ["Outputs diverge quite a bit under small prompt changes — investigate stability."]

    return {
        "key": "robustness",
        "name": "Robustness",
        "score": round(score, 4),
        "score_label": f"Stability similarity ≈ {score:.2f}",
        "what_this_means": what,
        "how_calculated": how,
        "highlights": {"warnings": warnings, "examples": []},
        "raw": {"cosine_similarity": sim},
    }
