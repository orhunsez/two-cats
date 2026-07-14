/**
 * The action registry: everything the UI needs to render cat activities,
 * expressed as data instead of code. This is the "no function soup" rule —
 * a new activity is a new entry here (+ a row in the FSM table + a GIF),
 * and every screen picks it up automatically.
 */

import type { CatEvent, CatState } from './fsm';

export interface CatAction {
  event: CatEvent;
  label: string;
  emoji: string;
  /**
   * States in which the button is rendered. `undefined` = always visible.
   * Note this is presentation only — the FSM is still the one that decides
   * whether the event is *accepted* (pressing Feed on a sleeping cat shows
   * the button, but the cat refuses with a shake).
   */
  visibleIn?: CatState[];
}

export const CAT_ACTIONS: CatAction[] = [
  { event: 'FEED', label: 'Feed', emoji: '🍣', visibleIn: ['idle'] },
  { event: 'GROOM_SELF', label: 'Groom self', emoji: '🪮', visibleIn: ['idle'] },
  { event: 'GROOM_OTHER', label: 'Groom partner', emoji: '💞', visibleIn: ['idle'] },
  { event: 'SLEEP', label: 'Sleep', emoji: '🌙', visibleIn: ['idle'] },
  { event: 'WAKE', label: 'Wake up', emoji: '☀️', visibleIn: ['sleeping'] },
];

/**
 * How long timed states last before the store auto-sends FINISH.
 * States not listed here (idle, sleeping) persist until a user acts.
 * Later these will match each GIF's loop length.
 */
export const STATE_DURATION_MS: Partial<Record<CatState, number>> = {
  eating: 5000,
  grooming_self: 5000,
  grooming_other: 5000,
};

export const STATE_LABEL: Record<CatState, string> = {
  idle: 'is lounging around',
  eating: 'is eating 🍽️',
  grooming_self: 'is grooming itself ✨',
  grooming_other: 'is grooming its partner 💞',
  sleeping: 'is fast asleep 💤',
};

/**
 * Cross-cat choreography, expressed as data (not if/else soup): when one cat
 * successfully does the KEY event, its partner is nudged with the VALUE event.
 * The partner's own FSM still gets the final say — if it isn't idle, the nudge
 * is simply rejected (best-effort, never forced). Reactions never chain: a
 * reaction event is not itself a key here, and the store guards against it too.
 *
 * Add a new bit of "when A does X, B does Y" behavior with one line here.
 */
export const PARTNER_REACTIONS: Partial<Record<CatEvent, CatEvent>> = {
  FEED: 'GROOM_SELF', // one cat eats → the other grooms itself
  GROOM_OTHER: 'SLEEP', // one cat grooms the other → the groomed one falls asleep
};
