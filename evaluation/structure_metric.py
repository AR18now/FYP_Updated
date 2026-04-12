from typing import Dict, List


class StructureMetric:
    """Checks IEEE heading structure and order consistency."""

    EXPECTED_ORDER = [
        "introduction",
        "overall_description",
        "specific_requirements",
    ]

    def score(self, srs_input) -> float:
        """
        If dict sections are given, evaluate top-level presence + order.
        If markdown/text is given, evaluate heading tokens.
        """
        if isinstance(srs_input, dict):
            return self._score_from_sections(srs_input)
        if isinstance(srs_input, str):
            return self._score_from_text(srs_input)
        return 0.0

    def _score_from_sections(self, sections: Dict) -> float:
        keys = list(sections.keys())
        present_flags = [1 if key in sections else 0 for key in self.EXPECTED_ORDER]
        presence_score = sum(present_flags) / len(self.EXPECTED_ORDER)
        order_score = self._order_score(keys)
        return round((presence_score * 0.6) + (order_score * 0.4), 3)

    def _score_from_text(self, text: str) -> float:
        lowered = text.lower()
        tokens = ["introduction", "overall description", "specific requirements"]
        positions: List[int] = []
        present = 0
        for token in tokens:
            idx = lowered.find(token)
            if idx >= 0:
                present += 1
                positions.append(idx)
            else:
                positions.append(-1)
        presence_score = present / len(tokens)
        valid_positions = [pos for pos in positions if pos >= 0]
        order_score = 1.0 if valid_positions == sorted(valid_positions) else 0.0
        return round((presence_score * 0.6) + (order_score * 0.4), 3)

    def _order_score(self, keys: List[str]) -> float:
        index_map = {key: idx for idx, key in enumerate(keys)}
        seq = [index_map.get(item) for item in self.EXPECTED_ORDER if item in index_map]
        if len(seq) <= 1:
            return 1.0 if seq else 0.0
        return 1.0 if seq == sorted(seq) else 0.0

