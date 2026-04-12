from typing import Any, Dict


class CompletenessCountMetric:
    """
    Completeness based on count of FR + NFR.
    Rule-of-thumb target: 10 total (e.g., 5 FR + 5 NFR).
    """

    def score(self, structured_requirements: Dict[str, Any]) -> float:
        fr_count = len(structured_requirements.get("functional_requirements", []))
        nfr_count = len(structured_requirements.get("non_functional_requirements", []))
        total = fr_count + nfr_count
        return round(min(1.0, total / 10.0), 3)

