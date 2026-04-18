"""Resolve the IEEE 830 extracted SRS corpus used as the default RAG knowledge base."""

from __future__ import annotations

from pathlib import Path
from typing import Optional, Union


def resolve_final_extracted_srs_ieee830_dir(project_root: Union[str, Path]) -> Optional[Path]:
    """
    Prefer the nested layout ``final_extracted_srs_ieee830/final_extracted_srs_ieee830/``
    (many .txt SRS samples). Fall back to the parent folder if only that exists.
    """
    root = Path(project_root).resolve()
    inner = root / "final_extracted_srs_ieee830" / "final_extracted_srs_ieee830"
    if inner.is_dir():
        return inner
    outer = root / "final_extracted_srs_ieee830"
    if outer.is_dir():
        return outer
    return None
