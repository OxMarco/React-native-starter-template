import { Platform } from 'react-native';

import { currentAppVersion } from './appVersion';

// Identifies the calling build on API requests.
//
// This is the only practical way a backend can tell which contract revisions
// are still in the wild. Store builds live on devices for months, so "is
// anything still reading this field?" is otherwise unanswerable — and a field
// nobody dares retire is a contract that only ever grows.
//
// Deliberately just a version and a platform, both of which the server can
// already infer in aggregate. No install id, no device id, nothing that turns a
// request log into a per-user trail. Keep it that way: this rides on every
// request, which makes it the most tempting place in the codebase to smuggle in
// an identifier.
//
// Not applied automatically by `requestJson`. On web a custom request header
// triggers a CORS preflight, so a server that has not been told to allow these
// starts failing every call — that has to be a deliberate choice per API, not a
// default the template imposes.

const APP_VERSION = currentAppVersion();
const APP_PLATFORM = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';

/**
 * Spread into the headers of requests to your own API:
 *
 *   requestJson(url, { headers: { ...APP_IDENTITY_HEADERS }, decode })
 *
 * Frozen so a caller spreading it cannot mutate the shared object. Resolved
 * once — neither value changes while the process lives, and this sits on the
 * hot path.
 */
export const APP_IDENTITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  // `currentAppVersion` reports 'unknown' when the manifest has no version.
  // Sending that is worse than sending nothing: it looks like a real value in
  // a dashboard and quietly becomes the largest cohort.
  ...(APP_VERSION === 'unknown' ? {} : { 'X-App-Version': APP_VERSION }),
  'X-App-Platform': APP_PLATFORM,
});
