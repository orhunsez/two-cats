/**
 * Who is holding this phone? (Phase 3.5 placeholder for real auth.)
 *
 * Identity is expressed as "which cat is YOURS" — per the cross-care model you
 * then care for the OTHER cat (Mango's human feeds/grooms Luna, and vice
 * versa). Deliberately in-memory: the chooser pops on every launch, which is
 * exactly what we want while testing both roles on one phone. Phase 4 replaces
 * this with a Supabase auth session that remembers who you are.
 */

import { create } from 'zustand';

import { partnerOf, type CatId } from '../cat/types';

interface IdentityStore {
  /** The cat that belongs to the person holding this phone. null = not chosen yet. */
  userCatId: CatId | null;
  chooseIdentity: (catId: CatId) => void;
  /** Back to the chooser (the "switch user" affordance, handy for testing). */
  clearIdentity: () => void;
}

export const useIdentityStore = create<IdentityStore>()((set) => ({
  userCatId: null,
  chooseIdentity: (catId) => set({ userCatId: catId }),
  clearIdentity: () => set({ userCatId: null }),
}));

/** The cat this user is allowed to care for: always the partner's cat. */
export const careTargetOf = (userCatId: CatId): CatId => partnerOf(userCatId);
