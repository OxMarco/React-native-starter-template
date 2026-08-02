import TestRenderer, { act } from 'react-test-renderer';

import { AppError } from '@/lib/appError';

import HomeScreen from '../HomeScreen';

let mockOnline: boolean | null = null;
const mockQuery: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: string | null | undefined;
  dataUpdatedAt: number;
  refetch: jest.Mock;
} = {
  isPending: false,
  isError: false,
  error: null,
  data: null,
  dataUpdatedAt: 0,
  refetch: jest.fn(),
};

jest.mock('@/hooks/useIsOnline', () => ({
  useIsOnline: () => mockOnline,
}));

// Reached transitively: QueryLoading takes its spinner colour from the theme.
jest.mock('@/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: { text: '#162033' } }),
}));

jest.mock('@/hooks/useLatestStoreVersion', () => ({
  useLatestStoreVersion: () => mockQuery,
}));

jest.mock('@/lib/appVersion', () => ({
  ...jest.requireActual('@/lib/appVersion'),
  currentAppVersion: () => '1.2.0',
}));

// `useMinuteNow` starts an interval, so anything rendered here has to be
// unmounted or the timer keeps the test process alive and fires outside act().
const mounted: TestRenderer.ReactTestRenderer[] = [];

function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<HomeScreen />);
  });
  mounted.push(renderer);
  return renderer;
}

function text(renderer: TestRenderer.ReactTestRenderer) {
  return JSON.stringify(renderer.toJSON());
}

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnline = true;
    Object.assign(mockQuery, {
      isPending: false,
      isError: false,
      error: null,
      data: null,
      dataUpdatedAt: Date.now(),
    });
  });

  afterEach(() => {
    act(() => {
      mounted.splice(0).forEach((renderer) => renderer.unmount());
    });
  });

  it.each([
    [null, 'Checking…'],
    [true, 'Online'],
    [false, 'Offline'],
  ] as const)('renders the %s network state', (online, label) => {
    mockOnline = online;

    const renderer = render();

    expect(text(renderer)).toContain(label);
    expect(
      renderer.root.findAll(
        (node) => typeof node.type === 'string' && node.props.accessibilityRole === 'header'
      )
    ).toHaveLength(4);
  });

  it('shows an unconfigured lookup as unknown, not as up to date', () => {
    mockQuery.data = null;

    // The distinction QueryState exists for: no answer must not render as a
    // confident one.
    const rendered = text(render());
    expect(rendered).toContain('Set APP_STORE_ID');
    expect(rendered).not.toContain('Up to date');
  });

  it('reports being current when the store matches the installed build', () => {
    mockQuery.data = '1.2.0';

    const rendered = text(render());

    expect(rendered).toContain('Up to date');
    expect(rendered).toContain('just now');
  });

  it('announces a newer published version', () => {
    mockQuery.data = '1.3.0';

    expect(text(render())).toContain('Version 1.3.0 is available');
  });

  it('ages the checked-at label off the minute clock', () => {
    mockQuery.data = '1.2.0';
    mockQuery.dataUpdatedAt = Date.now() - 5 * 60_000;

    expect(text(render())).toContain('5 minutes ago');
  });

  it('offers a retry when the lookup failed', () => {
    mockQuery.isError = true;
    mockQuery.error = new AppError({
      kind: 'network',
      message: 'fetch failed',
      userMessage: 'You appear to be offline.',
      retryable: true,
    });

    const renderer = render();
    const retry = renderer.root.find(
      (node) =>
        node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function'
    );
    act(() => retry.props.onPress());

    expect(mockQuery.refetch).toHaveBeenCalledTimes(1);
    expect(text(renderer)).toContain('You appear to be offline.');
  });

  it('shows a loading state while the lookup is in flight', () => {
    mockQuery.isPending = true;

    expect(text(render())).toContain('Checking for updates');
  });
});
