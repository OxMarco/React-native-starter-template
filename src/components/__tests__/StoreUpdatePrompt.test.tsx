import { Alert, Platform } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import StoreUpdatePrompt from '../StoreUpdatePrompt';

const mockQuery: { data: string | null } = { data: null };
const mockOpenExternalUrl = jest.fn();
const mockTrack = jest.fn();
const mockConfig = {
  appStoreUrl: 'https://apps.apple.com/app/id1234567890',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.acme.app',
};

jest.mock('@/hooks/useLatestStoreVersion', () => ({
  useLatestStoreVersion: () => mockQuery,
}));

jest.mock('@/lib/appVersion', () => ({
  currentAppVersion: () => '1.2.0',
  isUpdateAvailable: jest.requireActual('@/lib/appVersion').isUpdateAvailable,
}));

jest.mock('@/lib/appConfig', () => ({
  appStoreUrl: () => mockConfig.appStoreUrl,
  playStoreUrl: () => mockConfig.playStoreUrl,
}));

jest.mock('@/lib/openExternalUrl', () => ({
  openExternalUrl: (url: string) => mockOpenExternalUrl(url),
}));

jest.mock('@/observability/observability', () => ({
  analytics: { track: (...args: unknown[]) => mockTrack(...args) },
}));

function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<StoreUpdatePrompt />);
  });
  return renderer;
}

function alertButtons() {
  return (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as {
    text: string;
    onPress?: () => void;
  }[];
}

describe('StoreUpdatePrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockQuery.data = null;
    mockConfig.appStoreUrl = 'https://apps.apple.com/app/id1234567890';
    mockConfig.playStoreUrl = 'https://play.google.com/store/apps/details?id=com.acme.app';
  });

  afterEach(() => jest.restoreAllMocks());

  it('stays silent while the lookup has no answer', () => {
    render();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('stays silent when the installed version is current', () => {
    mockQuery.data = '1.2.0';
    render();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('prompts once when a newer version is published', () => {
    mockQuery.data = '1.3.0';
    const renderer = render();

    act(() => {
      renderer.update(<StoreUpdatePrompt />);
    });

    // Once per session: re-prompting on every focus-triggered refetch would
    // make the app unusable for anyone who chose "Later".
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('app_update_prompted', { latest_version: '1.3.0' });
  });

  it('sends the user to the store for their platform', () => {
    mockQuery.data = '1.3.0';
    render();

    act(() =>
      alertButtons()
        .find((button) => button.text === 'Update')
        ?.onPress?.()
    );

    const expected = Platform.OS === 'ios' ? mockConfig.appStoreUrl : mockConfig.playStoreUrl;
    expect(mockOpenExternalUrl).toHaveBeenCalledWith(expected);
    expect(mockTrack).toHaveBeenCalledWith('app_update_prompt_accepted', {
      latest_version: '1.3.0',
    });
  });

  it('does nothing when dismissed', () => {
    mockQuery.data = '1.3.0';
    render();

    act(() =>
      alertButtons()
        .find((button) => button.text === 'Later')
        ?.onPress?.()
    );

    expect(mockOpenExternalUrl).not.toHaveBeenCalled();
  });

  it('does not prompt with nowhere to send the user', () => {
    // An update alert with no store URL is worse than no alert at all.
    mockConfig.appStoreUrl = null as unknown as string;
    mockConfig.playStoreUrl = null as unknown as string;
    mockQuery.data = '1.3.0';

    render();

    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
