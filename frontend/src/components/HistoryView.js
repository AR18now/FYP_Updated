import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, FileText, Trash2, Eye, Download, Calendar, User, X, Search, Filter, Mic, Play } from 'lucide-react';
import { getStoredInputs, getStoredSRS, deleteInput, deleteSRS, clearAllStorage, getStorageStats } from '../utils/storage';
import axios from 'axios';
import config from '../config';

const HistoryView = ({ onLoadInput, onLoadSRS, theme = 'dark' }) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState('srs'); // 'inputs' or 'srs'
  const [inputs, setInputs] = useState([]);
  const [srsList, setSrsList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ inputsCount: 0, srsCount: 0, totalSizeMB: '0.00' });

  // Load data from storage
  const loadData = useCallback(() => {
    const storedInputs = getStoredInputs();
    const storedSRS = getStoredSRS();
    setInputs(storedInputs);
    setSrsList(storedSRS);
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

  const handleDownloadSRS = useCallback(async (srs) => {
    try {
      const response = await axios.post(config.API_ENDPOINTS.GENERATE_SRS_PDF, {
        document_id: srs.document_id,
        title: srs.title,
        version: srs.version,
        date: srs.date,
        author: srs.author,
        sections: srs.sections,
        raw_text: srs.raw_text,
      }, {
        responseType: 'blob',
      });

      // Determine file type from content type header
      const contentType = response.headers['content-type'] || '';
      const isPDF = contentType.includes('application/pdf');
      const fileExtension = isPDF ? 'pdf' : 'html';
      const fileName = `srs_${srs.document_id}.${fileExtension}`;

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
      console.error('Error downloading SRS:', error);
      alert('Failed to download SRS document. Please try again.');
    }
  }, []);

  const handleClearAll = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      if (clearAllStorage()) {
        loadData();
      }
    }
  }, [loadData]);

  return (
    <div className="max-w-7xl mx-auto animate-fade-in" role="main" aria-labelledby="history-heading">
      <div className={`rounded-xl card-shadow p-6 md:p-8 border ${isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white/90'}`}>
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 id="history-heading" className="text-2xl md:text-3xl font-bold mb-2 flex items-center space-x-2" style={{ color: 'var(--text)' }}>
              <History className="h-6 w-6" style={{ color: 'var(--muted)' }} aria-hidden="true" />
              <span>History</span>
            </h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              View and manage your previous inputs and generated SRS documents
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm" style={{ color: 'var(--muted)' }}>
              <span className="font-semibold">{stats.inputsCount}</span> inputs • <span className="font-semibold">{stats.srsCount}</span> SRS • {stats.totalSizeMB} MB
            </div>
            {(inputs.length > 0 || srsList.length > 0) && (
              <button
                onClick={handleClearAll}
                className="text-red-500 hover:text-red-600 text-sm px-3 py-1.5 rounded border border-red-300 hover:border-red-400 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b" style={{ borderColor: 'var(--card-border)' }}>
          {[
            { id: 'srs', label: 'SRS Documents', count: srsList.length },
            { id: 'inputs', label: 'Inputs', count: inputs.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium transition-all duration-200 border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
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
            placeholder="Search by title, author, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ 
              background: 'var(--card)', 
              color: 'var(--text)', 
              borderColor: 'var(--card-border)' 
            }}
          />
        </div>

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
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleLoadSRS(srs)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-2 transition-all"
                        title="View SRS"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">View</span>
                      </button>
                      <button
                        onClick={() => handleDownloadSRS(srs)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center space-x-2 transition-all"
                        title="Download SRS"
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Download</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSRS(srs.document_id || srs.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center space-x-2 transition-all"
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
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleLoadInput(input)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-2 transition-all"
                        title="Load Input"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Load</span>
                      </button>
                      <button
                        onClick={() => handleDeleteInput(input.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center space-x-2 transition-all"
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

