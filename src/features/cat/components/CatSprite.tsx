/**
 * Renders the cat itself: the looping GIF for the current FSM state, or an
 * emoji fallback while the art doesn't exist yet.
 *
 * Also owns the "refusal shake" (Reanimated): when the FSM rejects an event,
 * the parent calls `ref.shake()`. The shake is imperative on purpose — it is
 * a fire-and-forget effect, not state the app needs to remember.
 */

import { Image } from 'expo-image';
import { useImperativeHandle, type Ref } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { CatState } from '../fsm';
import { CAT_GIFS, FALLBACK_EMOJI } from '../manifest';
import type { CatId } from '../types';

export interface CatSpriteHandle {
  shake: () => void;
}

interface Props {
  catId: CatId;
  state: CatState;
  ref?: Ref<CatSpriteHandle>;
}

export function CatSprite({ catId, state, ref }: Props) {
  const offsetX = useSharedValue(0);

  useImperativeHandle(ref, () => ({
    shake: () => {
      offsetX.value = withSequence(
        withTiming(-8, { duration: 60 }),
        withTiming(8, { duration: 60 }),
        withTiming(-5, { duration: 60 }),
        withTiming(5, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      );
    },
  }));

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }],
  }));

  const gif = CAT_GIFS[catId][state];

  return (
    <Animated.View style={[styles.stage, shakeStyle]}>
      {gif !== null ? (
        // The key remounts the Image when the state changes, restarting the
        // new GIF from frame 0. GIFs loop forever by default in expo-image.
        <Image
          key={`${catId}-${state}`}
          source={gif}
          style={styles.gif}
          contentFit="contain"
        />
      ) : (
        <Text style={styles.emoji}>{FALLBACK_EMOJI[catId][state]}</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gif: {
    width: 140,
    height: 140,
  },
  emoji: {
    fontSize: 72,
    textAlign: 'center',
  },
});
