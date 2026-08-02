import themeTokens from './theme.json';

export type Theme = Record<keyof typeof themeTokens.light, string>;
export type ThemeName = keyof typeof themeTokens;

// JSON is also consumed directly by Tailwind's Node configuration. This typed
// assignment makes both palettes prove that they expose the same token set.
export const themes: Record<ThemeName, Theme> = themeTokens;
