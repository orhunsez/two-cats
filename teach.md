# teach.md — the learning log

After every coding session, Claude appends a section here explaining what was built, which technologies were used, and *why* — in the order the code was written. Read it with the code open.

---

## Session 1 — 2026-07-10 · Phases 1 & 2: scaffold, FSM, store, first screen

### 1.1 What create-expo-app gave us (and what Expo actually is)

React Native lets you write React that renders **real native UI** (not a webview). Expo is the framework *around* React Native: it gives you the build system, a dev server, a phone client (Expo Go) for instant testing, and ~80 pre-built native modules (`expo-image`, `expo-notifications`, …) so you almost never touch Xcode/Android Studio. This is the industry-default setup in 2026 — even Meta's own docs recommend starting with a framework, and Expo is *the* framework.

The template gave us SDK 57: React Native 0.86, React 19, TypeScript 6 in **strict mode**, and Reanimated **4** (we planned for 3; 4 is its successor with the same API for what we need, plus the animation engine split into a separate `react-native-worklets` package — more in lesson 1.6).

What I deleted: the demo screens/components. What I kept: `tsconfig.json` (note the `@/*` path alias — `import { useTheme } from '@/constants/theme'` instead of `../../../constants/theme`), `app.json` (app name, icon, splash config), and the ESLint setup.

### 1.2 Expo Router — the file system IS the navigation

Look at [src/app/index.tsx](src/app/index.tsx) and [src/app/_layout.tsx](src/app/_layout.tsx). There is no route configuration anywhere. That's because Expo Router (built on React Navigation, the standard nav library) uses **file-based routing**, the same mental model as Next.js on the web:

- `src/app/index.tsx` → the `/` route (home screen)
- `src/app/_layout.tsx` → wraps every screen; our `<Stack>` lives here
- later: `src/app/timeline.tsx` → the `/timeline` route, automatically

When we add auth, we'll add a `(auth)` group folder with sign-in screens — zero router config, just files.

### 1.3 The FSM — the whole cat brain in one table

[src/features/cat/fsm.ts](src/features/cat/fsm.ts) is the most important file in the app and it's ~35 lines.

**The problem it solves:** without an FSM, cat logic becomes scattered booleans — `isEating`, `isSleeping`, `if (isEating && !isSleeping && ...)` — and every new feature multiplies the combinations. That's the function soup you feared.

**The FSM idea:** a cat is always in exactly *one* state, and the only way to change state is to send an *event* through a lookup table:

```ts
const TRANSITIONS: TransitionTable = {
  idle:     { FEED: 'eating', GROOM: 'grooming', SLEEP: 'sleeping' },
  eating:   { FINISH: 'idle' },
  grooming: { FINISH: 'idle' },
  sleeping: { WAKE: 'idle' },
};
```

Read it row by row: "when `idle`, `FEED` moves you to `eating`". Anything *not* in the table (FEED while `sleeping`) returns `null` — **rejected**. Rejection isn't an error; it's the cat saying no, and the UI turns it into a shake.

**TypeScript is doing real work here:**

- `export const CAT_STATES = ['idle', ...] as const` then `type CatState = (typeof CAT_STATES)[number]` — one source of truth that exists both as a *runtime array* (we'll iterate it for DB enums later) and a *compile-time union type* `'idle' | 'eating' | ...`.
- `Record<CatState, ...>` forces the table to have a row for **every** state — add a state, forget its row, and the code won't compile.
- `Partial<Record<CatEvent, CatState>>` says each row handles only *some* events. The `Partial` is what makes lookups possibly-undefined, which is why `transition()` returns `CatState | null`.

**Why `fsm.ts` imports nothing** (no React, no Zustand): a pure function is trivially unit-testable (`expect(transition('sleeping','FEED')).toBeNull()`), and in Phase 5 we can run the *same* validation server-side. Business logic that doesn't know about UI is the single biggest "senior code" habit in this repo.

### 1.4 The registry pattern — features as data, not code

[src/features/cat/registry.ts](src/features/cat/registry.ts) and [manifest.ts](src/features/cat/manifest.ts) define *what actions exist* (label, emoji, duration, when visible) and *what art exists* — as plain objects. The UI ([ActionBar.tsx](src/features/cat/components/ActionBar.tsx)) just maps over the registry; it has no idea what "Feed" is.

This is your expandability guarantee. Adding a "play" activity later touches **zero components**: one FSM row, one registry entry, one manifest entry, one GIF. We'll prove this claim in Phase 6 when we add cuddling.

Note the separation of concerns: `visibleIn` in the registry controls whether a *button renders* (presentation); the FSM controls whether the event is *accepted* (business rules). Two different questions, answered in two different places.

### 1.5 Zustand — state outside the component tree

[src/features/cat/catStore.ts](src/features/cat/catStore.ts). React's built-in state (`useState`) lives *inside* a component and dies with it. Zustand creates a **store** that lives outside React entirely; components *subscribe* to slices of it.

```ts
export const useCatStore = create<CatStore>()((set, get) => ({ ... }));
```

- `create` returns a **hook**. Any component can call `useCatStore(...)` — no `<Provider>` wrapper needed (Redux and Context require one; this is why people love Zustand).
- `set` merges new state **immutably** — we build a new `cats` object instead of mutating, which is how subscribers know something changed.
- `get` reads current state inside actions (our `send` needs the current state to run the FSM).

**The selector lesson** — in [CatCard.tsx](src/features/cat/components/CatCard.tsx):

```ts
const cat = useCatStore((s) => s.cats[catId]);
```

The function you pass picks *which slice* you subscribe to. Luna's card subscribes only to `cats.black`, so feeding Luna never re-renders Mango's card. Selectors are THE Zustand skill — subscribe to the whole store and you're back to re-rendering everything.

**Design decisions worth noticing:**
- `send()` is the *only* way to change a cat. It runs every event through the FSM — the store can't be corrupted by a rogue component.
- Timed states end via a `setTimeout` that just sends `FINISH` back through `send()`. Since `FINISH` isn't valid from `idle` or `sleeping`, a stale timer firing late is *harmless by construction* — the FSM rejects it. No timer-vs-state race conditions possible.
- Timer handles live in a module-level object, not in the store: they're plumbing, not application state. Rule of thumb — if the UI never renders it, it probably doesn't belong in the store.

### 1.6 Reanimated — animations on the UI thread

In [CatSprite.tsx](src/features/cat/components/CatSprite.tsx), the refusal shake:

```ts
const offsetX = useSharedValue(0);
offsetX.value = withSequence(withTiming(-8, {duration: 60}), ..., withTiming(0, {duration: 60}));
const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offsetX.value }] }));
```

**Why Reanimated exists:** React Native runs your JS on one thread and the UI on another. Animating with `useState` means crossing that bridge 60×/second — jank whenever JS is busy. Reanimated compiles the `useAnimatedStyle` function into a **worklet** that runs *on the UI thread*: the animation stays at 60fps even if JS is blocked. (That compilation is what the `react-native-worklets` package in our dependencies does.)

Vocabulary: `useSharedValue` = a mutable value both threads can see. `withTiming` = animate to a value over time. `withSequence` = chain animations (our shake: -8, +8, -5, +5, 0). Also exists: `withSpring` (physics-based — we'll use it for the cuddle bounce).

**Division of labor**: Reanimated moves *views* (shake, hearts, squish). It does NOT play GIFs — `expo-image` does that natively (lesson 1.7). Both libraries, separate jobs.

### 1.7 expo-image + the manifest — GIFs that loop themselves

`expo-image` is Expo's image component: disk/memory caching, and **native animated-image playback** — hand it a GIF and it loops forever, no code. Two tricks in [CatSprite.tsx](src/features/cat/components/CatSprite.tsx):

- `key={`${catId}-${state}`}` — changing `key` forces React to **remount** the Image, so each state's GIF starts from frame 0. Without it, React would reuse the component and the new GIF could join mid-loop.
- The manifest maps to `number | null` — in React Native, `require('./cat.gif')` returns a *number* (an asset ID resolved at build time; this is why paths must be static strings, never variables). `null` = no art yet → emoji fallback. The app was fully playable before any art existed, which is why we could build and test the whole FSM today.

### 1.8 React 19's `ref` prop + `useImperativeHandle` — parent-triggered effects

The shake presented an interesting question: the *store* knows the FSM rejected an event, the *sprite* owns the animation. How does "shake now" travel? It's not state (nothing to remember — it's fire-and-forget), so putting `isShaking` in the store would be wrong. Instead, CatSprite exposes an **imperative handle**:

```ts
useImperativeHandle(ref, () => ({ shake: () => { ... } }));
// parent: if (!send(catId, event)) spriteRef.current?.shake();
```

Also note: in React 19, `ref` is now **a normal prop** — before React 19 this required wrapping the component in `forwardRef(...)`. You'll still see `forwardRef` all over older codebases and tutorials; know both.

### 1.9 A real strict-TypeScript bug (I hit it while writing the theme)

First version of [src/constants/theme.ts](src/constants/theme.ts) ended with `} as const`, and `tsc` refused to compile. Why: `as const` freezes values into **literal types** — `background` became the type `"#FBF5EC"` (that exact string, nothing else), so the dark palette's `"#1B1917"` was "not assignable". The fix teaches the general rule: when multiple objects must share one shape, **declare the shape** (`interface Palette { background: string; ... }`) and annotate (`Record<'light' | 'dark', Palette>`) instead of letting inference over-narrow. `as const` stayed exactly where narrowing is *wanted*: `CAT_STATES` in fsm.ts, where the literal types ARE the point.

### 1.10 Verify it yourself

```bash
npx expo start        # then 'a' / 'i' / scan QR with Expo Go
```

Things to try: feed a cat (5s of eating, then back to lounging) · put a cat to sleep, then try to feed it → refusal shake, state unchanged · Sleep button swaps to Wake while sleeping (registry `visibleIn`) · both cats are fully independent (store selectors).

**Homework (optional, ~15 min):** add a `play` action end-to-end without touching any component: one row in `TRANSITIONS` (`idle: { ..., PLAY: 'playing' }`, plus `playing: { FINISH: 'idle' }`), extend `CAT_STATES` and `CatEvent`, then follow the compiler errors — `Record<CatState, ...>` will point at every table that needs a `playing` entry. That error trail *is* the expandability design working.

*Next session (Phase 3): floating hearts on actions, press-squish buttons, and wiring real GIFs into the manifest.*

---

## Session 1.5 — 2026-07-10 · Environment: why the QR code didn't work

Not app code, but debugging your own dev environment *is* the job. Three errors appeared at once; only one mattered. Separating them is the skill.

### 1.5.1 How Expo Go actually connects (and why WSL2 breaks it)

`npx expo start` runs **Metro**, a bundler + HTTP server on port 8081 on *your machine*. The QR code is not the app — it just encodes a URL like `exp://192.168.42.98:8081`. Expo Go scans it, requests the JS bundle from that address, and runs it. **Your phone must be able to reach that IP.**

We run inside **WSL2**, which by default puts Linux on a *virtual NAT network*. Our IP was `192.168.42.98` with gateway `192.168.32.1` — a subnet that exists only inside Windows. Your phone on the real WiFi has no route to it, so it hangs and Expo Go says "something went wrong." Nothing was wrong with the app; the address was unreachable.

Two fixes, and they teach different things:

- **`networkingMode=mirrored`** (in `C:\Users\orhun\.wslconfig`): WSL stops using NAT and *shares the Windows network interfaces*. Linux then has the same LAN IP as your laptop, so the QR points at a real reachable address. Fast, permanent, and fixes every future project.
- **`--tunnel`** (`npm run tunnel`): starts an **ngrok** tunnel — ngrok's cloud server gives you a public URL and forwards traffic down a connection your laptop opened *outbound*. Because the connection is outbound, it pierces NAT and firewalls without any config. The QR encodes that public URL, so **any phone on any network on earth** can load your bundle. This is the trick that will put the app on your girlfriend's phone 1000 km away. Cost: every reload round-trips through ngrok's server, so it's slower.

The general lesson: when a client can't reach a server, the bug is usually **network topology**, not code. Ask "can this address be routed from there?" before touching the app.

### 1.5.2 Reading errors in the right order

The DevTools failure (`libnspr4.so: cannot open shared object file`) looked scary and appeared *first*, so it seemed like the cause. It wasn't. React Native DevTools is an **Electron** app (a Chromium browser), and Chromium needs a pile of Linux GUI libraries that a headless WSL box doesn't ship. It's an optional debugger UI; Metro starts fine without it.

Two things worth internalizing:

- **The dynamic linker reports one missing library at a time.** You installed `libnspr4` and the error changed to `libnss3` — that's not a failed fix, that's *progress*. You'd have to walk the whole chain (libnss3, libatk, libgbm, libasound2, …) to satisfy Electron. We chose not to, because we don't need it.
- **Errors are not ranked by importance.** An `ERROR` line that doesn't stop the program is a warning wearing a costume. The proof is in the log: `ERROR ... libnss3.so` was immediately followed by `Tunnel connected. / Tunnel ready.` The system kept working.

The third "error" — `[L1,C1] expects a json object array or literal` — was VSCode, not Node. `react-native-devtools` is a **dotslash script**: a shebang line followed by a JSON body (a tiny format Meta uses to fetch platform-specific binaries on demand). VSCode saw the JSON-ish body, guessed the language wrong, and complained about line 1. Your editor's opinion is not a build failure.

### 1.5.3 What to run now

```bash
npm run tunnel   # works from any network, today, no restart
npm start        # faster; works once mirrored networking is on
```

To activate mirrored networking, close this session and run in **PowerShell**: `wsl --shutdown`, then reopen WSL. Verify with `ip addr show eth0` — you should see your real LAN IP (e.g. `192.168.1.x`), not `192.168.42.x`.

---

## Session 2 — 2026-07-10 · Why Expo Go broke (for real this time) and leaving it behind

Right after Session 1.5's networking fix, a *second*, unrelated error showed up: "incompatible SDK version." This one couldn't be fixed with config — it required a real architectural decision, so no code changed this session, only docs (this file, PLAN.md §5, README.md).

### 2.1 Expo Go is a shared binary with exactly one SDK, ever

Every Expo project declares an SDK version (ours: 57, set the moment `create-expo-app` ran). The **Expo Go app** you install from the Play/App Store is a *single, generic* binary that Expo's team compiles and ships — and by design it supports only the **one SDK version that was current when that binary was built.** It is not backward compatible across SDKs on purpose: bundling every historical native module into one app would make Expo Go enormous and unmaintainable.

So "my Expo Go is up to date" is a category error. Up to date *relative to what the Play Store currently offers you* — which is a different thing from "supports the SDK my project happens to use." Two independent version timelines (your project's SDK, Expo Go's binary) were assumed to be the same and weren't.

### 2.2 The twist: an OS ceiling, not a lag

My first guess was a **publish-timing gap** — SDK 57 hit npm just 3 days before this session (I checked `npm view expo time`), and Expo Go's store binary sometimes takes days-to-weeks to catch up after a new SDK ships. That would predict Expo Go being *one* SDK behind.

The actual gap was **three** SDKs (57 vs. 54) — too large for a timing lag alone. The real mechanism: Play Store **silently caps** which app version it offers per-device, based on your phone's Android/iOS version. If your OS is old enough, Play Store simply never shows the newest Expo Go — not as "update available and you declined," but as literally not on the menu for your device. "Up to date" was true and irrelevant at the same time.

**The debugging lesson:** my first hypothesis was reasonable but wrong, and the fix was to ask for *more specific data* (the exact SDK numbers from the error, not just "incompatible") before committing to a remedy. A 1-version gap and a 3-version gap have different root causes and different fixes — don't skip the step of confirming which one you actually have.

### 2.3 Development builds: compiling your way out of the problem permanently

Expo Go's limitation is structural, so a config tweak can't fix it — only leaving Expo Go can. A **development build** (via the `expo-dev-client` package) is a native app *you* compile, containing exactly the native modules this project needs, bundled with Expo's dev tools (fast refresh, error overlay, debug menu). You install it once per phone like any other app; after that it talks to the same `expo start` Metro server Expo Go always did — same QR code, same `--tunnel`, same mirrored-networking fix from Session 1.5. It just can never again be capped by someone else's store binary, because it's *your* binary.

The only time you rebuild is when a **native** dependency changes (adding a package with native code, e.g. a new camera or notifications library) — pure JS/TS changes, which is nearly everything we write, hot-reload through the existing install forever. This is also *why* the project structure rule "features are data, registries, pure functions" matters beyond code cleanliness — most of our future work stays in JS/TS and never touches the native layer at all.

### 2.4 EAS Build — compiling in the cloud because there's no Mac here

Compiling a native iOS app normally requires Xcode, and Xcode requires macOS — a hard Apple restriction with no workaround. Since we're on WSL2/Linux, local iOS compilation and even the iOS Simulator are both impossible here. **EAS Build** (Expo Application Services) solves this by compiling both platforms in Expo's cloud — you push source, a Mac and a Linux box somewhere in Expo's infrastructure do the actual compiling, and you get back an installable file.

Android and iOS diverge sharply in cost, and it's worth understanding *why*, not just accepting it:

- **Android**: Google allows "sideloading" — installing any signed `.apk` directly, no store, no account, no fee. EAS just needs your project; free.
- **iOS**: Apple requires every piece of code running on a physical iPhone to be cryptographically signed with credentials tied to a **Apple Developer Program membership ($99/year)**. This is true whether or not the app ever reaches the App Store — the fee buys the *right to sign code for real devices at all*, not a store listing. The only fee-free alternative (a personal Apple ID signing through Xcode) both requires a Mac and expires every 7 days, so it's not viable for us either way.

### 2.5 Never touching the App Store — technically real, one caveat

You asked specifically to confirm the app can live forever as a direct install, never submitted to a store. **Confirmed, for both platforms** — EAS's "internal distribution" produces installable files that bypass store review entirely by design (it's meant for exactly this: internal testers, not the public).

One asymmetry to know about: Android `.apk` files, once installed, **never expire**. iOS signing certificates expire on a roughly annual cycle (an Apple platform rule, unrelated to the App Store) — so once a year, the iPhone install needs a fresh `eas build` and reinstall. That's a *technical renewal*, not a review process; nothing gets submitted or approved by anyone at Apple, it's the same self-service command as the first build.

### 2.6 Why `expo start --web` isn't a real test, even though it's tempting

Web feels like it should be a shortcut — no phone, no build, instant reload. It's genuinely useful for iterating on layout and logic quickly. But it's running through `react-native-web`, which *maps* native components onto DOM/CSS rather than rendering them natively, and Reanimated falls back to a JS-driven web shim instead of running on the actual UI thread — the exact mechanism from Session 1.6 that makes animations smooth on a real device doesn't apply on web. A shake or a GIF loop can *look* fine in a browser tab and still behave differently on the device it's actually meant for. Treat web as a fast draft tool, not a verification step — your instinct that it shouldn't replace real testing was correct.

---

## Session 3 — 2026-07-14 · Actually leaving Expo Go: EAS setup and the first cloud build

Session 2 was the *decision* to switch to development builds. This session is the *execution* — installing the pieces, authenticating, and producing an installable Android build.

### 3.1 `expo-dev-client` — the package that makes a dev build possible

Installed via `npx expo install expo-dev-client`. This single package is what turns "a normal compiled app" into "a normal compiled app that also knows how to find and load your Metro server," the same job Expo Go did, minus the version cap. `npx expo install` (vs. plain `npm install`) matters here: it looks up the version of the package that's actually compatible with our SDK 57, the same way `expo install` always resolves native-module versions correctly instead of just grabbing `latest`.

### 3.2 `eas-cli` and `eas login` — an Expo account, not a device account

`eas-cli` is a separate command-line tool from the `expo` CLI we'd used so far — it talks to Expo's cloud build servers (EAS), not your local Metro server. We ran it via `npx eas-cli@latest` rather than a global install, which is generally the safer default: no stale global version silently drifting out of sync with what a project needs.

`eas login` authenticates the **CLI on your laptop** with your Expo account — not a per-phone thing, not related to the Google/Apple account on your device. One login on your machine is enough to build for both Android and iOS, and later, to invite your girlfriend as a collaborator on the same EAS project if we want her building too.

Checking who's logged in:

```bash
npx eas-cli@latest whoami
# orhunsez / orhunsez@gmail.com
```

### 3.3 `eas build:configure` — linking the local project to a cloud project

Running `eas build:configure -p android` did two things, visible as file diffs:

- **Created `eas.json`** — build *profiles* (`development`, `preview`, `production`), each a named bundle of build settings. Ours came pre-filled with sane defaults: `development` sets `developmentClient: true` (bakes in the dev-client behavior from §3.1) and `distribution: internal` (no store, ever — see PLAN.md §5). This is the same idea as `package.json` scripts: instead of typing build flags every time, you name a profile and reuse it (`eas build --profile development`).
- **Added `extra.eas.projectId` to `app.json`** — a UUID that's the *only* link between this folder on your laptop and a project record on Expo's servers. That's why `expo.dev` immediately showed the project in your browser: the CLI created the cloud-side project and stamped its ID into our local config in the same step. Delete that field and this folder becomes disconnected from EAS entirely — it's the whole relationship in one string.

### 3.4 The `android.package` error — interactive vs. non-interactive tooling

I ran the actual build with `--non-interactive` (so it wouldn't hang waiting for terminal input I couldn't provide from here), and it failed immediately:

```
The "android.package" is required to be set in app config when running in non-interactive mode.
```

This is a good example of a general pattern in CLI tools: **interactive mode and non-interactive mode aren't the same tool with a flag toggled — they have different validation rules.** Run `eas build` normally in your own terminal and it would have *asked* you "what package name?" and written the answer for you. Run it with `--non-interactive` and it refuses to guess — it fails loudly instead of picking a default you didn't approve.

The fix was adding `"package": "com.orhunsez.twocats"` under `android` in `app.json`. This is Android's **application ID** — a reverse-DNS string (read right-to-left: "twocats app, made by orhunsez") that uniquely identifies the app *on the device itself*, separate from its human-readable name. Two apps can both be called "two-cats"; only one can hold a given package ID on a phone at a time. iOS has the equivalent concept (`bundleIdentifier`) — we'll set that when the iOS build comes up.

### 3.5 What the cloud build actually does

`eas build --profile development --platform android` uploads the project to Expo's build servers, where a real Android build environment (the same tools Android Studio uses locally — Gradle, the Android SDK) compiles our JS/TS + native dependencies into an installable `.apk`. This is the direct payoff of Session 2.4's Mac/Linux constraint discussion: we never touch Gradle or an SDK manager ourselves, because none of that exists on this machine — it exists in Expo's infrastructure instead. Build progress and the final download link/QR show up both in the terminal and at `expo.dev`.

### 3.6 What changes day-to-day after this

Once the `.apk` is installed on your phone, the workflow from Session 1.5 is otherwise unchanged:

```bash
npm run tunnel   # or: npx expo start
```

The only difference: instead of opening **Expo Go** and scanning the QR, you open the **two-cats dev client** app icon that's now on your home screen and scan the same QR from inside it. Same Metro server, same tunnel, same hot reload — just an app icon that's ours instead of Expo's, and immune to the SDK-cap that started this whole detour.

*Next session: once the Android build link is confirmed working on your phone, either Phase 2.6 (snuggle home) or Phase 3 (animation juice) — your call.*

---

## Session 4 — 2026-07-14 · Phase 2.6: the snuggle home, and the most important lesson in this file

The app got its intended shape: `/` shows both cats coexisting in one shared scene, and a "care for the cats" button slides up `/care`, where the old two-card screen now lives. Small diff, but it contains the single most transferable idea so far.

### 4.1 Derived state — the lesson worth the whole session

The obvious way to build "the cats are snuggling" is to make `snuggling` a new FSM state, or a `currentScene` field in the store. We did **neither**, and the reason is a rule you'll use for the rest of your career:

> **If a value can be computed from state you already have, compute it. Never store it.**

Nobody *triggers* snuggling — it's just what "both cats idle" looks like. "Luna lingers around sleeping Mango" is just what `(idle, sleeping)` looks like. So the scene is a **pure function of the two states** ([src/features/cat/duo.ts](src/features/cat/duo.ts)):

```ts
getDuoScene(black: CatState, orange: CatState): DuoSceneId
```

Why storing it would be a bug factory: a stored `scene` is a *second source of truth*. Feed a cat and forget to update the scene → the store now says "snuggling" while a cat is eating. Every stored-but-derivable value grows an army of "remember to update it here too" call sites — that's function soup's cousin, *state soup*. A derived value **cannot desync, by construction**. And in Phase 5 this pays off double: Supabase only ever stores the two cat states, and both phones derive identical scenes for free.

Contrast with Phase 6's CUDDLE, which *will* be an FSM state — because cuddling is user-triggered, timed, and interruptible: genuinely *new* information that can't be derived. That's the test: **can I compute it? → derive. Is it new information? → store.**

### 4.2 The second screen cost ~zero navigation code

[src/app/care.tsx](src/app/care.tsx) existing *is* the routing — Expo Router turns the file path into the `/care` route (Session 1.2). Navigation is a `<Link href="/care" asChild>` wrapping our own `<Pressable>` (`asChild` = "make my child the touchable instead of rendering your own"), and `router.back()` for the return trip. Android's hardware back button works automatically, because a Stack navigator maintains a real history.

**Typed routes caught a "bug" before it existed:** `tsc` initially *rejected* `href="/care"` — Expo Router generates a type listing every route that exists, and the generated file hadn't been refreshed since before `care.tsx` was created (it regenerates when Metro boots). A typo like `href="/carre"` would be caught at compile time forever. This is why we ran `expo start` for a few seconds mid-session: to regenerate that file — not to test anything.

### 4.3 "Smooth transition" = two layered animations

- **The screen itself**: `animation: 'slide_from_bottom'` on the care screen ([_layout.tsx](src/app/_layout.tsx)) — one native-stack option instead of the default sideways push. (PLAN.md originally said "shared-element transition"; Reanimated 4 dropped that experimental v3 API, so this is the pragmatic version.)
- **The content**: each `CatCard` enters with `FadeInDown.delay(index * 120).springify()` — a Reanimated **entering animation**, a declarative one-liner you attach to `Animated.View`. The 120ms stagger is a classic bit of motion design: things arriving *slightly* apart read as alive; things arriving simultaneously read as a page load.

New Reanimated vocabulary in [DuoScene.tsx](src/features/cat/components/DuoScene.tsx): `withRepeat(withSequence(...), -1)` — the `-1` means "forever" — gives the emoji placeholder a gentle breathing bob. Same worklet machinery as Session 1.6's shake, new composition.

### 4.4 The lint error that made the code better

First draft picked a random art variant with `Math.random()` during render. The React Compiler's lint rejected it: **render must be pure** — same inputs, same output, every time. React reserves the right to re-render whenever it wants; impure renders reshuffle things at random moments.

The fix wasn't to silence the rule but to find a *deterministic seed that changes exactly when we want a reshuffle*: `(black.stateStartedAt + orange.stateStartedAt) % variants.length`. Re-renders now can't reshuffle mid-scene — and in Phase 5, both phones will compute the **same** variant, because `stateStartedAt` will come from the server. A lint error, followed honestly, accidentally designed the multiplayer feature. Purity keeps paying like that.

### 4.5 Variants as arrays — designing the manifest for art that doesn't exist

You said "multiple different animations per phase," so `DUO_GIFS` maps each scene to an **array** (`number[] | null`) instead of a single file. The pick-one-variant logic is already written and tested against `null`; when art lands, it's purely a data change. Designing the data shape for the *known future* (arrays) while shipping the *present* (null + emoji) is the registry pattern doing its job — see PLAN.md §6.2 for the exact swap steps.

*Next session: real art in the manifest (PLAN.md §6.1 for generation options), then Phase 3 juice — hearts on successful actions, button squishes.*

---

## Session 5 — 2026-07-15 · One screen, "always together", and a lesson in combinatorics

Two things happened: the first batch of real art arrived (9 pixel-art images), and looking at them triggered a design change — every image shows *both cats together*, so the app collapsed from two screens to one. The care screen and the solo `CatCard`/`CatSprite` components were **deleted**. This session is as much about what we removed as what we added.

### 5.1 Deleting code is a feature

We built `care.tsx`, `CatCard`, and `CatSprite` last session and threw them away this session. That's not waste — it's the design working. The art told us the truth: these cats are a pair, never soloists. Keeping a solo-cat rendering path "just in case" would be dead weight that every future change has to keep working. **Code you can delete cleanly is a sign the boundaries were drawn well** — `CatSprite` came out in one piece because nothing else reached into it. Chasing "what if we need it later" is how a codebase rots; delete now, and git remembers it if we're ever wrong.

### 5.2 The combinatorial explosion (and why the resolver already handled it)

Here's the real computer-science lesson. Two cats, five states each = **5 × 5 = 25 possible pairings**. If we tried to store "the current scene" as its own piece of state, we'd have 25 cases to keep in sync every time either cat moved. Instead the scene is a *pure function of the two states* ([duo.ts](src/features/cat/duo.ts)):

```ts
getDuoScene(black: CatState, orange: CatState): DuoSceneId
```

We have art for ~8 of the 25 pairings. The resolver is an ordered list of `if` checks, most-specific first, ending in a catch-all `return 'apart'`. Pairings with art get their scene; the other ~17 fall through to an emoji. **This is the same "derive, don't store" rule from Session 4.1, now earning its keep at scale** — 25 combinations would be genuinely painful to hold as state, and completely free to compute.

Ordering matters and teaches how `if`-chains encode priority: `grooming_other` is checked *first* because "Luna is licking Mango" is the whole picture regardless of what Mango is technically doing. General rule for resolver chains: **most-specific and most-dominant cases first, catch-all last.**

### 5.3 Why we split GROOM into two events

`GROOM` became `GROOM_SELF` and `GROOM_OTHER`. This is the registry pattern's promised expandability made real (Session 1.4 claimed "a new activity is one FSM row + one registry entry" — here's the receipt):

- **fsm.ts**: `grooming` → `grooming_self`, plus a new `grooming_other` state and `GROOM_OTHER` event. The `Record<CatState, ...>` type immediately flagged every table that needed the new state — follow the red squiggles, done.
- **registry.ts**: one new `CAT_ACTIONS` entry, one `STATE_DURATION_MS` entry, one `STATE_LABEL`. The button appeared on screen with zero UI code written.

Design restraint worth noticing: `grooming_other` is a **pure per-cat state** — Luna grooming Mango only changes *Luna's* state; it doesn't reach across and modify Mango. A true two-way joint action (both cats' rows changing together, guarded by "both idle") is genuinely harder, and we deliberately deferred it to `CUDDLE` in Phase 6 where the mutual semantics are actually required. **Don't build the hard general version until a feature needs it** — `grooming_other` got us the "one cat grooms the other" art for the cost of a normal state.

### 5.4 One `ref`, one shake, moved to the scene

With no solo sprite, the refusal shake had nowhere to live — so it moved onto `DuoScene` itself. Same `useImperativeHandle` pattern as before (Session 1.8), but now interesting because the scene *already* had an animation running: a slow breathing `bob` on `translateY`. The shake is `translateX`. They compose in one `useAnimatedStyle`:

```ts
transform: [{ translateX: shakeX.value }, { translateY: bob.value }]
```

Two independent shared values, two independent animations, one transform — they don't fight because they drive different axes. That's the Reanimated mental model: **animate values, not components; a component's style is just a function of however many values you point at it.**

### 5.5 Images aren't GIFs, and that's fine

Your art came as `.jpg` stills, not animated GIFs. `expo-image` renders JPG/PNG/WebP/GIF through the *same* component — a still just doesn't move. So the app shows real art *now*, and "animate it later" is literally swapping a file at the same path in the manifest, no code change. Shipping the still and upgrading to motion later is a good instinct: **get the real thing on screen at 80%, then polish** beats waiting for perfect animated assets before you can see your app.

*Next session: Phase 3 juice — floating hearts when an action lands, a press-squish on the buttons — and generating the missing `lingering`/`apart` scene art.*

---

## Session 6 — 2026-07-15 · Choreography: when one cat's action moves the other

You added two rules — *"if a cat eats, the other grooms itself"* and *"if a cat grooms the other, the groomed one falls asleep"* — and re-drew the art so every image is a precise `(black, orange)` state pair. Two design ideas did the heavy lifting: **a reaction layer that keeps the FSM pure**, and **a lookup table that replaced a chain of `if`s**.

### 6.1 Where cross-cat rules are allowed to live

The FSM ([fsm.ts](src/features/cat/fsm.ts)) is *per-cat*: `transition(state, event)` knows one cat and nothing else. That purity is precious (testable, server-reusable), so a rule like "feeding Luna makes Mango groom himself" — which by definition touches *two* cats — **cannot** live there without poisoning it.

The right home is one layer up: the **store**, which owns *both* cats. So `catStore.send` gained a small choreography step — after a cat's action succeeds, it nudges the partner. The layering rule to internalize: **keep the core model unaware of its neighbors; put cross-entity rules in the coordinator that already holds all the entities.** Same reason the FSM doesn't call Supabase — each layer only knows what it must.

### 6.2 Reactions as data (again), and two subtle guards

True to the registry pattern, the rules are *data*, not code ([registry.ts](src/features/cat/registry.ts)):

```ts
export const PARTNER_REACTIONS: Partial<Record<CatEvent, CatEvent>> = {
  FEED: 'GROOM_SELF',    // one eats → the other grooms itself
  GROOM_OTHER: 'SLEEP',  // one grooms the other → the groomed one falls asleep
};
```

Adding "when A does X, B does Y" is one line. But two guards make it safe, and both are worth understanding:

1. **Best-effort, not forced.** The reaction goes through the partner's own `send`, so the partner's FSM can still *reject* it (you can't `GROOM_SELF` a cat that's mid-meal). We let the rule quietly no-op rather than forcing an illegal state. Honest rules that degrade beat rules that lie.
2. **One hop, no chains.** `send(catId, event, isReaction)` carries a flag; a reaction-triggered `send` passes `isReaction = true` and *skips* firing further reactions. Today neither reaction target (`GROOM_SELF`, `SLEEP`) is itself a trigger, so nothing would loop — but relying on "the data happens not to cycle" is how you get an infinite loop six months later. The flag makes the guarantee **structural** instead of accidental. General instinct: when something can recurse, cap the recursion at the mechanism, not by trusting the inputs.

### 6.3 The art *is* the spec — reactions exist to reach it

Here's the elegant part of your design. You drew the art as exact pairs, e.g. `black_eats_orange_grooms_itself` = (eating, grooming_self). The reactions are precisely what *drive the cats into those pairs*: pressing **Feed Luna** puts Luna in `eating` and — via the reaction — Mango in `grooming_self`, which is exactly the pair that image depicts. Same for grooming: **Luna grooms Mango** → Luna `grooming_other`, Mango `sleeping` → the `black_grooms_orange` frame (where Mango is asleep, just as you drew him). The behavior and the art were designed to meet in the middle. That's real game design: **mechanics and art agreeing on the same state.**

### 6.4 From an `if`-chain to a lookup table

Last session's resolver was an ordered stack of `if`s. Now that each scene is an exact pair, it became a **table** ([duo.ts](src/features/cat/duo.ts)):

```ts
const SCENE_BY_PAIR: Record<string, DuoSceneId> = {
  'idle|idle': 'snuggling',
  'eating|grooming_self': 'black_eats',
  // ...
};
getDuoScene = (b, o) => SCENE_BY_PAIR[`${b}|${o}`] ?? 'apart';
```

Two things to take away. First, **when branches are just "input → output" with no ordering logic, a table beats `if`s** — it's data you can read at a glance, and the `?? 'apart'` makes the fallback explicit. Second, the key is `` `${b}|${o}` `` with a `|` separator *because state names contain underscores* — `grooming_self` + `sleeping` naively glued as `grooming_self_sleeping` is ambiguous; `grooming_self|sleeping` can't be misread. Choosing a separator that can't appear in your data is a tiny habit that prevents a real class of bug.

(One deliberate exception survives as two `if`s below the table: `grooming_other` "wins" regardless of the partner, because one cat grooming the other dominates the frame. Tables for the exact cases, a rule for the genuinely-general one.)

### 6.5 What this bought, and the gap it exposed

Every one of your 10 images is now wired to the exact pair it depicts, including the two `lingering` frames that were emoji last session. But making the mapping *exact* also made one gap precise: **grooming a cat while its partner is awake** — `(grooming_self, idle)` — has no art, because every grooming-self image you drew shows the partner *asleep*. It falls back to emoji. That's not a bug; it's the honest consequence of exact mapping, and it's exactly the kind of thing worth surfacing rather than hiding behind a close-enough image. The fix is a product decision (draw it / reuse the asleep art / add a rule), noted in PLAN.md §6.

### 6.6 Housekeeping: Windows `Zone.Identifier` files

The art arrived from Windows carrying `*:Zone.Identifier` sidecar files — NTFS "mark of the web" metadata that tags downloaded files. Harmless but junk in a repo, and one had leaked in with no matching image. Removed them and added `*:Zone.Identifier` to `.gitignore`. Small thing, but keeping non-source cruft out of version control is part of the same hygiene as never committing `node_modules`.

*Next session: Phase 3 juice — hearts when an action lands, button squish — and closing the `(grooming_self, idle)` art gap.*

---

## Session 7 — 2026-07-15 · Responsive sizing and why layouts overflow

Small session: you closed the `(grooming_self, idle)` art gap (grooming-self now has partner-idle art, not just partner-asleep), and asked for two fixes that are really one lesson — **how React Native sizing actually works.**

### 7.1 Making the scene image bigger — fixed px vs. responsive

The image was `width: 280, height: 200` — **fixed pixels**. On a big phone that's small and marooned in whitespace; on a tiny phone it might be too wide. Fixed pixels can't be "big" everywhere because screens differ.

The fix is to size *relative to the parent* instead:

```ts
stage: { width: '100%', aspectRatio: 1 },   // was height: 200
gif:   { width: '100%', height: '100%' },   // was width: 280, height: 200
```

Two ideas here:

- **`width: '100%'`** means "as wide as my parent allows" — the image now grows and shrinks with the card, which grows with the screen. Percentages are the backbone of responsive layout.
- **`aspectRatio: 1`** means "make height equal to width" (a ratio, `1` = square). So instead of hard-coding a height, the box *derives* its height from its actual width — on every phone it stays a clean square. Set `aspectRatio: 16/9` for widescreen, etc. This is the layout cousin of Session 4.1's "derive, don't store": don't pin a number you can compute from another one.

`contentFit="contain"` (Session 1.7) then fits each image inside that responsive box without distortion — a wide image just gets letterbox bars, never a stretch.

Rule of thumb: **fixed pixels for things that shouldn't scale (borders, icon-ish elements), percentages + `aspectRatio` for things that should fill space (media, cards).**

### 7.2 The feed button "crashing into the edge" — the missing `flexWrap`

Each cat's `ActionBar` is a row of up to four buttons (`Feed`, `Groom self`, `Groom partner`, `Sleep`). The row was:

```ts
row: { flexDirection: 'row', justifyContent: 'center' }
```

On a narrow phone those four buttons are wider than the screen. Here's the non-obvious part: **`justifyContent: 'center'` centers overflow too** — when content is wider than its container, centering pushes *both* ends past the edges equally, so the leftmost button (Feed) slides off the left side. It wasn't a margin bug; it was overflow with nowhere to go.

The fix is one line — `flexWrap: 'wrap'`:

```ts
row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }
```

`flexWrap` lets buttons that don't fit **drop to a second row** instead of overflowing sideways. Now everything stays within the screen's padding, centered, on as many rows as needed. (`gap` already handles spacing on both axes, so the wrapped row is spaced correctly for free.)

The general lesson: in flexbox, a single row does **not** wrap by default — if you ever see content clipped or shoved off one edge, `flexWrap` is the first thing to reach for. Overflow is the default; wrapping is opt-in.

*Next session: Phase 3 juice for real — hearts on a landed action, a press-squish on the buttons.*
