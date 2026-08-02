import TestRenderer, { act } from 'react-test-renderer';

import HomeScreen from '../HomeScreen';

let mockOnline: boolean | null = null;

jest.mock('@/hooks/useIsOnline', () => ({
  useIsOnline: () => mockOnline,
}));

function text(renderer: TestRenderer.ReactTestRenderer) {
  return JSON.stringify(renderer.toJSON());
}

describe('HomeScreen', () => {
  it.each([
    [null, 'Checking…'],
    [true, 'Online'],
    [false, 'Offline'],
  ] as const)('renders the %s network state', (online, label) => {
    mockOnline = online;
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<HomeScreen />);
    });

    expect(text(renderer)).toContain(label);
    expect(
      renderer.root.findAll(
        (node) => typeof node.type === 'string' && node.props.accessibilityRole === 'header'
      )
    ).toHaveLength(3);
  });
});
