from typing import Dict


class CompletenessMetric:
    """Checks presence of IEEE 830 section blocks and computes coverage."""

    REQUIRED_SECTIONS = (
        "introduction.purpose",
        "introduction.scope",
        "introduction.definitions",
        "introduction.overview",
        "overall_description.product_perspective",
        "overall_description.product_functions",
        "overall_description.user_characteristics",
        "overall_description.constraints",
        "specific_requirements.functional_requirements",
        "specific_requirements.software_system_attributes",
        "specific_requirements.external_interface_requirements",
    )

    def score(self, sections: Dict) -> float:
        """Score = Present Sections / Total Sections."""
        present = 0
        for path in self.REQUIRED_SECTIONS:
            value = self._get_nested(sections, path)
            if self._is_present(value):
                present += 1
        return round(present / len(self.REQUIRED_SECTIONS), 3)

    def _get_nested(self, data: Dict, path: str):
        current = data
        for part in path.split("."):
            if not isinstance(current, dict) or part not in current:
                return None
            current = current[part]
        return current

    def _is_present(self, value) -> bool:
        if value is None:
            return False
        if isinstance(value, str):
            return bool(value.strip())
        if isinstance(value, (list, dict, tuple, set)):
            return len(value) > 0
        return True

