import React from 'react';
import { Github, Twitter, Linkedin } from 'lucide-react';

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-16 border-t"
      style={{
        borderColor: 'var(--card-border)',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
      role="contentinfo"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm">
          <div className="flex items-center space-x-4 text-slate-500" style={{ color: 'var(--muted)' }}>
            <a
              href="#"
              className="hover:text-slate-700 transition-colors"
              aria-label="Twitter"
              style={{ color: 'var(--muted)' }}
            >
              <Twitter className="h-5 w-5" aria-hidden="true" />
            </a>
            <a
              href="#"
              className="hover:text-slate-700 transition-colors"
              aria-label="LinkedIn"
              style={{ color: 'var(--muted)' }}
            >
              <Linkedin className="h-5 w-5" aria-hidden="true" />
            </a>
            <a
              href="#"
              className="hover:text-slate-700 transition-colors"
              aria-label="GitHub"
              style={{ color: 'var(--muted)' }}
            >
              <Github className="h-5 w-5" aria-hidden="true" />
            </a>
          </div>

          <div className="text-center md:text-right space-y-1">
            <div className="font-medium">
              Copyright © {year} Req2Design • Final Year Project - FAST NUCES
            </div>
            <div className="space-x-2 text-slate-500" style={{ color: 'var(--muted)' }}>
              <a href="#" className="hover:text-slate-700 transition-colors">Privacy Policy</a>
              <span>•</span>
              <a href="#" className="hover:text-slate-700 transition-colors">Legal Terms</a>
              <span>•</span>
              <a href="#" className="hover:text-slate-700 transition-colors">Cookies Policy</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;