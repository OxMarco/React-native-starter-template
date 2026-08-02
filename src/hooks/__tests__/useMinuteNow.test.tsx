import { AppState, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { useMinuteNow } from '../useMinuteNow';

function Probe() {
  return <Text>{useMinuteNow().toISOString()}</Text>;
}

function renderedTime(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findByType(Text).props.children as string;
}

describe('useMinuteNow', () => {
  const START = 1_800_000_000_000;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(START);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('ticks once a minute', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<Probe />);
    });
    expect(renderedTime(renderer)).toBe(new Date(START).toISOString());

    jest.spyOn(Date, 'now').mockReturnValue(START + 60_000);
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(renderedTime(renderer)).toBe(new Date(START + 60_000).toISOString());
  });

  it('holds steady between ticks', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<Probe />);
    });
    const initial = renderedTime(renderer);

    jest.spyOn(Date, 'now').mockReturnValue(START + 30_000);
    act(() => {
      jest.advanceTimersByTime(30_000);
    });

    // A shared clock that updates more often than a minute re-renders every
    // consumer for no visible change.
    expect(renderedTime(renderer)).toBe(initial);
  });

  it('refreshes on foreground, because native timers stall in the background', () => {
    const listeners: ((state: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _event: string,
      handler: (state: string) => void
    ) => {
      listeners.push(handler);
      return { remove: jest.fn() };
    }) as unknown as typeof AppState.addEventListener);

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<Probe />);
    });

    // An hour passes while backgrounded and the interval never fires.
    jest.spyOn(Date, 'now').mockReturnValue(START + 3_600_000);
    act(() => {
      listeners.forEach((listener) => listener('active'));
    });

    expect(renderedTime(renderer)).toBe(new Date(START + 3_600_000).toISOString());
  });

  it('clears its timer and subscription on unmount', () => {
    const remove = jest.fn();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockReturnValue({ remove } as unknown as ReturnType<typeof AppState.addEventListener>);
    const clearInterval = jest.spyOn(global, 'clearInterval');

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<Probe />);
    });
    act(() => renderer.unmount());

    expect(remove).toHaveBeenCalledTimes(1);
    expect(clearInterval).toHaveBeenCalled();
  });
});
