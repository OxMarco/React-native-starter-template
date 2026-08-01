import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import Screen, { TAB_SCREEN_EDGES } from '../Screen';

const safeAreaProps: { current: Record<string, unknown> | null } = { current: null };

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above imports
  const { View } = require('react-native');
  return {
    SafeAreaView: (props: Record<string, unknown>) => {
      safeAreaProps.current = props;
      return <View {...props} />;
    },
  };
});

jest.mock('../OfflineBanner', () => ({
  __esModule: true,
  default: () => null,
}));

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

beforeEach(() => {
  safeAreaProps.current = null;
});

describe('Screen', () => {
  it('applies the bottom inset by default so full-screen content clears the home indicator', () => {
    render(
      <Screen>
        <Text>content</Text>
      </Screen>
    );

    expect(safeAreaProps.current?.edges).toEqual(['top', 'left', 'right', 'bottom']);
  });

  it('omits the bottom inset for tab screens, where the tab bar already consumes it', () => {
    render(
      <Screen edges={TAB_SCREEN_EDGES}>
        <Text>content</Text>
      </Screen>
    );

    expect(safeAreaProps.current?.edges).not.toContain('bottom');
  });
});
