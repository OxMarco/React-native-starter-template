import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Text, View } from 'react-native';

import Card from '@/components/Card';
import PrimaryButton from '@/components/PrimaryButton';
import Screen from '@/components/Screen';
import { friendlyErrorMessage } from '@/lib/errors';
import { markOnboardingComplete } from '@/lib/onboarding';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { analytics } from '@/observability/observability';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const finish = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await markOnboardingComplete();
      analytics.track('onboarding_completed', { source: 'welcome' });
      navigation.replace('Main');
    } catch (error) {
      setSaveError(friendlyErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <View className="flex-1 justify-between">
        <View className="pt-12">
          <Text className="text-sm font-semibold uppercase tracking-widest text-primary">
            React Native starter
          </Text>
          <Text className="mt-3 text-4xl font-bold leading-tight text-text">
            Start with the foundation already in place.
          </Text>
          <Text className="mt-4 text-lg leading-7 text-muted">
            Navigation, persistent theming, cached server state, offline awareness, and quality
            tooling are ready for your product code.
          </Text>
        </View>

        <Card className="mb-4">
          <Text className="text-lg font-semibold text-text">A deliberately small baseline</Text>
          <Text className="mt-2 leading-6 text-muted">
            Add only the native capabilities your app needs. This starter does not request device
            permissions or depend on a backend.
          </Text>
          {saveError ? (
            <Text accessibilityRole="alert" className="mt-4 leading-6 text-error">
              {saveError}
            </Text>
          ) : null}
          <View className="mt-5">
            <PrimaryButton label="Get started" loading={saving} onPress={() => void finish()} />
          </View>
        </Card>
      </View>
    </Screen>
  );
}
