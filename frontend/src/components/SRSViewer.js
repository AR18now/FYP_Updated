import React, { useState, useCallback, useMemo } from 'react';
import { Download, FileText, ChevronDown, ChevronRight, CheckCircle, Printer, AlertTriangle, Info } from 'lucide-react';
import axios from 'axios';
import config from '../config';

const SRSViewer = ({ srsData }) => {
  const [expandedSections, setExpandedSections] = useState({});
  const [showValidation, setShowValidation] = useState(false);

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

  if (!srsData) {
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

  return (
    <div className="max-w-6xl mx-auto animate-fade-in" role="main" aria-labelledby="srs-heading">
      <div className="bg-white rounded-xl card-shadow p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 id="srs-heading" className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              {srsData.title}
            </h2>
            <p className="text-gray-600 text-sm">Document ID: {srsData.document_id}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={downloadSRS}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Download SRS as HTML"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Download SRS</span>
            </button>
            <button
              onClick={printSRS}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              aria-label="Print SRS document"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Print</span>
            </button>
          {srsData.hallucination_analysis && (
            <button
              onClick={() => setShowValidation((prev) => !prev)}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              aria-label="Show hallucination checks"
            >
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{showValidation ? 'Hide Checks' : 'Show Checks'}</span>
            </button>
          )}
          </div>
        </div>
        {showValidation && srsData.hallucination_analysis && (
          <div className="mb-6 p-4 rounded-lg border border-amber-300 bg-amber-50">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 space-y-2">
                <h4 className="font-semibold text-amber-900">Hallucination & Confidence Details</h4>
                <div className="text-sm text-amber-800">
                  <div><strong>Confidence:</strong> {(srsData.hallucination_analysis.confidence_score * 100).toFixed(0)}%</div>
                  <div><strong>Term overlap:</strong> {srsData.hallucination_analysis.term_overlap} / {srsData.hallucination_analysis.total_original_terms}</div>
                  {srsData.hallucination_analysis.flagged_sections?.length > 0 ? (
                    <div className="mt-2">
                      <strong>Flagged items:</strong>
                      <ul className="list-disc list-inside space-y-1 mt-1">
                        {srsData.hallucination_analysis.flagged_sections.map((flag, idx) => (
                          <li key={idx}>
                            <span className="font-medium">{flag.type}:</span> {flag.message}
                            {flag.terms && flag.terms.length > 0 && (
                              <span className="ml-1 text-xs text-amber-700">({flag.terms.slice(0,5).join(', ')})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="mt-2 text-green-800">No issues detected.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confidence Score Indicator (if no hallucinations but low confidence) */}
        {srsData.hallucination_analysis && 
         !srsData.hallucination_analysis.has_hallucinations &&
         srsData.hallucination_analysis.confidence_score < 0.7 && (
          <div className="mb-6 p-4 rounded-lg border border-blue-300 bg-blue-50">
            <div className="flex items-center space-x-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm text-blue-800">
                  <strong>Confidence Score:</strong> {(srsData.hallucination_analysis.confidence_score * 100).toFixed(0)}% - 
                  Some sections may need review to ensure they match your requirements.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Document Metadata */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-lg mb-8 border border-gray-200">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Version</h3>
              <p className="text-lg font-semibold text-gray-900">{srsData.version}</p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Date</h3>
              <p className="text-lg font-semibold text-gray-900">{srsData.date}</p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Author</h3>
              <p className="text-lg font-semibold text-gray-900">{srsData.author}</p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Status</h3>
              <p className="text-lg font-semibold text-green-600 flex items-center space-x-1">
                <CheckCircle className="h-4 w-4" aria-hidden="true" />
                <span>Generated</span>
              </p>
            </div>
          </div>
          {/* Confidence Score in Metadata */}
          {srsData.hallucination_analysis && (
            <div className="mt-4 pt-4 border-t border-gray-300">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Content Confidence</span>
                <div className="flex items-center space-x-2">
                  <div className={`h-2 w-24 bg-gray-200 rounded-full overflow-hidden`}>
                    <div 
                      className={`h-full ${
                        srsData.hallucination_analysis.confidence_score >= 0.7 ? 'bg-green-500' :
                        srsData.hallucination_analysis.confidence_score >= 0.5 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${srsData.hallucination_analysis.confidence_score * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {(srsData.hallucination_analysis.confidence_score * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Display Raw Text if Available */}
        {srsData.raw_text ? (
          <div className="mt-8">
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed" style={{ fontFamily: 'Arial, sans-serif' }}>
                {srsData.raw_text}
              </pre>
            </div>
          </div>
        ) : (
          <>
        {/* Expand/Collapse Controls */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={expandAll}
            className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1 rounded border border-blue-200 hover:bg-blue-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Expand all sections"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-sm text-gray-600 hover:text-gray-700 px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            aria-label="Collapse all sections"
          >
            Collapse All
          </button>
        </div>

        {/* SRS Sections */}
        <div className="space-y-4">
          {/* Introduction Section */}
          <div className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200">
            <button
              onClick={() => toggleSection('introduction')}
              className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-expanded={expandedSections.introduction}
              aria-controls="introduction-content"
            >
              <h3 className="text-xl font-semibold text-gray-900">1. Introduction</h3>
              {expandedSections.introduction ? (
                <ChevronDown className="h-5 w-5 text-gray-500 transition-transform duration-200" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-500 transition-transform duration-200" aria-hidden="true" />
              )}
            </button>
            {expandedSections.introduction && (
              <div id="introduction-content" className="px-6 pb-6 space-y-4 animate-slide-up">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">1.1 Purpose</h4>
                  <p className="text-gray-700 leading-relaxed">{srsData.sections.introduction.purpose}</p>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">1.2 Scope</h4>
                  <p className="text-gray-700 leading-relaxed">{srsData.sections.introduction.scope}</p>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">1.3 Definitions</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    {srsData.sections.introduction.definitions.map((def, index) => (
                      <li key={index}>{def}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">1.4 Overview</h4>
                  <p className="text-gray-700 leading-relaxed">{srsData.sections.introduction.overview}</p>
                </div>
              </div>
            )}
          </div>

          {/* Overall Description Section */}
          <div className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200">
            <button
              onClick={() => toggleSection('overall_description')}
              className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-expanded={expandedSections.overall_description}
              aria-controls="overall-description-content"
            >
              <h3 className="text-xl font-semibold text-gray-900">2. Overall Description</h3>
              {expandedSections.overall_description ? (
                <ChevronDown className="h-5 w-5 text-gray-500 transition-transform duration-200" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-500 transition-transform duration-200" aria-hidden="true" />
              )}
            </button>
            {expandedSections.overall_description && (
              <div id="overall-description-content" className="px-6 pb-6 space-y-4 animate-slide-up">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">2.1 Product Functions</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    {srsData.sections.overall_description.product_functions.map((func, index) => (
                      <li key={index}>{func}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">2.2 User Characteristics</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    {srsData.sections.overall_description.user_characteristics.map((user, index) => (
                      <li key={index}>{user}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">2.3 Constraints</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    {srsData.sections.overall_description.constraints.map((constraint, index) => (
                      <li key={index}>{constraint}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">2.4 Assumptions</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    {srsData.sections.overall_description.assumptions.map((assumption, index) => (
                      <li key={index}>{assumption}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">2.5 Dependencies</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
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
            <div className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200">
              <button
                onClick={() => toggleSection('specific_requirements')}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-expanded={expandedSections.specific_requirements}
                aria-controls="specific-requirements-content"
              >
                <h3 className="text-xl font-semibold text-gray-900">3. Specific Requirements</h3>
                {expandedSections.specific_requirements ? (
                  <ChevronDown className="h-5 w-5 text-gray-500 transition-transform duration-200" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-500 transition-transform duration-200" aria-hidden="true" />
                )}
              </button>
              {expandedSections.specific_requirements && (
                <div id="specific-requirements-content" className="px-6 pb-6 space-y-4 animate-slide-up">
                  {srsData.sections.specific_requirements.functional_requirements?.length > 0 && (
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">3.1 Functional Requirements</h4>
                      <ul className="list-disc list-inside text-gray-700 space-y-1">
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
                      <h4 className="text-lg font-medium text-gray-900 mb-2">3.2 Performance Requirements</h4>
                      <div className="space-y-2 text-gray-700">
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
                      <h4 className="text-lg font-medium text-gray-900 mb-2">3.3 Software System Attributes</h4>
                      <div className="space-y-2 text-gray-700">
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
        </>
        )}
      </div>
    </div>
  );
};

export default SRSViewer;
