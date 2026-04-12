import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import config from '../config';
import { getApiErrorMessage } from '../utils/apiErrors';

/**
 * Threaded Q&A between project user and expert for one review request.
 * @param {'user'|'expert'} senderRole - Who is typing in this panel
 */
const ExpertReviewChat = ({ requestId, messages, senderRole, currentUser, onRefresh, disabled }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [localError, setLocalError] = useState(null);
  const bottomRef = useRef(null);

  const list = Array.isArray(messages) ? messages : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [list.length, requestId]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending || disabled) return;
    setSending(true);
    setLocalError(null);
    try {
      const payload = {
        sender_role: senderRole,
        body: t,
        submitter: currentUser
          ? {
              user_id: currentUser.id,
              username: currentUser.username,
              email: currentUser.email,
            }
          : {},
      };
      if (senderRole === 'expert') {
        payload.author_label = (currentUser?.username || 'Expert').trim() || 'Expert';
      }
      await axios.post(config.API_ENDPOINTS.expertReviewMessages(requestId), payload);
      setText('');
      onRefresh?.();
    } catch (e) {
      setLocalError(getApiErrorMessage(e, 'Could not send message.'));
    } finally {
      setSending(false);
    }
  };

  const canSend =
    senderRole === 'expert' || (senderRole === 'user' && currentUser?.id);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-950/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/60">
        <MessageCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Conversation
        </span>
      </div>
      <div className="max-h-56 overflow-y-auto px-3 py-3 space-y-2">
        {list.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No messages yet. Ask why something was recommended, or tell the author what you changed.
          </p>
        ) : (
          list.map((m) => {
            const isExpert = m.sender_role === 'expert';
            const label = isExpert ? m.author_label || 'Expert' : 'Author';
            return (
              <div
                key={m.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  isExpert
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 text-slate-800 dark:text-slate-100'
                    : 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <span className="text-xs font-semibold">{label}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                    {m.sent_at ? new Date(m.sent_at).toLocaleString() : ''}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="px-3 pb-3 pt-1 border-t border-slate-200 dark:border-slate-700 space-y-2">
        {senderRole === 'user' && !currentUser?.id && (
          <p className="text-xs text-amber-700 dark:text-amber-300">Log in to send messages on this thread.</p>
        )}
        {localError && <p className="text-xs text-rose-600 dark:text-rose-400">{localError}</p>}
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            disabled={disabled || !canSend}
            placeholder={
              senderRole === 'expert'
                ? 'Explain changes, confirm SRS is OK, or ask a follow-up…'
                : 'Ask why something was done or clarify your SRS…'
            }
            className="flex-1 rounded-lg border border-r2d-border bg-white dark:bg-slate-950 dark:border-slate-600 text-sm px-3 py-2 resize-y min-h-[2.5rem] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={send}
            disabled={disabled || sending || !canSend || !text.trim()}
            className="shrink-0 inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-sm font-medium disabled:opacity-50 self-end"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpertReviewChat;
