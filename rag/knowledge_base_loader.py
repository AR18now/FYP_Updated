import json
from pathlib import Path
from typing import Dict, List


class KnowledgeBaseLoader:
    """Loads and chunks KB documents for RAG retrieval."""

    def load(self, source_path: str, chunk_size: int = 1200, overlap: int = 200) -> List[Dict[str, str]]:
        path = Path(source_path)
        if not path.exists():
            return []

        if path.is_file():
            return self._chunk_documents(self._load_file(path), chunk_size, overlap)

        documents: List[Dict[str, str]] = []
        for file_path in path.rglob("*"):
            if file_path.is_file() and file_path.suffix.lower() in {".txt", ".md", ".json"}:
                documents.extend(self._load_file(file_path))
        return self._chunk_documents(documents, chunk_size, overlap)

    def _load_file(self, path: Path) -> List[Dict[str, str]]:
        source_type = self._infer_source_type(path)
        if path.suffix.lower() == ".json":
            with path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
            if isinstance(payload, list):
                return [
                    {
                        "id": f"{path.name}:{idx}",
                        "text": str(item),
                        "source_file": str(path),
                        "source_type": source_type,
                    }
                    for idx, item in enumerate(payload)
                ]
            return [
                {
                    "id": path.name,
                    "text": json.dumps(payload, ensure_ascii=False),
                    "source_file": str(path),
                    "source_type": source_type,
                }
            ]

        with path.open("r", encoding="utf-8", errors="ignore") as handle:
            text = handle.read()
        return [
            {
                "id": path.name,
                "text": text,
                "source_file": str(path),
                "source_type": source_type,
            }
        ]

    def _chunk_documents(self, docs: List[Dict[str, str]], chunk_size: int, overlap: int) -> List[Dict[str, str]]:
        chunks: List[Dict[str, str]] = []
        for doc in docs:
            text = doc.get("text", "")
            if not text:
                continue
            start = 0
            index = 0
            while start < len(text):
                end = min(len(text), start + chunk_size)
                chunk_text = text[start:end].strip()
                if chunk_text:
                    chunk = dict(doc)
                    chunk["id"] = f"{doc.get('id', 'doc')}#chunk-{index}"
                    chunk["text"] = chunk_text
                    chunks.append(chunk)
                if end >= len(text):
                    break
                start = max(0, end - overlap)
                index += 1
        return chunks

    def _infer_source_type(self, path: Path) -> str:
        name = path.name.lower()
        text = str(path).lower()
        if "ieee" in name or "template" in name or "template" in text:
            return "ieee_830_template"
        if "sample" in name or "example" in name:
            return "sample_srs"
        if "guideline" in name or "guide" in name or "requirements_engineering" in text:
            return "re_guideline"
        return "knowledge_base"

