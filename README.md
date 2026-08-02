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
- Typed analytics and error reporting behind vendor-neutral adapters, with Sentry and PostHog wired
  in and a single opt-out consent control that both obey
- Global JS error and unhandled-rejection capture, including in release builds
- Install, update, and foreground lifecycle events that are not the SDK's own
- On-device "update available" prompt read straight from the App Store and Play Store
- Rate-limited in-app store review prompt
- Reusable persisted settings, screen layout, buttons, cards, query states, and error boundaries
- Husky pre-commit hook, and a guard for the unhandled rejections Expo's own fetch emits on abort
- Shared retry policy for imperative calls, app-identity request headers, and a minute clock
- Enforced coverage and web-bundle budgets alongside TypeScript, Jest, ESLint, Prettier, and Knip
- GitHub Actions CI and environment-driven Expo/EAS identity
- iOS, Android, and web entry points from the same project

## Deliberately not included

- Maps, location, background tasks, notifications, weather, or domain APIs
- Authentication, payments, or a backend client
- Session replay, performance tracing, feature flags, and remote config — all deliberately switched
  off in the SDK configuration rather than merely unused
- App icons, splash artwork, signing credentials, Firebase files, or EAS project identifiers

This keeps the default app runnable in Expo Go without requesting device permissions. Add native
capabilities when a product actually needs them.

One caveat on Expo Go: `@sentry/react-native` has a native layer that Expo Go does not include. The
SDK detects that and runs JS-only, logging `Note: Native Sentry SDK is disabled` — the app still
starts, and nothing is sent from Expo Go anyway because reporting is off in development. Native
crash reporting (native crashes, ANRs) needs a development build or an EAS build, which is where it
matters.

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
5. Set `SENTRY_*`, `POSTHOG_*`, and `APP_STORE_ID` if you want crash reporting, analytics, and the
   update prompt; all three stay inert until then.
6. Confirm the analytics consent model. The starter defaults to opt-out, which holds only while
   the data stays anonymous — see "Consent" below.
7. Review privacy manifests, permissions, and store disclosures after adding native modules.

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

A Husky pre-commit hook runs typecheck, lint, and tests (about ten seconds). It deliberately skips
Knip and the web export from `npm run check` — a hook slow enough to invite `--no-verify` protects
nothing, and both are cheap to catch in CI. It also never rewrites files, so it cannot sweep an
unstaged edit into a commit you did not review.

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
src/observability/         Analytics, error-reporting, consent, lifecycle, and global handlers
src/observability/adapters Sentry and PostHog — the only files that name a vendor
src/providers/             Theme and server-state providers
src/screens/               Example welcome, home, and settings screens
```

Keep product code grouped by feature once the app grows—for example,
`src/features/account/` or `src/features/catalog/`—and reserve these shared directories for code
used across multiple features.

`CLAUDE.md` carries the conventions and traps worth knowing before changing anything here.

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

### Rendering a query

`src/components/QueryState.tsx` covers the four outcomes a query actually has, not the two it is
usually written as:

```tsx
if (query.isPending) return <QueryLoading />;
if (query.isError) return <QueryError error={query.error} onRetry={query.refetch} />;
if (!query.data) return <QueryUnavailable message="Orders aren't available offline." />;
if (!query.data.length) return <QueryEmpty message="You have no orders yet." />;
return <OrderList orders={query.data} />;
```

The distinction worth keeping is between `data === undefined` — no answer — and an empty array,
which is an answer. Rendering the first as the second tells someone "you have no orders" when the
request actually failed, and it is the state an offline launch with an empty persisted cache lands
in, where there is no error to show because the query never ran.

`HomeScreen`'s Release card is a worked example, wired to the store-version lookup that already
exists rather than to a mock backend — a fake API in a starter is something every app built from it
has to find and delete. All four outcomes are reachable there without contriving anything: no store
identity configured yet, a store that did not answer, a lookup in flight, and a real version. It
also shows why `useMinuteNow` exists: query data is referentially stable between fetches, so the
"checked N minutes ago" label would otherwise never update.

`withRetry`, `APP_IDENTITY_HEADERS`, and `maybeRequestReview` are deliberately left with no call
site. The first two need a backend to be worth demonstrating, and a review prompt belongs at a
moment of success in a real product — fired from a starter's example screen it would teach exactly
the wrong habit.

### Calling your own API

`APP_IDENTITY_HEADERS` (`src/lib/appIdentityHeaders.ts`) carries `X-App-Version` and
`X-App-Platform`, so a backend can tell which contract revisions are still live on devices. Store
builds sit on phones for months, and without this "is anything still reading this field?" is
unanswerable — which is how an API ends up only ever growing.

```ts
requestJson(url, { headers: { ...APP_IDENTITY_HEADERS }, decode });
```

It is not applied automatically, for two reasons: the starter assumes no backend, and on web a
custom request header triggers a CORS preflight, so a server that has not been told to allow these
would start failing every call. It deliberately carries no install or device id — it rides on every
request, which makes it the most tempting place in the codebase to add one.

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

For work that does not go through a query — a one-off call from an event handler, a startup task —
`withRetry` (`src/lib/withRetry.ts`) applies the same policy:

```ts
await withRetry(() => requestJson(url, { decode }), { signal });
```

It shares `retryPolicy.ts` with the query client rather than defining its own schedule, so both
paths agree on what is retryable and both honour `Retry-After`. Resist adding a second policy: the
day they diverge is the day one path backs off for two minutes and the other hammers the endpoint.
Errors are rethrown unchanged when attempts run out, so downstream classification still sees the
original failure rather than a wrapper.

## Observability and analytics

Application code only ever talks to the `analytics` and `errorReporter` facades. Sentry and PostHog
are named in exactly one place — `src/observability/setup.ts`, plus one adapter each under
`src/observability/adapters/` — so swapping either vendor touches two files and no call sites.
`setup.ts` is imported at the top of `App.tsx`, before any other application module, so a crash
during module evaluation or the first render is still reported.

Both vendors are optional. With no `SENTRY_DSN` the SDK initialises _disabled_ rather than being
skipped, so every downstream call stays a valid no-op; with no `POSTHOG_API_KEY` no analytics
adapter is registered at all. A fresh clone therefore runs unmodified, and adding a vendor later is
an environment change, not a code change.

### Consent

One user-facing switch in Settings governs both product analytics and crash reporting. The starter
ships an **opt-out** model: reporting is on by default and stays on until the user specifically
turns it off. That posture is a legitimate-interest one, and it holds only while the data stays
anonymous — which is why the adapters disable session replay and GeoIP resolution, leave
`sendDefaultPii` off, never call `identify`, and strip `event.user` in `beforeSend`. Add any of
that back and the model has to become opt-in. Treat the final consent copy, disclosures, and
data-retention policy as product-specific legal decisions before release.

Analytics capture starts on that default immediately — there is no pending state holding events
until the AsyncStorage read returns, so launch events are not delayed behind it. The tradeoff is
explicit: for the short window between launch and the stored preference resolving, a returning user
who turned reporting off is treated as the default. In practice PostHog persists its own opt-out
flag and re-applies it before capturing, so that user is usually still covered — but the guarantee
comes from the SDK, not from this code. Restoring a hard guarantee means reintroducing a pending
state in `observability.ts`, which is where that decision is documented.

Crash reporting is deliberately stricter. Sentry's `beforeSend` awaits the stored preference before
transmitting, because holding a crash report for a few milliseconds loses nothing, whereas holding
an analytics event was the delay this design gave up.

Withdrawal takes effect in memory immediately and opts the SDK out at its own level — gating the
facade alone is not enough, because PostHog keeps a persisted queue the facade never sees again.
The durable write is what makes it survive a relaunch, so a storage failure means the choice
applies for the session and then reverts; Settings says exactly that rather than reporting success,
and the failure reaches the error reporter.

Switching to opt-in is a one-line change: set `DEFAULT_ANALYTICS_CONSENT` in
`src/observability/analyticsConsent.ts` to `'denied'`. Every path reads that value rather than
assuming one, so nothing else moves.

### Events

Events are typed in `src/observability/types.ts` and automatically include platform, app/build
version, locale, environment, and a per-launch session id. Keys resembling credentials, tokens,
cookies, email, phone, or address data are redacted, and adapter failures never affect app behavior.

`src/observability/lifecycle.ts` emits install, update, and foreground/background events instead of
using an SDK's built-in lifecycle capture. Every SDK offers that, and it is a trap twice over: it
fires during SDK construction, before consent has been read, and it decides "is this a new build?"
from a version marker the SDK persists for its own purposes. Note the guard in
`captureLaunchLifecycle` — a missing marker only counts as an install when onboarding has _not_
completed, or the release that introduces this file reports a fresh install for every existing user.

`installGlobalErrorHandlers()` captures what never reaches an error boundary: uncaught JS
exceptions via `ErrorUtils`, and unhandled promise rejections. React Native only tracks rejections
when `__DEV__` is true, so outside development the starter installs its own tracker (Hermes'
`enablePromiseRejectionTracker`, or the `promise` polyfill) and leaves the development one alone so
LogBox keeps working. Note that a DOM-style `unhandledrejection` listener does **not** work on
iOS or Android—React Native never dispatches that event—so it is used for web only.

`installExpoFetchCancelGuard()` in `App.tsx` exists because of that reporting, not despite it.
Expo's `expo/fetch` — installed as the global `fetch` by the winter runtime — calls native
`cancelStreaming` from its stream-cancel callback without keeping a handler on the returned promise
(expo/expo#34772). Aborting is routine here: `requestJson` aborts on timeout, React Query aborts on
unmount, the store-version lookup has its own timeout. When an abort races response teardown the
native object is already released, the call rejects, and with nothing awaiting it the rejection
escapes — arriving in the error reporter as a crash report about a cancellation that succeeded. The
guard attaches the missing handler and changes nothing else. It is best-effort: if Expo renames the
module the patch stops applying and the rejections reappear, which is the signal to revisit.

## App updates and store review

`StoreUpdatePrompt` nudges users on an older binary to update. The published version is read
directly from the App Store and Play Store on-device (`src/lib/storeVersion.ts`), so there is no
backend and no remote-config service involved. It is mounted inside `RootTabs` rather than at the
app root, so the alert cannot interrupt onboarding, and it prompts at most once per session.

Configure `APP_STORE_ID` (and `APP_STORE_COUNTRY` if the app targets one market — Apple's lookup
answers per storefront). Android reuses `ANDROID_PACKAGE`. Without them the lookup returns null and
the prompt never appears.

Two things worth knowing before relying on it:

- **Android is a scrape.** Google publishes no version API, so the Play listing HTML is parsed
  best-effort. Google reshuffles that markup periodically, and many listings report "Varies with
  device". The parser rejects anything that is not a plausible dotted version — a stray number read
  as a version would nag every user permanently — and the network path turns that into a retryable
  error rather than caching "no update".
- **It is advisory only.** There is no forced-update path. A hard block needs a version floor the
  app trusts, which means a backend, and it strands users who cannot update. Add one deliberately if
  a breaking API change ever demands it.

`src/lib/storeReview.ts` wraps the native in-app review dialog. Both platforms silently rate-limit
it — iOS shows it at most about three times a year and reports neither whether it appeared nor what
the user chose — so spending a prompt on someone's first launch wastes it and biases ratings toward
users who have seen the least of the app. The gates (three sessions, three days since install, a
90-day cooldown, and no re-ask within the same major.minor) exist for that reason.
`bumpSessionCount()` already runs on every launch; call `maybeRequestReview()` from a moment of
success in the product, never from startup.

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

`app.config.ts` publishes the non-secret runtime values under `extra`, and `src/lib/appConfig.ts`
reads them back with defaults. See `.env.example` for the full list. A Sentry DSN and a PostHog
project API key are _write-only public keys_ and are embedded in the bundle by design; that is why
they are safe here. `SENTRY_AUTH_TOKEN` is a real secret used only at build time to upload source
maps — publish it with `eas env:create --visibility secret` and never put it in `.env.local` or
`eas.json`.

`.env.local` is gitignored and EAS uploads the git-tracked project, so EAS never sees it. Identity
values are fatal if missing from an EAS build; the observability and store values only warn, so a
team that has not adopted a vendor yet can still ship. A production build warns when a DSN is set
without the org, project, and auth token needed to symbolicate — unsymbolicated crash reports are
close to useless, and a production build is the one thing that cannot be re-run locally to find out
what happened.
