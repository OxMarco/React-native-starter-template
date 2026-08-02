import TestRenderer, { act } from 'react-test-renderer';

import SettingsScreen from '../SettingsScreen';

const mockSetPreference = jest.fn(async () => true);
const mockSetConsent = jest.fn(async () => true);
const mockThemeState = {
  preference: 'auto',
  saveError: null as unknown | null,
};
const mockConsentState = {
  value: 'undecided',
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
    mockConsentState.value = 'undecided';
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
    ).toMatchObject({ 'aria-checked': false, tabIndex: 0 });
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

function hostNodesWithRole(renderer: TestRenderer.ReactTestRenderer, role: string) {
  return renderer.root.findAll(
    (node) => typeof node.type === 'string' && node.props.accessibilityRole === role
  );
}
