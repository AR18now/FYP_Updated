import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Edit3, Bold, Highlighter, Save, X, Undo, Redo } from 'lucide-react';

/**
 * Lightweight `contentEditable` SRS editor used from `ResultsView` modal — persists edited HTML back
 * into `raw_text` via `onSave` (caller re-serializes / saves to storage).
 */

const toInitialHtml = (rawText = '') =>
  String(rawText)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

const SRSEditor = ({ srsData, onSave, onClose, theme = 'dark' }) => {
  const isDark = theme === 'dark';
  const editorRef = useRef(null);
  const [content, setContent] = useState(toInitialHtml(srsData?.raw_text || ''));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContent(toInitialHtml(srsData?.raw_text || ''));
  }, [srsData]);

  const syncContentFromEditor = useCallback(() => {
    const newContent = editorRef.current?.innerHTML || '';
    setContent(newContent);
  }, []);

  const executeCommand = useCallback((command, value = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncContentFromEditor();
  }, [syncContentFromEditor]);

  const handleUndo = useCallback(() => {
    editorRef.current?.focus();
    document.execCommand('undo', false, null);
    syncContentFromEditor();
  }, [syncContentFromEditor]);

  const handleRedo = useCallback(() => {
    editorRef.current?.focus();
    document.execCommand('redo', false, null);
    syncContentFromEditor();
  }, [syncContentFromEditor]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const editedContent = editorRef.current?.innerText || content;
      const editedHtml = editorRef.current?.innerHTML || content;
      
      if (onSave) {
        await onSave({
          ...srsData,
          raw_text: editedContent,
          edited_html: editedHtml
        });
      }
    } catch (error) {
      console.error('Error saving edited SRS:', error);
    } finally {
      setIsSaving(false);
    }
  }, [srsData, content, onSave]);

  const handleContentChange = useCallback(() => {
    syncContentFromEditor();
  }, [syncContentFromEditor]);

  const enforceLtrEditing = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    el.setAttribute('dir', 'ltr');
    el.style.direction = 'ltr';
    el.style.textAlign = 'left';
    el.style.unicodeBidi = 'plaintext';
  }, []);

  useEffect(() => {
    enforceLtrEditing();
  }, [enforceLtrEditing, content]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className={`rounded-2xl shadow-2xl w-full max-w-[min(96vw,72rem)] max-h-[96dvh] overflow-hidden flex flex-col border ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-r2d-primary via-r2d-primaryLight to-r2d-accent p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <Edit3 className="h-6 w-6" aria-hidden="true" />
              <h3 className="text-lg sm:text-2xl font-bold truncate">Edit SRS Document</h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Close editor"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className={`border-b p-3 sm:p-4 flex items-center gap-2 flex-wrap ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
          <button
            onClick={handleUndo}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-gray-200 text-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Undo"
            aria-label="Undo"
          >
            <Undo className="h-4 w-4" />
          </button>
          <button
            onClick={handleRedo}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-gray-200 text-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Redo"
            aria-label="Redo"
          >
            <Redo className="h-4 w-4" />
          </button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <button
            onClick={() => executeCommand('bold')}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-gray-200 text-gray-700'}`}
            title="Bold"
            aria-label="Make text bold"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            onClick={() => executeCommand('italic')}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-gray-200 text-gray-700'}`}
            title="Italic"
            aria-label="Make text italic"
          >
            <span className="text-sm font-italic">I</span>
          </button>
          <button
            onClick={() => executeCommand('underline')}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-gray-200 text-gray-700'}`}
            title="Underline"
            aria-label="Underline text"
          >
            <span className="text-sm underline">U</span>
          </button>
          <button
            onClick={() => {
              const color = isDark ? '#fbbf24' : '#fef08a';
              executeCommand('backColor', color);
            }}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-gray-200 text-gray-700'}`}
            title="Highlight"
            aria-label="Highlight text"
          >
            <Highlighter className="h-4 w-4" />
          </button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <button
            onClick={() => {
              const color = prompt('Enter color (e.g., #ff0000 or red):', '#000000');
              if (color) executeCommand('foreColor', color);
            }}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-gray-200 text-gray-700'}`}
            title="Text Color"
          >
            A
          </button>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div
            ref={editorRef}
            contentEditable
            onInput={handleContentChange}
            onFocus={enforceLtrEditing}
            className={`min-h-[55vh] sm:min-h-[400px] p-3 sm:p-4 rounded-lg border focus:outline-none focus:ring-2 focus:ring-r2d-accent ${
              isDark 
                ? 'bg-slate-900 border-slate-700 text-slate-100' 
                : 'bg-white border-gray-200 text-slate-900'
            }`}
            dir="ltr"
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              lineHeight: '1.8',
              fontSize: '14px',
              direction: 'ltr',
              textAlign: 'left',
              unicodeBidi: 'plaintext',
            }}
            suppressContentEditableWarning={true}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>

        {/* Footer */}
        <div className={`border-t p-3 sm:p-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-r2d-primary to-r2d-accent hover:from-r2d-primaryLight hover:to-r2d-accent text-white rounded-lg flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SRSEditor;

