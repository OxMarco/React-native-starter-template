import TestRenderer, { act } from 'react-test-renderer';

import { AppError } from '@/lib/appError';

import { QueryEmpty, QueryError, QueryLoading, QueryUnavailable } from '../QueryState';

jest.mock('@/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: { text: '#162033' } }),
}));

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

function textOf(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAll((node) => typeof node.type === 'string' && node.props.children !== undefined)
    .map((node) => node.props.children)
    .filter((child) => typeof child === 'string');
}

function nodeWithRole(renderer: TestRenderer.ReactTestRenderer, role: string) {
  return renderer.root.find(
    (node) => typeof node.type === 'string' && node.props.accessibilityRole === role
  );
}

// Pressable's handler lives on the composite element; the host view below it
// carries the accessibility props.
function pressableWithRole(renderer: TestRenderer.ReactTestRenderer, role: string) {
  return renderer.root.find(
    (node) => node.props.accessibilityRole === role && typeof node.props.onPress === 'function'
  );
}

describe('QueryState', () => {
  it('announces loading as busy progress', () => {
    const renderer = render(<QueryLoading />);

    expect(nodeWithRole(renderer, 'progressbar').props).toMatchObject({
      accessibilityLabel: 'Loading',
      'aria-busy': true,
    });
  });

  it('renders the operational message for an error, not the raw one', () => {
    const error = new AppError({
      kind: 'network',
      message: 'fetch failed: ECONNREFUSED 10.0.0.1:443',
      userMessage: 'You appear to be offline. Check your connection and try again.',
      retryable: true,
    });

    const renderer = render(<QueryError error={error} />);

    expect(textOf(renderer)).toContain(
      'You appear to be offline. Check your connection and try again.'
    );
    expect(textOf(renderer).join(' ')).not.toContain('ECONNREFUSED');
  });

  it('exposes retry as a button whose label carries the reason', () => {
    const onRetry = jest.fn();
    const error = new AppError({
      kind: 'server',
      message: 'boom',
      userMessage: 'The service is temporarily unavailable.',
      retryable: true,
    });

    const renderer = render(<QueryError error={error} onRetry={onRetry} />);
    const button = pressableWithRole(renderer, 'button');
    act(() => button.props.onPress());

    // A bare "Tap to retry" label tells a screen-reader user nothing about what
    // failed, so the reason is folded into the accessible name.
    expect(button.props.accessibilityLabel).toBe(
      'The service is temporarily unavailable. Tap to retry.'
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders an error without retry as a plain alert', () => {
    const renderer = render(<QueryError error={new Error('nope')} message="Could not load." />);

    expect(nodeWithRole(renderer, 'alert')).toBeTruthy();
    expect(renderer.root.findAll((node) => node.props.accessibilityRole === 'button')).toHaveLength(
      0
    );
  });

  it('keeps "we do not know" distinct from "there is nothing"', () => {
    // The whole reason these are separate components: an unanswered query must
    // never render as a confirmed empty result.
    const unavailable = render(<QueryUnavailable message="Not available offline." />);
    const empty = render(<QueryEmpty message="No orders yet." />);

    expect(textOf(unavailable)).toContain('Not available offline.');
    expect(textOf(empty)).toContain('No orders yet.');
    expect(
      unavailable.root.findAll((node) => node.props.accessibilityLiveRegion === 'polite')
    ).not.toHaveLength(0);
  });
});
