# two-cats — Project Plan

An app for two lovers. Each person has a cat; you care for **her** cat, she cares for **yours**. Both phones show both cats in realtime, so care (and neglect) is visible in both directions.

This document is the single source of truth for decisions made on 2026-07-10. Update it when decisions change.

---

## Resolved (2026-07-11)

Both threads from the previous "open questions" pass are now decided:

1. **Web development is fully off the table.** Native it is, via EAS Build (§5) — the PWA/web-deploy path is not happening. §5's EAS walkthrough is the real plan, not a fallback; treat it as authoritative, not "dead weight to prune."

2. **Single-screen "always together" model — ✅ 2026-07-14, revised 2026-07-15.** There is now exactly **one screen** (`src/app/index.tsx`). The cats are never rendered alone: the shared duo frame is the only stage, and each cat's action controls sit below it. The brief second-screen experiment (`care.tsx` + solo `CatCard`/`CatSprite`) was deleted — "when a cat does something, it doesn't do it alone; they do it together on screen."
   - **Duo scenes are *derived*, not FSM states.** The shared frame is computed by a pure resolver — `getDuoScene(blackState, orangeState)` in `src/features/cat/duo.ts` — from the two cats' *existing* FSM states. Nobody triggers "snuggling" or "Luna grooms Mango as a scene"; it's just what a given (blackState, orangeState) pairing looks like. Storing it would create a second source of truth that could drift. The user-triggered CUDDLE duo *action* (Phase 6) still goes through the FSM as planned.
   - **Combinatorial art, honest fallback.** Two cats × 5 states = 25 possible pairings; we have art for ~8. The resolver maps the combos we have art for and falls back to `apart`/emoji for the rest — see §6. Adding art for a new pairing is one scene + one resolver line, zero component changes.
   - **The refusal shake moved to the shared scene.** With no solo sprite left, a rejected action shakes the whole `DuoScene` (`ref.shake()`), layered over its idle breathing bob.

---

## 1. Locked decisions

| Topic | Decision |
|---|---|
| Ownership model | **Cross-care**: you act on her black cat, she acts on your orange cat. Both users see both cats' states at all times. |
| Cat-to-cat play | **Duo actions** (e.g. cuddle): a joint transition requiring both cats idle, playing one shared GIF of both cats. Either user can trigger it. |
| FSM | **Hand-rolled typed FSM** — a transition table + pure `transition()` function. Designed XState-shaped so we can swap later if complexity demands it. |
| State manager | **Zustand** for client state. TanStack Query considered, deferred until its pain-point is felt. |
| Backend | **Supabase**: Postgres + Auth + Realtime + RLS. Cat state is server-authoritative. |
| Animations | **GIFs played by expo-image** (looping is default). **Reanimated** handles UI juice: shakes, hearts, bounces. Upgrade path: animated WebP (smaller, real transparency). |
| Asset delivery | **Bundled in the app binary** under `assets/cats/`. Supabase Storage delivery deferred. |
| Roadmap features | Needs decay (lazy-decay pattern), push notifications, interaction timeline. |
| Testing method | **EAS development build** via `expo-dev-client`, not Expo Go. Expo Go's store binary supports only one SDK, capped by phone OS version — it broke on day one. A dev build is compiled once per device and then hot-reloads forever, immune to that. See §5. |
| Discarded | Daily streaks, home-screen widgets (painful with Expo), mini-games, in-app chat. |

## 2. The cat FSM

```
States:  idle | eating | grooming_self | grooming_other | sleeping   (later: cuddling)
Events:  FEED | GROOM_SELF | GROOM_OTHER | SLEEP | WAKE | FINISH      (later: CUDDLE)

idle           --FEED-->         eating
idle           --GROOM_SELF-->   grooming_self
idle           --GROOM_OTHER-->  grooming_other
idle           --SLEEP-->        sleeping
eating         --FINISH-->       idle        (auto after N ms)
grooming_self  --FINISH-->       idle        (auto after N ms)
grooming_other --FINISH-->       idle        (auto after N ms)
sleeping       --WAKE-->         idle        (user action only)
```

`grooming_other` = this cat grooms its partner (Luna licking Mango). It's kept a
**pure per-cat state** with no cross-cat guard for now — the actor just needs to
be idle. The true joint action (both rows update atomically, guarded by "both
idle") is reserved for `CUDDLE` in Phase 6, where the mutual semantics are
essential. Splitting grooming into self/other is what makes the "one cat grooms
the other" art (`black_grooms_orange`, `orange_grooms_black`) reachable.

### Cross-cat choreography (partner reactions)

The FSM stays pure (one cat, no knowledge of the other), but the **store** adds a
thin choreography layer on top, driven by data in `registry.ts`:

```
PARTNER_REACTIONS = {
  FEED:        GROOM_SELF   // one cat eats → the other grooms itself
  GROOM_OTHER: SLEEP        // one grooms the other → the groomed one falls asleep
}
```

When a *user* action succeeds, `catStore.send` nudges the partner with the mapped
event. Reactions are **best-effort** (the partner's own FSM can still reject the
nudge if it isn't idle) and **one hop deep** (a reaction never triggers another —
`send` carries an `isReaction` flag). This is what makes the paired art land
naturally: feeding Luna *produces* the (eating, grooming_self) frame; having Luna
groom Mango *produces* the (grooming_other, sleeping) frame. The art was drawn as
exact state-pairs, and the reactions are what move the cats into those pairs.

Rules:

- Invalid events (FEED while sleeping) are **rejected**, not queued. The UI responds with a refusal shake on the shared scene. No error states, no crashes — rejection is a feature.
- Timed states end via a `FINISH` event that goes through the same table, so a stale timer can never corrupt state.
- The FSM is a pure function (`src/features/cat/fsm.ts`) with zero imports from React/Zustand — unit-testable, and reusable server-side later.
- **Multiplayer twist (Phase 5):** the current state + `state_started_at` timestamp live in Supabase, not the phone. Both clients just render what the DB says. A phone opening mid-animation computes remaining time from `state_started_at`. This is server-authoritative state, like real multiplayer games.
- **Duo actions (Phase 6):** `CUDDLE` is a joint transition guarded by "both cats idle"; both rows update atomically and one shared GIF plays.
- **Duo *scenes* are not FSM states.** The one screen's shared frame is derived from the two states by a pure resolver in `duo.ts` — see "Resolved" item 2 above for why.

## 3. Architecture rules (the anti-function-soup constitution)

```
src/
  app/              # screens (Expo Router: file path = route)
  features/
    cat/            # fsm.ts, registry.ts, manifest.ts, catStore.ts, components/
    couple/         # (Phase 4) pairing, partner presence
    auth/           # (Phase 4) sign in, session
  lib/              # (Phase 4) supabase client, generated DB types
  components/ui/    # dumb reusable pieces
  constants/        # theme
assets/cats/        # shared duo scene images (both cats in frame)
```

1. **UI never talks to Supabase directly.** Components call store actions; the store talks to services.
2. **The FSM stays pure.** No React, no I/O in `fsm.ts`.
3. **Activities are data, not code.** The registry (`registry.ts`) defines label/emoji/duration/visibility; the manifest (`manifest.ts`) defines art; the resolver (`duo.ts`) maps state pairs to scenes. New activity = new registry entry + one FSM row + (optionally) one scene.
4. **Dumb components stay dumb.** `ActionBar` receives props and callbacks; only the screen (`index.tsx`) touches the store to `send()`, and `DuoScene` only ever *reads* it.

## 4. Database sketch (Phase 4–5)

```
profiles      id (auth.users FK), display_name, cat_color
couples       id, user_a, user_b, invite_code
cats          id, couple_id, color, state, state_started_at, last_fed_at,
              last_groomed_at, last_slept_at
interactions  id, cat_id, actor_id, action, created_at   -- append-only log
```

- **RLS everywhere**: only members of a couple can read/write its cats.
- **Realtime** subscriptions on `cats` (state sync) and `interactions` (timeline).
- **Lazy decay**: hunger/cleanliness/energy are *computed* from `last_*_at` timestamps at read time — no cron job needed.
- `interactions` powers the timeline screen and push notifications ("Orhun fed Luna 🐈‍⬛").

## 5. Why we left Expo Go (2026-07-10)

Expo Go's App/Play Store binary supports exactly **one** SDK version at a time, and the Store only offers the newest binary compatible with the phone's OS. On day one, our project (SDK 57) hit a phone whose OS capped its Expo Go install at SDK 54 — three versions behind, with no update available. This isn't fixable from our side; it's structural to how Expo Go works.

**The fix: a development build.** Instead of the shared Expo Go binary, we compile our own native app shell (still with Expo's dev menu, fast refresh, and error overlays — a dev build is not a production build) and install it directly on each phone. Once installed, it hot-reloads from Metro exactly like Expo Go did, but is never version-capped again. A rebuild is only needed when a *native* dependency is added/changed (rare); everyday JS/TS work (which is ~95% of this app) never needs one.

### Build service: EAS Build

We have no Mac, and iOS builds/Simulator require one — so both platforms build in Expo's cloud via **EAS Build** (`eas-cli`).

**Staying off the App Store / Play Store — confirmed possible, permanently, on both platforms.** This app will only ever exist as a directly-installed APK/IPA via EAS "internal distribution": no store listing, no public review, no app-store account required for Android at all.

| Platform | Cost | Distribution | Expiry |
|---|---|---|---|
| Android | Free | EAS produces a downloadable `.apk` — install directly on the phone, no Play Store, no account needed | Never expires |
| iOS | **Apple Developer Program — $99/year**, unavoidable without a Mac | EAS registers the iPhone's UDID (`eas device:create`) and produces an installable build link — no App Store submission or review, ever | The signing certificate expires yearly; renewing means running `eas build` again and reinstalling — a technical step, not a store review |

The iOS $99/year is for **code-signing rights**, not a store fee — it's required to put your own compiled code on a physical iPhone at all, App Store or not. There is no free path to a real iPhone without a Mac.

### Walkthrough (not yet executed — run these yourselves)

```bash
# One-time setup
npx expo install expo-dev-client       # makes THIS project buildable as a dev client
npm install -g eas-cli                 # or prefix every command below with npx
eas login                              # free Expo account
eas build:configure                    # writes eas.json, links project to EAS

# Android (free, do this first)
eas build --profile development --platform android
# → wait for cloud build → download link/QR → install the .apk directly on the phone

# iOS (needs Apple Developer Program enrolled at developer.apple.com first)
eas device:create                      # she opens the link on her iPhone to register its UDID
eas build --profile development --platform ios
# → EAS manages signing/provisioning automatically → install link → she opens it,
#   then trusts the developer profile in Settings → General → VPN & Device Management

# Every day after that (both platforms), same as before:
npx expo start            # or: npx expo start --tunnel
# open the installed dev-client app instead of Expo Go — it connects to the same Metro server
```

Everything from Session 1.5 (mirrored networking, `--tunnel`) still applies unchanged — a dev build only replaces *which app* opens the QR code, not how the phone reaches Metro.

Note: `eas build --profile development` produces a **development** client (debug menu, connects to Metro, meant for us). When the app feels finished, `--profile preview` produces a standalone build (no Metro dependency, real production-like behavior) — still internal-distribution only, still never touches a store. That's the profile to use for "final" installs on both phones.

### 5.1 On testing via `expo start --web`

Useful for **fast solo iteration** (instant reload, no device needed) while writing layout/logic. **Not a substitute** for real-device testing before calling a phase done: `react-native-web` approximates native rendering through DOM/CSS, Reanimated runs through a JS shim on web instead of the real UI-thread engine, GIF playback goes through the browser instead of the native image pipeline, and push notifications (Phase 9) don't meaningfully exist in a browser tab. Use web for quick checks; verify on the dev client before shipping a phase.

## 6. GIF / art pipeline

**All art is duo art** — both cats in one frame — because the app only ever shows the shared scene (§Resolved 2). Every image depicts **one exact `(black, orange)` state pair**, so the resolver (`getDuoScene`) is a plain lookup table keyed by `${black}|${orange}`; a state pair with no row → `apart` → emoji.

Scene → art (pixel-art batch, 15 images, 2026-07-15):

| Scene | State pair (black, orange) | File |
|---|---|---|
| `snuggling` | (idle, idle) | `cats_awake_idle.jpg` |
| `dreaming` | (sleeping, sleeping) | `cats_sleeping.jpg` |
| `eating_together` | (eating, eating) | `cats_eating.jpg` |
| `lingering_black` | (idle, sleeping) | `black_idle_orange_sleeps.jpg` |
| `lingering_orange` | (sleeping, idle) | `orange_idle_black_sleeps.jpg` |
| `black_grooms_self_orange_sleeps` | (grooming_self, sleeping) | `black_grooms_itself_orange_sleeps.jpg` |
| `black_grooms_self_orange_idle` | (grooming_self, idle) | `orange_idle_black_grooms_itself.jpg` |
| `orange_grooms_self_black_sleeps` | (sleeping, grooming_self) | `orange_grooms_itself_black_sleeps.jpg` |
| `orange_grooms_self_black_idle` | (idle, grooming_self) | `black_idle_orange_grooms_itself.jpg` |
| `black_grooms_other` | (grooming_other, sleeping) | `black_grooms_orange.jpg` |
| `orange_grooms_other` | (sleeping, grooming_other) | `orange_grooms_black.jpg` |
| `black_eats_orange_grooms` | (eating, grooming_self) | `black_eats_orange_grooms_itself.jpg` |
| `orange_eats_black_grooms` | (grooming_self, eating) | `orange_eats_black_grooms_itself.jpg` |
| `black_eats_orange_sleeps` | (eating, sleeping) | `black_eats_orange_sleeps.jpg` |
| `orange_eats_black_sleeps` | (sleeping, eating) | `orange_eats_black_sleeps.jpg` |
| `apart` | every other pairing | — (emoji) |

Note the art deliberately pairs some solo activities with a *sleeping* partner (eating-while-partner-sleeps). The partner reactions (§2) are tuned to land the cats in exactly these pairs. Grooming-self now has both partner-asleep *and* partner-idle art, so the *Groom self* button always shows real art.

**Remaining art gaps (reachable pairings that fall to `apart`/emoji):**
- **`(eating, idle)` / `(idle, eating)`** — brief transitional pairing (e.g. feed one cat while the other's groom reaction gets rejected, or wake the partner mid-meal). Low priority.
- Reachability note: `eating_together` requires waking a sleeping cat and feeding it while the first is still mid-meal (5s window) — the FEED reaction (partner grooms itself) makes the both-eating pair rare by design. If it should be more common, tune the reaction later.

Spec for the generator (matches this batch):

- Both cats in frame, consistent windowsill/lighting; feed an existing image back in as the style reference so new art matches.
- Square-ish canvas (batch is 1024×1024 / 1024×559); keep files ~200 KB or under.
- Static images are fine — expo-image renders JPG/PNG/WebP/GIF identically; animate later by swapping the same filename for a GIF/WebP.
- If files get heavy: convert to WebP (`gifski`/`cwebp`) — same manifest, smaller files.

Until a pairing has art, `getDuoScene` returns `apart` (or the scene's `DUO_GIFS` entry is `null`) and `DuoScene` renders the emoji — fully playable with zero assets.

### 6.1 Where to generate the art (2026-07-14)

The universal strategy regardless of tool: **make one reference sheet per cat first** (a single still image that IS Luna / IS Mango), then feed that reference into every animation generation. Consistency comes from the reference, not from prompt luck.

Three routes, in recommended order:

1. **Pixel-art sprite tools (recommended first attempt).** Purpose-built for game sprites: pixel style makes cross-file consistency dramatically easier, loops are natural, files are tiny, transparency is clean. Look at **Retro Diffusion** (retrodiffusion.ai) and **Pixellab** (pixellab.ai) — both generate *animated* sprites from a reference image, which is exactly our job. Verify current pricing/features; this space moves fast.
2. **Image model → sprite sheet → GIF.** ChatGPT's image generation and Midjourney (with its character/omni reference feature) both accept reference images. Ask for "a 4-frame animation sprite sheet of this exact cat eating, frames side by side, same pose anchor" → slice the frames → assemble with ezgif.com or `gifski`. Most manual control, most labor.
3. **Image → video model → GIF.** Feed the reference still to an image-to-video model (Luma Dream Machine, Runway, Pika, Kling) with a prompt like "cat grooming itself, subtle motion, seamless loop" → download the clip → convert/trim to a looping GIF with ezgif or `ffmpeg`+`gifski`. Prettiest results, but seamless loops are the hard part and consistency across 8+ files is a fight.

Conversion/cleanup toolbox: **ezgif.com** (web swiss-army knife: trim, crop, optimize, GIF↔WebP), **gifski** (highest-quality GIF encoder), **ffmpeg** (everything else). If GIFs come out heavy, animated WebP (same manifest, same expo-image playback) roughly halves the size.

### 6.2 Wiring real art in (the manifest swap)

Zero component changes — this is the registry pattern's payoff:

1. Drop files in `assets/cats/`.
2. In `src/features/cat/manifest.ts`, replace a scene's `null` with an array of `require`s (the app picks one variant per scene, seeded by when the scene began):
   ```ts
   // DUO_GIFS — one entry per scene, array of variants:
   snuggling: [require('../../../assets/cats/cats_awake_playing.jpg')],
   dreaming: [
     require('../../../assets/cats/cats_sleeping.jpg'),
     require('../../../assets/cats/cats_sleeping_1_1.jpg'),
   ],
   ```
   Paths must be static strings (Metro resolves `require` at build time — no variables).
3. That's it. Assets are a JS-side change: the dev client **hot-reloads them over Metro, no EAS rebuild needed**. They only get baked into a binary when a standalone (`preview`/`production`) build is made.

## 7. Build order

| Phase | Deliverable | Status |
|---|---|---|
| 1. Scaffold + structure | Feature folders, theme, docs, teach.md | ✅ 2026-07-10 |
| 2. Local cats | FSM + Zustand + both cats interactive offline | ✅ 2026-07-10 |
| 2.5. Dev client build | `expo-dev-client` + EAS Build, both phones off Expo Go for good — see §5 | ✅ 2026-07-14 — Android dev client built on EAS and installed; `eas.json` + `android.package` committed. iOS build still pending Apple Developer enrollment. |
| 2.6. Single-screen "always together" | One screen: derived duo scenes (`duo.ts`) + both cats' action bars. FSM split into `grooming_self`/`grooming_other`. Second screen + solo components deleted. First pixel-art batch wired in. — see "Resolved" above | ✅ 2026-07-15 |
| 3. Juice | Reanimated hearts/bounce on successful actions; remaining scene art (lingering, apart); optional animated (GIF/WebP) art | ⬜ |
| 4. Supabase | Auth, couple pairing via invite code, RLS | ⬜ |
| 5. Realtime sync | Server-authoritative cat state, two phones one truth | ⬜ |
| 6. Duo actions | Cuddle with both-idle guard | ⬜ |
| 7. Decay | Lazy-decay needs (hunger/cleanliness/energy) | ⬜ |
| 8. Timeline | Interaction history screen | ⬜ |
| 9. Push | expo-notifications + Supabase Edge Function | ⬜ |

Every phase ends with a new entry in [teach.md](teach.md).
