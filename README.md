# two-cats 🐈‍⬛🐈

A tiny app for two lovers and their two virtual cats. You take care of **her** black cat, she takes care of **your** orange cat — feed, groom, and put them to sleep, with looping animations and (soon) realtime sync between both phones. Neglect is visible. Love is measurable. 😼

## Stack

| Layer | Tech | Why |
|---|---|---|
| Framework | [Expo](https://expo.dev) (SDK 57) + Expo Router | The industry-standard way to build React Native |
| Language | TypeScript (strict) | The compiler enforces valid cat behavior |
| State | [Zustand](https://zustand.docs.pmnd.rs) | Lightweight, the most popular modern client-state library |
| Backend | [Supabase](https://supabase.com) *(Phase 4+)* | Postgres + Auth + Realtime + Row Level Security |
| Animations | [Reanimated](https://docs.swmansion.com/react-native-reanimated/) + [expo-image](https://docs.expo.dev/versions/latest/sdk/image/) | Reanimated for UI juice, expo-image for looping cat GIFs |
| Cat brain | A hand-rolled finite-state machine | 4 states, 5 events, one table — see [PLAN.md](PLAN.md) |

## Getting started

```bash
npm install
npx expo start
```

**Do not use the Expo Go app** — its store binary supports only one SDK version at a time, capped by your phone's OS, and this project has already outgrown it once. Instead, both phones run a **development build**, a custom-compiled app shell that hot-reloads from the same `expo start` server forever, immune to Expo Go version drift. Build it once via EAS (Android is free, iOS needs a $99/year Apple Developer account since there's no Mac in this setup) — full walkthrough in [PLAN.md §5](PLAN.md#5-why-we-left-expo-go-2026-07-10). Neither app is ever submitted to the App Store or Play Store; both stay as directly-installed APK/IPA builds.

`npx expo start --web` (or `npm run web`) is fine for quick solo iteration, but isn't a substitute for testing on the real dev-client build before calling a phase done — see PLAN.md §5.1 for why.

Useful checks:

```bash
npx tsc --noEmit   # typecheck
npx expo lint      # lint
```

## Project structure

```
src/
  app/              # screens — file path = route (Expo Router)
  features/cat/     # fsm.ts (brain), registry.ts (actions-as-data),
                    # manifest.ts (art), catStore.ts (Zustand), components/
  components/ui/    # dumb reusable pieces
  constants/        # theme
assets/cats/        # <cat>_<state>.gif — see art spec in PLAN.md
```

## Docs

- **[PLAN.md](PLAN.md)** — every decision, the FSM spec, DB schema, art pipeline, and the phase-by-phase roadmap
- **[teach.md](teach.md)** — the learning log: after every coding session, an explanation of the technologies used and why

## Status

Phase 2 of 9 done: both cats live on the home screen and respond to actions locally (emoji placeholders until the GIFs are generated). Next up: Phase 2.5, the EAS development-build switch (see PLAN.md §5), then animation juice, then Supabase.
