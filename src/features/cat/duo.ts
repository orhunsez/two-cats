/**
 * Duo scenes: the single shared frame the app always shows. The cats are never
 * rendered alone — whatever each one is doing, they do it together on one
 * windowsill, and the scene is the COMBINATION of both their states.
 *
 * A scene is DERIVED from the two cats' FSM states by a pure function — never
 * stored. Storing "snuggling" would be a second source of truth that could
 * drift from what the cats are actually doing. Deriving it means the scene is
 * always correct by construction, and Phase 5's server sync gets it for free.
 *
 * Combinatorial reality: two cats × 5 states = 25 possible pairings, and we
 * only have art for a handful. `getDuoScene` matches the combos we have art
 * for (most-specific first) and falls back to `apart` (emoji) for the rest —
 * add art for a new combo by adding one scene + one resolver line.
 */

import type { CatState } from './fsm';
import { CAT_PROFILES } from './types';

export const DUO_SCENES = [
  'snuggling',
  'dreaming',
  'eating_together',
  'lingering_black',
  'lingering_orange',
  'black_grooms_self_orange_sleeps',
  'black_grooms_self_orange_idle',
  'orange_grooms_self_black_sleeps',
  'orange_grooms_self_black_idle',
  'black_grooms_other',
  'orange_grooms_other',
  'black_eats_orange_grooms',
  'orange_eats_black_grooms',
  'black_eats_orange_sleeps',
  'orange_eats_black_sleeps',
  'apart',
] as const;

export type DuoSceneId = (typeof DUO_SCENES)[number];

const luna = CAT_PROFILES.black.displayName;
const mango = CAT_PROFILES.orange.displayName;

export interface DuoSceneInfo {
  /** Caption under the scene art. */
  label: string;
  /** Placeholder shown when the scene has no art yet (DUO_GIFS entry is null). */
  emoji: string;
}

export const DUO_SCENE_INFO: Record<DuoSceneId, DuoSceneInfo> = {
  snuggling: { label: `${luna} and ${mango} are playing together`, emoji: '🐈‍⬛💕🐈' },
  dreaming: { label: 'both cats are fast asleep', emoji: '🐈‍⬛💤🐈💤' },
  lingering_black: { label: `${luna} lingers by sleeping ${mango}`, emoji: '🐈‍⬛ 🐈💤' },
  lingering_orange: { label: `${mango} lingers by sleeping ${luna}`, emoji: '🐈‍⬛💤 🐈' },
  black_grooms_self_orange_sleeps: { label: `${luna} grooms herself as ${mango} sleeps`, emoji: '🐈‍⬛✨ 🐈💤' },
  black_grooms_self_orange_idle: { label: `${luna} is grooming herself`, emoji: '🐈‍⬛✨ 🐈' },
  orange_grooms_self_black_sleeps: { label: `${mango} grooms himself as ${luna} sleeps`, emoji: '🐈‍⬛💤 🐈✨' },
  orange_grooms_self_black_idle: { label: `${mango} is grooming himself`, emoji: '🐈‍⬛ 🐈✨' },
  black_grooms_other: { label: `${luna} is grooming ${mango}`, emoji: '🐈‍⬛💞🐈' },
  orange_grooms_other: { label: `${mango} is grooming ${luna}`, emoji: '🐈‍⬛💞🐈' },
  eating_together: { label: `${luna} and ${mango} share dinner`, emoji: '🐈‍⬛🍽️🐈' },
  black_eats_orange_grooms: { label: `${luna} eats while ${mango} grooms`, emoji: '🐈‍⬛🍽️ 🐈✨' },
  orange_eats_black_grooms: { label: `${mango} eats while ${luna} grooms`, emoji: '🐈‍⬛✨ 🐈🍽️' },
  black_eats_orange_sleeps: { label: `${luna} snacks while ${mango} sleeps`, emoji: '🐈‍⬛🍽️ 🐈💤' },
  orange_eats_black_sleeps: { label: `${mango} snacks while ${luna} sleeps`, emoji: '🐈‍⬛💤 🐈🍽️' },
  apart: { label: 'the cats are doing their own thing', emoji: '🐈‍⬛ · 🐈' },
};

/**
 * Every image we have depicts one exact (black, orange) state pairing, so the
 * resolver is a plain lookup table keyed by `${black}|${orange}` (the `|`
 * separator avoids ambiguity with the underscores inside state names). Data,
 * not branches — a new scene is one more row here + one row in DUO_GIFS.
 */
const SCENE_BY_PAIR: Record<string, DuoSceneId> = {
  'idle|idle': 'snuggling',
  'sleeping|sleeping': 'dreaming',
  'idle|sleeping': 'lingering_black',
  'sleeping|idle': 'lingering_orange',
  'grooming_self|sleeping': 'black_grooms_self_orange_sleeps',
  'grooming_self|idle': 'black_grooms_self_orange_idle',
  'sleeping|grooming_self': 'orange_grooms_self_black_sleeps',
  'idle|grooming_self': 'orange_grooms_self_black_idle',
  'eating|eating': 'eating_together',
  'eating|grooming_self': 'black_eats_orange_grooms',
  'grooming_self|eating': 'orange_eats_black_grooms',
  'eating|sleeping': 'black_eats_orange_sleeps',
  'sleeping|eating': 'orange_eats_black_sleeps',
  'grooming_other|sleeping': 'black_grooms_other',
  'sleeping|grooming_other': 'orange_grooms_other',
};

/**
 * The pure resolver: two cat states in, one scene out. `black` is Luna,
 * `orange` is Mango. Exact-pair lookup first; then a fallback so that "one cat
 * grooms the other" always shows (it dominates the frame regardless of what the
 * partner is technically doing). Anything else → `apart` (emoji).
 */
export function getDuoScene(black: CatState, orange: CatState): DuoSceneId {
  const exact = SCENE_BY_PAIR[`${black}|${orange}`];
  if (exact) return exact;

  if (black === 'grooming_other') return 'black_grooms_other';
  if (orange === 'grooming_other') return 'orange_grooms_other';

  return 'apart';
}
