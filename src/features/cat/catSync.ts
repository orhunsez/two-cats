/**
 * The cat sync service: every Supabase call for the cat feature lives here.
 * Pure service functions — no store import, no React. The store calls
 * `pushCatState`; the bootstrap (initSync.ts) pipes fetch/subscribe results
 * back INTO the store. Keeping the dependency one-directional (store → service,
 * bootstrap → both) avoids an import cycle.
 *
 * Server-authoritative detail: we only ever send `state`. The server's trigger
 * (supabase/schema.sql) stamps `state_started_at` itself, so two phones with
 * drifting clocks can never disagree about when a state began.
 */

import { supabase } from '@/lib/supabase';
import { CAT_STATES, type CatState } from './fsm';
import type { CatId } from './types';

export interface RemoteCat {
  id: CatId;
  state: CatState;
  /** Epoch ms, parsed from the server's timestamptz. */
  stateStartedAt: number;
}

/** Narrow an untrusted DB row into a RemoteCat, or null if it's malformed. */
function parseRow(row: unknown): RemoteCat | null {
  const r = row as { id?: string; state?: string; state_started_at?: string };
  if (r.id !== 'black' && r.id !== 'orange') return null;
  if (!CAT_STATES.includes(r.state as CatState)) return null;
  const startedAt = Date.parse(r.state_started_at ?? '');
  if (Number.isNaN(startedAt)) return null;
  return { id: r.id, state: r.state as CatState, stateStartedAt: startedAt };
}

/** One-shot snapshot of both cats (app start). */
export async function fetchRemoteCats(): Promise<RemoteCat[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('cats').select('*');
  if (error) {
    console.warn('[catSync] fetch failed:', error.message);
    return [];
  }
  return (data ?? []).map(parseRow).filter((c): c is RemoteCat => c !== null);
}

/**
 * Fire-and-forget write of a cat's new state. The realtime echo (including to
 * this same phone) carries the server-stamped timestamp back.
 */
export function pushCatState(catId: CatId, state: CatState): void {
  if (!supabase) return;
  supabase
    .from('cats')
    .update({ state })
    .eq('id', catId)
    .then(({ error }) => {
      if (error) console.warn('[catSync] push failed:', error.message);
    });
}

/** Subscribe to every cats-table update. Returns an unsubscribe function. */
export function subscribeToRemoteCats(onChange: (cat: RemoteCat) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('cats-sync')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'cats' },
      (payload) => {
        const cat = parseRow(payload.new);
        if (cat) onChange(cat);
      },
    )
    .subscribe();
  return () => {
    channel.unsubscribe();
  };
}
