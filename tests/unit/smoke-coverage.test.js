import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import * as zx from '../../src/index.js';
import { Component } from '../../src/core/component.js';

/*
 * `tests/smoke/smoke.js` audits its own coverage, but nothing runs it: it is a browser page, and
 * `npm test` and CI are Node-only. A component added without a case therefore broke the smoke
 * suite silently, and stayed broken until somebody happened to open the page — which is exactly
 * what had happened to Breadcrumb, Tooltip, Toolbar, TreeView, and nine others.
 *
 * The audit itself needs a DOM. Deciding *whether a case exists* does not, so that half runs here,
 * in CI, where the drift is caught the moment it is introduced.
 */
const source = readFileSync(fileURLToPath(new URL('../smoke/smoke.js', import.meta.url)), 'utf8');

/** Case names, from both spellings: the two helpers, and the `name:` a custom case declares. */
const covered = new Set([
  ...[...source.matchAll(/(?:componentCase|artifactCase)\(\s*'([^']+)'/g)].map((match) => match[1]),
  ...[...source.matchAll(/^\s*name: '([^']+)',$/gm)].map((match) => match[1])
].map((name) => name.replace(/\(\)$/, '')));

test('every exported component has a smoke case', () => {
  const missing = Object.entries(zx)
    .filter(([name, value]) => name !== 'Component'
      && typeof value === 'function'
      && value.prototype instanceof Component)
    .map(([name]) => name)
    .filter((name) => !covered.has(name));

  assert.deepEqual(missing, [], `add a case in tests/smoke/smoke.js for: ${missing.join(', ')}`);
});

test('no smoke case names an export that no longer exists', () => {
  const stale = [...covered].filter((name) => !(name in zx));
  assert.deepEqual(stale, [], `these smoke cases name nothing exported: ${stale.join(', ')}`);
});
