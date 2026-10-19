import { Platform } from 'react-native';

/**
 * Makes the web app installable ("Install TeachWise" in Chrome/Edge) with its own icon and window,
 * and caches the app shell so it opens quickly. Only in the published web build.
 */
export function setupPwa() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  // Print: hide buttons marked data-noprint and keep colours.
  const style = document.createElement('style');
  style.textContent = [
    '@media print { [data-noprint] { display: none !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }',
    // Text fields draw their own rounded border when focused, so drop the browser's square outline.
    'input, textarea { outline: none !important; }',
    // Keep a clear ring for keyboard users on buttons and links.
    '[role="button"]:focus-visible, [role="link"]:focus-visible, [role="tab"]:focus-visible, [role="menuitem"]:focus-visible, [role="radio"]:focus-visible { outline: 2px solid #7476FD; outline-offset: 2px; }',
    '[role="button"]:focus:not(:focus-visible), [role="link"]:focus:not(:focus-visible) { outline: none; }',
    // Thin scrollbars in the TeachWise periwinkle instead of the grey browser default.
    '* { scrollbar-width: thin; scrollbar-color: rgba(116,118,253,0.45) transparent; }',
    '::-webkit-scrollbar { width: 8px; height: 8px; }',
    '::-webkit-scrollbar-track { background: transparent; }',
    '::-webkit-scrollbar-thumb { background: rgba(116,118,253,0.45); border-radius: 8px; }',
    '::-webkit-scrollbar-thumb:hover { background: rgba(116,118,253,0.7); }',
  ].join('\n');
  document.head.appendChild(style);
  if (__DEV__) return;
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.json';
    document.head.appendChild(link);
  }
  const meta = (name: string, content: string) => {
    if (document.querySelector(`meta[name="${name}"]`)) return;
    const m = document.createElement('meta');
    m.name = name;
    m.content = content;
    document.head.appendChild(m);
  };
  meta('theme-color', '#0B0B6E');
  meta('apple-mobile-web-app-capable', 'yes');
  meta('description', 'TeachWise: anonymous teacher evaluations with Professor Wise.');
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
}
