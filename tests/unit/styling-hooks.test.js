import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

/*
 * The component-level styling hooks Zx supports as public API.
 *
 * Deliberately a short list. Component CSS declares dozens of custom properties, but almost all of
 * them are internal geometry — `--zx-slider-thumb` exists so two rules can agree on a number, not
 * so a product can change it. Publishing the lot would freeze every one of them as API. These are
 * the handful an application actually reaches for, and each falls back to the semantic token it
 * replaces, so setting none of them changes nothing.
 *
 * The rule for consumers, in order of preference: override a global semantic token; then one of
 * these; and only then, never happily, an internal selector.
 */
const HOOKS = [
  '--zx-table-header-bg',
  '--zx-table-row-hover-bg',
  '--zx-table-row-selected-bg',
  '--zx-table-border-color',
  '--zx-button-radius',
  '--zx-panel-header-bg'
];

/** @returns {Promise<string>} */
async function componentCss() {
  const root = fileURLToPath(new URL('../../src/components/', import.meta.url));
  let all = '';
  for await (const entry of glob('**/*.css', { cwd: root })) all += readFileSync(root + entry, 'utf8');
  return all;
}

test('every published styling hook is consumed with a token fallback', async () => {
  const css = await componentCss();
  const broken = HOOKS.filter((hook) => !new RegExp(`var\\(${hook},\\s*var\\(--zx-`).test(css));
  assert.deepEqual(broken, [],
    `these hooks are documented but not consumed with a semantic-token fallback: ${broken.join(', ')}`);
});

test('the hooks are documented for the people expected to use them', async () => {
  const reference = readFileSync(fileURLToPath(new URL('../../docs/llms.md', import.meta.url)), 'utf8');
  const undocumented = HOOKS.filter((hook) => !reference.includes(hook));
  assert.deepEqual(undocumented, [], `not in docs/llms.md: ${undocumented.join(', ')}`);
});
