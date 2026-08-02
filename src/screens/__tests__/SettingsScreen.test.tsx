import { Platform } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import SettingsScreen from '../SettingsScreen';

const mockSetPreference = jest.fn(async () => true);
const mockSetConsent = jest.fn(async () => true);
const mockThemeState = {
  preference: 'auto',
  saveError: null as unknown | null,
};
const mockConsentState = {
  value: 'denied',
  hydrated: true,
  writeError: null as unknown | null,
  setValue: mockSetConsent,
};

jest.mock('@/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ ...mockThemeState, setPreference: mockSetPreference }),
}));

jest.mock('@/hooks/usePersistedSetting', () => ({
  usePersistedSetting: () => mockConsentState,
}));

function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<SettingsScreen />);
  });
  return renderer;
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockThemeState.preference = 'auto';
    mockThemeState.saveError = null;
    mockConsentState.value = 'denied';
    mockConsentState.writeError = null;
  });

  it('exposes labelled radio groups with checked state and a single tab stop', () => {
    const renderer = render();
    const groups = hostNodesWithRole(renderer, 'radiogroup');
    const radios = renderer.root.findAll(
      (node) => node.props.accessibilityRole === 'radio' && node.props['aria-checked'] !== undefined
    );

    expect(groups.map((group) => group.props.accessibilityLabel)).toEqual([
      'Appearance',
      'Usage analytics',
    ]);
    expect(
      radios.find((radio) => radio.props.accessibilityLabel === 'Use device setting')?.props
    ).toMatchObject({ 'aria-checked': true, tabIndex: 0 });
    expect(
      radios.find((radio) => radio.props.accessibilityLabel === 'Share anonymous usage data')?.props
    ).toMatchObject({ 'aria-checked': false, tabIndex: -1 });
    expect(
      radios.find((radio) => radio.props.accessibilityLabel === 'Do not share usage data')?.props
    ).toMatchObject({ 'aria-checked': true, tabIndex: 0 });
  });

  it('writes selections through their persisted setting owners', () => {
    const renderer = render();
    const radios = renderer.root.findAll(
      (node) => node.props.accessibilityRole === 'radio' && typeof node.props.onPress === 'function'
    );

    act(() => radios.find((radio) => radio.props.accessibilityLabel === 'Dark')?.props.onPress());
    act(() =>
      radios
        .find((radio) => radio.props.accessibilityLabel === 'Share anonymous usage data')
        ?.props.onPress()
    );

    expect(mockSetPreference).toHaveBeenCalledWith('dark');
    expect(mockSetConsent).toHaveBeenCalledWith('granted');
  });

  it('announces storage failures without hiding either control', () => {
    mockThemeState.saveError = new Error('theme write failed');
    mockConsentState.writeError = new Error('consent write failed');

    const renderer = render();

    expect(hostNodesWithRole(renderer, 'alert')).toHaveLength(2);
    expect(hostNodesWithRole(renderer, 'radio')).toHaveLength(5);
  });
});

// Arrow-key navigation within a radio group is a WAI-ARIA requirement, not a
// nicety: with one tab stop per group, a keyboard user who cannot arrow between
// options cannot reach any choice but the current one. It only exists on web —
// native platforms have their own accessibility focus model — so these render
// with `Platform.OS` forced rather than relying on the default test platform.
describe('SettingsScreen keyboard navigation on web', () => {
  const originalOS = Platform.OS;

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockThemeState.preference = 'auto';
    mockThemeState.saveError = null;
    mockConsentState.value = 'denied';
    mockConsentState.writeError = null;
    // Focus is moved inside a `requestAnimationFrame`, which React Native's jest
    // preset backs with a timer. Without control of it the frame never runs and
    // its callback outlives the test environment.
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('moves the selection forward and follows it with focus', () => {
    const { pressKey, focused } = renderWebGroup('Use device setting');

    act(() => pressKey('ArrowDown'));

    expect(mockSetPreference).toHaveBeenCalledWith('light');
    expect(focused).toEqual([1]);
  });

  it('wraps past the ends of a group rather than trapping at them', () => {
    const first = renderWebGroup('Use device setting');
    act(() => first.pressKey('ArrowUp'));
    expect(mockSetPreference).toHaveBeenCalledWith('dark');
    expect(first.focused).toEqual([2]);

    mockThemeState.preference = 'dark';
    const last = renderWebGroup('Dark');
    act(() => last.pressKey('ArrowRight'));
    expect(mockSetPreference).toHaveBeenLastCalledWith('auto');
    expect(last.focused).toEqual([0]);
  });

  it('drives each group independently', () => {
    const { pressKey } = renderWebGroup('Do not share usage data');

    act(() => pressKey('ArrowLeft'));

    expect(mockSetConsent).toHaveBeenCalledWith('granted');
    expect(mockSetPreference).not.toHaveBeenCalled();
  });

  it('leaves keys it does not own to the browser', () => {
    const { pressKey, prevented } = renderWebGroup('Use device setting');

    act(() => pressKey('Tab'));
    act(() => pressKey('Enter'));

    expect(mockSetPreference).not.toHaveBeenCalled();
    expect(prevented).toBe(0);
  });
});

/**
 * Renders the screen and returns a key-press driver for one radio, standing in
 * for the DOM the web keyboard handler reaches for: the focus calls it makes and
 * whether it claimed the key are what these tests assert on.
 */
function renderWebGroup(label: string) {
  const renderer = render();
  const radio = renderer.root.find(
    (node) => node.props.accessibilityRole === 'radio' && node.props.accessibilityLabel === label
  );
  const state = { focused: [] as number[], prevented: 0 };
  const radios = Array.from({ length: 3 }, (_, index) => ({
    focus: () => state.focused.push(index),
  }));

  return {
    focused: state.focused,
    get prevented() {
      return state.prevented;
    },
    pressKey: (key: string) => {
      radio.props.onKeyDown({
        key,
        preventDefault: () => (state.prevented += 1),
        currentTarget: { parentElement: { querySelectorAll: () => radios } },
      });
      jest.runOnlyPendingTimers();
    },
  };
}

function hostNodesWithRole(renderer: TestRenderer.ReactTestRenderer, role: string) {
  return renderer.root.findAll(
    (node) => typeof node.type === 'string' && node.props.accessibilityRole === role
  );
}
