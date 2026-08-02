import { Alert, Linking } from 'react-native';

// `Linking.openURL` will happily open any scheme the device can handle, so a URL
// that came from a server response, a deep link, or user-generated content can
// reach `tel:`, `sms:`, `file:`, an installed app's private scheme, or
// `javascript:` on web. Route every outbound link through here and only web and
// mail links get through.
const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto']);

export function isAllowedExternalUrl(url: string): boolean {
  // Parse the scheme directly rather than via `new URL()` — Hermes' URL
  // implementation is incomplete and inconsistent across platforms. RFC 3986
  // scheme grammar: ALPHA *( ALPHA / DIGIT / "+" / "-" / "." ).
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url.trim());
  return match !== null && ALLOWED_SCHEMES.has(match[1].toLowerCase());
}

/**
 * Opens an external URL, surfacing an alert when the scheme is not allowed or
 * the device refuses to open it — Screen Time and web-content restrictions, a
 * supervised/MDM profile, or simply no installed handler. Without the catch,
 * `Linking.openURL`'s rejection would surface as an unhandled promise rejection
 * and be reported as a crash.
 */
export function openExternalUrl(url: string): void {
  if (!isAllowedExternalUrl(url)) {
    Alert.alert('Unable to open link', url);
    return;
  }
  Linking.openURL(url).catch(() => {
    Alert.alert('Unable to open link', url);
  });
}
