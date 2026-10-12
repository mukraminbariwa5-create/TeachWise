import { Sticker, type StickerName } from './Sticker';

/** What Professor Wise is doing. Each mood is one of his stickers. */
export type Mood =
  | 'hello'
  | 'happy'
  | 'proud'
  | 'think'
  | 'cheer'
  | 'party'
  | 'point'
  | 'teach'
  | 'lecture'
  | 'idea'
  | 'wink'
  | 'please'
  | 'surprised'
  | 'worried'
  | 'sad'
  | 'stern'
  | 'shy'
  | 'writing'
  | 'working';

const POSE: Record<Mood, StickerName> = {
  hello: 'wave',
  happy: 'book',
  proud: 'book',
  think: 'think',
  cheer: 'cheer',
  party: 'celebrate',
  point: 'wink',
  teach: 'teach',
  lecture: 'point-stick',
  idea: 'idea',
  wink: 'wink',
  please: 'please',
  surprised: 'surprised',
  worried: 'worried',
  sad: 'sad',
  stern: 'stern',
  shy: 'back',
  writing: 'clipboard',
  working: 'laptop',
};

const ACCENT: Partial<Record<Mood, 'wiggle' | 'bounce'>> = {
  hello: 'wiggle',
  cheer: 'bounce',
  party: 'bounce',
  surprised: 'bounce',
  idea: 'bounce',
  please: 'wiggle',
};

/**
 * Professor Wise, the TeachWise guide. `size` is his height in px.
 * He floats gently and pops into each new pose (waves on hello, bounces when celebrating).
 */
export function WiseMascot({ size = 120, mood = 'happy', float = true, shadow = true }: { size?: number; mood?: Mood; float?: boolean; shadow?: boolean }) {
  return <Sticker name={POSE[mood]} size={size} float={float} accent={ACCENT[mood] ?? null} shadow={shadow} />;
}

export type HeadMood = 'grin' | 'laugh' | 'wink' | 'ask' | 'shock' | 'squint' | 'tired' | 'neutral' | 'angry';

/** Just his head, for chat avatars and small spots. `size` is the height in px. */
export function WiseHead({ size = 40, mood = 'grin', pop = false }: { size?: number; mood?: HeadMood; pop?: boolean }) {
  return <Sticker name={`h-${mood}` as StickerName} size={size} pop={pop} />;
}
