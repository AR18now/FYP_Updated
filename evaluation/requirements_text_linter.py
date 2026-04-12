import re
from typing import Dict, List


class RequirementsTextLinter:
    """
    Heuristic linting over requirement text: imperative phrasing, weak wording, optionality,
    continuance phrases, figure/table references, incomplete markers, and vague adjectives.
    Returns normalized scores and raw counts (metric keys remain arm_* for compatibility with the KB evaluator).
    """

    WEAK_PHRASES = [
        "adequate",
        "as applicable",
        "as appropriate",
        "be able to",
        "easy",
        "efficient",
        "flexible",
        "as needed",
        "etc",
        "and/or",
        "user-friendly",
        "quickly",
        "soon",
    ]
    OPTIONS = ["may", "can", "could", "optionally", "optional"]
    CONTINUANCES = ["following", "listed below", "as follows"]
    DIRECTIVES = ["figure", "table", "note:"]
    INCOMPLETE = ["tbd", "tbs", "to be determined", "to be specified", "xxx"]
    AMBIGUOUS = ["fast", "robust", "minimal", "approximately", "often", "sometimes"]

    def analyze(self, text: str, requirement_lines: List[str]) -> Dict[str, float]:
        lowered = (text or "").lower()
        total_reqs = max(len(requirement_lines), 1)

        imperative_count = sum(
            1 for line in requirement_lines if re.search(r"\b(shall|must|required to)\b", line.lower())
        )
        weak_count = self._count_tokens(lowered, self.WEAK_PHRASES)
        option_count = self._count_tokens(lowered, self.OPTIONS)
        continuance_count = self._count_tokens(lowered, self.CONTINUANCES)
        directive_count = self._count_tokens(lowered, self.DIRECTIVES)
        incomplete_count = self._count_tokens(lowered, self.INCOMPLETE)
        ambiguity_count = self._count_tokens(lowered, self.AMBIGUOUS)

        imperative_quality = min(1.0, imperative_count / total_reqs)
        weak_quality = max(0.0, 1.0 - (weak_count / total_reqs))
        option_quality = max(0.0, 1.0 - (option_count / total_reqs))
        continuance_quality = max(0.0, 1.0 - (continuance_count / total_reqs))
        directive_quality = max(0.0, 1.0 - (directive_count / total_reqs))
        incomplete_quality = max(0.0, 1.0 - (incomplete_count / total_reqs))
        ambiguity_quality = max(0.0, 1.0 - (ambiguity_count / total_reqs))

        overall = (
            0.24 * imperative_quality
            + 0.16 * weak_quality
            + 0.12 * option_quality
            + 0.10 * continuance_quality
            + 0.08 * directive_quality
            + 0.15 * incomplete_quality
            + 0.15 * ambiguity_quality
        )

        return {
            "arm_imperative_quality": round(imperative_quality, 3),
            "arm_weak_phrase_quality": round(weak_quality, 3),
            "arm_optionality_quality": round(option_quality, 3),
            "arm_continuance_quality": round(continuance_quality, 3),
            "arm_directive_quality": round(directive_quality, 3),
            "arm_incomplete_quality": round(incomplete_quality, 3),
            "arm_ambiguity_quality": round(ambiguity_quality, 3),
            "arm_overall_score": round(max(0.0, min(1.0, overall)), 3),
            "arm_imperative_count": imperative_count,
            "arm_weak_phrase_count": weak_count,
            "arm_option_count": option_count,
            "arm_continuance_count": continuance_count,
            "arm_directive_count": directive_count,
            "arm_incomplete_count": incomplete_count,
            "arm_ambiguity_count": ambiguity_count,
        }

    def _count_tokens(self, text: str, tokens: List[str]) -> int:
        count = 0
        for token in tokens:
            if " " in token or "/" in token or ":" in token:
                count += text.count(token)
            else:
                count += len(re.findall(rf"\b{re.escape(token)}\b", text))
        return count
