import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = createInterface({ input, output });

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function identifierPart(value) {
  const normalized = value.replace(/-/g, '').replace(/[^a-zA-Z0-9]/g, '');
  return /^[a-zA-Z]/.test(normalized) ? normalized.toLowerCase() : `app${normalized}`;
}

// Validated at prompt time rather than at prebuild: an application id that only
// Gradle or Xcode rejects surfaces minutes later, inside a native build log.
const VALIDATORS = {
  slug: {
    test: (value) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value),
    hint: 'lowercase letters, digits, and single hyphens (my-app)',
  },
  scheme: {
    test: (value) => /^[a-z][a-z0-9+.-]*$/.test(value),
    hint: 'a letter followed by letters, digits, +, . or - (myapp)',
  },
  applicationId: {
    // Android application ids and iOS bundle identifiers overlap on this
    // shape: dot-separated segments, each starting with a letter. Android also
    // rejects reserved Java keywords, which is why `new`/`class` style
    // segments are worth avoiding even though this does not enumerate them.
    test: (value) => /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(value),
    hint: 'at least two dot-separated segments, each starting with a letter (com.acme.myapp)',
  },
};

async function ask(question, fallback, validator) {
  for (;;) {
    const answer = (await rl.question(`${question} (${fallback}): `)).trim() || fallback;
    if (!validator || validator.test(answer)) return answer;
    console.log(`  "${answer}" is not valid — expected ${validator.hint}.`);
  }
}

try {
  if (existsSync('.env.local')) {
    const replace = (await rl.question('.env.local already exists. Replace it? (y/N): '))
      .trim()
      .toLowerCase();
    if (replace !== 'y' && replace !== 'yes') {
      console.log('No files changed.');
      process.exitCode = 0;
    } else {
      await initialize();
    }
  } else {
    await initialize();
  }
} finally {
  rl.close();
}

async function initialize() {
  const appName = await ask('App display name', 'My App');
  const slug = await ask('Expo slug', slugify(appName) || 'my-app', VALIDATORS.slug);
  const identifier = identifierPart(slug) || 'myapp';
  const scheme = await ask('Deep-link scheme', identifier, VALIDATORS.scheme);
  const organization = await ask('Reverse-domain organization', 'com.example');
  const iosBundleIdentifier = await ask(
    'iOS bundle identifier',
    `${organization}.${identifier}`,
    VALIDATORS.applicationId
  );
  const androidPackage = await ask(
    'Android package',
    iosBundleIdentifier,
    VALIDATORS.applicationId
  );

  const identity = {
    APP_NAME: appName,
    APP_SLUG: slug,
    APP_SCHEME: scheme,
    IOS_BUNDLE_IDENTIFIER: iosBundleIdentifier,
    ANDROID_PACKAGE: androidPackage,
  };

  const env = [
    ...Object.entries(identity).map(([key, value]) => `${key}=${JSON.stringify(value)}`),
    '',
    '# Add this after running `npx eas-cli init`.',
    '# EAS_PROJECT_ID="00000000-0000-0000-0000-000000000000"',
    '',
  ].join('\n');

  writeFileSync('.env.local', env);

  const packageJson = readJson('package.json');
  packageJson.name = slug;
  writeJson('package.json', packageJson);

  // .env.local is gitignored and EAS Build uploads the git-tracked project, so
  // the same identity has to live somewhere EAS can see it. eas.json is
  // committed and holds nothing secret, which makes it the right home: writing
  // both here is what keeps `npm run init` followed by a cloud build working.
  const easJson = readJson('eas.json');
  easJson.build = { ...easJson.build, base: { ...easJson.build?.base, env: identity } };
  writeJson('eas.json', easJson);

  console.log(`
Starter initialized.

  .env.local   local Expo CLI builds
  eas.json     the same identity for EAS cloud builds
  package.json renamed to "${slug}"

Next: npm install, then npm start.`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
