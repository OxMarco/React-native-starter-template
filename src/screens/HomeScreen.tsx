import { Text, View } from 'react-native';

import Card from '@/components/Card';
import { QueryError, QueryLoading, QueryUnavailable } from '@/components/QueryState';
import Screen, { TAB_SCREEN_EDGES } from '@/components/Screen';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useLatestStoreVersion } from '@/hooks/useLatestStoreVersion';
import { useMinuteNow } from '@/hooks/useMinuteNow';
import { currentAppVersion, isUpdateAvailable } from '@/lib/appVersion';

const INCLUDED = [
  'Expo with strict TypeScript',
  'Typed stack and tab navigation',
  'Persistent light, dark, and system themes',
  'React Query persistence and app lifecycle wiring',
  'Jest, ESLint, Prettier, Knip, and CI',
];

export default function HomeScreen() {
  const online = useIsOnline();
  const networkLabel = online === null ? 'Checking…' : online ? 'Online' : 'Offline';
  const networkColor = online === null ? 'text-muted' : online ? 'text-primary' : 'text-error';
  const networkBackground =
    online === null ? 'bg-muted/10' : online ? 'bg-primary/10' : 'bg-error/10';

  return (
    <Screen scroll edges={TAB_SCREEN_EDGES}>
      <Text className="text-sm font-semibold uppercase tracking-widest text-primary">Starter</Text>
      <Text accessibilityRole="header" aria-level={1} className="mt-2 text-3xl font-bold text-text">
        Your app shell is ready.
      </Text>
      <Text className="mt-3 text-base leading-6 text-muted">
        Replace these example screens with product features while keeping the shared foundation.
      </Text>

      <Card className="mt-7">
        <View className="flex-row items-center justify-between">
          <View>
            <Text
              accessibilityRole="header"
              aria-level={2}
              className="text-base font-semibold text-text">
              Network
            </Text>
            <Text className="mt-1 text-sm text-muted">Observed through NetInfo</Text>
          </View>
          <View className={`rounded-full px-3 py-1 ${networkBackground}`}>
            <Text className={`text-sm font-semibold ${networkColor}`}>{networkLabel}</Text>
          </View>
        </View>
      </Card>

      <ReleaseCard />

      <Card className="mt-4">
        <Text accessibilityRole="header" aria-level={2} className="text-lg font-semibold text-text">
          Included foundation
        </Text>
        <View className="mt-3 gap-3">
          {INCLUDED.map((item) => (
            <View key={item} className="flex-row items-start">
              <Text className="mr-3 text-primary">●</Text>
              <Text className="flex-1 leading-6 text-muted">{item}</Text>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

// A worked example of the pieces this starter provides, wired to a query that is
// actually real: the App Store / Play Store version lookup behind
// `StoreUpdatePrompt`. It deliberately does not mock a backend — a fake API in a
// template is something every app built from it has to find and delete.
//
// It also happens to be the clearest place to see why `QueryState` splits four
// outcomes rather than two. All four are reachable here without contriving
// anything: no store identity configured yet, a store that did not answer, a
// lookup still in flight, and a real published version.
function ReleaseCard() {
  const query = useLatestStoreVersion();
  const installed = currentAppVersion();

  return (
    <Card className="mt-4">
      <Text accessibilityRole="header" aria-level={2} className="text-lg font-semibold text-text">
        Release
      </Text>
      <Text className="mt-1 text-sm text-muted">Installed {installed}</Text>

      <View className="mt-3">
        {query.isPending ? (
          <QueryLoading label="Checking for updates" />
        ) : query.isError ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data === null ? (
          // Not an empty result — the lookup never ran, because this platform has
          // no store identity configured yet. Rendering it as "you're up to date"
          // would be a confident answer to a question nobody asked.
          <QueryUnavailable message="Set APP_STORE_ID (iOS) or ANDROID_PACKAGE to check for updates." />
        ) : (
          <PublishedVersion
            latest={query.data}
            installed={installed}
            checkedAt={query.dataUpdatedAt}
          />
        )}
      </View>
    </Card>
  );
}

function PublishedVersion({
  latest,
  installed,
  checkedAt,
}: {
  latest: string;
  installed: string;
  checkedAt: number;
}) {
  // Query data stays referentially stable between fetches, so without a clock of
  // its own this label would still read "just now" an hour later.
  const now = useMinuteNow();
  const outdated = isUpdateAvailable(installed, latest);

  return (
    <View className="rounded-2xl border border-border bg-surface p-4">
      <Text className={`font-semibold ${outdated ? 'text-primary' : 'text-text'}`}>
        {outdated ? `Version ${latest} is available` : 'Up to date'}
      </Text>
      <Text className="mt-1 text-sm text-muted">Checked {relativeMinutes(checkedAt, now)}</Text>
    </View>
  );
}

function relativeMinutes(from: number, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - from) / 60_000));
  if (minutes < 1) return 'just now';
  return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
}
