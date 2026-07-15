/**
 * The art manifest: maps every duo scene to its image(s). The cats are always
 * shown together, so there is only ONE art table — the shared scene (see
 * duo.ts), never per-cat solo sprites.
 *
 * Each scene holds an ARRAY of variants — DuoScene picks one deterministically
 * (seeded by when the scene began) so a scene with several images doesn't
 * always play the same one, while staying stable across re-renders. Add art as
 * `assets/cats/<name>.jpg` (or .png/.gif — expo-image renders them all the
 * same way) and list it here.
 *
 * `null` = no art for that combo yet → DuoScene renders the scene's emoji from
 * DUO_SCENE_INFO, so the app is fully playable before every combo has art.
 */

import type { DuoSceneId } from './duo';

// require() returns a number (an asset ID) in React Native.
export const DUO_GIFS: Record<DuoSceneId, number[] | null> = {
  snuggling: [require('../../../assets/cats/cats_awake_idle.jpg')],
  dreaming: [require('../../../assets/cats/cats_sleeping.jpg')],
  eating_together: [require('../../../assets/cats/cats_eating.jpg')],
  lingering_black: [require('../../../assets/cats/black_idle_orange_sleeps.jpg')],
  lingering_orange: [require('../../../assets/cats/orange_idle_black_sleeps.jpg')],
  black_grooms_self_orange_sleeps: [
    require('../../../assets/cats/black_grooms_itself_orange_sleeps.jpg'),
  ],
  black_grooms_self_orange_idle: [
    require('../../../assets/cats/orange_idle_black_grooms_itself.jpg'),
  ],
  orange_grooms_self_black_sleeps: [
    require('../../../assets/cats/orange_grooms_itself_black_sleeps.jpg'),
  ],
  orange_grooms_self_black_idle: [
    require('../../../assets/cats/black_idle_orange_grooms_itself.jpg'),
  ],
  black_grooms_other: [require('../../../assets/cats/black_grooms_orange.jpg')],
  orange_grooms_other: [require('../../../assets/cats/orange_grooms_black.jpg')],
  black_eats_orange_grooms: [require('../../../assets/cats/black_eats_orange_grooms_itself.jpg')],
  orange_eats_black_grooms: [require('../../../assets/cats/orange_eats_black_grooms_itself.jpg')],
  black_eats_orange_sleeps: [require('../../../assets/cats/black_eats_orange_sleeps.jpg')],
  orange_eats_black_sleeps: [require('../../../assets/cats/orange_eats_black_sleeps.jpg')],
  apart: null, // catch-all for pairings without dedicated art (→ emoji)
};
