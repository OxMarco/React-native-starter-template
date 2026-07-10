import { type ReactNode, useEffect, useRef } from 'react';

import { usePersistedSetting } from '@/hooks/usePersistedSetting';
import { analyticsConsentSetting } from '@/observability/analyticsConsent';
import { installGlobalErrorHandlers } from '@/observability/globalHandlers';
import { analytics } from '@/observability/observability';

export default function ObservabilityProvider({ children }: { children: ReactNode }) {
  const consent = usePersistedSetting(analyticsConsentSetting);
  const launchTracked = useRef(false);

  useEffect(() => installGlobalErrorHandlers(), []);

  useEffect(() => {
    if (!consent.hydrated) return;

    analytics.setConsent(consent.value);
    if (consent.value === 'granted' && !launchTracked.current) {
      launchTracked.current = true;
      analytics.track('app_launched', { launch: 'cold' });
    }
  }, [consent.hydrated, consent.value]);

  return children;
}
