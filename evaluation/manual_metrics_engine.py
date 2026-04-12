from typing import Any, Dict, List, Sequence

from evaluation.ambiguity_metric import AmbiguityMetric
from evaluation.clarity_readability_metric import ClarityReadabilityMetric
from evaluation.completeness_count_metric import CompletenessCountMetric
from evaluation.conflict_metric import ConflictMetric
from evaluation.consistency_metric import ConsistencyMetric
from evaluation.nfr_specificity_metric import NFRSpecificityMetric
from evaluation.professional_style_metric import ProfessionalStyleMetric
from evaluation.relevance_keyword_metric import RelevanceKeywordMetric
from evaluation.testability_metric import TestabilityMetric


class ManualMetricsEngine:
    """
    Implements the exact custom metric set:
    - clarity (sentence readability)
    - ambiguity (vague terms)
    - testability (numeric NFRs)
    - completeness (FR+NFR count)
    - consistency (FR >= Actors)
    - relevance (domain keyword match)
    """

    def __init__(self) -> None:
        self.clarity_metric = ClarityReadabilityMetric()
        self.ambiguity_metric = AmbiguityMetric()
        self.testability_metric = TestabilityMetric()
        self.completeness_metric = CompletenessCountMetric()
        self.consistency_metric = ConsistencyMetric()
        self.conflict_metric = ConflictMetric()
        self.nfr_specificity_metric = NFRSpecificityMetric()
        self.professional_style_metric = ProfessionalStyleMetric()
        self.relevance_metric = RelevanceKeywordMetric()

    def evaluate(
        self,
        source_requirements_text: str,
        structured_requirements: Dict[str, Any],
        srs_sections: Dict[str, Any],
        srs_text: str,
        domain_keywords: Sequence[str] | None = None,
    ) -> Dict[str, float]:
        keywords: List[str] = list(domain_keywords) if domain_keywords else self.relevance_metric.infer_keywords_from_text(source_requirements_text)
        return {
            "clarity": self.clarity_metric.score(srs_text),
            "ambiguity": self.ambiguity_metric.score(srs_text),
            "testability": self.testability_metric.score(structured_requirements, srs_sections),
            "completeness": self.completeness_metric.score(structured_requirements),
            "consistency": self.consistency_metric.score(structured_requirements, source_requirements_text),
            "conflict_score": self.conflict_metric.score(source_requirements_text),
            "nfr_specificity": self.nfr_specificity_metric.score(source_requirements_text, srs_sections),
            "professional_style": self.professional_style_metric.score(srs_text, srs_sections),
            "relevance": self.relevance_metric.score(srs_text, keywords),
        }

