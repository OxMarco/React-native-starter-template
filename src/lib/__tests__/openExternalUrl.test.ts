import { Alert, Linking } from 'react-native';

import { isAllowedExternalUrl, openExternalUrl } from '../openExternalUrl';

describe('isAllowedExternalUrl', () => {
  it.each(['https://example.com', 'http://example.com', 'mailto:hi@example.com', 'HTTPS://EX.COM'])(
    'allows %s',
    (url) => {
      expect(isAllowedExternalUrl(url)).toBe(true);
    }
  );

  it.each([
    'tel:+15551234567',
    'sms:+15551234567',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'myapp://transfer?amount=100',
    'itms-apps://apps.apple.com',
    '//example.com',
    'example.com',
    '',
  ])('rejects %s', (url) => {
    expect(isAllowedExternalUrl(url)).toBe(false);
  });
});

describe('openExternalUrl', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  it('opens an allowed link', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

    openExternalUrl('https://example.com/help');

    expect(openURL).toHaveBeenCalledWith('https://example.com/help');
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('never reaches Linking for a disallowed scheme', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

    openExternalUrl('javascript:alert(1)');

    expect(openURL).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('surfaces a refusal instead of leaving an unhandled rejection', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));

    openExternalUrl('https://example.com');
    await Promise.resolve();
    await Promise.resolve();

    expect(Alert.alert).toHaveBeenCalledWith('Unable to open link', 'https://example.com');
  });
});
