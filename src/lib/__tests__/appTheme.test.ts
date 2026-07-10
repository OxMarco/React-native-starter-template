import {
  decodeThemePreference,
  DEFAULT_THEME_PREFERENCE,
  themePreferenceToColorScheme,
} from '../appTheme';

describe('app theme', () => {
  it.each(['auto', 'light', 'dark'] as const)('accepts %s', (value) => {
    expect(decodeThemePreference(value)).toBe(value);
  });

  it('uses the default for missing or invalid storage', () => {
    expect(decodeThemePreference(null)).toBe(DEFAULT_THEME_PREFERENCE);
    expect(decodeThemePreference('sepia')).toBe(DEFAULT_THEME_PREFERENCE);
  });

  it('maps auto to the NativeWind system setting', () => {
    expect(themePreferenceToColorScheme('auto')).toBe('system');
    expect(themePreferenceToColorScheme('dark')).toBe('dark');
  });
});
