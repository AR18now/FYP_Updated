import re
from typing import List


class TextCleaner:
    """Normalize and sanitize raw requirements text."""

    def __init__(self, max_length: int = 10000) -> None:
        self.max_length = max_length

    def clean(self, text: str) -> str:
        if not text:
            return ""

        cleaned = text
        cleaned = re.sub(r"```[\s\S]*?```", "", cleaned)
        cleaned = re.sub(r"`[^`]+`", "", cleaned)
        cleaned = re.sub(r"<[^>]+>", "", cleaned)
        cleaned = re.sub(r"<\|.*?\|>", "", cleaned)
        cleaned = re.sub(r"\[INST\].*?\[/INST\]", "", cleaned, flags=re.DOTALL | re.IGNORECASE)
        cleaned = re.sub(r"<\|im_start\|>.*?<\|im_end\|>", "", cleaned, flags=re.DOTALL | re.IGNORECASE)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)

        if len(cleaned) > self.max_length:
            cleaned = cleaned[: self.max_length].rsplit(" ", 1)[0]

        return cleaned.strip()

    def split_sentences(self, text: str) -> List[str]:
        cleaned = self.clean(text)
        if not cleaned:
            return []
        return [segment.strip() for segment in re.split(r"(?<=[.!?])\s+", cleaned) if segment.strip()]

