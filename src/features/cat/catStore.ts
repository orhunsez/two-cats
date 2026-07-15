/**
 * The cat store (Zustand): holds the *runtime* state of both cats and is the
 * only place allowed to change it. UI components never mutate state directly —
 * they call `send()` and the FSM decides what happens.
 *
 * With sync configured (see lib/supabase.ts) the store is a mirror of the
 * `cats` table: `send()` applies the change locally right away (optimistic —
 * the UI never waits on the network) AND pushes it to the server; the realtime
 * echo then calls `applyRemote()` on every phone — including this one, which
 * is how the server-stamped timestamp replaces our optimistic local one.
 * Without config, `pushCatState` is a no-op and everything runs local-only.
 */

import { create } from 'zustand';

import { pushCatState } from './catSync';
import { transition, type CatEvent, type CatState } from './fsm';
import { PARTNER_REACTIONS, STATE_DURATION_MS } from './registry';
import { partnerOf, type CatId } from './types';

interface CatRuntime {
  state: CatState;
  /** Epoch ms when the current state began. */
  stateStartedAt: number;
}

interface CatStore {
  cats: Record<CatId, CatRuntime>;
  /** True once the first server snapshot has been applied (see initSync.ts). */
  synced: boolean;
  /**
   * Try to apply an event to a cat. Returns whether the FSM accepted it.
   * `isReaction` is internal: it marks a partner reaction so reactions can't
   * chain (see PARTNER_REACTIONS). External callers pass just (catId, event).
   */
  send: (catId: CatId, event: CatEvent, isReaction?: boolean) => boolean;
  /**
   * Overwrite one cat from the server. Bypasses the FSM on purpose — the
   * server is the authority, and this phone may have missed intermediate
   * transitions while backgrounded. Never triggers reactions or pushes
   * (the acting phone already did both); only reschedules the local timer.
   */
  applyRemote: (catId: CatId, state: CatState, stateStartedAt: number) => void;
  markSynced: () => void;
}

// Timer handles live outside the store: they are plumbing, not app state.
const finishTimers: Partial<Record<CatId, ReturnType<typeof setTimeout>>> = {};

export const useCatStore = create<CatStore>()((set, get) => ({
  cats: {
    black: { state: 'idle', stateStartedAt: Date.now() },
    orange: { state: 'idle', stateStartedAt: Date.now() },
  },
  synced: false,

  send: (catId, event, isReaction = false) => {
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

    // Mirror the accepted transition to the server (no-op when unconfigured).
    // Only `state` goes over the wire — the server stamps the timestamp.
    pushCatState(catId, next);

    // Timed states (eating, grooming) end themselves via a FINISH event.
    // FINISH goes through the same FSM, so a stale timer can never corrupt state.
    const duration = STATE_DURATION_MS[next];
    if (duration !== undefined) {
      finishTimers[catId] = setTimeout(() => {
        get().send(catId, 'FINISH');
      }, duration);
    }

    // Cross-cat choreography: this cat's action may nudge its partner (e.g. one
    // eats → the other grooms itself). Only real user actions trigger reactions,
    // never reactions themselves, so the chain is at most one hop deep.
    if (!isReaction) {
      const reaction = PARTNER_REACTIONS[event];
      if (reaction) {
        get().send(partnerOf(catId), reaction, true);
      }
    }
    return true;
  },

  applyRemote: (catId, state, stateStartedAt) => {
    clearTimeout(finishTimers[catId]);
    set((s) => ({
      cats: {
        ...s.cats,
        [catId]: { state, stateStartedAt },
      },
    }));

    // A timed state that started `elapsed` ms ago only has the remainder left.
    // Every phone schedules this; whoever fires first wins and the other's
    // FINISH is rejected by the FSM (already idle) — harmless by construction.
    const duration = STATE_DURATION_MS[state];
    if (duration !== undefined) {
      const remaining = Math.max(0, duration - (Date.now() - stateStartedAt));
      finishTimers[catId] = setTimeout(() => {
        get().send(catId, 'FINISH');
      }, remaining);
    }
  },

  markSynced: () => set({ synced: true }),
}));
