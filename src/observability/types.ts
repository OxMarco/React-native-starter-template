import type { AppErrorKind } from '@/lib/appError';

export type TelemetryValue = string | number | boolean | null;
export type TelemetryProperties = Readonly<Record<string, TelemetryValue>>;

export type AnalyticsEventMap = {
  app_launched: { launch: 'cold' };
  screen_viewed: { screen: string };
  onboarding_completed: { source: 'welcome' };
  query_failed: { operation: string; kind: AppErrorKind; retryable: boolean };
  query_retry_succeeded: { operation: string; attempts: number };
  mutation_failed: { operation: string; kind: AppErrorKind; retryable: boolean };
  cache_persist_failed: { kind: AppErrorKind };
  cache_restore_failed: { kind: AppErrorKind };
  offline_mutations_resumed: { count: number };
};

export type AnalyticsAdapter = {
  track: (event: string, properties: TelemetryProperties) => void | Promise<void>;
  identify?: (userId: string, traits: TelemetryProperties) => void | Promise<void>;
  reset?: () => void | Promise<void>;
  flush?: () => void | Promise<void>;
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
