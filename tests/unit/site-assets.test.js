import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

test('landing page loads its showcase through an external revisionable module', () => {
  const page = readFileSync(new URL('../../website/index.html', import.meta.url), 'utf8');
  assert.match(page, /<script\s+type="module"\s+src="\.\/index\.js"><\/script>/);
  assert.doesNotMatch(page, /<script\b[^>]*type="module"[^>]*>\s*import\b/);
  const entry = readFileSync(new URL('../../website/index.js', import.meta.url), 'utf8');
  assert.match(entry, /from '\.\.\/src\/index\.js'/);
});

test('site audit rejects inline imports that mix source revisions', () => {
  const directory = mkdtempSync(join(tmpdir(), 'zx-site-assets-'));
  const put = (file, contents = '') => {
    const path = join(directory, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  };
  const audit = () => spawnSync(process.execPath, [new URL('../../tools/check-site.js', import.meta.url).pathname], {
    env: { ...process.env, SITE_DIR: directory }, encoding: 'utf8'
  });
  try {
    for (const file of ['docs.html', 'layouts.html', 'layouts.js', 'layouts.css', 'layouts/kit.css',
      'layout.html', 'layout.js', 'layout-host.js', 'llms.txt', 'CNAME', 'docs/llms.md',
      'demos/example.demo.js', 'layouts/example.layout.js', 'layouts/example.layout.css',
      'src/index.js', 'v/revision/index.js', 'v/revision/styles.css']) put(file);
    put('docs.js', "const COMPONENT_IDS = ['example'];");
    put('layouts/index.js', "const TEMPLATE_IDS = ['example'];\nconst PATTERN_IDS = ['example'];");
    const external = '<link href="/v/revision/styles.css"><script type="module" src="/v/revision/index.js"></script>';
    put('index.html', external);
    const valid = audit();
    assert.equal(valid.status, 0, valid.stderr);
    put('index.html', external + '<script type="module">\n    import * as zx from "./src/index.js";\n</script>');
    const mixed = audit();
    assert.equal(mixed.status, 1, mixed.stdout);
    assert.match(mixed.stderr, /unversioned inline module import/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
