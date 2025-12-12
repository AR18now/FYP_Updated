import React, { useState, useMemo, useCallback } from 'react';
import { FileText, Download, Eye, RefreshCw, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Sparkles, X, Edit3 } from 'lucide-react';
import axios from 'axios';
import { saveSRS } from '../utils/storage';
import SRSEditor from './SRSEditor';
import config from '../config';

const ResultsView = ({ results, onGenerateSRS }) => {
  const [isGeneratingSRS, setIsGeneratingSRS] = useState(false);
  const [srsGenerated, setSrsGenerated] = useState(false);
  const [srsData, setSrsData] = useState(null);
  const [showSRS, setShowSRS] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const generateSRS = useCallback(async () => {
    if (!results) return;
    const items = Array.isArray(results) ? results : (Array.isArray(results?.results) ? results.results : [results]);
    
    setIsGeneratingSRS(true);
    setSrsGenerated(false); // Reset state
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
      }
    } catch (error) {
      console.error('SRS generation failed:', error);
      // Don't set failed state - let user retry
    } finally {
      setIsGeneratingSRS(false);
    }
  }, [results, onGenerateSRS]);

  const downloadSRSDocument = useCallback(async () => {
    if (!srsData) return;
    
    try {
      // Call backend to generate PDF/HTML from the raw text or parsed sections
      const response = await axios.post(config.API_ENDPOINTS.GENERATE_SRS_PDF, {
        document_id: srsData.document_id,
        title: srsData.title,
        version: srsData.version,
        date: srsData.date,
        author: srsData.author,
        sections: srsData.sections,
        raw_text: srsData.raw_text, // Pass raw text for full fidelity
      }, {
        responseType: 'blob', // Important for downloading files
      });

      // Determine file type from content type header
      const contentType = response.headers['content-type'] || '';
      const isPDF = contentType.includes('application/pdf');
      const fileExtension = isPDF ? 'pdf' : 'html';
      const fileName = `srs_${srsData.document_id}.${fileExtension}`;

      // Create blob with proper MIME type
      const blob = new Blob([response.data], { 
        type: isPDF ? 'application/pdf' : 'text/html' 
      });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error downloading SRS document:', error);
      alert('Failed to download SRS document. Please try again.');
    }
  }, [srsData]);

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
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 id="results-heading" className="text-2xl md:text-3xl font-bold mb-2 flex items-center space-x-2" style={{ color: 'var(--text)' }}>
              <Sparkles className="h-6 w-6" style={{ color: 'var(--muted)' }} aria-hidden="true" />
              <span>Processing Results</span>
            </h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Review and analyze your processed requirements</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={generateSRS}
              disabled={isGeneratingSRS || srsGenerated}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Generate SRS document"
              aria-busy={isGeneratingSRS}
            >
              {isGeneratingSRS ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span className="hidden sm:inline">Generating...</span>
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{srsGenerated ? 'SRS Generated' : 'Generate SRS'}</span>
                </>
              )}
            </button>
            {srsGenerated && (
              <>
                <button
                  onClick={() => setShowSRS(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  aria-label="Show SRS document"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Show SRS</span>
                </button>
                <button
                  onClick={() => setShowEditor(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                  aria-label="Edit SRS document"
                >
                  <Edit3 className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Edit SRS</span>
                </button>
              <button
                onClick={downloadSRSDocument}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                aria-label="Download SRS document"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Download SRS</span>
              </button>
              </>
            )}
          </div>
        </div>

        {/* Results Summary */}
        <div className="grid sm:grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200 hover:shadow-lg transition-shadow duration-200">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Status</h3>
            <p className="text-2xl md:text-3xl font-bold text-blue-600">
              {results.status || 'Completed'}
            </p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200 hover:shadow-lg transition-shadow duration-200">
            <h3 className="text-sm font-medium text-green-900 mb-2">Requirements</h3>
            <p className="text-2xl md:text-3xl font-bold text-green-600">{items.length}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200 hover:shadow-lg transition-shadow duration-200">
            <h3 className="text-sm font-medium text-purple-900 mb-2">Timestamp</h3>
            <p className="text-sm font-bold text-purple-600">
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
      </div>

      {/* SRS Display Modal - Enhanced Aesthetics */}
      {showSRS && srsData && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" 
          onClick={() => setShowSRS(false)}
        >
          <div 
            className="bg-gradient-to-br from-white via-slate-50 to-blue-50 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col border border-slate-200/50 animate-scale-in" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Enhanced Header */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 text-white">
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
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gradient-to-b from-white to-slate-50/50">
              {srsData.raw_text ? (
                <div className="prose prose-slate max-w-none">
                  <div className="bg-white rounded-lg shadow-inner border border-slate-200 p-6 md:p-8">
                    <pre className="whitespace-pre-wrap text-sm md:text-base leading-relaxed text-slate-800 font-sans" style={{ 
                      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                      lineHeight: '1.8',
                      letterSpacing: '0.01em'
                    }}>
                      {srsData.raw_text}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="text-amber-800">
                      <p className="font-semibold mb-2">Raw SRS text not available</p>
                      <p className="text-sm mb-4">Displaying parsed sections:</p>
                      <pre className="mt-4 whitespace-pre-wrap font-mono text-xs bg-white p-4 rounded border border-amber-200 overflow-x-auto">
                        {JSON.stringify(srsData.sections, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Enhanced Footer */}
            <div className="bg-gradient-to-r from-slate-50 to-blue-50 p-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-sm text-slate-600">
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
      <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-4">
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
            <div key={key} className={`p-4 rounded-lg border transition-all duration-200 ${colorClasses[color]}`}>
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
              {isExpanded && (
                <div id={`${key}-content`} className="mt-2 text-sm animate-slide-up space-y-2">
                  {key === 'preprocessed' && (
                    <>
                      <p><strong>Sentences:</strong> {data.sentences?.length || 0}</p>
                      <p><strong>Tokens:</strong> {data.tokens?.length || 0}</p>
                      <p><strong>Entities:</strong> {data.entities?.length || 0}</p>
                    </>
                  )}
                  {key === 'ambiguities' && Array.isArray(data) && (
                    <div className="space-y-2">
                      {data.map((ambiguity, idx) => (
                        <div key={idx} className="p-2 bg-white/50 rounded border border-white/50">
                          <p><strong>{ambiguity.word}</strong> - {ambiguity.category}</p>
                          <p className="text-xs mt-1">{ambiguity.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {key === 'extracted' && typeof data === 'object' && (
                    <div className="space-y-2">
                      {Object.entries(data).map(([key, value]) => (
                        <div key={key} className="p-2 bg-white/50 rounded border border-white/50">
                          <p><strong>{key}:</strong> {value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {key === 'srs' && typeof data === 'object' && (
                    <div className="space-y-2">
                      {Object.entries(data).map(([key, value]) => (
                        <div key={key} className="p-2 bg-white/50 rounded border border-white/50">
                          <p><strong>{key}:</strong> {typeof value === 'object' ? (Array.isArray(value) ? value.join(', ') : Object.values(value).join(', ')) : value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

RequirementCard.displayName = 'RequirementCard';

export default ResultsView;
