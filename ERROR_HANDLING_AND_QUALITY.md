# Error handling and quality improvements

This document summarizes changes applied to improve **robustness**, **consistent error reporting**, and **basic quality checks** across the Req2Design / FYP project (Flask API + React frontend).

---

## 1. Frontend: shared API error helper

**New file:** `frontend/src/utils/apiErrors.js`

- **`getApiErrorMessage(error, fallback)`** — Single place to turn axios failures into user-facing text:
  - Reads `response.data.error`, `message`, or `detail` when the server returns JSON.
  - Handles **timeouts** (`ECONNABORTED`), **cancelled** requests, and **network / server unreachable** (request sent but no response).
  - Maps common HTTP statuses (413, 404, 502, 503) to clearer short messages.
  - Truncates very long server strings to avoid UI blow-ups.

**Updated:** `frontend/src/utils/downloadHelpers.js` — `messageFromAxiosBlobError` now uses `getApiErrorMessage` for non-blob fallbacks so PDF/docx failures stay consistent with JSON errors.

---

## 2. Frontend: components and pages wired to the helper

Axios `catch` blocks and alerts were updated to use **`getApiErrorMessage`** (or the improved blob helper) so users see **actionable** messages instead of generic text:

| Area | File(s) |
|------|---------|
| SRS generation + use cases | `ResultsView.js` |
| Model vs RAG compare + use cases | `SRSViewer.js` |
| RTM analysis | `RTMPage.jsx` |
| Expert review queue | `ExpertReviewPage.jsx` |
| Textual use cases + diagram | `TextualUseCasesPage.js`, `UseCaseDiagramPage.js` |
| Main pipeline (clarify, copilot turn, direct SRS from audio/file, combined processing) | `RequirementsInput.js` |

### Processing results: visible SRS errors

**`ResultsView.js`** — SRS generation failures were previously only logged to the console. The UI now:

- Clears/resets a dedicated **`srsGenError`** state when retrying.
- Shows an **inline alert** (role=`alert`) when generation fails or the response is empty.

---

## 3. Frontend: storage and error boundary

**`frontend/src/utils/storage.js`**

- **`getSRSById`** — Returns `null` if `documentId` is missing or blank (avoids pointless scans / odd matches).
- **`deleteSRS`** — Returns `false` early for missing/blank ids.

**`frontend/src/components/ErrorBoundary.js`**

- **`componentDidCatch`** — Logs a **safe string** when the thrown value is not an `Error` instance.
- **Development details** — Renders `stack` for real `Error` objects; otherwise stringifies unknown thrown values.

---

## 4. Backend: request size limit and HTTP error handlers

**`api_server.py`**

- **`MAX_CONTENT_LENGTH`** — Set from environment variable **`MAX_CONTENT_MB`** (default **80**, clamped between 1 and 500). Prevents unbounded uploads from exhausting memory/disk.
- **`RequestEntityTooLarge` handler** — For `/api/*` routes, returns JSON:  
  `{ "error": "... exceeds server limit (... MB) ..." }` with status **413**.
- **`BadRequest` handler** — For `/api/*` routes:
  - Malformed JSON → `{ "error": "Invalid or malformed JSON body." }` with **400**.
  - Other bad requests use Werkzeug’s description when useful.

Startup logs now print the configured **max request body size** when running `api_server.py` directly.

---

## 5. Backend: expert review API hardening

**`api_server.py`** (expert review routes)

- **`POST /api/expert-review/submit`** — Uses **`get_json(silent=True)`** and validates a JSON **object** before use.
- **`GET /api/expert-review/requests`** — Rejects invalid `status` query values with **400** (`pending` | `reviewed` | `all` only).
- **`GET` / `PATCH` …/requests/&lt;id&gt;** — Validates review ids with a **strict pattern** (`er_` + hex) to avoid odd paths or abuse.
- **`_save_expert_reviews`** — Returns **bool**; on **OSError** logs and returns `False`. Submit and complete return **500** with a clear JSON error if the queue file cannot be written (permissions / disk).

---

## 6. Quality measures (what “quality” means here)

| Measure | Implementation |
|--------|----------------|
| **Consistent API error shape** | Prefer `{ "error": "..." }` on API routes; frontend reads it via `getApiErrorMessage`. |
| **User-visible failures** | Fewer silent failures; SRS generation errors surfaced on Results view. |
| **Input guards** | Storage helpers reject empty ids; expert review validates JSON body and id format. |
| **Operational limits** | Configurable max upload/body size; 413 responses documented in logs. |
| **Safer diagnostics** | Error boundary handles non-Error throws; dev stack traces preserved for real Errors. |

---

## 7. What was *not* changed (scope)

- No full replacement of every `alert()` in the app (some remain for quick feedback; they now often use richer messages via the helpers above).
- No new automated test suite in this pass (manual verification: `python -m py_compile api_server.py`, `npm run build` in `frontend/`).
- **Authentication/authorization** for expert review is still a **demo** model (see comments in API); production would add server-side sessions/JWT and roles.

---

## 8. How to verify locally

1. **Backend:** `python api_server.py` — confirm startup line shows max body size.
2. **Frontend:** `cd frontend && npm run build` — ensure compile succeeds.
3. **Failure paths:** Stop the API and trigger processing or expert review — UI should mention unreachable API / connection issues instead of a bare “Network Error” where updated.

---

*Last updated: error-handling and quality pass documented for FYP / Req2Design.*
