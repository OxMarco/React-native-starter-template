import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
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
    const replace = (
      await rl.question(
        '.env.local already exists. Update app identity and preserve other values? (y/N): '
      )
    )
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

  const existingEnv = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
  const env = updateEnvironment(existingEnv, identity);

  const packageJson = readJson('package.json');
  packageJson.name = slug;

  const packageLock = existsSync('package-lock.json') ? readJson('package-lock.json') : null;
  if (packageLock) {
    packageLock.name = slug;
    if (packageLock.packages?.['']) packageLock.packages[''].name = slug;
  }

  // .env.local is gitignored and EAS Build uploads the git-tracked project, so
  // the same identity has to live somewhere EAS can see it. eas.json is
  // committed and holds nothing secret, which makes it the right home: writing
  // both here is what keeps `npm run init` followed by a cloud build working.
  const easJson = readJson('eas.json');
  easJson.build = { ...easJson.build, base: { ...easJson.build?.base, env: identity } };

  // Every target is fully prepared before the first rename. Each rename is
  // atomic on the local filesystem, so interruption cannot leave a truncated
  // JSON or environment file behind.
  writeFileAtomic('.env.local', env);
  writeJson('package.json', packageJson);
  if (packageLock) writeJson('package-lock.json', packageLock);
  writeJson('eas.json', easJson);

  console.log(`
Starter initialized.

  .env.local   local Expo CLI builds
  eas.json     the same identity for EAS cloud builds
  package.json${packageLock ? ' and package-lock.json' : ''} renamed to "${slug}"

Next: npm install, then npm start.`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

function updateEnvironment(existing, identity) {
  const identityKeys = new Set(Object.keys(identity));
  const preserved = existing
    .split(/\r?\n/)
    .filter((line) => {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
      return !match || !identityKeys.has(match[1]);
    })
    .join('\n')
    .trim();
  const identityLines = Object.entries(identity).map(
    ([key, value]) => `${key}=${JSON.stringify(value)}`
  );
  const projectIdHint = existing.includes('EAS_PROJECT_ID')
    ? []
    : [
        '# Add this after running `eas init`.',
        '# EAS_PROJECT_ID="00000000-0000-0000-0000-000000000000"',
      ];

  return [
    ...identityLines,
    '',
    ...projectIdHint,
    ...(projectIdHint.length ? [''] : []),
    preserved,
    '',
  ]
    .filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
    .join('\n');
}

function writeFileAtomic(path, contents) {
  const temporaryPath = `${path}.starter-init-${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, contents, { flag: 'wx' });
    renameSync(temporaryPath, path);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
}
