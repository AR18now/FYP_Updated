"""
FastAPI: AI evaluation metrics for an already-generated SRS (from the main Req2Design app).
Run: uvicorn app:app --host 0.0.0.0 --port 8010 --reload
"""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from srs_eval.pipeline import run_evaluation_on_provided_srs

app = FastAPI(title="SRS Evaluation Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).resolve().parent / "data"
HISTORY_PATH = DATA_DIR / "srs_eval_history.json"
_history_lock = threading.Lock()
MAX_HISTORY = 100


class EvaluateExistingRequest(BaseModel):
    """Requirements context + SRS text already shown in the app."""

    prompt: str = Field(
        ...,
        min_length=1,
        description="Joined processed requirements / user input used before SRS generation",
    )
    srs_text: str = Field(..., min_length=40, description="Generated SRS raw text")


def _load_history() -> List[Dict[str, Any]]:
    _ensure_data_dir()
    if not HISTORY_PATH.exists():
        return []
    try:
        return json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _append_history(entry: Dict[str, Any]) -> None:
    with _history_lock:
        _ensure_data_dir()
        hist = _load_history()
        hist.insert(0, entry)
        hist = hist[:MAX_HISTORY]
        HISTORY_PATH.write_text(json.dumps(hist, ensure_ascii=False, indent=2), encoding="utf-8")


@app.get("/health")
def health():
    return {"status": "ok", "service": "srs-evaluation"}


@app.post("/api/evaluate-existing")
def evaluate_existing(req: EvaluateExistingRequest):
    try:
        result = run_evaluation_on_provided_srs(req.prompt, req.srs_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    _append_history(
        {
            "run_id": result["run_id"],
            "prompt": req.prompt[:2000],
            "timing_seconds": result["timing_seconds"],
            "metrics": result["metrics"],
            "mode": "existing_srs",
            "srs_preview": (req.srs_text or "")[:500],
        }
    )
    result["history_saved"] = True
    return result


@app.get("/api/history")
def get_history(limit: int = 20):
    hist = _load_history()
    return {"items": hist[: max(1, min(50, limit))]}


@app.delete("/api/history")
def clear_history():
    with _history_lock:
        _ensure_data_dir()
        if HISTORY_PATH.exists():
            HISTORY_PATH.write_text("[]", encoding="utf-8")
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8010, reload=True)
