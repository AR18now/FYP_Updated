/**
 * Application Configuration
 * 
 * This file contains configuration settings for the frontend application.
 * In production, these values can be overridden using environment variables.
 */

// Main API: use REACT_APP_API_URL when set (e.g. split deploy). Otherwise in production builds
// use same-origin relative URLs so /api/* hits the Flask app (e.g. Render). CRA dev server still
// needs localhost:8000 because UI runs on :3000.
function trimSlash(s) {
  return String(s).replace(/\/$/, '');
}
const _rawApi = process.env.REACT_APP_API_URL;
const API_BASE_URL =
  _rawApi != null && String(_rawApi).trim() !== ''
    ? trimSlash(_rawApi)
    : process.env.NODE_ENV === 'production'
      ? ''
      : 'http://localhost:8000';

/** SRS AI evaluation microservice (FastAPI) — set REACT_APP_SRS_EVAL_URL when deployed */
const _rawEval = process.env.REACT_APP_SRS_EVAL_URL;
const SRS_EVAL_BASE_URL =
  _rawEval != null && String(_rawEval).trim() !== ''
    ? trimSlash(_rawEval)
    : process.env.NODE_ENV === 'production'
      ? ''
      : 'http://localhost:8010';

// API endpoints
const API_ENDPOINTS = {
  HEALTH: `${API_BASE_URL}/api/health`,
  PROCESS_SINGLE: `${API_BASE_URL}/api/process-single`,
  PROCESS_AND_GENERATE_SRS: `${API_BASE_URL}/api/process-and-generate-srs`,
  PROCESS_AUDIO: `${API_BASE_URL}/api/process-audio`,
  TRANSCRIBE_AUDIO: `${API_BASE_URL}/api/transcribe-audio`,
  PROCESS_BATCH: `${API_BASE_URL}/api/process-batch`,
  CLARIFY_REQUIREMENTS: `${API_BASE_URL}/api/clarify-requirements`,
  CLARIFICATION_COPILOT: `${API_BASE_URL}/api/clarification-copilot`,
  CLARIFICATION_COPILOT_TURN: `${API_BASE_URL}/api/clarification-copilot-turn`,
  GENERATE_SRS: `${API_BASE_URL}/api/generate-srs`,
  /** Same body as GENERATE_SRS; SSE stream with delta + done events (see `utils/srsStream.js`) */
  GENERATE_SRS_STREAM: `${API_BASE_URL}/api/generate-srs-stream`,
  GENERATE_SRS_COMPARE: `${API_BASE_URL}/api/generate-srs-compare`,
  RTM_ANALYZE: `${API_BASE_URL}/api/rtm-analyze`,
  /** Document quality metrics: POST { raw_text } to /api/evaluate-srs-kb-metrics (not stored on generate-srs JSON) */
  EVALUATE_SRS_QUALITY_METRICS: `${API_BASE_URL}/api/evaluate-srs-kb-metrics`,
  GENERATE_USECASES: `${API_BASE_URL}/api/generate-usecases`,
  DOWNLOAD_TEXTUAL_USECASES_PDF: `${API_BASE_URL}/api/download-textual-usecases-pdf`,
  DOWNLOAD_USECASE_DIAGRAM_PDF: `${API_BASE_URL}/api/download-usecase-diagram-pdf`,
  GENERATE_SRS_PDF: `${API_BASE_URL}/api/generate-srs-pdf`,
  GENERATE_SRS_DOCX: `${API_BASE_URL}/api/generate-srs-docx`,
  GENERATE_SRS_FROM_AUDIO: `${API_BASE_URL}/api/generate-srs-from-audio`,
  GENERATE_SRS_FROM_FILE: `${API_BASE_URL}/api/generate-srs-from-file`,
  STATS: `${API_BASE_URL}/api/stats`,
  CLEANUP: `${API_BASE_URL}/api/cleanup`,
  EXPERT_REVIEW_SUBMIT: `${API_BASE_URL}/api/expert-review/submit`,
  EXPERT_REVIEW_REQUESTS: `${API_BASE_URL}/api/expert-review/requests`,
  expertReviewRequest: (id) => `${API_BASE_URL}/api/expert-review/requests/${encodeURIComponent(id)}`,
  expertReviewMessages: (id) =>
    `${API_BASE_URL}/api/expert-review/requests/${encodeURIComponent(id)}/messages`,
  /** POST { prompt, srs_text } — metrics on SRS already generated in the app */
  SRS_EVAL_EXISTING: `${SRS_EVAL_BASE_URL}/api/evaluate-existing`,
  SRS_EVAL_HISTORY: `${SRS_EVAL_BASE_URL}/api/history`,
  SRS_EVAL_HEALTH: `${SRS_EVAL_BASE_URL}/health`,
};

export default {
  API_BASE_URL,
  SRS_EVAL_BASE_URL,
  API_ENDPOINTS,
};

