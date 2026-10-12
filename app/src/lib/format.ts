import { tr } from './i18n';
/** Small date helpers. The API sends ISO 8601 dates. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function parts(iso: string) {
  const d = new Date(iso);
  return { day: d.getDate(), month: MONTHS[d.getMonth()], weekday: DAYS[d.getDay()], date: d };
}

export function time(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h.toString().padStart(2, '0')}:${m}${ampm}`;
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate().toString().padStart(2, '0')}, ${d.getFullYear()}`;
}

export function today(): string {
  return shortDate(new Date().toISOString());
}

export function greetingWord(): string {
  const h = new Date().getHours();
  return h < 12 ? tr('Good morning,', 'Magandang umaga,') : h < 18 ? tr('Good afternoon,', 'Magandang hapon,') : tr('Good evening,', 'Magandang gabi,');
}

/** "Day 2 of 3" style progress through an evaluation period. */
export function periodProgress(opensIso: string, closesIso: string) {
  const start = new Date(opensIso).getTime();
  const end = new Date(closesIso).getTime();
  const now = Date.now();
  const totalDays = Math.max(1, Math.ceil((end - start) / 86_400_000));
  const day = Math.min(totalDays, Math.max(0, Math.ceil((now - start) / 86_400_000)));
  return { day, totalDays, ratio: Math.min(1, Math.max(0, (now - start) / (end - start))) };
}

export function firstName(name: string): string {
  return name.replace(/^(prof|dr|mr|ms|mrs|engr)\.?\s+/i, '').split(/\s+/)[0] ?? name;
}

/** ISO date → "2026-10-20 08:00" (local time) for typing into a form. */
export function inputDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** ISO date → "2026-10-20". */
export function inputDate(iso: string | null | undefined): string {
  return iso ? inputDateTime(iso).slice(0, 10) : '';
}

/** "Oct 20, 08:00am" */
export function dateTime(iso: string): string {
  return `${shortDate(iso)}, ${time(iso)}`;
}

/** "5 minutes ago", "3 hours ago", or a date. */
export function ago(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return tr('just now', 'ngayon lang');
  if (mins < 60) return tr(`${mins} min ago`, `${mins} min ang nakalipas`);
  const hours = Math.round(mins / 60);
  if (hours < 24) return tr(`${hours} h ago`, `${hours} oras ang nakalipas`);
  const days = Math.round(hours / 24);
  if (days < 7) return tr(`${days} d ago`, `${days} araw ang nakalipas`);
  return shortDate(iso);
}
