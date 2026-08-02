import { ActivityIndicator, Pressable, Text } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export default function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: Props) {
  const { theme } = useAppTheme();
  const unavailable = loading || disabled;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: loading }}
      aria-busy={loading}
      aria-disabled={unavailable}
      disabled={unavailable}
      onPress={onPress}
      className={`min-h-12 items-center justify-center rounded-xl bg-primary px-5 ${
        unavailable ? 'opacity-50' : 'active:opacity-80'
      }`}>
      {loading ? (
        <ActivityIndicator color={theme.primaryContrast} />
      ) : (
        <Text className="text-base font-semibold text-primaryContrast">{label}</Text>
      )}
    </Pressable>
  );
}
