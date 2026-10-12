import { create } from 'zustand';
import { getPref, setPref } from './prefs';

export type Lang = 'en' | 'fil';

let current: Lang = 'en';

/** The chosen language. Changing it re-renders every screen (see lib/theme.tsx). */
export const useLang = create<{ lang: Lang; setLang: (l: Lang) => void }>((set) => ({
  lang: 'en',
  setLang: (lang) => {
    current = lang;
    setPref('lang', lang);
    set({ lang });
  },
}));

/** Load the saved language before the first screen renders. */
export async function loadLang(): Promise<void> {
  const saved = await getPref('lang');
  const lang: Lang = saved === 'fil' || saved === 'en' ? saved : deviceLang();
  current = lang;
  useLang.setState({ lang });
}

/** First launch: Filipino when the phone or browser is set to Filipino/Tagalog, else English. */
function deviceLang(): Lang {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    const nav = typeof navigator !== 'undefined' ? (navigator.languages?.[0] ?? navigator.language ?? '') : '';
    return /^(fil|tl)\b/i.test(nav) || /^(fil|tl)\b/i.test(locale) ? 'fil' : 'en';
  } catch {
    return 'en';
  }
}

export const getLang = (): Lang => current;

/**
 * English or Filipino text, written side by side where it is used:
 *   tr('Create account', 'Gumawa ng account')
 */
export function tr(en: string, fil: string): string {
  return current === 'fil' ? fil : en;
}
