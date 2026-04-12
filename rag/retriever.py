from typing import Dict, List, Sequence, Tuple

import numpy as np
from rag.embedding import EmbeddingModel


class Retriever:
    """Retriever with FAISS/Chroma support and in-memory fallback."""

    def __init__(
        self,
        embedding_model: EmbeddingModel | None = None,
        backend: str = "faiss",
        collection_name: str = "srs_kb",
    ) -> None:
        self.embedding_model = embedding_model or EmbeddingModel()
        self.backend = backend
        self.collection_name = collection_name
        self._index: List[Tuple[dict, List[float]]] = []
        self._documents: List[dict] = []
        self._faiss_index = None
        self._chroma_collection = None

    def build_index(self, documents: Sequence[Dict[str, str]]) -> None:
        self._documents = list(documents)
        texts = [doc.get("text", "") for doc in self._documents]
        embeddings = self.embedding_model.encode_batch(texts)

        if self.backend == "chroma" and self._build_chroma_index(embeddings):
            return
        if self._build_faiss_index(embeddings):
            return
        self._build_memory_index(embeddings)

    def retrieve(self, query: str, top_k: int = 5) -> List[Dict[str, object]]:
        if self._chroma_collection is not None:
            return self._retrieve_chroma(query, top_k)
        if self._faiss_index is not None:
            return self._retrieve_faiss(query, top_k)
        return self._retrieve_memory(query, top_k)

    def _build_chroma_index(self, embeddings: np.ndarray) -> bool:
        if self.backend != "chroma":
            return False
        try:
            import chromadb

            client = chromadb.Client()
            self._chroma_collection = client.get_or_create_collection(name=self.collection_name)
            self._chroma_collection.upsert(
                ids=[doc.get("id", str(i)) for i, doc in enumerate(self._documents)],
                documents=[doc.get("text", "") for doc in self._documents],
                metadatas=[{k: v for k, v in doc.items() if k != "text"} for doc in self._documents],
                embeddings=embeddings.tolist(),
            )
            return True
        except Exception:
            self._chroma_collection = None
            return False

    def _build_faiss_index(self, embeddings: np.ndarray) -> bool:
        try:
            import faiss

            normalized = embeddings.astype(np.float32)
            faiss.normalize_L2(normalized)
            self._faiss_index = faiss.IndexFlatIP(normalized.shape[1])
            self._faiss_index.add(normalized)
            return True
        except Exception:
            self._faiss_index = None
            return False

    def _build_memory_index(self, embeddings: np.ndarray) -> None:
        self._index = []
        for doc, emb in zip(self._documents, embeddings):
            self._index.append((doc, emb.tolist()))

    def _retrieve_chroma(self, query: str, top_k: int) -> List[Dict[str, object]]:
        query_embedding = self.embedding_model.encode(query)
        result = self._chroma_collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
        )
        documents = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]
        output: List[Dict[str, object]] = []
        for text, metadata, distance in zip(documents, metadatas, distances):
            doc = dict(metadata or {})
            doc["text"] = text
            output.append({"score": float(1.0 - distance), "document": doc})
        return output

    def _retrieve_faiss(self, query: str, top_k: int) -> List[Dict[str, object]]:
        import faiss

        query_vec = np.asarray([self.embedding_model.encode(query)], dtype=np.float32)
        faiss.normalize_L2(query_vec)
        scores, indices = self._faiss_index.search(query_vec, top_k)
        output: List[Dict[str, object]] = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self._documents):
                continue
            output.append({"score": float(score), "document": self._documents[idx]})
        return output

    def _retrieve_memory(self, query: str, top_k: int) -> List[Dict[str, object]]:
        query_vec = self.embedding_model.encode(query)
        scored: List[Tuple[float, dict]] = []
        for doc, doc_vec in self._index:
            score = sum(a * b for a, b in zip(query_vec, doc_vec))
            scored.append((score, doc))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [{"score": score, "document": doc} for score, doc in scored[:top_k]]

