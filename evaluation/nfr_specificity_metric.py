import re
from typing import Any, Dict, List

from evaluation.relevance_keyword_metric import RelevanceKeywordMetric


class NFRSpecificityMetric:
    """
    Evaluates whether non-functional requirements are domain-specific and measurable.
    """

    NUMERIC_PATTERN = re.compile(
        r"\b\d+(\.\d+)?\b|<\s*\d+|>\s*\d+|<=\s*\d+|>=\s*\d+|%|seconds?|ms|minutes?|hours?|uptime",
        re.IGNORECASE,
    )

    def __init__(self) -> None:
        self.keyword_metric = RelevanceKeywordMetric()

    def analyze(self, source_requirements_text: str, srs_sections: Dict[str, Any]) -> Dict[str, Any]:
        nfrs = self._extract_nfr_texts(srs_sections)
        if not nfrs:
            return {
                "score": 0.0,
                "nfr_count": 0,
                "measurable_count": 0,
                "domain_specific_count": 0,
                "issues": ["No NFR entries detected in generated SRS."],
            }

        domain_keywords = self.keyword_metric.infer_keywords_from_text(source_requirements_text, max_keywords=10)
        measurable_count = 0
        domain_specific_count = 0
        issues: List[str] = []

        for idx, nfr in enumerate(nfrs, start=1):
            measurable = bool(self.NUMERIC_PATTERN.search(nfr))
            domain_specific = any(
                re.search(rf"\b{re.escape(keyword)}\b", nfr, flags=re.IGNORECASE)
                for keyword in domain_keywords
            )
            if measurable:
                measurable_count += 1
            else:
                issues.append(f"NFR-{idx} is not measurable: '{nfr[:120]}'")
            if domain_specific:
                domain_specific_count += 1
            else:
                issues.append(f"NFR-{idx} may be generic and not domain-specific: '{nfr[:120]}'")

        measurability_ratio = measurable_count / len(nfrs)
        domain_ratio = domain_specific_count / len(nfrs)
        score = round((0.6 * measurability_ratio) + (0.4 * domain_ratio), 3)

        return {
            "score": score,
            "nfr_count": len(nfrs),
            "measurable_count": measurable_count,
            "domain_specific_count": domain_specific_count,
            "domain_keywords": domain_keywords,
            "issues": issues[:30],
        }

    def score(self, source_requirements_text: str, srs_sections: Dict[str, Any]) -> float:
        return float(self.analyze(source_requirements_text, srs_sections)["score"])

    def _extract_nfr_texts(self, srs_sections: Dict[str, Any]) -> List[str]:
        texts: List[str] = []
        attrs = srs_sections.get("specific_requirements", {}).get("software_system_attributes", {})
        if isinstance(attrs, dict):
            for value in attrs.values():
                value_text = str(value or "").strip()
                if value_text:
                    texts.append(value_text)

        performance = srs_sections.get("specific_requirements", {}).get("performance_requirements", {})
        if isinstance(performance, dict):
            for value in performance.values():
                value_text = str(value or "").strip()
                if value_text:
                    texts.append(value_text)
        return texts

