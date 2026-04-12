import json
import re
from typing import Dict, List, Optional

from input_processing.ambiguity_detection import AmbiguityDetector
from input_processing.text_cleaning import TextCleaner


class RequirementRefiner:
    """Refines vague requirements into structured and classified JSON output."""

    def __init__(self) -> None:
        self.cleaner = TextCleaner()
        self.ambiguity_detector = AmbiguityDetector()
        self.classification_keywords = {
            "functional_requirements": [
                "shall",
                "must",
                "allow",
                "enable",
                "create",
                "update",
                "delete",
                "search",
                "generate",
                "process",
                "authenticate",
            ],
            "non_functional_requirements": [
                "performance",
                "latency",
                "response time",
                "secure",
                "security",
                "availability",
                "reliability",
                "scalable",
                "maintainability",
                "usability",
                "uptime",
                "throughput",
            ],
            "system_requirements": [
                "system",
                "server",
                "database",
                "api",
                "integration",
                "deployment",
                "infrastructure",
                "platform",
                "os",
                "hardware",
            ],
            "user_requirements": [
                "user",
                "customer",
                "admin",
                "stakeholder",
                "operator",
                "end-user",
                "profile",
                "dashboard",
                "login",
                "signup",
            ],
        }

    def refine(self, text: str) -> Dict[str, object]:
        """
        Backward-compatible method used by existing pipeline.
        Adds structured classification to the previous output contract.
        """
        cleaned_text = self.cleaner.clean(text)
        ambiguity_analysis = self.ambiguity_detector.analyze_requirement(cleaned_text)
        ambiguities = ambiguity_analysis.get("details", [])
        questions = self._build_questions(ambiguities)
        structured = self.refine_to_structured_json(cleaned_text)
        return {
            "cleaned_text": cleaned_text,
            "ambiguities": ambiguities,
            "clarification_questions": questions,
            "highlighted_text": ambiguity_analysis.get("highlighted_text", cleaned_text),
            "suggestion": ambiguity_analysis.get("suggestion", cleaned_text),
            "structured_requirements": structured,
        }

    def refine_to_structured_json(self, text: str, use_llm_prompting: bool = False) -> Dict[str, List[Dict[str, str]]]:
        """
        Convert free-form/vague input requirements into structured classes.

        Returns:
            {
              "functional_requirements": [...],
              "non_functional_requirements": [...],
              "user_requirements": [...],
              "system_requirements": [...]
            }
        """
        cleaned_text = self.cleaner.clean(text)
        statements = self._extract_requirement_statements(cleaned_text)

        if use_llm_prompting:
            # Placeholder for optional LLM classification extension.
            # The default implementation remains NLP/rule-based for offline reliability.
            llm_result = self._classify_with_prompt_template(statements)
            if llm_result is not None:
                return llm_result

        output = self._empty_output()
        for index, statement in enumerate(statements, start=1):
            refined_statement = self._to_structured_statement(statement)
            category = self._classify_statement(refined_statement)
            output[category].append(
                {
                    "id": f"{self._prefix_for_category(category)}-{index}",
                    "source_text": statement,
                    "refined_text": refined_statement,
                }
            )
        return output

    def to_json(self, text: str, use_llm_prompting: bool = False) -> str:
        """Return structured requirements as JSON string."""
        payload = self.refine_to_structured_json(text, use_llm_prompting=use_llm_prompting)
        return json.dumps(payload, indent=2, ensure_ascii=False)

    def _build_questions(self, ambiguities: List[dict]) -> List[str]:
        """One follow-up per ambiguity *category* so the queue is not ten copies of the same modal issue."""
        prompts: List[str] = []
        seen_categories: set = set()
        for item in ambiguities:
            word = item.get("word", "")
            category = item.get("category", "general")
            if category in seen_categories:
                continue
            seen_categories.add(category)
            prompts.append(f"Please clarify '{word}' ({category}) with measurable criteria.")
            if len(prompts) >= 8:
                break
        extras = [
            "What actors (roles) use the system and what must each be allowed to do?",
            "What performance or capacity targets must the system meet?",
            "What security, privacy, or compliance constraints apply?",
        ]
        for line in extras:
            if len(prompts) >= 10:
                break
            if line not in prompts:
                prompts.append(line)
        return prompts[:10]

    def _extract_requirement_statements(self, text: str) -> List[str]:
        if not text.strip():
            return []
        chunks = re.split(r"[\n;]+|(?<=[.!?])\s+", text)
        statements = [chunk.strip(" -\t\r\n.") for chunk in chunks if chunk.strip(" -\t\r\n.")]
        return statements

    def _to_structured_statement(self, statement: str) -> str:
        """
        Convert a vague statement to structured requirement style.
        """
        lowered = statement.lower()
        if "shall" in lowered or "must" in lowered:
            normalized = statement
        elif lowered.startswith("the system "):
            normalized = "The system shall " + statement[len("the system ") :]
        elif lowered.startswith("system "):
            normalized = "The system shall " + statement[len("system ") :]
        elif lowered.startswith("users ") or lowered.startswith("user "):
            normalized = "The system shall allow " + statement
        else:
            normalized = "The system shall " + statement[0].lower() + statement[1:] if statement else statement

        # Improve ambiguous wording by leveraging ambiguity detector suggestion.
        analysis = self.ambiguity_detector.analyze_requirement(normalized)
        return analysis.get("suggestion", normalized)

    def _classify_statement(self, statement: str) -> str:
        scored = {
            "functional_requirements": 0,
            "non_functional_requirements": 0,
            "system_requirements": 0,
            "user_requirements": 0,
        }
        lowered = statement.lower()

        for category, keywords in self.classification_keywords.items():
            for keyword in keywords:
                if keyword in lowered:
                    scored[category] += 1

        # Tie-breaker priorities:
        # NFR > system > user > functional (functional is default bucket).
        ordered = [
            "non_functional_requirements",
            "system_requirements",
            "user_requirements",
            "functional_requirements",
        ]
        best_category = "functional_requirements"
        best_score = -1
        for category in ordered:
            if scored[category] > best_score:
                best_score = scored[category]
                best_category = category
        return best_category

    def _empty_output(self) -> Dict[str, List[Dict[str, str]]]:
        return {
            "functional_requirements": [],
            "non_functional_requirements": [],
            "user_requirements": [],
            "system_requirements": [],
        }

    def _prefix_for_category(self, category: str) -> str:
        mapping = {
            "functional_requirements": "FR",
            "non_functional_requirements": "NFR",
            "user_requirements": "UR",
            "system_requirements": "SR",
        }
        return mapping.get(category, "REQ")

    def _classify_with_prompt_template(self, statements: List[str]) -> Optional[Dict[str, List[Dict[str, str]]]]:
        """
        Optional hook for future LLM integration.
        Currently returns None to use deterministic NLP/rule-based flow.
        """
        _ = statements
        return None

