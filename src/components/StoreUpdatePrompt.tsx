import Constants from 'expo-constants';
import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';

import { useLatestStoreVersion } from '@/hooks/useLatestStoreVersion';
import { appStoreUrl, playStoreUrl } from '@/lib/appConfig';
import { currentAppVersion, isUpdateAvailable } from '@/lib/appVersion';
import { openExternalUrl } from '@/lib/openExternalUrl';
import { analytics } from '@/observability/observability';

// Nudges the user to update when the store advertises a newer native version
// than the one installed. The published version is read straight from the App
// Store / Play Store on-device (see `storeVersion.ts`), so nothing here needs a
// backend or a remote-config service.
//
// Advisory only: there is no forced-update path. A hard block needs a version
// floor the app trusts — which means a backend — and it strands users who
// cannot update. Add one deliberately if a breaking API change ever requires it.
//
// Prompts at most once per app session, and renders nothing.
export default function StoreUpdatePrompt() {
  const { data: latest } = useLatestStoreVersion();
  const prompted = useRef(false);

  useEffect(() => {
    if (prompted.current) return;
    if (!isUpdateAvailable(currentAppVersion(), latest ?? null)) return;

    const storeUrl = Platform.OS === 'ios' ? appStoreUrl() : playStoreUrl();
    // A lookup only succeeds when that platform's identity is configured, so
    // this is unreachable in practice — but the prompt is worse than useless
    // with nowhere to send the user, so it stays silent rather than guessing.
    if (!storeUrl) return;

    prompted.current = true;
    const appName = Constants.expoConfig?.name ?? 'the app';
    analytics.track('app_update_prompted', { latest_version: latest ?? 'unknown' });

    Alert.alert(
      'Update available',
      `A new version of ${appName} is available.`,
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Update',
          onPress: () => {
            analytics.track('app_update_prompt_accepted', {
              latest_version: latest ?? 'unknown',
            });
            openExternalUrl(storeUrl);
          },
        },
      ],
      { cancelable: true }
    );
  }, [latest]);

  return null;
}
