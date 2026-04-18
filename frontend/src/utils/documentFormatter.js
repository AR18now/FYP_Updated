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
 * Remove IEEE-style References blocks from plain-text SRS (aligned with backend strip_srs_references_section).
 */
const stripSrsReferencesSection = (value = '') => {
  const lines = String(value || '').split('\n');
  const out = [];
  let skipUntilBreak = false;

  const isSectionBreak = (stripped) => {
    if (!stripped) return false;
    if (/^(INTRODUCTION|OVERALL DESCRIPTION|SPECIFIC REQUIREMENTS|SYSTEM FEATURES)\b/i.test(stripped))
      return true;
    if (/^\d+(?:\.\d+)*\s+(?!References\b)[A-Z]/.test(stripped)) return true;
    if (
      /^(Purpose|Scope|Definitions\/Acronyms|Definitions|Acronyms|Overview|Product Perspective|Product Functions|User Characteristics|Constraints|Assumptions\/Dependencies|External Interface Requirements|Functional Requirements|Non-functional Requirements|System Features)\s*:/i.test(
        stripped
      )
    )
      return true;
    if (/^\d+\.\d+\s*:\s*(?!References\b)/i.test(stripped)) return true;
    return false;
  };

  for (const line of lines) {
    const stripped = line.trim();
    if (skipUntilBreak) {
      if (isSectionBreak(stripped)) {
        skipUntilBreak = false;
        out.push(line);
      }
      continue;
    }
    if (/^\d+(?:\.\d+)*(?:\s*:\s*|\.\s+|\s+)References\b/i.test(stripped)) continue;
    if (/^References\s*:/i.test(stripped)) {
      const rest = stripped.replace(/^References\s*:\s*/i, '').trim();
      if (!rest) skipUntilBreak = true;
      continue;
    }
    out.push(line);
  }
  return out.join('\n').trim();
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

const TEXTUAL_UC_APPENDIX_START = '<<<TEXTUAL_USE_CASES_APPENDIX>>>';
const TEXTUAL_UC_APPENDIX_END = '<<<END_TEXTUAL_USE_CASES_APPENDIX>>>';

/**
 * Canonical SRS body for UI: layout cleanup, trim to INTRODUCTION … End of Document.
 * Preserves the model textual-use-case appendix after "End of Document." when delimiters are present.
 */
export const normalizeSrsDocumentBody = (rawText = '') => {
  let work = polishClosingText(
    normalizeSrsLayout(stripSrsReferencesSection(String(rawText || '')))
  );
  work = work.replace(
    /^\s*(?:Software Requirements Specification\s*\(SRS\)[^\n]*\n+)?(?:Author\s*:[^\n]*\n+)?(?:Date\s*:[^\n]*\n+)?\s*/i,
    ''
  );
  work = work.replace(/^\s*-{3,}\s*\n+/, '');
  work = work.trim();

  let appendix = '';
  const apx0 = work.indexOf(TEXTUAL_UC_APPENDIX_START);
  if (apx0 >= 0) {
    const apx1 = work.indexOf(TEXTUAL_UC_APPENDIX_END, apx0 + TEXTUAL_UC_APPENDIX_START.length);
    if (apx1 >= 0) {
      appendix = work.slice(apx0, apx1 + TEXTUAL_UC_APPENDIX_END.length).trim();
      work = `${work.slice(0, apx0).trimEnd()}\n${work.slice(apx1 + TEXTUAL_UC_APPENDIX_END.length).trimStart()}`.trim();
    } else {
      appendix = work.slice(apx0).trim();
      work = work.slice(0, apx0).trimEnd();
    }
  }

  let normalized = work
    .split('\n')
    .filter((line) => !(/End\s+with\s*:/i.test(line) && /End\s+of\s+Document/i.test(line)))
    .join('\n');

  const firstIntroIdx = normalized.search(/(^|\n)\s*INTRODUCTION\s*(\n|$)/i);
  if (firstIntroIdx >= 0) {
    normalized = normalized.slice(firstIntroIdx).trim();
  }
  let endCut = -1;
  const endRe = /\bEnd of Document\./gi;
  let em;
  while ((em = endRe.exec(normalized)) !== null) {
    endCut = em.index + em[0].length;
  }
  if (endCut >= 0) {
    normalized = normalized.slice(0, endCut).trim();
  }
  if (appendix) {
    normalized = `${normalized.trimEnd()}\n\n${appendix}`;
  }
  return normalized;
};

const SECTION_LABELS = {
  INTRODUCTION: 'Introduction',
  'OVERALL DESCRIPTION': 'Overall description',
  'SPECIFIC REQUIREMENTS': 'Specific requirements',
  'SYSTEM FEATURES': 'System features',
};

const MAJOR_SECTION_LINE =
  /^(?:\d+\.\s*)?(INTRODUCTION|OVERALL DESCRIPTION|SPECIFIC REQUIREMENTS|SYSTEM FEATURES)\s*$/i;

/**
 * Split SRS into top-level IEEE sections for card navigation. Falls back to one block if headings missing.
 * @returns {{ sections: Array<{ id: string, title: string, html: string }>, fullHtml: string }}
 */
export const buildSrsMajorSectionCards = (rawText = '') => {
  const fullHtml = formatSrsToHtml(rawText, { assignIds: true });
  const normalized = normalizeSrsDocumentBody(rawText);
  if (!normalized.trim()) {
    return { sections: [], fullHtml };
  }
  const lines = normalized.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].trim();
    const m = t.match(MAJOR_SECTION_LINE);
    if (m) {
      const key = m[1].toUpperCase();
      hits.push({
        line: i,
        id: key.toLowerCase().replace(/\s+/g, '-'),
        title: SECTION_LABELS[key] || m[1].replace(/\b\w/g, (c) => c.toUpperCase()),
      });
    }
  }
  if (hits.length === 0) {
    return {
      sections: [{ id: 'full', title: 'Document', html: fullHtml }],
      fullHtml,
    };
  }
  const sections = hits.map((h, idx) => {
    const start = h.line;
    const end = idx + 1 < hits.length ? hits[idx + 1].line : lines.length;
    const chunk = lines.slice(start, end).join('\n');
    return {
      id: h.id,
      title: h.title,
      html: formatSrsToHtml(chunk, { assignIds: true }),
    };
  });
  return { sections, fullHtml };
};

/**
 * @param {string} rawText
 * @param {{ assignIds?: boolean }} options — paragraph ids for "jump to check" in SRS viewer
 */
export const formatSrsToHtml = (rawText = '', options = {}) => {
  const assignIds = options.assignIds === true;
  const text = normalizeSrsDocumentBody(rawText);
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
    // New Cockburn-style row "Use Case: FR-01 - …" starts its own card (appendix often omits blank lines between FRs).
    if (
      /^Use Case\s*:/i.test(trimmed) &&
      !/^Use Case Name\s*:/i.test(trimmed) &&
      current.length
    ) {
      pushCurrent();
    }
    current.push(trimmed);
  }
  pushCurrent();

  if (!blocks.length) return `<p class="tuc-empty">${escapeHtml(source)}</p>`;

  const renderBlock = (block, idx) => {
    let caseName = `Use Case ${idx + 1}`;
    let namedByUseCaseName = false;
    /** @type {{type:'kv',key:string,value:string}|{type:'ul',items:string[]}|{type:'ol',items:string[]}|{type:'para',text:string}}[]} */
    const segments = [];

    const pushPara = (text) => {
      const t = String(text || '').trim();
      if (!t) return;
      segments.push({ type: 'para', text: t });
    };

    for (const line of block) {
      const raw = String(line || '').trim();
      if (!raw) continue;

      // Numbered steps (Cockburn main success / extensions) — not "Key: value" lines
      if (/^\d+\.\s+\S/.test(raw)) {
        const stepText = raw.replace(/^\d+\.\s+/, '').trim();
        const prev = segments[segments.length - 1];
        if (prev && prev.type === 'ol') {
          prev.items.push(stepText);
        } else {
          segments.push({ type: 'ol', items: [stepText] });
        }
        continue;
      }

      if (/^[-*]\s+/.test(raw)) {
        const item = raw.replace(/^[-*]\s+/, '').trim();
        const prev = segments[segments.length - 1];
        if (prev && prev.type === 'ul') {
          prev.items.push(item);
        } else {
          segments.push({ type: 'ul', items: [item] });
        }
        continue;
      }

      // Label: value OR section heading with nothing on the same line (.* allows empty)
      const kv = raw.match(/^([^:]+?)\s*:\s*(.*)$/);
      if (kv) {
        const key = kv[1].trim();
        const value = kv[2].trim();
        if (key.length < 2) {
          pushPara(raw);
          continue;
        }
        if (/^use case name$/i.test(key)) {
          caseName = value || caseName;
          namedByUseCaseName = true;
          continue;
        }
        // Title from "Use Case: FR-01 - …" when there is no separate Use Case Name (avoids duplicating the heading in the body).
        if (/^use case$/i.test(key) && value) {
          if (!namedByUseCaseName) {
            caseName = value;
            continue;
          }
        }
        segments.push({ type: 'kv', key, value });
        continue;
      }

      pushPara(raw);
    }

    const knownSectionLine = (t) =>
      /^(Main Success Scenario|Extensions|Alternate Flows?|Special Requirements?|Preconditions|Postconditions|Scope|Stakeholders|Primary Actor)\b/i.test(
        t
      );

    const segmentsHtml = segments
      .map((seg) => {
        if (seg.type === 'kv') {
          const hasVal = Boolean(seg.value && seg.value.trim());
          const sectionClass = !hasVal ? ' tuc-row--section' : '';
          const valHtml = hasVal
            ? ` <span class="tuc-value">${escapeHtml(seg.value)}</span>`
            : '';
          return `<p class="tuc-row${sectionClass}"><span class="tuc-key">${escapeHtml(seg.key)}:</span>${valHtml}</p>`;
        }
        if (seg.type === 'ul') {
          return `<ul class="tuc-list">${seg.items.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`;
        }
        if (seg.type === 'ol') {
          return `<ol class="tuc-ol">${seg.items.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ol>`;
        }
        const t = seg.text;
        if (knownSectionLine(t) && !t.includes(':')) {
          return `<p class="tuc-row tuc-row--section"><span class="tuc-key">${escapeHtml(t)}</span></p>`;
        }
        return `<p class="tuc-para">${escapeHtml(t)}</p>`;
      })
      .join('');

    return `
<section class="tuc-card">
  <h3 class="tuc-title">${escapeHtml(caseName)}</h3>
  ${segmentsHtml}
</section>`;
  };

  return `<div class="tuc-doc">${blocks.map((b, i) => renderBlock(b, i)).join('')}</div>`;
};
