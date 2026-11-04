import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SOURCE_ICONS, SourceList, sourceHost, sourceHref, sourceKind, sourceName
} from '../../src/components/source-list/source-list.js';
import { iconNames } from '../../src/core/icons.js';

test('a web source opens only an absolute https address', () => {
  assert.equal(sourceHref({ id: 'a', title: 'Terms', kind: 'web', href: 'https://bank.example/terms' }), 'https://bank.example/terms');
  assert.equal(sourceHref({ id: 'a', title: 'Terms', href: '  https://bank.example/a b ' }), 'https://bank.example/a%20b');
  for (const href of [
    'http://bank.example/terms',
    '/relative/path',
    'bank.example/terms',
    '//bank.example/terms',
    '#fragment',
    'javascript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,hi',
    'mailto:billing@bank.example',
    'ftp://bank.example/file',
    '',
    null,
    42
  ]) {
    assert.equal(sourceHref({ id: 'a', title: 'x', href }), null, String(href));
  }
});

test('only a web source opens anything, and a source without a kind is a web source', () => {
  const href = 'https://bank.example/terms';
  assert.equal(sourceHref({ id: 'a', title: 'x', href }), href);
  for (const kind of ['file', 'record', 'call']) assert.equal(sourceHref({ id: 'a', title: 'x', kind, href }), null, kind);
  assert.equal(sourceHref(null), null);
  assert.equal(sourceHref(undefined), null);
});

test('the card names the host a web source opens', () => {
  assert.equal(sourceHost({ id: 'a', title: 'x', href: 'https://help.bank.example:8443/fees?x=1' }), 'help.bank.example:8443');
  assert.equal(sourceHost({ id: 'a', title: 'x', href: 'http://bank.example' }), null);
  assert.equal(sourceHost({ id: 'a', title: 'x', kind: 'file', site: 'policy.pdf' }), null);
});

test('a chip shows the site, else the title', () => {
  assert.equal(sourceName({ id: 'a', title: 'Dunning policy 2026', site: 'policy.pdf' }), 'policy.pdf');
  assert.equal(sourceName({ id: 'a', title: 'Dunning policy 2026', site: '  ' }), 'Dunning policy 2026');
  assert.equal(sourceName({ id: 'a', title: 'Dunning policy 2026' }), 'Dunning policy 2026');
  assert.equal(sourceName(null), '');
});

test('an unknown kind reads as web', () => {
  assert.equal(sourceKind({ id: 'a', title: 'x' }), 'web');
  assert.equal(sourceKind({ id: 'a', title: 'x', kind: 'record' }), 'record');
  assert.equal(sourceKind(/** @type {any} */ ({ id: 'a', title: 'x', kind: 'favicon' })), 'web');
});

test('every source kind has a glyph the bundled icon set draws', () => {
  const names = new Set(iconNames());
  for (const kind of ['web', 'file', 'record', 'call']) {
    assert.ok(names.has(SOURCE_ICONS[kind]), `${kind} → ${SOURCE_ICONS[kind]}`);
  }
  assert.ok(Object.isFrozen(SOURCE_ICONS));
});

test('the defaults match the documented options', () => {
  const { sources, label, layout, numbered } = SourceList.defaults;
  assert.deepEqual({ sources, label, layout, numbered }, { sources: [], label: undefined, layout: 'chips', numbered: true });
  assert.equal(SourceList.cssName, 'source-list');
});
