import re
from typing import Dict, List, Tuple


class AmbiguityDetector:
    """Dictionary-based + rule-based ambiguity detector for requirements."""

    def __init__(self) -> None:
        # Dictionary-based ambiguous words/phrases and recommended measurable replacements.
        self.ambiguous_dictionary: Dict[str, Dict[str, str]] = {
            "fast": {
                "category": "performance",
                "replacement": "respond within 2 seconds for 95% of requests",
            },
            "efficient": {
                "category": "performance",
                "replacement": "use less than 70% CPU under normal load",
            },
            "user-friendly": {
                "category": "usability",
                "replacement": "allow a new user to complete core tasks in under 3 minutes",
            },
            "user friendly": {
                "category": "usability",
                "replacement": "provide an intuitive interface with task completion in under 3 minutes",
            },
            "robust": {
                "category": "reliability",
                "replacement": "recover from failures within 30 seconds without data loss",
            },
            "scalable": {
                "category": "scalability",
                "replacement": "support 10,000 concurrent users with response time under 2 seconds",
            },
            "minimal": {
                "category": "size",
                "replacement": "use less than 200 MB of memory",
            },
            "quickly": {
                "category": "time",
                "replacement": "within 2 seconds",
            },
            "soon": {
                "category": "time",
                "replacement": "within 24 hours",
            },
            "easy": {
                "category": "usability",
                "replacement": "require no more than 3 steps for the main workflow",
            },
            "secure": {
                "category": "security",
                "replacement": "enforce MFA and encrypt data in transit with TLS 1.2+",
            },
        }

        # Rule-based patterns for vague qualifiers and modal uncertainty.
        self.rule_patterns: Dict[str, List[str]] = {
            "vague_quantifier": [
                r"\b(as soon as possible)\b",
                r"\b(when needed)\b",
                r"\b(whenever possible)\b",
                r"\b(as required)\b",
            ],
            "weak_modal": [
                r"\b(should)\b",
                r"\b(could)\b",
                r"\b(might)\b",
                r"\b(may)\b",
            ],
        }

    def detect(self, text: str) -> List[dict]:
        """Detect ambiguous terms and phrases with position/context metadata."""
        if not text:
            return []

        ambiguities: List[dict] = []
        lowered_text = text.lower()

        # Dictionary-based matching (single and multi-word entries).
        for term, meta in self.ambiguous_dictionary.items():
            pattern = re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)
            for match in pattern.finditer(text):
                start, end = match.span()
                context = self._extract_context(text, start, end)
                ambiguities.append(
                    {
                        "word": match.group(0),
                        "normalized_word": term,
                        "category": meta["category"],
                        "context": context,
                        "position": start,
                        "replacement": meta["replacement"],
                        "source": "dictionary",
                    }
                )

        # Rule-based matching.
        for category, patterns in self.rule_patterns.items():
            for pattern_text in patterns:
                pattern = re.compile(pattern_text, re.IGNORECASE)
                for match in pattern.finditer(lowered_text):
                    start, end = match.span()
                    found = text[start:end]
                    context = self._extract_context(text, start, end)
                    ambiguities.append(
                        {
                            "word": found,
                            "normalized_word": found.lower(),
                            "category": category,
                            "context": context,
                            "position": start,
                            "replacement": self._default_replacement(category),
                            "source": "rule",
                        }
                    )

        ambiguities.sort(key=lambda item: item["position"])
        return self._deduplicate(ambiguities)

    def highlight_ambiguous_words(self, text: str, ambiguities: List[dict] | None = None) -> str:
        """
        Highlight ambiguous words by wrapping them with [[...]].
        Example: The system should be [[fast]].
        """
        if not text:
            return ""
        if ambiguities is None:
            ambiguities = self.detect(text)
        if not ambiguities:
            return text

        spans: List[Tuple[int, int]] = []
        for item in ambiguities:
            word = item["word"]
            start_pos = item["position"]
            end_pos = start_pos + len(word)
            spans.append((start_pos, end_pos))

        # Merge overlaps to keep output clean.
        spans.sort(key=lambda s: s[0])
        merged: List[Tuple[int, int]] = []
        for start, end in spans:
            if not merged or start > merged[-1][1]:
                merged.append((start, end))
            else:
                merged[-1] = (merged[-1][0], max(merged[-1][1], end))

        output = []
        cursor = 0
        for start, end in merged:
            output.append(text[cursor:start])
            output.append(f"[[{text[start:end]}]]")
            cursor = end
        output.append(text[cursor:])
        return "".join(output)

    def suggest_improved_requirement(self, text: str, ambiguities: List[dict] | None = None) -> str:
        """Generate a suggestion by replacing ambiguous terms with measurable alternatives."""
        if not text:
            return ""
        if ambiguities is None:
            ambiguities = self.detect(text)
        if not ambiguities:
            return text

        # Replace from right-to-left to preserve indices.
        replacements = sorted(ambiguities, key=lambda item: item["position"], reverse=True)
        improved = text
        for item in replacements:
            start = item["position"]
            end = start + len(item["word"])
            improved = improved[:start] + item["replacement"] + improved[end:]

        improved = re.sub(r"\s{2,}", " ", improved).strip()
        return improved[0].upper() + improved[1:] if improved else improved

    def analyze_requirement(self, text: str) -> Dict[str, object]:
        """Return complete ambiguity analysis payload."""
        ambiguities = self.detect(text)
        return {
            "input_text": text,
            "ambiguous_words": [item["word"] for item in ambiguities],
            "highlighted_text": self.highlight_ambiguous_words(text, ambiguities),
            "suggestion": self.suggest_improved_requirement(text, ambiguities),
            "details": ambiguities,
        }

    def _extract_context(self, text: str, start: int, end: int, window: int = 30) -> str:
        left = max(0, start - window)
        right = min(len(text), end + window)
        return text[left:right].strip()

    def _default_replacement(self, category: str) -> str:
        defaults = {
            "vague_quantifier": "within a defined and agreed timeline",
            "weak_modal": "must",
        }
        return defaults.get(category, "with measurable acceptance criteria")

    def _deduplicate(self, ambiguities: List[dict]) -> List[dict]:
        seen = set()
        unique: List[dict] = []
        for item in ambiguities:
            key = (item["position"], item["normalized_word"])
            if key in seen:
                continue
            seen.add(key)
            unique.append(item)
        return unique

