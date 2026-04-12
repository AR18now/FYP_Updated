from typing import Any, Dict, List


class UseCaseGenerator:
    """Generates textual use cases from SRS functional requirements."""

    def generate(self, srs_sections: Dict) -> List[Dict[str, str]]:
        """
        Backward-compatible generator returning structured use-case fields.
        Also includes `textual_use_case` in Alistair Cockburn format.
        """
        use_cases: List[Dict[str, str]] = []
        functional_requirements = self._extract_functional_requirements(srs_sections)

        for idx, req in enumerate(functional_requirements, start=1):
            normalized = self._normalize_requirement(req, idx)
            textual_block = self._format_textual_use_case(normalized)
            use_cases.append(
                {
                    "id": normalized["id"],
                    "title": normalized["name"],
                    "actor": normalized["actor"],
                    "precondition": normalized["preconditions"],
                    "main_flow": normalized["main_success_scenario"],
                    "postcondition": normalized["postconditions"],
                    "extensions": normalized["extensions"],
                    "textual_use_case": textual_block,
                }
            )
        return use_cases

    def generate_textual_use_cases(self, srs_sections: Dict) -> str:
        """
        Returns all use cases as plain text in Alistair Cockburn textual format:
        Use Case Name, Primary Actor, Preconditions, Main Success Scenario,
        Extensions, Postconditions.
        """
        use_cases = self.generate(srs_sections)
        if not use_cases:
            return (
                "Use Case Name: Not Available\n"
                "Primary Actor: User\n"
                "Preconditions: Functional requirements not found in SRS.\n"
                "Main Success Scenario: N/A\n"
                "Extensions: N/A\n"
                "Postconditions: N/A\n"
            )
        return "\n\n".join(item["textual_use_case"] for item in use_cases)

    def _extract_functional_requirements(self, srs_sections: Dict) -> List[Any]:
        return srs_sections.get("specific_requirements", {}).get("functional_requirements", [])

    def _normalize_requirement(self, requirement: Any, index: int) -> Dict[str, str]:
        if isinstance(requirement, dict):
            req_id = str(requirement.get("id", f"UC-{index}"))
            description = str(requirement.get("description", f"Use case {index}")).strip()
            actor = self._infer_actor(description)
            preconditions = str(requirement.get("input", "User is authenticated and system is operational.")).strip()
            main_flow = str(requirement.get("processing", description)).strip()
            postconditions = str(requirement.get("output", "Requested operation is completed successfully.")).strip()
            extensions = self._infer_extensions(requirement, description)
        else:
            description = str(requirement).strip() or f"Use case {index}"
            req_id = f"UC-{index}"
            actor = self._infer_actor(description)
            preconditions = "User has access to the system and required permissions."
            main_flow = description
            postconditions = "System stores and confirms the requested operation."
            extensions = "If validation fails, system shows error and asks user to correct input."

        return {
            "id": req_id,
            "name": self._use_case_name_from_description(description, index),
            "actor": actor,
            "preconditions": preconditions,
            "main_success_scenario": self._normalize_scenario(main_flow),
            "extensions": extensions,
            "postconditions": postconditions,
        }

    def _format_textual_use_case(self, uc: Dict[str, str]) -> str:
        return (
            f"Use Case Name: {uc['name']}\n"
            f"Primary Actor: {uc['actor']}\n"
            f"Preconditions: {uc['preconditions']}\n"
            f"Main Success Scenario: {uc['main_success_scenario']}\n"
            f"Extensions: {uc['extensions']}\n"
            f"Postconditions: {uc['postconditions']}"
        )

    def _use_case_name_from_description(self, description: str, index: int) -> str:
        snippet = description.split(".")[0].strip()
        if not snippet:
            return f"Use Case {index}"
        if len(snippet) > 80:
            snippet = snippet[:80].rstrip() + "..."
        return snippet[0].upper() + snippet[1:]

    def _normalize_scenario(self, scenario_text: str) -> str:
        text = " ".join(scenario_text.split())
        if not text:
            return "1. User initiates request. 2. System validates input. 3. System performs operation."
        if any(marker in text for marker in ["1.", "2.", "3."]):
            return text
        return (
            f"1. User initiates the action for '{text}'. "
            "2. System validates request data. "
            "3. System executes the action and returns confirmation."
        )

    def _infer_actor(self, description: str) -> str:
        lowered = description.lower()
        if "admin" in lowered:
            return "Administrator"
        if "customer" in lowered:
            return "Customer"
        if "manager" in lowered:
            return "Manager"
        return "Primary User"

    def _infer_extensions(self, requirement: Dict[str, Any], description: str) -> str:
        priority = str(requirement.get("priority", "")).lower()
        if priority == "high":
            return (
                "If required data is missing, system prompts for mandatory inputs; "
                "if processing fails, system logs the error and notifies user."
            )
        if "payment" in description.lower():
            return "If payment authorization fails, transaction is canceled and user is prompted to retry."
        return "If validation fails, system displays a clear error and allows correction."

