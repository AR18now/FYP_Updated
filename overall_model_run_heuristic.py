"""
Overall model-run (heuristic) blended score: weights, bands, verdict copy, and API helper.

This logic used to live only on the Model run page. It is centralized here so SRS payloads
can expose the same interpretation under ``generation_meta["overall_model_run_heuristic"]``.

Override rule: if alignment review is suggested, the headline is always "Review recommended"
regardless of the blended percentage.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

# Blended score = weighted mean of heuristic accuracy + token/heading F1 signals (0–1 each).
W_HEURISTIC_ACCURACY = 0.45
W_INPUT_TOKEN_F1 = 0.35
W_SECTION_HEADING_F1 = 0.20

# Composite at/above this is labeled "good" when alignment does not force review.
COMPOSITE_GOOD_MIN = 0.52
# Between this and COMPOSITE_GOOD_MIN → "mixed". Below → "weak".
COMPOSITE_FAIR_MIN = 0.38


def _pick01(v: Any) -> Optional[float]:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    if n != n:  # NaN
        return None
    return max(0.0, min(1.0, n))


def _fmt_pct01(x: float) -> str:
    return f"{round(max(0.0, min(1.0, x)) * 100)}%"


def blended_weights_help_text() -> str:
    """Human-readable footnote matching the former Model run card."""
    return (
        f"Blended score weights: heuristic accuracy {round(W_HEURISTIC_ACCURACY * 100)}%, input-token "
        f"F1 {round(W_INPUT_TOKEN_F1 * 100)}%, section-heading F1 {round(W_SECTION_HEADING_F1 * 100)}"
        f"%. Bands: below {_fmt_pct01(COMPOSITE_FAIR_MIN)} = weak; {_fmt_pct01(COMPOSITE_FAIR_MIN)}-"
        f"{_fmt_pct01(COMPOSITE_GOOD_MIN)} = mixed; >= {_fmt_pct01(COMPOSITE_GOOD_MIN)} = good - unless "
        'alignment review is suggested (then always "review recommended").'
    )


def compute_overall_model_run_heuristic(qs: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    One-line overall verdict for the model-run heuristic block.

    Returns None if ``qs`` is missing or empty. ``composite`` is 0–1 or omitted when unknown.
    """
    if not isinstance(qs, dict) or not qs:
        return None

    review = bool(qs.get("alignment_review_recommended") or qs.get("hallucination_has_potential"))
    ha = _pick01(qs.get("heuristic_accuracy"))
    fi = _pick01(qs.get("input_token_f1"))
    fs = _pick01(qs.get("section_heading_f1"))

    w = 0.0
    s = 0.0
    if ha is not None:
        w += W_HEURISTIC_ACCURACY
        s += W_HEURISTIC_ACCURACY * ha
    if fi is not None:
        w += W_INPUT_TOKEN_F1
        s += W_INPUT_TOKEN_F1 * fi
    if fs is not None:
        w += W_SECTION_HEADING_F1
        s += W_SECTION_HEADING_F1 * fs
    composite = (s / w) if w > 0 else None

    base = {
        "review": review,
        "composite": composite,
        "weights": {
            "heuristic_accuracy": W_HEURISTIC_ACCURACY,
            "input_token_f1": W_INPUT_TOKEN_F1,
            "section_heading_f1": W_SECTION_HEADING_F1,
        },
        "bands": {"fair_min": COMPOSITE_FAIR_MIN, "good_min": COMPOSITE_GOOD_MIN},
        "bands_help": blended_weights_help_text(),
    }

    if review:
        return {
            **base,
            "headline": "Review recommended",
            "tone": "review",
            "caption": (
                "Alignment monitoring wants a pass against your source. That outweighs a strong "
                'heuristic score - treat this as "needs human check", not pass/fail from percentages alone.'
            ),
        }
    if composite is None:
        return {
            **base,
            "headline": "Overall score unavailable",
            "tone": "unknown",
            "caption": "Fill in heuristic accuracy / F1 fields to compute the blended bar.",
        }
    if composite >= COMPOSITE_GOOD_MIN:
        return {
            **base,
            "headline": "Good heuristic match",
            "tone": "good",
            "caption": (
                f"Blended score {_fmt_pct01(composite)} meets the \"good\" band (>= {_fmt_pct01(COMPOSITE_GOOD_MIN)}), "
                "using the weights below."
            ),
        }
    if composite >= COMPOSITE_FAIR_MIN:
        return {
            **base,
            "headline": "Mixed / acceptable",
            "tone": "fair",
            "caption": (
                f"Blended score {_fmt_pct01(composite)} is between \"fair\" ({_fmt_pct01(COMPOSITE_FAIR_MIN)}) and "
                f"\"good\" ({_fmt_pct01(COMPOSITE_GOOD_MIN)})."
            ),
        }
    return {
        **base,
        "headline": "Weak heuristic match",
        "tone": "weak",
        "caption": f"Blended score {_fmt_pct01(composite)} is below the \"fair\" line ({_fmt_pct01(COMPOSITE_FAIR_MIN)}).",
    }
