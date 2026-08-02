import { createPostHogAdapter } from './adapters/posthog';
import { initSentry, sentryErrorReporter } from './adapters/sentry';
import { configureObservability } from './observability';

// The one place vendor SDKs are named. Everything else in the app talks to the
// `analytics` / `errorReporter` facades, so replacing PostHog or Sentry means
// editing this file and one adapter — not hunting down call sites.
//
// Imported for its side effect at the very top of `App.tsx`, before any other
// application module is evaluated: a crash while modules are still loading, or
// during the first render, is precisely the one worth catching. That ordering is
// the whole point of the bare import, which is why this module is not re-exported
// from `./index.ts` — reaching it through the barrel would boot both SDKs
// wherever that import happened to fall in the graph.
//
// Not exported. A bare import is the only way in, so there is no second entry
// point that could initialise the SDKs late or twice.
let configured = false;

function setupObservability(): void {
  if (configured) return;
  configured = true;

  initSentry();

  // Null when no PostHog project token is configured. `configureObservability`
  // ignores an absent adapter and the analytics facade stays a safe no-op, so
  // an unconfigured clone of this starter runs unmodified.
  const analytics = createPostHogAdapter();

  configureObservability({
    ...(analytics ? { analytics } : {}),
    errors: sentryErrorReporter,
  });
}

setupObservability();
