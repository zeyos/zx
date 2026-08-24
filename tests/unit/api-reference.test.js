import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { collectApi } from '../../tools/build-api.js';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/**
 * `docs/api.json` is generated from the components' JSDoc and committed, so a checkout serves the
 * documentation without a build step. That only holds while the two agree: a default changed in
 * the source but not regenerated would be documented as its old value, which is worse than not
 * documenting it at all.
 */
test('docs/api.json matches the JSDoc it is generated from', async () => {
  const committed = JSON.parse(await readFile(join(root, 'docs', 'api.json'), 'utf8'));
  const generated = await collectApi();
  assert.deepEqual(committed, generated,
    'docs/api.json is stale — run `npm run build:api` and commit the result.');
});

test('every documented option carries a type, and every method a description', async () => {
  const api = await collectApi();
  for (const [component, record] of Object.entries(api)) {
    for (const option of record.options) {
      assert.ok(option.type, `${component}.${option.name} has no type`);
    }
    for (const method of record.methods) {
      assert.ok(method.description, `${component}.${method.name}() has no description`);
      assert.doesNotMatch(method.description, /@(returns|fires)\b/,
        `${component}.${method.name}() leaked a JSDoc tag into its description`);
    }
  }
});

test('helper typedefs cannot overwrite their component API', async () => {
  const api = await collectApi();
  const dialogOptions = new Set(api.Dialog.options.map((option) => option.name));
  assert.ok(dialogOptions.has('content'), 'Dialog must retain DialogOptions.content');
  assert.ok(dialogOptions.has('buttons'), 'Dialog must retain DialogOptions.buttons');
  assert.ok(dialogOptions.has('size'), 'Dialog must retain DialogOptions.size');
  assert.ok(!dialogOptions.has('value'), 'PromptOptions.value must not replace DialogOptions');
  assert.ok(api.Prompt.options.some((option) => option.name === 'value'),
    'PromptOptions should remain available as its own helper API');
});

test('public Grid and Chart.js adapter extensions have generated API records', async () => {
  const api = await collectApi();
  assert.ok(api.Grid.methods.some((method) => method.name === 'BillingItems'),
    'Grid.BillingItems() must be represented in the generated API');
  assert.ok(api.ChartJsAdapter.methods.some((method) => method.name === 'create'),
    'ChartJsAdapter.create() must be represented in the generated API');
});
