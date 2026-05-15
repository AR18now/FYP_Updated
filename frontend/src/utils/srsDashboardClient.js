import axios from 'axios';
import config from '../config';

/**
 * Small axios helpers for the “SRS dashboard insights” bundle (KB metrics, hallucination snapshot, etc.).
 * Primary + alternate URLs exist because some deployments only expose the legacy path.
 *
 * POST body for SRS dashboard / quality insights endpoints — tries primary URL then alternate.
 */
export async function postSrsDashboardWithFallback(body) {
  const urls = [config.API_ENDPOINTS.SRS_DASHBOARD_INSIGHTS, config.API_ENDPOINTS.SRS_DASHBOARD_INSIGHTS_ALT].filter(
    Boolean
  );
  const uniq = [...new Set(urls)];
  let lastErr = null;
  for (const url of uniq) {
    try {
      return await axios.post(url, body);
    } catch (e) {
      lastErr = e;
      const st = e?.response?.status;
      if (st === 404 || st === 405) continue;
      throw e;
    }
  }
  throw lastErr;
}

/** Build a newline-separated prompt string from pipeline `results` shapes. */
export function collectPromptFromResults(resultsData) {
  if (!resultsData) return '';
  const list = Array.isArray(resultsData)
    ? resultsData
    : Array.isArray(resultsData.results)
      ? resultsData.results
      : [resultsData];
  return list
    .map((item) => item?.original_text || item?.content || item?.text || item?.requirement || '')
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join('\n\n');
}
