/**
 * The only screen: both cats living together in one shared frame, plus the
 * controls to care for each of them. You feed/groom/sleep HER cat, she does
 * the same for yours — but whatever happens, it happens together on screen.
 * (src/app/index.tsx IS the route "/" — Expo Router's file-based routing.)
 */

import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing, useTheme } from '@/constants/theme';
import { useCatStore } from '@/features/cat/catStore';
import { ActionBar } from '@/features/cat/components/ActionBar';
import { DuoScene, type DuoSceneHandle } from '@/features/cat/components/DuoScene';
import type { CatEvent } from '@/features/cat/fsm';
import { CAT_IDS, CAT_PROFILES } from '@/features/cat/types';

export default function HomeScreen() {
  const theme = useTheme();
  const send = useCatStore((s) => s.send);
  const cats = useCatStore((s) => s.cats);
  const sceneRef = useRef<DuoSceneHandle>(null);

  const handleAction = (catId: (typeof CAT_IDS)[number], event: CatEvent) => {
    const accepted = send(catId, event);
    if (!accepted) {
      sceneRef.current?.shake(); // the cat refuses (e.g. fed while asleep)
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>two cats</Text>
        <Text style={[styles.subtitle, { color: theme.subtle }]}>
          one is yours, one is hers 🖤🧡
        </Text>

        <DuoScene ref={sceneRef} />

        {CAT_IDS.map((catId) => (
          <View key={catId} style={styles.controls}>
            <Text style={[styles.catName, { color: theme.text }]}>
              care for {CAT_PROFILES[catId].displayName}
            </Text>
            <ActionBar
              state={cats[catId].state}
              onAction={(event) => handleAction(catId, event)}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  controls: {
    borderRadius: radius.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  catName: {
    fontSize: 16,
    fontWeight: '700',
  },
});
