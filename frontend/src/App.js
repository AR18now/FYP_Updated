import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './components/Home';
import RequirementsInput from './components/RequirementsInput';
import SRSViewer from './components/SRSViewer';
import ResultsView from './components/ResultsView';
import HistoryView from './components/HistoryView';
import Login from './components/Login';
import Signup from './components/Signup';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { isAuthenticated, getCurrentUser, logout } from './utils/auth';
import { getStoredSRS } from './utils/storage';
import './App.css';

function AppShell({ theme, toggleTheme, currentResults, srsData, setCurrentResults, setSrsData, currentUser, setCurrentUser, onLogin, onSignup }) {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      {/* Soft gradient blobs for depth */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-gradient-to-br from-indigo-400/40 via-fuchsia-300/30 to-amber-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-gradient-to-br from-blue-300/40 via-cyan-300/30 to-emerald-200/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40 mix-blend-overlay" />

      <div className="relative flex flex-col min-h-screen">
        {!isAuthPage && (
          <Header theme={theme} onToggleTheme={toggleTheme} currentUser={currentUser} onLogout={setCurrentUser} />
        )}
        {!isAuthPage && (
          <nav
            className="w-full border-b backdrop-blur-xl shadow-[0_10px_40px_-28px_rgba(15,23,42,0.7)]"
            style={{ borderColor: 'var(--card-border)', background: 'var(--panel)' }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
              {[
                { to: '/', label: 'Home' },
                { to: '/input', label: 'Input' },
                { to: '/results', label: 'Results' },
                { to: '/srs', label: 'SRS' },
                { to: '/history', label: 'History' },
              ].map((link) => {
                const active = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                      ${active
                        ? 'bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 text-white shadow-sm'
                        : 'text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-white hover:bg-indigo-500/15 dark:hover:bg-indigo-500/15'
                      }`}
                    style={active ? { boxShadow: '0 0 14px rgba(99, 102, 241, 0.6)' } : {}}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
        <main className={`w-full ${isAuthPage ? '' : 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12'} flex-grow`}>
            <Routes>
            <Route path="/login" element={<Login onLogin={onLogin} theme={theme} />} />
            <Route path="/signup" element={<Signup onSignup={onSignup} theme={theme} />} />
            <Route path="/" element={<ProtectedRoute><Home theme={theme} /></ProtectedRoute>} />
              <Route 
                path="/input" 
                element={
                <ProtectedRoute>
                  <RequirementsInput 
                    onResultsGenerated={setCurrentResults}
                    onSRSGenerated={setSrsData}
                    theme={theme}
                  />
                </ProtectedRoute>
                } 
              />
              <Route 
                path="/results" 
                element={
                <ProtectedRoute>
                  <ResultsView 
                    results={currentResults}
                    onGenerateSRS={setSrsData}
                  />
                </ProtectedRoute>
                } 
              />
              <Route 
                path="/srs" 
              element={
                <ProtectedRoute>
                  <SRSViewer srsData={srsData} />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/history" 
              element={
                <ProtectedRoute>
                  <HistoryView 
                    onLoadInput={(input) => {
                      setCurrentResults(input);
                    }}
                    onLoadSRS={(srs) => {
                      setSrsData(srs);
                    }}
                    theme={theme}
                  />
                </ProtectedRoute>
              } 
              />
            </Routes>
          </main>
        {!isAuthPage && <Footer />}
      </div>
    </div>
  );
}

function App() {
  const [currentResults, setCurrentResults] = useState(null);
  const [srsData, setSrsData] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    document.title = 'Req2Design';
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
  }, [theme]);

  useEffect(() => {
    // Check if user is already logged in
    if (isAuthenticated()) {
      const user = getCurrentUser();
      setCurrentUser(user);
    }
  }, []);

  useEffect(() => {
    // Hydrate last SRS from storage so it shows when returning to Results page
    if (!srsData) {
      const stored = getStoredSRS();
      if (stored && stored.length > 0) {
        setSrsData(stored[0]);
      }
    }
  }, [srsData]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setCurrentResults(null);
    setSrsData(null);
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleSignup = (user) => {
    // After signup, user should login
    setCurrentUser(null);
  };

  return (
    <ErrorBoundary>
      <Router>
        <div
          className="min-h-screen"
        >
          <AppShell
            theme={theme}
            toggleTheme={toggleTheme}
            currentResults={currentResults}
            srsData={srsData}
            setCurrentResults={setCurrentResults}
            setSrsData={setSrsData}
            currentUser={currentUser}
            setCurrentUser={handleLogout}
            onLogin={handleLogin}
            onSignup={handleSignup}
          />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
