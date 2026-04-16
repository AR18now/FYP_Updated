import React, { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { Download, RefreshCw, FileText } from 'lucide-react';
import config from '../config';
import { formatTextualUseCasesToHtml } from '../utils/documentFormatter';
import { saveBlobResponseAsDownload, messageFromAxiosBlobError } from '../utils/downloadHelpers';
import { getApiErrorMessage } from '../utils/apiErrors';

const TextualUseCasesPage = ({ srsData, useCaseData, onUseCaseDataChange }) => {
  const [isLoading, setIsLoading] = useState(false);

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
      console.error('Failed to generate use cases', error);
      alert(getApiErrorMessage(error, 'Failed to generate textual use cases.'));
    } finally {
      setIsLoading(false);
    }
  }, [srsData, onUseCaseDataChange]);

  const textualHtml = useMemo(() => {
    return formatTextualUseCasesToHtml(useCaseData?.textual_usecases?.text || '');
  }, [useCaseData]);

  const downloadPdf = useCallback(async () => {
    const rawTitle = String(srsData?.title || '').trim();
    const safeTitle = (rawTitle || 'Project')
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '_')
      .replace(/[._\s]+$/g, '') || 'Project';
    try {
      const resp = await axios.post(
        config.API_ENDPOINTS.DOWNLOAD_TEXTUAL_USECASES_PDF,
        {
          text: useCaseData?.textual_usecases?.text || '',
          title: rawTitle || 'Project',
        },
        { responseType: 'blob' }
      );
      await saveBlobResponseAsDownload(resp, {
        defaultFilename: `TextualUseCase_${safeTitle}.pdf`,
      });
    } catch (error) {
      console.error('Failed to download textual use cases PDF', error);
      const msg = await messageFromAxiosBlobError(error);
      alert(msg);
    }
  }, [srsData, useCaseData]);

  if (!srsData) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-slate-600 dark:text-slate-400">
        Generate SRS first to view textual use cases.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 sm:p-5 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-slate-100">
            <FileText className="h-6 w-6" />
            Textual Use Cases
          </h2>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={generateUseCases}
              disabled={isLoading}
              className="bg-r2d-primary hover:bg-r2d-primaryLight disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isLoading ? 'Generating...' : 'Generate / Refresh'}
            </button>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={!useCaseData?.textual_usecases?.text}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-600 rounded-lg p-3 sm:p-4 md:p-6 bg-slate-50 dark:bg-slate-950/50 min-h-[50vh] sm:min-h-[62vh] lg:min-h-[70vh] overflow-auto">
          <div dangerouslySetInnerHTML={{ __html: textualHtml }} />
        </div>
      </div>
    </div>
  );
};

export default TextualUseCasesPage;

