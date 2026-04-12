import re
from typing import Dict, List, Union

from input_processing.ambiguity_detection import AmbiguityDetector


class ClarityMetric:
    """Counts ambiguous words in SRS text and computes clarity."""

    def __init__(self) -> None:
        self.detector = AmbiguityDetector()

    def score(self, srs_input: Union[str, Dict]) -> float:
        """
        Score = 1 - (Ambiguous Words / Total Words)
        Accepts either full SRS text or dict payload with `cleaned_text`.
        """
        text = self._extract_text(srs_input)
        words = re.findall(r"\b\w+\b", text)
        total_words = max(len(words), 1)
        ambiguous_count = len(self.detector.detect(text))
        value = 1.0 - (ambiguous_count / total_words)
        return round(max(0.0, min(1.0, value)), 3)

    def count_ambiguous_words(self, srs_input: Union[str, Dict]) -> int:
        text = self._extract_text(srs_input)
        return len(self.detector.detect(text))

    def _extract_text(self, srs_input: Union[str, Dict]) -> str:
        if isinstance(srs_input, str):
            return srs_input
        if isinstance(srs_input, dict):
            if "cleaned_text" in srs_input:
                return str(srs_input.get("cleaned_text", ""))
            if "raw_text" in srs_input:
                return str(srs_input.get("raw_text", ""))
            if "sections" in srs_input:
                return self._flatten_sections(srs_input.get("sections", {}))
        return ""

    def _flatten_sections(self, sections: Dict) -> str:
        buffer: List[str] = []

        def walk(node):
            if isinstance(node, dict):
                for _, value in node.items():
                    walk(value)
            elif isinstance(node, list):
                for item in node:
                    walk(item)
            else:
                text = str(node).strip()
                if text:
                    buffer.append(text)

        walk(sections)
        return "\n".join(buffer)

