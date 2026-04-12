import React, { useCallback, useState } from 'react';
import axios from 'axios';
import { Download, RefreshCw, Workflow, Maximize2 } from 'lucide-react';
import config from '../config';
import { saveBlobResponseAsDownload, messageFromAxiosBlobError } from '../utils/downloadHelpers';
import { getApiErrorMessage } from '../utils/apiErrors';

const UseCaseDiagramPage = ({ srsData, useCaseData, onUseCaseDataChange }) => {
  const [isLoading, setIsLoading] = useState(false);
  /** false = prioritize vertical/tall diagram in viewport; true = fit width (horizontal emphasis) */
  const [fitWidth, setFitWidth] = useState(false);

  const generateUseCases = useCallback(async () => {
    if (!srsData?.sections) return;
    setIsLoading(true);
    try {
      const response = await axios.post(config.API_ENDPOINTS.GENERATE_USECASES, {
        document_id: srsData.document_id,
        title: srsData.title,
        sections: srsData.sections
      });
      if (onUseCaseDataChange) onUseCaseDataChange(response.data);
    } catch (error) {
      console.error('Failed to generate use case diagram', error);
      alert(getApiErrorMessage(error, 'Failed to generate use case diagram.'));
    } finally {
      setIsLoading(false);
    }
  }, [srsData, onUseCaseDataChange]);

  const downloadPdf = useCallback(async () => {
    try {
      const resp = await axios.post(
        config.API_ENDPOINTS.DOWNLOAD_USECASE_DIAGRAM_PDF,
        {
          diagram_base64: useCaseData?.diagram?.diagram_base64 || '',
          title: `${srsData?.title || 'SRS'} - Use Case Diagram`,
        },
        { responseType: 'blob' }
      );
      await saveBlobResponseAsDownload(resp, {
        defaultFilename: `usecase_diagram_${srsData?.document_id || 'srs'}.pdf`,
      });
    } catch (error) {
      console.error('Failed to download diagram PDF', error);
      const msg = await messageFromAxiosBlobError(error);
      alert(msg);
    }
  }, [srsData, useCaseData]);

  if (!srsData) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-slate-600 dark:text-slate-400">
        Generate SRS first to view the use case diagram.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-slate-100">
              <Workflow className="h-6 w-6" />
              Use Case Diagram
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              <strong>UML 2.x</strong> use case view: subject boundary, actors, use cases, and associations. Rendered with{' '}
              <strong>PlantUML</strong> from your Cockburn textual use cases.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generateUseCases}
              disabled={isLoading}
              className="bg-r2d-primary hover:bg-r2d-primaryLight disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isLoading ? 'Generating...' : 'Generate / Refresh'}
            </button>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={!useCaseData?.diagram?.diagram_base64}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
            <button
              type="button"
              onClick={() => setFitWidth((w) => !w)}
              disabled={!useCaseData?.diagram?.diagram_base64}
              className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 rounded-lg flex items-center gap-2 text-sm disabled:opacity-50"
              title="Toggle fit width vs tall (vertical) view"
            >
              <Maximize2 className="h-4 w-4" />
              {fitWidth ? 'Tall view' : 'Fit width'}
            </button>
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-600 rounded-lg p-4 bg-slate-50 dark:bg-slate-950/50 min-h-[72vh] flex items-center justify-center overflow-auto">
          {useCaseData?.diagram?.diagram_base64 ? (
            <img
              src={`data:image/png;base64,${useCaseData.diagram.diagram_base64}`}
              alt="Use case diagram"
              className={
                fitWidth
                  ? 'max-w-full max-h-[68vh] w-full object-contain'
                  : 'w-auto max-w-full max-h-[85vh] h-auto object-contain mx-auto'
              }
            />
          ) : (
            <p className="text-gray-600 dark:text-slate-400">No diagram generated yet. Click &quot;Generate / Refresh&quot;.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default UseCaseDiagramPage;

