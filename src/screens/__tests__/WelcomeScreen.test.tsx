import TestRenderer, { act } from 'react-test-renderer';

import WelcomeScreen from '../WelcomeScreen';

const mockMarkOnboardingComplete = jest.fn();
const mockSetOnboardingGateComplete = jest.fn();
const mockTrack = jest.fn();

jest.mock('@/lib/onboarding', () => ({
  markOnboardingComplete: () => mockMarkOnboardingComplete(),
}));

jest.mock('@/navigation/linking', () => ({
  setOnboardingGateComplete: (complete: boolean) => mockSetOnboardingGateComplete(complete),
}));

jest.mock('@/observability/observability', () => ({
  analytics: { track: (...args: unknown[]) => mockTrack(...args) },
}));

jest.mock('@/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: { primaryContrast: '#ffffff' } }),
}));

function getButton(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.find((node) => node.props.accessibilityRole === 'button');
}

describe('WelcomeScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens the deep-link gate only after onboarding is durably saved', async () => {
    const replace = jest.fn();
    mockMarkOnboardingComplete.mockResolvedValueOnce(undefined);
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <WelcomeScreen navigation={{ replace } as never} route={{} as never} />
      );
    });

    await act(async () => {
      getButton(renderer).props.onPress();
    });

    expect(mockMarkOnboardingComplete).toHaveBeenCalledTimes(1);
    expect(mockSetOnboardingGateComplete).toHaveBeenCalledWith(true);
    expect(mockTrack).toHaveBeenCalledWith('onboarding_completed', { source: 'welcome' });
    expect(replace).toHaveBeenCalledWith('Main');
  });

  it('stays on Welcome and exposes an alert when saving fails', async () => {
    const replace = jest.fn();
    mockMarkOnboardingComplete.mockRejectedValueOnce(new Error('disk full'));
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <WelcomeScreen navigation={{ replace } as never} route={{} as never} />
      );
    });

    await act(async () => {
      getButton(renderer).props.onPress();
    });

    expect(renderer.root.findByProps({ accessibilityRole: 'alert' })).toBeDefined();
    expect(mockSetOnboardingGateComplete).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
