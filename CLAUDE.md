# CLAUDE.md

Guidance for agents working in this repository. Keep it current: a stale entry here is worse than
no entry, because it is trusted without checking.

## Project

An Expo starter that keeps a reusable application foundation and leaves product-specific native
capabilities out. It is a template — code here is copied into real apps, so a shortcut taken here
is a shortcut inherited by every app built from it.

`README.md` explains what exists and why. This file covers how to work in it.

## Tech stack

Expo SDK 57 · React Native 0.86 · React 19 · TypeScript (strict) · React Navigation 7 ·
TanStack Query 5 · NativeWind 4 · Jest + jest-expo · Sentry · PostHog

## Commands

```bash
npm run check              # Everything CI runs: types, coverage, lint, dead code, bundle budget
npm run typecheck          # tsc --noEmit
npm test                   # Jest
npm run test:coverage      # With enforced coverage thresholds
npm run lint               # eslint + prettier --check
npm run format             # Apply eslint --fix and prettier --write
npm run check:knip         # Dead code and unused dependencies
npm run check:web-bundle   # Web export against the size budget
npm start                  # Expo dev server
```

Run `npm run check` before claiming work is done. A pre-commit hook runs typecheck, lint, and tests;
Knip and the web export only run in `check` and CI.

## Layout

```text
App.tsx                     Entry point. Import order matters — see below.
app.config.ts               Build-time identity and `extra`; validates the EAS environment
src/components/             Presentation primitives
src/hooks/                  Shared hooks
src/lib/                    Framework-independent state and infrastructure
src/navigation/             Typed stack and tabs, deep-link config
src/observability/          Analytics, error reporting, consent, lifecycle, global handlers
src/observability/adapters/ Sentry and PostHog — the only files naming a vendor
src/providers/              Theme and server-state providers
src/screens/                Example screens
```

Group product code by feature as an app grows (`src/features/orders/`), and keep these directories
for what is genuinely shared.

## Conventions

- **Strict TypeScript.** No `any`. Narrow, or define the type.
- **Path alias**: `@/*` → `src/*`.
- **Styling**: NativeWind classes, not `StyleSheet`. Use theme tokens (`bg-surface`, `text-muted`,
  `border-border`, `text-error`, `bg-primary`, `text-primaryContrast`) — they resolve per colour
  scheme. Hardcoding a hex breaks dark mode silently.
- **Comments explain _why_, never _what_.** Prefer none to a restatement of the code. The comments
  worth writing record a decision, a constraint, or a trap someone would otherwise reintroduce.
- **Tests assert behaviour, not implementation.** Name the guarantee, not the function.
- **User-facing errors** go through `friendlyErrorMessage()`. Never render `error.message` — it
  leaks backend paths and status codes into the UI and into analytics.
- **Web parity**: the web target is real. Anything native-only needs a `Platform.OS` guard or a
  `.web.tsx` file, and new dependencies count against the web bundle budget.

## Things to avoid

- Don't call `fetch` directly from a screen. Use TanStack Query, and `requestJson` for the call, so
  failures become typed `AppError`s with timeouts and cancellation handled.
- Don't add a second retry or backoff policy. `retryPolicy.ts` is shared by the query client and
  `withRetry`; a second one drifts and eventually disagrees about `Retry-After`.
- Don't render `data === undefined` as an empty list. Use the components in `QueryState.tsx` —
  "we don't know" and "there is nothing" are different answers.
- Don't import a vendor SDK outside `src/observability/adapters/`. Application code talks to the
  `analytics` and `errorReporter` facades.
- Don't track an event without adding it to `AnalyticsEventMap`, and never put credentials, tokens,
  or personal content in event properties.
- Don't set `meta.persist` on a query holding tokens, credentials, or sensitive records.
- Don't reorder the imports at the top of `App.tsx`. `@/observability/setup` must be evaluated
  before other application modules or startup crashes go unreported, and
  `installExpoFetchCancelGuard()` must run before the first request.
- Don't change `DEFAULT_ANALYTICS_CONSENT` casually — it is a legal posture, not a default. The
  opt-out model holds only while the data stays anonymous.
- Don't raise the web bundle budget to make a build pass. It is a ratchet; raise it deliberately,
  in the change that needs it, with a reason.
- Don't commit generated `ios/` or `android/` directories, or `.env.local`.

## Gotchas worth knowing

- **EAS never sees `.env.local`.** It uploads the git-tracked project. Identity must also live in
  `eas.json` or EAS environment variables; `app.config.ts` fails the build rather than shipping a
  misnamed binary.
- **Coverage thresholds are enforced.** New code without tests can fail the build even when every
  existing test passes.
- **`expo-store-review` has no config plugin.** Listing it in `plugins` makes Expo try to load the
  module as one and breaks config resolution entirely.
- **PostHog's `reset()` clears its opt-out flag**, which then falls back to `!defaultOptIn`. The
  adapter re-asserts consent after every reset; keep that if you touch it.
