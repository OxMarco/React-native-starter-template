import { Text, View } from 'react-native';

import Card from '@/components/Card';
import Screen from '@/components/Screen';
import { useIsOnline } from '@/hooks/useIsOnline';

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
    <Screen scroll>
      <Text className="text-sm font-semibold uppercase tracking-widest text-primary">Starter</Text>
      <Text className="mt-2 text-3xl font-bold text-text">Your app shell is ready.</Text>
      <Text className="mt-3 text-base leading-6 text-muted">
        Replace these example screens with product features while keeping the shared foundation.
      </Text>

      <Card className="mt-7">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-base font-semibold text-text">Network</Text>
            <Text className="mt-1 text-sm text-muted">Observed through NetInfo</Text>
          </View>
          <View className={`rounded-full px-3 py-1 ${networkBackground}`}>
            <Text className={`text-sm font-semibold ${networkColor}`}>{networkLabel}</Text>
          </View>
        </View>
      </Card>

      <Card className="mt-4">
        <Text className="text-lg font-semibold text-text">Included foundation</Text>
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
