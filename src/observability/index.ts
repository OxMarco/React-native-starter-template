// The facade's public surface. Deliberately free of side effects, so importing
// it costs nothing and can happen from anywhere.
//
// `./setup` is NOT re-exported here, even though it is the module that wires the
// vendor adapters in. It initialises Sentry and PostHog when it is evaluated,
// and re-exporting it would make an innocent `import { analytics } from
// '@/observability'` boot both SDKs at whatever point in the module graph that
// import happened to land — quietly undoing the ordering `App.tsx` establishes
// by importing `@/observability/setup` first and for its side effect alone.
export { analyticsConsentSetting, DEFAULT_ANALYTICS_CONSENT } from './analyticsConsent';
export type { AnalyticsConsent } from './analyticsConsent';
export { startLifecycleTracking, stopLifecycleTracking } from './lifecycle';
export {
  analytics,
  configureObservability,
  errorReporter,
  resetObservabilityConfiguration,
} from './observability';
export type {
  AnalyticsAdapter,
  AnalyticsEventMap,
  ErrorReporterAdapter,
  TelemetryProperties,
} from './types';
