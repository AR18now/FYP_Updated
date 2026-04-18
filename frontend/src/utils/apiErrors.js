/**
 * Consistent extraction of user-visible messages from axios / fetch failures.
 * Keeps UI copy stable and surfaces server `error` / `message` fields when present.
 */

const MAX_LEN = 600;

function truncate(s) {
  const t = String(s).trim();
  if (t.length <= MAX_LEN) return t;
  return `${t.slice(0, MAX_LEN)}…`;
}

/**
 * @param {unknown} error - Typically an AxiosError
 * @param {string} [fallback]
 * @returns {string}
 */
export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error == null) return fallback;

  if (error.code === 'ERR_CANCELED' || error.message === 'canceled') {
    return 'Request was cancelled.';
  }

  if (error.code === 'ECONNABORTED') {
    return 'Request timed out. Check your connection or try again with a smaller input.';
  }

  const status = error.response?.status;
  const data = error.response?.data;

  if (data instanceof Blob) {
    return fallback;
  }

  if (typeof data === 'string' && data.trim()) {
    const s = data.trim();
    if (/<!doctype html>|<html[\s>]/i.test(s)) {
      if (status === 404) {
        return 'The server returned an HTML page instead of JSON—check REACT_APP_API_URL and that the Flask API is running.';
      }
      if (status === 405) {
        return 'The API returned “method not allowed” as an HTML page. That usually means POST hit the SPA/catch-all route: restart `python api_server.py` after pulling updates, and set REACT_APP_API_URL=http://localhost:8000 when using `npm start` on port 3000.';
      }
      return 'The server returned an HTML error page instead of JSON. Check REACT_APP_API_URL and that the Flask API is running.';
    }
    return truncate(data);
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const ve = data.validation_errors;
    if (Array.isArray(ve) && ve.length > 0) {
      const strings = ve.filter((x) => typeof x === 'string' && x.trim());
      if (strings.length > 0) {
        const detail = strings.join(' ');
        if (typeof data.error === 'string' && data.error.trim() && !detail.includes(data.error.trim())) {
          return truncate(`${data.error.trim()}: ${detail}`);
        }
        return truncate(detail);
      }
    }
    if (typeof data.error === 'string' && data.error.trim()) {
      return truncate(data.error);
    }
    if (typeof data.message === 'string' && data.message.trim()) {
      return truncate(data.message);
    }
    if (typeof data.detail === 'string' && data.detail.trim()) {
      return truncate(data.detail);
    }
  }

  if (!error.response && error.request) {
    return 'Cannot reach the API server. Start the backend (e.g. port 8000) or set REACT_APP_API_URL if it runs elsewhere.';
  }

  if (status === 413) {
    return 'Upload or request body is too large for the server limit.';
  }
  if (status === 404 && error.config?.url) {
    return `Resource not found (${truncate(error.config.url)}).`;
  }
  if (status === 405) {
    return 'The API rejected this request (HTTP 405). Restart the Flask server after updating, or set REACT_APP_API_URL=http://localhost:8000 so the browser does not POST to the React dev server by mistake.';
  }
  if (status === 502 || status === 503) {
    return 'Service temporarily unavailable. Try again shortly.';
  }

  if (typeof error.message === 'string' && error.message && !error.message.startsWith('Request failed with status code')) {
    return truncate(error.message);
  }

  if (status) {
    return `Request failed (${status}). ${fallback}`;
  }

  return fallback;
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isNetworkOrServerDown(error) {
  if (!error || error.response) return false;
  return !!error.request;
}
