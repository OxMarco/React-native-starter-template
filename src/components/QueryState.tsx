import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { friendlyErrorMessage } from '@/lib/errors';
import { useAppTheme } from '@/providers/ThemeProvider';

// A query has four outcomes, not two, and collapsing them is a bug users
// actually notice.
//
// The distinction that matters is between `data === undefined` — we never got an
// answer — and an empty array, which means we did get one and there is nothing
// in it. Rendering the first as the second tells someone "you have no orders"
// when the request timed out. `QueryUnavailable` exists so that case has
// somewhere to go: in practice it is an offline launch with nothing in the
// persisted cache, where there is no error to show because the query never ran.
//
// These are deliberately separate components rather than one that takes a query
// result. A screen usually wants its own empty copy and often its own layout,
// and a single wrapper ends up growing a prop for each of them.
//
// Typical use:
//
//   if (query.isPending) return <QueryLoading />;
//   if (query.isError) return <QueryError error={query.error} onRetry={query.refetch} />;
//   if (!query.data) return <QueryUnavailable message="Orders aren't available offline." />;
//   if (!query.data.length) return <QueryEmpty message="You have no orders yet." />;
//   return <OrderList orders={query.data} />;

export function QueryLoading({ label = 'Loading' }: { label?: string }) {
  const { theme } = useAppTheme();

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      aria-busy
      className="items-center rounded-2xl border border-border bg-surface p-8">
      <ActivityIndicator color={theme.text} />
    </View>
  );
}

export function QueryError({
  error,
  onRetry,
  message,
}: {
  error: unknown;
  onRetry?: () => void;
  message?: string;
}) {
  // `friendlyErrorMessage` maps the error onto the operational vocabulary in
  // appError.ts, so the user sees "check your connection" rather than a stack.
  const body = message ?? friendlyErrorMessage(error);

  if (!onRetry) {
    return (
      <View
        accessibilityRole="alert"
        className="rounded-2xl border border-error/30 bg-error/10 p-4">
        <Text className="leading-6 text-error">{body}</Text>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${body} Tap to retry.`}
      onPress={onRetry}
      className="min-h-14 justify-center rounded-2xl border border-error/30 bg-error/10 p-4 active:opacity-70">
      <Text className="leading-6 text-error">{body}</Text>
      <Text className="mt-1 text-sm font-medium text-error/80">Tap to retry</Text>
    </Pressable>
  );
}

/**
 * The query settled without data and without a surfaced error — typically an
 * offline launch with an empty persisted cache. Distinct from `QueryEmpty`:
 * this says "we don't know", not "there is nothing".
 */
export function QueryUnavailable({ message }: { message: string }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      className="rounded-2xl border border-border bg-surface p-4">
      <Text className="leading-6 text-muted">{message}</Text>
    </View>
  );
}

/** The query succeeded and the result really is empty. */
export function QueryEmpty({ message }: { message: string }) {
  return (
    <View className="rounded-2xl border border-border bg-surface p-4">
      <Text className="leading-6 text-muted">{message}</Text>
    </View>
  );
}
