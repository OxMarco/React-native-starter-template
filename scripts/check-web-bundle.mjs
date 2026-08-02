import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

const OUTPUT_DIRECTORY = 'dist';
// Budgets are ratchets, not targets: they exist to make a size regression a
// failing build rather than something noticed a release later. Raise one only
// alongside the change that needs it, and say why.
//
// The JavaScript budgets jumped from 2.6 MB / 650 KB when Sentry and PostHog
// were added — roughly 700 KB raw of vendor SDK. That is a real cost on web,
// where it is the whole download rather than part of an installed binary. If a
// product cares more about web weight than about web telemetry, the escape
// hatch is a `setup.web.ts` that registers no adapters; Metro resolves it for
// the web target and the facades stay safe no-ops.
const MAX_JAVASCRIPT_BYTES = 3_520_000;
const MAX_GZIPPED_JAVASCRIPT_BYTES = 875_000;
const MAX_CSS_BYTES = 200_000;

const files = walk(OUTPUT_DIRECTORY);
const javascript = files.filter((file) => extname(file) === '.js');
const stylesheets = files.filter((file) => extname(file) === '.css');
const javascriptBytes = totalBytes(javascript);
const gzippedJavascriptBytes = javascript.reduce(
  (total, file) => total + gzipSync(readFileSync(file)).byteLength,
  0
);
const cssBytes = totalBytes(stylesheets);

const measurements = [
  ['JavaScript', javascriptBytes, MAX_JAVASCRIPT_BYTES],
  ['gzipped JavaScript', gzippedJavascriptBytes, MAX_GZIPPED_JAVASCRIPT_BYTES],
  ['CSS', cssBytes, MAX_CSS_BYTES],
];

for (const [label, bytes, budget] of measurements) {
  console.log(`${label}: ${formatBytes(bytes)} / ${formatBytes(budget)}`);
}

const exceeded = measurements.filter(([, bytes, budget]) => bytes > budget);
if (exceeded.length) {
  throw new Error(`Web bundle budget exceeded: ${exceeded.map(([label]) => label).join(', ')}`);
}

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : path;
  });
}

function totalBytes(paths) {
  return paths.reduce((total, path) => total + statSync(path).size, 0);
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
