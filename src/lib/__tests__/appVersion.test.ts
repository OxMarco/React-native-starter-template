import { isUpdateAvailable } from '../appVersion';

describe('isUpdateAvailable', () => {
  it.each([
    ['1.2.3', '1.2.4'],
    ['1.2.3', '1.3.0'],
    ['1.2.3', '2.0.0'],
    ['1.2', '1.2.1'],
    ['1.9.0', '1.10.0'],
  ])('reports %s → %s as an update', (current, latest) => {
    expect(isUpdateAvailable(current, latest)).toBe(true);
  });

  it.each([
    ['1.2.3', '1.2.3'],
    ['1.2.3', '1.2.2'],
    ['2.0.0', '1.9.9'],
    // Trailing zero segments must compare equal, or every user on "1.2" is
    // nagged forever to update to "1.2.0".
    ['1.2', '1.2.0'],
    ['1.2.0', '1.2'],
  ])('reports %s → %s as no update', (current, latest) => {
    expect(isUpdateAvailable(current, latest)).toBe(false);
  });

  it.each([
    [null, '1.2.3'],
    ['1.2.3', null],
    [undefined, undefined],
    ['unknown', '1.2.3'],
    ['1.2.3', '1.2.3-beta'],
    ['', '1.2.3'],
  ])('stays silent for unparseable input (%s → %s)', (current, latest) => {
    // Skipping the nudge is always recoverable; nagging a user who is already
    // current is not, so anything we cannot parse means "no update".
    expect(isUpdateAvailable(current, latest)).toBe(false);
  });
});
