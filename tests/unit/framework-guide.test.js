/*
 * The framework guide exists twice: as a section of `docs/llms.md` for a reader of the reference,
 * and as the "Frameworks" page of the documentation site. Its code samples are the part a reader
 * copies, so they are held to be the same text in both, and every Zx method they or the prose rely
 * on is checked against the classes.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import * as zx from '../../src/index.js';

const read = (path) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');

const section = /^## Using Zx from a framework\n([\s\S]*?)(?=^## Custom elements)/m.exec(read('docs/llms.md'))?.[1] ?? '';
const page = /<template\s+data-guide="frameworks"[\s\S]*?<\/template>/.exec(read('website/docs.html'))?.[0] ?? '';

/** @param {string} text @returns {string} */
const unescape = (text) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#x27;/g, "'").replace(/&amp;/g, '&');

test('the guide is in the reference and on the site, with the same code samples', () => {
  assert.ok(section.length > 0, 'docs/llms.md has no "Using Zx from a framework" section');
  assert.ok(page.length > 0, 'website/docs.html has no frameworks guide');
  const fenced = [...section.matchAll(/```\w+\n([\s\S]*?)```/g)].map(([, code]) => code.trim());
  const shown = [...page.matchAll(/<pre data-code="[^"]+">\n([\s\S]*?)\n\s*<\/pre>/g)].map(([, code]) => unescape(code).trim());
  assert.ok(fenced.length >= 4);
  assert.deepEqual(shown, fenced);
});

test('both published indexes link the guide', () => {
  for (const path of ['docs/llms.txt', 'website/llms.txt']) {
    assert.match(read(path), /docs\.html#getting-started\/frameworks/, `${path} does not link the guide`);
  }
});

test('the methods the guide relies on exist', () => {
  const instance = {
    Toggle: ['set', 'setLabel', 'on', 'toElement', 'destroy'],
    Dialog: ['setTitle', 'setContent', 'isOpen', 'open', 'close'],
    Groupbox: ['isOpen', 'open', 'close'],
    Chart: ['getInstance', 'setData', 'setLoading', 'setError', 'clearError'],
    Table: ['setSort', 'setExpanded'],
    Select: ['set'],
    CheckButton: ['set']
  };
  for (const [name, methods] of Object.entries(instance)) {
    for (const method of methods) {
      assert.equal(typeof zx[name]?.prototype[method], 'function', `${name}#${method}() is in the guide but not in the class`);
    }
  }
  assert.equal(typeof zx.Component.from, 'function');
  assert.equal(typeof zx.Message.disposeRegion, 'function');
  // The slots the guide says take a node.
  for (const [name, option] of [['Dialog', 'content'], ['Modal', 'content'], ['Panel', 'content'],
    ['Panel', 'footer'], ['Card', 'content'], ['Card', 'footer']]) {
    // Defaults are declared per class and merged down the chain, so an inherited option counts.
    let declared = false;
    for (let Class = zx[name]; Class && Class !== Function.prototype; Class = Object.getPrototypeOf(Class)) {
      if (Object.hasOwn(Class, 'defaults') && Object.hasOwn(Class.defaults, option)) declared = true;
    }
    assert.ok(declared, `${name} has no ${option} option`);
  }
});

test('the guide stays product documentation', () => {
  for (const text of [section, page]) {
    assert.doesNotMatch(text, /\bWP\d|work package|\bfeedback\b|\bagent\b/i);
  }
});
