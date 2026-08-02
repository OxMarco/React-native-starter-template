import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { themes } from '@/lib/theme';

import ThemeProvider, { useAppTheme } from '../ThemeProvider';

const mockSetBackgroundColorAsync = jest.fn(async (_color: string) => undefined);
const mockSetColorScheme = jest.fn();
const mockSetting = {
  value: 'dark',
  hydrated: true,
  writeError: null,
  setValue: jest.fn(async () => true),
};

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: (color: string) => mockSetBackgroundColorAsync(color),
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'dark', setColorScheme: mockSetColorScheme }),
}));

jest.mock('@/hooks/usePersistedSetting', () => ({
  usePersistedSetting: () => mockSetting,
}));

function Consumer() {
  const value = useAppTheme();
  return <Text>{`${value.preference}:${value.resolvedScheme}:${value.hydrated}`}</Text>;
}

describe('ThemeProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('applies the hydrated preference and keeps the native window palette in sync', async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <Consumer />
        </ThemeProvider>
      );
    });

    expect(JSON.stringify(renderer.toJSON())).toContain('dark:dark:true');
    expect(mockSetColorScheme).toHaveBeenCalledWith('dark');
    expect(mockSetBackgroundColorAsync).toHaveBeenCalledWith(themes.dark.background);
  });

  it('rejects use outside its provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => {
      act(() => {
        TestRenderer.create(<Consumer />);
      });
    }).toThrow('useAppTheme must be used inside ThemeProvider');
    consoleError.mockRestore();
  });
});
