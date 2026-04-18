/**
 * Application Configuration
 * 
 * This file contains configuration settings for the frontend application.
 * In production, these values can be overridden using environment variables.
 */

// Main API: Docker often bakes REACT_APP_API_URL=http://localhost:8000 — in the browser on a real
// host (e.g. onrender.com) we must use same-origin '' instead, or health checks hit the user's PC.
function trimSlash(s) {
  return String(s).replace(/\/$/, '');
}

function resolveApiBaseUrl() {
  const fromEnv =
    process.env.REACT_APP_API_URL != null && String(process.env.REACT_APP_API_URL).trim() !== ''
      ? trimSlash(process.env.REACT_APP_API_URL)
      : '';
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const local = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!local) {
      if (!fromEnv || /localhost|127\.0\.0\.1/.test(fromEnv)) {
        return '';
      }
      return fromEnv;
    }
  }
  if (fromEnv) return fromEnv;
  return process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8000';
}

function resolveSrsEvalBaseUrl() {
  const fromEnv =
    process.env.REACT_APP_SRS_EVAL_URL != null && String(process.env.REACT_APP_SRS_EVAL_URL).trim() !== ''
      ? trimSlash(process.env.REACT_APP_SRS_EVAL_URL)
      : '';
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const local = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!local) {
      if (!fromEnv || /localhost|127\.0\.0\.1/.test(fromEnv)) {
        return '';
      }
      return fromEnv;
    }
  }
  if (fromEnv) return fromEnv;
  return process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8010';
}

const API_BASE_URL = resolveApiBaseUrl();
const SRS_EVAL_BASE_URL = resolveSrsEvalBaseUrl();

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
  /** Optional extra doc-style scores (NOT RAG/KB retrieval). Off by default; see `ENABLE_SRS_DOC_QUALITY_POST`. */
  EVALUATE_SRS_QUALITY_METRICS: `${API_BASE_URL}/api/evaluate-srs-kb-metrics`,
  /** POST { srs, prompt } — bundled KB metrics, optional srs_eval, hallucination block, summary for SRS page */
  SRS_DASHBOARD_INSIGHTS: `${API_BASE_URL}/api/srs-dashboard-insights`,
  /** Same handler as SRS_DASHBOARD_INSIGHTS; used as fallback if the primary path returns 404/405 */
  SRS_DASHBOARD_INSIGHTS_ALT: `${API_BASE_URL}/api/evaluate-srs-dashboard`,
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

/**
 * Extra POST to /api/evaluate-srs-kb-metrics from SRS viewer (structural/wording scores only).
 * Generation already returns verification_report / manual_metrics — set REACT_APP_ENABLE_SRS_DOC_QUALITY=true to enable this panel.
 */
const ENABLE_SRS_DOC_QUALITY_POST =
  typeof process.env.REACT_APP_ENABLE_SRS_DOC_QUALITY === 'string' &&
  process.env.REACT_APP_ENABLE_SRS_DOC_QUALITY.toLowerCase() === 'true';

export default {
  API_BASE_URL,
  SRS_EVAL_BASE_URL,
  API_ENDPOINTS,
  ENABLE_SRS_DOC_QUALITY_POST,
};

