/**
 * Sync bootstrap: connects the sync service (catSync.ts) to the store
 * (catStore.ts). Lives in its own module so the dependencies stay a line, not
 * a cycle: store → service, and this file → both.
 *
 * Called once from the root layout. Returns a cleanup function for unmount.
 */

import { fetchRemoteCats, subscribeToRemoteCats } from './catSync';
import { useCatStore } from './catStore';
import { isSyncConfigured } from '@/lib/supabase';

export function startCatSync(): () => void {
  if (!isSyncConfigured) return () => {};

  const { applyRemote, markSynced } = useCatStore.getState();

  // Live updates first, snapshot second — if something changes between the
  // two, the subscription already has it; the reverse order could miss events.
  const unsubscribe = subscribeToRemoteCats((cat) => {
    applyRemote(cat.id, cat.state, cat.stateStartedAt);
  });

  fetchRemoteCats().then((cats) => {
    for (const cat of cats) {
      applyRemote(cat.id, cat.state, cat.stateStartedAt);
    }
    if (cats.length > 0) markSynced();
  });

  return unsubscribe;
}
