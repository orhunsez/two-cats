/**
 * The cat store (Zustand): holds the *runtime* state of both cats and is the
 * only place allowed to change it. UI components never mutate state directly —
 * they call `send()` and the FSM decides what happens.
 *
 * In Phase 5 this store becomes a mirror of the `cats` table in Supabase:
 * `send()` will write to the database and a realtime subscription will update
 * both phones. The shape below (state + stateStartedAt) is already designed
 * for that — a phone that opens mid-animation can compute the remaining time.
 */

import { create } from 'zustand';

import { transition, type CatEvent, type CatState } from './fsm';
import { STATE_DURATION_MS } from './registry';
import type { CatId } from './types';

interface CatRuntime {
  state: CatState;
  /** Epoch ms when the current state began. */
  stateStartedAt: number;
}

interface CatStore {
  cats: Record<CatId, CatRuntime>;
  /** Try to apply an event to a cat. Returns whether the FSM accepted it. */
  send: (catId: CatId, event: CatEvent) => boolean;
}

// Timer handles live outside the store: they are plumbing, not app state.
const finishTimers: Partial<Record<CatId, ReturnType<typeof setTimeout>>> = {};

export const useCatStore = create<CatStore>()((set, get) => ({
  cats: {
    black: { state: 'idle', stateStartedAt: Date.now() },
    orange: { state: 'idle', stateStartedAt: Date.now() },
  },

  send: (catId, event) => {
    const current = get().cats[catId].state;
    const next = transition(current, event);
    if (next === null) return false; // FSM rejected it (e.g. FEED while sleeping)

    clearTimeout(finishTimers[catId]);
    set((s) => ({
      cats: {
        ...s.cats,
        [catId]: { state: next, stateStartedAt: Date.now() },
      },
    }));

    // Timed states (eating, grooming) end themselves via a FINISH event.
    // FINISH goes through the same FSM, so a stale timer can never corrupt state.
    const duration = STATE_DURATION_MS[next];
    if (duration !== undefined) {
      finishTimers[catId] = setTimeout(() => {
        get().send(catId, 'FINISH');
      }, duration);
    }
    return true;
  },
}));
