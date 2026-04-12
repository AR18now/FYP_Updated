"""
Metric 3: Consistency across outputs — multiple SRS drafts for same prompt, mean pairwise embedding similarity.
"""
from __future__ import annotations

from typing import Dict, List

import numpy as np

from srs_eval.embedding_utils import encode_texts, pairwise_cosine_matrix


def evaluate_consistency(srs_variants: List[str]) -> Dict:
    texts = [t or "" for t in srs_variants if (t or "").strip()]
    if len(texts) < 2:
        return {
            "key": "consistency",
            "name": "Consistency across outputs",
            "score": 1.0,
            "score_label": "Need at least 2 generated versions",
            "what_this_means": "When the model is run several times, similar inputs should yield similar SRS documents.",
            "how_calculated": "We compare whole-document embeddings and average how alike they are.",
            "highlights": {"warnings": ["Only one variant available; consistency not measured."], "examples": []},
            "raw": {"pairwise_mean": None},
        }

    emb = encode_texts(texts)
    mat = pairwise_cosine_matrix(emb)
    n = mat.shape[0]
    off_diag = []
    for i in range(n):
        for j in range(i + 1, n):
            off_diag.append(float(mat[i, j]))
    mean_sim = float(sum(off_diag) / len(off_diag)) if off_diag else 1.0

    what = (
        "If you ask the model the same thing more than once, you usually want stable answers. "
        "High consistency means the drafts agree in meaning; low consistency means the model is all over the place."
    )
    how = (
        "We generate multiple SRS versions from the same description, turn each into a numerical fingerprint, "
        "and average how similar those fingerprints are."
    )

    return {
        "key": "consistency",
        "name": "Consistency across outputs",
        "score": round(max(0.0, min(1.0, mean_sim)), 4),
        "score_label": f"Average similarity ≈ {mean_sim:.2f}",
        "what_this_means": what,
        "how_calculated": how,
        "highlights": {
            "warnings": [] if mean_sim > 0.75 else ["Noticeable variation between runs — review critical requirements."],
            "examples": [{"type": "info", "text": f"Compared {len(texts)} full-document drafts."}],
        },
        "raw": {"pairwise_mean": mean_sim, "runs": len(texts)},
    }
