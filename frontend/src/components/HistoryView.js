import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, FileText, Trash2, Eye, Download, Calendar, User, Search, Mic, Play, LogIn, UserPlus, ClipboardList, GitBranch, Sparkles, Pencil } from 'lucide-react';
import { getStoredInputs, getStoredSRS, deleteInput, deleteSRS, clearAllStorage, getStorageStats, getActivityLog, deleteActivityEntry } from '../utils/storage';
import axios from 'axios';
import config from '../config';
import { saveBlobResponseAsDownload, messageFromAxiosBlobError } from '../utils/downloadHelpers';
import { useTheme } from '../context/ThemeContext';

/**
 * History hub: persisted inputs, saved SRS documents, and the local activity timeline (login / generation events).
 * Polls storage on an interval so new saves from other tabs show up without a manual refresh.
 */
const HistoryView = ({ onLoadInput, onLoadSRS }) => {
  const toSafeFilename = useCallback((value, fallback = 'SRS') => {
    const cleaned = String(value || fallback)
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '_');
    return cleaned || fallback;
  }, []);

  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState('activity'); // 'activity' | 'srs' | 'inputs'
  const [inputs, setInputs] = useState([]);
  const [srsList, setSrsList] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ inputsCount: 0, srsCount: 0, totalSizeMB: '0.00' });

  // Load data from storage
  const loadData = useCallback(() => {
    const storedInputs = getStoredInputs();
    const storedSRS = getStoredSRS();
    setInputs(storedInputs);
    setSrsList(storedSRS);
    setActivityLog(getActivityLog());
    setStats(getStorageStats());
  }, []);

  useEffect(() => {
    loadData();
    // Refresh data every 2 seconds to catch new items
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Filter data based on search
  const filteredInputs = useMemo(() => {
    if (!searchQuery.trim()) return inputs;
    const query = searchQuery.toLowerCase();
    return inputs.filter(input => 
      (input.projectInfo?.title || '').toLowerCase().includes(query) ||
      (input.projectInfo?.author || '').toLowerCase().includes(query) ||
      (input.content || '').toLowerCase().includes(query) ||
      (input.transcription || '').toLowerCase().includes(query) ||
      (input.liveTranscription || '').toLowerCase().includes(query) ||
      (input.fileNames || []).some(name => name.toLowerCase().includes(query))
    );
  }, [inputs, searchQuery]);

  const filteredSRS = useMemo(() => {
    if (!searchQuery.trim()) return srsList;
    const query = searchQuery.toLowerCase();
    return srsList.filter(srs => 
      (srs.title || '').toLowerCase().includes(query) ||
      (srs.author || '').toLowerCase().includes(query) ||
      (srs.document_id || '').toLowerCase().includes(query) ||
      (srs.preview || '').toLowerCase().includes(query)
    );
  }, [srsList, searchQuery]);

  const filteredActivity = useMemo(() => {
    if (!searchQuery.trim()) return activityLog;
    const query = searchQuery.toLowerCase();
    return activityLog.filter(
      (a) =>
        (a.title || '').toLowerCase().includes(query) ||
        (a.detail || '').toLowerCase().includes(query) ||
        (a.type || '').toLowerCase().includes(query)
    );
  }, [activityLog, searchQuery]);

  const activityIcon = useCallback((type) => {
    switch (type) {
      case 'login':
        return LogIn;
      case 'signup':
        return UserPlus;
      case 'srs_generated':
        return Sparkles;
      case 'srs_updated':
        return Pencil;
      case 'textual_usecases':
        return ClipboardList;
      case 'usecase_diagram':
        return GitBranch;
      default:
        return History;
    }
  }, []);

  const handleDeleteActivity = useCallback(
    (id) => {
      if (window.confirm('Remove this activity entry?')) {
        if (deleteActivityEntry(id)) loadData();
      }
    },
    [loadData]
  );

  const handleDeleteInput = useCallback((inputId) => {
    if (window.confirm('Are you sure you want to delete this input?')) {
      if (deleteInput(inputId)) {
        loadData();
      }
    }
  }, [loadData]);

  const handleDeleteSRS = useCallback((documentId) => {
    if (window.confirm('Are you sure you want to delete this SRS document?')) {
      if (deleteSRS(documentId)) {
        loadData();
      }
    }
  }, [loadData]);

  const handleLoadInput = useCallback((input) => {
    if (onLoadInput) {
      // Pass the input data to be loaded
      const inputData = {
        ...input,
        // If input has results, use those; otherwise reconstruct from content
        results: input.results || {
          status: 'completed',
          timestamp: input.timestamp,
          project_info: input.projectInfo,
          results: input.content ? [{ original_text: input.content }] : []
        }
      };
      onLoadInput(inputData);
      navigate('/results');
    }
  }, [onLoadInput, navigate]);

  const handleLoadSRS = useCallback((srs) => {
    if (onLoadSRS) {
      onLoadSRS(srs);
      navigate('/srs');
    }
  }, [onLoadSRS, navigate]);

  const handleDownloadSRS = useCallback(async (srs, format = 'pdf') => {
    try {
      const endpoint =
        format === 'docx'
          ? config.API_ENDPOINTS.GENERATE_SRS_DOCX
          : config.API_ENDPOINTS.GENERATE_SRS_PDF;
      const response = await axios.post(
        endpoint,
        {
          document_id: srs.document_id,
          title: srs.title,
          version: srs.version,
          date: srs.date,
          author: srs.author,
          sections: srs.sections,
          raw_text: srs.raw_text,
        },
        { responseType: 'blob' }
      );
      await saveBlobResponseAsDownload(response, {
        defaultFilename: toSafeFilename(srs.title || srs.document_id || 'SRS'),
      });
    } catch (error) {
      console.error(`Error downloading SRS (${format}):`, error);
      const msg = await messageFromAxiosBlobError(error);
      alert(msg);
    }
  }, [toSafeFilename]);

  const handleClearAll = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      if (clearAllStorage()) {
        loadData();
      }
    }
  }, [loadData]);

  return (
    <div className="max-w-7xl mx-auto animate-fade-in" role="main" aria-labelledby="history-heading">
      <div className={`rounded-xl card-shadow p-4 sm:p-6 md:p-8 border ${isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white/90'}`}>
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 id="history-heading" className="text-2xl md:text-3xl font-bold mb-2 flex items-center space-x-2" style={{ color: 'var(--text)' }}>
              <History className="h-6 w-6" style={{ color: 'var(--muted)' }} aria-hidden="true" />
              <span>History</span>
            </h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Saved inputs, generated SRS, and a persistent timeline of sign-ins and generation steps on this device.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="text-sm w-full sm:w-auto" style={{ color: 'var(--muted)' }}>
              <span className="font-semibold">{stats.activityCount ?? activityLog.length}</span> activity ·{' '}
              <span className="font-semibold">{stats.inputsCount}</span> inputs ·{' '}
              <span className="font-semibold">{stats.srsCount}</span> SRS · {stats.totalSizeMB} MB
            </div>
            {(inputs.length > 0 || srsList.length > 0 || activityLog.length > 0) && (
              <button
                onClick={handleClearAll}
                className="text-red-500 hover:text-red-600 text-sm px-3 py-1.5 rounded border border-red-300 hover:border-red-400 transition-colors w-full sm:w-auto"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b" style={{ borderColor: 'var(--card-border)' }}>
          {[
            { id: 'activity', label: 'Activity', count: activityLog.length },
            { id: 'srs', label: 'SRS Documents', count: srsList.length },
            { id: 'inputs', label: 'Inputs', count: inputs.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 sm:px-4 py-2 font-medium transition-all duration-200 border-b-2 text-sm sm:text-base ${
                activeTab === tab.id
                  ? 'border-r2d-accent text-r2d-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search history, titles, authors, or activity…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-r2d-accent focus:border-transparent"
            style={{ 
              background: 'var(--card)', 
              color: 'var(--text)', 
              borderColor: 'var(--card-border)' 
            }}
          />
        </div>

        {/* Activity timeline (persisted locally) */}
        {activeTab === 'activity' && (
          <div className="space-y-3">
            {filteredActivity.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
                <History className="h-16 w-16 mx-auto mb-4 opacity-50" aria-hidden="true" />
                <p className="text-lg font-medium mb-2">No activity yet</p>
                <p className="text-sm max-w-lg mx-auto leading-relaxed">
                  Sign in, sign up, generate an SRS, or run textual use cases and diagrams—each step is recorded here and
                  stays after you close the browser.
                </p>
              </div>
            ) : (
              filteredActivity.map((a) => {
                const Icon = activityIcon(a.type);
                return (
                  <div
                    key={a.id}
                    className="border rounded-lg p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:shadow-md transition-all duration-200"
                    style={{
                      background: 'var(--card)',
                      borderColor: 'var(--card-border)',
                    }}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-r2d-primary/12 text-r2d-primary border border-r2d-border/80 dark:border-slate-600">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          {a.title}
                        </p>
                        {a.detail ? (
                          <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--muted)' }}>
                            {a.detail}
                          </p>
                        ) : null}
                        <p className="text-[11px] mt-2 uppercase tracking-wide font-semibold" style={{ color: 'var(--muted)' }}>
                          {String(a.type || '').replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-start">
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                        {new Date(a.ts).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteActivity(a.id)}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-900"
                        title="Remove this entry"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* SRS Documents Tab */}
        {activeTab === 'srs' && (
          <div className="space-y-4">
            {filteredSRS.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" aria-hidden="true" />
                <p className="text-lg font-medium mb-2">No SRS Documents</p>
                <p className="text-sm">Generated SRS documents will appear here</p>
              </div>
            ) : (
              filteredSRS.map((srs) => (
                <div
                  key={srs.id || srs.document_id}
                  className="border rounded-lg p-5 hover:shadow-md transition-all duration-200"
                  style={{ 
                    background: 'var(--card)', 
                    borderColor: 'var(--card-border)' 
                  }}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
                        {srs.title || 'SRS Document'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: 'var(--muted)' }}>
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" aria-hidden="true" />
                          <span>{new Date(srs.timestamp || srs.date).toLocaleString()}</span>
                        </span>
                        {srs.author && (
                          <span className="flex items-center space-x-1">
                            <User className="h-4 w-4" aria-hidden="true" />
                            <span>{srs.author}</span>
                          </span>
                        )}
                        <span className="font-mono text-xs">{srs.document_id}</span>
                      </div>
                      {srs.preview && (
                        <p className="mt-3 text-sm line-clamp-2" style={{ color: 'var(--muted)' }}>
                          {srs.preview}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                      <button
                        onClick={() => handleLoadSRS(srs)}
                        className="px-4 py-2 bg-r2d-primary hover:bg-r2d-primaryLight text-white rounded-lg flex items-center justify-center space-x-2 transition-all w-full sm:w-auto"
                        title="View SRS"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">View</span>
                      </button>
                      <button
                        onClick={() => handleDownloadSRS(srs, 'pdf')}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center space-x-2 transition-all w-full sm:w-auto"
                        title="Download SRS PDF"
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">PDF</span>
                      </button>
                      <button
                        onClick={() => handleDownloadSRS(srs, 'docx')}
                        className="px-4 py-2 bg-r2d-primary hover:bg-r2d-primaryLight text-white rounded-lg flex items-center justify-center space-x-2 transition-all w-full sm:w-auto"
                        title="Download SRS Word"
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">.docx</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSRS(srs.document_id || srs.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center space-x-2 transition-all w-full sm:w-auto"
                        title="Delete SRS"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Inputs Tab */}
        {activeTab === 'inputs' && (
          <div className="space-y-4">
            {filteredInputs.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" aria-hidden="true" />
                <p className="text-lg font-medium mb-2">No Inputs</p>
                <p className="text-sm">Processed requirements will appear here</p>
              </div>
            ) : (
              filteredInputs.map((input) => (
                <div
                  key={input.id}
                  className="border rounded-lg p-5 hover:shadow-md transition-all duration-200"
                  style={{ 
                    background: 'var(--card)', 
                    borderColor: 'var(--card-border)' 
                  }}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
                        {input.projectInfo?.title || 'Untitled Project'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: 'var(--muted)' }}>
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" aria-hidden="true" />
                          <span>{new Date(input.timestamp).toLocaleString()}</span>
                        </span>
                        {input.projectInfo?.author && (
                          <span className="flex items-center space-x-1">
                            <User className="h-4 w-4" aria-hidden="true" />
                            <span>{input.projectInfo.author}</span>
                          </span>
                        )}
                        <span className="capitalize">{input.inputType}</span>
                        {input.fileNames && input.fileNames.length > 0 && (
                          <span className="text-xs">({input.fileNames.length} file{input.fileNames.length > 1 ? 's' : ''})</span>
                        )}
                      </div>
                      {/* Show transcription for audio inputs */}
                      {input.inputType === 'audio' && (input.transcription || input.liveTranscription) && (
                        <div className="mt-3 p-3 rounded-lg border" style={{ 
                          background: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                          borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'
                        }}>
                          <div className="flex items-center space-x-2 mb-2">
                            <Mic className="h-4 w-4" style={{ color: 'var(--muted)' }} aria-hidden="true" />
                            <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Transcription:</span>
                          </div>
                          <p className="text-sm line-clamp-3" style={{ color: 'var(--text)' }}>
                            {input.transcription || input.liveTranscription || ''}
                          </p>
                        </div>
                      )}
                      
                      {/* Show content preview for text/file inputs */}
                      {input.inputType !== 'audio' && input.content && (
                        <p className="mt-3 text-sm line-clamp-2" style={{ color: 'var(--muted)' }}>
                          {input.content.substring(0, 200)}{input.content.length > 200 ? '...' : ''}
                        </p>
                      )}
                      
                      {/* Audio Player for audio inputs */}
                      {input.inputType === 'audio' && input.audioData && (
                        <div className="mt-3 p-3 rounded-lg border" style={{ 
                          background: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)',
                          borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)'
                        }}>
                          <div className="flex items-center space-x-2 mb-2">
                            <Play className="h-4 w-4" style={{ color: 'var(--muted)' }} aria-hidden="true" />
                            <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Audio Recording:</span>
                          </div>
                          <audio 
                            controls 
                            className="w-full mt-2"
                            style={{ maxHeight: '40px' }}
                            aria-label="Audio playback"
                          >
                            <source src={input.audioData} type={input.audioMimeType || 'audio/webm'} />
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap w-full md:w-auto">
                      <button
                        onClick={() => handleLoadInput(input)}
                        className="px-4 py-2 bg-r2d-primary hover:bg-r2d-primaryLight text-white rounded-lg flex items-center justify-center space-x-2 transition-all w-full sm:w-auto"
                        title="Load Input"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Load</span>
                      </button>
                      <button
                        onClick={() => handleDeleteInput(input.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center space-x-2 transition-all w-full sm:w-auto"
                        title="Delete Input"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;

