import React from 'react';
import { BookOpen, Database, FileText, Layers, Search } from 'lucide-react';

const KnowledgeBasePage = () => {
  return (
    <div className="max-w-4xl space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Knowledge base</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
          Req2Design augments generation with retrieval from an IEEE-oriented knowledge base: templates,
          sample SRS excerpts, and requirement-engineering guidance. Embeddings power semantic retrieval before
          the fine-tuned model drafts the final SRS.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-6 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-4">
            <Database className="h-5 w-5" />
          </div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Storage</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Source documents are prepared under <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">data/knowledge_base/</code> and
            similar project paths. PDF/DOCX content is normalized to text for chunking.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-6 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-4">
            <Search className="h-5 w-5" />
          </div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Retrieval</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Embeddings (e.g. sentence-transformers) populate a vector index; at generation time, top-k chunks are
            injected as context for structure and terminology alignment.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-6 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-slate-800 text-white flex items-center justify-center mb-4">
            <Layers className="h-5 w-5" />
          </div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">What gets retrieved</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            IEEE 830 section patterns, definitions of good FR/NFR phrasing, and exemplar paragraphs that reduce
            generic or hallucinated requirements when used with strong prompts.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-6 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-4">
            <FileText className="h-5 w-5" />
          </div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Operations</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Use the project scripts to rebuild chunks, refresh embeddings, and run KB quality reports before you
            trust a new corpus in production demos.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/50 p-6 flex gap-4">
        <BookOpen className="h-8 w-8 text-slate-400 dark:text-slate-500 shrink-0" />
        <div>
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">Viewer note</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
            Raw KB files live on the server filesystem. This screen documents architecture for reviewers and
            engineers. For file-level browsing, use your IDE or attach a read-only admin route in a future release.
          </p>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBasePage;
