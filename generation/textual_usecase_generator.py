import re
from pathlib import Path
from typing import Any, Dict, List


class TextualUseCaseGenerator:
    """
    Generates textual use cases from SRS functional requirements
    using an Alistair Cockburn-style template.
    """

    KNOWN_ACTORS = ("Admin", "Administrator", "User", "Customer", "System", "Manager", "Operator")

    def generate_from_srs(self, srs_sections: Dict[str, Any]) -> List[Dict[str, str]]:
        functional_requirements = (
            srs_sections.get("specific_requirements", {}).get("functional_requirements", [])
        )
        use_cases: List[Dict[str, str]] = []
        for idx, requirement in enumerate(functional_requirements, start=1):
            use_cases.append(self._build_use_case(requirement, idx))
        return use_cases

    def render_text(self, use_cases: List[Dict[str, str]]) -> str:
        if not use_cases:
            return (
                "Use Case Name: Not Available\n"
                "Primary Actor: User\n"
                "Stakeholders and Interests: Stakeholders expect this feature to be defined.\n"
                "Preconditions: Functional requirements were not found in the SRS.\n"
                "Postconditions: N/A\n"
                "Main Success Scenario: N/A\n"
                "Extensions: N/A\n"
                "Special Requirements: N/A\n"
                "Frequency of Occurrence: N/A\n"
                "Assumptions: N/A\n"
            )

        blocks = []
        for use_case in use_cases:
            block = (
                f"Use Case Name: {use_case['use_case_name']}\n"
                f"Primary Actor: {use_case['primary_actor']}\n"
                f"Stakeholders and Interests: {use_case['stakeholders_and_interests']}\n"
                f"Preconditions: {use_case['preconditions']}\n"
                f"Postconditions: {use_case['postconditions']}\n"
                f"Main Success Scenario: {use_case['main_success_scenario']}\n"
                f"Extensions: {use_case['extensions']}\n"
                f"Special Requirements: {use_case['special_requirements']}\n"
                f"Frequency of Occurrence: {use_case['frequency_of_occurrence']}\n"
                f"Assumptions: {use_case['assumptions']}"
            )
            blocks.append(block)
        return "\n\n".join(blocks)

    def save_to_file(self, text_payload: str, output_path: str = "outputs/textual_usecases.txt") -> str:
        target = Path(output_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text_payload, encoding="utf-8")
        return str(target)

    def generate_and_save(self, srs_sections: Dict[str, Any], output_path: str = "outputs/textual_usecases.txt") -> Dict[str, Any]:
        use_cases = self.generate_from_srs(srs_sections)
        rendered = self.render_text(use_cases)
        saved_path = self.save_to_file(rendered, output_path=output_path)
        return {"use_cases": use_cases, "text": rendered, "output_file": saved_path}

    def _build_use_case(self, requirement: Any, index: int) -> Dict[str, str]:
        if isinstance(requirement, dict):
            description = str(requirement.get("description", "")).strip() or f"Functional Requirement {index}"
            input_data = str(requirement.get("input", "")).strip()
            processing = str(requirement.get("processing", "")).strip()
            output_data = str(requirement.get("output", "")).strip()
        else:
            description = str(requirement).strip() or f"Functional Requirement {index}"
            input_data = ""
            processing = ""
            output_data = ""

        actor = self._identify_actor(description)
        use_case_name = self._derive_use_case_name(description, index)
        main_scenario = self._derive_main_scenario(description, processing)

        return {
            "use_case_name": use_case_name,
            "primary_actor": actor,
            "stakeholders_and_interests": f"{actor}: wants the system to complete '{use_case_name}' correctly and quickly.",
            "preconditions": input_data or f"{actor} is authenticated and required system components are available.",
            "postconditions": output_data or "System stores results and confirms successful completion.",
            "main_success_scenario": main_scenario,
            "extensions": "If validation fails, the system displays a clear error and asks for correction.",
            "special_requirements": "Response must meet defined performance and security constraints.",
            "frequency_of_occurrence": "Multiple times per day during normal system usage.",
            "assumptions": "Users have valid access rights and network connectivity is available.",
        }

    def _identify_actor(self, description: str) -> str:
        lowered = description.lower()
        for actor in self.KNOWN_ACTORS:
            if re.search(rf"\b{re.escape(actor.lower())}\b", lowered):
                return actor
        if "payment" in lowered or "transaction" in lowered:
            return "Customer"
        if "manage" in lowered or "configure" in lowered:
            return "Admin"
        return "User"

    def _derive_use_case_name(self, description: str, index: int) -> str:
        first_sentence = description.split(".")[0].strip()
        if not first_sentence:
            return f"Use Case {index}"
        if len(first_sentence) > 90:
            first_sentence = first_sentence[:90].rstrip() + "..."
        return first_sentence[0].upper() + first_sentence[1:]

    def _derive_main_scenario(self, description: str, processing: str) -> str:
        core = processing or description
        core = " ".join(core.split())
        return (
            f"1. Actor initiates '{core}'. "
            "2. System validates request details. "
            "3. System executes the requested operation. "
            "4. System returns confirmation to the actor."
        )

