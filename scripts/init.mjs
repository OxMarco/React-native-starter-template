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

async function ask(question, fallback) {
  const answer = (await rl.question(`${question} (${fallback}): `)).trim();
  return answer || fallback;
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
  const slug = await ask('Expo slug', slugify(appName) || 'my-app');
  const identifier = identifierPart(slug) || 'myapp';
  const scheme = await ask('Deep-link scheme', identifier);
  const organization = await ask('Reverse-domain organization', 'com.example');
  const iosBundleIdentifier = await ask('iOS bundle identifier', `${organization}.${identifier}`);
  const androidPackage = await ask('Android package', iosBundleIdentifier);

  const env = [
    `APP_NAME=${JSON.stringify(appName)}`,
    `APP_SLUG=${JSON.stringify(slug)}`,
    `APP_SCHEME=${JSON.stringify(scheme)}`,
    `IOS_BUNDLE_IDENTIFIER=${JSON.stringify(iosBundleIdentifier)}`,
    `ANDROID_PACKAGE=${JSON.stringify(androidPackage)}`,
    '',
    '# Add this after running `npx eas-cli init`.',
    '# EAS_PROJECT_ID="00000000-0000-0000-0000-000000000000"',
    '',
  ].join('\n');

  writeFileSync('.env.local', env);

  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  packageJson.name = slug;
  writeFileSync('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

  console.log('\nStarter initialized. Next: npm install, then npm start.');
}
