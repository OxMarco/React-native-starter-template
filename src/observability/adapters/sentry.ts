import * as Sentry from '@sentry/react-native';

import { getAppConfig } from '@/lib/appConfig';

import {
  type AnalyticsConsent,
  analyticsConsentSetting,
  DEFAULT_ANALYTICS_CONSENT,
} from '../analyticsConsent';
import type { ErrorContext, ErrorReporterAdapter } from '../types';

// Crash and error reporting. `initSentry()` must run before the first render —
// see `src/observability/setup.ts` — because a crash during module evaluation or
// the first commit is exactly the one worth catching.
//
// With no DSN configured the SDK is initialised disabled rather than skipped, so
// every `Sentry.*` call downstream stays a valid no-op instead of throwing on an
// uninitialised client. A fresh clone of this starter therefore runs unmodified.

// `Sentry.init` is synchronous, but the consent preference lives in AsyncStorage.
// Hold the read so `beforeSend` can wait for the real stored value rather than
// assuming the default: a genuine first install reports its startup errors,
// while a returning user who turned reporting off does not leak one during
// hydration. A storage failure follows the documented default.
let consentReady: Promise<AnalyticsConsent> | null = null;

export function initSentry(): void {
  const { sentryDsn, sentrySendDefaultPii } = getAppConfig();

  consentReady = analyticsConsentSetting.read().catch(() => DEFAULT_ANALYTICS_CONSENT);

  Sentry.init({
    dsn: sentryDsn,
    // Report only from real builds. Development errors — stale hot-reload
    // bindings, Metro reconnects, a deliberately thrown test error — are noise,
    // not incidents, and they burn the event quota.
    enabled: !!sentryDsn && !__DEV__,
    environment: __DEV__ ? 'development' : 'production',
    // Attaches the reporting device's IP address and request headers. Off by
    // default; enable it only after the product has made a deliberate privacy
    // and disclosure decision.
    sendDefaultPii: sentrySendDefaultPii,
    enableLogs: false,
    // Performance tracing and session replay are off. Both are opt-in decisions
    // with cost and privacy implications: replay records the screen, which is
    // personal data and needs prior consent under the ePrivacy Directive, and
    // tracing at any meaningful sample rate is the expensive part of a Sentry
    // bill. Enable them deliberately, per product.
    tracesSampleRate: 0,
    async beforeSend(event) {
      const consent =
        analyticsConsentSetting.getCached()?.value ??
        (await consentReady) ??
        DEFAULT_ANALYTICS_CONSENT;
      if (consent !== 'granted') return null;

      // Data minimisation regardless of `sendDefaultPii`: never ship user
      // identity or IP even if a dependency populated it.
      delete event.user;
      return event;
    },
  });
}

function toSentryContext(context?: ErrorContext) {
  return {
    tags: {
      ...context?.tags,
      ...(context?.context ? { context: context.context } : {}),
    },
    extra: { ...context?.extra },
  };
}

export const sentryErrorReporter: ErrorReporterAdapter = {
  captureException(error, context) {
    Sentry.captureException(error, toSentryContext(context));
  },
  captureMessage(message, context) {
    Sentry.captureMessage(message, { level: 'warning', ...toSentryContext(context) });
  },
  addBreadcrumb(message, properties) {
    Sentry.addBreadcrumb({ message, level: 'info', data: { ...properties } });
  },
  setUser(user) {
    Sentry.setUser(user);
  },
};
