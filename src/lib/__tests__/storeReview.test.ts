import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

import { bumpSessionCount, maybeRequestReview, sameMajorMinor } from '../storeReview';

jest.mock('../appVersion', () => ({ currentAppVersion: () => '1.4.0' }));

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

const isAvailableAsync = StoreReview.isAvailableAsync as jest.Mock;
const hasAction = StoreReview.hasAction as jest.Mock;
const requestReview = StoreReview.requestReview as jest.Mock;

async function seed(overrides: Record<string, string> = {}) {
  await AsyncStorage.multiSet([
    ['starter:review:sessions:v1', '5'],
    ['starter:review:first-session-at:v1', String(NOW - 10 * DAY_MS)],
    ...Object.entries(overrides),
  ] as [string, string][]);
}

describe('sameMajorMinor', () => {
  it.each([
    ['1.4.0', '1.4.9', true],
    ['1.4', '1.4.0', true],
    ['1.4.0', '1.5.0', false],
    ['1.4.0', '2.4.0', false],
  ])('%s vs %s → %s', (a, b, expected) => {
    // Patch releases ship often; re-prompting on each one burns the yearly
    // prompt budget on bug fixes.
    expect(sameMajorMinor(a, b)).toBe(expected);
  });
});

describe('maybeRequestReview', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    isAvailableAsync.mockResolvedValue(true);
    hasAction.mockResolvedValue(true);
    requestReview.mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('prompts once every gate passes, and records that it spent one', async () => {
    await seed();

    await maybeRequestReview();

    expect(requestReview).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem('starter:review:last-asked-at:v1')).toBe(String(NOW));
    expect(await AsyncStorage.getItem('starter:review:asked-version:v1')).toBe('1.4.0');
  });

  it('stays silent before the user has had a few sessions', async () => {
    await seed({ 'starter:review:sessions:v1': '2' });

    await maybeRequestReview();

    expect(requestReview).not.toHaveBeenCalled();
  });

  it('stays silent in the first days after install', async () => {
    await seed({ 'starter:review:first-session-at:v1': String(NOW - DAY_MS) });

    await maybeRequestReview();

    expect(requestReview).not.toHaveBeenCalled();
  });

  it('respects the cooldown between prompts', async () => {
    await seed({ 'starter:review:last-asked-at:v1': String(NOW - 30 * DAY_MS) });

    await maybeRequestReview();

    expect(requestReview).not.toHaveBeenCalled();
  });

  it('does not re-ask within the same minor version', async () => {
    await seed({ 'starter:review:asked-version:v1': '1.4.9' });

    await maybeRequestReview();

    expect(requestReview).not.toHaveBeenCalled();
  });

  it('stays silent where the platform offers no review action', async () => {
    hasAction.mockResolvedValue(false);
    await seed();

    await maybeRequestReview();

    expect(requestReview).not.toHaveBeenCalled();
  });

  it('never throws when the platform call fails', async () => {
    await seed();
    requestReview.mockRejectedValue(new Error('unavailable'));

    await expect(maybeRequestReview()).resolves.toBeUndefined();
  });
});

describe('bumpSessionCount', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => jest.restoreAllMocks());

  it('starts the counter and stamps the first session', async () => {
    await bumpSessionCount();

    expect(await AsyncStorage.getItem('starter:review:sessions:v1')).toBe('1');
    expect(await AsyncStorage.getItem('starter:review:first-session-at:v1')).toBe(String(NOW));
  });

  it('increments without moving the install stamp', async () => {
    await AsyncStorage.multiSet([
      ['starter:review:sessions:v1', '4'],
      ['starter:review:first-session-at:v1', String(NOW - 5 * DAY_MS)],
    ]);

    await bumpSessionCount();

    expect(await AsyncStorage.getItem('starter:review:sessions:v1')).toBe('5');
    expect(await AsyncStorage.getItem('starter:review:first-session-at:v1')).toBe(
      String(NOW - 5 * DAY_MS)
    );
  });
});
