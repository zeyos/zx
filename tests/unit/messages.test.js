import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import test, { afterEach } from 'node:test';
import { fileURLToPath } from 'node:url';

import { Component } from '../../src/core/component.js';
import { defaultMessages, legacyMessageKeys } from '../../src/core/messages.js';
import { setLanguage, setTranslator, translate } from '../../src/core/i18n.js';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));

/**
 * Keys a component asks for that must stay out of the catalogue, because something other than
 * English has to answer when the translator does not — a catalogue entry would win over it.
 */
const NOT_IN_CATALOGUE = new Map([
  ['tree.empty', 'falls back to the `emptyText` option'],
  ['finder.empty', 'falls back to the `emptyText` option'],
  ['priority.medium', 'probed for a host translation before the older `priority.normal`']
]);

/**
 * Keys whose call sites disagree about the English. The catalogue holds one text per key, so the
 * component should split the key; until it does, the entry named here is the one kept.
 */
const KNOWN_DRIFT = new Map([
  ['checklist.search', 'Search']
]);

/**
 * Keys built from a template literal, with every value the template can take. A new template
 * key fails the scan until it is listed here, so its expansions get catalogue entries too.
 */
const TEMPLATE_KEYS = new Map([
  ['`calendar.${view}`', ['agenda', 'day', 'week', 'month', 'year'].map((view) => `calendar.${view}`)],
  ['`field.${kind}`', ['field.int', 'field.float']],
  ['`filter.unit.${id}`', ['days', 'weeks', 'months'].map((unit) => `filter.unit.${unit}`)],
  ['`questionnaire.${role}`', ['next', 'review', 'submit'].map((role) => `questionnaire.${role}`)]
]);

afterEach(() => {
  setTranslator(null);
  setLanguage('en');
});

/** @param {string} dir @returns {string[]} */
function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });
}

/**
 * Splits a call's top-level arguments, starting just after its opening parenthesis.
 * @param {string} source
 * @param {number} start
 * @returns {string[]}
 */
function callArguments(source, start) {
  const out = [];
  let depth = 0;
  let from = start;
  let quote = null;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && source[index + 1] === '*') {
      index = source.indexOf('*/', index) + 1;
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') quote = char;
    else if ('([{'.includes(char)) depth += 1;
    else if (')]}'.includes(char)) {
      if (depth === 0) {
        out.push(source.slice(from, index).trim());
        return out;
      }
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      out.push(source.slice(from, index).trim());
      from = index + 1;
    }
  }
  return out;
}

/** @param {string} text @returns {string} */
const unescape = (text) => text.replace(/\\(.)/g, '$1');

/** @param {string|undefined} argument @returns {string|null} */
function stringLiteral(argument) {
  const match = /^'((?:[^'\\]|\\.)*)'$/.exec(argument ?? '') ?? /^"((?:[^"\\]|\\.)*)"$/.exec(argument ?? '');
  return match ? unescape(match[1]) : null;
}

/**
 * Collects every message key the components resolve, with the English fallback written beside it
 * where there is one. It reads, outside `src/core/` and `src/compat/`:
 * - `.msg(…)`, `._message(…)`, `._msgOr(…)` calls and the module-level `text(…)`/`message(…)`
 *   resolvers — every quoted dotted key in the first argument, the second argument as the English
 *   fallback when it is a string literal and the file's helper takes a fallback;
 * - lookup tables: `{key: 'a.b', fallback|label: '…'}` entries, `'a.b': '…'` lines (built-in
 *   `msg` defaults and message maps), and `const …_KEYS = ['a.b', …]` arrays;
 * - template-literal keys, which must be declared in `TEMPLATE_KEYS`.
 * @returns {{uses: {key: string, fallback: string|null, at: string}[], templates: {pattern: string, at: string}[]}}
 */
function scanMessageKeys() {
  const uses = [];
  const templates = [];
  for (const file of sourceFiles(SRC)) {
    const path = relative(SRC, file).split(sep).join('/');
    if (path.startsWith('core/') || path.startsWith('compat/')) continue;
    const source = readFileSync(file, 'utf8');
    const takesFallback = !/\b_message\(key, \.\.\.args\)/.test(source);
    for (const call of source.matchAll(/(?:\.(_message|_msgOr|msg)|(?<![.\w])(text|message))\(/g)) {
      const kind = call[1] ?? call[2];
      const args = callArguments(source, call.index + call[0].length);
      const at = `${path}:${source.slice(0, call.index).split('\n').length}`;
      const first = args[0] ?? '';
      if (/^`[^`]*\$\{/.test(first)) {
        if (kind !== 'text') templates.push({ pattern: first, at });
        continue;
      }
      const keys = [...first.matchAll(/'([a-zA-Z]+\.[\w.]+)'/g)].map((match) => match[1]);
      const fallback = kind !== 'msg' && takesFallback && keys.length === 1 ? stringLiteral(args[1]) : null;
      for (const key of keys) uses.push({ key, fallback, at });
    }
    for (const entry of source.matchAll(/key:\s*'([a-zA-Z]+\.[\w.]+)'\s*,\s*(?:fallback|label):\s*'((?:[^'\\]|\\.)*)'/g)) {
      uses.push({ key: entry[1], fallback: unescape(entry[2]), at: path });
    }
    for (const entry of source.matchAll(/^\s*'([a-zA-Z]+\.[\w.]+)':\s*'((?:[^'\\]|\\.)*)',?$/gm)) {
      uses.push({ key: entry[1], fallback: unescape(entry[2]), at: path });
    }
    for (const list of source.matchAll(/^const [A-Z_]+_KEYS = \[([^\]]*)\]/gm)) {
      for (const entry of list[1].matchAll(/'([a-zA-Z]+\.[\w.]+)'/g)) uses.push({ key: entry[1], fallback: null, at: path });
    }
  }
  return { uses, templates };
}

const scan = scanMessageKeys();

test('the scan finds the components’ message keys', () => {
  const keys = new Set(scan.uses.map((use) => use.key));
  // Guards the scanner itself: a regression that matched nothing would pass every check below.
  assert.ok(keys.size > 250, `only ${keys.size} keys found`);
  for (const key of ['table.empty', 'dataFilter.clear', 'dataFilter.all', 'pagination.next', 'calendar.today']) {
    assert.ok(keys.has(key), `${key} not found by the scan`);
  }
});

test('every message key a component resolves has an English catalogue entry', () => {
  const missing = new Set();
  for (const { key, at } of scan.uses) {
    if (NOT_IN_CATALOGUE.has(key)) continue;
    if (!Object.hasOwn(defaultMessages, key)) missing.add(`${key} (${at})`);
  }
  assert.deepEqual([...missing], [], 'add these keys to defaultMessages in src/core/messages.js');
});

test('template keys are declared and every expansion has a catalogue entry', () => {
  for (const { pattern, at } of scan.templates) {
    assert.ok(TEMPLATE_KEYS.has(pattern), `${pattern} (${at}) is not listed in TEMPLATE_KEYS`);
    for (const key of TEMPLATE_KEYS.get(pattern)) {
      assert.ok(Object.hasOwn(defaultMessages, key), `${key} (from ${pattern}) has no catalogue entry`);
    }
  }
});

test('catalogue entries match the English fallback written beside each call', () => {
  const drift = [];
  for (const { key, fallback, at } of scan.uses) {
    if (fallback === null || NOT_IN_CATALOGUE.has(key)) continue;
    const expected = KNOWN_DRIFT.get(key) ?? fallback;
    if (KNOWN_DRIFT.has(key)) {
      assert.equal(defaultMessages[key], expected, `${key} keeps its documented drift entry`);
      continue;
    }
    if (defaultMessages[key] !== fallback) {
      drift.push(`${key}: catalogue ${JSON.stringify(defaultMessages[key])}, ${at} ${JSON.stringify(fallback)}`);
    }
  }
  assert.deepEqual(drift, []);
});

test('keys kept out of the catalogue really are absent', () => {
  for (const key of NOT_IN_CATALOGUE.keys()) assert.equal(Object.hasOwn(defaultMessages, key), false, key);
});

test('the catalogue is frozen, keyed component.key, and holds only strings', () => {
  assert.ok(Object.isFrozen(defaultMessages));
  assert.ok(Object.isFrozen(legacyMessageKeys));
  for (const [key, value] of Object.entries(defaultMessages)) {
    assert.match(key, /^[a-z][a-zA-Z]*\.[a-zA-Z][\w.]*$/, key);
    assert.equal(typeof value, 'string', key);
    assert.notEqual(value.trim(), '', key);
  }
  for (const [key, legacy] of Object.entries(legacyMessageKeys)) {
    assert.ok(Object.hasOwn(defaultMessages, key), `renamed key ${key} has no English`);
    assert.doesNotMatch(legacy, /\./, `${legacy} is not a bare legacy key`);
  }
});

test('the reported raw keys now render English without a translator', () => {
  assert.equal(translate('table.empty'), 'No records');
  assert.equal(translate('dataFilter.clear'), 'Clear');
  assert.equal(translate('dataFilter.all'), 'All');
  assert.equal(translate('cardView.groupEmpty'), 'No records in this group.');
});

/** A component that runs the real constructor on a stand-in element, so no DOM is needed. */
class Probe extends Component {
  static defaults = { msg: { 'probe.builtIn': 'Built in', 'table.empty': 'Class default' } };
}

/** @returns {any} */
function fakeElement() {
  return { nodeType: 1, classList: { contains: () => false, add() {}, remove() {} } };
}

test('msg() resolves instance option, translator, class defaults, catalogue, then the key', () => {
  const plain = new Probe(fakeElement());
  assert.equal(plain.msg('dataFilter.clear'), 'Clear', 'catalogue');
  assert.equal(plain.msg('table.empty'), 'Class default', 'class defaults before the catalogue');
  assert.equal(plain.msg('probe.unknown'), 'probe.unknown', 'the key last');

  setTranslator((key) => ({ 'table.empty': 'Keine Datensätze', 'dataFilter.clear': 'Zurücksetzen' })[key] ?? null);
  assert.equal(plain.msg('table.empty'), 'Keine Datensätze', 'translator before class defaults');
  assert.equal(plain.msg('dataFilter.clear'), 'Zurücksetzen', 'translator before the catalogue');
  assert.equal(plain.msg('probe.builtIn'), 'Built in', 'class defaults when the translator has nothing');

  const own = new Probe(fakeElement(), {
    msg: { 'dataFilter.clear': 'Leeren', de: { 'table.empty': 'Nichts da' } }
  });
  assert.equal(own.msg('dataFilter.clear'), 'Leeren', 'instance option before the translator');
  setLanguage('de');
  assert.equal(own.msg('table.empty'), 'Nichts da', 'language table of the instance option');
});

test('a translator that echoes the key, or answers null, falls through to English', () => {
  const probe = new Probe(fakeElement());
  setTranslator((key) => key);
  assert.equal(probe.msg('dataFilter.all'), 'All');
  assert.equal(translate('dataFilter.all'), 'All');
  setTranslator(() => undefined);
  assert.equal(probe.msg('pagination.next'), 'Next page');
});

test('msg() interpolates whichever source answers', () => {
  const probe = new Probe(fakeElement());
  assert.equal(probe.msg('pagination.loaded', 3, 10), '3 of 10');
  setTranslator((key) => (key === 'pagination.loaded' ? '%1 von %2' : null));
  assert.equal(probe.msg('pagination.loaded', 3, 10), '3 von 10');
});

test('renamed Calendar keys still read the former bare key, after the new one', () => {
  const probe = new Probe(fakeElement());
  assert.equal(probe.msg('calendar.today'), 'Today');
  setTranslator((key) => (key === 'today' ? 'Heute' : null));
  assert.equal(probe.msg('calendar.today'), 'Heute', 'translator, former key');
  assert.equal(translate('calendar.today'), 'Heute');
  setTranslator((key) => ({ today: 'Heute', 'calendar.today': 'Heute (neu)' })[key] ?? null);
  assert.equal(probe.msg('calendar.today'), 'Heute (neu)', 'the new key wins');

  setTranslator(null);
  const legacyOption = new Probe(fakeElement(), { msg: { next: 'Weiter' } });
  assert.equal(legacyOption.msg('calendar.next'), 'Weiter', 'instance option, former key');
  assert.equal(legacyOption.msg('calendar.label'), 'Calendar');
});
