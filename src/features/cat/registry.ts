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
  { event: 'FEED', label: 'Feed', emoji: '🍣' },
  { event: 'GROOM', label: 'Groom', emoji: '🪮' },
  { event: 'SLEEP', label: 'Sleep', emoji: '🌙', visibleIn: ['idle', 'eating', 'grooming'] },
  { event: 'WAKE', label: 'Wake up', emoji: '☀️', visibleIn: ['sleeping'] },
];

/**
 * How long timed states last before the store auto-sends FINISH.
 * States not listed here (idle, sleeping) persist until a user acts.
 * Later these will match each GIF's loop length.
 */
export const STATE_DURATION_MS: Partial<Record<CatState, number>> = {
  eating: 5000,
  grooming: 5000,
};

export const STATE_LABEL: Record<CatState, string> = {
  idle: 'is lounging around',
  eating: 'is eating 🍽️',
  grooming: 'is getting groomed ✨',
  sleeping: 'is fast asleep 💤',
};
