import re
from pathlib import Path
from typing import Any, Dict, List


class TextualUseCaseGenerator:
    """
    Generates textual use cases from SRS functional requirements
    using an Alistair Cockburn-style template (IEEE 830–aligned traceability).
    """

    KNOWN_ACTORS = (
        "Admin",
        "Administrator",
        "User",
        "Customer",
        "System",
        "Manager",
        "Operator",
        "Guest",
        "Vendor",
    )

    _UI_TERMS = re.compile(
        r"(?i)\b(button|click|tap|screen|page|modal|dropdown|toast|tooltip|"
        r"navbar|sidebar|pixel|css|html|widget|gui)\b"
    )

    # FR-01:, FR-01, FR01 Browse, etc.
    _FR_PREFIX = re.compile(r"^\s*FR[-\s:]?\d+\s*[:\-–]?\s*", re.IGNORECASE)
    _SHALL = re.compile(r"(?i)^\s*(the\s+system\s+shall|the\s+system\s+must|the\s+system\s+will)\s+")
    _VERB_START = re.compile(
        r"(?i)^(browse|search|view|register|login|logout|submit|create|update|delete|"
        r"remove|add|select|place|pay|cancel|confirm|validate|verify|send|receive|"
        r"retrieve|list|filter|sort|manage|configure|authorize|authenticate|upload|"
        r"download|schedule|track|notify|assign|approve|reject|request|process|"
        r"generate|export|import|restore|backup|lock|unlock|grant|revoke)\b"
    )
    _SRS_PHRASES = [
        re.compile(r"(?i)\b(as|according)\s+to\s+the?\s*srs\b"),
        re.compile(r"(?i)\bfrom\s+the?\s*srs\b"),
        re.compile(r"(?i)\bper\s+the?\s*srs\b"),
        re.compile(r"(?i)\bper\s+srs\b"),
        re.compile(r"(?i)\bwithin\s+the?\s*srs\b"),
        re.compile(r"(?i)\bin\s+the?\s*srs\b"),
        re.compile(r"(?i)\bsrs[-\s]*(defined|based|driven)\b"),
        re.compile(r"(?i)\bthe?\s*srs\s+(states|requires|defines)\s+that\b"),
    ]

    def generate_from_srs(self, srs_sections: Dict[str, Any]) -> List[Dict[str, str]]:
        functional_requirements = (
            srs_sections.get("specific_requirements", {}).get("functional_requirements", [])
        )
        use_cases: List[Dict[str, str]] = []
        for idx, requirement in enumerate(functional_requirements, start=1):
            use_cases.append(self._build_use_case(requirement, idx, srs_sections))
        use_cases = self._disambiguate_names(use_cases)
        use_cases = self._annotate_shared_validation(use_cases)
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

    def _build_use_case(self, requirement: Any, index: int, srs_sections: Dict[str, Any]) -> Dict[str, str]:
        fr_id = ""
        if isinstance(requirement, dict):
            fr_id = str(requirement.get("id", "")).strip()
            description = str(requirement.get("description", "")).strip() or f"Functional Requirement {index}"
            input_data = str(requirement.get("input", "")).strip()
            processing = str(requirement.get("processing", "")).strip()
            output_data = str(requirement.get("output", "")).strip()
            priority = str(requirement.get("priority", "")).strip()
        else:
            description = str(requirement).strip() or f"Functional Requirement {index}"
            input_data = ""
            processing = ""
            output_data = ""
            priority = ""

        description = self._sanitize_source_text(description)
        processing = self._sanitize_source_text(processing)
        input_data = self._sanitize_source_text(input_data)
        output_data = self._sanitize_source_text(output_data)

        actor = self._normalize_actor_role(self._identify_actor(description, processing))
        use_case_name = self._derive_use_case_name(description, processing, index)
        main_scenario = self._derive_main_scenario(
            description, input_data, processing, output_data, actor
        )
        pre = self._derive_preconditions(input_data, actor, description, fr_id)
        post = self._derive_postconditions(output_data, description)
        extensions = self._derive_extensions(
            input_data, processing, output_data, description, priority, actor
        )
        stakeholders = self._derive_stakeholders(actor, use_case_name, description)
        special = self._derive_special_requirements(srs_sections)
        frequency = self._derive_frequency(description, priority)
        assumptions = self._derive_assumptions(actor, description)

        return {
            "use_case_name": use_case_name,
            "primary_actor": actor,
            "stakeholders_and_interests": stakeholders,
            "preconditions": pre,
            "postconditions": post,
            "main_success_scenario": main_scenario,
            "extensions": extensions,
            "special_requirements": special,
            "frequency_of_occurrence": frequency,
            "assumptions": assumptions,
        }

    @staticmethod
    def _strip_ui_jargon(text: str) -> str:
        if not text:
            return text
        t = TextualUseCaseGenerator._UI_TERMS.sub("interface", text)
        return " ".join(t.split())

    def _de_srsify(self, text: str) -> str:
        if not text:
            return text
        cleaned = text
        for pat in self._SRS_PHRASES:
            cleaned = pat.sub("", cleaned)
        cleaned = re.sub(r"(?i)\bSRS\b", "requirement", cleaned)
        cleaned = re.sub(r"\s{2,}", " ", cleaned).strip(" ,;:-")
        return cleaned

    def _sanitize_source_text(self, text: str) -> str:
        return self._de_srsify(self._strip_ui_jargon(text))

    def _annotate_shared_validation(self, use_cases: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """Note conceptual <<include>> where validation logic is clearly repeated (UML relationship hint)."""
        if len(use_cases) < 2:
            return use_cases
        needles = []
        for uc in use_cases:
            m = re.search(r"2\.\s*([^.]+)", uc.get("main_success_scenario", ""))
            if m:
                needles.append(m.group(1).strip().lower()[:80])
        from collections import Counter

        c = Counter(needles)
        common = {k for k, v in c.items() if v >= 2 and len(k) > 25}
        if not common:
            return use_cases
        hint = (
            " UML note: Where the same mandatory sub-behaviour appears in multiple use cases, "
            "model it once and apply <<include>> from each affected use case (per SRS, not by inventing new scope)."
        )
        for uc in use_cases:
            step2 = ""
            m = re.search(r"2\.\s*([^.]+)", uc.get("main_success_scenario", ""))
            if m:
                step2 = m.group(1).strip().lower()[:80]
            if step2 in common and hint.strip() not in uc["extensions"]:
                uc["extensions"] = uc["extensions"].rstrip() + hint
        return use_cases

    def _disambiguate_names(self, use_cases: List[Dict[str, str]]) -> List[Dict[str, str]]:
        seen: Dict[str, int] = {}
        for uc in use_cases:
            name = uc["use_case_name"]
            n = seen.get(name, 0) + 1
            seen[name] = n
            if n > 1:
                uc["use_case_name"] = f"{name} ({n})"
        return use_cases

    def _normalize_actor_role(self, actor: str) -> str:
        a = actor.strip()
        if a.lower() in ("admin", "administrator"):
            return "Administrator"
        if a.lower() in ("user", "end user", "end-user"):
            return "User"
        if a.lower() == "system":
            return "System"
        return a[0].upper() + a[1:] if a else "User"

    def _identify_actor(self, description: str, processing: str) -> str:
        text = f"{description} {processing}".lower()
        for actor in self.KNOWN_ACTORS:
            if re.search(rf"\b{re.escape(actor.lower())}\b", text):
                return actor
        if "payment" in text or "purchase" in text or "order" in text or "checkout" in text:
            return "Customer"
        if "manage" in text or "configure" in text or "moderate" in text:
            return "Administrator"
        if "register" in text or "sign up" in text or "browse" in text:
            return "User"
        return "User"

    def _derive_use_case_name(self, description: str, processing: str, index: int) -> str:
        raw = self._FR_PREFIX.sub("", description.strip())
        raw = self._SHALL.sub("", raw).strip()
        first = raw.split(".")[0].strip()
        if not first:
            return f"Complete Requirement {index}"

        candidate = first
        if not self._VERB_START.match(candidate):
            proc = self._FR_PREFIX.sub("", processing.strip())
            proc_first = proc.split(".")[0].strip() if proc else ""
            if proc_first and self._VERB_START.match(proc_first):
                candidate = proc_first
            elif proc_first:
                candidate = proc_first
        candidate = self._compact_phrase(candidate)
        if len(candidate) > 88:
            candidate = candidate[:85].rstrip() + "..."
        candidate = self._title_case_heading(candidate)
        return candidate if candidate else f"Use Case {index}"

    @staticmethod
    def _title_case_heading(s: str) -> str:
        if not s:
            return s
        parts = []
        small = {"a", "an", "the", "of", "and", "or", "in", "on", "to", "for", "vs", "via"}
        words = s.split()
        for i, w in enumerate(words):
            lw = w.lower()
            if i > 0 and lw in small:
                parts.append(lw)
            else:
                parts.append(w[:1].upper() + w[1:].lower() if len(w) > 1 else w.upper())
        return " ".join(parts)

    @staticmethod
    def _compact_phrase(s: str) -> str:
        s = " ".join(s.split())
        return s.strip(" -–—:")

    def _derive_main_scenario(
        self,
        description: str,
        input_data: str,
        processing: str,
        output_data: str,
        actor: str,
    ) -> str:
        steps: List[str] = []

        if input_data:
            steps.append(
                f"1. {actor} provides the required inputs: {self._one_line(input_data)}."
            )
        else:
            steps.append(
                f"1. {actor} initiates this use case."
            )

        if input_data:
            steps.append(
                "2. System validates the inputs against the requirement rules."
            )
        else:
            steps.append(
                "2. System accepts the request and applies consistency checks."
            )

        core = processing or description
        core = self._one_line(self._FR_PREFIX.sub("", core))
        if core:
            cl = core.strip()
            if cl.lower().startswith("system "):
                steps.append(f"3. {cl[0].upper() + cl[1:] if cl else cl}")
            else:
                steps.append(f"3. System {self._lower_first_if_needed(cl)}")
        else:
            steps.append("3. System carries out the behaviour described in the functional requirement.")

        if output_data:
            steps.append(
                f"4. System produces the expected outcome: {self._one_line(output_data)}."
            )
        else:
            steps.append(
                "4. System reaches a stable outcome and confirms completion to "
                f"{actor} where applicable."
            )

        return "\n".join(steps)

    @staticmethod
    def _lower_first_if_needed(sentence: str) -> str:
        s = sentence.strip()
        if not s:
            return s
        if s[0].isupper() and len(s) > 1 and s[1:2].islower():
            return s[0].lower() + s[1:]
        return s

    @staticmethod
    def _one_line(text: str, max_len: int = 320) -> str:
        t = " ".join(text.split()).strip()
        if len(t) > max_len:
            return t[: max_len - 1].rstrip() + "…"
        return t

    def _derive_preconditions(self, input_data: str, actor: str, description: str, fr_id: str) -> str:
        parts: List[str] = []
        if fr_id:
            parts.append(f"Traceability: functional requirement {fr_id} is in scope.")
        low = description.lower()
        if "authenticated" in low or "logged in" in low or "login" in low:
            parts.append(f"{actor} holds a valid session for this capability.")
        elif actor not in ("System",):
            parts.append(f"{actor} is permitted to invoke this capability under the SRS.")
        if input_data:
            parts.append(f"Inputs needed for the main flow are available: {self._one_line(input_data, 220)}.")
        if not parts:
            parts.append("Preconditions for this requirement are satisfied.")
        return " ".join(parts)

    def _derive_postconditions(self, output_data: str, description: str) -> str:
        if output_data:
            return (
                "Measurable system state: outputs match the requirement specification "
                f"({self._one_line(output_data, 240)}); persistent data and session state remain consistent with that outcome."
            )
        return (
            "Measurable system state: the operation completes without inconsistent partial effects; "
            "stored data and session attributes align with the intended requirement outcome."
        )

    def _derive_extensions(
        self,
        input_data: str,
        processing: str,
        output_data: str,
        description: str,
        priority: str,
        actor: str,
    ) -> str:
        alt: List[str] = []
        exc: List[str] = []

        low = description.lower()
        if "optional" in low or " may " in low:
            alt.append(
                "Where an optional branch is allowed, the system follows that branch and still reaches a valid end state."
            )
        if input_data:
            exc.append(
                f"Invalid or incomplete inputs: system rejects with a clear reason; {actor} may correct data and resume at step 1."
            )
        if "payment" in low or "pay" in low or "transaction" in low:
            exc.append(
                "Payment or authorization refusal: transaction does not commit; system records the failure state."
            )
        if processing:
            exc.append(
                "Processing failure: system avoids inconsistent commits, notifies the actor, and records diagnostics as required."
            )
        pl = priority.lower()
        if pl in ("high", "critical"):
            exc.append(
                "Service timeout or unavailability: system preserves integrity and signals unavailability without corrupting state."
            )
        if not alt:
            alt.append("None beyond the exception flows below when no optional branch is defined.")
        if not exc:
            exc.append(
                f"Validation failure: system rejects with a recoverable error; {actor} may correct inputs and resume at step 2."
            )
            exc.append(
                "Operation cannot complete: system aborts without partial effect where feasible and informs the actor."
            )

        return (
            "Alternate flows — " + " ".join(alt) + " "
            "Exception flows — " + " ".join(exc)
        )

    def _derive_stakeholders(self, actor: str, use_case_name: str, description: str) -> str:
        low = description.lower()
        secondary = "None stated in the SRS excerpt."
        if re.search(r"\b(pay|payment|checkout|purchase|order)\b", low) or any(
            x in low for x in ("gateway", "processor", "bank", "card")
        ):
            secondary = "External payment authority (boundary system) when settlement is out of scope for the subject system."
        elif any(x in low for x in ("email", "sms", "notification", "third-party")):
            secondary = "External notification or integration endpoint when the SRS delegates delivery outside the subject system."

        return (
            f"Primary actor ({actor}): achieve “{use_case_name}” successfully and traceably to the requirement. "
            f"Product owner / sponsor: acceptance against the originating requirement. "
            f"Supporting actors (if any): {secondary}"
        )

    def _derive_special_requirements(self, srs_sections: Dict[str, Any]) -> str:
        spec = srs_sections.get("specific_requirements") or {}
        attrs = spec.get("software_system_attributes") or {}
        if not isinstance(attrs, dict):
            return (
                "Quality attributes for this capability are those recorded under the specific requirements "
                "(performance, security, usability, reliability) — no additional behaviour."
            )
        bits: List[str] = []
        for key in ("security", "performance", "usability", "reliability"):
            val = attrs.get(key)
            if isinstance(val, str) and val.strip():
                bits.append(f"{key.title()}: constrained by documented requirement statements.")
        if bits:
            return " ".join(bits) + " Further NFRs apply only as documented in the requirements."
        return (
            "Non-functional constraints are exactly those stated in the requirements; this use case does not add implementation detail."
        )

    def _derive_frequency(self, description: str, priority: str) -> str:
        low = description.lower()
        if any(w in low for w in ("report", "admin", "audit", "export")):
            return "On demand or on an operational schedule (typically low to moderate frequency)."
        if priority.lower() in ("high", "critical"):
            return "High frequency during active use; response remains within expected timing constraints."
        return "According to normal operational load."

    def _derive_assumptions(self, actor: str, description: str) -> str:
        low = description.lower()
        parts = [
            "The approved requirement set is the sole authority on scope; this use case adds no latent requirements.",
            f"{actor} behaviour is limited to the responsibilities assigned to this actor.",
        ]
        if "network" in low or "online" in low:
            parts.append("Connectivity matches the assumed deployment context.")
        return " ".join(parts)
