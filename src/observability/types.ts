import type { AppErrorKind } from '@/lib/appError';

export type TelemetryValue = string | number | boolean | null;
export type TelemetryProperties = Readonly<Record<string, TelemetryValue>>;

export type AnalyticsEventMap = {
  app_launched: { launch: 'cold' };
  // Install/update/foreground lifecycle, tracked by `lifecycle.ts` rather than
  // by an SDK's built-in capture, so the events obey consent and carry this
  // project's version identity instead of the vendor's.
  app_installed: Record<string, never>;
  app_updated: { previous_version: string; previous_build: string };
  // Scheme, host, and path of the launching deep link — never the query string
  // or fragment. See `sanitizeLaunchUrl` in `lifecycle.ts` for why.
  app_opened: { url: string | null };
  app_became_active: Record<string, never>;
  app_backgrounded: Record<string, never>;
  app_update_prompted: { latest_version: string };
  app_update_prompt_accepted: { latest_version: string };
  review_prompt_requested: { app_version: string };
  screen_viewed: { screen: string };
  onboarding_completed: { source: 'welcome' };
  query_failed: { operation: string; kind: AppErrorKind; retryable: boolean };
  query_retry_succeeded: { operation: string; attempts: number };
  mutation_failed: { operation: string; kind: AppErrorKind; retryable: boolean };
  cache_persist_failed: { kind: AppErrorKind };
  cache_restore_failed: { kind: AppErrorKind };
  offline_mutations_resumed: { count: number };
  offline_mutations_expired: { count: number };
};

export type AnalyticsAdapter = {
  track: (event: string, properties: TelemetryProperties) => void | Promise<void>;
  identify?: (userId: string, traits: TelemetryProperties) => void | Promise<void>;
  reset?: () => void | Promise<void>;
  flush?: () => void | Promise<void>;
  // Called whenever consent changes, so an SDK that queues, batches, or captures
  // on its own can be silenced at its own level rather than only at this
  // facade's. Gating every `track` call here is not enough: PostHog persists a
  // queue and can flush events the facade never sees again.
  setEnabled?: (enabled: boolean) => void | Promise<void>;
};

export type ErrorContext = {
  context?: string;
  tags?: Readonly<Record<string, string>>;
  extra?: TelemetryProperties;
};

export type ErrorReporterAdapter = {
  captureException: (error: unknown, context?: ErrorContext) => void | Promise<void>;
  captureMessage?: (message: string, context?: ErrorContext) => void | Promise<void>;
  addBreadcrumb?: (message: string, properties?: TelemetryProperties) => void | Promise<void>;
  setUser?: (user: { id: string } | null) => void | Promise<void>;
};
