/**
 * Root layout — Expo Router renders this around every screen.
 * Also the app's bootstrap point: cat sync starts (and stops) with the app.
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { startCatSync } from '@/features/cat/initSync';

export default function RootLayout() {
  // Start the Supabase realtime sync once for the whole app; the returned
  // cleanup runs if the root ever unmounts. No-op when .env isn't configured.
  useEffect(() => startCatSync(), []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </>
  );
}
