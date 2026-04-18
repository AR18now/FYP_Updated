"""
UML 2.x–style Use Case Diagram generation via PlantUML.

Layout follows common UML 2 teaching/practice:
- **Subject** (system boundary): rectangle containing use cases as ellipses.
- **Actors** outside the boundary (stick figures).
- **Associations** (solid lines) from actor to use case — the standard binary association at the use case diagram level.

References: UML 2.x Use Case Diagram (subject, actor, use case, association).
"""
import os
import re
import shutil
import subprocess
import urllib.error
import urllib.request
from pathlib import Path
from typing import Dict, List, Set, Tuple


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
        - structured: per-block name, actor, main scenario (for <<include>> / consistency)
        """
        blocks = self._split_use_case_blocks(textual_use_cases)
        actors: List[str] = []
        use_cases: List[str] = []
        relation_pairs: List[Tuple[str, str]] = []
        structured: List[Dict[str, str]] = []

        for block in blocks:
            actor = self._extract_field(block, "Primary Actor")
            use_case_name = self._extract_field(block, "Use Case Name")
            main_scenario = self._extract_multiline_field(block, "Main Success Scenario")
            extensions = self._extract_multiline_field(block, "Extensions")
            stakeholders = self._extract_multiline_field(block, "Stakeholders and Interests")

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
            structured.append(
                {
                    "name": use_case_name,
                    "actor": actor,
                    "main_scenario": main_scenario or "",
                    "extensions": extensions or "",
                    "stakeholders": stakeholders or "",
                }
            )

        secondary = self._secondary_actors_from_stakeholders(structured)
        for sa in secondary:
            if sa not in actors:
                actors.append(sa)

        if not use_cases:
            return self._extract_fallback_from_non_cockburn(textual_use_cases)

        return {
            "actors": actors,
            "use_cases": use_cases,
            "relation_pairs": relation_pairs,
            "secondary_actors": secondary,
            "structured": structured,
            # Legacy: simple arrow lines for debugging / callers expecting strings
            "relations": [f"{a} ..> ({uc})" for a, uc in relation_pairs],
        }

    def generate_plantuml(
        self,
        textual_use_cases: str,
        system_name: str = "System",
        layout: str = "vertical",
    ) -> str:
        """
        Generate PlantUML for a **UML 2.x Use Case Diagram**:
        subject boundary, use cases inside, actors outside, associations.

        layout: "vertical" (top to bottom) or "horizontal" (left to right) for oval ordering hints.
        """
        layout = (layout or "vertical").strip().lower()
        if layout not in ("vertical", "horizontal"):
            layout = "vertical"
        direction_line = (
            "left to right direction" if layout == "horizontal" else "top to bottom direction"
        )
        hidden_link = "right" if layout == "horizontal" else "down"

        extracted = self.extract_actors_and_usecases(textual_use_cases)
        actors: List[str] = list(extracted["actors"])
        use_cases: List[str] = list(extracted["use_cases"])
        relation_pairs: List[Tuple[str, str]] = list(extracted["relation_pairs"])
        structured: List[Dict[str, str]] = list(extracted.get("structured") or [])
        secondary_actor_names: List[str] = list(extracted.get("secondary_actors") or [])

        subject = self._sanitize_subject_title(system_name or "System")

        lines: List[str] = [
            "@startuml",
            "' UML 2.x Use Case Diagram (PlantUML)",
            direction_line,
            "",
            f"title UML 2.x Use Case Diagram ({layout})\\n<size:12><i>{self._escape_title(subject)}</i></size>",
            "",
            self._skinparam_block(),
            "",
        ]

        if not use_cases:
            lines.extend(
                [
                    "note as N",
                    "  No use cases parsed.",
                    "  Check textual use cases for Use Case Name fields.",
                    "end note",
                    "@enduml",
                    "",
                ]
            )
            return "\n".join(lines)

        # Unique aliases (primary + secondary / supporting actors)
        actor_alias: Dict[str, str] = {}
        for i, name in enumerate(actors):
            actor_alias[name] = f"act_{i}"

        uc_alias: Dict[str, str] = {}
        for i, name in enumerate(use_cases):
            uc_alias[name] = f"uc_{i}"

        # Actors OUTSIDE subject (UML 2 layout): primary roles first, then supporting systems
        primary_actors = [a for a in actors if a not in secondary_actor_names]
        ordered_actors = primary_actors + [a for a in actors if a in secondary_actor_names]

        lines.append("' --- Actors (outside subject boundary) ---")
        for name in ordered_actors:
            aid = actor_alias[name]
            label = self._label_for_plantuml(name)
            if name in secondary_actor_names:
                label = f"{label} (supporting)"
            lines.append(f'actor "{label}" as {aid}')

        lines.append("")
        lines.append("' --- Subject (system boundary) & use cases ---")
        lines.append(f'rectangle "{subject}" {{')

        for name in use_cases:
            uid = uc_alias[name]
            label = self._label_for_plantuml(name)
            lines.append(f'  usecase "{label}" as {uid}')

        # Do not use `together { }` inside the subject rectangle: PlantUML 1.2026+ may
        # assume a component diagram and fail with "Syntax error: uc_N" on use case aliases.

        # Hidden links chain use cases: vertical = down, horizontal = right (layout discipline).
        if len(use_cases) > 1:
            lines.append(f"  ' use case ordering hint ({layout})")
            uids = [uc_alias[n] for n in use_cases]
            for a, b in zip(uids, uids[1:]):
                lines.append(f"  {a} -[hidden]{hidden_link}- {b}")

        lines.append("}")
        lines.append("")

        # Binary associations (actor — use case), UML default: solid line without arrowhead on use case side in PlantUML uses -->
        lines.append("' --- Associations (actor to use case) ---")
        for actor_name, uc_name in relation_pairs:
            if actor_name not in actor_alias or uc_name not in uc_alias:
                continue
            lines.append(f"{actor_alias[actor_name]} -- {uc_alias[uc_name]}")

        # Supporting actors: associate only where use-case intent matches (payment / external integration).
        if secondary_actor_names:
            lines.append("")
            lines.append("' --- Supporting actors (secondary associations) ---")
            pay_pat = re.compile(r"(?i)pay|order|checkout|transaction|settle|card")
            sec_pairs: Set[Tuple[str, str]] = set()
            for sa in secondary_actor_names:
                if sa not in actor_alias:
                    continue
                aid = actor_alias[sa]
                for uc_name in use_cases:
                    link = False
                    if pay_pat.search(uc_name) and "payment" in sa.lower():
                        link = True
                    elif any(
                        k in sa.lower() for k in ("notification", "integration", "external")
                    ) and pay_pat.search(uc_name):
                        link = True
                    if link:
                        sec_pairs.add((sa, uc_name))
            for sa, uc_name in sorted(sec_pairs):
                lines.append(f"{actor_alias[sa]} -- {uc_alias[uc_name]}")

        # <<include>> when one use case's main scenario text references another by name (mandatory reuse).
        includes = self._dedupe_edges(self._infer_include_relations(use_cases, structured))
        if includes:
            lines.append("")
            lines.append("' --- <<include>> ---")
            for base_name, included_name in includes:
                if base_name not in uc_alias or included_name not in uc_alias:
                    continue
                lines.append(f"{uc_alias[base_name]} ..> {uc_alias[included_name]} : include")

        # <<extend>> optional behaviour referencing another use case in Extensions (Alternate flows).
        extends = self._dedupe_edges(
            self._infer_extend_relations(use_cases, structured, includes)
        )
        if extends:
            lines.append("")
            lines.append("' --- <<extend>> (optional extension of a base use case) ---")
            for ext_name, base_name in extends:
                if ext_name not in uc_alias or base_name not in uc_alias:
                    continue
                lines.append(f"{uc_alias[ext_name]} ..> {uc_alias[base_name]} : extend")

        lines.extend(["", "@enduml", ""])
        return "\n".join(lines)

    def _render_png_via_http(self, plantuml_code: str, png_path: Path) -> Tuple[bool, str]:
        """
        Fallback when the PlantUML JAR/CLI is missing (common on Windows): POST source to Kroki
        (default https://kroki.io/plantuml/png) and save returned PNG bytes.
        Set DISABLE_KROKI_FALLBACK=1 to disable. Override URL with PLANTUML_HTTP_RENDER_URL.
        """
        if os.environ.get("DISABLE_KROKI_FALLBACK", "").strip().lower() in ("1", "true", "yes"):
            return False, "Kroki HTTP fallback disabled (DISABLE_KROKI_FALLBACK)."
        url = (os.environ.get("PLANTUML_HTTP_RENDER_URL") or "https://kroki.io/plantuml/png").strip()
        if not url:
            return False, "No PLANTUML_HTTP_RENDER_URL."
        try:
            req = urllib.request.Request(
                url,
                data=plantuml_code.encode("utf-8"),
                method="POST",
                headers={"Content-Type": "text/plain; charset=utf-8"},
            )
            with urllib.request.urlopen(req, timeout=90) as resp:
                body = resp.read()
                ct = (resp.headers.get("Content-Type") or "").lower()
            if not body or len(body) < 64:
                return False, "HTTP render returned empty or tiny body."
            if "image" not in ct and not body.startswith(b"\x89PNG"):
                return False, f"Unexpected Content-Type from renderer: {ct!r}"
            png_path.write_bytes(body)
            return True, f"PNG via HTTP ({url})"
        except urllib.error.HTTPError as e:
            err_body = ""
            try:
                err_body = e.read().decode("utf-8", errors="replace")[:800]
            except Exception:
                pass
            return False, f"HTTP {e.code}: {err_body or e.reason}"
        except Exception as exc:
            return False, str(exc)

    def render_diagram(
        self,
        plantuml_code: str,
        output_dir: str = "data/output",
        output_name: str = "usecase_diagram",
    ) -> Dict[str, str]:
        """
        Render PlantUML diagram.
        - Saves .puml file always.
        - If `plantuml` CLI exists, renders PNG locally.
        - Otherwise (or on failure) POSTs source to Kroki for PNG unless DISABLE_KROKI_FALLBACK=1.
        """
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        puml_path = out_dir / f"{output_name}.puml"
        png_path = out_dir / f"{output_name}.png"
        puml_path.write_text(plantuml_code, encoding="utf-8")

        plantuml_cmd = shutil.which("plantuml")
        cli_log = ""
        if plantuml_cmd:
            try:
                proc = subprocess.run(
                    [plantuml_cmd, "-tpng", str(puml_path)],
                    capture_output=True,
                    text=True,
                )
                combined_log = f"{proc.stderr or ''}\n{proc.stdout or ''}"
                cli_log = combined_log.strip()[:1200]
                cl = combined_log.lower()
                # PlantUML still writes a PNG for syntax errors (green text on black). Treat as failure.
                syntax_failed = "syntax error" in cl or "error line" in cl or "cannot find graph" in cl
                png_ok = png_path.exists() and png_path.stat().st_size > 0
                if syntax_failed and png_ok:
                    try:
                        png_path.unlink()
                    except OSError:
                        pass
                    png_ok = False
                # Some Windows PlantUML wrappers return non-zero (e.g. 200) even when PNG is written.
                if png_ok:
                    msg = cli_log if cli_log else ""
                    return {
                        "status": "rendered",
                        "puml_file": str(puml_path),
                        "diagram_file": str(png_path),
                        "plantuml_log": msg,
                    }
            except OSError as exc:
                cli_log = str(exc)

        ok_http, http_msg = self._render_png_via_http(plantuml_code, png_path)
        if ok_http and png_path.exists() and png_path.stat().st_size > 0:
            return {
                "status": "rendered",
                "puml_file": str(puml_path),
                "diagram_file": str(png_path),
                "plantuml_log": (cli_log + "\n" + http_msg).strip()[:2000],
            }

        detail_parts = []
        if plantuml_cmd:
            detail_parts.append(f"Local CLI did not produce a valid PNG. {cli_log[:600] if cli_log else ''}")
        else:
            detail_parts.append("PlantUML CLI not found in PATH.")
        detail_parts.append(http_msg)
        combined_detail = " ".join(p for p in detail_parts if p).strip()
        return {
            "status": "saved_only",
            "puml_file": str(puml_path),
            "diagram_file": "",
            "message": combined_detail[:1600]
            or "PlantUML PNG not available. Install PlantUML locally or allow HTTPS fallback to Kroki.",
            "plantuml_log": combined_detail[:2000],
        }

    def generate_and_render(
        self,
        textual_use_cases: str,
        system_name: str = "System",
        output_dir: str = "data/output",
        output_name: str = "usecase_diagram",
        layout: str = "vertical",
    ) -> Dict[str, str]:
        """Extract → PlantUML (UML 2.x) → optional PNG."""
        plantuml_code = self.generate_plantuml(
            textual_use_cases, system_name=system_name, layout=layout
        )
        result = self.render_diagram(
            plantuml_code=plantuml_code,
            output_dir=output_dir,
            output_name=output_name,
        )
        result["plantuml_code"] = plantuml_code
        result["layout"] = layout
        return result

    def generate_both_layouts_and_render(
        self,
        textual_use_cases: str,
        system_name: str = "System",
        output_dir: str = "data/output",
        output_name: str = "usecase_diagram",
    ) -> Dict[str, Dict[str, str]]:
        """Render vertical and horizontal diagram variants (separate .puml / .png)."""
        out: Dict[str, Dict[str, str]] = {}
        for layout, suffix in (("vertical", "v"), ("horizontal", "h")):
            code = self.generate_plantuml(
                textual_use_cases, system_name=system_name, layout=layout
            )
            res = self.render_diagram(
                plantuml_code=code,
                output_dir=output_dir,
                output_name=f"{output_name}_{suffix}",
            )
            res["plantuml_code"] = code
            res["layout"] = layout
            out[layout] = res
        return out

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
        t = text.strip()
        # Allow multiple "Use Case Name:" blocks without a blank line between them
        parts = re.split(r"(?i)(?=\bUse Case Name\s*:)", t)
        blocks = [
            p.strip() for p in parts if p.strip() and re.search(r"(?i)Use Case Name\s*:", p)
        ]
        if blocks:
            return blocks
        parts2 = re.split(r"\n\s*\n(?=Use Case Name:)", t, flags=re.IGNORECASE)
        return [p.strip() for p in parts2 if p.strip()]

    def _extract_fallback_from_non_cockburn(self, text: str) -> Dict[str, object]:
        """
        When strict Cockburn fields are missing, infer actors and use cases from
        FR- labels, loose "Use Case" headings, or short numbered lists.
        """
        text = (text or "").strip()
        if not text:
            return {
                "actors": ["User"],
                "use_cases": ["Interact with system"],
                "relation_pairs": [("User", "Interact with system")],
                "secondary_actors": [],
                "structured": [
                    {
                        "name": "Interact with system",
                        "actor": "User",
                        "main_scenario": "",
                        "extensions": "",
                        "stakeholders": "",
                    }
                ],
                "relations": ["User ..> (Interact with system)"],
            }

        default_actor = "User"
        m = re.search(
            r"(?:^|\n)\s*(?:Primary\s+)?Actor\s*:\s*([^\n]+)",
            text,
            re.IGNORECASE | re.MULTILINE,
        )
        if m:
            default_actor = self._normalize_actor(m.group(1).strip())

        use_cases: List[str] = []
        relation_pairs: List[Tuple[str, str]] = []
        structured: List[Dict[str, str]] = []
        seen_uc: Set[str] = set()

        for m in re.finditer(r"(?im)^\s*(FR-\d+)\s*[:\-]?\s*([^\n]*)", text):
            fid = m.group(1).upper()
            tail = (m.group(2) or "").strip()
            if re.match(
                r"^(precondition|postcondition|main|extension|stakeholder|assumption)\b",
                tail,
                re.I,
            ):
                tail = ""
            if tail and len(tail) > 2:
                short = tail[: max(8, self._MAX_LABEL_LEN - 6)]
                uc = self._normalize_use_case(f"{fid}: {short}")
            else:
                uc = self._normalize_use_case(fid)
            if uc in seen_uc:
                continue
            seen_uc.add(uc)
            use_cases.append(uc)
            relation_pairs.append((default_actor, uc))
            structured.append(
                {
                    "name": uc,
                    "actor": default_actor,
                    "main_scenario": "",
                    "extensions": "",
                    "stakeholders": "",
                }
            )

        if not use_cases:
            for m in re.finditer(
                r"(?im)^\s*(?:\*\*)?\s*Use\s+Case(?:\s+Name)?\s*:\s*([^\n]+)", text
            ):
                title = (m.group(1) or "").strip()
                title = re.sub(r"^\*+\s*|\s*\*+$", "", title)
                if not title or len(title) < 2:
                    continue
                uc = self._normalize_use_case(title[: self._MAX_LABEL_LEN])
                if uc in seen_uc:
                    continue
                seen_uc.add(uc)
                use_cases.append(uc)
                relation_pairs.append((default_actor, uc))
                structured.append(
                    {
                        "name": uc,
                        "actor": default_actor,
                        "main_scenario": "",
                        "extensions": "",
                        "stakeholders": "",
                    }
                )

        if not use_cases:
            for m in re.finditer(r"(?im)^\s*\d+[\).\s]+\s*([A-Za-z][^\n]{3,120})", text):
                title = m.group(1).strip()
                if re.match(r"^(FR-|UC-|precondition|introduction)\b", title, re.I):
                    continue
                uc = self._normalize_use_case(title[: self._MAX_LABEL_LEN])
                if uc in seen_uc:
                    continue
                seen_uc.add(uc)
                use_cases.append(uc)
                relation_pairs.append((default_actor, uc))
                structured.append(
                    {
                        "name": uc,
                        "actor": default_actor,
                        "main_scenario": "",
                        "extensions": "",
                        "stakeholders": "",
                    }
                )
                if len(use_cases) >= 12:
                    break

        actors: List[str] = [default_actor]
        if not use_cases:
            uc = "Interact with system"
            use_cases = [uc]
            relation_pairs = [(default_actor, uc)]
            structured = [
                {
                    "name": uc,
                    "actor": default_actor,
                    "main_scenario": "",
                    "extensions": "",
                    "stakeholders": "",
                }
            ]

        secondary = self._secondary_actors_from_stakeholders(structured)
        for sa in secondary:
            if sa not in actors:
                actors.append(sa)

        return {
            "actors": actors,
            "use_cases": use_cases,
            "relation_pairs": relation_pairs,
            "secondary_actors": secondary,
            "structured": structured,
            "relations": [f"{a} ..> ({uc})" for a, uc in relation_pairs],
        }

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

    def _extract_multiline_field(self, block: str, field_name: str) -> str:
        """Field value until the next recognized Cockburn-style header line."""
        next_headers = (
            "Use Case Name",
            "Primary Actor",
            "Stakeholders and Interests",
            "Preconditions",
            "Postconditions",
            "Main Success Scenario",
            "Extensions",
            "Special Requirements",
            "Frequency of Occurrence",
            "Assumptions",
        )
        others = [h for h in next_headers if h.lower() != field_name.lower()]
        alt = "|".join(re.escape(h) for h in others)
        pattern = rf"{re.escape(field_name)}\s*:\s*(.*?)(?=\n(?:{alt})\s*:|\Z)"
        match = re.search(pattern, block, flags=re.IGNORECASE | re.DOTALL)
        if not match:
            return ""
        raw = match.group(1).strip()
        raw = re.sub(r"^\*+\s*|\s*\*+$", "", raw)
        return " ".join(raw.split())

    @staticmethod
    def _secondary_actors_from_stakeholders(structured: List[Dict[str, str]]) -> List[str]:
        """Derive supporting-system actors from Cockburn stakeholders text (no new scope)."""
        found: List[str] = []
        for item in structured:
            st = item.get("stakeholders") or ""
            m = re.search(r"Supporting actors \(if any\):\s*([^.]+)", st, flags=re.IGNORECASE)
            if not m:
                continue
            frag = (m.group(1) or "").strip()
            low = frag.lower()
            if re.match(r"^\s*none\b", low):
                continue
            if "payment" in low or "settlement" in low or "bank" in low:
                name = "External Payment Service"
            elif "notification" in low or "integration" in low or "endpoint" in low:
                name = "External Integration Service"
            else:
                continue
            if name not in found:
                found.append(name)
        return found

    @staticmethod
    def _dedupe_edges(edges: List[Tuple[str, str]]) -> List[Tuple[str, str]]:
        seen: Set[Tuple[str, str]] = set()
        out: List[Tuple[str, str]] = []
        for e in edges:
            if e in seen:
                continue
            seen.add(e)
            out.append(e)
        return out

    def _infer_extend_relations(
        self,
        use_cases: List[str],
        structured: List[Dict[str, str]],
        includes: List[Tuple[str, str]],
    ) -> List[Tuple[str, str]]:
        """Optional extension: extending UC ..> base UC when Alternate flows reference the base by title."""
        inc_set = set(includes)
        edges: List[Tuple[str, str]] = []
        seen: Set[Tuple[str, str]] = set()
        for item in structured:
            name = item.get("name") or ""
            raw_ext = item.get("extensions") or ""
            if "alternate" not in raw_ext.lower():
                continue
            text = self._norm_for_match(raw_ext)
            for other in use_cases:
                if other == name or len(other) < 12:
                    continue
                on = self._norm_for_match(other)
                if len(on) < 12:
                    continue
                if on not in text:
                    continue
                e = (name, other)
                if e in seen:
                    continue
                if e in inc_set or (other, name) in inc_set:
                    continue
                seen.add(e)
                edges.append(e)
        return edges

    def _infer_include_relations(
        self,
        use_cases: List[str],
        structured: List[Dict[str, str]],
    ) -> List[Tuple[str, str]]:
        """
        Base ..> Included <<include>> when the base use case's main scenario text
        contains the full title of another use case (conservative, avoids spurious edges).
        """
        if len(use_cases) < 2:
            return []
        edges: List[Tuple[str, str]] = []
        seen: Set[Tuple[str, str]] = set()

        for item in structured:
            base = item.get("name") or ""
            text = self._norm_for_match(item.get("main_scenario") or "")
            if not base or not text:
                continue
            for other in use_cases:
                if other == base:
                    continue
                if len(other) < 14:
                    continue
                key = self._norm_for_match(other)
                if len(key) < 14:
                    continue
                if key in text:
                    pair = (base, other)
                    if pair not in seen:
                        seen.add(pair)
                        edges.append(pair)
        return edges

    @staticmethod
    def _norm_for_match(s: str) -> str:
        return re.sub(r"\s+", " ", (s or "").lower().strip())

    @staticmethod
    def _escape_comment(s: str) -> str:
        return str(s).replace("'", "`")[:80]

    def _normalize_actor(self, actor: str) -> str:
        actor = " ".join(actor.split()).strip()
        low = actor.lower()
        if low in ("admin", "administrator", "sysadmin"):
            return "Administrator"
        if low in ("user", "primary user", "end user", "end-user", "customer user"):
            return "User"
        if low == "guest":
            return "Guest"
        if not actor:
            return "User"
        return actor[0].upper() + actor[1:] if len(actor) > 1 else actor.upper()

    def _normalize_use_case(self, name: str) -> str:
        name = " ".join(name.split())
        if not name:
            return name
        return name[0].upper() + name[1:] if len(name) > 1 else name.upper()
