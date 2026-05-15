import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2, FileText, RefreshCw, AlertTriangle, BarChart3 } from 'lucide-react';
import config from '../config';
import PresentationRouteSplash from '../components/PresentationRouteSplash';
import {
  ARM_TERMS,
  ARM_METRIC_TO_GROUP,
  HIGHLIGHTABLE_ARM_SCORE_KEYS,
  HIGHLIGHTABLE_HALLUCINATION_KEYS,
  collectHallucinationMetricTerms,
} from '../utils/srsLanguageQualityTerms';
import { SRS_SECTION_METRIC_THRESHOLDS, SRS_SECTION_METRIC_THRESHOLD_FOOTNOTE } from '../utils/srsQualityCopy';

/**
 * Deep quality dashboard: merges verification_report metrics, hallucination heuristics, optional
 * `/api/srs-eval-existing` AI scores, ARM phrase checks, and client-side ROUGE/BERT proxies.
 * URL `?focus=` deep-links a metric row for demos.
 */

/** Prefer raw_text; fall back to stringified sections only when the body is extremely short. */
function srsPlainText(srs) {
  if (!srs) return '';
  const raw = String(srs.raw_text || srs.sections?._raw_text || '').trim();
  if (raw.length >= 80) return raw;
  try {
    return JSON.stringify(srs.sections || {}, null, 0);
  } catch {
    return raw;
  }
}

const METRIC_DESCRIPTIONS = {
  completeness: 'Shows whether required IEEE SRS sections are present and filled.',
  clarity: 'Shows how clear and unambiguous the wording appears.',
  structure: 'Shows whether section ordering and structure follow IEEE style.',
  relevance: 'Shows how close the SRS meaning is to your original input.',
  ambiguity: 'Shows how much vague language is present (higher is better = less ambiguity).',
  testability: 'Shows whether requirements include measurable conditions.',
  consistency: 'Shows whether requirements remain logically aligned with roles and scope.',
  conflict_score: 'Shows how free the SRS is from contradictory statements.',
  nfr_specificity: 'Shows whether non-functional requirements are specific and domain-grounded.',
  professional_style: 'Shows formality and technical writing quality.',
  has_hallucinations:
    'Review-tier alignment: true when monitoring suggests comparing specific spots (e.g. FR wording) to your input—not “the SRS hallucinated.”',
  confidence_score:
    'Heuristic vocabulary overlap between your input and the SRS, adjusted for review-tier notes (not a statistical confidence interval).',
  term_overlap: 'Count of important source terms found again in generated SRS.',
  total_original_terms: 'Total important source terms used as grounding reference.',
  instruction_adherence: 'How well the SRS follows expected SRS-style instruction behavior.',
  ai_hallucination_quality: 'How many requirement-like lines stay supported by your original prompt.',
  context_understanding: 'How well the document captures your business context and intent.',
  coherence: 'How well sections read as one coherent and connected document.',
  rouge_l: 'Word-sequence overlap between your input and generated SRS (recall-oriented).',
  bertscore_f1: 'Semantic similarity proxy score using embedding-based alignment.',
  section_precision: 'Share of detected SRS headings that match expected IEEE heading set.',
  section_recall: 'Share of expected IEEE headings actually present in the SRS.',
  section_f1: 'Balanced score combining section precision and recall.',
  imperative: 'How strongly requirements use enforceable wording such as shall/must.',
  continuance: 'Lower use of continuation-dependent phrasing (below/as follows/following).',
  directive: 'Lower use of external-reference directives (e.g., figures/tables/notes).',
  option: 'Lower optionality language (can/may/optionally).',
  weak_phrase: 'Lower use of weak/non-testable wording.',
  incomplete: 'Lower use of placeholders or incomplete requirement markers.',
  imperative_count: 'Raw count of imperative terms found in the SRS.',
  continuance_count: 'Raw count of continuance phrases found in the SRS.',
  directive_count: 'Raw count of directive phrases found in the SRS.',
  option_count: 'Raw count of optionality phrases found in the SRS.',
  weak_phrase_count: 'Raw count of weak phrases found in the SRS.',
  incomplete_count: 'Raw count of incompleteness markers found in the SRS.',
};
const EXPECTED_METRIC_KEYS = [
  'completeness',
  'clarity',
  'structure',
  'relevance',
  'ambiguity',
  'testability',
  'consistency',
  'conflict_score',
  'nfr_specificity',
  'professional_style',
  'has_hallucinations',
  'confidence_score',
  'term_overlap',
  'total_original_terms',
  'instruction_adherence',
  'ai_hallucination_quality',
  'context_understanding',
  'coherence',
  'rouge_l',
  'bertscore_f1',
  'section_precision',
  'section_recall',
  'section_f1',
  'imperative',
  'continuance',
  'directive',
  'option',
  'weak_phrase',
  'incomplete',
  'imperative_count',
  'continuance_count',
  'directive_count',
  'option_count',
  'weak_phrase_count',
  'incomplete_count',
];

/** Old `?focus=` values from when ARM score rows used a `_quality` suffix. */
const LEGACY_SRS_METRICS_FOCUS = {
  imperative_quality: 'imperative',
  continuance_quality: 'continuance',
  directive_quality: 'directive',
  option_quality: 'option',
  weak_phrase_quality: 'weak_phrase',
  incomplete_quality: 'incomplete',
};

function scoreToPct(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  return `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
}

function countWords(text) {
  return (String(text || '').match(/\b\w+\b/g) || []).length;
}

function tokenize(text) {
  return (String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []);
}

function lcsLength(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[a.length][b.length];
}

function rougeL(prompt, srsText) {
  const p = tokenize(prompt);
  const s = tokenize(srsText);
  if (!p.length || !s.length) return 0;
  return lcsLength(p, s) / p.length;
}

function jaccardSimilarity(prompt, srsText) {
  const a = new Set(tokenize(prompt));
  const b = new Set(tokenize(srsText));
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach((term) => {
    if (b.has(term)) inter += 1;
  });
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

function collectPromptFromResults(resultsData) {
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

function sectionLevelMetrics(srsText) {
  const expected = [
    'introduction',
    'overall description',
    'specific requirements',
    'functional requirements',
    'non-functional requirements',
  ];
  const found = new Set();
  const headingMatches = String(srsText || '')
    .toLowerCase()
    .match(/^\s*(\d+(\.\d+)*\s+)?([a-z][a-z -]{2,})\s*:?$/gim) || [];
  const normalized = headingMatches.map((h) => h.toLowerCase().replace(/^\s*\d+(\.\d+)*\s+/, '').replace(/:$/, '').trim());
  expected.forEach((k) => {
    if (normalized.some((h) => h.includes(k))) found.add(k);
  });
  const precision = normalized.length ? found.size / normalized.length : 0;
  const recall = expected.length ? found.size / expected.length : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1, foundCount: found.size, headingCount: normalized.length };
}

function countTerm(text, term) {
  const src = String(text || '');
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (/^[a-z]+$/i.test(term)) {
    const rx = new RegExp(`\\b${escaped}\\b`, 'gi');
    return (src.match(rx) || []).length;
  }
  const rx = new RegExp(escaped, 'gi');
  return (src.match(rx) || []).length;
}

function computeArmChecks(srsText) {
  const text = String(srsText || '');
  const requirementLikeLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => /\b(shall|must|should|will|fr-|nfr-|requirement)\b/i.test(line));
  const reqBase = Math.max(requirementLikeLines.length, 1);

  const imperativeCount = ARM_TERMS.imperative.reduce((sum, term) => sum + countTerm(text, term), 0);
  const continuanceCount = ARM_TERMS.continuance.reduce((sum, term) => sum + countTerm(text, term), 0);
  const directiveCount = ARM_TERMS.directive.reduce((sum, term) => sum + countTerm(text, term), 0);
  const optionCount = ARM_TERMS.option.reduce((sum, term) => sum + countTerm(text, term), 0);
  const weakPhraseCount = ARM_TERMS.weakPhrase.reduce((sum, term) => sum + countTerm(text, term), 0);
  const incompleteCount = ARM_TERMS.incomplete.reduce((sum, term) => sum + countTerm(text, term), 0);

  const imperativeQuality = Math.min(1, imperativeCount / reqBase);
  const continuanceQuality = Math.max(0, 1 - (continuanceCount / reqBase));
  const directiveQuality = Math.max(0, 1 - (directiveCount / reqBase));
  const optionQuality = Math.max(0, 1 - (optionCount / reqBase));
  const weakPhraseQuality = Math.max(0, 1 - (weakPhraseCount / reqBase));
  const incompleteQuality = Math.max(0, 1 - (incompleteCount / reqBase));

  return {
    imperativeCount,
    continuanceCount,
    directiveCount,
    optionCount,
    weakPhraseCount,
    incompleteCount,
    imperativeQuality,
    continuanceQuality,
    directiveQuality,
    optionQuality,
    weakPhraseQuality,
    incompleteQuality,
  };
}

function computeLocalCoreMetrics({ text, prompt, sectionMetrics, armChecks, conflicts, hall }) {
  const sentences = String(text || '').split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const avgSentenceLen = sentences.length
    ? sentences.reduce((sum, s) => sum + countWords(s), 0) / sentences.length
    : 0;

  let clarity = 0.6;
  if (avgSentenceLen >= 10 && avgSentenceLen <= 22) clarity = 0.95;
  else if (avgSentenceLen > 22 && avgSentenceLen <= 30) clarity = 0.8;
  else if (avgSentenceLen > 30) clarity = 0.6;

  const relevance = jaccardSimilarity(prompt || text.slice(0, 1200), text);
  const ambiguity = armChecks.weakPhraseQuality;
  const completeness = sectionMetrics.recall;
  const structure = sectionMetrics.f1;

  const reqLines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /\b(shall|must|should|will|fr-|nfr-|requirement)\b/i.test(line));
  const measurableReq = reqLines.filter((line) => /\b\d+(\.\d+)?\b|<\s*\d+|>\s*\d+|%/.test(line)).length;
  const testability = reqLines.length ? measurableReq / reqLines.length : 0;

  const nfrLines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /\b(non[- ]?functional|performance|security|availability|reliability|usability)\b/i.test(line));
  const nfrMeasurable = nfrLines.filter((line) => /\b\d+(\.\d+)?\b|<\s*\d+|>\s*\d+|%|ms|seconds?|minutes?|hours?/.test(line)).length;
  const nfrSpecificity = nfrLines.length ? nfrMeasurable / nfrLines.length : 0.5;

  const conflictCount = Array.isArray(conflicts) ? conflicts.length : 0;
  const conflictScore = Math.max(0, 1 - (conflictCount * 0.15));
  const consistency = Math.max(0, Math.min(1, (conflictScore + sectionMetrics.f1) / 2));

  const lowered = String(text || '').toLowerCase();
  const informalHits = (lowered.match(/\b(gonna|wanna|kinda|sorta|etc\.|and so on|i think|we think)\b/g) || []).length;
  const firstPersonHits = (lowered.match(/\b(i|we|our|us|let's)\b/g) || []).length;
  const professionalStyle = Math.max(0, 1 - Math.min(0.8, informalHits * 0.03 + firstPersonHits * 0.02));

  const hallConfidence = typeof hall?.confidence_score === 'number'
    ? hall.confidence_score
    : Math.max(0, Math.min(1, relevance * 0.6 + sectionMetrics.f1 * 0.4));
  const aiHallucinationQuality = typeof hall?.has_hallucinations === 'boolean' && hall.has_hallucinations
    ? Math.max(0, hallConfidence - 0.1)
    : hallConfidence;

  const instructionAdherence = Math.max(0, Math.min(1, (completeness + structure + professionalStyle) / 3));
  const contextUnderstanding = Math.max(0, Math.min(1, (relevance + completeness) / 2));
  const coherence = Math.max(0, Math.min(1, (clarity + structure) / 2));

  return {
    completeness,
    clarity,
    structure,
    relevance,
    ambiguity,
    testability,
    consistency,
    conflict_score: conflictScore,
    nfr_specificity: nfrSpecificity,
    professional_style: professionalStyle,
    instruction_adherence: instructionAdherence,
    ai_hallucination_quality: aiHallucinationQuality,
    context_understanding: contextUnderstanding,
    coherence,
  };
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildHighlightedHtmlByTerms(text, terms) {
  const source = String(text || '');
  if (!source || !Array.isArray(terms) || terms.length === 0) {
    return { html: escapeHtml(source), hits: [] };
  }

  const cleanedTerms = terms
    .map((t) => String(t || '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const ranges = [];
  cleanedTerms.forEach((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = /^[a-z]+$/i.test(term)
      ? new RegExp(`\\b${escaped}\\b`, 'gi')
      : new RegExp(escaped, 'gi');
    let m;
    while ((m = rx.exec(source)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
      if (m.index === rx.lastIndex) rx.lastIndex += 1;
    }
  });

  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged = [];
  for (const r of ranges) {
    if (!merged.length || r.start >= merged[merged.length - 1].end) {
      merged.push(r);
    } else if (r.end > merged[merged.length - 1].end) {
      merged[merged.length - 1].end = r.end;
    }
  }

  const hits = merged.map((r) => source.slice(r.start, r.end));
  if (!merged.length) return { html: escapeHtml(source), hits };

  let html = '';
  let cursor = 0;
  for (const r of merged) {
    html += escapeHtml(source.slice(cursor, r.start));
    html += `<mark class="srs-metrics-mark">${escapeHtml(source.slice(r.start, r.end))}</mark>`;
    cursor = r.end;
  }
  html += escapeHtml(source.slice(cursor));
  return { html, hits };
}

const SRSMetricsPage = ({ srsData, currentResults }) => {
  const [searchParams] = useSearchParams();
  const text = useMemo(() => srsPlainText(srsData), [srsData]);
  const prompt = useMemo(() => collectPromptFromResults(currentResults), [currentResults]);
  const [loading, setLoading] = useState(false);
  const [aiEval, setAiEval] = useState(null);
  const [selectedConflict, setSelectedConflict] = useState('');
  const [selectedHighlightMetricKey, setSelectedHighlightMetricKey] = useState('');
  const [focusedTableRowKey, setFocusedTableRowKey] = useState('');
  const highlightSectionRef = useRef(null);

  const sectionMetrics = useMemo(() => sectionLevelMetrics(text), [text]);
  const armChecks = useMemo(() => computeArmChecks(text), [text]);
  const rougeLScore = useMemo(() => rougeL(prompt || text.slice(0, 1500), text), [prompt, text]);
  const bertScoreProxy = useMemo(() => jaccardSimilarity(prompt || text.slice(0, 1500), text), [prompt, text]);
  const conflicts = srsData?.verification_report?.conflict_analysis?.conflicts || [];
  const hallForFallback = srsData?.hallucination_analysis || srsData?.sections?._hallucination_analysis || {};
  const localCoreMetrics = useMemo(
    () => computeLocalCoreMetrics({ text, prompt, sectionMetrics, armChecks, conflicts, hall: hallForFallback }),
    [text, prompt, sectionMetrics, armChecks, conflicts, hallForFallback]
  );

  const load = useCallback(async () => {
    if (!text || text.length < 80) {
      setAiEval(null);
      return;
    }
    setLoading(true);
    try {
      const aiEvalRes = await axios.post(config.API_ENDPOINTS.SRS_EVAL_EXISTING, {
        prompt: (prompt || text.slice(0, 1500)).trim(),
        srs_text: text,
      });
      setAiEval(aiEvalRes.data || null);
    } catch {
      setAiEval(null);
    } finally {
      setLoading(false);
    }
  }, [text, prompt]);

  useEffect(() => {
    load();
  }, [load]);

  const dedupedMetrics = useMemo(() => {
    const map = new Map();
    const push = (key, label, value, type = 'score') => {
      if (map.has(key)) return;
      map.set(key, {
        key,
        label,
        description: METRIC_DESCRIPTIONS[key] || 'Quality signal for generated SRS.',
        value,
        type,
      });
    };

    const report = srsData?.verification_report || {};
    const ieee = report?.ieee_metrics || {};
    const manual = report?.manual_metrics || {};
    Object.entries(ieee).forEach(([k, v]) => push(k, k, v));
    Object.entries(manual).forEach(([k, v]) => push(k, k, v));

    const hall = srsData?.hallucination_analysis || srsData?.sections?._hallucination_analysis || {};
    if (typeof hall.has_hallucinations === 'boolean') push('has_hallucinations', 'has_hallucinations', hall.has_hallucinations, 'boolean');
    if (typeof hall.confidence_score === 'number') push('confidence_score', 'confidence_score', hall.confidence_score);
    if (typeof hall.term_overlap === 'number') push('term_overlap', 'term_overlap', hall.term_overlap, 'count');
    if (typeof hall.total_original_terms === 'number') push('total_original_terms', 'total_original_terms', hall.total_original_terms, 'count');

    const aiMetrics = Array.isArray(aiEval?.metrics) ? aiEval.metrics : [];
    aiMetrics.forEach((m) => {
      if (!m?.key) return;
      if (m.key === 'hallucination') {
        push('ai_hallucination_quality', 'ai_hallucination_quality', m.score);
        return;
      }
      push(m.key, m.key, m.score);
    });

    push('rouge_l', 'rouge_l', rougeLScore);
    push('bertscore_f1', 'bertscore_f1', bertScoreProxy);
    push('section_precision', 'section_precision', sectionMetrics.precision);
    push('section_recall', 'section_recall', sectionMetrics.recall);
    push('section_f1', 'section_f1', sectionMetrics.f1);
    push('imperative', 'imperative', armChecks.imperativeQuality);
    push('continuance', 'continuance', armChecks.continuanceQuality);
    push('directive', 'directive', armChecks.directiveQuality);
    push('option', 'option', armChecks.optionQuality);
    push('weak_phrase', 'weak_phrase', armChecks.weakPhraseQuality);
    push('incomplete', 'incomplete', armChecks.incompleteQuality);
    push('imperative_count', 'imperative_count', armChecks.imperativeCount, 'count');
    push('continuance_count', 'continuance_count', armChecks.continuanceCount, 'count');
    push('directive_count', 'directive_count', armChecks.directiveCount, 'count');
    push('option_count', 'option_count', armChecks.optionCount, 'count');
    push('weak_phrase_count', 'weak_phrase_count', armChecks.weakPhraseCount, 'count');
    push('incomplete_count', 'incomplete_count', armChecks.incompleteCount, 'count');

    EXPECTED_METRIC_KEYS.forEach((key) => {
      if (!map.has(key)) {
        push(key, key, null, key === 'has_hallucinations' ? 'boolean' : 'score');
      }
    });

    const withFallbacks = Array.from(map.values()).map((entry) => {
      const isMissing = entry.value === null || entry.value === undefined || Number.isNaN(entry.value);
      if (!isMissing) return entry;

      if (entry.key in localCoreMetrics) {
        return { ...entry, value: localCoreMetrics[entry.key] };
      }
      if (entry.key === 'has_hallucinations' && typeof hall?.has_hallucinations === 'boolean') {
        return { ...entry, value: hall.has_hallucinations };
      }
      if (entry.key === 'confidence_score' && typeof hall?.confidence_score === 'number') {
        return { ...entry, value: hall.confidence_score };
      }
      if (entry.key === 'term_overlap' && typeof hall?.term_overlap === 'number') {
        return { ...entry, value: hall.term_overlap };
      }
      if (entry.key === 'total_original_terms' && typeof hall?.total_original_terms === 'number') {
        return { ...entry, value: hall.total_original_terms };
      }
      return entry;
    });

    return withFallbacks;
  }, [srsData, aiEval, rougeLScore, bertScoreProxy, sectionMetrics, armChecks, localCoreMetrics]);

  useEffect(() => {
    const raw = searchParams.get('focus') || '';
    const f = LEGACY_SRS_METRICS_FOCUS[raw] || raw;
    if (!f || !dedupedMetrics.some((e) => e.key === f)) {
      setFocusedTableRowKey('');
      return;
    }
    setFocusedTableRowKey(f);
    setSelectedConflict('');
    if (HIGHLIGHTABLE_ARM_SCORE_KEYS.has(f) || HIGHLIGHTABLE_HALLUCINATION_KEYS.has(f)) {
      setSelectedHighlightMetricKey(f);
    } else {
      setSelectedHighlightMetricKey('');
    }
  }, [searchParams, dedupedMetrics]);

  useEffect(() => {
    if (!focusedTableRowKey || loading) return;
    const id = `srs-metric-row-${focusedTableRowKey}`;
    const node = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (!node) return;
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [focusedTableRowKey, loading, dedupedMetrics]);

  const selectedArmGroup = ARM_METRIC_TO_GROUP[selectedHighlightMetricKey] || '';
  const selectedArmTerms = selectedArmGroup ? ARM_TERMS[selectedArmGroup] : [];

  const hallucinationEvidenceTerms = useMemo(
    () => collectHallucinationMetricTerms(srsData, aiEval),
    [srsData, aiEval]
  );

  const selectedHighlightTerms = selectedArmGroup
    ? selectedArmTerms
    : HIGHLIGHTABLE_HALLUCINATION_KEYS.has(selectedHighlightMetricKey)
      ? hallucinationEvidenceTerms
      : [];

  const highlightPreview = useMemo(
    () => buildHighlightedHtmlByTerms(text, selectedHighlightTerms),
    [text, selectedHighlightTerms]
  );

  const showHighlightPreview =
    HIGHLIGHTABLE_ARM_SCORE_KEYS.has(selectedHighlightMetricKey) ||
    HIGHLIGHTABLE_HALLUCINATION_KEYS.has(selectedHighlightMetricKey);

  const highlightedSrs = useMemo(() => {
    if (!selectedConflict || !text) return escapeHtml(text);
    const escaped = selectedConflict.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    const match = text.match(rx);
    if (!match) return escapeHtml(text);
    const idx = match.index || 0;
    return `${escapeHtml(text.slice(0, idx))}<mark class="srs-metrics-mark">${escapeHtml(
      text.slice(idx, idx + match[0].length)
    )}</mark>${escapeHtml(text.slice(idx + match[0].length))}`;
  }, [selectedConflict, text]);

  useEffect(() => {
    if (!selectedHighlightMetricKey) return;
    const node = highlightSectionRef.current;
    if (!node) return;
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [selectedHighlightMetricKey]);

  if (!srsData) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center text-slate-600 dark:text-slate-400">
        <p className="text-sm">No SRS loaded. Generate one first.</p>
        <Link to="/generate-srs" className="mt-4 inline-block text-sm text-r2d-primary underline">
          Go to Generate SRS
        </Link>
      </div>
    );
  }

  return (
    <PresentationRouteSplash
      title="SRS quality metrics"
      subtitle="Preparing charts, overlap signals, and conflict highlights for your presentation."
      icon={BarChart3}
      delayMs={2600}
    >
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in px-1 sm:px-0">
      <header className="border-b border-slate-200 dark:border-slate-700 pb-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Generated SRS</p>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-400" />
          {srsData.title || 'SRS document'}
        </h1>
        <p className="text-xs text-slate-500 mt-1 font-mono">ID: {srsData.document_id || srsData.id || '—'}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
          Demo panel with layman explanations first, then live values for the currently generated SRS. Duplicate metrics are automatically removed.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
          <Link
            to="/srs"
            className="inline-flex items-center text-xs px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            Back to SRS
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-12 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
          <table className="min-w-[760px] md:min-w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                <th className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">Metric</th>
                <th className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">Layman meaning</th>
                <th className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">Current value</th>
              </tr>
            </thead>
            <tbody>
              {dedupedMetrics.map((m) => (
                <tr
                  key={m.key}
                  id={`srs-metric-row-${m.key}`}
                  className={`border-b border-slate-100 dark:border-slate-800 last:border-0 align-top hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                    focusedTableRowKey === m.key
                      ? 'bg-cyan-50/90 dark:bg-cyan-950/40 ring-2 ring-inset ring-r2d-primary dark:ring-cyan-400'
                      : ''
                  }`}
                >
                  <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100 font-mono whitespace-nowrap">
                    {HIGHLIGHTABLE_ARM_SCORE_KEYS.has(m.key) || HIGHLIGHTABLE_HALLUCINATION_KEYS.has(m.key) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedHighlightMetricKey(m.key);
                          setSelectedConflict('');
                        }}
                        className="font-mono text-left underline decoration-dotted underline-offset-4 text-r2d-primary dark:text-cyan-300 hover:text-r2d-primaryLight cursor-pointer bg-transparent border-0 p-0"
                        title="Highlight matching phrases in the SRS excerpt below"
                      >
                        {m.label}
                      </button>
                    ) : (
                      m.label
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-400 text-xs leading-relaxed min-w-[280px]">{m.description}</td>
                  <td className="px-3 py-3 tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {m.type === 'boolean'
                      ? m.value ? 'True' : 'False'
                      : m.type === 'count'
                        ? (m.value ?? '—')
                        : scoreToPct(m.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showHighlightPreview && (
        <div ref={highlightSectionRef} className="rounded-lg border border-cyan-200 dark:border-cyan-900 bg-cyan-50/50 dark:bg-slate-900 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              SRS excerpt — <span className="font-mono">{selectedHighlightMetricKey}</span>{' '}
              <span className="text-slate-500 dark:text-slate-400 font-normal">({selectedArmGroup || 'hallucination'})</span>
            </h2>
            <button
              type="button"
              onClick={() => setSelectedHighlightMetricKey('')}
              className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-800 w-full sm:w-auto"
            >
              Close preview
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
            Terms being checked: {selectedHighlightTerms.length ? selectedHighlightTerms.join(', ') : 'No flagged terms available'}
          </p>
          <p className="text-xs text-slate-700 dark:text-slate-300 mb-3">
            Matches found: <span className="font-mono">{highlightPreview.hits.length}</span>
          </p>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 max-h-[min(52vh,560px)] min-h-[200px] overflow-auto">
              <p
                className="text-[11px] sm:text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: highlightPreview.html }}
              />
            </div>
            <div className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 max-h-[min(52vh,560px)] min-h-[200px] overflow-auto">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">Matched snippets</p>
              {highlightPreview.hits.length ? (
                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  {highlightPreview.hits.slice(0, 80).map((hit, idx) => (
                    <li key={`arm-hit-${idx}`} className="font-mono break-words border-b border-slate-100 dark:border-slate-800 pb-1">
                      {hit}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">No occurrences found for this group in current SRS.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Model performance reporting</h2>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
            <li>Runtime: <span className="font-mono">{aiEval?.timing_seconds ?? '—'}s</span></li>
            <li>Run ID: <span className="font-mono">{aiEval?.run_id || '—'}</span></li>
            <li>SRS length: <span className="font-mono">{countWords(text)} words</span></li>
            <li>Prompt length: <span className="font-mono">{countWords(prompt)} words</span></li>
            <li>Section headings found: <span className="font-mono">{sectionMetrics.foundCount} / {sectionMetrics.headingCount}</span></li>
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Section-level precision / recall / F1</h2>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
            <li>
              Precision: <span className="font-mono">{scoreToPct(sectionMetrics.precision)}</span>
              <span className="text-slate-500 dark:text-slate-400">
                {' '}
                · target ≥ {scoreToPct(SRS_SECTION_METRIC_THRESHOLDS.section_precision)}
              </span>
            </li>
            <li>
              Recall: <span className="font-mono">{scoreToPct(sectionMetrics.recall)}</span>
              <span className="text-slate-500 dark:text-slate-400">
                {' '}
                · target ≥ {scoreToPct(SRS_SECTION_METRIC_THRESHOLDS.section_recall)}
              </span>
            </li>
            <li>
              F1: <span className="font-mono">{scoreToPct(sectionMetrics.f1)}</span>
              <span className="text-slate-500 dark:text-slate-400">
                {' '}
                · target ≥ {scoreToPct(SRS_SECTION_METRIC_THRESHOLDS.section_f1)}
              </span>
            </li>
            <li>
              ROUGE-L: <span className="font-mono">{scoreToPct(rougeLScore)}</span>
              <span className="text-slate-500 dark:text-slate-400">
                {' '}
                · target ≥ {scoreToPct(SRS_SECTION_METRIC_THRESHOLDS.rouge_l)}
              </span>
            </li>
            <li>
              BERTScore (proxy): <span className="font-mono">{scoreToPct(bertScoreProxy)}</span>
              <span className="text-slate-500 dark:text-slate-400">
                {' '}
                · target ≥ {scoreToPct(SRS_SECTION_METRIC_THRESHOLDS.bertscore_proxy)}
              </span>
            </li>
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
            {SRS_SECTION_METRIC_THRESHOLD_FOOTNOTE}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Conflicting requirements detection with exact highlighting
        </h2>
        {conflicts.length ? (
          <div className="mt-3 grid lg:grid-cols-2 gap-4">
            <ul className="space-y-2 max-h-72 overflow-auto text-xs">
              {conflicts.map((c, idx) => {
                const textToPin = c.sentence || c.sentence_a || '';
                return (
                  <li key={`conf-${idx}`} className="border border-slate-200 dark:border-slate-700 rounded p-2">
                    <p className="text-slate-700 dark:text-slate-300">{textToPin || JSON.stringify(c)}</p>
                    {!!textToPin && (
                      <button
                        type="button"
                        onClick={() => setSelectedConflict(textToPin)}
                        className="mt-2 text-[11px] px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700"
                      >
                        Highlight exact text
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 max-h-72 overflow-auto">
              <p
                className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: highlightedSrs }}
              />
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">No conflicts were flagged for this SRS.</p>
        )}
      </div>

    </div>
    </PresentationRouteSplash>
  );
};

export default SRSMetricsPage;
