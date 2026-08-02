import PostHog from 'posthog-react-native';

import { getAppConfig } from '@/lib/appConfig';

import { DEFAULT_ANALYTICS_CONSENT } from '../analyticsConsent';
import type { AnalyticsAdapter, TelemetryProperties } from '../types';

// Product analytics. The client is constructed once and handed to
// `configureObservability` in `src/observability/setup.ts`; nothing outside this
// file should import it, so swapping vendors touches one module.
//
// With no project token configured the client is constructed disabled rather
// than skipped, so `analytics.track` stays a no-op instead of a crash and a
// fresh clone of this starter runs unmodified.

let client: PostHog | null = null;

function createPostHogClient(): PostHog | null {
  const { posthogApiKey, posthogHost } = getAppConfig();
  if (!posthogApiKey) return null;

  return new PostHog(posthogApiKey, {
    host: posthogHost,
    // Must agree with the facade's starting state, or launch-time events reach
    // a client that silently drops them: the facade would send, PostHog would
    // discard, and nothing would say so. `setEnabled` re-applies the stored
    // preference as soon as it resolves.
    //
    // This is only the fallback for an install PostHog has no record of. It
    // persists its own opt-out flag and re-applies it before capturing, so a
    // returning user who turned reporting off stays opted out across the
    // pre-hydration window without this module doing anything.
    defaultOptIn: DEFAULT_ANALYTICS_CONSENT === 'granted',
    // The SDK's own lifecycle capture runs during construction — before consent
    // is known — and keys "new build?" off a version marker it persists for its
    // own purposes. `src/observability/lifecycle.ts` emits the same events after
    // opt-in, using this project's version identity.
    captureAppLifecycleEvents: false,
    // Session replay records the screen. That is personal data, and consenting
    // to anonymous usage analytics is not consent to being recorded. Turning it
    // on needs its own disclosure and its own control, not this one.
    enableSessionReplay: false,
    // Tell PostHog's server to skip GeoIP resolution so the client IP is never
    // turned into a location. Pair with "Discard client IP data" in the project
    // settings to drop the raw IP as well: together they remove the two
    // identifiers that make event data personal rather than anonymous.
    disableGeoip: true,
    flushAt: 20,
    flushInterval: 10_000,
    maxBatchSize: 100,
    maxQueueSize: 1000,
    // Feature flags, surveys, remote config, and PostHog's own error tracking
    // are unused here. Keeping every startup fetch off means an opted-out user
    // never contacts PostHog merely because the app launched. Re-enable each
    // alongside the feature that actually needs it.
    disableRemoteConfig: true,
    disableSurveys: true,
    preloadFeatureFlags: false,
    sendFeatureFlagEvent: false,
    requestTimeout: 10_000,
    fetchRetryCount: 3,
    fetchRetryDelay: 3000,
  });
}

// Opting in and out is asynchronous, and consent can flip faster than those
// promises settle. Serialize the transitions and have every capture wait behind
// the current one, so a rapid off→on→off sequence cannot let an earlier opt-in
// land after the later opt-out, and events flushed right after consent is
// granted are not dropped by a client that has not finished opting in.
let transition: Promise<void> = Promise.resolve();
let desiredEnabled: boolean | null = null;

function setEnabled(enabled: boolean): Promise<void> {
  desiredEnabled = enabled;
  const run = transition.then(async () => {
    if (desiredEnabled !== enabled || !client) return;
    if (enabled) await client.optIn();
    else await client.optOut();
  });
  transition = run.catch(() => undefined);
  return run;
}

function afterTransition(operation: (posthog: PostHog) => void | Promise<void>): Promise<void> {
  return transition.then(() => {
    if (client) return operation(client);
  });
}

export function createPostHogAdapter(
  instance: PostHog | null = createPostHogClient()
): AnalyticsAdapter | null {
  client = instance;
  if (!client) return null;

  return {
    setEnabled,
    track(event: string, properties: TelemetryProperties) {
      return afterTransition((posthog) => posthog.capture(event, { ...properties }));
    },
    identify(userId: string, traits: TelemetryProperties) {
      return afterTransition((posthog) => posthog.identify(userId, { ...traits }));
    },
    reset() {
      return afterTransition(async (posthog) => {
        posthog.reset();
        // `reset()` clears every persisted property except the queues — and the
        // opt-out flag is one of them. Once cleared it falls back to
        // `!defaultOptIn`, so under an opt-out default an unguarded reset
        // silently resumes capture for a user who turned reporting off. That is
        // the dangerous direction, and it is reachable from an ordinary logout.
        // Re-assert the current choice rather than trusting the fallback.
        if (desiredEnabled === true) await posthog.optIn();
        else if (desiredEnabled === false) await posthog.optOut();
      });
    },
    flush() {
      return afterTransition((posthog) => posthog.flush());
    },
  };
}

export function resetPostHogAdapterForTests(): void {
  client = null;
  transition = Promise.resolve();
  desiredEnabled = null;
}
