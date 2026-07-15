/**
 * The launch chooser: "who are you?" Rendered by the home screen whenever no
 * identity is set (app start, or after "switch"). Picking a cat sets your
 * identity in the identity store — per the cross-care model, you'll then be
 * caring for the OTHER cat, and the button says so out loud to avoid surprise.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { radius, spacing, useTheme } from '@/constants/theme';
import { CAT_IDS, CAT_PROFILES, partnerOf, type CatId } from '@/features/cat/types';
import { useIdentityStore } from '../identityStore';

const CAT_EMOJI: Record<CatId, string> = { black: '🐈‍⬛', orange: '🐈' };

export function WhoAreYou() {
  const theme = useTheme();
  const chooseIdentity = useIdentityStore((s) => s.chooseIdentity);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>who are you?</Text>
        <Text style={[styles.subtitle, { color: theme.subtle }]}>
          each human cares for the other&apos;s cat 🖤🧡
        </Text>

        {CAT_IDS.map((catId, index) => {
          const cares = CAT_PROFILES[partnerOf(catId)];
          return (
            <Animated.View key={catId} entering={FadeInDown.delay(index * 120).springify()}>
              <Pressable
                onPress={() => chooseIdentity(catId)}
                style={({ pressed }) => [
                  styles.choice,
                  { backgroundColor: theme.card, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.choiceEmoji}>{CAT_EMOJI[catId]}</Text>
                <Text style={[styles.choiceLabel, { color: theme.text }]}>
                  i&apos;m {CAT_PROFILES[catId].displayName}&apos;s human
                </Text>
                <Text style={[styles.choiceHint, { color: theme.subtle }]}>
                  you&apos;ll be caring for {cares.displayName} {CAT_EMOJI[cares.id]}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
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
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  choice: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  choiceEmoji: {
    fontSize: 44,
  },
  choiceLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  choiceHint: {
    fontSize: 13,
  },
});
