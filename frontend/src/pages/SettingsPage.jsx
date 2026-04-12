import React from 'react';
import config from '../config';
import { useTheme } from '../context/ThemeContext';

const SettingsPage = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="max-w-2xl space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight dark:text-slate-100">Settings</h1>
        <p className="mt-1 text-slate-600 text-sm dark:text-slate-400">Workspace preferences and connection info.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/50">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Appearance</h2>
          <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">Theme applies across the workspace and document views.</p>
        </div>
        <div className="p-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Color mode</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Toggle light or dark for the whole app.</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Switch to {theme === 'dark' ? 'light' : 'dark'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/50">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">API</h2>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Base URL</p>
            <p className="mt-1 text-sm font-mono text-slate-800 break-all bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600">
              {config.API_BASE_URL}
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure in <code className="bg-slate-100 px-1 rounded dark:bg-slate-800 dark:text-slate-300">frontend/src/config.js</code> for different environments.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">About Req2Design</h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed dark:text-slate-400">
          AI-assisted requirements pipeline: clarification, RAG-backed SRS generation, verification metrics,
          textual use cases (Cockburn), and PlantUML diagrams. Built for software engineering course and
          professional demos.
        </p>
        <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">Req2Design · SRS Generator</p>
      </div>
    </div>
  );
};

export default SettingsPage;
