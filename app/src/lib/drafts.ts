import { getPref, setPref } from './prefs';

/** Unfinished evaluation answers, kept on this device until the evaluation is submitted. */
export interface Draft {
  step: number;
  ratings: Record<number, number>;
  texts: Record<number, string>;
  comment: string;
  savedAt: string;
}

const key = (id: string | number) => `draft.${id}`;

async function index(): Promise<string[]> {
  return ((await getPref('drafts')) ?? '').split(',').filter(Boolean);
}

export async function getDraft(offeringId: string | number): Promise<Draft | null> {
  try {
    const raw = await getPref(key(offeringId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export async function saveDraft(offeringId: string | number, draft: Omit<Draft, 'savedAt'>): Promise<void> {
  await setPref(key(offeringId), JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
  const ids = await index();
  if (!ids.includes(String(offeringId))) await setPref('drafts', [...ids, String(offeringId)].join(','));
}

export async function clearDraft(offeringId: string | number): Promise<void> {
  await setPref(key(offeringId), '');
  await setPref('drafts', (await index()).filter((i) => i !== String(offeringId)).join(','));
}

/** Offerings that have a saved draft (for the "Draft" chip on the dashboard). */
export const draftIds = index;
