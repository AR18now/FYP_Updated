/**
 * Consume POST /api/generate-srs-stream (Server-Sent Events).
 * Appends each `delta` via onDelta so the UI can show text as it arrives — better perceived latency than one JSON blob.
 */

/**
 * @param {object} opts
 * @param {string} opts.url
 * @param {object} opts.body - { results, project_info, srs_llm_choice? }
 * @param {(chunk: string, accumulated: string) => void} [opts.onDelta]
 * @param {(srs: object) => void} [opts.onDone]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<object|null>} Final SRS payload from `done`, or null
 */
export async function consumeSrsGenerateStream({ url, body, onDelta, onDone, signal }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    let message = res.statusText || 'Request failed';
    try {
      const j = JSON.parse(text);
      message = j.error || j.message || message;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('Streaming not supported in this browser.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let finalSrs = null;

  const processBlock = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('data:')) return;
    const jsonStr = trimmed.replace(/^data:\s?/, '').trim();
    if (!jsonStr) return;
    const obj = JSON.parse(jsonStr);
    if (obj.type === 'delta' && obj.text) {
      accumulated += obj.text;
      onDelta?.(obj.text, accumulated);
    } else if (obj.type === 'done' && obj.srs) {
      finalSrs = obj.srs;
      onDone?.(obj.srs);
    } else if (obj.type === 'error') {
      throw new Error(obj.message || 'SRS stream error');
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      processBlock(block);
    }
  }

  if (buffer.trim()) {
    processBlock(buffer);
  }

  return finalSrs;
}
