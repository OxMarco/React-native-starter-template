# React Native Starter

A small, production-minded Expo starter extracted from a shipped React Native architecture. It
keeps the reusable application foundation and leaves product-specific native capabilities out.

## Included

- Expo SDK 56, React Native 0.85, React 19, and strict TypeScript
- Typed native-stack and bottom-tab navigation
- NativeWind with persistent system, light, and dark themes
- TanStack Query with opt-in AsyncStorage persistence and resumable offline mutations
- NetInfo lifecycle integration and an app-wide confirmed-offline banner
- Typed operational errors, request timeouts, and transient-only retry policy
- Consent-gated typed analytics and vendor-neutral error-reporting adapters
- Reusable persisted settings, screen layout, buttons, cards, and error boundaries
- One-step checks for TypeScript, Jest, ESLint, Prettier, and Knip
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

`npm run init` prompts for the display name, Expo slug, deep-link scheme, and native application
identifiers. It writes those values to the gitignored `.env.local` file and updates the package
name. You can instead copy `.env.example` manually.

Before a production build:

1. Replace the placeholder identifiers if you did not run the initializer.
2. Add app icon, adaptive icon, splash, and favicon assets to `app.config.ts`.
3. Run `npx eas-cli init` for a new EAS project and add its project id to `.env.local`.
4. Configure new signing credentials and store records for the new application.
5. Choose and add analytics or crash reporting only if the product needs them.
6. Review privacy manifests, permissions, and store disclosures after adding native modules.

Production EAS builds fail fast while either native identifier starts with `com.example.`.

## Commands

```bash
npm start                  # Start Expo
npm run ios                # Open the iOS target
npm run android            # Open the Android target
npm run web                # Open the web target
npm run check              # Typecheck, test, lint, format-check, and find dead code
npm run format             # Apply ESLint and Prettier fixes
npm run doctor             # Validate Expo dependencies and configuration
npm run build:preview      # Internal EAS builds
npm run build:production   # Store-ready EAS builds
```

## Structure

```text
App.tsx                    Thin application entry
app.config.ts              Environment-driven native identity and Expo config
src/components/            Reusable presentation primitives
src/hooks/                 Shared React hooks
src/lib/                   Framework-independent state and infrastructure
src/navigation/            Typed stack and tabs
src/observability/         Analytics, error-reporting, consent, and global handlers
src/providers/             Theme and server-state providers
src/screens/               Example welcome, home, and settings screens
```

Keep product code grouped by feature once the app grows—for example,
`src/features/account/` or `src/features/catalog/`—and reserve these shared directories for code
used across multiple features.

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
  queryFn: ({ signal }) => requestJson<Item[]>('https://api.example.com/items', { signal }),
  meta: {
    operationName: 'list_items',
    persist: true,
  },
});
```

Persistence is denied by default. A successful query is stored only when `meta.persist` is `true`
and `meta.sensitive` is not `true`. The persisted cache expires after 24 hours and is cleared when
its schema buster changes or restoration fails. Never persist tokens, credentials, sensitive user
records, or very large responses. `clearPersistedServerState()` clears both memory and disk state.

## Error handling and retries

`src/lib/appError.ts` classifies failures as network, timeout, authentication, authorization, not
found, validation, rate limit, server, cancellation, or unknown. Each `AppError` carries safe user
copy, retryability, and optional status, code, request id, and retry delay without exposing backend
messages to the UI.

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
until the user grants consent in Settings. Withdrawing consent resets the analytics identity.
Events are typed in `src/observability/types.ts` and automatically include platform, app/build
version, locale, environment, and a per-launch session id. Keys resembling credentials, tokens,
cookies, email, phone, or address data are redacted, and adapter failures never affect app behavior.

Crash reporting is separate from usage-analytics consent because products have different legal and
operational requirements. Decide whether to configure it, what context it may collect, and whether
it needs a separate consent control before shipping.

## Offline mutations

Register every resumable mutation before `AppProviders` restores the persisted cache. The
registration supplies the function that cannot itself be serialized:

```ts
registerOfflineMutation(queryClient, {
  mutationKey: ['items', 'create'],
  operationName: 'create_item',
  mutationFn: ({ idempotencyKey, ...input }) =>
    requestJson<Item>('https://api.example.com/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(input),
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
resume in order after cache restoration and network reconnection.

## Configuration and secrets

Only non-secret app identity belongs in `.env.local`. Expo variables prefixed with
`EXPO_PUBLIC_` are embedded in the JavaScript bundle and must never contain secrets. Store signing
keys and service credentials in the relevant EAS secret or file environment variables.
