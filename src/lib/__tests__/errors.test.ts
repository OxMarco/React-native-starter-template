import { friendlyErrorMessage } from '../errors';

describe('friendlyErrorMessage', () => {
  it('returns useful copy for common transport failures', () => {
    expect(friendlyErrorMessage(new Error('Network request failed'))).toContain('offline');
    expect(friendlyErrorMessage(new Error('Request timed out'))).toContain('timed out');
    expect(friendlyErrorMessage(new Error('Request failed (503)'))).toContain('unavailable');
    expect(friendlyErrorMessage(new Error('Request failed (429)'))).toContain('Too many');
  });

  it('does not expose an unexpected raw error', () => {
    const raw = 'private backend path /users/42 failed';
    expect(friendlyErrorMessage(new Error(raw))).not.toContain(raw);
  });
});
