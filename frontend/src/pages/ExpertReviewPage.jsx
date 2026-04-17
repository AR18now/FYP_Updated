import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  Send,
  Inbox,
  ListChecks,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageCircle,
} from 'lucide-react';
import ExpertReviewChat from '../components/ExpertReviewChat';
import config from '../config';
import { getApiErrorMessage } from '../utils/apiErrors';
import { getStoredSRS } from '../utils/storage';
import { getCurrentUser } from '../utils/auth';

function buildSrsPayload(srs) {
  if (!srs || typeof srs !== 'object') return null;
  return {
    document_id: srs.document_id || srs.id,
    title: srs.title,
    version: srs.version,
    date: srs.date,
    author: srs.author,
    raw_text: srs.raw_text,
    sections: srs.sections,
    edited_html: srs.edited_html,
  };
}

const statusBadge = (status) => {
  if (status === 'reviewed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 px-2 py-0.5 text-xs font-medium">
        <CheckCircle2 className="h-3 w-3" />
        Reviewed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100 px-2 py-0.5 text-xs font-medium">
      <Clock className="h-3 w-3" />
      Pending
    </span>
  );
};

/** mode: 'user' — submit + my submissions only; 'expert' — reviewer inbox only (separate panel). */
const ExpertReviewPage = ({ srsData: sessionSrs, mode = 'user' }) => {
  const location = useLocation();
  const preselectId = location.state?.preselectDocumentId;
  const isExpertPanel = mode === 'expert';

  const [tab, setTab] = useState(() => (isExpertPanel ? 'inbox' : 'submit'));
  /** Shared across lists; request ids are unique. */
  const [expandedId, setExpandedId] = useState(null);
  const [storedList, setStoredList] = useState(() => getStoredSRS());
  const [selectedDocId, setSelectedDocId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitOk, setSubmitOk] = useState(null);

  const [requests, setRequests] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState(null);

  const [reviewDrafts, setReviewDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  const currentUser = useMemo(() => getCurrentUser(), []);

  const options = useMemo(() => {
    const map = new Map();
    storedList.forEach((s) => {
      const id = s.document_id || s.id;
      if (id) map.set(id, s);
    });
    if (sessionSrs) {
      const sid = sessionSrs.document_id || sessionSrs.id;
      if (sid) map.set(sid, { ...sessionSrs, _fromSession: true });
    }
    return Array.from(map.values());
  }, [sessionSrs, storedList]);

  useEffect(() => {
    if (preselectId) {
      setSelectedDocId(preselectId);
      setTab('submit');
    }
  }, [preselectId]);

  useEffect(() => {
    if (!selectedDocId && options.length > 0) {
      const first = options[0];
      setSelectedDocId(first.document_id || first.id || '');
    }
  }, [options, selectedDocId]);

  const refreshRequests = useCallback(async (opts) => {
    const silent = opts?.silent === true;
    if (!silent) {
      setLoadingList(true);
      setListError(null);
    }
    try {
      const res = await axios.get(config.API_ENDPOINTS.EXPERT_REVIEW_REQUESTS, { params: { status: 'all' } });
      setRequests(Array.isArray(res.data?.requests) ? res.data.requests : []);
    } catch (e) {
      if (!silent) {
        setListError(getApiErrorMessage(e, 'Could not load review queue.'));
        setRequests([]);
      }
    } finally {
      if (!silent) setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    refreshRequests();
  }, [refreshRequests]);

  /** Poll while a thread is expanded so the other party's messages appear without manual refresh. */
  useEffect(() => {
    if (!expandedId) return undefined;
    const t = setInterval(() => refreshRequests({ silent: true }), 12000);
    return () => clearInterval(t);
  }, [expandedId, refreshRequests]);

  const selectedSrs = useMemo(() => {
    if (!selectedDocId) return null;
    return options.find((s) => (s.document_id || s.id) === selectedDocId) || null;
  }, [options, selectedDocId]);

  const mySubmissions = useMemo(() => {
    const uid = currentUser?.id;
    if (!uid) return requests;
    return requests.filter((r) => r?.submitter?.user_id === uid);
  }, [requests, currentUser?.id]);

  const pendingInbox = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);

  const reviewedInbox = useMemo(() => requests.filter((r) => r.status === 'reviewed'), [requests]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitOk(null);
    const payload = buildSrsPayload(selectedSrs);
    if (!payload?.document_id) {
      setSubmitError('Select an SRS document with a valid document ID.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(config.API_ENDPOINTS.EXPERT_REVIEW_SUBMIT, {
        submitter: currentUser
          ? {
              user_id: currentUser.id,
              username: currentUser.username,
              email: currentUser.email,
            }
          : {},
        srs_snapshot: payload,
        requester_notes: notes,
      });
      setSubmitOk('Your SRS was sent to the expert review queue.');
      setNotes('');
      refreshRequests();
      setTab('my');
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Submit failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  const updateDraft = (id, field, value) => {
    setReviewDrafts((d) => ({
      ...d,
      [id]: { ...d[id], [field]: value },
    }));
  };

  const submitExpertReview = async (id) => {
    const draft = reviewDrafts[id] || {};
    const feedback = (draft.feedback || '').trim();
    const verdict = draft.verdict || 'approved';
    const expertName = (draft.expertName || currentUser?.username || 'Expert').trim();
    if (feedback.length < 3) {
      setListError('Please enter expert feedback before submitting.');
      return;
    }
    setSavingId(id);
    setListError(null);
    try {
      await axios.patch(config.API_ENDPOINTS.expertReviewRequest(id), {
        expert_feedback: feedback,
        verdict,
        expert_name: expertName,
      });
      await refreshRequests();
      setExpandedId(null);
    } catch (e) {
      setListError(getApiErrorMessage(e, 'Could not save review.'));
    } finally {
      setSavingId(null);
    }
  };

  const refreshStored = () => setStoredList(getStoredSRS());

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in px-1 sm:px-0">
      <section className="rounded-2xl border border-r2d-border bg-r2d-surfaceElevated shadow-card dark:bg-slate-900/90 dark:border-slate-700 overflow-hidden">
        <div className="relative px-4 sm:px-6 py-8 lg:px-10 lg:py-9 bg-gradient-to-br from-r2d-primaryDark via-r2d-primary to-slate-900 text-white">
          <div className="absolute inset-0 opacity-25 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-r2d-accent/30 via-transparent to-transparent" />
          <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="mt-3 text-2xl lg:text-3xl font-bold font-display tracking-tight">
                {isExpertPanel ? 'Expert review queue' : 'Expert review'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-100/90 leading-relaxed">
                {isExpertPanel
                  ? 'Pending submissions from project users. Open an item, review the SRS snapshot, and submit structured feedback.'
                  : 'After AI generates your SRS, send it to a human expert for structured feedback. Track your submissions under My submissions—reviewers use the separate expert panel.'}
              </p>
            </div>
            <FileText className="h-14 w-14 text-white/30 shrink-0 hidden sm:block" aria-hidden />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-r2d-border dark:border-slate-700 pb-2">
        {(isExpertPanel
          ? [
              { id: 'inbox', label: 'Expert inbox', icon: Inbox },
              { id: 'threads', label: 'Reviewed & chat', icon: MessageCircle },
            ]
          : [
              { id: 'submit', label: 'Send for review', icon: Send },
              { id: 'my', label: 'My submissions', icon: ListChecks },
            ]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setListError(null);
              setExpandedId(null);
              setTab(id);
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-3 sm:px-4 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-r2d-primary text-white dark:bg-r2d-accent'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            refreshStored();
            refreshRequests();
          }}
          className="w-full sm:w-auto sm:ml-auto inline-flex items-center justify-center gap-2 rounded-lg border border-r2d-border px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      {listError && tab !== 'submit' && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {listError}
        </div>
      )}

      {tab === 'submit' && (
        <div className="rounded-xl border border-r2d-border bg-white dark:bg-slate-900 dark:border-slate-700 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Submit SRS to expert</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Choose a document from your session or history. The server stores a snapshot for reviewers.
          </p>

          {options.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
              No SRS found. Generate one from{' '}
              <Link to="/generate-srs" className="text-r2d-primary font-medium underline dark:text-r2d-accentSoft">
                Generate SRS
              </Link>{' '}
              first.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="expert-srs-select" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                  SRS document
                </label>
                <select
                  id="expert-srs-select"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full rounded-lg border border-r2d-border bg-white px-3 py-2.5 text-sm dark:bg-slate-950 dark:border-slate-600 dark:text-slate-100"
                >
                  {options.map((s) => {
                    const id = s.document_id || s.id;
                    const label = s.title || id;
                    return (
                      <option key={id} value={id}>
                        {label} ({id}){s._fromSession ? ' · current' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label htmlFor="expert-notes" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                  Notes for the expert (optional)
                </label>
                <textarea
                  id="expert-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="e.g. Please focus on NFRs and security; we are unsure about scope in section 2."
                  className="w-full rounded-lg border border-r2d-border bg-white px-3 py-2.5 text-sm dark:bg-slate-950 dark:border-slate-600 dark:text-slate-100 placeholder:text-slate-400"
                />
              </div>
              {submitError && (
                <p className="text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {submitError}
                </p>
              )}
              {submitOk && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {submitOk}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting || !selectedSrs}
                className="inline-flex items-center gap-2 rounded-lg bg-r2d-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-r2d-primaryLight disabled:opacity-50 dark:bg-r2d-accent dark:hover:bg-r2d-primaryLight"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send to expert queue
              </button>
            </form>
          )}
        </div>
      )}

      {tab === 'my' && (
        <div className="rounded-xl border border-r2d-border bg-white dark:bg-slate-900 dark:border-slate-700 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">My submissions</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {currentUser
              ? 'Requests you submitted from this account.'
              : 'Log in so submissions are tied to your account. Until then, this list stays empty even if you submit anonymously.'}
          </p>
          {loadingList ? (
            <div className="mt-8 flex justify-center text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : mySubmissions.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">No submissions yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-700">
              {mySubmissions.map((r) => {
                const threadOpen = expandedId === r.id;
                return (
                  <li key={r.id} className="py-4 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {r.srs_snapshot?.title || r.srs_snapshot?.document_id || r.id}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Submitted {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(r.status)}
                        <button
                          type="button"
                          onClick={() => setExpandedId(threadOpen ? null : r.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-r2d-border px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {threadOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          Chat
                        </button>
                      </div>
                    </div>
                    {r.requester_notes && (
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 rounded-lg px-3 py-2">
                        <span className="font-medium text-slate-700 dark:text-slate-200">Your notes: </span>
                        {r.requester_notes}
                      </p>
                    )}
                    {r.review && (
                      <div className="mt-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 p-3 text-sm">
                        <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                          {r.review.expert_name} · {r.review.verdict?.replace(/_/g, ' ')}
                        </p>
                        <p className="mt-1 text-emerald-900/90 dark:text-emerald-100/90 whitespace-pre-wrap">{r.review.expert_feedback}</p>
                        <p className="mt-2 text-xs text-emerald-800/80 dark:text-emerald-300/80">
                          {r.review.reviewed_at ? new Date(r.review.reviewed_at).toLocaleString() : ''}
                        </p>
                      </div>
                    )}
                    {threadOpen && (
                      <div className="mt-4">
                        <ExpertReviewChat
                          requestId={r.id}
                          messages={r.chat_messages}
                          senderRole="user"
                          currentUser={currentUser}
                          onRefresh={() => refreshRequests({ silent: true })}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === 'inbox' && (
        <div className="rounded-xl border border-r2d-border bg-white dark:bg-slate-900 dark:border-slate-700 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Expert inbox</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Pending items awaiting human feedback. Completing a review marks the request as reviewed.
          </p>
          {loadingList ? (
            <div className="mt-8 flex justify-center text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : pendingInbox.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">No pending reviews. You are all caught up.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {pendingInbox.map((r) => {
                const open = expandedId === r.id;
                const snap = r.srs_snapshot || {};
                const preview = (snap.raw_text || '').slice(0, 280);
                return (
                  <li
                    key={r.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : r.id)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-100/80 dark:hover:bg-slate-800"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {snap.title || snap.document_id}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          From {r.submitter?.username || r.submitter?.email || 'Anonymous'} · {snap.document_id}
                        </p>
                      </div>
                      {open ? <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" /> : <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />}
                    </button>
                    {open && (
                      <div className="px-4 pb-4 pt-0 border-t border-slate-200 dark:border-slate-700 space-y-4">
                        {r.requester_notes && (
                          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                            <span className="font-semibold">Requester: </span>
                            {r.requester_notes}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-500 mb-1">SRS preview</p>
                          <pre className="text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-950 p-3 max-h-48 overflow-auto whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                            {preview || '(no raw text in snapshot)'}
                            {(snap.raw_text || '').length > 280 ? '…' : ''}
                          </pre>
                        </div>
                        <ExpertReviewChat
                          requestId={r.id}
                          messages={r.chat_messages}
                          senderRole="expert"
                          currentUser={currentUser}
                          onRefresh={() => refreshRequests({ silent: true })}
                        />
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500">Verdict</label>
                            <select
                              value={reviewDrafts[r.id]?.verdict || 'approved'}
                              onChange={(e) => updateDraft(r.id, 'verdict', e.target.value)}
                              className="mt-1 w-full rounded-lg border border-r2d-border bg-white dark:bg-slate-950 dark:border-slate-600 text-sm px-3 py-2"
                            >
                              <option value="approved">Approved</option>
                              <option value="needs_revision">Needs revision</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500">Reviewer name</label>
                            <input
                              type="text"
                              value={reviewDrafts[r.id]?.expertName ?? currentUser?.username ?? ''}
                              onChange={(e) => updateDraft(r.id, 'expertName', e.target.value)}
                              className="mt-1 w-full rounded-lg border border-r2d-border bg-white dark:bg-slate-950 dark:border-slate-600 text-sm px-3 py-2"
                              placeholder="Expert name"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase text-slate-500">Expert feedback</label>
                          <textarea
                            value={reviewDrafts[r.id]?.feedback || ''}
                            onChange={(e) => updateDraft(r.id, 'feedback', e.target.value)}
                            rows={5}
                            className="mt-1 w-full rounded-lg border border-r2d-border bg-white dark:bg-slate-950 dark:border-slate-600 text-sm px-3 py-2"
                            placeholder="Structured comments for the author (clarity, missing NFRs, risks, etc.)"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => submitExpertReview(r.id)}
                          disabled={savingId === r.id}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                        >
                          {savingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Submit review
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === 'threads' && isExpertPanel && (
        <div className="rounded-xl border border-r2d-border bg-white dark:bg-slate-900 dark:border-slate-700 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reviewed — follow-up chat</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Completed reviews stay here so you can tell the author what changed, confirm the SRS is acceptable, or answer questions.
          </p>
          {loadingList ? (
            <div className="mt-8 flex justify-center text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : reviewedInbox.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">No reviewed items yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {reviewedInbox.map((r) => {
                const open = expandedId === r.id;
                const snap = r.srs_snapshot || {};
                return (
                  <li
                    key={r.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : r.id)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-100/80 dark:hover:bg-slate-800"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {snap.title || snap.document_id}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {r.submitter?.username || r.submitter?.email || 'Anonymous'} · {r.review?.reviewed_at ? new Date(r.review.reviewed_at).toLocaleString() : ''}
                        </p>
                      </div>
                      {open ? <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" /> : <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />}
                    </button>
                    {open && (
                      <div className="px-4 pb-4 pt-0 border-t border-slate-200 dark:border-slate-700 space-y-4">
                        {r.review && (
                          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 p-3 text-sm">
                            <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                              {r.review.expert_name} · {r.review.verdict?.replace(/_/g, ' ')}
                            </p>
                            <p className="mt-1 text-emerald-900/90 whitespace-pre-wrap">{r.review.expert_feedback}</p>
                          </div>
                        )}
                        <ExpertReviewChat
                          requestId={r.id}
                          messages={r.chat_messages}
                          senderRole="expert"
                          currentUser={currentUser}
                          onRefresh={() => refreshRequests({ silent: true })}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpertReviewPage;
