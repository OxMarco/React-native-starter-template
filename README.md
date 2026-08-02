# React Native Starter

A small, production-minded Expo starter extracted from a shipped React Native architecture. It
keeps the reusable application foundation and leaves product-specific native capabilities out.

## Included

- Expo SDK 57, React Native 0.86, React 19, and strict TypeScript
- Typed native-stack and bottom-tab navigation, with deep links gated on onboarding
- NativeWind with persistent system, light, and dark themes
- Splash-screen handoff with a startup timeout, so a wedged read cannot block launch
- TanStack Query with separate read-cache and durable, ordered offline-mutation persistence
- NetInfo lifecycle integration and an app-wide confirmed-offline banner
- Typed operational errors, request timeouts, and transient-only retry policy
- Consent-gated typed analytics and vendor-neutral error-reporting adapters
- Global JS error and unhandled-rejection capture, including in release builds
- Reusable persisted settings, screen layout, buttons, cards, and error boundaries
- Enforced coverage and web-bundle budgets alongside TypeScript, Jest, ESLint, Prettier, and Knip
- GitHub Actions CI and environment-driven Expo/EAS identity
- iOS, Android, and web entry points from the same project

## Deliberately not included

- Maps, location, background tasks, notifications, weather, or domain APIs
- Analytics and crash-reporting vendors
- Authentication, payments, or a backend client
- App icons, splash artwork, signing credentials, Firebase files, or EAS project identifiers

This keeps the default app runnable in Expo Go without requesting device permissions. Add native
capabilities when a product actually needs them.

## Create a new app

Copy this directory to a new repository, then run:

```bash
npm run init
npm install
npm start
```

Use Node 22.13 or newer; `.nvmrc` pins the current Node 24 toolchain used by CI.

`npm run init` prompts for the display name, Expo slug, deep-link scheme, and native application
identifiers, validating each against the format its platform actually accepts. Writes use temporary
files plus atomic renames, and an existing `.env.local` keeps unrelated values such as API URLs and
the EAS project id. Identity is written to three places:

- `.env.local` — gitignored, read by the Expo CLI for local builds
- `eas.json` (`build.base.env`) — committed, read by EAS for cloud builds
- `package.json` — the package name

Both files are written because **EAS Build never sees `.env.local`**: it uploads the git-tracked
project, and that file is ignored. Identity kept only there silently falls back to the
`com.example.` placeholders in the cloud. `app.config.ts` fails the build with that instruction
rather than producing a misnamed binary. If you prefer EAS's own environment variables, publish the
same keys with `eas env:create` and delete the `base` profile's `env` block.

Before a production build:

1. Replace the placeholder identifiers if you did not run the initializer.
2. Add app icon, adaptive icon, splash, and favicon assets to `app.config.ts`.
3. Run `npx --yes eas-cli@21.4.0 init` for a new EAS project and add its project id to
   `.env.local` as `EAS_PROJECT_ID`. EAS Build supplies `EAS_BUILD_PROJECT_ID` automatically.
4. Configure new signing credentials and store records for the new application.
5. Choose and add analytics or crash reporting only if the product needs them.
6. Review privacy manifests, permissions, and store disclosures after adding native modules.

Every EAS build fails fast when any of the five identity variables is absent. Production builds
also reject every starter placeholder, including the app name, slug, and scheme—not just the native
identifiers. The app version comes from `package.json`; EAS owns the build number
(`appVersionSource: remote`). Development, preview, and production profiles explicitly select their
matching EAS environment, and the pinned CLI version in `eas.json` prevents build-tool drift.

## Commands

```bash
npm start                  # Start Expo
npm run ios                # Open the iOS target
npm run android            # Open the Android target
npm run web                # Open the web target
npm run export:web         # Produce the static Metro web export in dist/
npm run check:web-bundle   # Export web and enforce JavaScript/CSS size budgets
npm run check              # Coverage, types, lint/format, dead code, and web bundle budget
npm run test:coverage      # Test with a coverage report over all of src/
npm run format             # Apply ESLint and Prettier fixes
npm run doctor             # Validate Expo dependencies and configuration
npm run build:preview      # Internal EAS builds
npm run build:production   # Store-ready EAS builds
```

The smoke flow in `.maestro/smoke.yaml` clears app state, completes onboarding, and opens Settings.
Run it against an installed build with `APP_ID=com.acme.app maestro test .maestro/smoke.yaml`.
Dependabot covers npm and GitHub Actions updates; CI actions are pinned to commit SHAs.

## Structure

```text
App.tsx                    Thin application entry
app.config.ts              Environment-driven native identity and Expo config
src/components/            Reusable presentation primitives
src/hooks/                 Shared React hooks
src/lib/                   Framework-independent state and infrastructure
src/navigation/            Typed stack and tabs, and the deep-link configuration
src/observability/         Analytics, error-reporting, consent, and global handlers
src/providers/             Theme and server-state providers
src/screens/               Example welcome, home, and settings screens
```

Keep product code grouped by feature once the app grows—for example,
`src/features/account/` or `src/features/catalog/`—and reserve these shared directories for code
used across multiple features.

## Navigation, deep links, and startup

`src/navigation/linking.ts` maps the app's scheme onto the tab routes. Add new routes to its
`config.screens` to make them addressable.

Deep links are gated on onboarding. React Navigation builds its initial navigation state directly
from a cold-start URL, so on a fresh install a link would otherwise land on its target and skip the
Welcome screen entirely—along with anything that screen is responsible for, such as accepting
terms. Any URL arriving before onboarding completes is parked and replayed once the navigator
leaves the onboarding routes. The gate covers native cold starts, warm links, and web paths (where
React Navigation reads `window.location` directly). Add a route to `ONBOARDING_ROUTES` when you add
an onboarding step.

Startup waits on two AsyncStorage reads (theme preference and the onboarding flag) behind the
native splash screen. Neither is guaranteed to settle, so the wait is capped at ten seconds and the
app starts on defaults rather than sitting on the splash forever.

Screens use the shared `Screen` component, which applies all four safe-area insets by default. Tab
screens must pass `edges={TAB_SCREEN_EDGES}`: the tab bar already consumes the bottom inset, and
applying it twice leaves a visible gap above the bar.

## Adding API data

Create a typed API function and consume it through TanStack Query rather than calling `fetch`
directly from a screen:

```ts
const result = useQuery({
  queryKey: ['items'],
  queryFn: ({ signal }) => getItems(signal),
});
```

The query provider already responds to connectivity and app foreground changes. Queries retry only
transient network, timeout, rate-limit, and server errors, using bounded exponential backoff. Use
the shared JSON client so HTTP status, request ids, `Retry-After`, timeouts, and cancellation become
typed `AppError` values:

```ts
const result = useQuery({
  queryKey: ['items'],
  queryFn: ({ signal }) =>
    requestJson('https://api.example.com/items', {
      signal,
      decode: decodeItems,
    }),
  meta: {
    operationName: 'list_items',
    persist: true,
  },
});
```

`requestJson` deliberately returns `unknown` unless a decoder validates the response. A decoder can
be a small hand-written guard or a schema library adapter, but it must turn `unknown` into the type
the feature consumes; a TypeScript generic alone does not validate untrusted JSON. Decoder failures
become non-retryable `response-validation-failed` errors. For a successful 204/205 endpoint, pass
`expectEmpty: true` instead. The client also validates timeout values and preserves whether an abort
came from its timeout or the caller.

Persistence is denied by default. A successful query is stored only when `meta.persist` is `true`
and `meta.sensitive` is not `true`. Cached reads expire after 24 hours. The mutation outbox is stored
separately and retained for 30 days, so query-cache expiry can never silently discard a queued
write. Each store has its own schema buster and corruption handling. Never persist tokens,
credentials, sensitive user records, or very large responses. `clearPersistedServerState()` clears
memory, the read cache, and the outbox.

## Error handling and retries

`src/lib/appError.ts` classifies failures as network, timeout, authentication, authorization, not
found, validation, rate limit, server, cancellation, or unknown. Each `AppError` carries safe user
copy, retryability, and optional status, code, request id, and retry delay without exposing backend
messages to the UI.

Classification reads a structured `status` (or `response.status`) first, then transport failures by
their message, and only then falls back to parsing a status out of the text—and that fallback is
anchored to phrasings that actually state one (`status 503`, `Request failed (404)`). Keep it that
way: a looser scan reads the numbers that routinely appear in transport errors—ports, hostnames,
retry counts—as HTTP statuses, which is how `Unable to resolve host … after 300 attempts` once
became a non-retryable `unknown` instead of a retryable `network` failure.

React Query reports final query and mutation failures through the observability adapters. Expected
operational failures become analytics and breadcrumbs; unexpected and server failures also reach
the error reporter. Successful retries are tracked separately from final failures. Mutations do not
retry unless a feature explicitly opts in.

## Observability and analytics

The starter ships no analytics or crash-reporting SDK. Configure adapters once, before rendering
the app:

```ts
configureObservability({
  analytics: {
    track: (event, properties) => analyticsSdk.track(event, properties),
    identify: (userId, traits) => analyticsSdk.identify(userId, traits),
    reset: () => analyticsSdk.reset(),
  },
  errors: {
    captureException: (error, context) => crashReporter.captureException(error, context),
    addBreadcrumb: (message, properties) => crashReporter.addBreadcrumb({ message, ...properties }),
    setUser: (user) => crashReporter.setUser(user),
  },
});
```

Until an adapter is configured, calls are safe no-ops. Analytics additionally remains disabled
until the user grants consent in Settings. Withdrawing consent takes effect in memory immediately
and resets the analytics identity even if storage is unavailable. Granting consent and ordinary
settings publish to other subscribers only after their serialized AsyncStorage write succeeds;
failures stay visible in Settings and are sent to the error reporter.
Events are typed in `src/observability/types.ts` and automatically include platform, app/build
version, locale, environment, and a per-launch session id. Keys resembling credentials, tokens,
cookies, email, phone, or address data are redacted, and adapter failures never affect app behavior.

Crash reporting is separate from usage-analytics consent because products have different legal and
operational requirements. Decide whether to configure it, what context it may collect, and whether
it needs a separate consent control before shipping.

`installGlobalErrorHandlers()` captures what never reaches an error boundary: uncaught JS
exceptions via `ErrorUtils`, and unhandled promise rejections. React Native only tracks rejections
when `__DEV__` is true, so outside development the starter installs its own tracker (Hermes'
`enablePromiseRejectionTracker`, or the `promise` polyfill) and leaves the development one alone so
LogBox keeps working. Note that a DOM-style `unhandledrejection` listener does **not** work on
iOS or Android—React Native never dispatches that event—so it is used for web only.

## Offline mutations

Register every resumable mutation before `AppProviders` restores the persisted cache. The
registration supplies the function that cannot itself be serialized:

```ts
registerOfflineMutation(queryClient, {
  mutationKey: ['items', 'create'],
  operationName: 'create_item',
  mutationFn: ({ idempotencyKey, ...input }) =>
    requestJson('https://api.example.com/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(input),
      decode: decodeItem,
    }),
});
```

Features then use the registered key and add an idempotency key to each write:

```ts
const createItem = useMutation({ mutationKey: ['items', 'create'] });
createItem.mutate(withIdempotencyKey({ title: 'Example' }, 'create-item'));
```

Only registered mutations that pause while offline are persisted. Variables must include a
non-empty `idempotencyKey` and contain only losslessly JSON-serializable data. The server must store
and enforce the `Idempotency-Key`; generating a client key alone does not prevent duplicate writes.
Do not queue credentials or sensitive user data in unencrypted AsyncStorage. Paused mutations
resume in submission order after cache restoration and network reconnection. All registered
offline writes share one serial scope by default, preserving order across mutation keys. Supply a
`scopeId` only when two operation groups are genuinely independent and safe to replay concurrently.
Operations older than 30 days are discarded with an analytics event and error-reporting message
rather than disappearing silently.

## Theme tokens

`src/lib/theme.json` is the single source for palette tokens. TypeScript imports it through
`src/lib/theme.ts`, while Tailwind reads the same JSON directly, preventing utility classes and
runtime navigation/component colors from drifting apart. Keep light and dark palettes on the same
key set; TypeScript checks that invariant.

## Configuration and secrets

Only non-secret app identity belongs in `.env.local`. Expo variables prefixed with
`EXPO_PUBLIC_` are embedded in the JavaScript bundle and must never contain secrets. Store signing
keys and service credentials in the relevant EAS secret or file environment variables.
