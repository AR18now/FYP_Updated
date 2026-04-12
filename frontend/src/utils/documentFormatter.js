const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * IEEE-830 style section lines: "1. Introduction", "1.1 Purpose", "3.1.1 User Interfaces".
 */
const matchNumberedSectionHeading = (trimmed) => {
  let m = trimmed.match(/^(\d+)\.\s+(.+)$/);
  if (m) {
    const depth = 1;
    return { full: trimmed, depth, num: m[1], title: m[2].trim() };
  }
  m = trimmed.match(/^(\d+(?:\.\d+)+)\s+(.+)$/);
  if (m) {
    const parts = m[1].split('.');
    const depth = parts.length;
    return { full: trimmed, depth, num: m[1], title: m[2].trim() };
  }
  return null;
};

const splitEmbeddedNumberedHeadings = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(
    /\s+(?=\d+\.\s+[A-Za-z(])|\s+(?=\d+(?:\.\d+)+\s+[A-Za-z(])/
  );
  const cleaned = parts.map((p) => p.trim()).filter(Boolean);
  return cleaned.length ? cleaned : [trimmed];
};

const stripMarkdownNoise = (s) =>
  String(s)
    .replace(/^\*{1,3}\s*/, '')
    .replace(/\s*\*{1,3}$/, '')
    .replace(/^#{1,6}\s*/, '')
    .trim();

/** Fix "PurposeThe" / "ScopeThis" merged words on section lines (starts with digit). */
const fixMergedWordsOnNumberedLine = (line) => {
  const t = line.trim();
  if (!/^\d/.test(t)) return line;
  return line.replace(/([a-z])([A-Z][a-z])/g, '$1 $2');
};

/** Normalize awkward endings: missing space after period before Note, etc. */
const polishClosingText = (s) => {
  let x = s;
  x = x.replace(/End of Document\.([A-Za-z])/gi, 'End of Document. $1');
  x = x.replace(/(\.)(Note|Version|Date)(:|\.)/gi, '. $2$3');
  x = x.replace(/Version:([\d.]+)(?=\s|$)/gi, 'Version: $1');
  x = x.replace(/Date:([\d-]+)(?=\s|$)/gi, 'Date: $1');
  return x;
};

/**
 * Normalize model raw text layout by injecting newlines before known section labels
 * and numbered headings when the model emits them in a single long line.
 */
const normalizeSrsLayout = (value = '') => {
  let x = String(value || '');
  // Remove standalone horizontal separators from model output.
  x = x.replace(/^\s*-{3,}\s*$/gm, '');

  // Start numbered headings on new lines if they were inlined.
  x = x.replace(/\s+(?=\d+\.\s+[A-Z])/g, '\n');
  x = x.replace(/\s+(?=\d+(?:\.\d+)+\s+[A-Z])/g, '\n');
  x = x.replace(/\s+(?=FR-\d+\b)/gi, '\n');
  x = x.replace(/\s+(?=NFR-\d+\b)/gi, '\n');

  // Ensure common SRS key labels begin on their own line.
  const labels = [
    'Purpose:',
    'Scope:',
    'Definitions/Acronyms:',
    'References:',
    'Overview:',
    'Product Perspective:',
    'Product Functions:',
    'User Characteristics:',
    'Constraints:',
    'Assumptions/Dependencies:',
    'External Interface Requirements:',
    'Functional Requirements:',
    'Non-functional Requirements:',
    'System Features:',
    'Input:',
    'Processing:',
    'Output:',
    'Priority:',
    'Feature-by-Feature Description',
  ];
  for (const lbl of labels) {
    const esc = lbl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    x = x.replace(new RegExp(`\\s+(?=${esc})`, 'gi'), '\n');
  }

  // Keep dash bullets readable.
  x = x.replace(/\s+-\s+/g, '\n- ');
  x = x.replace(/\n{3,}/g, '\n\n');
  return x.trim();
};

const headingClassForDepth = (depth) => {
  const cls = ['srs-h', 'srs-h--d1', 'srs-h--d2', 'srs-h--d3', 'srs-h--d4', 'srs-h--d5'];
  const i = Math.min(Math.max(depth - 1, 0), cls.length - 1);
  return cls[i] || 'srs-h';
};

const renderLabelValueInline = (text) => {
  const m = String(text || '').match(/^([A-Za-z0-9 /,&\-]{2,120})\s*:\s*(.+)$/);
  if (!m) return escapeHtml(text);
  return `<span class="srs-k">${escapeHtml(m[1])}:</span> <span class="srs-body">${escapeHtml(m[2])}</span>`;
};

/**
 * Split a long FR/NFR line into bullet rows on " - " when it looks like multiple clauses.
 */
const splitFeatureDashes = (clean) => {
  if (clean.length < 40 || !clean.includes(' - ')) return null;
  const parts = clean.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const looksEnumerated = parts.some(
    (p) =>
      /^(FR-\d+|NFR-\d+|Feature\s*\d*)/i.test(p) ||
      /^(Input|Processing|Output|Priority)\s*:/i.test(p)
  );
  if (!looksEnumerated) return null;
  return parts;
};

/**
 * @param {string} rawText
 * @param {{ assignIds?: boolean }} options — paragraph ids for "jump to check" in SRS viewer
 */
export const formatSrsToHtml = (rawText = '', options = {}) => {
  const assignIds = options.assignIds === true;
  // Normalize the raw text into a more document-like body (the model often emits --- separators).
  let normalized = polishClosingText(normalizeSrsLayout(String(rawText || '')));
  // Drop common "title/author/date" header blocks so our UI header is the canonical one.
  normalized = normalized.replace(
    /^\s*(?:Software Requirements Specification\s*\(SRS\)[^\n]*\n+)?(?:Author\s*:[^\n]*\n+)?(?:Date\s*:[^\n]*\n+)?\s*/i,
    ''
  );
  // Some models start with "---" then title/author in one line.
  normalized = normalized.replace(/^\s*-{3,}\s*\n+/, '');
  normalized = normalized.trim();

  // Keep only one canonical SRS document body in UI:
  // start at first INTRODUCTION and stop at first End of Document.
  const firstIntroIdx = normalized.search(/(^|\n)\s*INTRODUCTION\s*(\n|$)/i);
  if (firstIntroIdx >= 0) {
    normalized = normalized.slice(firstIntroIdx).trim();
  }
  const endMarker = normalized.match(/\bEnd of Document\./i);
  if (endMarker && typeof endMarker.index === 'number') {
    normalized = normalized.slice(0, endMarker.index + endMarker[0].length).trim();
  }

  const text = normalized;
  const lines = text.split('\n');
  const out = [];
  let pIndex = 0;

  const nextPId = () => {
    if (!assignIds) return '';
    const id = `srs-p-${pIndex}`;
    pIndex += 1;
    return ` id="${id}" data-srs-idx="${pIndex - 1}"`;
  };

  for (const rawLine of lines) {
    const mergedFix = fixMergedWordsOnNumberedLine(rawLine);
    const trimmed = mergedFix.trim();
    if (!trimmed) {
      out.push('<div class="srs-spacer" style="height:12px" aria-hidden="true"></div>');
      continue;
    }

    const segments = splitEmbeddedNumberedHeadings(mergedFix);
    for (const segment of segments) {
      const clean = stripMarkdownNoise(segment);
      const heading = matchNumberedSectionHeading(clean);

      if (heading) {
        const escTitle = escapeHtml(heading.full);
        const hClass = headingClassForDepth(heading.depth);
        const headingNum = escapeHtml(heading.num);
        const headingLabel = escapeHtml(heading.title);
        out.push(
          `<div class="${hClass}"${assignIds ? ` id="srs-h-${pIndex}"` : ''} data-srs-depth="${heading.depth}"><span class="srs-heading-num">${headingNum}</span><span class="srs-heading-text">${headingLabel}</span></div>`
        );
        if (assignIds) pIndex += 1;
        continue;
      }

      if (/^(FR-\d+|NFR-\d+)\b/i.test(clean)) {
        const dashParts = splitFeatureDashes(clean);
        if (dashParts) {
          out.push(`<ul class="srs-list srs-fr-list"${nextPId()}>`);
          for (const part of dashParts) {
            const isFr = /^(FR-\d+|NFR-\d+)/i.test(part);
            if (isFr) {
              const m = part.match(/^(FR-\d+|NFR-\d+)\s*:?\s*(.*)$/i);
              if (m) {
                out.push(
                  `<li class="srs-li"><span class="srs-id">${escapeHtml(m[1])}</span> <span class="srs-body">${escapeHtml(m[2])}</span></li>`
                );
              } else {
                out.push(`<li class="srs-li">${escapeHtml(part)}</li>`);
              }
            } else {
              out.push(`<li class="srs-li">${renderLabelValueInline(part)}</li>`);
            }
          }
          out.push('</ul>');
          continue;
        }
        const m = clean.match(/^(FR-\d+|NFR-\d+)\s*:?\s*(.*)$/i);
        if (m) {
          out.push(
            `<p class="srs-p srs-fr"${nextPId()}><span class="srs-id">${escapeHtml(m[1])}</span> <span class="srs-body">${escapeHtml(m[2])}</span></p>`
          );
          continue;
        }
        out.push(`<p class="srs-p"${nextPId()}>${escapeHtml(clean)}</p>`);
        continue;
      }

      if (
        /^[A-Za-z0-9 /,&\-]{2,80}:\s*\S/.test(clean) &&
        !clean.includes('http') &&
        clean.length < 2000
      ) {
        const idx = clean.indexOf(':');
        const k = clean.slice(0, idx).trim();
        const rest = clean.slice(idx + 1).trim();
        out.push(
          `<p class="srs-p srs-kv"${nextPId()}><span class="srs-k">${escapeHtml(k)}:</span> <span class="srs-body">${escapeHtml(rest)}</span></p>`
        );
        continue;
      }

      if (clean.includes(' - ') && clean.length > 50) {
        const sub = splitFeatureDashes(clean);
        if (sub && sub.length >= 2) {
          out.push(`<ul class="srs-list"${nextPId()}>`);
          for (const part of sub) {
            out.push(`<li class="srs-li">${renderLabelValueInline(part)}</li>`);
          }
          out.push('</ul>');
          continue;
        }
      }

      out.push(`<p class="srs-p srs-body"${nextPId()}>${renderLabelValueInline(clean)}</p>`);
    }
  }

  return out.join('');
};

export const formatTextualUseCasesToHtml = (text = '') => {
  const source = String(text || '').trim();
  if (!source) return '<p class="tuc-empty">No textual use cases generated.</p>';

  const lines = source.split('\n').map((line) => line.trimEnd());
  const blocks = [];
  let current = [];

  const pushCurrent = () => {
    if (current.length) {
      blocks.push(current);
      current = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      pushCurrent();
      continue;
    }
    if (/^Use Case Name\s*:/i.test(trimmed) && current.length) pushCurrent();
    current.push(trimmed);
  }
  pushCurrent();

  if (!blocks.length) return `<p class="tuc-empty">${escapeHtml(source)}</p>`;

  const renderBlock = (block, idx) => {
    let caseName = `Use Case ${idx + 1}`;
    const fields = [];
    const bullets = [];
    const free = [];

    for (const line of block) {
      const kv = line.match(/^([^:]{2,60})\s*:\s*(.+)$/);
      if (kv) {
        const key = kv[1].trim();
        const value = kv[2].trim();
        if (/^use case name$/i.test(key)) caseName = value || caseName;
        fields.push({ key, value });
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        bullets.push(line.replace(/^[-*]\s+/, '').trim());
      } else {
        free.push(line);
      }
    }

    const fieldsHtml = fields
      .filter((f) => !/^use case name$/i.test(f.key))
      .map(
        (f) =>
          `<p class="tuc-row"><span class="tuc-key">${escapeHtml(f.key)}:</span> <span class="tuc-value">${escapeHtml(f.value)}</span></p>`
      )
      .join('');

    const bulletsHtml = bullets.length
      ? `<ul class="tuc-list">${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
      : '';
    const freeHtml = free.map((f) => `<p class="tuc-para">${escapeHtml(f)}</p>`).join('');

    return `
<section class="tuc-card">
  <h3 class="tuc-title">${escapeHtml(caseName)}</h3>
  ${fieldsHtml}
  ${bulletsHtml}
  ${freeHtml}
</section>`;
  };

  return `<div class="tuc-doc">${blocks.map((b, i) => renderBlock(b, i)).join('')}</div>`;
};
