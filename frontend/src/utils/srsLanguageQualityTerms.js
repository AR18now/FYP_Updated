/**
 * ARM-style language quality terms (IEEE / requirements-writing heuristics).
 * Shared by SRS metrics page previews and SRS viewer deep-link highlighting.
 */
export const ARM_TERMS = {
  imperative: ['shall', 'must', 'is required to', 'are applicable', 'are to', 'responsible for', 'will', 'should'],
  continuance: ['below:', 'as follows:', 'following:', 'listed:', 'in particular:', 'support:', 'and', ':'],
  directive: ['e.g.', 'i.e.', 'for example', 'figure', 'table', 'note:'],
  option: ['can', 'may', 'optionally'],
  weakPhrase: [
    'adequate',
    'as appropriate',
    'be able to',
    'be capable of',
    'capability of',
    'capability to',
    'effective',
    'as required',
    'normal',
    'provide for',
    'timely',
    'easy to',
  ],
  incomplete: ['tbd', 'tbs', 'tbe', 'tbc', 'tbr', 'not defined', 'not determined', 'but not limited to', 'as a minimum', '######'],
};

export const HIGHLIGHTABLE_ARM_KEYS = new Set([
  'imperative_quality',
  'imperative_count',
  'continuance_quality',
  'continuance_count',
  'directive_quality',
  'directive_count',
  'option_quality',
  'option_count',
  'weak_phrase_quality',
  'weak_phrase_count',
  'incomplete_quality',
  'incomplete_count',
]);

/** ARM *_quality rows only — metrics table uses these for in-page SRS highlighting (not *_count). */
export const HIGHLIGHTABLE_ARM_QUALITY_KEYS = new Set(
  [...HIGHLIGHTABLE_ARM_KEYS].filter((k) => k.endsWith('_quality'))
);

export const HIGHLIGHTABLE_HALLUCINATION_KEYS = new Set([
  'ai_hallucination_quality',
  'has_hallucinations',
  'confidence_score',
  'term_overlap',
  'total_original_terms',
]);

export const ARM_METRIC_TO_GROUP = {
  imperative_quality: 'imperative',
  imperative_count: 'imperative',
  continuance_quality: 'continuance',
  continuance_count: 'continuance',
  directive_quality: 'directive',
  directive_count: 'directive',
  option_quality: 'option',
  option_count: 'option',
  weak_phrase_quality: 'weakPhrase',
  weak_phrase_count: 'weakPhrase',
  incomplete_quality: 'incomplete',
  incomplete_count: 'incomplete',
};

export function collectHallucinationMetricTerms(srsData, aiEval) {
  const terms = [];
  const hall = srsData?.hallucination_analysis || srsData?.sections?._hallucination_analysis || {};
  const flags = Array.isArray(hall?.flagged_sections) ? hall.flagged_sections : [];
  flags.forEach((flag) => {
    if (Array.isArray(flag?.terms)) {
      flag.terms.forEach((t) => terms.push(String(t || '').trim()));
    }
    if (typeof flag?.message === 'string' && flag.message.trim()) {
      terms.push(flag.message.trim().slice(0, 120));
    }
    if (Array.isArray(flag?.requirements)) {
      flag.requirements.forEach((req) => {
        const desc = String(req?.description || '').trim();
        if (desc) terms.push(desc.slice(0, 120));
      });
    }
  });

  const aiHallMetric = Array.isArray(aiEval?.metrics)
    ? aiEval.metrics.find((m) => m?.key === 'hallucination')
    : null;
  const examples = Array.isArray(aiHallMetric?.highlights?.examples) ? aiHallMetric.highlights.examples : [];
  examples.forEach((ex) => {
    const t = String(ex?.text || '').trim();
    if (t) terms.push(t.slice(0, 140));
  });

  return Array.from(new Set(terms.filter((t) => t.length >= 4)));
}
