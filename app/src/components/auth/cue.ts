import { create } from 'zustand';
import { tr } from '@/lib/i18n';
import type { Mood } from '../WiseMascot';

/** What Professor Wise says and does while someone fills in a sign-in or sign-up form. */
export type Cue = { mood: Mood; line: string } | null;

export const useCue = create<{ cue: Cue; set: (c: Cue) => void }>((set) => ({ cue: null, set: (cue) => set({ cue }) }));

export const cue = (c: Cue) => useCue.getState().set(c);

/** Ready-made lines (functions, so they follow the chosen language). */
export const CUES = {
  name: (): Cue => ({ mood: 'writing', line: tr('Nice to meet you! Type your name **as it is on your ID**.', 'Ikinagagalak kitang makilala! I-type ang pangalan mo **gaya ng nasa ID**.') }),
  id: (): Cue => ({ mood: 'think', line: tr('Your **student ID** is on your school ID card.', 'Nasa school ID card mo ang **student ID** mo.') }),
  idFound: (name?: string | null): Cue => ({ mood: 'proud', line: name ? tr(`Found you, **${name}**!`, `Nahanap kita, **${name}**!`) : tr('That ID **checks out**. Nice!', '**Ayos** ang ID na iyan!') }),
  username: (): Cue => ({ mood: 'wink', line: tr('Pick a **username** you’ll remember.', 'Pumili ng **username** na madali mong maaalala.') }),
  usernameTaken: (): Cue => ({ mood: 'worried', line: tr('Someone has that one. **Tap a suggestion** below!', 'May gumagamit na niyan. **Pumili ng suggestion** sa ibaba!') }),
  password: (): Cue => ({ mood: 'shy', line: tr('Go ahead, **I’m not looking**!', 'Sige lang, **hindi ako tumitingin**!') }),
  section: (): Cue => ({ mood: 'think', line: tr('Which **section** are you in?', 'Anong **section** mo?') }),
  privacy: (): Cue => ({ mood: 'teach', line: tr('Your answers stay **anonymous**. Read the notice if you like.', 'Mananatiling **anonymous** ang mga sagot mo. Basahin ang notice kung gusto mo.') }),
  busy: (): Cue => ({ mood: 'working', line: tr('One moment, **checking**…', 'Sandali lang, **sinusuri ko**…') }),
  error: (): Cue => ({ mood: 'surprised', line: tr('Oops! Please **check the fields** in red.', 'Naku! Pakitingnan ang **mga field na pula**.') }),
  done: (): Cue => ({ mood: 'party', line: tr('**Welcome** to TeachWise!', '**Maligayang pagdating** sa TeachWise!') }),
  wrong: (left?: number): Cue => ({
    mood: 'worried',
    line: left !== undefined && left <= 2
      ? tr(`Careful, only **${left} ${left === 1 ? 'try' : 'tries'} left**.`, `Ingat, **${left} subok na lang**.`)
      : tr('Hmm, that **didn’t work**. Check your details and try again.', 'Hmm, **hindi gumana**. I-check ang detalye at subukan ulit.'),
  }),
  locked: (): Cue => ({ mood: 'stern', line: tr('Let’s take a **short break**. You can also ask for a new password.', 'Magpahinga muna **saglit**. Puwede ka ring humingi ng bagong password.') }),
};
