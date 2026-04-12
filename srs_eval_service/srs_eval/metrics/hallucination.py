"""
Metric 2: Hallucination rate — requirement-like lines weakly supported by the input prompt.
Score reported as hallucination_rate (lower is better) and quality_score (1 - rate, higher is better).
"""
from __future__ import annotations

import re
from typing import Dict, List

from srs_eval.embedding_utils import encode_texts

# Lines that look like requirements / strong statements
REQ_LINE = re.compile(
    r"(?im)^\s*(?:"
    r"\d+\.\d+\s+[^:]+:"  # 1.1 Purpose:
    r"|(?:FR|NFR|REQ)[-\s]?\d+\s*[:.)]"
    r"|[-*•]\s+.+(?:shall|must|should)\b"
    r"|.+\bshall\b.+\."
    r")"
)


def _requirement_like_lines(text: str) -> List[str]:
    lines = []
    for raw in text.splitlines():
        s = raw.strip()
        if len(s) < 25:
            continue
        if REQ_LINE.search(s) or re.search(r"\b(shall|must)\b", s, re.I):
            lines.append(s[:500])
    if len(lines) < 4:
        # fallback: chunk by sentences with shall/must
        for m in re.finditer(r"[^.!?]+(?:shall|must|should)[^.!?]*[.!?]", text, re.I):
            t = m.group(0).strip()
            if len(t) > 30:
                lines.append(t[:500])
    # Cap for responsive CPU inference (embedding batch is still one forward pass)
    return lines[:28]


def evaluate_hallucination(prompt: str, srs_text: str, similarity_threshold: float = 0.42) -> Dict:
    prompt = (prompt or "").strip()
    srs_text = srs_text or ""
    lines = _requirement_like_lines(srs_text)
    if not lines:
        lines = [srs_text[:2000]]

    p_emb = encode_texts([prompt] if prompt else ["general software system"])
    line_embs = encode_texts(lines)

    # Cosine similarity prompt vs each line (row-wise dot / norms)
    import numpy as np

    p = p_emb[0]
    pn = np.linalg.norm(p) or 1e-9
    hallucinated: List[str] = []
    sims: List[float] = []
    for i, row in enumerate(line_embs):
        rn = np.linalg.norm(row) or 1e-9
        sim = float(np.dot(p, row) / (pn * rn))
        sims.append(sim)
        if sim < similarity_threshold:
            hallucinated.append(lines[i])

    total = len(lines)
    rate = len(hallucinated) / total if total else 0.0
    quality = max(0.0, min(1.0, 1.0 - rate))

    what = (
        "This estimates how many statements in the SRS drift away from what you actually asked for. "
        "A higher hallucination rate means more lines look unrelated to your input."
    )
    how = (
        "We take lines that look like requirements, compare each one to your original description using meaning-based similarity, "
        "and count those that fall below a safety threshold as potentially unsupported."
    )

    examples = [{"type": "flagged_line", "text": h[:400]} for h in hallucinated[:5]]

    return {
        "key": "hallucination",
        "name": "Hallucination rate",
        "score": round(quality, 4),
        "score_secondary": round(rate, 4),
        "score_label": f"{int(round(rate * 100))}% of lines flagged (lower is better)",
        "what_this_means": what,
        "how_calculated": how,
        "highlights": {
            "warnings": (
                [f"{len(hallucinated)} requirement-like line(s) look weakly grounded in your prompt."]
                if hallucinated
                else ["No strong mismatches detected among parsed requirement lines."]
            ),
            "examples": examples,
        },
        "raw": {
            "hallucination_rate": rate,
            "lines_checked": total,
            "threshold": similarity_threshold,
            "avg_line_similarity": float(sum(sims) / len(sims)) if sims else 0.0,
        },
    }
