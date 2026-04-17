import React from 'react';

export function brandUrl(filename) {
  const base = process.env.PUBLIC_URL ?? '';
  const path = filename.startsWith('/') ? filename : `/${filename}`;
  return `${base}${path}`;
}

/** Icon-first crop: same source art, framed for compact chrome (nav, favicon-style slots). */
export function BrandMark({ className = '', imgClassName, alt = 'Req2Design' }) {
  return (
    <span className={`inline-flex shrink-0 overflow-hidden rounded-lg ${className}`}>
      <img
        src={brandUrl('/req2design-brand-mark.png')}
        alt={alt}
        draggable={false}
        className={imgClassName ?? 'h-full w-full object-contain'}
      />
    </span>
  );
}

/** Backward-compatible full slot: now renders the new icon-only logo. */
export function BrandFull({ className = '', alt = 'Req2Design' }) {
  return (
    <BrandMark className={className} imgClassName="h-full w-full object-contain" alt={alt} />
  );
}
