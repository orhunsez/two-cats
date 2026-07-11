# two-cats — Project Plan

An app for two lovers. Each person has a cat; you care for **her** cat, she cares for **yours**. Both phones show both cats in realtime, so care (and neglect) is visible in both directions.

This document is the single source of truth for decisions made on 2026-07-10. Update it when decisions change.

---

## Resolved (2026-07-11)

Both threads from the previous "open questions" pass are now decided:

1. **Web development is fully off the table.** Native it is, via EAS Build (§5) — the PWA/web-deploy path is not happening. §5's EAS walkthrough is the real plan, not a fallback; treat it as authoritative, not "dead weight to prune."

2. **Home screen restructure — confirmed direction, not yet built.** Main screen shows both cats together (idle/snuggling, the duo FSM state pulled forward from Phase 6), then **a smooth transition** — not a stark screen swap — carries both users into caring for the other's cat. Still **not yet implemented**; this is locked-in intent for a future session, tracked as its own line in §7's build order. When we build it: `src/app/index.tsx` becomes the snuggle home, today's content moves to `src/app/care.tsx`, the FSM gains a shared duo state (e.g. `snuggling`) guarded by "both cats idle," and the screen transition itself is a Reanimated shared-element/layout animation rather than React Navigation's default push — that's the mechanism for "smooth," not just a route change.

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
States:  idle | eating | grooming | sleeping        (later: cuddling)
Events:  FEED | GROOM | SLEEP | WAKE | FINISH       (later: CUDDLE)

idle     --FEED-->   eating
idle     --GROOM-->  grooming
idle     --SLEEP-->  sleeping
eating   --FINISH--> idle        (auto after N ms)
grooming --FINISH--> idle        (auto after N ms)
sleeping --WAKE-->   idle        (user action only)
```

Rules:

- Invalid events (FEED while sleeping) are **rejected**, not queued. The UI responds with a refusal shake. No error states, no crashes — rejection is a feature.
- Timed states end via a `FINISH` event that goes through the same table, so a stale timer can never corrupt state.
- The FSM is a pure function (`src/features/cat/fsm.ts`) with zero imports from React/Zustand — unit-testable, and reusable server-side later.
- **Multiplayer twist (Phase 5):** the current state + `state_started_at` timestamp live in Supabase, not the phone. Both clients just render what the DB says. A phone opening mid-animation computes remaining time from `state_started_at`. This is server-authoritative state, like real multiplayer games.
- **Duo actions (Phase 6):** `CUDDLE` is a joint transition guarded by "both cats idle"; both rows update atomically and one shared GIF plays.

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
assets/cats/        # <cat>_<state>.gif
```

1. **UI never talks to Supabase directly.** Components call store actions; the store talks to services.
2. **The FSM stays pure.** No React, no I/O in `fsm.ts`.
3. **Activities are data, not code.** The registry (`registry.ts`) defines label/emoji/duration/visibility; the manifest (`manifest.ts`) defines art. New activity = new entries + one FSM row.
4. **Dumb components stay dumb.** `CatSprite` and `ActionBar` receive props and callbacks; only `CatCard` touches the store.

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

Needed files (9): `black_idle`, `black_eating`, `black_grooming`, `black_sleeping`, `orange_idle`, `orange_eating`, `orange_grooming`, `orange_sleeping`, `duo_cuddling`.

Spec for the AI generator:

- **512×512** canvas, cat centered and anchored identically in every file
- **First frame ≈ last frame** → seamless loop (expo-image loops GIFs forever by default)
- Same style prompt token across all generations; consistency > beauty
- Plain or transparent background; keep files under ~1–2 MB
- If files get heavy: convert to animated WebP (`gifski`/`cwebp`) — same manifest, smaller files

Until art exists, `manifest.ts` maps states to `null` and the app renders emoji fallbacks — fully playable with zero assets.

## 7. Build order

| Phase | Deliverable | Status |
|---|---|---|
| 1. Scaffold + structure | Feature folders, theme, docs, teach.md | ✅ 2026-07-10 |
| 2. Local cats | FSM + Zustand + both cats interactive offline | ✅ 2026-07-10 |
| 2.5. Dev client build | `expo-dev-client` + EAS Build, both phones off Expo Go for good — see §5 | 🟡 in progress: `expo-dev-client` installed, `eas-cli` confirmed via `npx eas-cli@latest`, currently blocked on `eas login` (requires the user's own Expo account credentials — can't be done on their behalf). Next step once logged in: `eas build:configure` then `eas build --profile development --platform android`. |
| 2.6. Snuggle home + care transition | Duo FSM state, `index.tsx` → snuggle hub, `care.tsx` → today's two-CatCard screen, Reanimated transition between them — locked intent, see "Resolved" above | ⬜ |
| 3. Juice | Reanimated hearts/bounce, GIF manifest wired to real art | ⬜ |
| 4. Supabase | Auth, couple pairing via invite code, RLS | ⬜ |
| 5. Realtime sync | Server-authoritative cat state, two phones one truth | ⬜ |
| 6. Duo actions | Cuddle with both-idle guard | ⬜ |
| 7. Decay | Lazy-decay needs (hunger/cleanliness/energy) | ⬜ |
| 8. Timeline | Interaction history screen | ⬜ |
| 9. Push | expo-notifications + Supabase Edge Function | ⬜ |

Every phase ends with a new entry in [teach.md](teach.md).
