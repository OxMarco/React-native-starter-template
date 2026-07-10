import { shouldPersistMutation, shouldPersistQuery } from '../queryPersistence';

describe('query persistence policy', () => {
  it('persists only successful, explicitly safe queries', () => {
    expect(shouldPersistQuery({ state: { status: 'success' }, meta: { persist: true } })).toBe(
      true
    );
    expect(shouldPersistQuery({ state: { status: 'success' } })).toBe(false);
    expect(
      shouldPersistQuery({
        state: { status: 'success' },
        meta: { persist: true, sensitive: true },
      })
    ).toBe(false);
    expect(shouldPersistQuery({ state: { status: 'error' }, meta: { persist: true } })).toBe(false);
  });

  it('persists only paused, explicitly registered offline mutations', () => {
    expect(
      shouldPersistMutation({
        state: { isPaused: true },
        meta: { persist: true, offline: true },
      })
    ).toBe(true);
    expect(
      shouldPersistMutation({
        state: { isPaused: false },
        meta: { persist: true, offline: true },
      })
    ).toBe(false);
    expect(shouldPersistMutation({ state: { isPaused: true }, meta: { persist: true } })).toBe(
      false
    );
  });
});
