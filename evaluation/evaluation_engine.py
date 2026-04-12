from typing import Dict

from evaluation.clarity_metric import ClarityMetric
from evaluation.completeness_metric import CompletenessMetric
from evaluation.relevance_metric import RelevanceMetric
from evaluation.structure_metric import StructureMetric


class SRSEvaluationEngine:
    """Runs all requested SRS quality metrics and returns normalized scores."""

    def __init__(self) -> None:
        self.completeness_metric = CompletenessMetric()
        self.clarity_metric = ClarityMetric()
        self.structure_metric = StructureMetric()
        self.relevance_metric = RelevanceMetric()

    def evaluate(self, user_requirements: str, srs_sections: Dict, srs_text: str) -> Dict[str, float]:
        return {
            "completeness": self.completeness_metric.score(srs_sections),
            "clarity": self.clarity_metric.score(srs_text),
            "structure": self.structure_metric.score(srs_sections),
            "relevance": self.relevance_metric.score(user_requirements, srs_text),
        }

