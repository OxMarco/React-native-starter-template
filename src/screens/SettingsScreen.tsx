import { Platform, Pressable, Text, View } from 'react-native';

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
  const { preference, saveError: themeSaveError, setPreference } = useAppTheme();
  const analyticsConsent = usePersistedSetting(analyticsConsentSetting);

  return (
    <Screen scroll edges={TAB_SCREEN_EDGES}>
      <Text accessibilityRole="header" aria-level={1} className="text-3xl font-bold text-text">
        Settings
      </Text>
      <Text className="mt-2 text-base leading-6 text-muted">
        This demonstrates a reusable AsyncStorage-backed preference.
      </Text>

      <Card className="mt-7">
        <Text accessibilityRole="header" aria-level={2} className="text-lg font-semibold text-text">
          Appearance
        </Text>
        <View
          accessibilityLabel="Appearance"
          accessibilityRole="radiogroup"
          className="mt-3 overflow-hidden rounded-xl border border-border">
          {THEME_OPTIONS.map((option, index) => (
            <SettingsOption
              key={option.value}
              label={option.label}
              selected={preference === option.value}
              focusable={preference === option.value}
              divided={index > 0}
              onPress={() => void setPreference(option.value)}
              onMove={(offset) => {
                const next = wrappedIndex(index + offset, THEME_OPTIONS.length);
                void setPreference(THEME_OPTIONS[next].value);
                return next;
              }}
            />
          ))}
        </View>
        {themeSaveError ? (
          <Text accessibilityRole="alert" className="mt-3 leading-6 text-error">
            Your appearance choice could not be saved and may revert after restart.
          </Text>
        ) : null}
      </Card>

      <Card className="mt-4">
        <Text accessibilityRole="header" aria-level={2} className="text-lg font-semibold text-text">
          Usage analytics
        </Text>
        <Text className="mt-2 leading-6 text-muted">
          Anonymous usage data and crash reports are shared by default to help improve the app. Turn
          this off at any time. Never include credentials or personal content in analytics events.
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
              focusable={analyticsConsent.value === option.value}
              divided={index > 0}
              onPress={() => void analyticsConsent.setValue(option.value)}
              onMove={(offset) => {
                const next = wrappedIndex(index + offset, ANALYTICS_CONSENT_OPTIONS.length);
                void analyticsConsent.setValue(ANALYTICS_CONSENT_OPTIONS[next].value);
                return next;
              }}
            />
          ))}
        </View>
        {analyticsConsent.writeError ? (
          <Text accessibilityRole="alert" className="mt-3 leading-6 text-error">
            Your analytics choice could not be saved. It applies for now, but may revert the next
            time the app starts.
          </Text>
        ) : null}
      </Card>
    </Screen>
  );
}

function SettingsOption({
  label,
  selected,
  focusable,
  divided,
  onPress,
  onMove,
}: {
  label: string;
  selected: boolean;
  focusable: boolean;
  divided: boolean;
  onPress: () => void;
  onMove: (offset: number) => number;
}) {
  const webKeyboardProps =
    Platform.OS === 'web'
      ? {
          onKeyDown: (event: WebKeyboardEvent) => {
            const offset = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
            if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) return;
            event.preventDefault();
            const next = onMove(offset);
            const radios = event.currentTarget.parentElement?.querySelectorAll('[role="radio"]');
            requestAnimationFrame(() => radios?.[next]?.focus());
          },
        }
      : {};

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      aria-checked={selected}
      tabIndex={focusable ? 0 : -1}
      onPress={onPress}
      {...webKeyboardProps}
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

type WebKeyboardEvent = {
  key: string;
  preventDefault: () => void;
  currentTarget: {
    parentElement?: {
      querySelectorAll: (selector: string) => ArrayLike<{ focus: () => void }>;
    };
  };
};

function wrappedIndex(index: number, length: number) {
  return (index + length) % length;
}
