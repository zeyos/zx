import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

/*
 * Inline-size containment is a one-way street: a size container contributes nothing to its own
 * intrinsic width, so a host that sizes to its contents — a flex row, an inline-block, a grid
 * `auto` track, a table cell — sizes it to zero and the component spills out of a sliver.
 *
 * This is not hypothetical either. Four components declared `container-type` and left their width
 * to the host, and every docs example that put one in a row stage rendered as a heap of overlapping
 * text: the date range picker collapsed to 0px, the fieldset in a form to 42px. The rule is
 * therefore that whatever declares `container-type` also declares the width it cannot derive.
 */
const ROOTS = ['../../src/components/', '../../styles/']
  .map((path) => fileURLToPath(new URL(path, import.meta.url)));

/** @returns {Promise<Array<{file: string, selector: string, declarations: string}>>} */
async function rules() {
  const all = [];
  for (const root of ROOTS) {
    for await (const entry of glob('**/*.css', { cwd: root })) {
      const css = readFileSync(root + entry, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      // Innermost blocks only, which is every style rule: `@container`/`@media` wrappers contain
      // braces and so never match as a body themselves.
      for (const [, selector, declarations] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        all.push({ file: entry, selector: selector.trim().replace(/\s+/g, ' '), declarations });
      }
    }
  }
  return all;
}

test('every size container declares the width it cannot derive from its contents', async () => {
  const offenders = (await rules())
    .filter(({ declarations }) => /(^|;|\s)container-type\s*:\s*(inline-size|size)\b/.test(declarations))
    .filter(({ declarations }) => !/(^|;|\s)(inline-size|width)\s*:/.test(declarations))
    .map(({ file, selector }) => `${file} → ${selector}`);

  assert.deepEqual(offenders, [],
    'these rules make an element a size container without giving it a width, so it collapses to '
    + `nothing in any host that sizes to its contents: ${offenders.join(', ')}`);
});
