import { Platform } from 'react-native';

/**
 * Makes the web app installable ("Install TeachWise" in Chrome/Edge) with its own icon and window,
 * and caches the app shell so it opens quickly. Only in the published web build.
 */
export function setupPwa() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  // Print: hide buttons marked data-noprint and keep colours.
  const style = document.getElementById('tw-web-styles') ?? document.createElement('style');
  style.id = 'tw-web-styles';
  style.textContent = [
    '@media print { html, body, #root { height: auto !important; overflow: visible !important; } body:has([data-print-root]) #root div:has([data-print-root]), [data-print-root] { height: auto !important; max-height: none !important; min-height: 0 !important; flex: none !important; overflow: visible !important; } }',
    '@media print { @page { margin: 14mm; } [data-report-section] { break-inside: avoid; page-break-inside: avoid; } [data-noprint] { display: none !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }',
    // One soft focus treatment around the complete field, not a second rectangle around its text.
    'input, textarea { outline: none !important; }',
    // PasswordField provides its own accessible visibility button.
    'input[type="password"]::-ms-reveal, input[type="password"]::-ms-clear { display: none; }',
    'input:focus, textarea:focus, [data-input-frame]:focus-within { box-shadow: 0 0 0 3px rgba(116,118,253,0.13); }',
    '[data-input-frame] input:focus, [data-input-frame] textarea:focus { box-shadow: none; }',
    'html[data-tw-input-modality="keyboard"] input:focus-visible, html[data-tw-input-modality="keyboard"] textarea:focus-visible { outline: 2px solid #7476FD !important; outline-offset: 3px; border-radius: 6px; }',
    'html[data-tw-input-modality="keyboard"] [data-input-frame]:has(input:focus-visible, textarea:focus-visible) { outline: 2px solid #7476FD; outline-offset: 3px; }',
    'html[data-tw-input-modality="keyboard"] [data-input-frame] input:focus-visible, html[data-tw-input-modality="keyboard"] [data-input-frame] textarea:focus-visible { outline: none !important; }',
    '@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }',
    // Keep a clear ring for keyboard users on buttons and links.
    '[role="button"]:focus-visible, [role="link"]:focus-visible, [role="tab"]:focus-visible, [role="menuitem"]:focus-visible, [role="radio"]:focus-visible, [role="switch"]:focus-visible, [role="checkbox"]:focus-visible { outline: 2px solid #7476FD; outline-offset: 2px; }',
    '[role="button"]:focus:not(:focus-visible), [role="link"]:focus:not(:focus-visible) { outline: none; }',
    // Thin scrollbars in the TeachWise periwinkle instead of the grey browser default.
    '* { scrollbar-width: thin; scrollbar-color: rgba(116,118,253,0.45) transparent; }',
    '::-webkit-scrollbar { width: 8px; height: 8px; }',
    '::-webkit-scrollbar-track { background: transparent; }',
    '::-webkit-scrollbar-thumb { background: rgba(116,118,253,0.45); border-radius: 8px; }',
    '::-webkit-scrollbar-thumb:hover { background: rgba(116,118,253,0.7); }',
  ].join('\n');
  document.head.appendChild(style);
  if (!document.documentElement.dataset.twFocusTracking) {
    document.documentElement.dataset.twFocusTracking = '1';
    document.documentElement.dataset.twInputModality = 'pointer';
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') document.documentElement.dataset.twInputModality = 'keyboard';
    });
    document.addEventListener('pointerdown', () => { document.documentElement.dataset.twInputModality = 'pointer'; });
  }
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
