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
