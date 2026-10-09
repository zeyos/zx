/*
 * The layouts in `website/layouts/` — application templates and screen patterns — are public
 * examples that share one shell and one set of rules (`specs/WP-37-layout-gallery.md`). These
 * checks hold every layout to the rules a
 * reviewer would otherwise have to catch by eye: the module contract, stylesheet scoping, the
 * semantic token tier, listeners that a gallery can tear down, and no names borrowed from other
 * products anywhere in the published website.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { LAYOUT_IDS, PATTERN_IDS, TEMPLATE_IDS } from '../../website/layouts/index.js';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const layouts = join(root, 'website/layouts');

/** Each layout's block class: its root element and every selector in its stylesheet. */
const BLOCKS = {
  mail: 'mail',
  'issue-tracker': 'tracker',
  wiki: 'wiki',
  'ai-chat': 'chat',
  'invoice-editor': 'invoicing',
  'item-inventory': 'inventory',
  workflows: 'flow',
  infrastructure: 'infra',
  crm: 'crm',
  'agent-workspace': 'agents',
  'master-detail': 'master-detail',
  'agent-chat': 'agent-chat',
  'system-states': 'states',
  dashboard: 'dashboard',
  inbox: 'inbox',
  'record-page': 'record',
  'record-wizard': 'record-wizard',
  'checkout-wizard': 'checkout',
  'settings-workspace': 'settings',
  'zeyos-invoices': 'zinvoices'
};

/** Products whose patterns informed a template; none may be named on the public website. */
const REFERENCE_NAMES = [
  'Superhuman', 'linear.app', 'Docmost', 'TypingMind', 'easybill', 'ERPNext', 'Frappe',
  'rhythms.ai', 'NetBox', 'Attio'
];

/** @param {string} path @returns {string} */
function read(path) {
  return readFileSync(path, 'utf8');
}

/** @param {string} css @returns {string} */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

/**
 * The selectors of every top-level rule, including rules inside conditional group rules
 * (`@media`, `@container`, `@supports`, `@layer`). Nested rules and keyframe stops are skipped:
 * a nested rule is already inside a scoped parent.
 * @param {string} css Comment-free stylesheet.
 * @returns {{selector: string, line: number}[]}
 */
function topLevelSelectors(css) {
  const found = [];
  const stack = ['root'];
  let start = 0;
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    if (char === ';') {
      start = index + 1;
    } else if (char === '{') {
      const prelude = css.slice(start, index).trim();
      const context = stack.at(-1);
      if (/^@(media|container|supports|layer)\b/.test(prelude)) {
        stack.push(context === 'root' || context === 'group' ? 'group' : 'nested');
      } else if (prelude.startsWith('@')) {
        stack.push('skip');
      } else if (context === 'root' || context === 'group') {
        const line = css.slice(0, start).split('\n').length + (css.slice(start, index).match(/^\s*/)[0].split('\n').length - 1);
        for (const selector of splitSelectorList(prelude)) found.push({ selector, line });
        stack.push('rule');
      } else {
        stack.push('nested');
      }
      start = index + 1;
    } else if (char === '}') {
      stack.pop();
      start = index + 1;
    }
  }
  return found;
}

/**
 * Splits a selector list on its top-level commas, leaving `:is(a, b)` and `[x="a,b"]` whole.
 * @param {string} list
 * @returns {string[]}
 */
function splitSelectorList(list) {
  const selectors = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let index = 0; index < list.length; index += 1) {
    const char = list[index];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(' || char === '[') {
      depth += 1;
    } else if (char === ')' || char === ']') {
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      selectors.push(list.slice(start, index).trim());
      start = index + 1;
    }
  }
  selectors.push(list.slice(start).trim());
  return selectors.filter(Boolean);
}

/**
 * Lists every file beneath a directory.
 * @param {string} directory
 * @returns {string[]}
 */
function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

test('the registry lists each layout once, and every layout exists', () => {
  assert.equal(new Set(LAYOUT_IDS).size, LAYOUT_IDS.length);
  assert.deepEqual(LAYOUT_IDS, [...TEMPLATE_IDS, ...PATTERN_IDS]);
  assert.deepEqual(Object.keys(BLOCKS).sort(), [...LAYOUT_IDS].sort(),
    'every layout needs a block class in this test');
  assert.equal(new Set(Object.values(BLOCKS)).size, LAYOUT_IDS.length, 'two layouts share a block class');
  for (const id of LAYOUT_IDS) {
    assert.ok(existsSync(join(layouts, `${id}.layout.js`)), `${id}.layout.js is missing`);
    assert.ok(existsSync(join(layouts, `${id}.layout.css`)), `${id}.layout.css is missing`);
  }
});

test('the gallery stylesheet imports the shared shell and every layout stylesheet', () => {
  const gallery = read(join(root, 'website/layouts.css'));
  assert.match(gallery, /@import url\('layouts\/kit\.css'\);/);
  for (const id of LAYOUT_IDS) {
    assert.ok(gallery.includes(`@import url('layouts/${id}.layout.css');`),
      `layouts.css does not import ${id}.layout.css`);
  }
});

test('every layout module follows the layout contract', () => {
  const problems = [];
  const check = (ok, message) => { if (!ok) problems.push(message); };
  for (const id of LAYOUT_IDS) {
    const path = `website/layouts/${id}.layout.js`;
    const source = read(join(root, path));
    for (const key of ['title', 'category', 'blurb', 'components', 'mount']) {
      check(new RegExp(`^\\s{2}${key}\\b`, 'm').test(source), `${path}: no "${key}" in the default export`);
    }
    check(/layoutContext\(context\)/.test(source), `${path}: mount does not normalise its context`);
    check(new RegExp(`['"\`]${BLOCKS[id]} shell\\b`).test(source),
      `${path}: the root element is not "${BLOCKS[id]} shell"`);
    check(!/\.(?:inner|outer)HTML\s*=|\.insertAdjacentHTML\(|\.createContextualFragment\(/.test(source),
      `${path}: builds markup from strings`);
    check(!/^export\s+(const|let|function|class)\b/m.test(source),
      `${path}: exports a declaration; the source extractor needs \`export default\` only`);
    for (const match of source.matchAll(/^.*\b(?:document|window)\.addEventListener\(.*$/gm)) {
      check(/signal/.test(match[0]), `${path}: a document/window listener without the context signal: ${match[0].trim()}`);
    }
    for (const match of source.matchAll(/^import[\s\S]*?from\s+'([^']+)'/gm)) {
      check(/^\.{1,2}\//.test(match[1]), `${path}: imports the bare specifier "${match[1]}"`);
    }
    if (/new Launcher\(/.test(source)) {
      check(/shortcut:\s*false/.test(source), `${path}: a Launcher must not bind its global shortcut`);
    }
  }
  assert.deepEqual(problems, []);
});

test('every layout stylesheet is scoped to its block and uses semantic tokens only', () => {
  const problems = [];
  for (const id of LAYOUT_IDS) {
    const path = `website/layouts/${id}.layout.css`;
    const css = stripComments(read(join(root, path)));
    const block = BLOCKS[id];
    // `.mail …` or a block-namespaced element such as `.mail__compose`, which styles content a
    // Sheet or Dialog renders outside the layout's root.
    const scoped = new RegExp(
      `^(?:\\[data-zx-[\\w-]+(?:=[^\\]]*)?\\]\\s+)?(?::where\\(|:is\\()?\\.${block}(?:__[\\w-]+|(?![\\w-]))`
    );
    for (const { selector, line } of topLevelSelectors(css)) {
      if (!scoped.test(selector)) problems.push(`${path}:${line}: "${selector}" is not scoped under .${block}`);
    }
    if (/!important/.test(css)) problems.push(`${path}: uses !important`);
    for (const match of css.matchAll(/var\(\s*(--zx-(?:gray|green|red|amber|blue|accent|emerald|tone-[a-z]+)-\d+)/g)) {
      problems.push(`${path}: references the tier-1 token ${match[1]}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('the published website never names a reference product', () => {
  const offenders = [];
  for (const file of walk(join(root, 'website'))) {
    if (!/\.(html|js|css|txt|md|json|svg)$/.test(file) || file.includes(`${join('website', 'vendor')}`)) continue;
    const source = read(file);
    for (const name of REFERENCE_NAMES) {
      if (source.includes(name)) offenders.push(`${relative(root, file)}: "${name}"`);
    }
  }
  assert.deepEqual(offenders, []);
});
