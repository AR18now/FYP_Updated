import re
from typing import Dict

from input_processing.ambiguity_detection import AmbiguityDetector


class AmbiguityMetric:
    """Penalizes vague/ambiguous wording in generated SRS text."""

    def __init__(self) -> None:
        self.detector = AmbiguityDetector()

    def score(self, srs_text: str) -> float:
        words = re.findall(r"\b\w+\b", srs_text or "")
        total_words = max(len(words), 1)
        ambiguous_count = len(self.detector.detect(srs_text or ""))
        return round(max(0.0, 1.0 - (ambiguous_count / total_words)), 3)

    def details(self, srs_text: str) -> Dict[str, int]:
        words = re.findall(r"\b\w+\b", srs_text or "")
        ambiguities = self.detector.detect(srs_text or "")
        return {"total_words": len(words), "ambiguous_words": len(ambiguities)}

