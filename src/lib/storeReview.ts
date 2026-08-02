import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

import { analytics } from '@/observability/observability';

import { currentAppVersion } from './appVersion';

// Asks for a store rating through the native in-app review dialog, but only
// when the user has plausibly got value out of the app.
//
// Both platforms silently rate-limit this: iOS shows it at most three times a
// year per user and gives no signal about whether it appeared or what the user
// chose. Spending one of those prompts on someone's first launch wastes it and
// biases the rating toward people who have seen the least of the app — hence
// the session, age, and cooldown gates below rather than a bare call.
const SESSIONS_KEY = 'starter:review:sessions:v1';
const FIRST_SESSION_AT_KEY = 'starter:review:first-session-at:v1';
const LAST_ASKED_AT_KEY = 'starter:review:last-asked-at:v1';
const ASKED_VERSION_KEY = 'starter:review:asked-version:v1';

const SESSIONS_BEFORE_PROMPT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_DAYS_SINCE_INSTALL = 3;
const MIN_DAYS_BETWEEN_PROMPTS = 90;

function parseTimestamp(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

// Patch releases ship often — sometimes days apart — so re-prompting on every
// version would burn the yearly prompt budget on bug fixes. Treat a version as
// already asked unless major.minor moved.
export function sameMajorMinor(a: string, b: string): boolean {
  if (!a || !b) return a === b;
  const [aMajor, aMinor = '0'] = a.split('.');
  const [bMajor, bMinor = '0'] = b.split('.');
  return aMajor === bMajor && aMinor === bMinor;
}

/** Call once per launch, before `maybeRequestReview`. */
export async function bumpSessionCount(): Promise<void> {
  try {
    const [[, sessionsRaw], [, firstRaw]] = await AsyncStorage.multiGet([
      SESSIONS_KEY,
      FIRST_SESSION_AT_KEY,
    ]);
    const stored = sessionsRaw ? Number(sessionsRaw) : 0;
    const next = Number.isFinite(stored) ? stored + 1 : 1;
    const writes: [string, string][] = [[SESSIONS_KEY, String(next)]];
    if (parseTimestamp(firstRaw) === null) {
      writes.push([FIRST_SESSION_AT_KEY, String(Date.now())]);
    }
    await AsyncStorage.multiSet(writes);
  } catch {
    // A storage failure must never block startup. Missing a session count only
    // delays the prompt.
  }
}

/**
 * Requests a review when every gate passes. Best-effort and never throws — call
 * it from a moment of success in the product (a completed task, a saved item),
 * not from launch, so the dialog lands when the user is happy with the app.
 */
export async function maybeRequestReview(): Promise<void> {
  try {
    const [isAvailable, hasAction] = await Promise.all([
      StoreReview.isAvailableAsync(),
      StoreReview.hasAction(),
    ]);
    if (!isAvailable || !hasAction) return;

    const version = currentAppVersion();
    const [[, askedVersion], [, sessionsRaw], [, firstRaw], [, lastAskedRaw]] =
      await AsyncStorage.multiGet([
        ASKED_VERSION_KEY,
        SESSIONS_KEY,
        FIRST_SESSION_AT_KEY,
        LAST_ASKED_AT_KEY,
      ]);

    if (askedVersion && sameMajorMinor(askedVersion, version)) return;

    const sessions = sessionsRaw ? Number(sessionsRaw) : 0;
    if (!Number.isFinite(sessions) || sessions < SESSIONS_BEFORE_PROMPT) return;

    const now = Date.now();
    const firstSessionAt = parseTimestamp(firstRaw);
    if (firstSessionAt === null || now - firstSessionAt < MIN_DAYS_SINCE_INSTALL * DAY_MS) return;

    const lastAskedAt = parseTimestamp(lastAskedRaw);
    if (lastAskedAt !== null && now - lastAskedAt < MIN_DAYS_BETWEEN_PROMPTS * DAY_MS) return;

    await StoreReview.requestReview();
    // The OS reports neither whether the dialog appeared nor what was chosen, so
    // this only records how often a prompt was spent.
    analytics.track('review_prompt_requested', { app_version: version });

    const writes: [string, string][] = [[LAST_ASKED_AT_KEY, String(now)]];
    if (version !== 'unknown') writes.push([ASKED_VERSION_KEY, version]);
    await AsyncStorage.multiSet(writes);
  } catch {
    // Best-effort by design: a rating prompt is never worth an error path.
  }
}
