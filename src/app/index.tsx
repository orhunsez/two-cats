/**
 * Home screen: both cats, side by side in life and on screen.
 * The file path src/app/index.tsx IS the route "/" — that's Expo Router's
 * file-based routing.
 */

import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/constants/theme';
import { CatCard } from '@/features/cat/components/CatCard';
import { CAT_IDS } from '@/features/cat/types';

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>two cats</Text>
        <Text style={[styles.subtitle, { color: theme.subtle }]}>
          one is yours, one is hers 🖤🧡
        </Text>

        {CAT_IDS.map((catId) => (
          <CatCard key={catId} catId={catId} />
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
});
