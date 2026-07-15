/**
 * Renders the action buttons for one cat, driven entirely by the registry.
 * This component knows nothing about specific actions — add an entry to
 * CAT_ACTIONS and the button appears.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing, useTheme } from '@/constants/theme';
import type { CatEvent, CatState } from '../fsm';
import { CAT_ACTIONS } from '../registry';

interface Props {
  state: CatState;
  onAction: (event: CatEvent) => void;
}

export function ActionBar({ state, onAction }: Props) {
  const theme = useTheme();

  const visibleActions = CAT_ACTIONS.filter(
    (action) => action.visibleIn === undefined || action.visibleIn.includes(state),
  );

  return (
    <View style={styles.row}>
      {visibleActions.map((action) => (
        <Pressable
          key={action.event}
          onPress={() => onAction(action.event)}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.background, borderColor: theme.border },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.buttonEmoji}>{action.emoji}</Text>
          <Text style={[styles.buttonLabel, { color: theme.text }]}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // Without wrap, 4 buttons overflow a narrow phone and the leftmost gets
    // pushed off-screen. Wrapping lets extras drop to a second centered row.
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  button: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 76,
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.96 }],
  },
  buttonEmoji: {
    fontSize: 20,
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
