import re
from typing import Any, Dict, Set


class ConsistencyMetric:
    """
    Consistency rule: FR >= Actors.
    Interprets actors from user/system requirements and explicit role terms.
    """

    ACTOR_WORDS = {"user", "admin", "administrator", "operator", "manager", "customer", "staff"}

    def score(self, structured_requirements: Dict[str, Any], source_text: str) -> float:
        fr_count = len(structured_requirements.get("functional_requirements", []))
        actors = self._extract_actors(structured_requirements, source_text)
        actor_count = len(actors)
        if actor_count == 0:
            return 1.0 if fr_count > 0 else 0.0
        return round(min(1.0, fr_count / actor_count), 3)

    def _extract_actors(self, structured_requirements: Dict[str, Any], source_text: str) -> Set[str]:
        actors: Set[str] = set()

        def scan_text(text: str) -> None:
            lowered = (text or "").lower()
            for word in self.ACTOR_WORDS:
                if re.search(rf"\b{re.escape(word)}s?\b", lowered):
                    actors.add(word)

        for bucket in ("user_requirements", "system_requirements", "functional_requirements"):
            for item in structured_requirements.get(bucket, []):
                if isinstance(item, dict):
                    scan_text(str(item.get("refined_text") or item.get("source_text") or ""))
                else:
                    scan_text(str(item))
        scan_text(source_text)
        return actors

