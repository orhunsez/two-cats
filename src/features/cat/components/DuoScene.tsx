/**
 * The app's one and only stage: both cats in a single shared frame. Which
 * scene plays is derived from the two cats' FSM states (see duo.ts) — this
 * component only subscribes, resolves, and renders. It never changes state.
 *
 * It also owns the "refusal shake": when the FSM rejects an action there is no
 * solo sprite to shake anymore, so the whole scene does it. The parent calls
 * `ref.shake()` — imperative on purpose, since it's a fire-and-forget effect,
 * not state the app needs to remember.
 */

import { Image } from 'expo-image';
import { useEffect, useImperativeHandle, type Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { radius, spacing, useTheme } from '@/constants/theme';
import { useCatStore } from '../catStore';
import { DUO_SCENE_INFO, getDuoScene } from '../duo';
import { DUO_GIFS } from '../manifest';
import { STATE_LABEL } from '../registry';
import { CAT_IDS, CAT_PROFILES } from '../types';

export interface DuoSceneHandle {
  shake: () => void;
}

interface Props {
  ref?: Ref<DuoSceneHandle>;
}

export function DuoScene({ ref }: Props) {
  const theme = useTheme();
  // Two narrow selectors: this component re-renders only when a cat's runtime
  // actually changes, not on every store update.
  const black = useCatStore((s) => s.cats.black);
  const orange = useCatStore((s) => s.cats.orange);

  const scene = getDuoScene(black.state, orange.state);
  const info = DUO_SCENE_INFO[scene];

  // Pick one art variant, seeded by when the scene formed. Deterministic on
  // purpose: re-renders never reshuffle mid-scene (Math.random() in render is
  // impure — the React Compiler lint rejects it), and in Phase 5 both phones
  // will derive the SAME variant because stateStartedAt comes from the server.
  const variants = DUO_GIFS[scene];
  const gif =
    variants && variants.length > 0
      ? variants[(black.stateStartedAt + orange.stateStartedAt) % variants.length]
      : null;

  // A gentle breathing bob so the placeholder feels alive until real art lands.
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1, // repeat forever
    );
  }, [bob]);

  // The refusal shake (translateX), layered on top of the bob (translateY).
  const shakeX = useSharedValue(0);
  useImperativeHandle(ref, () => ({
    shake: () => {
      shakeX.value = withSequence(
        withTiming(-8, { duration: 60 }),
        withTiming(8, { duration: 60 }),
        withTiming(-5, { duration: 60 }),
        withTiming(5, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      );
    },
  }));

  const stageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { translateY: bob.value }],
  }));

  const states = { black: black.state, orange: orange.state } as const;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Animated.View style={[styles.stage, stageStyle]}>
        {gif !== null ? (
          // The key remounts the Image when the scene changes, so a new GIF
          // always starts at frame 0.
          <Image key={scene} source={gif} style={styles.gif} contentFit="contain" />
        ) : (
          <Text style={styles.emoji}>{info.emoji}</Text>
        )}
      </Animated.View>

      <Text style={[styles.sceneLabel, { color: theme.text }]}>{info.label}</Text>

      <View style={styles.statusRow}>
        {CAT_IDS.map((catId) => (
          <Text key={catId} style={[styles.status, { color: theme.subtle }]}>
            {CAT_PROFILES[catId].displayName} {STATE_LABEL[states[catId]]}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  stage: {
    // width:'100%' fills the card, aspectRatio keeps it square as the phone
    // grows/shrinks — the image scales with the screen instead of a fixed 280px.
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gif: {
    width: '100%',
    height: '100%',
  },
  emoji: {
    fontSize: 56,
    textAlign: 'center',
  },
  sceneLabel: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusRow: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  status: {
    fontSize: 13,
  },
});
