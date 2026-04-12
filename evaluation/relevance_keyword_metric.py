import re
from typing import List, Sequence


class RelevanceKeywordMetric:
    """
    Relevance by domain keyword coverage in generated SRS.
    """

    def score(self, srs_text: str, domain_keywords: Sequence[str]) -> float:
        keywords = [k.strip().lower() for k in domain_keywords if str(k).strip()]
        if not keywords:
            return 0.0
        lowered = (srs_text or "").lower()
        hits = sum(1 for k in keywords if re.search(rf"\b{re.escape(k)}\b", lowered))
        return round(hits / len(keywords), 3)

    def infer_keywords_from_text(self, source_text: str, max_keywords: int = 8) -> List[str]:
        """
        Basic fallback keyword inference if user does not supply domain keywords.
        """
        stop = {
            "the",
            "and",
            "for",
            "with",
            "that",
            "this",
            "from",
            "shall",
            "must",
            "system",
            "user",
            "users",
            "application",
        }
        tokens = re.findall(r"[a-zA-Z]{4,}", (source_text or "").lower())
        freq = {}
        for token in tokens:
            if token in stop:
                continue
            freq[token] = freq.get(token, 0) + 1
        ranked = sorted(freq.items(), key=lambda x: x[1], reverse=True)
        return [w for w, _ in ranked[:max_keywords]]

