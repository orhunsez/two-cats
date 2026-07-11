export type CatId = 'black' | 'orange';

export interface CatProfile {
  id: CatId;
  /** Rename freely — or later, let each user name their partner's cat in-app. */
  displayName: string;
}

export const CAT_PROFILES: Record<CatId, CatProfile> = {
  black: { id: 'black', displayName: 'Luna' },
  orange: { id: 'orange', displayName: 'Mango' },
};

export const CAT_IDS: CatId[] = ['black', 'orange'];
