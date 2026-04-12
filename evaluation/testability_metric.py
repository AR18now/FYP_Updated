import re
from typing import Any, Dict, List


class TestabilityMetric:
    """
    Checks if NFRs are measurable by containing numeric constraints.
    Example good: 'response time < 2 seconds'
    """

    NUMERIC_PATTERN = re.compile(r"\b\d+(\.\d+)?\b|<\s*\d+|>\s*\d+|<=\s*\d+|>=\s*\d+|%")

    def score(self, structured_requirements: Dict[str, Any], srs_sections: Dict[str, Any]) -> float:
        nfr_texts = self._extract_nfr_texts(structured_requirements, srs_sections)
        if not nfr_texts:
            return 0.0
        measurable = sum(1 for t in nfr_texts if self.NUMERIC_PATTERN.search(t))
        return round(measurable / len(nfr_texts), 3)

    def _extract_nfr_texts(self, structured_requirements: Dict[str, Any], srs_sections: Dict[str, Any]) -> List[str]:
        texts: List[str] = []

        for item in structured_requirements.get("non_functional_requirements", []):
            if isinstance(item, dict):
                val = item.get("refined_text") or item.get("source_text") or ""
            else:
                val = str(item)
            if str(val).strip():
                texts.append(str(val).strip())

        attrs = srs_sections.get("specific_requirements", {}).get("software_system_attributes", {})
        if isinstance(attrs, dict):
            for _, value in attrs.items():
                if str(value).strip():
                    texts.append(str(value).strip())

        return texts

