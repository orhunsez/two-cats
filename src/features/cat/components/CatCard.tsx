/**
 * One cat's card: sprite + name + current state + actions.
 * This is the only cat component that touches the store; CatSprite and
 * ActionBar stay "dumb" (props in, callbacks out) so they are reusable.
 */

import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, useTheme } from '@/constants/theme';
import { useCatStore } from '../catStore';
import type { CatEvent } from '../fsm';
import { STATE_LABEL } from '../registry';
import { CAT_PROFILES, type CatId } from '../types';
import { ActionBar } from './ActionBar';
import { CatSprite, type CatSpriteHandle } from './CatSprite';

interface Props {
  catId: CatId;
}

export function CatCard({ catId }: Props) {
  const theme = useTheme();
  // Selector subscribes this card to ONE cat — feeding Luna never re-renders Mango's card.
  const cat = useCatStore((s) => s.cats[catId]);
  const send = useCatStore((s) => s.send);
  const spriteRef = useRef<CatSpriteHandle>(null);

  const handleAction = (event: CatEvent) => {
    const accepted = send(catId, event);
    if (!accepted) {
      spriteRef.current?.shake(); // the cat refuses (e.g. fed while asleep)
    }
  };

  const profile = CAT_PROFILES[catId];

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <CatSprite ref={spriteRef} catId={catId} state={cat.state} />
      <Text style={[styles.name, { color: theme.text }]}>{profile.displayName}</Text>
      <Text style={[styles.stateLabel, { color: theme.subtle }]}>
        {STATE_LABEL[cat.state]}
      </Text>
      <ActionBar state={cat.state} onAction={handleAction} />
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
  name: {
    fontSize: 20,
    fontWeight: '700',
  },
  stateLabel: {
    fontSize: 14,
    marginBottom: spacing.xs,
  },
});
