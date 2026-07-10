import { createPersistedSetting, type PersistedSettingCodec } from './persistedSetting';

export type ThemePreference = 'auto' | 'light' | 'dark';
export type ResolvedScheme = 'light' | 'dark';

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'auto';
export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'auto', label: 'Use device setting' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function decodeThemePreference(raw: string | null): ThemePreference {
  return raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : DEFAULT_THEME_PREFERENCE;
}

export function themePreferenceToColorScheme(
  preference: ThemePreference
): 'system' | ResolvedScheme {
  return preference === 'auto' ? 'system' : preference;
}

const codec: PersistedSettingCodec<ThemePreference> = {
  decode: decodeThemePreference,
  encode: (value) => value,
};

export const themePreferenceSetting = createPersistedSetting(
  'starter:theme-preference:v1',
  DEFAULT_THEME_PREFERENCE,
  codec
);
