import { ActivityIndicator, Text, View } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';

type Props = {
  message?: string;
};

// Shown between the native splash hiding and the navigator mounting. It uses
// the resolved palette so startup does not flash the wrong background while
// the stored theme preference is still being read.
export default function StartupScreen({ message }: Props) {
  const { theme } = useAppTheme();

  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <ActivityIndicator color={theme.primary} size="large" />
      {message ? (
        <Text accessibilityRole="alert" className="mt-4 text-center leading-6 text-muted">
          {message}
        </Text>
      ) : null}
    </View>
  );
}
