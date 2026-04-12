/**
 * Reliable file downloads from axios blob responses (PDF vs HTML fallback, wrong MIME types).
 */

import { getApiErrorMessage } from './apiErrors';

function getHeader(headers, name) {
  if (!headers) return '';
  const lower = name.toLowerCase();
  if (typeof headers.get === 'function') {
    return headers.get(name) || headers.get(lower) || '';
  }
  const keys = Object.keys(headers);
  const found = keys.find((k) => k.toLowerCase() === lower);
  return found ? headers[found] : '';
}

/**
 * @param {string} cd Content-Disposition header value
 * @returns {string|null} filename without path
 */
export function parseFilenameFromContentDisposition(cd) {
  if (!cd || typeof cd !== 'string') return null;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(cd);
  if (star) {
    try {
      return decodeURIComponent(star[1].replace(/["']/g, '').trim());
    } catch {
      return star[1].replace(/["']/g, '').trim();
    }
  }
  const plain = /filename="([^"]+)"/i.exec(cd) || /filename=([^;\s]+)/i.exec(cd);
  if (plain) return plain[1].replace(/["']/g, '').trim();
  return null;
}

/**
 * @param {Blob} blob
 * @returns {Promise<{ kind: 'pdf'|'html'|'json'|'unknown', mime: string }>}
 */
export async function sniffBlobKind(blob) {
  const n = Math.min(blob.size, 2048);
  if (n === 0) return { kind: 'unknown', mime: 'application/octet-stream' };
  const slice = blob.slice(0, n);
  const buf = await slice.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 5) {
    const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]);
    if (sig.startsWith('%PDF')) return { kind: 'pdf', mime: 'application/pdf' };
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 512)).trim();
  if (text.startsWith('{') && (text.includes('"error"') || text.includes('"message"'))) {
    return { kind: 'json', mime: 'application/json' };
  }
  if (text.startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html')) {
    return { kind: 'html', mime: 'text/html; charset=utf-8' };
  }
  if (text.startsWith('{')) return { kind: 'json', mime: 'application/json' };
  return { kind: 'unknown', mime: blob.type || 'application/octet-stream' };
}

function extensionFromKind(kind) {
  if (kind === 'pdf') return 'pdf';
  if (kind === 'html') return 'html';
  if (kind === 'json') return 'json';
  return 'bin';
}

/**
 * Save a successful axios response (responseType: 'blob') as a file download.
 * Uses X-Export-Format, Content-Type, Content-Disposition, and magic-byte sniffing.
 *
 * @param {import('axios').AxiosResponse<Blob>} response
 * @param {{ defaultFilename?: string }} options defaultFilename includes extension or base name like "srs_doc"
 */
export async function saveBlobResponseAsDownload(response, options = {}) {
  const { defaultFilename = 'download' } = options;
  const blob =
    response.data instanceof Blob ? response.data : new Blob([response.data]);

  const exportFormat = (getHeader(response.headers, 'X-Export-Format') || '').toLowerCase();
  const contentType = (getHeader(response.headers, 'content-type') || '').split(';')[0].trim().toLowerCase();
  const contentDisposition = getHeader(response.headers, 'content-disposition');
  const headerName = parseFilenameFromContentDisposition(contentDisposition);

  const sniff = await sniffBlobKind(blob);

  let ext;
  let mime;

  // Prefer magic bytes over headers so MIME/label mismatches still save a valid file.
  if (sniff.kind === 'pdf') {
    ext = 'pdf';
    mime = 'application/pdf';
  } else if (sniff.kind === 'html') {
    if (/\.pdf$/i.test(defaultFilename)) {
      // eslint-disable-next-line no-console
      console.warn(
        '[Download] Expected a PDF but the response looks like HTML. If this persists, restart the API after `pip install -r requirements_api.txt` and check server logs for PDF generation errors.'
      );
    }
    ext = 'html';
    mime = 'text/html; charset=utf-8';
  } else if (sniff.kind === 'json') {
    const text = await blob.text();
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.error || j.message || text;
    } catch {
      /* ignore */
    }
    throw new Error(msg || 'Server returned an error instead of a file.');
  } else if (exportFormat === 'pdf' || exportFormat === 'html') {
    ext = exportFormat;
    mime = exportFormat === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8';
  } else if (contentType.includes('application/pdf')) {
    ext = 'pdf';
    mime = 'application/pdf';
  } else if (contentType.includes('text/html')) {
    ext = 'html';
    mime = 'text/html; charset=utf-8';
  } else {
    ext = extensionFromKind(sniff.kind);
    mime = sniff.mime;
  }

  let baseName;
  if (headerName) {
    baseName = headerName.replace(/\.(pdf|html|json|bin)$/i, '').replace(/^.*[/\\]/, '');
  } else {
    baseName = defaultFilename.replace(/\.(pdf|html)$/i, '');
  }
  const filename = `${baseName}.${ext}`;

  const outBlob = new Blob([blob], { type: mime });
  const url = window.URL.createObjectURL(outBlob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Readable message from axios error when response body is JSON in a Blob.
 */
export async function messageFromAxiosBlobError(error) {
  const data = error.response?.data;
  if (data instanceof Blob) {
    const text = await data.text();
    try {
      const j = JSON.parse(text);
      return j.error || j.message || text;
    } catch {
      return text.slice(0, 800) || error.message;
    }
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data.error || data.message || error.message || 'Download failed.';
  }
  return getApiErrorMessage(error, 'Download failed.');
}
