/**
 * Application Configuration
 * 
 * This file contains configuration settings for the frontend application.
 * In production, these values can be overridden using environment variables.
 */

// API Base URL - can be overridden by REACT_APP_API_URL environment variable
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

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
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
};

