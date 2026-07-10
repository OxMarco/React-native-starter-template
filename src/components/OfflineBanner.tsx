import { Text, View } from 'react-native';

import { useIsOnline } from '@/hooks/useIsOnline';

export default function OfflineBanner() {
  const online = useIsOnline();

  if (online !== false) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      className="border-b border-error/30 bg-error/10 px-5 py-2">
      <Text className="text-center text-sm font-medium text-error">
        You’re offline. Some features may be unavailable.
      </Text>
    </View>
  );
}
