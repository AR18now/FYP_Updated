"""
UML 2.x–style Use Case Diagram generation via PlantUML.

Layout follows common UML 2 teaching/practice:
- **Subject** (system boundary): rectangle containing use cases as ellipses.
- **Actors** outside the boundary (stick figures).
- **Associations** (solid lines) from actor to use case — the standard binary association at the use case diagram level.

References: UML 2.x Use Case Diagram (subject, actor, use case, association).
"""
import re
import shutil
import subprocess
from pathlib import Path
from typing import Dict, List, Tuple


class UseCaseDiagramGenerator:
    """Generates PlantUML use case diagrams from textual use cases (Cockburn-style)."""

    # PlantUML / diagram limits to keep renders readable
    _MAX_LABEL_LEN = 72

    def extract_actors_and_usecases(self, textual_use_cases: str) -> Dict[str, object]:
        """
        Parse Alistair Cockburn textual use cases and extract:
        - actors
        - use cases (unique)
        - relation_pairs: (actor_name, use_case_name) for associations
        """
        blocks = self._split_use_case_blocks(textual_use_cases)
        actors: List[str] = []
        use_cases: List[str] = []
        relation_pairs: List[Tuple[str, str]] = []

        for block in blocks:
            actor = self._extract_field(block, "Primary Actor")
            use_case_name = self._extract_field(block, "Use Case Name")

            if not actor:
                actor = "User"
            if not use_case_name:
                continue

            actor = self._normalize_actor(actor)
            use_case_name = self._normalize_use_case(use_case_name)

            if actor not in actors:
                actors.append(actor)
            if use_case_name not in use_cases:
                use_cases.append(use_case_name)
            if (actor, use_case_name) not in relation_pairs:
                relation_pairs.append((actor, use_case_name))

        return {
            "actors": actors,
            "use_cases": use_cases,
            "relation_pairs": relation_pairs,
            # Legacy: simple arrow lines for debugging / callers expecting strings
            "relations": [f"{a} ..> ({uc})" for a, uc in relation_pairs],
        }

    def generate_plantuml(self, textual_use_cases: str, system_name: str = "System") -> str:
        """
        Generate PlantUML for a **UML 2.x Use Case Diagram**:
        subject boundary, use cases inside, actors outside, associations.
        """
        extracted = self.extract_actors_and_usecases(textual_use_cases)
        actors: List[str] = list(extracted["actors"])
        use_cases: List[str] = list(extracted["use_cases"])
        relation_pairs: List[Tuple[str, str]] = list(extracted["relation_pairs"])

        subject = self._sanitize_subject_title(system_name or "System")

        lines: List[str] = [
            "@startuml",
            "' UML 2.x Use Case Diagram (PlantUML)",
            "top to bottom direction",
            "",
            f"title UML 2.x Use Case Diagram\\n<size:12><i>{self._escape_title(subject)}</i></size>",
            "",
            self._skinparam_block(),
            "",
        ]

        if not use_cases:
            lines.extend(
                [
                    "note as N",
                    "  No use cases parsed.",
                    "  Check textual use cases for **Use Case Name:** fields.",
                    "end note",
                    "@enduml",
                    "",
                ]
            )
            return "\n".join(lines)

        # Unique aliases
        actor_alias: Dict[str, str] = {}
        for i, name in enumerate(actors):
            actor_alias[name] = f"act_{i}"

        uc_alias: Dict[str, str] = {}
        for i, name in enumerate(use_cases):
            uc_alias[name] = f"uc_{i}"

        # Actors OUTSIDE subject (UML 2 layout)
        lines.append("' --- Actors (outside subject) ---")
        for name in actors:
            aid = actor_alias[name]
            label = self._label_for_plantuml(name)
            lines.append(f'actor "{label}" as {aid}')

        lines.append("")
        lines.append("' --- Subject (system boundary) & use cases ---")
        lines.append(f'rectangle "{subject}" {{')

        for name in use_cases:
            uid = uc_alias[name]
            label = self._label_for_plantuml(name)
            lines.append(f'  usecase "{label}" as {uid}')

        # Taller layout: chain use cases vertically inside the subject (hidden links).
        if len(use_cases) > 1:
            lines.append("  ' vertical stack hint")
            uids = [uc_alias[n] for n in use_cases]
            for a, b in zip(uids, uids[1:]):
                lines.append(f"  {a} -[hidden]down- {b}")

        lines.append("}")
        lines.append("")

        # Binary associations (actor — use case), UML default: solid line without arrowhead on use case side in PlantUML uses -->
        lines.append("' --- Associations (actor to use case) ---")
        for actor_name, uc_name in relation_pairs:
            if actor_name not in actor_alias or uc_name not in uc_alias:
                continue
            lines.append(f"{actor_alias[actor_name]} -- {uc_alias[uc_name]}")

        lines.extend(
            [
                "",
                "note bottom",
                "  **UML 2.x use case diagram**: subject (boundary), actors, use cases, associations.",
                "end note",
                "",
                "@enduml",
                "",
            ]
        )
        return "\n".join(lines)

    def render_diagram(
        self,
        plantuml_code: str,
        output_dir: str = "data/output",
        output_name: str = "usecase_diagram",
    ) -> Dict[str, str]:
        """
        Render PlantUML diagram.
        - Saves .puml file always.
        - If `plantuml` CLI exists, renders PNG.
        """
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        puml_path = out_dir / f"{output_name}.puml"
        png_path = out_dir / f"{output_name}.png"
        puml_path.write_text(plantuml_code, encoding="utf-8")

        plantuml_cmd = shutil.which("plantuml")
        if plantuml_cmd:
            try:
                subprocess.run(
                    [plantuml_cmd, "-tpng", str(puml_path)],
                    check=True,
                    capture_output=True,
                    text=True,
                )
                return {
                    "status": "rendered",
                    "puml_file": str(puml_path),
                    "diagram_file": str(png_path),
                }
            except Exception as exc:
                return {
                    "status": "saved_only",
                    "puml_file": str(puml_path),
                    "diagram_file": "",
                    "message": f"PlantUML render failed: {exc}",
                }

        return {
            "status": "saved_only",
            "puml_file": str(puml_path),
            "diagram_file": "",
            "message": "PlantUML CLI not found. Install PlantUML to render PNG automatically.",
        }

    def generate_and_render(
        self,
        textual_use_cases: str,
        system_name: str = "System",
        output_dir: str = "data/output",
        output_name: str = "usecase_diagram",
    ) -> Dict[str, str]:
        """Extract → PlantUML (UML 2.x) → optional PNG."""
        plantuml_code = self.generate_plantuml(textual_use_cases, system_name=system_name)
        result = self.render_diagram(
            plantuml_code=plantuml_code,
            output_dir=output_dir,
            output_name=output_name,
        )
        result["plantuml_code"] = plantuml_code
        return result

    def _skinparam_block(self) -> str:
        """Professional, print-friendly styling aligned with typical UML tool palettes."""
        return "\n".join(
            [
                "skinparam backgroundColor #FFFFFF",
                "skinparam shadowing false",
                "skinparam roundcorner 8",
                "skinparam defaultFontName \"Segoe UI\", Helvetica, Arial, sans-serif",
                "skinparam defaultFontSize 12",
                "skinparam TitleFontSize 14",
                "skinparam TitleFontStyle bold",
                "skinparam rectangle {",
                "  BackgroundColor #F8FAFC",
                "  BorderColor #1e3a8a",
                "  FontColor #0f172a",
                "  RoundCorner 10",
                "}",
                "skinparam usecase {",
                "  BackgroundColor #FFFFFF",
                "  BorderColor #1d4ed8",
                "  FontColor #0f172a",
                "}",
                "skinparam actor {",
                "  BackgroundColor #EEF2FF",
                "  BorderColor #1d4ed8",
                "  FontColor #0f172a",
                "}",
                "skinparam arrow {",
                "  Color #475569",
                "  Thickness 1.5",
                "}",
            ]
        )

    @staticmethod
    def _sanitize_subject_title(name: str) -> str:
        n = " ".join(str(name).split()).strip() or "System"
        return n[:120]

    @staticmethod
    def _escape_title(s: str) -> str:
        """Escape characters that break PlantUML title / quoted strings."""
        return str(s).replace("]", "\\]").replace("\n", " ")

    def _label_for_plantuml(self, text: str) -> str:
        """Safe short label for quoted strings in PlantUML."""
        t = " ".join(str(text).split()).strip()
        if len(t) > self._MAX_LABEL_LEN:
            t = t[: self._MAX_LABEL_LEN - 1] + "…"
        return t.replace('"', "'")

    def _split_use_case_blocks(self, text: str) -> List[str]:
        if not text or not text.strip():
            return []
        parts = re.split(r"\n\s*\n(?=Use Case Name:)", text.strip())
        return [part.strip() for part in parts if part.strip()]

    def _extract_field(self, block: str, field_name: str) -> str:
        # First line only for multiline fields; tolerate ** markdown
        pattern = rf"{re.escape(field_name)}\s*:\s*(.+)"
        match = re.search(pattern, block, flags=re.IGNORECASE | re.MULTILINE)
        if not match:
            return ""
        raw = match.group(1).strip()
        # Strip markdown bold
        raw = re.sub(r"^\*+\s*|\s*\*+$", "", raw)
        first_line = raw.split("\n")[0].strip()
        return first_line

    def _normalize_actor(self, actor: str) -> str:
        actor = " ".join(actor.split())
        return actor.title()

    def _normalize_use_case(self, name: str) -> str:
        name = " ".join(name.split())
        if not name:
            return name
        return name[0].upper() + name[1:] if len(name) > 1 else name.upper()
