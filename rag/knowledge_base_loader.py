import json
import re
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
                out: List[Dict[str, str]] = []
                for idx, item in enumerate(payload):
                    raw_text = str(item)
                    cleaned, sec = self._sanitize_kb_text(raw_text)
                    out.append(
                        {
                            "id": f"{path.name}:{idx}",
                            "text": cleaned,
                            "source_file": str(path),
                            "source_type": source_type,
                            "security_flags": sec,
                        }
                    )
                return out
            raw_text = json.dumps(payload, ensure_ascii=False)
            cleaned, sec = self._sanitize_kb_text(raw_text)
            return [
                {
                    "id": path.name,
                    "text": cleaned,
                    "source_file": str(path),
                    "source_type": source_type,
                    "security_flags": sec,
                }
            ]

        with path.open("r", encoding="utf-8", errors="ignore") as handle:
            text = handle.read()
        cleaned, sec = self._sanitize_kb_text(text)
        return [
            {
                "id": path.name,
                "text": cleaned,
                "source_file": str(path),
                "source_type": source_type,
                "security_flags": sec,
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
        if "final_extracted_srs_ieee830" in text:
            return "ieee830_extracted_corpus"
        if "ieee" in name or "template" in name or "template" in text:
            return "ieee_830_template"
        if "sample" in name or "example" in name:
            return "sample_srs"
        if "guideline" in name or "guide" in name or "requirements_engineering" in text:
            return "re_guideline"
        return "knowledge_base"

    def _sanitize_kb_text(self, text: str) -> tuple[str, Dict[str, object]]:
        """
        Treat KB content as untrusted. Strip known control-token patterns and score
        prompt-injection likelihood for retrieval-time filtering downstream.
        """
        raw = str(text or "")
        lowered = raw.lower()
        suspicious_patterns = [
            r"\bignore\s+(?:all\s+)?previous\s+instructions?\b",
            r"\bdisregard\s+(?:all\s+)?(?:previous\s+)?instructions?\b",
            r"\bforget\s+all\s+(?:previous\s+)?instructions?\b",
            r"\bact\s+as\b",
            r"\bpretend\s+to\s+be\b",
            r"\broleplay\s+as\b",
            r"<\|[^|]+\|>",
            r"\[inst\].*?\[/inst\]",
            r"<\|im_start\|>.*?<\|im_end\|>",
        ]
        hits = [p for p in suspicious_patterns if re.search(p, lowered, flags=re.IGNORECASE | re.DOTALL)]

        cleaned = raw
        cleaned = re.sub(r"<\|.*?\|>", " ", cleaned)
        cleaned = re.sub(r"\[INST\].*?\[/INST\]", " ", cleaned, flags=re.IGNORECASE | re.DOTALL)
        cleaned = re.sub(r"<\|im_start\|>.*?<\|im_end\|>", " ", cleaned, flags=re.IGNORECASE | re.DOTALL)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        cleaned = re.sub(r"[ \t]{3,}", " ", cleaned).strip()

        score = min(1.0, len(hits) / 3.0)
        return cleaned, {"pii_risk": "unknown", "prompt_injection_hits": hits, "injection_risk_score": score}

