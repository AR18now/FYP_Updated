import React, { useCallback, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Download, RefreshCw, FileText, FileDown } from 'lucide-react';
import config from '../config';
import { formatTextualUseCasesToHtml } from '../utils/documentFormatter';
import { saveBlobResponseAsDownload, messageFromAxiosBlobError } from '../utils/downloadHelpers';
import { getApiErrorMessage } from '../utils/apiErrors';
import { buildGenerateUseCasesRequestBody, hasModelTextualUseCases } from '../utils/useCaseRequest';

const TextualUseCasesPage = ({ srsData, useCaseData, onUseCaseDataChange }) => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const generateUseCases = useCallback(async () => {
    if (!srsData?.sections) return;
    setIsLoading(true);
    try {
      const response = await axios.post(
        config.API_ENDPOINTS.GENERATE_USECASES,
        buildGenerateUseCasesRequestBody(srsData)
      );
      if (onUseCaseDataChange) {
        flushSync(() => {
          onUseCaseDataChange(response.data);
        });
      }
      navigate('/usecase-diagram');
    } catch (error) {
      console.error('Failed to generate use cases', error);
      alert(getApiErrorMessage(error, 'Failed to generate textual use cases.'));
    } finally {
      setIsLoading(false);
    }
  }, [srsData, onUseCaseDataChange, navigate]);

  const modelUcText = useMemo(() => {
    const fromSaved = String(useCaseData?.textual_usecases?.text || '');
    const fromSrs = String(srsData?.textual_usecases?.text || '');
    if (fromSrs.length > fromSaved.length) return fromSrs;
    return fromSaved || fromSrs;
  }, [useCaseData, srsData]);

  const textualHtml = useMemo(() => {
    return formatTextualUseCasesToHtml(modelUcText);
  }, [modelUcText]);

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
          text: modelUcText,
          title: rawTitle || 'Project',
          html_body: textualHtml,
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
  }, [srsData, modelUcText, textualHtml]);

  const downloadPlainText = useCallback(() => {
    const rawTitle = String(srsData?.title || '').trim();
    const safeTitle = (rawTitle || 'Project')
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '_')
      .replace(/[._\s]+$/g, '') || 'Project';
    const blob = new Blob([modelUcText], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `textual_usecases_${safeTitle}.txt`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, [srsData, modelUcText]);

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
              disabled={isLoading || !hasModelTextualUseCases(srsData)}
              title={
                hasModelTextualUseCases(srsData)
                  ? 'Build PlantUML diagram from SRS use case appendix'
                  : 'Regenerate SRS to obtain the model textual use case appendix first'
              }
              className="bg-r2d-primary hover:bg-r2d-primaryLight disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isLoading ? 'Generating...' : 'Generate diagram'}
            </button>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={!modelUcText.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
            <button
              type="button"
              onClick={downloadPlainText}
              disabled={!modelUcText.trim()}
              className="bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <FileDown className="h-4 w-4" />
              Download .txt (full)
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-slate-600/80 bg-slate-100/90 dark:bg-slate-950/60 min-h-[50vh] sm:min-h-[62vh] lg:min-h-[70vh] overflow-auto p-4 sm:p-5 md:p-6">
          {!hasModelTextualUseCases(srsData) && (
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 max-w-[92ch] mx-auto">
              Regenerate the SRS so the model outputs the textual use case appendix (delimiters in the SRS prompt). This page no longer builds use cases from SRS sections on the server.
            </p>
          )}
          <div dangerouslySetInnerHTML={{ __html: textualHtml }} />
        </div>
      </div>
    </div>
  );
};

export default TextualUseCasesPage;

