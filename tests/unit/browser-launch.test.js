import assert from 'node:assert/strict';
import test from 'node:test';
import { browserLaunchOptions, isMissingBrowserError, launchBrowser } from '../../tools/browser.js';

test('installed browser selection defaults to Chrome and honors one explicit override', () => {
  assert.deepEqual(browserLaunchOptions({}), { channel: 'chrome' });
  assert.deepEqual(browserLaunchOptions({ ZX_BROWSER_CHANNEL: ' msedge ' }), { channel: 'msedge' });
  assert.deepEqual(browserLaunchOptions({ ZX_BROWSER_EXECUTABLE_PATH: ' /opt/browser ' }), { executablePath: '/opt/browser' });
  assert.deepEqual(browserLaunchOptions({ ZX_BROWSER_CHANNEL: ' ', ZX_BROWSER_EXECUTABLE_PATH: '' }), { channel: 'chrome' });
  assert.throws(() => browserLaunchOptions({ ZX_BROWSER_CHANNEL: 'chrome', ZX_BROWSER_EXECUTABLE_PATH: '/opt/browser' }), /mutually exclusive/);
});

test('missing browser classification excludes crashes, permissions and missing host libraries', () => {
  for (const message of [
    'browserType.launch: Chromium distribution "chrome" is not found at /opt/google/chrome',
    'browserType.launch: Executable doesn\'t exist at /opt/browser',
    'browserType.launch: Failed to launch chromium because executable does not exist at /opt/browser',
    'browserType.launch: spawn /opt/browser ENOENT'
  ]) assert.equal(isMissingBrowserError(new Error(message)), true, message);
  for (const message of [
    'browserType.launch: Target page, context or browser has been closed',
    'browserType.launch: spawn /opt/browser EACCES',
    'browserType.launch: Operation not permitted (EPERM)',
    'error while loading shared libraries: libX11.so: cannot open shared object file',
    'Host system is missing dependencies to run browsers.',
    'browser process exited with signal SIGABRT'
  ]) assert.equal(isMissingBrowserError(new Error(message)), false, message);
});

test('optional checks skip only missing executables; explicit suites propagate every launch failure', async () => {
  const missing = new Error('Executable doesn\'t exist at /missing');
  const broken = new Error('Permission denied: EACCES');
  const launcher = (error) => ({ launch: async () => { throw error; } });
  assert.equal(await launchBrowser({ optional: true, env: {}, browserType: launcher(missing) }), null);
  await assert.rejects(launchBrowser({ env: {}, browserType: launcher(missing) }), (error) => error === missing);
  await assert.rejects(launchBrowser({ optional: true, env: {}, browserType: launcher(broken) }), (error) => error === broken);
  let calls = 0;
  await assert.rejects(launchBrowser({ env: { ZX_BROWSER_CHANNEL: 'chrome', ZX_BROWSER_EXECUTABLE_PATH: '/browser' },
    browserType: { launch: async () => { calls++; } } }), /mutually exclusive/);
  assert.equal(calls, 0);
});

test('launch forwards only the selected installed browser and never silently retries', async () => {
  const options = [];
  const browser = {};
  const result = await launchBrowser({ env: { ZX_BROWSER_EXECUTABLE_PATH: '/browser' },
    browserType: { launch: async (value) => { options.push(value); return browser; } } });
  assert.equal(result, browser);
  assert.deepEqual(options, [{ executablePath: '/browser' }]);
});
