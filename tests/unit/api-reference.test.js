import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import * as zx from '../../src/index.js';
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

/*
 * Each option says how it is changed on a live component, where the source states it: a setter
 * named after the option, or the custom-element tables, which hold a live setter or `rebuild`
 * for every option of a wrapped component. The checks below are made against the classes as they
 * load, not against the text the generator read, so a reading that went wrong shows up here.
 */
test('an option is changed by named methods or by a rebuild, never both, and the methods exist', async () => {
  const api = await collectApi();
  let stated = 0;
  for (const [component, record] of Object.entries(api)) {
    for (const option of record.options) {
      if (!option.update) continue;
      stated += 1;
      const { methods, rebuild } = option.update;
      assert.ok(Boolean(methods?.length) !== Boolean(rebuild),
        `${component}.${option.name}: exactly one of methods and rebuild`);
      const Class = zx[component];
      for (const call of methods ?? []) {
        const name = /^(\w+)\(/.exec(call)?.[1];
        assert.ok(name, `${component}.${option.name}: ${call} is not a call`);
        if (typeof Class === 'function') {
          assert.equal(typeof Class.prototype[name], 'function',
            `${component}.${option.name} names ${call}, which ${component} does not have`);
        }
      }
    }
  }
  assert.ok(stated > 300, `only ${stated} options state how they are changed`);
});

test('the element tables are read for every wrapped component', async () => {
  const api = await collectApi();
  const define = await readFile(join(root, 'src', 'elements', 'define.js'), 'utf8');
  const kit = await readFile(join(root, 'src', 'elements', 'kit.js'), 'utf8');
  const wrapped = [
    ...[...define.matchAll(/^  \['[\w-]+', (\w+), \{/gm)].map((match) => match[1]),
    ...[...kit.matchAll(/^  \['[\w-]+', (\w+), \{/gm)].map((match) => match[1])
  ];
  assert.equal(wrapped.length, 22, 'the registration lists changed shape; update the reading in tools/build-api.js');
  for (const component of wrapped) {
    assert.ok(api[component]?.options.some((option) => option.update),
      `${component} is wrapped as an element but none of its options states how it is changed`);
  }
});

test('setters, element setters and rebuilds are told apart', async () => {
  const api = await collectApi();
  const update = (component, name) => api[component].options.find((option) => option.name === name)?.update;

  // A setter named after the option, own or inherited.
  assert.deepEqual(update('Dialog', 'title'), { methods: ['setTitle()'] });
  assert.deepEqual(update('Sheet', 'content'), { methods: ['setContent()'] });
  assert.deepEqual(update('Chart', 'fill'), { methods: ['setFill()'] });
  // It wins over an element table that still rebuilds for the option.
  assert.deepEqual(update('Toggle', 'label'), { methods: ['setLabel()'] });
  // A live setter the element table names, under whatever the method is called.
  assert.deepEqual(update('Toggle', 'checked'), { methods: ['set()'] });
  assert.deepEqual(update('Groupbox', 'open'), { methods: ['open()', 'close()'] });
  assert.deepEqual(update('Select', 'disabled'), { methods: ['disable()', 'enable()'] });
  assert.deepEqual(update('RunStatus', 'state'), { methods: ['update({ state })'] });
  // Read at construction.
  assert.deepEqual(update('Dialog', 'closable'), { rebuild: true });
  assert.deepEqual(update('Table', 'rowId'), { rebuild: true });
  assert.deepEqual(update('Chart', 'summaryFormat'), { rebuild: true });
  // Not stated: the wrapper writes to the component's internals, or the component has no wrapper.
  assert.equal(update('Search', 'placeholder'), undefined);
  assert.equal(update('Sheet', 'backdrop'), undefined);
  // A static configures the class, not an instance.
  assert.equal(update('MessageShow', 'placement'), undefined);
});
