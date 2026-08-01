import { useEffect, type ReactElement } from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import {
  configureObservability,
  resetObservabilityConfiguration,
} from '@/observability/observability';

import ErrorBoundary from '../ErrorBoundary';

const captureException = jest.fn();

// React logs every boundary-caught error; these tests throw on purpose.
let consoleError: jest.SpyInstance;
let consoleWarn: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  resetObservabilityConfiguration();
  configureObservability({ errors: { captureException } });
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleError.mockRestore();
  consoleWarn.mockRestore();
  resetObservabilityConfiguration();
});

// The fallback renders in a follow-up commit, so creation has to flush inside
// act() or the assertions run against a tree React has not rebuilt yet.
function render(element: ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

function texts(renderer: TestRenderer.ReactTestRenderer): string {
  return JSON.stringify(renderer.toJSON());
}

function pressRetry(renderer: TestRenderer.ReactTestRenderer) {
  const retry = renderer.root.findAll(
    (node) =>
      node.props?.accessibilityRole === 'button' && typeof node.props?.onPress === 'function'
  )[0];
  act(() => retry.props.onPress());
}

describe('ErrorBoundary', () => {
  it('renders the fallback and reports the error with its context', () => {
    function Boom(): ReactElement {
      throw new Error('render exploded');
    }

    const renderer = render(
      <ErrorBoundary context="TestScreen">
        <Boom />
      </ErrorBoundary>
    );

    expect(texts(renderer)).toContain('Something went wrong');
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: 'TestScreen' })
    );
  });

  it('keeps the raw error message out of the fallback copy', () => {
    function Boom(): ReactElement {
      throw new Error('SELECT * FROM secrets failed at 10.0.0.1');
    }

    const renderer = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(texts(renderer)).not.toContain('10.0.0.1');
    expect(texts(renderer)).not.toContain('SELECT');
  });

  it('gives the children a fresh mount when retry succeeds', () => {
    let mounts = 0;
    let crash = true;

    function Counted(): ReactElement {
      useEffect(() => {
        mounts += 1;
      }, []);
      if (crash) throw new Error('render exploded');
      return <Text>recovered</Text>;
    }

    const renderer = render(
      <ErrorBoundary context="TestScreen">
        <Counted />
      </ErrorBoundary>
    );

    // The crashed render never committed, so nothing has mounted yet.
    expect(mounts).toBe(0);

    crash = false;
    pressRetry(renderer);

    expect(mounts).toBe(1);
    expect(texts(renderer)).toContain('recovered');
  });
});
