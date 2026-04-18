import React, { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { Download, RefreshCw, Workflow, Maximize2, ArrowDown, ArrowRight, FileCode } from 'lucide-react';
import config from '../config';
import { saveBlobResponseAsDownload, messageFromAxiosBlobError } from '../utils/downloadHelpers';
import { getApiErrorMessage } from '../utils/apiErrors';
import { buildGenerateUseCasesRequestBody, hasModelTextualUseCases } from '../utils/useCaseRequest';

const UseCaseDiagramPage = ({ srsData, useCaseData, onUseCaseDataChange }) => {
  const [isLoading, setIsLoading] = useState(false);
  /** false = prioritize vertical/tall diagram in viewport; true = fit width (horizontal emphasis) */
  const [fitWidth, setFitWidth] = useState(false);
  /** PlantUML layout: which rendered PNG / .puml variant to show */
  const [diagramLayout, setDiagramLayout] = useState('vertical');

  const activeDiagramB64 = useMemo(() => {
    const d = useCaseData?.diagram;
    if (!d) return '';
    if (diagramLayout === 'horizontal') {
      return d.diagram_base64_horizontal || d.diagram_base64 || '';
    }
    return d.diagram_base64_vertical || d.diagram_base64 || '';
  }, [useCaseData?.diagram, diagramLayout]);

  const activePlantUml = useMemo(() => {
    const d = useCaseData?.diagram;
    if (!d) return '';
    if (diagramLayout === 'horizontal') {
      return d.plantuml_code_horizontal || d.plantuml_code || '';
    }
    return d.plantuml_code_vertical || d.plantuml_code || '';
  }, [useCaseData?.diagram, diagramLayout]);

  const diagramIssueMessage = useMemo(() => {
    const d = useCaseData?.diagram || {};
    const msg = String(d.message || '').trim();
    const status = String(d.status || '').toLowerCase();
    if (!msg && status !== 'saved_only') return '';
    const issueLike = /(error|fail|failed|unavailable|not render|cannot|unable|exception|timeout|missing)/i;
    if (status === 'saved_only' || issueLike.test(msg)) return msg || 'Diagram PNG was not rendered.';
    return '';
  }, [useCaseData?.diagram]);

  const downloadPuml = useCallback(() => {
    if (!activePlantUml) return;
    const blob = new Blob([activePlantUml], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `usecase_${srsData?.document_id || 'srs'}_${diagramLayout}.puml`;
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, [activePlantUml, diagramLayout, srsData?.document_id]);

  const generateUseCases = useCallback(async () => {
    if (!srsData?.sections) return;
    setIsLoading(true);
    try {
      const response = await axios.post(
        config.API_ENDPOINTS.GENERATE_USECASES,
        buildGenerateUseCasesRequestBody(srsData)
      );
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
          diagram_base64: activeDiagramB64,
          title: `${srsData?.title || 'SRS'} - Use Case Diagram (${diagramLayout})`,
        },
        { responseType: 'blob' }
      );
      await saveBlobResponseAsDownload(resp, {
        defaultFilename: `usecase_diagram_${srsData?.document_id || 'srs'}_${diagramLayout}.pdf`,
      });
    } catch (error) {
      console.error('Failed to download diagram PDF', error);
      const msg = await messageFromAxiosBlobError(error);
      alert(msg);
    }
  }, [srsData, activeDiagramB64, diagramLayout]);

  if (!srsData) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-slate-600 dark:text-slate-400">
        Generate SRS first to view the use case diagram.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in overflow-x-hidden px-1 sm:px-0">
      <div className="bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 sm:p-5 md:p-8 overflow-x-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-slate-100">
              <Workflow className="h-6 w-6" />
              Use Case Diagram
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              <strong>UML 2.x</strong> diagram from your model appendix. The server saves <strong>.puml</strong> and tries local{' '}
              <strong>PlantUML</strong>; if the CLI is missing it falls back to an HTTPS renderer (e.g. Kroki) for PNG.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <button
              onClick={generateUseCases}
              disabled={isLoading || !hasModelTextualUseCases(srsData)}
              title={
                hasModelTextualUseCases(srsData)
                  ? 'Render diagram from model appendix text'
                  : 'Regenerate SRS so the model includes the textual use case appendix'
              }
              className="bg-r2d-primary hover:bg-r2d-primaryLight disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isLoading ? 'Generating...' : 'Generate diagram'}
            </button>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={!activeDiagramB64}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
            <button
              type="button"
              onClick={downloadPuml}
              disabled={!activePlantUml}
              className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50 w-full sm:w-auto"
              title="PlantUML source for the selected layout"
            >
              <FileCode className="h-4 w-4" />
              .puml
            </button>
            <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setDiagramLayout('vertical')}
                disabled={!useCaseData?.diagram?.diagram_base64_vertical && !useCaseData?.diagram?.diagram_base64}
                className={`px-3 py-2 text-sm flex items-center gap-1.5 disabled:opacity-50 ${
                  diagramLayout === 'vertical'
                    ? 'bg-r2d-primary text-white dark:bg-r2d-accent'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                }`}
                title="Top-to-bottom layout (PlantUML)"
              >
                <ArrowDown className="h-4 w-4" />
                Vertical
              </button>
              <button
                type="button"
                onClick={() => setDiagramLayout('horizontal')}
                disabled={!useCaseData?.diagram?.diagram_base64_horizontal && !useCaseData?.diagram?.diagram_base64}
                className={`px-3 py-2 text-sm flex items-center gap-1.5 border-l border-slate-300 dark:border-slate-600 disabled:opacity-50 ${
                  diagramLayout === 'horizontal'
                    ? 'bg-r2d-primary text-white dark:bg-r2d-accent'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                }`}
                title="Left-to-right layout (PlantUML)"
              >
                <ArrowRight className="h-4 w-4" />
                Horizontal
              </button>
            </div>
            <button
              type="button"
              onClick={() => setFitWidth((w) => !w)}
              disabled={!activeDiagramB64}
              className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50 w-full sm:w-auto"
              title="Toggle fit width vs tall (vertical) view"
            >
              <Maximize2 className="h-4 w-4" />
              {fitWidth ? 'Tall view' : 'Fit width'}
            </button>
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-600 rounded-lg p-3 sm:p-4 bg-slate-50 dark:bg-slate-950/50 min-h-[50vh] sm:min-h-[60vh] lg:min-h-[72vh] flex items-center justify-center overflow-auto">
          {activeDiagramB64 ? (
            <img
              src={`data:image/png;base64,${activeDiagramB64}`}
              alt={`Use case diagram (${diagramLayout})`}
              className={
                fitWidth
                  ? 'max-w-full max-h-[68vh] w-full object-contain'
                  : 'w-auto max-w-full max-h-[85vh] h-auto object-contain mx-auto'
              }
            />
          ) : (
            <div className="w-full max-w-3xl space-y-2 text-left">
              <p className="text-gray-600 dark:text-slate-400">
                No diagram generated yet. Click &quot;Generate / Refresh&quot;.
              </p>
              {diagramIssueMessage ? (
                <p className="text-sm text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-lg p-3 bg-amber-50/90 dark:bg-amber-950/40">
                  {diagramIssueMessage}
                </p>
              ) : null}
              {useCaseData?.diagram?.plantuml_log ? (
                <pre className="text-xs whitespace-pre-wrap font-mono p-3 rounded border border-slate-600 bg-slate-950 text-green-400 max-h-72 overflow-auto w-full">
                  {useCaseData.diagram.plantuml_log}
                </pre>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UseCaseDiagramPage;

