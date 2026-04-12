import re
from typing import Any, Dict, List


class ProfessionalStyleMetric:
    """
    Heuristic professional-writing check for generated SRS text.
    """

    INFORMAL_PATTERNS = [
        r"\b(gonna|wanna|kinda|sorta)\b",
        r"\b(etc\.)\b",
        r"\b(and so on)\b",
        r"\b(i think|we think)\b",
        r"\b(super|very very)\b",
        r"[!]{2,}",
    ]

    FIRST_PERSON_PATTERNS = [
        r"\b(i|we|our|us)\b",
        r"\b(let's)\b",
    ]

    def analyze(self, srs_text: str, srs_sections: Dict[str, Any] | None = None) -> Dict[str, Any]:
        text = (srs_text or "").strip()
        issues: List[str] = []
        if not text:
            return {"score": 0.0, "issues": ["Generated SRS text is empty."]}

        lowered = text.lower()
        informal_hits = 0
        for pattern in self.INFORMAL_PATTERNS:
            hits = re.findall(pattern, lowered, flags=re.IGNORECASE)
            informal_hits += len(hits)
            if hits:
                issues.append(f"Informal wording detected: pattern '{pattern}'")

        first_person_hits = 0
        for pattern in self.FIRST_PERSON_PATTERNS:
            hits = re.findall(pattern, lowered, flags=re.IGNORECASE)
            first_person_hits += len(hits)
            if hits:
                issues.append(f"First-person wording detected: pattern '{pattern}'")

        markdown_markers = len(re.findall(r"```|^#+\s", text, flags=re.MULTILINE))
        if markdown_markers:
            issues.append("Markdown artifacts detected in SRS output.")

        penalties = min(0.5, informal_hits * 0.04) + min(0.3, first_person_hits * 0.03) + min(0.2, markdown_markers * 0.05)
        score = round(max(0.0, 1.0 - penalties), 3)
        return {"score": score, "issues": issues[:30]}

    def score(self, srs_text: str, srs_sections: Dict[str, Any] | None = None) -> float:
        return float(self.analyze(srs_text, srs_sections)["score"])

