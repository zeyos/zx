import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import * as zx from '../../src/index.js';
import {
  DEFAULT_STATUSES, STATUS_INDICATORS, STATUS_TONES, normalizePriorityLevel, normalizeStatusId,
  priorityIcon, resolveStatusGlyph, statusIcon
} from '../../src/components/select/glyphs.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const selectSource = read('../../src/components/select/select.js');
const selectCss = read('../../src/components/select/select.css');

test('statusIcon and priorityIcon are public factories', () => {
  assert.equal(zx.statusIcon, statusIcon);
  assert.equal(zx.priorityIcon, priorityIcon);
});

test('every built-in status draws its own shape and colour', () => {
  const expected = {
    backlog: ['dotted', 'muted'],
    todo: ['ring', 'neutral'],
    'in-progress': ['progress', 'warning'],
    'in-review': ['review', 'info'],
    ready: ['ready', 'accent'],
    waiting: ['waiting', 'warning'],
    done: ['done', 'info'],
    canceled: ['canceled', 'muted'],
    duplicate: ['duplicate', 'muted']
  };
  assert.deepEqual(DEFAULT_STATUSES.map(([id]) => id), Object.keys(expected));
  for (const [id, [indicator, tone]] of Object.entries(expected)) {
    assert.deepEqual(resolveStatusGlyph(id), { indicator, tone }, id);
  }
  // No two built-in statuses share a shape: colour is never the only difference.
  assert.equal(new Set(DEFAULT_STATUSES.map((status) => status[3])).size, DEFAULT_STATUSES.length);
});

test('review and cancelled are other spellings of in-review and canceled', () => {
  assert.equal(normalizeStatusId('review'), 'in-review');
  assert.equal(normalizeStatusId('cancelled'), 'canceled');
  assert.equal(normalizeStatusId(' Cancelled '), 'canceled');
  assert.equal(normalizeStatusId('In-Progress'), 'in-progress');
  assert.deepEqual(resolveStatusGlyph('review'), resolveStatusGlyph('in-review'));
  assert.deepEqual(resolveStatusGlyph('cancelled'), { indicator: 'canceled', tone: 'muted' });
});

test('a status item and the options override the built-in glyph, in that order', () => {
  // A Select.status({items}) item keeps its own indicator and tone, as the picker draws it.
  assert.deepEqual(resolveStatusGlyph({ ID: 'done', indicator: 'done', tone: 'success' }),
    { indicator: 'done', tone: 'success' });
  // An item that only names a built-in status takes the built-in glyph.
  assert.deepEqual(resolveStatusGlyph({ ID: 'backlog' }), { indicator: 'dotted', tone: 'muted' });
  assert.deepEqual(resolveStatusGlyph('done', { tone: 'success' }), { indicator: 'done', tone: 'success' });
  assert.deepEqual(resolveStatusGlyph({ ID: 'x', indicator: 'ring', tone: 'info' }, { indicator: 'ready' }),
    { indicator: 'ready', tone: 'info' });
});

test('an unknown status or an unknown shape or colour falls back to a muted empty ring', () => {
  assert.deepEqual(resolveStatusGlyph('shipped'), { indicator: 'ring', tone: 'muted' });
  assert.deepEqual(resolveStatusGlyph(null), { indicator: 'ring', tone: 'muted' });
  assert.deepEqual(resolveStatusGlyph('done', { indicator: 'star', tone: 'pink' }),
    { indicator: 'ring', tone: 'muted' });
});

test('priority levels clamp to 0–4 and empty values mean no priority', () => {
  assert.equal(normalizePriorityLevel(null), null);
  assert.equal(normalizePriorityLevel(undefined), null);
  assert.equal(normalizePriorityLevel(''), null);
  assert.equal(normalizePriorityLevel(0), 0);
  assert.equal(normalizePriorityLevel('3'), 3);
  assert.equal(normalizePriorityLevel(2.9), 2);
  assert.equal(normalizePriorityLevel(9), 4);
  assert.equal(normalizePriorityLevel(-2), 0);
  assert.equal(normalizePriorityLevel('high'), 0);
});

test('Select draws its glyphs through the public factories, so the two cannot drift apart', () => {
  assert.match(selectSource, /from '\.\/glyphs\.js'/);
  assert.match(selectSource, /function priorityIndicator\(level\) \{[\s\S]{0,200}?priorityIcon\(/);
  assert.match(selectSource, /function statusIndicator\(item\) \{[\s\S]{0,200}?statusIcon\(/);
  // The status table and the glyph markup live in one place.
  assert.doesNotMatch(selectSource, /\['backlog', 'status\.backlog'/);
  assert.doesNotMatch(selectSource, /class: 'zx-select__(?:priority-icon|status-indicator)'/);
});

test('the stylesheet draws every shape and colour on the standalone glyph classes', () => {
  for (const indicator of STATUS_INDICATORS.filter((name) => name !== 'ring')) {
    assert.match(selectCss, new RegExp(`\\.zx-status-icon[^{]*\\[data-indicator="${indicator}"\\]`),
      `no rule draws the ${indicator} status`);
  }
  for (const tone of STATUS_TONES.filter((name) => name !== 'muted')) {
    assert.match(selectCss, new RegExp(`\\.zx-status-icon\\[data-tone="${tone}"\\]`), `no ${tone} tone`);
  }
  for (const level of ['none', '4']) {
    assert.match(selectCss, new RegExp(`\\.zx-priority-icon\\[data-level="${level}"\\]`));
  }
  assert.doesNotMatch(selectCss, /\.zx-select__(?:priority-icon|status-indicator)\s*[{[:>]/,
    'glyph rules must target the standalone classes so a glyph outside a Select looks the same');
});
