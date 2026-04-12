"""
Lazy-loaded sentence embeddings + cosine helpers (sentence-transformers + sklearn).
"""
from __future__ import annotations

from functools import lru_cache
from typing import List, Sequence, Union

import numpy as np

ArrayLike = Union[np.ndarray, List, Sequence]


@lru_cache(maxsize=1)
def get_model():
    """Small, fast model; first call downloads weights (~80MB)."""
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer("all-MiniLM-L6-v2")


def encode_texts(texts: List[str], batch_size: int = 64) -> np.ndarray:
    if not texts:
        return np.zeros((0, 384), dtype=np.float32)
    model = get_model()
    return model.encode(
        texts,
        convert_to_numpy=True,
        show_progress_bar=False,
        batch_size=batch_size,
    )


def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity for two 1D vectors (or flatten)."""
    a = np.asarray(a).flatten()
    b = np.asarray(b).flatten()
    denom = (np.linalg.norm(a) * np.linalg.norm(b)) or 1e-9
    return float(np.dot(a, b) / denom)


def pairwise_cosine_matrix(vectors: np.ndarray) -> np.ndarray:
    """vectors: (n, dim) -> (n, n) cosine similarity."""
    from sklearn.metrics.pairwise import cosine_similarity

    if len(vectors) < 2:
        return np.array([[1.0]])
    return cosine_similarity(vectors)
