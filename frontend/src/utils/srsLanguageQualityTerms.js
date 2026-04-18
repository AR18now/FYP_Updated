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

/** ARM score rows (0–1) that open the term-highlight preview on the metrics page. */
export const HIGHLIGHTABLE_ARM_SCORE_KEYS = new Set([
  'imperative',
  'continuance',
  'directive',
  'option',
  'weak_phrase',
  'incomplete',
]);

export const HIGHLIGHTABLE_ARM_KEYS = new Set([
  ...HIGHLIGHTABLE_ARM_SCORE_KEYS,
  'imperative_count',
  'continuance_count',
  'directive_count',
  'option_count',
  'weak_phrase_count',
  'incomplete_count',
]);

export const HIGHLIGHTABLE_HALLUCINATION_KEYS = new Set([
  'ai_hallucination_quality',
  'has_hallucinations',
  'confidence_score',
  'term_overlap',
  'total_original_terms',
]);

export const ARM_METRIC_TO_GROUP = {
  imperative: 'imperative',
  imperative_count: 'imperative',
  continuance: 'continuance',
  continuance_count: 'continuance',
  directive: 'directive',
  directive_count: 'directive',
  option: 'option',
  option_count: 'option',
  weak_phrase: 'weakPhrase',
  weak_phrase_count: 'weakPhrase',
  incomplete: 'incomplete',
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
