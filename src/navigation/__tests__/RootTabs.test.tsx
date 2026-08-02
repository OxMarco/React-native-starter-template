import TestRenderer, { act } from 'react-test-renderer';

import RootTabs from '../RootTabs';

const mockNavigatorProps: { current: Record<string, unknown> | null } = { current: null };

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: (props: Record<string, unknown>) => {
      mockNavigatorProps.current = props;
      return props.children;
    },
    Screen: () => null,
  }),
}));

jest.mock('@/providers/ThemeProvider', () => ({
  useAppTheme: () => ({
    theme: {
      primary: '#1d4ed8',
      muted: '#64748b',
      surface: '#ffffff',
      border: '#e5e7eb',
    },
  }),
}));

jest.mock('@/screens/HomeScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('@/screens/SettingsScreen', () => ({ __esModule: true, default: () => null }));

describe('RootTabs', () => {
  it('gives tabs stable spoken labels and hides decorative icons', () => {
    act(() => {
      TestRenderer.create(<RootTabs />);
    });
    const screenOptions = mockNavigatorProps.current?.screenOptions as (input: {
      route: { name: string };
    }) => Record<string, unknown>;
    const homeOptions = screenOptions({ route: { name: 'Home' } });
    const settingsOptions = screenOptions({ route: { name: 'Settings' } });

    expect(homeOptions.tabBarAccessibilityLabel).toBe('Home');
    expect(settingsOptions.tabBarAccessibilityLabel).toBe('Settings');

    const tabBarIcon = homeOptions.tabBarIcon as (input: { color: string }) => React.ReactElement;
    let icon!: TestRenderer.ReactTestRenderer;
    act(() => {
      icon = TestRenderer.create(tabBarIcon({ color: '#123456' }));
    });
    expect(
      icon.root.find(
        (node) => node.props['aria-hidden'] === true && node.props.accessible === false
      )
    ).toBeDefined();
  });
});
