import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { verifyClientVendor } from '../../tools/build-client-vendor.js';
import { createZeyosClient } from '../../website/vendor/zeyos-client.esm.js';
import { buildZeyosTableConfig } from '../../src/zeyos/table.js';

test('vendored browser client has verifiable version, source inputs and bundle identity', async () => {
  const manifest = await verifyClientVendor();
  assert.equal(manifest.package.name, '@zeyos/client');
  assert.equal(manifest.package.license, 'MIT');
  assert.deepEqual(manifest.build.options.entryPoints, ['src/runtime/client.js']);
  assert(manifest.source.files.some((entry) => entry.path === 'src/generated/schema.js'));
  assert(manifest.source.files.some((entry) => entry.path === 'LICENSE'));
});

test('vendor verification rejects altered bundle bytes before site publication', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'zx-client-vendor-'));
  try {
    for (const name of ['zeyos-client.esm.js', 'zeyos-client.manifest.json']) {
      await copyFile(new URL(`../../website/vendor/${name}`, import.meta.url), join(directory, name));
    }
    await verifyClientVendor(directory);
    const path = join(directory, 'zeyos-client.esm.js');
    await writeFile(path, await readFile(path, 'utf8') + '\n// altered\n');
    await assert.rejects(verifyClientVendor(directory), /checksum mismatch/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('the actual vendored schema and endpoint API work with the ZeyOS binding', () => {
  const client = createZeyosClient({
    platform: 'https://example.invalid/demo/',
    auth: { mode: 'session', session: { enabled: true, credentials: 'include' } }
  });
  assert.equal(typeof client.api.listTransactions, 'function');
  assert.equal(typeof client.api.updateTransaction, 'function');
  assert.equal(typeof client.schema.describe, 'function');
  assert.equal(typeof client.schema.fields, 'function');
  const config = buildZeyosTableConfig(client, 'transactions', { fields: ['ID', 'transactionnum', 'date'], timeZone: 'UTC' });
  assert(config.columns.some((column) => column.id === 'transactionnum'));
  const date = config.columns.find((column) => column.id === 'date');
  assert.equal(typeof date.render, 'function');
  assert.match(date.render({ date: 1704067200 }, 0, 1704067200), /2024/);
});

test('site audit checks the revisioned vendor asset loaded by pages', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'zx-vendor-site-'));
  const put = async (file, contents = '') => {
    const path = join(directory, file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
  };
  const audit = () => spawnSync(process.execPath, [new URL('../../tools/check-site.js', import.meta.url).pathname], {
    env: { ...process.env, SITE_DIR: directory }, encoding: 'utf8'
  });
  try {
    for (const file of ['index.html', 'docs.html', 'layouts.html', 'layouts.js', 'layouts.css', 'layouts/kit.css',
      'layout.html', 'layout.js', 'layout-host.js', 'llms.txt', 'CNAME', 'docs/llms.md',
      'demos/example.demo.js', 'layouts/example.layout.js', 'layouts/example.layout.css']) await put(file);
    await put('docs.js', "const COMPONENT_IDS = ['example'];");
    await put('layouts/index.js', "const TEMPLATE_IDS = ['example'];\nconst PATTERN_IDS = ['example'];");
    for (const target of ['vendor', 'v/revision/vendor']) {
      for (const name of ['zeyos-client.esm.js', 'zeyos-client.manifest.json']) {
        await put(`${target}/${name}`, await readFile(new URL(`../../website/vendor/${name}`, import.meta.url)));
      }
    }
    const valid = audit();
    assert.equal(valid.status, 0, valid.stderr);
    await put('v/revision/vendor/zeyos-client.esm.js', '// corrupted revisioned copy');
    const invalid = audit();
    assert.equal(invalid.status, 1, invalid.stdout);
    assert.match(invalid.stderr, /v\/revision\/vendor\/zeyos-client\.esm\.js.*checksum mismatch/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
