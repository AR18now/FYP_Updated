import hashlib
from typing import List, Sequence

import numpy as np


class EmbeddingModel:
    """
    Embedding wrapper with graceful fallback.
    - Preferred: sentence-transformers model
    - Fallback: deterministic hash embedding
    """

    def __init__(self, dimensions: int = 384, model_name: str = "all-MiniLM-L6-v2") -> None:
        self.dimensions = dimensions
        self.model_name = model_name
        self.backend = "hash"
        self._model = None
        self._load_backend()

    def _load_backend(self) -> None:
        try:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.model_name)
            self.backend = "sentence-transformers"
            # Keep dimensions aligned with real model output if available.
            dim = self._model.get_sentence_embedding_dimension()
            if isinstance(dim, int) and dim > 0:
                self.dimensions = dim
        except Exception:
            self._model = None
            self.backend = "hash"

    def _hash_encode(self, text: str) -> List[float]:
        vector = [0.0] * self.dimensions
        for token in text.lower().split():
            digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
            bucket = int(digest[:8], 16) % self.dimensions
            sign = 1.0 if int(digest[8:10], 16) % 2 == 0 else -1.0
            vector[bucket] += sign
        norm = sum(v * v for v in vector) ** 0.5 or 1.0
        return [v / norm for v in vector]

    def encode(self, text: str) -> List[float]:
        if self._model is None:
            return self._hash_encode(text)
        vec = self._model.encode(text, normalize_embeddings=True)
        return vec.tolist() if hasattr(vec, "tolist") else list(vec)

    def encode_batch(self, texts: Sequence[str]) -> np.ndarray:
        if not texts:
            return np.empty((0, self.dimensions), dtype=np.float32)
        if self._model is None:
            rows = [self._hash_encode(text) for text in texts]
            return np.asarray(rows, dtype=np.float32)
        vecs = self._model.encode(list(texts), normalize_embeddings=True)
        return np.asarray(vecs, dtype=np.float32)

