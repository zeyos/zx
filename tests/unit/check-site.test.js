import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

/*
 * `tools/check-site.js` is the last gate before a deploy, and its failure mode is silence: a
 * reference it does not look at passes. Each case below starts from a minimal site the audit
 * accepts and breaks exactly one thing it must catch.
 */

/** The files every site needs before the audit looks at anything else. */
const REQUIRED = ['docs.html', 'layouts.html', 'layouts.js', 'layouts.css', 'layouts/kit.css',
  'layout.html', 'layout.js', 'layout-host.js', 'llms.txt', 'CNAME', 'docs/llms.md',
  'demos/example.demo.js', 'layouts/example.layout.js', 'layouts/example.layout.css',
  'v/revision/styles.css', 'v/revision/index.js', 'styles.css', 'index.js', 'theme.css', 'part.css'];

/**
 * Runs the audit against a fresh minimal site, after `change` has edited it.
 * @param {(put: (file: string, contents?: string) => void) => void} change
 * @returns {import('node:child_process').SpawnSyncReturns<string>}
 */
function auditWith(change) {
  const directory = mkdtempSync(join(tmpdir(), 'zx-check-site-'));
  const put = (file, contents = '') => {
    const path = join(directory, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  };
  try {
    for (const file of REQUIRED) put(file);
    put('docs.js', "const COMPONENT_IDS = ['example'];");
    put('layouts/index.js', "const TEMPLATE_IDS = ['example'];\nconst PATTERN_IDS = ['example'];");
    put('theme.css', '@import "./part.css";\n@import \'./part.css\';\n@import url("./part.css");');
    // A consumer's deployment path in a guide's sample is documentation, not a reference.
    put('index.html', '<link href="/v/revision/styles.css"><script type="module" src="/v/revision/index.js"></script>'
      + '<pre><code>&lt;link href="/assets/zx.css"&gt;</code></pre>');
    change(put);
    return spawnSync(process.execPath, [new URL('../../tools/check-site.js', import.meta.url).pathname], {
      env: { ...process.env, SITE_DIR: directory }, encoding: 'utf8'
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('the minimal site passes the audit', () => {
  const result = auditWith(() => {});
  assert.equal(result.status, 0, result.stderr);
});

test('a missing revision-stamped asset fails', () => {
  const result = auditWith((put) => {
    put('index.html', '<link href="/v/revision/styles.css"><link href="/v/revision/missing.css">');
  });
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /index\.html → \/v\/revision\/missing\.css/);
});

test('a revision that was never published fails', () => {
  const result = auditWith((put) => put('index.html', '<script type="module" src="/v/stale/index.js"></script>'));
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /\/v\/stale\/index\.js/);
});

test('a quoted @import of a missing stylesheet fails, in either quote style', () => {
  for (const line of ['@import "./gone.css";', "@import './gone.css';"]) {
    const result = auditWith((put) => put('theme.css', line));
    assert.equal(result.status, 1, `${line}\n${result.stdout}`);
    assert.match(result.stderr, /theme\.css → \.\/gone\.css/);
  }
});

test('a demo module no COMPONENT_IDS entry names fails', () => {
  const result = auditWith((put) => put('demos/orphan.demo.js', 'export default {};'));
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /demos\/orphan\.demo\.js → not in docs\.js COMPONENT_IDS/);
});

test('internal paths named in an agent index or a demo fail', () => {
  const index = auditWith((put) => put('llms.txt', 'See specs/WP-1-example.md for the plan.'));
  assert.equal(index.status, 1, index.stdout);
  assert.match(index.stderr, /llms\.txt mentions specs\//);

  const demo = auditWith((put) => put('demos/example.demo.js', '// Follows AGENTS.md.\nexport default {};'));
  assert.equal(demo.status, 1, demo.stdout);
  assert.match(demo.stderr, /demos\/example\.demo\.js mentions AGENTS\.md/);
});
