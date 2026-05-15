/**
 * React entry: mounts `<App />` inside `ThemeProvider` so light/dark tokens apply before first paint.
 * Removes the static HTML boot splash (if present) left from `public/index.html` for faster perceived load.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';

document.getElementById('r2d-boot-splash')?.remove();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
