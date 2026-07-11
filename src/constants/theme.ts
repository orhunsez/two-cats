/**
 * A tiny hand-rolled theme. When the app grows we can swap this for a styling
 * library (NativeWind / Tamagui / Unistyles), but plain objects + one hook
 * keep Phase 1 free of magic.
 */

import { useColorScheme } from 'react-native';

export interface Palette {
  background: string;
  card: string;
  text: string;
  subtle: string;
  accent: string;
  border: string;
}

export const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    background: '#FBF5EC',
    card: '#FFFFFF',
    text: '#33302B',
    subtle: '#8D8579',
    accent: '#E8895B',
    border: '#ECE3D5',
  },
  dark: {
    background: '#1B1917',
    card: '#262320',
    text: '#F3EEE6',
    subtle: '#A39C90',
    accent: '#F09A6B',
    border: '#38342F',
  },
};

export function useTheme(): Palette {
  const scheme = useColorScheme();
  return palettes[scheme === 'dark' ? 'dark' : 'light'];
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { md: 16, lg: 24 } as const;
