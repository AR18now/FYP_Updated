import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Download,
  FileText,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Printer,
  AlertTriangle,
  Workflow,
  RefreshCw,
  UserCheck,
  BarChart3,
} from 'lucide-react';
import axios from 'axios';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import config from '../config';
import { saveSRS, patchStoredSRSById } from '../utils/storage';
import { postSrsDashboardWithFallback, collectPromptFromResults } from '../utils/srsDashboardClient';
import { consumeSrsGenerateStream } from '../utils/srsStream';
import { buildGenerateUseCasesRequestBody, hasModelTextualUseCases } from '../utils/useCaseRequest';
import { formatSrsToHtml, buildSrsMajorSectionCards } from '../utils/documentFormatter';
import { saveBlobResponseAsDownload, messageFromAxiosBlobError } from '../utils/downloadHelpers';
import { getApiErrorMessage } from '../utils/apiErrors';
import { HALLUCINATION_HELP, flagTypeLabel } from '../utils/srsQualityCopy';
import { brandUrl } from './BrandLogo';
import SrsGenerationLoaderOverlay from './SrsGenerationLoaderOverlay';
import {
  ARM_TERMS,
  ARM_METRIC_TO_GROUP,
  HIGHLIGHTABLE_HALLUCINATION_KEYS,
  collectHallucinationMetricTerms,
} from '../utils/srsLanguageQualityTerms';

/** Same contract as generate-srs-stream `results` body. */
function buildRequirementsArrayForSrs(resultsData) {
  if (!resultsData) return [];
  if (Array.isArray(resultsData)) return resultsData;
  if (resultsData.results && Array.isArray(resultsData.results)) return resultsData.results;
  if (resultsData.status) return [resultsData];
  return [resultsData];
}

function srsEvalMetricFocusKey(metric) {
  if (!metric || metric.skipped) return '';
  if (metric.key === 'hallucination') return 'ai_hallucination_quality';
  return metric.key || '';
}

const SRSViewer = ({ srsData, currentResults, onSelectSrsVariant, onUseCaseDataChange }) => {
  const toSafeFilename = useCallback((value, fallback = 'SRS') => {
    const cleaned = String(value || fallback)
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '_');
    return cleaned || fallback;
  }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const docRootRef = useRef(null);
  const srsPipelineHandledIds = useRef(new Set());
  /** Live token stream before the final SRS object exists — improves perceived latency on this page. */
  const [streamPreview, setStreamPreview] = useState('');
  const [isStreamingSrs, setIsStreamingSrs] = useState(false);
  const [pipelineError, setPipelineError] = useState(null);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [showValidation, setShowValidation] = useState(false);
  const [srsDashboard, setSrsDashboard] = useState(null);
  const [srsDashboardLoading, setSrsDashboardLoading] = useState(false);
  const [srsDashboardError, setSrsDashboardError] = useState(null);
  const [genTextualUcLoading, setGenTextualUcLoading] = useState(false);
  /** SRS body: section cards vs single scroll */
  const [srsDocLayout, setSrsDocLayout] = useState('cards');
  const [activeSrsSectionId, setActiveSrsSectionId] = useState(null);

  const buildRequirementsArray = useCallback((resultsData) => {
    if (!resultsData) return [];
    if (Array.isArray(resultsData)) return resultsData;
    if (resultsData.results && Array.isArray(resultsData.results)) return resultsData.results;
    if (resultsData.status) return [resultsData];
    return [resultsData];
  }, []);

  useEffect(() => {
    if (!actionsMenuOpen) return;
    const onDoc = (e) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target)) setActionsMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setActionsMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [actionsMenuOpen]);

  /**
   * Process & Generate hands off here so the SRS streams in the same view as the finished document.
   */
  useEffect(() => {
    const pipe = location.state?.srsPipeline;
    if (!pipe?.id) return;
    if (!currentResults) return;
    if (srsPipelineHandledIds.current.has(pipe.id)) return;
    srsPipelineHandledIds.current.add(pipe.id);
    setPipelineError(null);

    if (pipe.combinedError) {
      setPipelineError(String(pipe.combinedError));
      return;
    }

    if (pipe.prebuiltSrs && (pipe.prebuiltSrs.sections || pipe.prebuiltSrs.raw_text)) {
      if (onSelectSrsVariant) onSelectSrsVariant(pipe.prebuiltSrs);
      try {
        saveSRS(pipe.prebuiltSrs);
      } catch (e) {
        console.error('Error saving SRS to storage:', e);
      }
      return;
    }

    const items = buildRequirementsArrayForSrs(pipe.processingPayload);
    (async () => {
      setIsStreamingSrs(true);
      setStreamPreview('');
      try {
        const srsPayload = await consumeSrsGenerateStream({
          url: config.API_ENDPOINTS.GENERATE_SRS_STREAM,
          body: {
            results: items,
            project_info: pipe.projectInfo || {},
            srs_llm_choice: pipe.srsLlmChoice || 'qwen25',
          },
          onDelta: (_chunk, accumulated) => setStreamPreview(accumulated),
        });
        if (srsPayload && (srsPayload.sections || srsPayload.raw_text)) {
          if (onSelectSrsVariant) onSelectSrsVariant(srsPayload);
          try {
            saveSRS(srsPayload);
          } catch (err) {
            console.error('Error saving SRS to storage:', err);
          }
        } else {
          setPipelineError('The server returned an empty SRS. Check API logs and try again.');
        }
      } catch (err) {
        console.error('SRS stream failed:', err);
        setPipelineError(getApiErrorMessage(err, 'SRS generation failed.'));
      } finally {
        setIsStreamingSrs(false);
        setStreamPreview('');
      }
    })();
  }, [location.state, currentResults, onSelectSrsVariant]);

  const srsFormattedHtml = useMemo(
    () => (srsData?.raw_text ? formatSrsToHtml(srsData.raw_text, { assignIds: true }) : ''),
    [srsData?.raw_text]
  );

  const srsSectionCards = useMemo(
    () => buildSrsMajorSectionCards(srsData?.raw_text || ''),
    [srsData?.raw_text]
  );

  useEffect(() => {
    const m = buildSrsMajorSectionCards(srsData?.raw_text || '');
    const first = m.sections[0]?.id;
    if (first) setActiveSrsSectionId(first);
  }, [srsData?.document_id, srsData?.raw_text]);

  useEffect(() => {
    const id = srsData?.document_id;
    const raw = String(srsData?.raw_text || '').trim();
    const fallback = (() => {
      try {
        return JSON.stringify(srsData?.sections || {}, null, 0);
      } catch {
        return '';
      }
    })();
    const text = raw.length >= 40 ? raw : String(fallback || '').trim();
    if (!id || text.length < 40) {
      setSrsDashboard(null);
      setSrsDashboardLoading(false);
      setSrsDashboardError(null);
      return;
    }
    let cancelled = false;
    setSrsDashboardLoading(true);
    setSrsDashboardError(null);
    postSrsDashboardWithFallback({
      srs: {
        raw_text: srsData.raw_text,
        sections: srsData.sections,
        hallucination_analysis: srsData.hallucination_analysis,
        verification_report: srsData.verification_report,
      },
      prompt: collectPromptFromResults(currentResults),
    })
      .then((res) => {
        if (cancelled) return;
        setSrsDashboard(res.data);
        setSrsDashboardLoading(false);
        const docId = srsData?.document_id;
        if (docId && res.data) {
          try {
            patchStoredSRSById(docId, { srs_dashboard_snapshot: res.data });
          } catch (e) {
            console.warn('Could not persist SRS dashboard snapshot to local history:', e);
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setSrsDashboard(null);
        setSrsDashboardError(getApiErrorMessage(err, 'Could not load SRS quality insights.'));
        setSrsDashboardLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [srsData?.document_id, srsData?.raw_text, srsData?.sections, srsData?.hallucination_analysis, srsData?.verification_report, currentResults]);

  const interactiveQualityFlags = useMemo(() => {
    const flags = [];
    const rawText = String(srsData?.raw_text || '');
    if (!rawText.trim()) return flags;
    const lines = rawText.split('\n').map((l) => String(l || '').trim()).filter(Boolean);

    const add = (kind, message, snippet, terms = []) => {
      flags.push({ kind, message, snippet, terms });
    };

    const placeholderRx = /\b(TBD|TBA|N\/A|to be defined|to be decided|placeholder|lorem ipsum)\b/i;
    lines.forEach((line) => {
      if (placeholderRx.test(line)) {
        add('incomplete_content', 'Potentially incomplete statement found.', line, [line.slice(0, 80)]);
      }
    });

    const vagueRx = /\b(fast|quick|easy|user-friendly|efficient|robust|better performance|high performance)\b/i;
    lines.forEach((line) => {
      if (vagueRx.test(line) && !/\b\d+(\.\d+)?\s*(ms|s|sec|seconds|minutes|min|hours|%)\b/i.test(line)) {
        add('non_measurable', 'Non-measurable wording detected; consider adding exact numbers.', line, [line.slice(0, 80)]);
      }
    });

    const hasSystemFeatures = /(^|\n)\s*4\.\s*system features\b/i.test(rawText);
    if (!hasSystemFeatures) {
      add('missing_section', 'Section "4. System Features" appears missing.', '', ['system features']);
    }

    const frMatches = rawText.match(/\bFR-\d+\b/gi) || [];
    if (frMatches.length > 0) {
      const hasFrIOP = /\bInput:\b[\s\S]{0,300}\bProcessing:\b[\s\S]{0,300}\bOutput:\b/i.test(rawText);
      if (!hasFrIOP) {
        add('fr_structure', 'FR blocks appear to miss full Input/Processing/Output structure.', '', ['FR-', 'Input:', 'Processing:', 'Output:']);
      }
    }

    const kb = srsDashboard?.kb_metrics;
    if (kb && typeof kb === 'object') {
      const arm = Number(kb.arm_overall_score);
      if (!Number.isNaN(arm) && arm < 0.62) {
        add(
          'metric_low',
          'Automated wording/structure score (arm_overall) is on the low side; tighten shall/must statements and reduce vague phrases.',
          '',
          ['shall', 'must']
        );
      }
    }
    return flags.slice(0, 20);
  }, [srsData?.raw_text, srsDashboard?.kb_metrics]);

  const hallForDashboard = useMemo(
    () =>
      srsDashboard?.hallucination_analysis ||
      srsData?.hallucination_analysis ||
      srsData?.sections?._hallucination_analysis ||
      {},
    [srsDashboard, srsData]
  );

  const dashboardTiles = useMemo(() => {
    const tiles = [];
    const hall = hallForDashboard;
    if (typeof hall.confidence_score === 'number') {
      const score = hall.confidence_score;
      tiles.push({
        focus: 'confidence_score',
        title: 'Grounding confidence',
        subtitle: 'How much of your input wording reappears in the SRS',
        pass: score >= 0.35,
      });
    }
    if (typeof hall.has_hallucinations === 'boolean') {
      const nInfo = Array.isArray(hall.informational_signals) ? hall.informational_signals.length : 0;
      tiles.push({
        focus: 'has_hallucinations',
        title: 'Alignment review',
        subtitle:
          nInfo > 0 && !hall.has_hallucinations
            ? `${nInfo} FYI note(s) only — expansion is normal`
            : 'Review-tier vs your input (SRS detail alone is OK)',
        pass: !hall.has_hallucinations,
      });
    }
    const kb = srsDashboard?.kb_metrics;
    if (kb && typeof kb.arm_overall_score === 'number') {
      const score = kb.arm_overall_score;
      tiles.push({
        focus: 'weak_phrase',
        title: 'Requirement wording',
        subtitle: 'Imperatives, weak phrases, placeholders (KB score)',
        pass: score >= 0.62,
      });
    }
    const ev = srsDashboard?.srs_eval;
    if (ev && Array.isArray(ev.metrics)) {
      const want = ['instruction_adherence', 'hallucination', 'context_understanding', 'coherence'];
      for (const key of want) {
        const m = ev.metrics.find((x) => x && x.key === key);
        if (!m || m.skipped || typeof m.score !== 'number') continue;
        const focus = srsEvalMetricFocusKey(m);
        const title =
          key === 'hallucination'
            ? 'AI grounding check'
            : key === 'instruction_adherence'
              ? 'Instruction adherence'
              : key === 'context_understanding'
                ? 'Context fit'
                : 'Coherence';
        tiles.push({
          focus,
          title,
          subtitle: String(m.name || '').slice(0, 72),
          pass: m.score >= 0.7,
        });
      }
    }
    return tiles.slice(0, 8);
  }, [srsDashboard, hallForDashboard]);

  const hasQualityChecks =
    !!srsData?.hallucination_analysis ||
    !!(srsData?.verification_report?.conflict_analysis?.conflicts?.length) ||
    srsDashboardLoading ||
    !!srsDashboard ||
    !!srsDashboardError ||
    interactiveQualityFlags.length > 0;

  const highlightAndScrollTo = useCallback((snippet) => {
    const root = docRootRef.current;
    if (!root || !snippet) return;
    const needle = String(snippet).trim();
    if (needle.length < 8) return;
    root.querySelectorAll('.srs-highlight').forEach((el) => el.classList.remove('srs-highlight'));
    const slice = needle.slice(0, 72).toLowerCase();
    const candidates = root.querySelectorAll('p.srs-p, li.srs-li, .srs-doc-root ul');
    for (const el of candidates) {
      if (el.textContent.toLowerCase().includes(slice)) {
        el.classList.add('srs-highlight');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
    }
  }, []);

  const pinpointFlagInSrs = useCallback((flag) => {
    if (!flag) return;
    const terms = Array.isArray(flag.terms) ? flag.terms.filter(Boolean) : [];
    // Prefer explicit extracted terms first, then fallback to message fragments.
    const candidate =
      terms.find((t) => String(t).trim().length >= 4) ||
      String(flag.message || '')
        .split(/[,:;]/)
        .map((s) => s.trim())
        .find((s) => s.length >= 8);
    if (candidate) {
      highlightAndScrollTo(candidate);
    }
  }, [highlightAndScrollTo]);

  const clearInlineMarks = useCallback(() => {
    const root = docRootRef.current;
    if (!root) return;
    const marks = root.querySelectorAll('mark.srs-mark');
    marks.forEach((m) => {
      const parent = m.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(m.textContent || ''), m);
      parent.normalize();
    });
  }, []);

  const applyInlineMarks = useCallback((items) => {
    const root = docRootRef.current;
    if (!root) return;

    // Remove any previous marks first (idempotent for re-renders)
    clearInlineMarks();

    const targets = Array.from(root.querySelectorAll('p.srs-p, li.srs-li'));
    if (!targets.length) return;

    const unique = [];
    const seen = new Set();
    for (const it of items || []) {
      if (!it) continue;
      const t = String(it).trim();
      if (t.length < 4) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(t);
      if (unique.length >= 12) break; // keep UI fast
    }
    if (!unique.length) return;

    // Build regex that matches any of the phrases (word-boundary-ish where safe).
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(`(${unique.map(esc).join('|')})`, 'gi');

    for (const el of targets) {
      // Only mark a limited number per paragraph to avoid DOM explosion.
      let marksInEl = 0;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          // Skip if inside an existing mark (shouldn't happen after clear)
          if (node.parentElement && node.parentElement.closest('mark.srs-mark')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      const textNodes = [];
      let n;
      while ((n = walker.nextNode())) textNodes.push(n);

      for (const node of textNodes) {
        if (marksInEl >= 6) break;
        const value = node.nodeValue;
        if (!value || !rx.test(value)) continue;
        rx.lastIndex = 0;

        const frag = document.createDocumentFragment();
        let last = 0;
        let m;
        while ((m = rx.exec(value)) && marksInEl < 6) {
          const start = m.index;
          const end = start + m[0].length;
          if (start > last) frag.appendChild(document.createTextNode(value.slice(last, start)));
          const mark = document.createElement('mark');
          mark.className = 'srs-mark';
          mark.textContent = m[0];
          frag.appendChild(mark);
          marksInEl += 1;
          last = end;
        }
        if (last < value.length) frag.appendChild(document.createTextNode(value.slice(last)));
        node.parentNode.replaceChild(frag, node);
      }
    }
  }, [clearInlineMarks]);

  useEffect(() => {
    const metricFocus = new URLSearchParams(location.search).get('metricFocus') || '';
    const armGroup = ARM_METRIC_TO_GROUP[metricFocus];
    const hallMetricFocus = HIGHLIGHTABLE_HALLUCINATION_KEYS.has(metricFocus);
    const shouldApplyMarks = showValidation || !!armGroup || hallMetricFocus;

    // Live highlighting is tied to “Show checks” by default; /srs?metricFocus=… drives the same marks without toggling the panel.
    if (!shouldApplyMarks) {
      clearInlineMarks();
      return;
    }

    const flagged =
      srsData?.hallucination_analysis?.flagged_sections ||
      srsData?.sections?._hallucination_analysis?.flagged_sections ||
      [];
    const terms = [];

    if (armGroup) {
      (ARM_TERMS[armGroup] || []).forEach((t) => terms.push(t));
    }
    if (hallMetricFocus) {
      collectHallucinationMetricTerms(srsData, null).forEach((t) => terms.push(t));
    }

    if (showValidation) {
      flagged.forEach((f) => {
        (f?.terms || []).forEach((t) => terms.push(t));
        if (f?.type === 'excessive_detail' || f?.type === 'expansion_vs_input') terms.push('response time', 'performance');
      });
      const conflicts = srsData?.verification_report?.conflict_analysis?.conflicts || [];
      conflicts.slice(0, 6).forEach((c) => {
        if (c?.sentence) terms.push(String(c.sentence).slice(0, 40));
      });
      interactiveQualityFlags.forEach((f) => {
        (f?.terms || []).forEach((t) => terms.push(t));
        if (f?.snippet) terms.push(String(f.snippet).slice(0, 60));
      });
    }

    applyInlineMarks(terms);
  }, [
    showValidation,
    location.search,
    srsData,
    srsFormattedHtml,
    applyInlineMarks,
    clearInlineMarks,
    interactiveQualityFlags,
  ]);

  useEffect(() => {
    const metricFocus = new URLSearchParams(location.search).get('metricFocus') || '';
    if (!metricFocus) return;
    const id = window.requestAnimationFrame(() => {
      const root = docRootRef.current;
      if (!root) return;
      const el = root.querySelector('mark.srs-mark');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [location.search, srsFormattedHtml, showValidation]);

  const toggleSection = useCallback((section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  /**
   * Downloads the SRS document as PDF (or HTML fallback if PDF generation fails).
   * Handles blob creation and file download with proper MIME type detection.
   */
  const downloadSRS = useCallback(async () => {
    if (!srsData) return;

    try {
      const response = await axios.post(
        config.API_ENDPOINTS.GENERATE_SRS_PDF,
        {
          document_id: srsData.document_id,
          title: srsData.title,
          version: srsData.version,
          date: srsData.date,
          author: srsData.author,
          sections: srsData.sections,
          raw_text: srsData.raw_text,
        },
        { responseType: 'blob' }
      );
      await saveBlobResponseAsDownload(response, {
        defaultFilename: toSafeFilename(srsData.title || srsData.document_id || 'SRS'),
      });
    } catch (error) {
      console.error('Error downloading SRS document:', error);
      const msg = await messageFromAxiosBlobError(error);
      alert(msg);
    }
  }, [srsData, toSafeFilename]);

  const downloadSRSDocx = useCallback(async () => {
    if (!srsData) return;

    try {
      const response = await axios.post(
        config.API_ENDPOINTS.GENERATE_SRS_DOCX,
        {
          document_id: srsData.document_id,
          title: srsData.title,
          version: srsData.version,
          date: srsData.date,
          author: srsData.author,
          sections: srsData.sections,
          raw_text: srsData.raw_text,
        },
        { responseType: 'blob' }
      );
      await saveBlobResponseAsDownload(response, {
        defaultFilename: toSafeFilename(srsData.title || srsData.document_id || 'SRS'),
      });
    } catch (error) {
      console.error('Error downloading SRS DOCX:', error);
      const msg = await messageFromAxiosBlobError(error);
      alert(msg);
    }
  }, [srsData, toSafeFilename]);

  const downloadText = useCallback((filename, content, mimeType = 'text/plain') => {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, []);

  const generateTextualUseCase = useCallback(async () => {
    if (!hasModelTextualUseCases(srsData)) return;
    setGenTextualUcLoading(true);
    try {
      const res = await axios.post(
        config.API_ENDPOINTS.GENERATE_USECASES,
        buildGenerateUseCasesRequestBody(srsData)
      );
      if (onUseCaseDataChange) onUseCaseDataChange(res.data);
      navigate('/textual-usecases');
    } catch (err) {
      console.error('Generate textual use cases failed', err);
      alert(getApiErrorMessage(err, 'Could not generate textual use cases.'));
    } finally {
      setGenTextualUcLoading(false);
    }
  }, [srsData, onUseCaseDataChange, navigate]);

  const printSRS = useCallback(() => {
    if (!srsData) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(generateHTMLContent(srsData));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }, [srsData]);

  const generateHTMLContent = useCallback((data) => {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${data.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        h3 { color: #7f8c8d; margin-top: 20px; }
        .metadata { background-color: #ecf0f1; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
        ul { margin: 10px 0; }
        li { margin: 5px 0; }
        .section { margin: 20px 0; }
        @media print {
            body { margin: 20px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <h1>${data.title}</h1>
    
    <div class="metadata">
        <p><strong>Document ID:</strong> ${data.document_id}</p>
        <p><strong>Version:</strong> ${data.version}</p>
        <p><strong>Date:</strong> ${data.date}</p>
        <p><strong>Author:</strong> ${data.author}</p>
    </div>
    
    <div class="section">
        <h2>1. Introduction</h2>
        <h3>1.1 Purpose</h3>
        <p>${data.sections.introduction.purpose}</p>
        
        <h3>1.2 Scope</h3>
        <p>${data.sections.introduction.scope}</p>
        
        <h3>1.3 Definitions</h3>
        <ul>
            ${data.sections.introduction.definitions.map(def => `<li>${def}</li>`).join('')}
        </ul>
        
        <h3>1.4 Overview</h3>
        <p>${data.sections.introduction.overview}</p>
    </div>
    
    <div class="section">
        <h2>2. Overall Description</h2>
        <h3>2.1 Product Functions</h3>
        <ul>
            ${data.sections.overall_description.product_functions.map(func => `<li>${func}</li>`).join('')}
        </ul>
        
        <h3>2.2 User Characteristics</h3>
        <ul>
            ${data.sections.overall_description.user_characteristics.map(user => `<li>${user}</li>`).join('')}
        </ul>
        
        <h3>2.3 Constraints</h3>
        <ul>
            ${data.sections.overall_description.constraints.map(constraint => `<li>${constraint}</li>`).join('')}
        </ul>
        
        <h3>2.4 Assumptions</h3>
        <ul>
            ${data.sections.overall_description.assumptions.map(assumption => `<li>${assumption}</li>`).join('')}
        </ul>
        
        <h3>2.5 Dependencies</h3>
        <ul>
            ${data.sections.overall_description.dependencies.map(dep => `<li>${dep}</li>`).join('')}
        </ul>
    </div>
    
    ${data.sections.specific_requirements ? `
    <div class="section">
        <h2>3. Specific Requirements</h2>
        ${data.sections.specific_requirements.external_interface_requirements ? `
        <h3>3.1 External Interface Requirements</h3>
        ${data.sections.specific_requirements.external_interface_requirements.user_interfaces?.length ? `
        <h4>3.1.1 User Interfaces</h4>
        <ul>${data.sections.specific_requirements.external_interface_requirements.user_interfaces.map(ui => `<li>${ui}</li>`).join('')}</ul>
        ` : ''}
        ${data.sections.specific_requirements.external_interface_requirements.hardware_interfaces?.length ? `
        <h4>3.1.2 Hardware Interfaces</h4>
        <ul>${data.sections.specific_requirements.external_interface_requirements.hardware_interfaces.map(hi => `<li>${hi}</li>`).join('')}</ul>
        ` : ''}
        ${data.sections.specific_requirements.external_interface_requirements.software_interfaces?.length ? `
        <h4>3.1.3 Software Interfaces</h4>
        <ul>${data.sections.specific_requirements.external_interface_requirements.software_interfaces.map(si => `<li>${si}</li>`).join('')}</ul>
        ` : ''}
        ${data.sections.specific_requirements.external_interface_requirements.communication_interfaces?.length ? `
        <h4>3.1.4 Communication Interfaces</h4>
        <ul>${data.sections.specific_requirements.external_interface_requirements.communication_interfaces.map(ci => `<li>${ci}</li>`).join('')}</ul>
        ` : ''}
        ` : ''}
        ${data.sections.specific_requirements.functional_requirements?.length ? `
        <h3>3.2 Functional Requirements</h3>
        <ul>
        ${data.sections.specific_requirements.functional_requirements.map(fr => 
          typeof fr === 'object' ? `<li><strong>${fr.id || 'FR'}:</strong> ${fr.description || JSON.stringify(fr)}</li>` : `<li>${fr}</li>`
        ).join('')}
        </ul>
        ` : ''}
        ${data.sections.specific_requirements.performance_requirements && Object.keys(data.sections.specific_requirements.performance_requirements).length ? `
        <h3>3.3 Performance Requirements</h3>
        ${Object.entries(data.sections.specific_requirements.performance_requirements).map(([key, value]) => 
          value ? `<p><strong>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong> ${value}</p>` : ''
        ).join('')}
        ` : ''}
        ${data.sections.specific_requirements.software_system_attributes ? `
        <h3>3.4 Software System Attributes</h3>
        ${data.sections.specific_requirements.software_system_attributes.reliability ? `<p><strong>Reliability:</strong> ${data.sections.specific_requirements.software_system_attributes.reliability}</p>` : ''}
        ${data.sections.specific_requirements.software_system_attributes.availability ? `<p><strong>Availability:</strong> ${data.sections.specific_requirements.software_system_attributes.availability}</p>` : ''}
        ${data.sections.specific_requirements.software_system_attributes.security ? `<p><strong>Security:</strong> ${data.sections.specific_requirements.software_system_attributes.security}</p>` : ''}
        ${data.sections.specific_requirements.software_system_attributes.maintainability ? `<p><strong>Maintainability:</strong> ${data.sections.specific_requirements.software_system_attributes.maintainability}</p>` : ''}
        ${data.sections.specific_requirements.software_system_attributes.portability ? `<p><strong>Portability:</strong> ${data.sections.specific_requirements.software_system_attributes.portability}</p>` : ''}
        ${data.sections.specific_requirements.software_system_attributes.usability ? `<p><strong>Usability:</strong> ${data.sections.specific_requirements.software_system_attributes.usability}</p>` : ''}
        ` : ''}
    </div>
    ` : ''}
</body>
</html>`;
  }, []);

  const expandAll = useCallback(() => {
    setExpandedSections({
      introduction: true,
      overall_description: true,
      specific_requirements: true
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedSections({});
  }, []);

  const hasPipelineState = !!location.state?.srsPipeline;

  if (!srsData && !isStreamingSrs && !streamPreview && !pipelineError && !hasPipelineState) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16 animate-fade-in" role="status">
        <div className="rounded-xl card-shadow p-12 border" style={{ background: 'var(--card)', color: 'var(--text)', borderColor: 'var(--card-border)' }}>
          <FileText className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--muted)' }} aria-hidden="true" />
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text)' }}>No SRS Document Available</h2>
          <p style={{ color: 'var(--muted)' }}>
            Generate an SRS document from processed requirements to view it here.
          </p>
        </div>
      </div>
    );
  }

  if (hasPipelineState && !currentResults && !srsData && !pipelineError && !isStreamingSrs) {
    return <SrsGenerationLoaderOverlay active variant="waiting" />;
  }

  if (pipelineError && !srsData && !isStreamingSrs) {
    return (
      <div className="max-w-4xl mx-auto py-12 animate-fade-in px-4" role="alert">
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-800 p-8 text-left">
          <h2 className="text-lg font-semibold text-rose-900 dark:text-rose-100 mb-2">SRS generation issue</h2>
          <p className="text-sm text-rose-800 dark:text-rose-200 mb-6">{pipelineError}</p>
          <Link
            to="/generate-srs"
            className="inline-flex items-center gap-2 rounded-lg bg-r2d-primary px-4 py-2 text-white text-sm font-medium hover:bg-r2d-primaryLight"
          >
            Back to Generate SRS
          </Link>
        </div>
      </div>
    );
  }

  if ((isStreamingSrs || streamPreview) && !srsData) {
    return <SrsGenerationLoaderOverlay active streamPreview={streamPreview} />;
  }

  if (!srsData) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center animate-fade-in px-4" role="status">
        <RefreshCw className="h-10 w-10 mx-auto animate-spin text-r2d-primary mb-4" aria-hidden="true" />
        <p className="text-slate-600 dark:text-slate-400">Preparing document view…</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in overflow-x-hidden px-1 sm:px-0" role="main" aria-labelledby="srs-heading">
      <div className="bg-white dark:bg-slate-900 rounded-xl card-shadow p-4 sm:p-6 md:p-8 overflow-x-hidden">
        {/* Header — single Actions menu (keeps the toolbar compact). */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            {!srsData.raw_text && (
              <h2 id="srs-heading" className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                {srsData.title}
              </h2>
            )}
            {srsData.raw_text && (
              <h2 id="srs-heading" className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                SRS Document
              </h2>
            )}
            <p className="text-gray-600 dark:text-slate-400 text-sm">Document ID: {srsData.document_id}</p>
          </div>
          <div className="relative w-full sm:w-auto" ref={actionsMenuRef}>
            <button
              type="button"
              onClick={() => setActionsMenuOpen((o) => !o)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border-2 border-r2d-primary/40 bg-gradient-to-r from-r2d-primary to-r2d-accent px-4 py-2.5 text-sm font-medium text-white shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2"
              aria-expanded={actionsMenuOpen}
              aria-haspopup="menu"
              id="srs-actions-trigger"
            >
              <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Actions</span>
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${actionsMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {actionsMenuOpen && (
              <div
                role="menu"
                aria-labelledby="srs-actions-trigger"
                className="absolute right-0 left-0 sm:left-auto z-50 mt-2 w-full sm:w-72 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-2xl py-1 overflow-hidden animate-fade-in"
              >
                <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  Document
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  onClick={() => {
                    downloadSRS();
                    setActionsMenuOpen(false);
                  }}
                >
                  <Download className="h-4 w-4 text-r2d-primary shrink-0" />
                  Download PDF
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  onClick={() => {
                    downloadSRSDocx();
                    setActionsMenuOpen(false);
                  }}
                >
                  <Download className="h-4 w-4 text-r2d-primary shrink-0" />
                  Download .docx
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  onClick={() => {
                    printSRS();
                    setActionsMenuOpen(false);
                  }}
                >
                  <Printer className="h-4 w-4 text-r2d-accent shrink-0" />
                  Print
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  onClick={() => {
                    navigate('/expert-review', {
                      state: { preselectDocumentId: srsData.document_id || srsData.id },
                    });
                    setActionsMenuOpen(false);
                  }}
                >
                  <UserCheck className="h-4 w-4 text-r2d-primary shrink-0" />
                  Expert review
                </button>
                <Link
                  role="menuitem"
                  to="/srs-metrics"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  onClick={() => setActionsMenuOpen(false)}
                >
                  <BarChart3 className="h-4 w-4 text-slate-600 shrink-0" />
                  SRS metrics
                </Link>
                {hasQualityChecks && (
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                    onClick={() => {
                      setShowValidation((prev) => !prev);
                      setActionsMenuOpen(false);
                    }}
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    {showValidation ? 'Hide checks' : 'Show checks'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {showValidation && hasQualityChecks && (
          <div className="mb-6 space-y-4">
            {srsData.verification_report?.conflict_analysis?.conflicts?.length > 0 && (
              <div className="p-4 rounded-lg border border-rose-200 bg-rose-50/90 dark:bg-rose-950/30 dark:border-rose-800">
                <h4 className="font-semibold text-rose-900 dark:text-rose-100 text-sm mb-2">
                  Conflict checks (pinpoint in document)
                </h4>
                <p className="text-xs text-rose-800 dark:text-rose-200/90 mb-3">
                  Select a row to scroll the SRS and highlight the matching passage. Heuristic matches only.
                </p>
                <ul className="space-y-2 max-h-48 overflow-y-auto text-sm">
                  {srsData.verification_report.conflict_analysis.conflicts.slice(0, 12).map((c, idx) => (
                    <li
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-start gap-2 border-b border-rose-200/60 dark:border-rose-800/60 pb-2"
                    >
                      <div className="flex-1 text-rose-900 dark:text-rose-100">
                        {c.sentence ? (
                          <span className="line-clamp-3">{c.sentence}</span>
                        ) : (
                          <span>
                            Pair: {Array.isArray(c.pair) ? c.pair.join(' ↔ ') : JSON.stringify(c)}
                          </span>
                        )}
                      </div>
                      {c.sentence && (
                        <button
                          type="button"
                          onClick={() => highlightAndScrollTo(c.sentence)}
                          className="shrink-0 text-xs px-2 py-1 rounded bg-rose-700 text-white hover:bg-rose-800"
                        >
                          Pin in SRS
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {interactiveQualityFlags.length > 0 && (
              <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/90 dark:bg-amber-950/30 dark:border-amber-800">
                <h4 className="font-semibold text-amber-900 dark:text-amber-100 text-sm mb-2">
                  Actionable quality flags (pinpoint in document)
                </h4>
                <p className="text-xs text-amber-800 dark:text-amber-200/90 mb-3">
                  These are generated from current quality metrics and SRS text patterns. Click to jump and highlight.
                </p>
                <ul className="space-y-2 max-h-56 overflow-y-auto text-sm">
                  {interactiveQualityFlags.map((f, idx) => (
                    <li key={`iq-${idx}`} className="flex flex-col sm:flex-row sm:items-start gap-2 border-b border-amber-200/60 dark:border-amber-800/60 pb-2">
                      <div className="flex-1 text-amber-900 dark:text-amber-100">
                        <span className="font-medium">{f.message}</span>
                        {f.snippet ? <p className="text-xs mt-1 opacity-85 line-clamp-2">{f.snippet}</p> : null}
                      </div>
                      {(f.snippet || (f.terms && f.terms.length > 0)) && (
                        <button
                          type="button"
                          onClick={() => highlightAndScrollTo(f.snippet || f.terms?.[0])}
                          className="shrink-0 text-xs px-2 py-1 rounded bg-amber-700 text-white hover:bg-amber-800"
                        >
                          Pinpoint in SRS
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Document Metadata */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-800/80 dark:to-slate-900 p-6 rounded-lg mb-8 border border-gray-200 dark:border-slate-600">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <h3 className="text-xs font-medium text-gray-600 dark:text-slate-400 uppercase tracking-wide mb-1">Version</h3>
              <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">{srsData.version}</p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-600 dark:text-slate-400 uppercase tracking-wide mb-1">Date</h3>
              <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">{srsData.date}</p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-600 dark:text-slate-400 uppercase tracking-wide mb-1">Author</h3>
              <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">{srsData.author}</p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-600 dark:text-slate-400 uppercase tracking-wide mb-1">Status</h3>
              <p className="text-lg font-semibold text-green-600 flex items-center space-x-1">
                <CheckCircle className="h-4 w-4" aria-hidden="true" />
                <span>Generated</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col w-full">
        <div className="order-2 mt-8 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/80 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-r2d-primary shrink-0" />
                SRS quality snapshot
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                The SRS document is shown above. Green means pass, red means review on the metrics page. Click any
                tile to open the full metrics table with that row highlighted.
              </p>
            </div>
            <button
              type="button"
              onClick={generateTextualUseCase}
              disabled={genTextualUcLoading || !hasModelTextualUseCases(srsData)}
              title={
                hasModelTextualUseCases(srsData)
                  ? 'Build textual use cases and diagram from the model appendix'
                  : 'Regenerate the SRS so the model includes the textual use case appendix'
              }
              className="shrink-0 bg-r2d-primary hover:bg-r2d-primaryLight disabled:bg-slate-400 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {genTextualUcLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Workflow className="h-4 w-4" />}
              Generate textual use case!
            </button>
          </div>

          {srsDashboardLoading && (
            <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-r2d-primary" />
              Loading quality insights…
            </p>
          )}
          {srsDashboardError && (
            <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-800">
              {srsDashboardError}
            </p>
          )}

          {!srsDashboardLoading && srsDashboard?.summary_line && (
            <p className="text-sm sm:text-base text-slate-800 dark:text-slate-100 leading-relaxed border-l-4 border-r2d-primary pl-3 py-1 mb-4">
              {srsDashboard.summary_line}
            </p>
          )}

          {!srsDashboardLoading && dashboardTiles.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dashboardTiles.map((tile, idx) => {
                const href = tile.focus
                  ? `/srs-metrics?focus=${encodeURIComponent(tile.focus)}`
                  : '/srs-metrics';
                const pass = tile.pass === true;
                const label = pass ? 'Pass' : 'Review';
                return (
                  <Link
                    key={`tile-${idx}-${tile.focus || 'full'}`}
                    to={href}
                    aria-label={`${tile.title}: ${label}. Open SRS metrics.`}
                    className="block rounded-lg border border-slate-200 dark:border-slate-600 p-3 hover:border-r2d-primary dark:hover:border-r2d-accent hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-r2d-primary cursor-pointer"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {tile.title}
                    </p>
                    <div className="mt-3 flex items-center" aria-hidden="true">
                      <span
                        title={label}
                        className={`inline-block h-5 w-5 rounded-full shrink-0 ${
                          pass ? 'bg-emerald-500 ring-2 ring-emerald-500/40' : 'bg-red-500 ring-2 ring-red-500/40'
                        }`}
                      />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-snug">{tile.subtitle}</p>
                    <p className="text-[11px] text-r2d-primary dark:text-cyan-300 mt-2">Open metrics →</p>
                  </Link>
                );
              })}
            </div>
          )}

          {Object.keys(hallForDashboard).length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-600">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Generation-time alignment
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-slate-700 dark:text-slate-200">
                {typeof hallForDashboard.term_overlap === 'number' && (
                  <span>
                    Word overlap:{' '}
                    <span className="font-mono font-semibold">
                      {hallForDashboard.term_overlap} / {hallForDashboard.total_original_terms ?? '—'}
                    </span>
                  </span>
                )}
                {hallForDashboard.monitoring?.strictness ? (
                  <span className="text-slate-600 dark:text-slate-400 font-mono text-xs">
                    Monitor: {hallForDashboard.monitoring.strictness}
                  </span>
                ) : null}
                {hallForDashboard.flagged_sections?.length > 0 && (
                  <span className="text-amber-800 dark:text-amber-200">
                    {hallForDashboard.flagged_sections.length} review note(s) — see{' '}
                    <Link to="/srs-metrics?focus=has_hallucinations" className="underline text-r2d-primary">
                      metrics
                    </Link>
                  </span>
                )}
                {Array.isArray(hallForDashboard.informational_signals) &&
                  hallForDashboard.informational_signals.length > 0 && (
                    <span className="text-slate-600 dark:text-slate-400">
                      {hallForDashboard.informational_signals.length} FYI note(s){' '}
                      {hallForDashboard.flagged_sections?.length > 0 ? '(plus review notes above)' : '(expansion/detail is expected)'}
                    </span>
                  )}
              </div>
              {Number(hallForDashboard.confidence_score) < 0.5 && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">{HALLUCINATION_HELP.confidenceLowExample}</p>
              )}
            </div>
          )}

          <div className="mt-4">
            <Link
              to="/srs-metrics"
              className="text-sm text-r2d-primary dark:text-cyan-300 hover:underline font-medium"
            >
              Open full SRS metrics page
            </Link>
          </div>
        </div>

        {srsData.raw_text ? (
          <div className="order-1 mt-8 srs-paper-shell">
            <div className="srs-paper p-3 sm:p-6 overflow-x-hidden">
              <section className="srs-doc-cover mb-6 p-4 sm:p-6">
                <p className="srs-cover-kicker mb-2">Software Requirements Specification</p>
                <h2 className="srs-cover-title text-2xl sm:text-[2rem] text-slate-900 dark:text-slate-100 leading-tight">
                  {srsData.title || 'Untitled Project'}
                </h2>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                  Structured technical document aligned for formal review, sign-off, and handover.
                </p>
                <div className="srs-cover-meta mt-4 overflow-x-auto">
                  <table className="min-w-[560px] w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left font-semibold">Document ID</th>
                        <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left font-semibold">Version</th>
                        <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left font-semibold">Date</th>
                        <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left font-semibold">Author</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 font-mono text-xs">{srsData.document_id || '-'}</td>
                        <td className="border border-slate-300 dark:border-slate-600 px-3 py-2">{srsData.version || '1.0'}</td>
                        <td className="border border-slate-300 dark:border-slate-600 px-3 py-2">{srsData.date || '-'}</td>
                        <td className="border border-slate-300 dark:border-slate-600 px-3 py-2">{srsData.author || 'System'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-slate-300/80 dark:border-slate-600 bg-black dark:bg-slate-900/50">
                    <img src={brandUrl('/req2design-brand-mark.png')} alt="" className="h-5 w-5 object-contain" width="20" height="20" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Req2Design</span>
                  </span>
                </div>
              </section>

              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Choose a section card or open the full continuous document.
                </p>
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden text-sm">
                  <button
                    type="button"
                    onClick={() => setSrsDocLayout('cards')}
                    className={`px-4 py-2 font-medium transition-colors ${
                      srsDocLayout === 'cards'
                        ? 'bg-r2d-primary text-white dark:bg-r2d-accent'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    Section cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setSrsDocLayout('full')}
                    className={`px-4 py-2 font-medium border-l border-slate-200 dark:border-slate-600 transition-colors ${
                      srsDocLayout === 'full'
                        ? 'bg-r2d-primary text-white dark:bg-r2d-accent'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    Full document
                  </button>
                </div>
              </div>

              {srsDocLayout === 'full' ? (
                <div
                  ref={docRootRef}
                  className="srs-doc-root"
                  dangerouslySetInnerHTML={{ __html: srsFormattedHtml }}
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                    {srsSectionCards.sections.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveSrsSectionId(s.id)}
                        className={`text-left rounded-xl border p-4 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-r2d-accent ${
                          activeSrsSectionId === s.id
                            ? 'border-r2d-primary ring-2 ring-r2d-primary/25 bg-r2d-accentMuted/30 dark:bg-r2d-accent/15 dark:border-r2d-accent'
                            : 'border-slate-200 dark:border-slate-600 bg-white/90 dark:bg-slate-900/50 hover:border-r2d-primary/50'
                        }`}
                      >
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block">{s.title}</span>
                        <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">
                          {activeSrsSectionId === s.id ? 'Showing below' : 'Click to open'}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div
                    ref={docRootRef}
                    className="srs-doc-root rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-950/40 p-4 sm:p-6 min-h-[36vh] overflow-auto"
                    dangerouslySetInnerHTML={{
                      __html:
                        srsSectionCards.sections.find((sec) => sec.id === activeSrsSectionId)?.html ||
                        srsSectionCards.sections[0]?.html ||
                        srsSectionCards.fullHtml,
                    }}
                  />
                </>
              )}

              <div className="mt-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/70 shadow-sm overflow-hidden">
                <div className="px-5 py-4">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">End of document</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Generated by <span className="font-semibold">Req2Design – AI SRS Engineering Platform</span>. This footer is added by the application
                    (not the model) to keep exports consistent.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="order-1 w-full">
        {/* Expand/Collapse Controls */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={expandAll}
            className="text-sm text-r2d-accent hover:text-r2d-primaryLight px-3 py-1 rounded border border-r2d-accentMuted hover:bg-r2d-accentMuted/40 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-r2d-accent"
            aria-label="Expand all sections"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-sm text-gray-600 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300 px-3 py-1 rounded border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:bg-slate-800/50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            aria-label="Collapse all sections"
          >
            Collapse All
          </button>
        </div>

        {/* SRS Sections */}
        <div className="space-y-4">
          {/* Introduction Section */}
          <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200">
            <button
              onClick={() => toggleSection('introduction')}
              className="w-full p-4 sm:p-6 text-left flex items-center justify-between gap-3 hover:bg-gray-50 dark:bg-slate-800/50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-r2d-accent"
              aria-expanded={expandedSections.introduction}
              aria-controls="introduction-content"
            >
              <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">1. Introduction</h3>
              {expandedSections.introduction ? (
                <ChevronDown className="h-5 w-5 text-gray-500 dark:text-slate-500 transition-transform duration-200" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-500 dark:text-slate-500 transition-transform duration-200" aria-hidden="true" />
              )}
            </button>
            {expandedSections.introduction && (
              <div id="introduction-content" className="px-4 sm:px-6 pb-6 space-y-4 animate-slide-up">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">1.1 Purpose</h4>
                  <p className="text-gray-700 dark:text-slate-300 leading-relaxed">{srsData.sections.introduction.purpose}</p>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">1.2 Scope</h4>
                  <p className="text-gray-700 dark:text-slate-300 leading-relaxed">{srsData.sections.introduction.scope}</p>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">1.3 Definitions</h4>
                  <ul className="list-disc list-inside text-gray-700 dark:text-slate-300 space-y-1">
                    {srsData.sections.introduction.definitions.map((def, index) => (
                      <li key={index}>{def}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">1.4 Overview</h4>
                  <p className="text-gray-700 dark:text-slate-300 leading-relaxed">{srsData.sections.introduction.overview}</p>
                </div>
              </div>
            )}
          </div>

          {/* Overall Description Section */}
          <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200">
            <button
              onClick={() => toggleSection('overall_description')}
              className="w-full p-4 sm:p-6 text-left flex items-center justify-between gap-3 hover:bg-gray-50 dark:bg-slate-800/50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-r2d-accent"
              aria-expanded={expandedSections.overall_description}
              aria-controls="overall-description-content"
            >
              <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">2. Overall Description</h3>
              {expandedSections.overall_description ? (
                <ChevronDown className="h-5 w-5 text-gray-500 dark:text-slate-500 transition-transform duration-200" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-500 dark:text-slate-500 transition-transform duration-200" aria-hidden="true" />
              )}
            </button>
            {expandedSections.overall_description && (
              <div id="overall-description-content" className="px-6 pb-6 space-y-4 animate-slide-up">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">2.1 Product Functions</h4>
                  <ul className="list-disc list-inside text-gray-700 dark:text-slate-300 space-y-1">
                    {srsData.sections.overall_description.product_functions.map((func, index) => (
                      <li key={index}>{func}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">2.2 User Characteristics</h4>
                  <ul className="list-disc list-inside text-gray-700 dark:text-slate-300 space-y-1">
                    {srsData.sections.overall_description.user_characteristics.map((user, index) => (
                      <li key={index}>{user}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">2.3 Constraints</h4>
                  <ul className="list-disc list-inside text-gray-700 dark:text-slate-300 space-y-1">
                    {srsData.sections.overall_description.constraints.map((constraint, index) => (
                      <li key={index}>{constraint}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">2.4 Assumptions</h4>
                  <ul className="list-disc list-inside text-gray-700 dark:text-slate-300 space-y-1">
                    {srsData.sections.overall_description.assumptions.map((assumption, index) => (
                      <li key={index}>{assumption}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">2.5 Dependencies</h4>
                  <ul className="list-disc list-inside text-gray-700 dark:text-slate-300 space-y-1">
                    {srsData.sections.overall_description.dependencies.map((dep, index) => (
                      <li key={index}>{dep}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Specific Requirements Section */}
          {srsData.sections.specific_requirements && (
            <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200">
              <button
                onClick={() => toggleSection('specific_requirements')}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 dark:bg-slate-800/50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-r2d-accent"
                aria-expanded={expandedSections.specific_requirements}
                aria-controls="specific-requirements-content"
              >
                <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">3. Specific Requirements</h3>
                {expandedSections.specific_requirements ? (
                  <ChevronDown className="h-5 w-5 text-gray-500 dark:text-slate-500 transition-transform duration-200" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-500 dark:text-slate-500 transition-transform duration-200" aria-hidden="true" />
                )}
              </button>
              {expandedSections.specific_requirements && (
                <div id="specific-requirements-content" className="px-6 pb-6 space-y-4 animate-slide-up">
                  {srsData.sections.specific_requirements.functional_requirements?.length > 0 && (
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">3.1 Functional Requirements</h4>
                      <ul className="list-disc list-inside text-gray-700 dark:text-slate-300 space-y-1">
                        {srsData.sections.specific_requirements.functional_requirements.map((fr, index) => (
                          <li key={index}>
                            {typeof fr === 'object' ? `${fr.id || `FR-${index + 1}`}: ${fr.description || (fr.input ? `${fr.input} → ${fr.processing} → ${fr.output}` : 'Functional requirement')}` : fr}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {srsData.sections.specific_requirements.performance_requirements && Object.keys(srsData.sections.specific_requirements.performance_requirements).length > 0 && (
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">3.2 Performance Requirements</h4>
                      <div className="space-y-2 text-gray-700 dark:text-slate-300">
                        {Object.entries(srsData.sections.specific_requirements.performance_requirements).map(([key, value]) => 
                          value ? (
                            <p key={key}><strong>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong> {value}</p>
                          ) : null
                        )}
                      </div>
                    </div>
                  )}
                  {srsData.sections.specific_requirements.software_system_attributes && (
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">3.3 Software System Attributes</h4>
                      <div className="space-y-2 text-gray-700 dark:text-slate-300">
                        {srsData.sections.specific_requirements.software_system_attributes.reliability && (
                          <p><strong>Reliability:</strong> {srsData.sections.specific_requirements.software_system_attributes.reliability}</p>
                        )}
                        {srsData.sections.specific_requirements.software_system_attributes.security && (
                          <p><strong>Security:</strong> {srsData.sections.specific_requirements.software_system_attributes.security}</p>
                        )}
                        {srsData.sections.specific_requirements.software_system_attributes.usability && (
                          <p><strong>Usability:</strong> {srsData.sections.specific_requirements.software_system_attributes.usability}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default SRSViewer;
