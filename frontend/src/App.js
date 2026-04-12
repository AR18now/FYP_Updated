import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppShellLayout from './components/layout/AppShellLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Signup from './components/Signup';
import SRSViewer from './components/SRSViewer';
import ResultsView from './components/ResultsView';
import HistoryView from './components/HistoryView';
import TextualUseCasesPage from './components/TextualUseCasesPage';
import UseCaseDiagramPage from './components/UseCaseDiagramPage';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardPage from './pages/DashboardPage';
import GenerateSRSPage from './pages/GenerateSRSPage';
import SettingsPage from './pages/SettingsPage';
import RTMPage from './pages/RTMPage';
import ProfilePage from './pages/ProfilePage';
import ExpertReviewPage from './pages/ExpertReviewPage';
import SRSMetricsPage from './pages/SRSMetricsPage';
import { isAuthenticated, getCurrentUser, logout } from './utils/auth';
import { getStoredSRS } from './utils/storage';
import './App.css';

function App() {
  const [currentResults, setCurrentResults] = useState(null);
  const [srsData, setSrsData] = useState(null);
  const [useCaseData, setUseCaseData] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    document.title = 'Req2Design';
  }, []);

  useEffect(() => {
    if (isAuthenticated()) {
      setCurrentUser(getCurrentUser());
    }
  }, []);

  useEffect(() => {
    if (!srsData) {
      const stored = getStoredSRS();
      if (stored && stored.length > 0) {
        setSrsData(stored[0]);
      }
    }
  }, [srsData]);

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setCurrentResults(null);
    setSrsData(null);
    setUseCaseData(null);
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleSignup = () => {
    setCurrentUser(null);
  };

  const shellProps = {
    currentUser,
    onLogout: handleLogout,
  };

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen">
          <Routes>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/signup" element={<Signup onSignup={handleSignup} />} />

            <Route
              element={
                <ProtectedRoute>
                  <AppShellLayout {...shellProps} />
                </ProtectedRoute>
              }
            >
              <Route
                index
                element={
                  <DashboardPage
                    hasResults={!!currentResults}
                    hasSrs={!!srsData}
                    hasUseCases={useCaseData}
                    srsData={srsData}
                  />
                }
              />
              <Route
                path="generate-srs"
                element={
                  <GenerateSRSPage
                    onResultsGenerated={setCurrentResults}
                    onSRSGenerated={setSrsData}
                    setCurrentResults={setCurrentResults}
                  />
                }
              />
              <Route
                path="input"
                element={<Navigate to="/generate-srs" replace />}
              />
              <Route
                path="results"
                element={
                  <ResultsView
                    results={currentResults}
                    srsData={srsData}
                    onGenerateSRS={setSrsData}
                    useCaseData={useCaseData}
                    onUseCaseDataChange={setUseCaseData}
                  />
                }
              />
              <Route
                path="srs"
                element={
                  <SRSViewer
                    srsData={srsData}
                    currentResults={currentResults}
                    onSelectSrsVariant={setSrsData}
                    useCaseData={useCaseData}
                    onUseCaseDataChange={setUseCaseData}
                  />
                }
              />
              <Route
                path="textual-usecases"
                element={
                  <TextualUseCasesPage
                    srsData={srsData}
                    useCaseData={useCaseData}
                    onUseCaseDataChange={setUseCaseData}
                  />
                }
              />
              <Route
                path="usecase-diagram"
                element={
                  <UseCaseDiagramPage
                    srsData={srsData}
                    useCaseData={useCaseData}
                    onUseCaseDataChange={setUseCaseData}
                  />
                }
              />
              <Route
                path="history"
                element={
                  <HistoryView
                    onLoadInput={(input) => setCurrentResults(input)}
                    onLoadSRS={(srs) => setSrsData(srs)}
                  />
                }
              />
              <Route
                path="settings"
                element={<SettingsPage />}
              />
              <Route
                path="rtm"
                element={<RTMPage srsData={srsData} useCaseData={useCaseData} />}
              />
              <Route
                path="profile"
                element={<ProfilePage currentUser={currentUser} />}
              />
              <Route
                path="expert-review"
                element={<ExpertReviewPage srsData={srsData} />}
              />
              <Route path="srs-metrics" element={<SRSMetricsPage srsData={srsData} />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
