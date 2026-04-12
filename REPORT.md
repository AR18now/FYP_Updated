## System Report (Layman Summary)

### What is implemented
- **Full end-to-end pipeline** that turns vague requirements into SRS + evaluation + use cases + diagram.
- **Input processing**
  - Cleans noisy text (removes markup/code/tags and normalizes whitespace).
  - Detects ambiguous words/phrases (e.g., *fast, efficient, user-friendly, quickly, soon*).
  - Highlights ambiguous terms and suggests measurable rewrites.
  - Refines + classifies requirements into:
    - Functional Requirements
    - Non-Functional Requirements
    - User Requirements
    - System Requirements
- **RAG (Retrieval-Augmented Generation)**
  - Loads a knowledge base (templates, sample SRS docs, guidelines).
  - Chunks documents and embeds them.
  - Retrieves relevant context using FAISS/Chroma (with fallback if not installed).
- **SRS generation**
  - Generates an IEEE 830-style SRS using retrieved RAG context.
  - Can produce structured Markdown/text SRS output.
- **Evaluation**
  - **IEEE-style metrics engine**: completeness (section coverage), clarity, structure, relevance.
  - **Manual/custom metrics engine** (rule-based):
    - clarity (readability by sentence length)
    - ambiguity (vague term rate)
    - testability (numeric constraints in NFR)
    - completeness (FR+NFR count target)
    - consistency (FR ≥ Actors)
    - relevance (domain keyword coverage; auto-inferred if not provided)
- **Use case outputs**
  - Generates textual use cases in **Alistair Cockburn format** from SRS functional requirements.
  - Generates **PlantUML use case diagram** code.
  - Automatically renders a PNG if PlantUML CLI is installed (otherwise saves `.puml`).
- **Main runner**
  - `main.py` runs the full pipeline and **prints every step**.

### Overall flow (what happens when you run it)
1. **Input**: user provides vague requirements (text / JSON file / stdin).
2. **Cleaning**: noise is removed and text is normalized.
3. **Ambiguity detection**: vague terms are identified + improved suggestions are generated.
4. **Refinement**: requirements are converted into structured JSON and classified.
5. **RAG retrieval**: KB is loaded, embedded, and relevant context is retrieved.
6. **SRS generation**: model generates SRS using retrieved context.
7. **Evaluation**: both metric engines compute and print scores.
8. **Textual use cases**: functional requirements are converted into Cockburn textual use cases.
9. **Use case diagram**: PlantUML diagram is generated and rendered (if possible).

### What is required from your side
- **Provide requirements input**
  - `--input_text "..."` or `--input_file requirements.json` (or pipe stdin).
- **Provide a knowledge base** (recommended for good RAG)
  - Put IEEE templates / sample SRS / guidelines under a folder and pass it via `--kb_path`.
- **Model access**
  - Ensure generation credentials are set (e.g., `REPLICATE_API_TOKEN`) for the existing model generator.
- **Optional (for best output quality)**
  - Install one of: FAISS / Chroma, and sentence-transformers (otherwise fallback retrieval works but is weaker).
  - Install PlantUML CLI if you want automatic PNG diagram rendering.
  - Provide domain keywords for relevance scoring (otherwise the system guesses keywords from input).

### What is remaining (gaps / improvements)
- **Dedicated actor extraction module** (actors are currently mostly inferred from text/keywords and use cases).
- **Better cleaning for tables/PDF artifacts** (current cleaning is strong for noisy text, but not a full table parser).
- **More advanced grammar/readability scoring** (current clarity metric is heuristic, not a full grammar checker).
- **More robust domain relevance** (keyword lists are best supplied by you per project domain).
- **API/frontend wiring for all new outputs** (pipeline works via CLI; API endpoints can be extended to expose everything).
- **Automated tests/benchmarks** for consistent evaluation across datasets.

### How to run (example)
```bash
python main.py --input_text "The system should be fast and user friendly" --kb_path data/knowledge_base
```

