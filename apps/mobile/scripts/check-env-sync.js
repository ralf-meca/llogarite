// Fails the build when .env.production and eas.json's production env block
// disagree.
//
// The same production values have to live in two places because they feed two
// different build paths: eas.json's `build.production.env` applies only to EAS
// cloud builds, while a local `gradlew bundleRelease` never reads eas.json at
// all -- it picks up .env.production through @expo/env. Nothing keeps the two
// in sync, and a mismatch fails silently: the build succeeds and the app just
// ships pointing at the wrong backend.
const fs = require('fs');
const path = require('path');

const mobileRoot = path.resolve(__dirname, '..');
const envPath = path.join(mobileRoot, '.env.production');
const easPath = path.join(mobileRoot, 'eas.json');

function parseEnv(contents) {
  const values = {};
  contents.split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      return;
    }
    const index = line.indexOf('=');
    if (index === -1) {
      return;
    }
    values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  });
  return values;
}

function fail(lines) {
  console.error(`\nenv sync check failed\n\n${lines.join('\n')}\n`);
  process.exit(1);
}

if (!fs.existsSync(envPath)) {
  fail([
    'apps/mobile/.env.production is missing.',
    '',
    'A local release build would fall back to .env (dev values) and ship a',
    'loopback API URL. Recreate it from eas.json\'s build.production.env block.',
  ]);
}

const fileEnv = parseEnv(fs.readFileSync(envPath, 'utf8'));
const easEnv = JSON.parse(fs.readFileSync(easPath, 'utf8')).build?.production?.env ?? {};

const problems = [];
Object.keys({ ...easEnv, ...fileEnv })
  .sort()
  .forEach((key) => {
    const fromFile = fileEnv[key];
    const fromEas = easEnv[key];
    if (fromFile === fromEas) {
      return;
    }
    if (fromFile === undefined) {
      problems.push(`  ${key}\n    .env.production  (missing)\n    eas.json         ${fromEas}`);
    } else if (fromEas === undefined) {
      problems.push(`  ${key}\n    .env.production  ${fromFile}\n    eas.json         (missing)`);
    } else {
      problems.push(`  ${key}\n    .env.production  ${fromFile}\n    eas.json         ${fromEas}`);
    }
  });

if (problems.length > 0) {
  fail([
    'apps/mobile/.env.production and eas.json disagree on production values.',
    'Local builds read the first, EAS cloud builds read the second, so the two',
    'paths would ship different apps.',
    '',
    ...problems,
  ]);
}

const count = Object.keys(fileEnv).length;
console.log(`env sync check passed (${count} value${count === 1 ? '' : 's'} match eas.json)`);
