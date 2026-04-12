# SRS AI evaluation microservice

FastAPI service used by **Req2Design** from the **SRS document** screen: run AI metrics on the SRS your model **already** generated (no second generation).

## Setup

```bash
cd srs_eval_service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

First run downloads the `all-MiniLM-L6-v2` embedding model.

## Run

```bash
cd srs_eval_service
uvicorn app:app --host 0.0.0.0 --port 8010 --reload
```

## API

- `POST /api/evaluate-existing` — body: `{ "prompt": "<joined requirements>", "srs_text": "<raw SRS>" }`
- Metrics: instruction adherence, hallucination, context understanding, coherence. **Consistency** and **robustness** are marked N/A (they need multiple model runs).

## Frontend

With the service on port **8010**, open **SRS document** in the app and expand **AI evaluation metrics** → **Run metrics on this SRS**.

Optional: `REACT_APP_SRS_EVAL_URL=http://localhost:8010` for the React dev server.

## Env

- `REPLICATE_API_TOKEN` — only needed if you use `srs_eval/generator.py` for other scripts; **evaluate-existing** does not call Replicate.
