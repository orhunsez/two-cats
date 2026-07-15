/**
 * The only screen: both cats living together in one shared frame. Before it
 * renders, the identity gate asks who's holding the phone — per the cross-care
 * model each human only gets controls for the OTHER person's cat, so exactly
 * one action bar shows. (src/app/index.tsx IS the route "/" — Expo Router.)
 */

import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing, useTheme } from '@/constants/theme';
import { useCatStore } from '@/features/cat/catStore';
import { ActionBar } from '@/features/cat/components/ActionBar';
import { DuoScene, type DuoSceneHandle } from '@/features/cat/components/DuoScene';
import type { CatEvent } from '@/features/cat/fsm';
import { CAT_PROFILES } from '@/features/cat/types';
import { WhoAreYou } from '@/features/couple/components/WhoAreYou';
import { careTargetOf, useIdentityStore } from '@/features/couple/identityStore';
import { isSyncConfigured } from '@/lib/supabase';

export default function HomeScreen() {
  const theme = useTheme();
  const userCatId = useIdentityStore((s) => s.userCatId);
  const clearIdentity = useIdentityStore((s) => s.clearIdentity);
  const send = useCatStore((s) => s.send);
  const synced = useCatStore((s) => s.synced);
  const careCat = useCatStore((s) => (userCatId ? s.cats[careTargetOf(userCatId)] : null));
  const sceneRef = useRef<DuoSceneHandle>(null);

  // The identity gate: until someone picks who they are, that's the screen.
  if (userCatId === null || careCat === null) {
    return <WhoAreYou />;
  }

  const careForId = careTargetOf(userCatId);

  const handleAction = (event: CatEvent) => {
    const accepted = send(careForId, event);
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
        <Text style={[styles.syncBadge, { color: synced ? theme.accent : theme.subtle }]}>
          {isSyncConfigured ? (synced ? '● synced' : '○ connecting…') : '○ local only'}
        </Text>

        <DuoScene ref={sceneRef} />

        <View style={styles.controls}>
          <Text style={[styles.catName, { color: theme.text }]}>
            care for {CAT_PROFILES[careForId].displayName}
          </Text>
          <ActionBar state={careCat.state} onAction={handleAction} />
        </View>

        <Pressable onPress={clearIdentity} hitSlop={12} style={styles.switchButton}>
          <Text style={[styles.switchLabel, { color: theme.subtle }]}>
            you&apos;re {CAT_PROFILES[userCatId].displayName}&apos;s human · switch
          </Text>
        </Pressable>
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
  },
  syncBadge: {
    fontSize: 12,
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
  switchButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  switchLabel: {
    fontSize: 13,
  },
});
