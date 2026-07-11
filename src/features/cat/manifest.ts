/**
 * The art manifest: maps every (cat, state) pair to its looping GIF.
 *
 * Workflow for adding art:
 *   1. Drop the file into assets/cats/ named `<cat>_<state>.gif`
 *      (e.g. black_eating.gif) — 512×512, first frame ≈ last frame.
 *   2. Replace the `null` below with `require('@/assets/cats/black_eating.gif')`.
 *
 * `null` means "art not made yet" and CatSprite renders the emoji fallback,
 * so the app is fully playable before any art exists.
 */

import type { CatState } from './fsm';
import type { CatId } from './types';

// require() returns a number (an asset ID) in React Native.
type GifSource = number | null;

export const CAT_GIFS: Record<CatId, Record<CatState, GifSource>> = {
  black: {
    idle: null,
    eating: null,
    grooming: null,
    sleeping: null,
  },
  orange: {
    idle: null,
    eating: null,
    grooming: null,
    sleeping: null,
  },
};

export const FALLBACK_EMOJI: Record<CatId, Record<CatState, string>> = {
  black: {
    idle: '🐈‍⬛',
    eating: '🐈‍⬛ 🍣',
    grooming: '🐈‍⬛ 🫧',
    sleeping: '🐈‍⬛ 💤',
  },
  orange: {
    idle: '🐈',
    eating: '🐈 🍣',
    grooming: '🐈 🫧',
    sleeping: '🐈 💤',
  },
};
