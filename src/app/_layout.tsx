/**
 * Root layout — Expo Router renders this around every screen.
 * For now a single Stack with just the home screen; auth screens and a
 * timeline tab slot in here later.
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </>
  );
}
