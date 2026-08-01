import { Pressable, Text, View } from 'react-native';

import Card from '@/components/Card';
import Screen, { TAB_SCREEN_EDGES } from '@/components/Screen';
import { usePersistedSetting } from '@/hooks/usePersistedSetting';
import { THEME_OPTIONS } from '@/lib/appTheme';
import {
  ANALYTICS_CONSENT_OPTIONS,
  analyticsConsentSetting,
} from '@/observability/analyticsConsent';
import { useAppTheme } from '@/providers/ThemeProvider';

export default function SettingsScreen() {
  const { preference, setPreference } = useAppTheme();
  const analyticsConsent = usePersistedSetting(analyticsConsentSetting);

  return (
    <Screen scroll edges={TAB_SCREEN_EDGES}>
      <Text className="text-3xl font-bold text-text">Settings</Text>
      <Text className="mt-2 text-base leading-6 text-muted">
        This demonstrates a reusable AsyncStorage-backed preference.
      </Text>

      <Card className="mt-7">
        <Text className="text-lg font-semibold text-text">Appearance</Text>
        <View
          accessibilityLabel="Appearance"
          accessibilityRole="radiogroup"
          className="mt-3 overflow-hidden rounded-xl border border-border">
          {THEME_OPTIONS.map((option, index) => (
            <SettingsOption
              key={option.value}
              label={option.label}
              selected={preference === option.value}
              divided={index > 0}
              onPress={() => void setPreference(option.value)}
            />
          ))}
        </View>
      </Card>

      <Card className="mt-4">
        <Text className="text-lg font-semibold text-text">Usage analytics</Text>
        <Text className="mt-2 leading-6 text-muted">
          No analytics are collected until you opt in. Never include credentials or personal content
          in analytics events.
        </Text>
        <View
          accessibilityLabel="Usage analytics"
          accessibilityRole="radiogroup"
          className="mt-3 overflow-hidden rounded-xl border border-border">
          {ANALYTICS_CONSENT_OPTIONS.map((option, index) => (
            <SettingsOption
              key={option.value}
              label={option.label}
              selected={analyticsConsent.value === option.value}
              divided={index > 0}
              onPress={() => void analyticsConsent.setValue(option.value)}
            />
          ))}
        </View>
      </Card>
    </Screen>
  );
}

function SettingsOption({
  label,
  selected,
  divided,
  onPress,
}: {
  label: string;
  selected: boolean;
  divided: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={`min-h-14 flex-row items-center justify-between bg-surface px-4 active:opacity-70 ${
        divided ? 'border-t border-border' : ''
      }`}>
      <Text className="text-base text-text">{label}</Text>
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
          selected ? 'border-primary' : 'border-muted'
        }`}>
        {selected ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
      </View>
    </Pressable>
  );
}
