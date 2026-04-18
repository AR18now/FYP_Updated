/**
 * Layman-friendly labels for SRS quality signals (flexible alignment monitoring + document-quality scores).
 * Numeric keys match the backend quality evaluator (0 = poor, 1 = best).
 */

export const HALLUCINATION_HELP = {
  confidence:
    'Roughly how much vocabulary from your original requirements also appears in the generated SRS. It measures overlap, not factual correctness.',
  /** Shown when confidence_score is low — overlaps with grounding penalties for review-tier signals. */
  confidenceLowExample:
    'A low score usually means little word overlap with your input and/or review-tier monitoring notes (for example FR lines that look weakly tied to your text). It is not a literal “error probability.” Expanding a short brief into a full SRS is normal—use this to choose where to read carefully, not as a pass/fail verdict.',
  termOverlap:
    'Count of meaningful words from your input that also appear in the SRS. Higher overlap usually means the draft stayed closer to your wording.',
  flagged:
    'Review-tier prompts: places the monitor suggests comparing to your source. Informational-only notes (length, a few extra tech words) are typical for generated specs and do not imply mistakes.',
};

export const FLAG_TYPE_LABELS = {
  expansion_vs_input: 'Length vs your input (usually expected)',
  excessive_detail: 'Length vs your input (usually expected)',
  unspecified_technical_details: 'Extra technical vocabulary',
  unsupported_functional_requirements: 'FR text vs your input',
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
