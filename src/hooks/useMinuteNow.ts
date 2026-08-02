import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

const MINUTE_MS = 60 * 1000;

/**
 * A once-a-minute clock, for relative-time labels ("3 minutes ago") and
 * anything else whose display drifts out of date without the data changing.
 *
 * Query data stays referentially stable between fetches, so a component reading
 * only from the cache never re-renders and the label silently goes stale. This
 * gives it a tick of its own.
 *
 * The part that is easy to miss: native timers are suspended while the app is
 * backgrounded, so an interval alone leaves the first frame after resume
 * showing a timestamp from before the app was put away — exactly when the user
 * is looking. Refreshing on `active` closes that gap.
 *
 * A minute is deliberate. Anything faster belongs on its own timer near the
 * component that needs it; a shared clock that ticks per second re-renders
 * every consumer for no visible benefit.
 */
export function useMinuteNow(): Date {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const update = () => setNowMs(Date.now());
    const timer = setInterval(update, MINUTE_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  return new Date(nowMs);
}
