"""
Metric 4: Context understanding — semantic overlap between prompt and generated SRS.
"""
from __future__ import annotations

from typing import Dict

import numpy as np

from srs_eval.embedding_utils import encode_texts


def evaluate_context_understanding(prompt: str, srs_text: str) -> Dict:
    prompt = (prompt or "").strip() or "software system"
    srs_text = srs_text or ""

    a, b = encode_texts([prompt, srs_text[:12000]])
    pn = np.linalg.norm(a) or 1e-9
    qn = np.linalg.norm(b) or 1e-9
    sim = float(np.dot(a, b) / (pn * qn))
    score = max(0.0, min(1.0, (sim + 1) / 2))  # embed cosine ~ [-1,1] rare; actually ST cosine is 0-1 for normalized

    # ST vectors are normalized; cosine in [0,1] typically
    score = max(0.0, min(1.0, sim))

    what = (
        "This tells you how closely the generated document stays tied to the idea you typed in. "
        "Higher means the SRS content lines up with your description."
    )
    how = (
        "We compare a single embedding of your prompt with an embedding of the whole SRS text and turn that match into a percentage-style score."
    )

    return {
        "key": "context_understanding",
        "name": "Context understanding",
        "score": round(score, 4),
        "score_label": f"Relevance ≈ {int(round(score * 100))}%",
        "what_this_means": what,
        "how_calculated": how,
        "highlights": {
            "warnings": [] if score > 0.55 else ["The SRS may be drifting from your stated problem — check scope."],
            "examples": [],
        },
        "raw": {"cosine_similarity": sim},
    }
