import re


class ClarityReadabilityMetric:
    """
    Clarity based on sentence length and readability heuristics.
    Short, clear sentences score higher.
    """

    def score(self, srs_text: str) -> float:
        text = srs_text or ""
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
        if not sentences:
            return 0.0

        lengths = [len(re.findall(r"\b\w+\b", s)) for s in sentences]
        avg_len = sum(lengths) / len(lengths)
        long_ratio = sum(1 for n in lengths if n > 25) / len(lengths)

        # Ideal avg sentence length is around 12-20 words.
        if avg_len < 8:
            avg_component = 0.7
        elif avg_len <= 20:
            avg_component = 1.0
        elif avg_len <= 30:
            avg_component = 0.7
        else:
            avg_component = 0.4

        long_component = max(0.0, 1.0 - long_ratio)
        score = (0.6 * avg_component) + (0.4 * long_component)
        return round(max(0.0, min(1.0, score)), 3)

