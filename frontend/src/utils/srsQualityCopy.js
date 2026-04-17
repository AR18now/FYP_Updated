/**
 * Layman-friendly labels for SRS quality signals (hallucination heuristics + document-quality scores).
 * Numeric keys match the backend quality evaluator (0 = poor, 1 = best).
 */

export const HALLUCINATION_HELP = {
  confidence:
    'Roughly how much of the wording from your original requirements shows up again in the generated SRS. It is not a guarantee the text is correct—only how much overlap there is.',
  termOverlap:
    'Count of meaningful words from your input that also appear in the SRS. Higher overlap usually means the model stayed closer to what you wrote.',
  flagged:
    'Automatic checks that might deserve a second look—for example the SRS being much longer than your input, or extra technical terms you did not mention.',
};

export const FLAG_TYPE_LABELS = {
  excessive_detail: 'Length vs your input',
  unspecified_technical_details: 'Technical terms not in your input',
  unsupported_functional_requirements: 'Requirements weakly tied to your text',
};

/** Subset of scores to show in the SRS viewer panel (labels + short help). */
export const DOC_QUALITY_METRIC_ROWS = [
  {
    key: 'overall_score',
    label: 'Overall document quality',
    help: 'Single blended score using the same weighting as the offline document-quality evaluation. Higher means the SRS looks more complete and structured.',
  },
  {
    key: 'completeness_metric',
    label: 'Expected sections present',
    help: 'Whether typical SRS parts appear—introduction, overall description, and specific requirements.',
  },
  {
    key: 'fr_coverage',
    label: 'Functional requirements signal',
    help: 'How strongly the text reads like functional requirements (shall/must, FR labels, use cases).',
  },
  {
    key: 'nfr_coverage',
    label: 'Non-functional requirements signal',
    help: 'Coverage of qualities like performance, security, reliability, usability.',
  },
  {
    key: 'verifiability_metric',
    label: 'Testable wording',
    help: 'How often requirements are stated in a way you could later test or verify.',
  },
  {
    key: 'clarity_metric',
    label: 'Precision (less vague phrasing)',
    help: 'Inverse of fuzzy wording—fewer “easy/robust/quick” style terms scores higher.',
  },
];

/** @deprecated Use DOC_QUALITY_METRIC_ROWS */
export const KB_METRICS_DISPLAY = DOC_QUALITY_METRIC_ROWS;

export function formatPct01(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  return `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
}

export function flagTypeLabel(type) {
  if (!type) return 'Check';
  return FLAG_TYPE_LABELS[type] || type.replace(/_/g, ' ');
}
