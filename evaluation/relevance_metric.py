from typing import Dict, List

import numpy as np
from rag.embedding import EmbeddingModel


class RelevanceMetric:
    """Semantic similarity between user requirements and generated SRS."""

    def __init__(self, embedding_model: EmbeddingModel | None = None) -> None:
        self.embedding_model = embedding_model or EmbeddingModel()

    def score(self, user_requirements: str, srs_text: str) -> float:
        """
        Score = cosine_similarity(embedding(requirements), embedding(srs))
        Returns in [0, 1].
        """
        if not user_requirements.strip() or not srs_text.strip():
            return 0.0
        req_vec = np.asarray(self.embedding_model.encode(user_requirements), dtype=np.float32)
        srs_vec = np.asarray(self.embedding_model.encode(srs_text), dtype=np.float32)
        req_norm = np.linalg.norm(req_vec)
        srs_norm = np.linalg.norm(srs_vec)
        if req_norm == 0 or srs_norm == 0:
            return 0.0
        sim = float(np.dot(req_vec, srs_vec) / (req_norm * srs_norm))
        # Convert from [-1, 1] to [0, 1] safety range.
        bounded = max(-1.0, min(1.0, sim))
        return round((bounded + 1.0) / 2.0, 3)

