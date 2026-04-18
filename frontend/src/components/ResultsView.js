import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  FileText,
  Download,
  Eye,
  RefreshCw,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  X,
  Edit3,
  Workflow,
  UserCheck,
  BarChart3,
  ExternalLink,
  FileDown,
} from 'lucide-react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { saveSRS } from '../utils/storage';
import SRSEditor from './SRSEditor';
import config from '../config';
import { formatSrsToHtml } from '../utils/documentFormatter';
import { saveBlobResponseAsDownload, messageFromAxiosBlobError } from '../utils/downloadHelpers';
import { getApiErrorMessage } from '../utils/apiErrors';
import { consumeSrsGenerateStream } from '../utils/srsStream';
import { hasModelTextualUseCases } from '../utils/useCaseRequest';
import SrsGenerationLoaderOverlay from './SrsGenerationLoaderOverlay';

/**
 * Summarize pipeline steps for the UI (no raw tab dumps).
 */
function buildPreprocessingBullets(items) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const bullets = [];
  let linguistic = false;
  let ambTotal = 0;
  let blocksWithExtracted = 0;
  let hasSrsDraft = false;

  for (const r of items) {
    const p = r?.preprocessed;
    if (
      p &&
      ((Array.isArray(p.sentences) && p.sentences.length > 0) ||
        (Array.isArray(p.tokens) && p.tokens.length > 0) ||
        (Array.isArray(p.entities) && p.entities.length > 0))
    ) {
      linguistic = true;
    }
    if (Array.isArray(r?.ambiguities)) ambTotal += r.ambiguities.length;
    const ef = r?.extracted_fields;
    if (ef && typeof ef === 'object' && Object.keys(ef).length > 0) blocksWithExtracted += 1;
    const srs = r?.srs_sections;
    if (srs && typeof srs === 'object' && Object.keys(srs).length > 0) hasSrsDraft = true;
  }

  if (linguistic) {
    bullets.push(
      'Text normalization and linguistic pre-processing were applied (sentence segmentation, tokenization, and light NLP analysis).'
    );
  }
  if (ambTotal > 0) {
    bullets.push(
      `Ambiguity analysis flagged ${ambTotal} potential issue(s) (e.g. vague terms or unclear scope) for your review.`
    );
  }
  if (blocksWithExtracted > 0) {
    bullets.push(
      `Structured attributes were extracted from ${blocksWithExtracted} requirement block(s) where the model found usable fields.`
    );
  }
  if (hasSrsDraft) {
    bullets.push(
      'Intermediate SRS-oriented structure was built from the extracted content before the final SRS document was generated.'
    );
  }

  return bullets;
}

const ResultsView = ({ results, srsData: srsFromApp, onGenerateSRS, useCaseData }) => {
  const toSafeFilename = useCallback((value, fallback = 'SRS') => {
    const cleaned = String(value || fallback)
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '_');
    return cleaned || fallback;
  }, []);

  const navigate = useNavigate();
  const [isGeneratingSRS, setIsGeneratingSRS] = useState(false);
  const [srsGenerated, setSrsGenerated] = useState(false);
  const [srsData, setSrsData] = useState(null);
  const [srsActionsOpen, setSrsActionsOpen] = useState(false);
  const srsActionsRef = useRef(null);

  useEffect(() => {
    if (srsFromApp === null) {
      setSrsData(null);
      setSrsGenerated(false);
      return;
    }
    if (srsFromApp && (srsFromApp.raw_text || srsFromApp.sections || srsFromApp.document_id)) {
      setSrsData(srsFromApp);
      setSrsGenerated(true);
    }
  }, [srsFromApp]);

  useEffect(() => {
    if (!srsActionsOpen) return;
    const onDoc = (e) => {
      if (srsActionsRef.current && !srsActionsRef.current.contains(e.target)) setSrsActionsOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setSrsActionsOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [srsActionsOpen]);

  const [showSRS, setShowSRS] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [srsGenError, setSrsGenError] = useState(null);
  /** Raw SRS text accumulated from the streaming endpoint (append-only; improves perceived latency). */
  const [streamPreview, setStreamPreview] = useState('');

  const hallAnalysis = useMemo(() => {
    if (!srsData) return null;
    return srsData.hallucination_analysis || srsData.sections?._hallucination_analysis || null;
  }, [srsData]);

  const hallucinationPct = useMemo(() => {
    const score = Number(hallAnalysis?.confidence_score);
    if (!Number.isFinite(score)) return null;
    const clamped = Math.max(0, Math.min(1, score));
    return Math.round(clamped * 100);
  }, [hallAnalysis?.confidence_score]);

  const lowConfidenceThreshold = 60;
  const shouldSuggestExpertReview =
    srsGenerated &&
    hallucinationPct !== null &&
    (hallucinationPct < lowConfidenceThreshold || hallAnalysis?.has_hallucinations === true);

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

  const generateSRS = useCallback(async () => {
    if (!results) return;
    const items = Array.isArray(results) ? results : (Array.isArray(results?.results) ? results.results : [results]);
    
    setIsGeneratingSRS(true);
    setSrsGenerated(false); // Reset state
    setSrsGenError(null);
    setStreamPreview('');
    try {
      const srsPayload = await consumeSrsGenerateStream({
        url: config.API_ENDPOINTS.GENERATE_SRS_STREAM,
        body: {
          results: items,
          project_info: results.project_info || {},
        },
        onDelta: (_chunk, accumulated) => setStreamPreview(accumulated),
      });

      if (srsPayload && (srsPayload.sections || srsPayload.raw_text)) {
        setSrsData(srsPayload);
        onGenerateSRS(srsPayload);
        setSrsGenerated(true);

        try {
          saveSRS(srsPayload);
        } catch (error) {
          console.error('Error saving SRS to storage:', error);
        }
      } else {
        console.error('SRS generation returned empty data');
        setSrsGenError('The server returned an empty SRS. Check API logs and try again.');
      }
    } catch (error) {
      console.error('SRS generation failed:', error);
      setSrsGenError(getApiErrorMessage(error, 'SRS generation failed.'));
    } finally {
      setIsGeneratingSRS(false);
      setStreamPreview('');
    }
  }, [results, onGenerateSRS]);

  const downloadSRSDocument = useCallback(async () => {
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

  const downloadSRSWord = useCallback(async () => {
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
      console.error('Error downloading SRS Word document:', error);
      const msg = await messageFromAxiosBlobError(error);
      alert(msg);
    }
  }, [srsData, toSafeFilename]);

  const generateHTMLContent = useCallback((data) => {
    return `<!DOCTYPE html>
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
        ${data.sections.specific_requirements.functional_requirements?.length ? `
        <h3>3.1 Functional Requirements</h3>
        <ul>
        ${data.sections.specific_requirements.functional_requirements.map(fr => 
          typeof fr === 'object' ? `<li><strong>${fr.id || 'FR'}:</strong> ${fr.description || JSON.stringify(fr)}</li>` : `<li>${fr}</li>`
        ).join('')}
        </ul>
        ` : ''}
        ${data.sections.specific_requirements.performance_requirements && Object.keys(data.sections.specific_requirements.performance_requirements).length ? `
        <h3>3.2 Performance Requirements</h3>
        ${Object.entries(data.sections.specific_requirements.performance_requirements).map(([key, value]) => 
          value ? `<p><strong>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong> ${value}</p>` : ''
        ).join('')}
        ` : ''}
        ${data.sections.specific_requirements.software_system_attributes ? `
        <h3>3.3 Software System Attributes</h3>
        ${data.sections.specific_requirements.software_system_attributes.reliability ? `<p><strong>Reliability:</strong> ${data.sections.specific_requirements.software_system_attributes.reliability}</p>` : ''}
        ${data.sections.specific_requirements.software_system_attributes.security ? `<p><strong>Security:</strong> ${data.sections.specific_requirements.software_system_attributes.security}</p>` : ''}
        ${data.sections.specific_requirements.software_system_attributes.usability ? `<p><strong>Usability:</strong> ${data.sections.specific_requirements.software_system_attributes.usability}</p>` : ''}
        ` : ''}
    </div>
    ` : ''}
</body>
</html>`;
  }, []);


  const items = useMemo(() => {
    return Array.isArray(results) ? results : (Array.isArray(results?.results) ? results.results : [results]);
  }, [results]);

  const preprocessingBullets = useMemo(() => buildPreprocessingBullets(items), [items]);

  const hasRenderableRequirementText = useMemo(
    () =>
      items.some((r) => {
        if (r == null || typeof r !== 'object') return false;
        return String(r.original_text || r.content || r.text || '').trim().length > 0;
      }),
    [items]
  );

  if (!results) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16 animate-fade-in" role="status">
        <div className="rounded-xl card-shadow p-12 border" style={{ background: 'var(--card)', color: 'var(--text)', borderColor: 'var(--card-border)' }}>
          <FileText className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--muted)' }} aria-hidden="true" />
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text)' }}>No Results Available</h2>
          <p style={{ color: 'var(--muted)' }}>
            Process some requirements first to see results here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
    <SrsGenerationLoaderOverlay active={isGeneratingSRS} streamPreview={streamPreview} />
    <div className="max-w-6xl mx-auto animate-fade-in overflow-x-hidden" role="main" aria-labelledby="results-heading">
      <div className="rounded-xl card-shadow p-4 sm:p-6 md:p-8 border overflow-x-hidden" style={{ background: 'var(--card)', color: 'var(--text)', borderColor: 'var(--card-border)' }}>
        <div className="mb-8 space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 id="results-heading" className="text-2xl md:text-3xl font-bold mb-2 flex items-center space-x-2" style={{ color: 'var(--text)' }}>
                <Sparkles className="h-6 w-6" style={{ color: 'var(--muted)' }} aria-hidden="true" />
                <span>Processing Results</span>
              </h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Review processed requirements. Use <strong className="text-slate-700 dark:text-slate-300">Generate / Regenerate</strong> for the
                model run, then open <strong className="text-slate-700 dark:text-slate-300">SRS actions</strong> for view, export, edit, and review.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full md:w-auto md:justify-end">
              {srsGenerated && hallucinationPct !== null ? (
                <div
                  className={`order-1 sm:order-none inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
                    hallucinationPct >= 70
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100'
                      : hallucinationPct >= 50
                        ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100'
                        : 'border-red-200 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-100'
                  }`}
                  title="Vocabulary overlap between your input and this SRS (heuristic, not a literal error rate)"
                >
                  Grounding overlap: {hallucinationPct}%
                </div>
              ) : null}
              <button
                type="button"
                onClick={generateSRS}
                disabled={isGeneratingSRS}
                className="order-1 sm:order-none bg-slate-700 hover:bg-slate-800 disabled:bg-gray-400 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 font-medium"
                aria-label={srsGenerated ? 'Regenerate SRS document' : 'Generate SRS document'}
                aria-busy={isGeneratingSRS}
              >
                {isGeneratingSRS ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
                    <span>Generating…</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{srsGenerated ? 'Regenerate SRS' : 'Generate SRS'}</span>
                  </>
                )}
              </button>

              {srsGenerated && srsData && (
                <div className="relative order-2 sm:order-none w-full sm:w-auto" ref={srsActionsRef}>
                  <button
                    type="button"
                    onClick={() => setSrsActionsOpen((o) => !o)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-r2d-primary/40 bg-gradient-to-r from-r2d-primary to-r2d-accent text-white font-medium shadow-md hover:shadow-lg hover:from-r2d-primaryLight hover:to-r2d-accent focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2 transition-all"
                    aria-expanded={srsActionsOpen}
                    aria-haspopup="menu"
                    aria-controls="srs-actions-menu"
                    id="srs-actions-trigger"
                  >
                    <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>SRS actions</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${srsActionsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>

                  {srsActionsOpen && (
                    <div
                      id="srs-actions-menu"
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
                          navigate('/srs');
                          setSrsActionsOpen(false);
                        }}
                      >
                        <FileText className="h-4 w-4 shrink-0 text-r2d-primary" />
                        View full SRS
                        <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-40" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                        onClick={() => {
                          setShowSRS(true);
                          setSrsActionsOpen(false);
                        }}
                      >
                        <Eye className="h-4 w-4 shrink-0 text-r2d-accent" />
                        Quick preview
                      </button>

                      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-t border-b border-slate-100 dark:border-slate-700 mt-1">
                        Export
                      </div>
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                        onClick={() => {
                          downloadSRSDocument();
                          setSrsActionsOpen(false);
                        }}
                      >
                        <FileDown className="h-4 w-4 shrink-0 text-emerald-600" />
                        Download PDF
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                        onClick={() => {
                          downloadSRSWord();
                          setSrsActionsOpen(false);
                        }}
                      >
                        <Download className="h-4 w-4 shrink-0 text-r2d-primary" />
                        Download Word (.docx)
                      </button>

                      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-t border-b border-slate-100 dark:border-slate-700 mt-1">
                        Edit
                      </div>
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                        onClick={() => {
                          setShowEditor(true);
                          setSrsActionsOpen(false);
                        }}
                      >
                        <Edit3 className="h-4 w-4 shrink-0 text-orange-600" />
                        Edit SRS
                      </button>

                      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-t border-b border-slate-100 dark:border-slate-700 mt-1">
                        Quality &amp; review
                      </div>
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                        onClick={() => {
                          navigate('/expert-review', {
                            state: { preselectDocumentId: srsData.document_id || srsData.id },
                          });
                          setSrsActionsOpen(false);
                        }}
                      >
                        <UserCheck className="h-4 w-4 shrink-0 text-r2d-primary" />
                        Expert review
                      </button>
                      <Link
                        role="menuitem"
                        to="/srs-metrics"
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                        onClick={() => setSrsActionsOpen(false)}
                      >
                        <BarChart3 className="h-4 w-4 shrink-0 text-slate-600" />
                        SRS metrics table
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {srsGenError && (
            <div
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100"
              role="alert"
            >
              <span className="font-medium">SRS error: </span>
              {srsGenError}
            </div>
          )}
          {shouldSuggestExpertReview && srsData && (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              role="alert"
            >
              <p>
                Grounding overlap is <span className="font-semibold">{hallucinationPct}%</span> (below {lowConfidenceThreshold}%){' '}
                {hallAnalysis?.has_hallucinations ? 'and alignment monitoring suggested a review-tier check. ' : ''}
                Consider expert review if this draft must be contract-grade.
              </p>
              <button
                type="button"
                onClick={() => {
                  navigate('/expert-review', {
                    state: { preselectDocumentId: srsData.document_id || srsData.id },
                  });
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 text-sm font-semibold"
              >
                <UserCheck className="h-4 w-4" />
                Send to Expert Review
              </button>
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
          <div className="bg-gradient-to-br from-r2d-accentMuted/50 to-r2d-accentMuted dark:from-r2d-primary/30 dark:to-r2d-accent/25 p-6 rounded-lg border border-r2d-accent/30 dark:border-r2d-primary/50 hover:shadow-lg transition-shadow duration-200">
            <h3 className="text-sm font-medium text-r2d-primary dark:text-r2d-accentSoft mb-2">Status</h3>
            <p className="text-2xl md:text-3xl font-bold text-r2d-primaryLight dark:text-r2d-accentSoft">
              {results.status || 'Completed'}
            </p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-emerald-950/40 dark:to-green-900/30 p-6 rounded-lg border border-green-200 dark:border-emerald-800 hover:shadow-lg transition-shadow duration-200">
            <h3 className="text-sm font-medium text-green-900 dark:text-emerald-200 mb-2">Requirements</h3>
            <p className="text-2xl md:text-3xl font-bold text-green-600 dark:text-emerald-400">{items.length}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/40 dark:to-indigo-900/30 p-6 rounded-lg border border-blue-200 dark:border-blue-800 hover:shadow-lg transition-shadow duration-200">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">Timestamp</h3>
            <p className="text-sm font-bold text-r2d-accent dark:text-r2d-accentSoft">
              {results.timestamp ? new Date(results.timestamp).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>

        {/* Pre-processing summary (replaces expandable tabs for ambiguities / preprocessed / etc.) */}
        <div
          className="mb-8 rounded-xl border p-5 md:p-6"
          style={{ borderColor: 'var(--card-border)', background: 'var(--bg)' }}
        >
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-3" style={{ color: 'var(--text)' }}>
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" aria-hidden="true" />
            Pre-processing
          </h3>
          {preprocessingBullets.length > 0 ? (
            <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
              {preprocessingBullets.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              Pre-processing completed successfully. Your requirements were validated and passed forward to SRS generation.
              When the pipeline records extra steps (normalization, ambiguity checks, field extraction), they will appear here as
              bullet points.
            </p>
          )}
        </div>

        {/* Requirement text only (no per-section tabs) */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            Your input
          </h3>
          {!hasRenderableRequirementText ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              No requirement text was included in the server response. If you expected content here, check the API or try
              processing again.
            </p>
          ) : (
            items.map((result, index) => {
              if (result == null || typeof result !== 'object') return null;
              const text = result.original_text || result.content || result.text || '';
              if (!String(text).trim()) return null;
              return (
                <div
                  key={index}
                  className="rounded-xl border p-4 md:p-5"
                  style={{ background: 'var(--card)', borderColor: 'var(--card-border)', color: 'var(--text)' }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2 opacity-70">
                    Requirement {index + 1}
                    {result.status ? (
                      <span
                        className={`ml-2 normal-case font-medium px-2 py-0.5 rounded-full text-[11px] ${
                          result.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
                            : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
                        }`}
                      >
                        {result.status}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{String(text).trim()}</p>
                </div>
              );
            })
          )}
        </div>

        {srsGenerated && (
          <div className="mt-8 border rounded-xl p-6" style={{ borderColor: 'var(--card-border)', background: 'var(--bg)' }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <Workflow className="h-5 w-5" />
                  Use Case Outputs
                </h3>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Textual use cases and the PlantUML diagram are derived from the SRS appendix. Open a page below for the full view and exports—the diagram is built automatically when the appendix is present.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/textual-usecases')}
                  className="text-sm bg-gradient-to-r from-r2d-primary to-r2d-accent hover:from-r2d-primaryLight hover:to-r2d-accent text-white px-4 py-2 rounded-lg"
                >
                  Textual use cases
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/usecase-diagram')}
                  className="text-sm bg-slate-700 hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500 text-white px-4 py-2 rounded-lg"
                >
                  Use case diagram
                </button>
              </div>
            </div>

            {hasModelTextualUseCases(srsData) && (
              <div className="rounded-lg border p-4" style={{ borderColor: 'var(--card-border)', background: 'var(--card)' }}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h4 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                    <FileText className="h-4 w-4" />
                    Appendix preview
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      downloadText(
                        `textual_usecases_${srsData?.document_id || 'srs'}.txt`,
                        useCaseData?.textual_usecases?.text || srsData?.textual_usecases?.text || ''
                      )
                    }
                    className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded w-full sm:w-auto"
                  >
                    Download .txt
                  </button>
                </div>
                <pre
                  className="whitespace-pre-wrap text-sm rounded border p-3 max-h-48 overflow-auto"
                  style={{ borderColor: 'var(--card-border)', color: 'var(--text)' }}
                >
                  {(useCaseData?.textual_usecases?.text || srsData?.textual_usecases?.text || '').trim() ||
                    'No textual use cases from the SRS model appendix.'}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SRS Display Modal - Enhanced Aesthetics */}
      {showSRS && srsData && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-fade-in" 
          onClick={() => setShowSRS(false)}
        >
          <div 
            className="bg-gradient-to-br from-white via-slate-50 to-r2d-accentMuted/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-2xl shadow-2xl w-full max-w-[min(96vw,72rem)] max-h-[96dvh] overflow-hidden flex flex-col border border-slate-200/50 dark:border-slate-600 animate-scale-in" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Enhanced Header */}
            <div className="bg-gradient-to-r from-r2d-primary via-r2d-primaryLight to-r2d-accent p-4 sm:p-6 text-white">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-2xl md:text-3xl font-bold mb-2 flex items-center space-x-3">
                    <FileText className="h-7 w-7" aria-hidden="true" />
                    <span className="truncate">{srsData.title || 'SRS Document'}</span>
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-200 mt-2">
                    <span className="flex items-center space-x-1">
                      <span className="font-semibold">ID:</span>
                      <span className="font-mono">{srsData.document_id}</span>
                    </span>
                    {srsData.version && (
                      <span className="flex items-center space-x-1">
                        <span className="font-semibold">Version:</span>
                        <span>{srsData.version}</span>
                      </span>
                    )}
                    {srsData.author && (
                      <span className="flex items-center space-x-1">
                        <span className="font-semibold">Author:</span>
                        <span>{srsData.author}</span>
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowSRS(false)}
                  className="ml-4 p-2 hover:bg-white/20 rounded-lg transition-all duration-200 text-white hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50"
                  aria-label="Close"
                >
                  <X className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Enhanced Content Area */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
              {srsData.raw_text ? (
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <div className="bg-white dark:bg-slate-950 rounded-lg shadow-inner border border-slate-200 dark:border-slate-600 p-3 sm:p-6 md:p-8">
                    <div
                      className="srs-doc-root text-slate-800 dark:text-slate-200"
                      style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                      dangerouslySetInnerHTML={{ __html: formatSrsToHtml(srsData.raw_text, { assignIds: false }) }}
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="text-amber-800 dark:text-amber-100">
                      <p className="font-semibold mb-2">Raw SRS text not available</p>
                      <p className="text-sm mb-4">Displaying parsed sections:</p>
                      <pre className="mt-4 whitespace-pre-wrap font-mono text-xs bg-white dark:bg-slate-950 p-4 rounded border border-amber-200 dark:border-amber-800 overflow-x-auto dark:text-slate-200">
                        {JSON.stringify(srsData.sections, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Enhanced Footer */}
            <div className="bg-gradient-to-r from-slate-50 to-r2d-accentMuted/35 dark:from-slate-800 dark:to-slate-900 p-4 sm:p-6 border-t border-slate-200 dark:border-slate-600 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="text-sm text-slate-600 dark:text-slate-400 w-full sm:w-auto">
                <span className="font-medium">Document generated on:</span>{' '}
                {srsData.date || new Date().toLocaleDateString()}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setShowSRS(false);
                    setShowEditor(true);
                  }}
                  className="bg-gradient-to-r from-r2d-primary to-r2d-accent hover:from-r2d-primaryLight hover:to-r2d-accent text-white px-4 sm:px-6 py-3 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2 font-medium w-full"
                >
                  <Edit3 className="h-5 w-5" aria-hidden="true" />
                  <span>Edit SRS</span>
                </button>
                <button
                  onClick={downloadSRSDocument}
                  className="bg-gradient-to-r from-r2d-primary to-r2d-accent hover:from-r2d-primaryLight hover:to-r2d-accent text-white px-4 sm:px-6 py-3 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2 font-medium w-full"
                >
                  <Download className="h-5 w-5" aria-hidden="true" />
                  <span>Download SRS</span>
                </button>
                <button
                  onClick={downloadSRSWord}
                  className="bg-gradient-to-r from-r2d-primary to-r2d-accent hover:from-r2d-primaryLight hover:to-r2d-accent text-white px-4 sm:px-6 py-3 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2 font-medium w-full"
                >
                  <Download className="h-5 w-5" aria-hidden="true" />
                  <span>Download .docx</span>
                </button>
                <button
                  onClick={() => setShowSRS(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 sm:px-6 py-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 font-medium w-full"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SRS Editor Modal */}
      {showEditor && srsData && (
        <SRSEditor
          srsData={srsData}
          onSave={(editedSRS) => {
            setSrsData(editedSRS);
            onGenerateSRS(editedSRS);
            setShowEditor(false);
            // Update storage with edited version
            try {
              saveSRS(editedSRS);
            } catch (error) {
              console.error('Error saving edited SRS:', error);
            }
          }}
          onClose={() => setShowEditor(false)}
          theme="dark"
        />
      )}
    </div>
    </>
  );
};

export default ResultsView;
