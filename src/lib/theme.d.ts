export type Theme = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  primaryContrast: string;
  border: string;
  error: string;
};

export const themes: {
  light: Theme;
  dark: Theme;
};
