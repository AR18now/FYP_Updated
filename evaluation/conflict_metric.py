import re
from typing import Dict, List, Tuple


class ConflictMetric:
    """
    Detect contradictory requirement statements and provide a normalized score.

    The detector is heuristic-based so it is deterministic and demo-friendly.
    """

    CONFLICT_PAIRS: List[Tuple[str, str]] = [
        ("enable", "disable"),
        ("allow", "prevent"),
        ("require", "optional"),
        ("always", "never"),
        ("must", "must not"),
        ("encrypt", "plaintext"),
        ("online", "offline"),
        ("public", "private"),
        ("manual", "automatic"),
    ]

    def analyze(self, source_text: str) -> Dict[str, object]:
        text = (source_text or "").lower()
        if not text.strip():
            return {
                "score": 1.0,
                "conflict_count": 0,
                "conflicts": [],
            }

        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", text) if s.strip()]
        conflicts = []

        # Sentence-level conflict checks.
        for idx, sentence in enumerate(sentences, start=1):
            for left, right in self.CONFLICT_PAIRS:
                left_found = re.search(rf"\b{re.escape(left)}\b", sentence)
                right_found = re.search(rf"\b{re.escape(right)}\b", sentence)
                if left_found and right_found:
                    conflicts.append(
                        {
                            "type": "intra_sentence_conflict",
                            "pair": [left, right],
                            "sentence_index": idx,
                            "sentence": sentence,
                        }
                    )

        # Cross-sentence conflicts: same action area with opposite terms.
        for i, s1 in enumerate(sentences):
            for j, s2 in enumerate(sentences):
                if j <= i:
                    continue
                for left, right in self.CONFLICT_PAIRS:
                    if re.search(rf"\b{re.escape(left)}\b", s1) and re.search(rf"\b{re.escape(right)}\b", s2):
                        if self._has_topic_overlap(s1, s2):
                            conflicts.append(
                                {
                                    "type": "cross_sentence_conflict",
                                    "pair": [left, right],
                                    "sentence_a_index": i + 1,
                                    "sentence_b_index": j + 1,
                                    "sentence_a": s1,
                                    "sentence_b": s2,
                                }
                            )

        conflict_count = len(conflicts)
        # Penalize gently: still useful as a soft metric.
        score = max(0.0, round(1.0 - min(0.8, conflict_count * 0.15), 3))
        return {
            "score": score,
            "conflict_count": conflict_count,
            "conflicts": conflicts[:25],  # keep payload bounded
        }

    def score(self, source_text: str) -> float:
        return float(self.analyze(source_text)["score"])

    def _has_topic_overlap(self, s1: str, s2: str) -> bool:
        tokens_1 = {t for t in re.findall(r"\b[a-z]{4,}\b", s1) if t not in {"shall", "must", "should"}}
        tokens_2 = {t for t in re.findall(r"\b[a-z]{4,}\b", s2) if t not in {"shall", "must", "should"}}
        return len(tokens_1.intersection(tokens_2)) >= 1

