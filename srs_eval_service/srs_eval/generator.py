"""
SRS text generation for the evaluation pipeline.

Uses the project's real model (`SRSModelGenerator` in `srs_model_generator.py`, Replicate-backed)
when `REPLICATE_API_TOKEN` is available. Falls back to a structured template if imports fail,
the token is missing, or generation returns empty text.

Environment:
  SRS_EVAL_USE_MOCK=1   — force template-only generation (no API calls; useful for offline tests).
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import sys
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)


def _fyp_root() -> Path:
    """Project root: .../FYP (parent of `srs_eval_service`)."""
    return Path(__file__).resolve().parents[2]


def _ensure_fyp_on_path() -> None:
    root = str(_fyp_root())
    if root not in sys.path:
        sys.path.insert(0, root)


def _load_dotenv_from_project() -> None:
    try:
        from dotenv import load_dotenv

        env_path = _fyp_root() / ".env"
        if env_path.is_file():
            load_dotenv(env_path)
    except ImportError:
        pass


def _generate_fallback_template_srs(prompt: str, seed: int = 0) -> str:
    """Original IEEE-830-like template (used when the real model is unavailable)."""
    summary = (prompt.strip() or "the described software system.")[:800]
    v = lambda opts: _variant_word(seed + hash(prompt) % 10000, opts)

    low = prompt.lower()
    extra_fr = ""
    if "blockchain" not in low and "crypto" not in low:
        extra_fr = (
            "\nFR-099: The system shall provide integration with a distributed ledger for settlement "
            "of cross-border blockchain transactions."
        )

    intro = v(["This document specifies requirements", "This SRS captures requirements", "The following specifies"])
    overall = v(["The product is a software application that", "The system delivers", "Stakeholders expect"])

    return f"""SOFTWARE REQUIREMENTS SPECIFICATION

Document ID: SRS-MOCK-{abs(hash(prompt + str(seed))) % 10_000_000:07d}
Version: 1.{seed % 3}.0

================================================================================
1. INTRODUCTION
================================================================================

1.1 Purpose
{intro} for {summary}

1.2 Scope
The system addresses the functional and quality needs implied by the user's description and excludes unrelated domains unless explicitly stated.

1.3 Definitions, Acronyms, and Abbreviations
• SRS — Software Requirements Specification
• NFR — Non-Functional Requirement

================================================================================
2. OVERALL DESCRIPTION
================================================================================

2.1 Product Perspective
{overall} aligns with the input description and operates as a component within the user's intended environment.

2.2 User Classes and Characteristics
Primary users include end users and administrators described in the original prompt; accessibility should follow common WCAG-inspired practices.

2.3 Operating Environment
Web and/or desktop deployment as applicable; modern browsers and supported OS versions.

================================================================================
3. FUNCTIONAL REQUIREMENTS
================================================================================

FR-001: The system shall allow users to authenticate securely using credentials.
FR-002: The system shall provide core workflows implied by: {summary[:200]}...
FR-003: The system shall persist user data with appropriate backup and recovery.
FR-004: The system shall expose administrative functions for configuration and monitoring.{extra_fr}

================================================================================
4. NON-FUNCTIONAL REQUIREMENTS
================================================================================

NFR-001 Performance: Response time for primary interactive actions shall be under {_variant_word(seed, ['2', '3', '4'])} seconds under nominal load.
NFR-002 Security: Data in transit shall use TLS; passwords shall be stored using salted hashing.
NFR-003 Reliability: Target availability shall be {_variant_word(seed, ['99.5', '99.0', '99.9'])}% monthly except planned maintenance.
NFR-004 Maintainability: The architecture shall support modular updates with regression testing.

================================================================================
Appendix A — Traceability
================================================================================
Initial generated draft for structured review (template fallback; seed={seed}).
"""


def _variant_word(seed: int, options: List[str]) -> str:
    h = hashlib.md5(str(seed).encode()).hexdigest()
    return options[int(h[:4], 16) % len(options)]


def perturb_prompt(prompt: str, variant: str = "a") -> str:
    """Light perturbation for robustness testing (same intent, different wording)."""
    p = prompt.strip()
    if not p:
        return "A generic information system."
    if variant == "a":
        return f"System context (clarified): {p} The solution should be maintainable."
    if variant == "b":
        return f"Requirements brief: {p} Prioritize reliability and usability."
    return f"{p} Additional note: deployment is cloud-first."


def _try_generate_with_project_model(prompt: str, seed: int) -> Optional[str]:
    """
    Call `SRSModelGenerator.generate_srs` (Replicate) from the main FYP codebase.
    Returns None on failure / empty output.
    """
    _ensure_fyp_on_path()
    _load_dotenv_from_project()

    if not os.getenv("REPLICATE_API_TOKEN", "").strip():
        logger.debug("REPLICATE_API_TOKEN not set; skipping Replicate generator.")
        return None

    try:
        from srs_model_generator import ModelConfig, SRSModelGenerator
    except Exception as e:
        logger.info("Could not import SRSModelGenerator: %s", e)
        return None

    try:
        cfg = ModelConfig()
        # Vary decoding slightly so consistency / robustness metrics see non-identical drafts.
        jitter = (abs(hash(f"{prompt}\0{seed}")) % 19) / 200.0  # 0.00 .. 0.09
        base_t = float(cfg.temperature)
        cfg.temperature = min(0.58, max(0.22, base_t * 0.9 + jitter))
    except Exception as e:
        logger.warning("ModelConfig setup failed: %s", e)
        return None

    try:
        generator = SRSModelGenerator(config=cfg)
    except Exception as e:
        logger.info("SRSModelGenerator not available (%s). Use REPLICATE_API_TOKEN or SRS_EVAL_USE_MOCK=1.", e)
        return None

    text_in = (prompt or "").strip() or "Describe the software system requirements."
    project_info = {
        "title": "Software Requirements Specification",
        "author": "Req2Design — SRS evaluation",
        "version": "1.0",
    }
    requirements_data = [{"original_text": text_in}]

    try:
        doc = generator.generate_srs(requirements_data, project_info)
    except Exception as e:
        logger.exception("generate_srs failed: %s", e)
        return None

    raw = getattr(doc, "raw_text", None) or ""
    if not (raw or "").strip() and getattr(doc, "sections", None):
        raw = (doc.sections or {}).get("_raw_text") or ""

    if not (raw or "").strip() and getattr(doc, "sections", None):
        # Last resort: structured JSON still allows section-based metrics to run
        try:
            raw = json.dumps(doc.sections, ensure_ascii=False, indent=2)
        except Exception:
            raw = ""

    out = (raw or "").strip()
    if len(out) < 80:
        logger.warning("Real generator returned very short output (%s chars); treating as failure.", len(out))
        return None
    return out


def generate_mock_srs(prompt: str, seed: int = 0) -> str:
    """
    Produce one SRS document string for metrics.

    Prefer the real Replicate-backed generator (`srs_model_generator.SRSModelGenerator`).
    Set `SRS_EVAL_USE_MOCK=1` to force the local template (no external calls).
    """
    force_mock = os.getenv("SRS_EVAL_USE_MOCK", "").strip().lower() in ("1", "true", "yes")
    if force_mock:
        return _generate_fallback_template_srs(prompt, seed)

    real = _try_generate_with_project_model(prompt, seed)
    if real:
        return real

    logger.warning("Falling back to template SRS (set REPLICATE_API_TOKEN in project .env for live generation).")
    return _generate_fallback_template_srs(prompt, seed)


def split_into_sentences(text: str) -> List[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if len(p.strip()) > 15]
