import assert from 'node:assert/strict';
import test from 'node:test';

import { launchBrowser } from '../../tools/browser.js';
import { smokeVerdict } from '../../tools/run-smoke.js';
import { startServer } from '../../tools/serve-child.js';

/*
 * The browser suites are only as trustworthy as the plumbing around them: which server they test,
 * which browser they launch, and how they read a suite's result. Each of these once let a broken
 * run report success.
 */

test('a smoke result passes only with completed checks and no failures', () => {
  assert.equal(smokeVerdict('source', { passed: 12, failed: 0, results: [{ passed: true }] }, 'pass').ok, true);
  assert.equal(smokeVerdict('dist', { passed: true, failed: 0, results: [{ name: 'bundle', passed: true }] }, 'pass').ok, true);

  // The shapes that used to pass because they hold no failing entry to find.
  for (const [name, result] of [
    ['source', { passed: 0, failed: 1, results: [] }],
    ['source', { passed: 0, failed: 0, results: [] }],
    ['source', { passed: 5, failed: 2, results: [] }],
    ['source', { passed: '5', failed: 0, results: [] }],
    ['source', { passed: 5, failed: 0 }],
    ['dist', { passed: true, failed: 0, results: [] }],
    ['dist', { passed: true, failed: 1, results: [{ name: 'bundle', passed: true }] }],
    ['dist', { passed: false, failed: 0, results: [{ name: 'bundle', passed: true }] }],
    ['source', null]
  ]) {
    assert.equal(smokeVerdict(name, result).ok, false, `${name}: ${JSON.stringify(result)}`);
  }
  // A failing entry, or a page that says it failed, still fails.
  assert.equal(smokeVerdict('source', { passed: 3, failed: 0, results: [{ passed: false }] }).ok, false);
  assert.equal(smokeVerdict('source', { passed: 3, failed: 0, results: [] }, 'fail').ok, false);
});

test('the dev server child starts on a free port, serves this tree, and survives a malformed path', async () => {
  const server = await startServer({ readyPath: 'tests/smoke/smoke.html' });
  try {
    assert.match(server.base, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.ok(server.port > 0);
    assert.equal((await fetch(`${server.base}/%ZZ`)).status, 400);
    assert.equal((await fetch(`${server.base}/tests/smoke/smoke.html`)).status, 200);
    assert.equal(server.errors(), '');
  } finally {
    server.stop();
  }
});

test('a port that is taken, or a tree without the expected file, fails the start', async () => {
  const first = await startServer();
  try {
    await assert.rejects(startServer({ port: first.port }), /exited .*before listening.*EADDRINUSE/s);
  } finally {
    first.stop();
  }
  await assert.rejects(startServer({ readyPath: 'tests/no-such-page.html' }), /answered 404/);
});

test('a suite keeps its own launch flags but never its own browser', async () => {
  const seen = [];
  const browserType = { launch: async (options) => { seen.push(options); return {}; } };
  await launchBrowser({ env: {}, browserType, options: { args: ['--disable-gpu'], handleSIGINT: false, channel: 'chromium' } });
  await launchBrowser({ env: { ZX_BROWSER_EXECUTABLE_PATH: '/browser' }, browserType, options: { args: ['--disable-gpu'] } });
  assert.deepEqual(seen, [
    { args: ['--disable-gpu'], handleSIGINT: false, channel: 'chrome' },
    { args: ['--disable-gpu'], executablePath: '/browser' }
  ]);
});
