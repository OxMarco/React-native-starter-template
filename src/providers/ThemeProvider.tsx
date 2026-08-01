import { createContext, type ReactNode, useContext, useEffect, useMemo } from 'react';
import * as SystemUI from 'expo-system-ui';
import { useColorScheme } from 'nativewind';

import { usePersistedSetting } from '@/hooks/usePersistedSetting';
import {
  themePreferenceSetting,
  themePreferenceToColorScheme,
  type ResolvedScheme,
  type ThemePreference,
} from '@/lib/appTheme';
import { themes, type Theme } from '@/lib/theme';

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedScheme: ResolvedScheme;
  theme: Theme;
  hydrated: boolean;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = usePersistedSetting(themePreferenceSetting);
  const { colorScheme, setColorScheme } = useColorScheme();

  useEffect(() => {
    if (preference.hydrated) {
      setColorScheme(themePreferenceToColorScheme(preference.value));
    }
  }, [preference.hydrated, preference.value, setColorScheme]);

  const resolvedScheme: ResolvedScheme = colorScheme === 'dark' ? 'dark' : 'light';

  // The window behind React's view keeps its own background colour. Without
  // this it stays the platform default, which shows through as a white flash
  // during navigation transitions and rotation in the dark theme.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(themes[resolvedScheme].background).catch(() => undefined);
  }, [resolvedScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference: preference.value,
      resolvedScheme,
      theme: themes[resolvedScheme],
      hydrated: preference.hydrated,
      setPreference: preference.setValue,
    }),
    [preference.hydrated, preference.setValue, preference.value, resolvedScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAppTheme must be used inside ThemeProvider');
  return value;
}
