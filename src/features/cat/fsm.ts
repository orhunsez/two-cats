/**
 * The cat finite-state machine (FSM).
 *
 * This file is deliberately pure TypeScript: no React, no Zustand, no I/O.
 * That makes it trivially unit-testable and reusable — later the same table
 * will validate transitions on the server side (Supabase) too.
 *
 * The entire behavior of a cat is this one table. Adding a new activity
 * (e.g. "play") means adding one state, one event, and one row — no new logic.
 */

export const CAT_STATES = ['idle', 'eating', 'grooming', 'sleeping'] as const;

export type CatState = (typeof CAT_STATES)[number];

export type CatEvent = 'FEED' | 'GROOM' | 'SLEEP' | 'WAKE' | 'FINISH';

type TransitionTable = Record<CatState, Partial<Record<CatEvent, CatState>>>;

const TRANSITIONS: TransitionTable = {
  idle: { FEED: 'eating', GROOM: 'grooming', SLEEP: 'sleeping' },
  eating: { FINISH: 'idle' },
  grooming: { FINISH: 'idle' },
  sleeping: { WAKE: 'idle' },
};

/**
 * Attempt a transition. Returns the next state, or `null` if the event is
 * not allowed in the current state (e.g. FEED while sleeping — the cat
 * refuses, and the UI reacts with a shake instead of changing state).
 */
export function transition(state: CatState, event: CatEvent): CatState | null {
  return TRANSITIONS[state][event] ?? null;
}
