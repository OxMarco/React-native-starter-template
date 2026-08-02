import { type ReactNode, useEffect, useRef } from 'react';

import { usePersistedSetting } from '@/hooks/usePersistedSetting';
import { bumpSessionCount } from '@/lib/storeReview';
import { analyticsConsentSetting } from '@/observability/analyticsConsent';
import { installGlobalErrorHandlers } from '@/observability/globalHandlers';
import { startLifecycleTracking, stopLifecycleTracking } from '@/observability/lifecycle';
import { analytics } from '@/observability/observability';

export default function ObservabilityProvider({ children }: { children: ReactNode }) {
  const consent = usePersistedSetting(analyticsConsentSetting);
  const launchTracked = useRef(false);

  useEffect(() => installGlobalErrorHandlers(), []);

  // Counted on every launch regardless of consent: it decides when the store
  // review prompt is allowed to appear, never leaves the device, and is not an
  // analytics event.
  useEffect(() => {
    void bumpSessionCount();
  }, []);

  // Declared before the tracking effect below so the adapter is enabled first.
  // Runs on the default value immediately and again once the stored preference
  // resolves; `setConsent` is idempotent for an unchanged value.
  useEffect(() => {
    analytics.setConsent(consent.value);
  }, [consent.value]);

  // Not gated on hydration. Waiting for the AsyncStorage read would delay these
  // past launch, which is the delay this design deliberately gave up — see the
  // note on `analyticsConsent` in `observability.ts`. The facade drops them if
  // the resolved preference turns out to be a withdrawal.
  //
  // Withdrawing consent leaves the lifecycle listener attached, so re-granting
  // resumes tracking without needing a relaunch.
  useEffect(() => {
    if (!launchTracked.current) {
      launchTracked.current = true;
      analytics.track('app_launched', { launch: 'cold' });
    }
    void startLifecycleTracking();
    return () => stopLifecycleTracking();
  }, []);

  return children;
}
