import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { FileText, Download, Eye, RefreshCw, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Sparkles, X, Edit3, Workflow, FileCode, UserCheck, BarChart3 } from 'lucide-react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { saveSRS } from '../utils/storage';
import SRSEditor from './SRSEditor';
import config from '../config';
import { formatSrsToHtml } from '../utils/documentFormatter';
import { saveBlobResponseAsDownload, messageFromAxiosBlobError } from '../utils/downloadHelpers';
import { getApiErrorMessage } from '../utils/apiErrors';

const ResultsView = ({ results, srsData: srsFromApp, onGenerateSRS, useCaseData, onUseCaseDataChange }) => {
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
  const [showSRS, setShowSRS] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [isGeneratingUseCases, setIsGeneratingUseCases] = useState(false);
  const [srsGenError, setSrsGenError] = useState(null);

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
    try {
      const response = await axios.post(config.API_ENDPOINTS.GENERATE_SRS, {
        results: items,
        project_info: results.project_info || {}
      });
      
      // Check if SRS was actually generated (has sections with content)
      if (response.data && (response.data.sections || response.data.raw_text)) {
        setSrsData(response.data);
        onGenerateSRS(response.data);
        setSrsGenerated(true);
        
        // Save SRS to storage
        try {
          saveSRS(response.data);
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

  const generateUseCases = useCallback(async () => {
    if (!srsData?.sections) return;
    setIsGeneratingUseCases(true);
    try {
      const response = await axios.post(config.API_ENDPOINTS.GENERATE_USECASES, {
        document_id: srsData.document_id,
        title: srsData.title,
        sections: srsData.sections
      });
      if (onUseCaseDataChange) onUseCaseDataChange(response.data);
    } catch (error) {
      console.error('Use case generation failed:', error);
      alert(getApiErrorMessage(error, 'Failed to generate textual use cases and diagram.'));
    } finally {
      setIsGeneratingUseCases(false);
    }
  }, [srsData, onUseCaseDataChange]);

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
    <div className="max-w-6xl mx-auto animate-fade-in" role="main" aria-labelledby="results-heading">
      <div className="rounded-xl card-shadow p-6 md:p-8 border" style={{ background: 'var(--card)', color: 'var(--text)', borderColor: 'var(--card-border)' }}>
        <div className="mb-8 space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 id="results-heading" className="text-2xl md:text-3xl font-bold mb-2 flex items-center space-x-2" style={{ color: 'var(--text)' }}>
                <Sparkles className="h-6 w-6" style={{ color: 'var(--muted)' }} aria-hidden="true" />
                <span>Processing Results</span>
              </h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Review processed requirements. After the pipeline, use View SRS, download, or regenerate below.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
            {srsGenerated && srsData && (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/srs')}
                  className="bg-gradient-to-r from-r2d-primary to-r2d-accent hover:from-r2d-primaryLight hover:to-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2"
                  aria-label="Open full SRS page"
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">View SRS</span>
                </button>
                <button
                  type="button"
                  onClick={downloadSRSDocument}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  aria-label="Download SRS document"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Download SRS</span>
                </button>
                <button
                  type="button"
                  onClick={downloadSRSWord}
                  className="bg-r2d-primary hover:bg-r2d-primaryLight text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2"
                  aria-label="Download SRS as Word"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Download .docx</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditor(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                  aria-label="Edit SRS document"
                >
                  <Edit3 className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Edit SRS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSRS(true)}
                  className="bg-r2d-primary hover:bg-r2d-primaryLight text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2"
                  aria-label="Quick preview SRS in a modal"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Quick preview</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate('/expert-review', {
                      state: { preselectDocumentId: srsData.document_id || srsData.id },
                    })
                  }
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  aria-label="Send SRS to human expert review"
                >
                  <UserCheck className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Expert review</span>
                </button>
                <Link
                  to="/srs-metrics"
                  className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md"
                  aria-label="Open SRS quality metrics"
                >
                  <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">SRS metrics</span>
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={generateSRS}
              disabled={isGeneratingSRS}
              className="bg-slate-600 hover:bg-slate-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
              aria-label={srsGenerated ? 'Regenerate SRS document' : 'Generate SRS document'}
              aria-busy={isGeneratingSRS}
            >
              {isGeneratingSRS ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span className="hidden sm:inline">Generating...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{srsGenerated ? 'Regenerate SRS' : 'Generate SRS'}</span>
                </>
              )}
            </button>
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
        </div>

        {/* Results Summary */}
        <div className="grid sm:grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/40 p-6 rounded-lg border border-blue-200 dark:border-blue-800 hover:shadow-lg transition-shadow duration-200">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">Status</h3>
            <p className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">
              {results.status || 'Completed'}
            </p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-emerald-950/40 dark:to-green-900/30 p-6 rounded-lg border border-green-200 dark:border-emerald-800 hover:shadow-lg transition-shadow duration-200">
            <h3 className="text-sm font-medium text-green-900 dark:text-emerald-200 mb-2">Requirements</h3>
            <p className="text-2xl md:text-3xl font-bold text-green-600 dark:text-emerald-400">{items.length}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-violet-950/40 dark:to-purple-900/30 p-6 rounded-lg border border-purple-200 dark:border-violet-800 hover:shadow-lg transition-shadow duration-200">
            <h3 className="text-sm font-medium text-purple-900 dark:text-violet-200 mb-2">Timestamp</h3>
            <p className="text-sm font-bold text-r2d-accent dark:text-blue-300">
              {results.timestamp ? new Date(results.timestamp).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>

        {/* Detailed Results */}
        <div className="space-y-6">
          {items.map((result, index) => (
            <RequirementCard key={index} result={result} index={index} />
          ))}
        </div>

        {srsGenerated && (
          <div className="mt-8 border rounded-xl p-6" style={{ borderColor: 'var(--card-border)', background: 'var(--bg)' }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
              <div>
                <h3 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <Workflow className="h-5 w-5" />
                  Use Case Outputs
                </h3>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Generate structured textual use cases and a rendered use case diagram after SRS creation.
                </p>
              </div>
              <button
                onClick={generateUseCases}
                disabled={isGeneratingUseCases}
              className="bg-r2d-primary hover:bg-r2d-primaryLight disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200"
              >
                {isGeneratingUseCases ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Workflow className="h-4 w-4" />}
                <span>{isGeneratingUseCases ? 'Generating...' : 'Generate Use Cases'}</span>
              </button>
            </div>

            {useCaseData && (
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="rounded-lg border p-4" style={{ borderColor: 'var(--card-border)', background: 'var(--card)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                      <FileText className="h-4 w-4" />
                      Textual Use Cases
                    </h4>
                    <button
                      onClick={() => downloadText(`textual_usecases_${srsData?.document_id || 'srs'}.txt`, useCaseData?.textual_usecases?.text || '')}
                      className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded"
                    >
                      Download .txt
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm rounded border p-3 max-h-96 overflow-auto" style={{ borderColor: 'var(--card-border)', color: 'var(--text)' }}>
                    {useCaseData?.textual_usecases?.text || 'No textual use cases generated.'}
                  </pre>
                  <button
                    onClick={() => navigate('/textual-usecases')}
                    className="mt-3 text-sm bg-r2d-primary hover:bg-r2d-primaryLight text-white px-3 py-1.5 rounded"
                  >
                    Open Full Textual Use Cases Page
                  </button>
                </div>

                <div className="rounded-lg border p-4" style={{ borderColor: 'var(--card-border)', background: 'var(--card)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                      <Workflow className="h-4 w-4" />
                      Use Case Diagram
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => downloadText(`usecase_${srsData?.document_id || 'srs'}.puml`, useCaseData?.diagram?.plantuml_code || '')}
                        className="text-sm bg-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded flex items-center gap-1"
                      >
                        <FileCode className="h-3.5 w-3.5" />
                        .puml
                      </button>
                      <button
                        onClick={() => {
                          const b64 = useCaseData?.diagram?.diagram_base64;
                          if (!b64) return;
                          const link = document.createElement('a');
                          link.href = `data:image/png;base64,${b64}`;
                          link.download = `usecase_${srsData?.document_id || 'srs'}.png`;
                          document.body.appendChild(link);
                          link.click();
                          link.parentNode.removeChild(link);
                        }}
                        disabled={!useCaseData?.diagram?.diagram_base64}
                        className="text-sm bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white px-3 py-1.5 rounded"
                      >
                        Download .png
                      </button>
                    </div>
                  </div>
                  {useCaseData?.diagram?.diagram_base64 ? (
                    <img
                      src={`data:image/png;base64,${useCaseData.diagram.diagram_base64}`}
                      alt="Use case diagram"
                      className="w-full rounded border"
                      style={{ borderColor: 'var(--card-border)' }}
                    />
                  ) : (
                    <div className="text-sm p-3 rounded border" style={{ borderColor: 'var(--card-border)', color: 'var(--muted)' }}>
                      Diagram PNG was not rendered. {useCaseData?.diagram?.message || 'PlantUML rendering may be unavailable.'}
                    </div>
                  )}
                  <button
                    onClick={() => navigate('/usecase-diagram')}
                    className="mt-3 text-sm bg-r2d-primary hover:bg-r2d-primaryLight text-white px-3 py-1.5 rounded"
                  >
                    Open Full Diagram Page
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SRS Display Modal - Enhanced Aesthetics */}
      {showSRS && srsData && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" 
          onClick={() => setShowSRS(false)}
        >
          <div 
            className="bg-gradient-to-br from-white via-slate-50 to-r2d-accentMuted/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col border border-slate-200/50 dark:border-slate-600 animate-scale-in" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Enhanced Header */}
            <div className="bg-gradient-to-r from-r2d-primary via-r2d-primaryLight to-r2d-accent p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-2xl md:text-3xl font-bold mb-2 flex items-center space-x-3">
                    <FileText className="h-7 w-7" aria-hidden="true" />
                    <span>{srsData.title || 'SRS Document'}</span>
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-blue-100 mt-2">
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
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
              {srsData.raw_text ? (
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <div className="bg-white dark:bg-slate-950 rounded-lg shadow-inner border border-slate-200 dark:border-slate-600 p-6 md:p-8">
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
            <div className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 p-6 border-t border-slate-200 dark:border-slate-600 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium">Document generated on:</span>{' '}
                {srsData.date || new Date().toLocaleDateString()}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSRS(false);
                    setShowEditor(true);
                  }}
                  className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 font-medium"
                >
                  <Edit3 className="h-5 w-5" aria-hidden="true" />
                  <span>Edit SRS</span>
                </button>
                <button
                  onClick={downloadSRSDocument}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 font-medium"
                >
                  <Download className="h-5 w-5" aria-hidden="true" />
                  <span>Download SRS</span>
                </button>
                <button
                  onClick={downloadSRSWord}
                  className="bg-gradient-to-r from-r2d-primary to-r2d-accent hover:from-r2d-primaryLight hover:to-blue-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2 font-medium"
                >
                  <Download className="h-5 w-5" aria-hidden="true" />
                  <span>Download .docx</span>
                </button>
                <button
                  onClick={() => setShowSRS(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-6 py-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 font-medium"
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
  );
};

const RequirementCard = React.memo(({ result, index }) => {
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = useCallback((section) => {
    setExpandedSection(prev => prev === section ? null : section);
  }, []);

  const sections = useMemo(() => [
    { key: 'preprocessed', label: 'Preprocessed Data', data: result.preprocessed, color: 'blue' },
    { key: 'ambiguities', label: 'Ambiguities', data: result.ambiguities, color: 'yellow', count: result.ambiguities?.length },
    { key: 'extracted', label: 'Extracted Fields', data: result.extracted_fields, color: 'green' },
    { key: 'srs', label: 'SRS Sections', data: result.srs_sections, color: 'purple' }
  ], [result]);

  const renderExpandedContent = useCallback((key, data) => {
    if (!data || (Array.isArray(data) && data.length === 0)) return null;

    if (key === 'preprocessed') {
      return (
        <>
          <p><strong>Sentences:</strong> {data.sentences?.length || 0}</p>
          <p><strong>Tokens:</strong> {data.tokens?.length || 0}</p>
          <p><strong>Entities:</strong> {data.entities?.length || 0}</p>
        </>
      );
    }

    if (key === 'ambiguities' && Array.isArray(data)) {
      return (
        <div className="space-y-2">
          {data.map((ambiguity, idx) => (
            <div key={idx} className="p-2 bg-white/60 rounded border border-white/50">
              <p><strong>{ambiguity.word}</strong> - {ambiguity.category}</p>
              <p className="text-xs mt-1">{ambiguity.suggestion}</p>
            </div>
          ))}
        </div>
      );
    }

    if (key === 'extracted' && typeof data === 'object') {
      return (
        <div className="space-y-2">
          {Object.entries(data).map(([fieldKey, value]) => (
            <div key={fieldKey} className="p-2 bg-white/60 rounded border border-white/50">
              <p><strong>{fieldKey}:</strong> {value}</p>
            </div>
          ))}
        </div>
      );
    }

    if (key === 'srs' && typeof data === 'object') {
      return (
        <div className="space-y-2">
          {Object.entries(data).map(([sectionKey, value]) => (
            <div key={sectionKey} className="p-2 bg-white/60 rounded border border-white/50">
              <p><strong>{sectionKey}:</strong> {typeof value === 'object' ? (Array.isArray(value) ? value.join(', ') : Object.values(value).join(', ')) : value}</p>
            </div>
          ))}
        </div>
      );
    }

    return null;
  }, []);

  return (
    <div
      className="border rounded-lg p-6 hover:shadow-md transition-shadow duration-200 animate-slide-up"
      style={{
        animationDelay: `${index * 50}ms`,
        background: 'var(--card)',
        borderColor: 'var(--card-border)',
        color: 'var(--text)'
      }}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h3 className="text-xl font-semibold flex items-center space-x-2" style={{ color: 'var(--text)' }}>
          <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded-full text-sm font-bold">
            {index + 1}
          </span>
          <span>Requirement #{index + 1}</span>
        </h3>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            result.status === 'completed' 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {result.status}
        </span>
      </div>

      {/* Original Text */}
      <div className="mb-6">
        <h4 className="text-lg font-medium mb-2 flex items-center space-x-2" style={{ color: 'var(--text)' }}>
          <FileText className="h-4 w-4 text-gray-500" aria-hidden="true" />
          <span>Original Text</span>
        </h4>
        <div
          className="p-4 rounded-lg border"
          style={{ background: 'var(--bg)', borderColor: 'var(--card-border)' }}
        >
          <p className="leading-relaxed" style={{ color: 'var(--text)' }}>{result.original_text}</p>
        </div>
      </div>

      {/* Expandable Sections */}
      <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {sections.map(({ key, label, data, color, count }) => {
          if (!data || (Array.isArray(data) && data.length === 0)) return null;
          
          const isExpanded = expandedSection === key;
          const colorClasses = {
            blue: 'bg-blue-50 border-blue-200 text-blue-900',
            yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
            green: 'bg-green-50 border-green-200 text-green-900',
            purple: 'bg-purple-50 border-purple-200 text-purple-900'
          };

          return (
            <div key={key} className={`p-4 rounded-lg border transition-all duration-200 ${colorClasses[color]} ${isExpanded ? 'ring-2 ring-white/50' : ''}`}>
              <button
                onClick={() => toggleSection(key)}
                className="w-full text-left font-medium mb-2 flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-offset-2 rounded px-2 py-1 -mx-2 -my-1"
                aria-expanded={isExpanded}
                aria-controls={`${key}-content`}
              >
                <span className="flex items-center space-x-2">
                  <span>{label}</span>
                  {count !== undefined && (
                    <span className="px-2 py-0.5 bg-white/50 rounded-full text-xs font-bold">
                      {count}
                    </span>
                  )}
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 transition-transform duration-200" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 transition-transform duration-200" aria-hidden="true" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {expandedSection && (
        <div
          id={`${expandedSection}-content`}
          className="mt-4 rounded-lg border p-4 bg-white/90 backdrop-blur-sm animate-slide-up sticky top-20 z-10"
          style={{ borderColor: 'var(--card-border)', color: 'var(--text)' }}
        >
          <p className="text-sm font-semibold mb-3">
            {sections.find((s) => s.key === expandedSection)?.label}
          </p>
          <div className="text-sm space-y-2">
            {renderExpandedContent(
              expandedSection,
              sections.find((s) => s.key === expandedSection)?.data
            )}
          </div>
        </div>
      )}
    </div>
  );
});

RequirementCard.displayName = 'RequirementCard';

export default ResultsView;
