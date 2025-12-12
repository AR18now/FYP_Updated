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
  PROCESS_AUDIO: `${API_BASE_URL}/api/process-audio`,
  TRANSCRIBE_AUDIO: `${API_BASE_URL}/api/transcribe-audio`,
  PROCESS_BATCH: `${API_BASE_URL}/api/process-batch`,
  GENERATE_SRS: `${API_BASE_URL}/api/generate-srs`,
  GENERATE_SRS_PDF: `${API_BASE_URL}/api/generate-srs-pdf`,
  GENERATE_SRS_FROM_AUDIO: `${API_BASE_URL}/api/generate-srs-from-audio`,
  GENERATE_SRS_FROM_FILE: `${API_BASE_URL}/api/generate-srs-from-file`,
  STATS: `${API_BASE_URL}/api/stats`,
  CLEANUP: `${API_BASE_URL}/api/cleanup`,
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
};

