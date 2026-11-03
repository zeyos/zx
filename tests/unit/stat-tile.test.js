import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  formatStatValue,
  normalizeStatTileVariant,
  statDelta,
  statTileName,
  statTileTag,
  statTrendPoints
} from '../../src/components/stat-tile/stat-tile.js';

/**
 * `Intl` separates an amount from its currency symbol with a non-breaking space, which is correct
 * output and unreadable in an assertion failure. Only the spacing is normalised.
 * @param {string} text
 * @returns {string}
 */
function plain(text) {
  return text.replace(/[  ]/g, ' ');
}

/* ------------------------------------------------------------------ formatting -- */

test('each named format renders through the shared formatters', () => {
  const locale = 'en-US';
  assert.equal(formatStatValue(1234.5, { format: 'number', locale }), '1,234.5');
  assert.equal(plain(formatStatValue(1234.5, { format: 'currency', currency: 'USD', locale })), '$1,234.50');
  assert.equal(formatStatValue(0.425, { format: 'percent', locale }), '43%');
  assert.equal(formatStatValue(1536, { format: 'fileSize', locale }), '1.5 KiB');
});

test('the locale is the tile\'s, not the machine\'s', () => {
  assert.equal(formatStatValue(1234.5, { format: 'number', locale: 'de-DE' }), '1.234,5');
  assert.equal(plain(formatStatValue(1234.5, { format: 'currency', currency: 'EUR', locale: 'de-DE' })),
    '1.234,50 €');
});

test('format null prints the value unformatted', () => {
  assert.equal(formatStatValue(1234.5, { format: null }), '1234.5');
  assert.equal(formatStatValue(0, { format: null }), '0');
});

test('a format callback receives the raw value and owns the result', () => {
  /** @type {unknown[]} */
  const seen = [];
  const format = (/** @type {unknown} */ value) => {
    seen.push(value);
    return `${value} open`;
  };
  assert.equal(formatStatValue(3, { format }), '3 open');
  // The callback outranks the string passthrough: a host that supplies one decides every case.
  assert.equal(formatStatValue('3', { format }), '3 open');
  assert.deepEqual(seen, [3, '3']);
});

test('a string value is rendered as given, whatever the format says', () => {
  assert.equal(formatStatValue('3 of 5', { format: 'number' }), '3 of 5');
  assert.equal(formatStatValue('—', { format: 'currency', currency: 'EUR' }), '—');
});

test('a missing value formats to nothing rather than to "null"', () => {
  assert.equal(formatStatValue(null, { format: 'number' }), '');
  assert.equal(formatStatValue(undefined, { format: 'number' }), '');
  assert.equal(formatStatValue(Number.NaN, { format: 'number' }), '');
});

/* ----------------------------------------------------------------------- delta -- */

test('a delta carries its own sign, because no locale prints a leading plus', () => {
  const locale = 'en-US';
  assert.deepEqual(statDelta(2, { locale }),
    { direction: 'up', sign: '+', magnitude: '2', text: '+2' });
  assert.deepEqual(statDelta(-1234.5, { locale }),
    { direction: 'down', sign: '−', magnitude: '1,234.5', text: '−1,234.5' });
  assert.deepEqual(statDelta(0, { locale }),
    { direction: 'flat', sign: '', magnitude: '0', text: '0' });
});

test('the direction is read from the sign and says nothing about whether it is good', () => {
  // Both of these are a rising count. Only `deltaKind` — which this function never sees — decides
  // the colour, so nothing here can encode "up is good".
  assert.equal(statDelta(5).direction, 'up');
  assert.equal(statDelta(5, { format: null }).direction, 'up');
  assert.equal(statDelta(-5).direction, 'down');
});

test('the magnitude is formatted through the tile\'s own format', () => {
  assert.equal(plain(statDelta(-2500, { format: 'currency', currency: 'USD', locale: 'en-US' }).text),
    '−$2,500.00');
  assert.equal(statDelta(0.12, { format: 'percent', locale: 'en-US' }).text, '+12%');
});

test('there is no delta to show for a missing or unreadable one', () => {
  assert.equal(statDelta(null), null);
  assert.equal(statDelta(undefined), null);
  assert.equal(statDelta(''), null);
  assert.equal(statDelta('n/a'), null);
  assert.equal(statDelta(Number.POSITIVE_INFINITY), null);
});

/* ------------------------------------------------------------- element shapes -- */

test('the element shape follows what the tile does', () => {
  assert.equal(statTileTag({ href: '/tickets?status=6' }), 'a');
  assert.equal(statTileTag({ onclick: () => {} }), 'button');
  assert.equal(statTileTag({ clickable: true }), 'button');
  assert.equal(statTileTag({}), 'div');
  assert.equal(statTileTag({ label: 'Open tickets', value: 3 }), 'div');
});

test('an href outranks a click handler, and neither leaves a div clickable', () => {
  assert.equal(statTileTag({ href: '/x', onclick: () => {} }), 'a');
  // A handler that is not a function is not behaviour, so the tile stays a plain container.
  assert.equal(statTileTag({ onclick: 'doThing' }), 'div');
  assert.equal(statTileTag({ clickable: false }), 'div');
});

test('onclick and clickable are the same answer, which is what lets the shape survive', () => {
  // `statTile()` builds a `StatTile`, and `Component` consumes every function-valued `on*` option
  // into a listener before `render()` runs — so the constructor translates `onclick` into
  // `clickable` to carry the shape across. That translation is only safe while these agree.
  assert.equal(statTileTag({ onclick: () => {} }), statTileTag({ clickable: true }));
  assert.equal(statTileTag({ href: '/x', onclick: () => {} }), statTileTag({ href: '/x', clickable: true }));
  assert.equal(statTileTag({ onclick: undefined }), statTileTag({ clickable: false }));
});

test('an href that could execute script is not a destination', () => {
  assert.equal(statTileTag({ href: 'javascript:alert(1)' }), 'div');
  assert.equal(statTileTag({ href: '   ' }), 'div');
  assert.equal(statTileTag({ href: null }), 'div');
  // It falls through to the shape the remaining options justify rather than to a dead link.
  assert.equal(statTileTag({ href: 'javascript:alert(1)', onclick: () => {} }), 'button');
});

/* ----------------------------------------------------------- accessible name -- */

test('the accessible name is label, value, then the change', () => {
  assert.equal(statTileName({
    label: 'Awaiting acceptance',
    value: '3',
    delta: 'up 2',
    deltaLabel: 'vs. last week'
  }), 'Awaiting acceptance, 3, up 2 vs. last week');
});

test('the name is worded, never a glyph or a bare sign', () => {
  const name = statTileName({ label: 'Open tickets', value: '128', delta: 'down 4' });
  assert.equal(name, 'Open tickets, 128, down 4');
  assert.doesNotMatch(name, /[+−]/);
});

test('missing pieces are dropped rather than left as stray punctuation', () => {
  assert.equal(statTileName({ label: 'Revenue', value: '€1.2M' }), 'Revenue, €1.2M');
  assert.equal(statTileName({ value: '3' }), '3');
  assert.equal(statTileName({ label: 'Revenue', value: '', delta: '', deltaLabel: 'vs. last week' }),
    'Revenue, vs. last week');
  assert.equal(statTileName({}), '');
  assert.equal(statTileName(), '');
});

test('a caption is read with the value it qualifies', () => {
  assert.equal(statTileName({ label: 'Active items', value: '2,184', caption: 'of 13,184' }),
    'Active items, 2,184 of 13,184');
  assert.equal(statTileName({
    label: 'Active items', value: '2,184', caption: 'of 13,184', delta: 'up 12', deltaLabel: 'this week'
  }), 'Active items, 2,184 of 13,184, up 12 this week');
  assert.equal(statTileName({ label: 'Active items', value: '2,184', caption: '   ' }), 'Active items, 2,184');
});

test('the name is trimmed so host whitespace cannot double a separator', () => {
  assert.equal(statTileName({ label: '  Revenue  ', value: ' 3 ', delta: '   ' }), 'Revenue, 3');
});

/* ------------------------------------------------------------------- sparkline -- */

test('a series is projected onto the sparkline box, low value at the floor', () => {
  assert.equal(statTrendPoints([1, 2, 2, 3]), '0,28 33.33,15 66.67,15 100,2');
});

test('a flat series is drawn down the middle, not along the floor', () => {
  assert.equal(statTrendPoints([5, 5, 5]), '0,15 50,15 100,15');
});

test('a series that cannot make a line draws nothing', () => {
  assert.equal(statTrendPoints([1]), null);
  assert.equal(statTrendPoints([]), null);
  assert.equal(statTrendPoints(null), null);
  assert.equal(statTrendPoints(['a', 'b']), null);
});

test('a gap in the series is absent data, not the number nought', () => {
  // `Number(null)` is 0, so coercing a gap would draw the line crashing to the floor and back.
  assert.equal(statTrendPoints([1, null, 3]), statTrendPoints([1, 3]));
  assert.equal(statTrendPoints([1, undefined, 3]), statTrendPoints([1, 3]));
  assert.equal(statTrendPoints([0, Number.NaN, 10]), statTrendPoints([0, 10]));
  assert.equal(statTrendPoints([2, '', 4]), statTrendPoints([2, 4]));
  // A real zero still counts, and still sits on the floor.
  assert.equal(statTrendPoints([0, 10]), '0,28 100,2');
});

test('a gap is not a delta either', () => {
  assert.equal(statDelta(false), null);
  assert.equal(statDelta([]), null);
});

test('the box is the caller\'s to change', () => {
  assert.equal(statTrendPoints([0, 1], { width: 10, height: 10, inset: 0 }), '0,10 10,0');
});

/* ------------------------------------------------------------ plain figures -- */

const CSS = readFileSync(new URL('../../src/components/stat-tile/stat-tile.css', import.meta.url), 'utf8');

/** @param {string} selector @returns {string} The declarations of the rule with exactly that selector. */
function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(CSS)?.[1] ?? '';
}

/** @param {string} body @param {string} property @returns {string|undefined} */
function value(body, property) {
  return new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`).exec(body)?.[1].trim();
}

test('a variant the stylesheet does not know is the framed tile', () => {
  assert.equal(normalizeStatTileVariant('plain'), 'plain');
  assert.equal(normalizeStatTileVariant('default'), 'default');
  assert.equal(normalizeStatTileVariant(undefined), 'default');
  assert.equal(normalizeStatTileVariant('Plain'), 'default');
  assert.equal(normalizeStatTileVariant('outlined'), 'default');
});

test('a plain figure has no frame, no fill, and no padding', () => {
  const plain = rule('.zx-stat-tile[data-variant="plain"]');
  assert.equal(value(plain, 'border'), '0');
  assert.equal(value(plain, 'background'), 'none');
  assert.equal(value(plain, 'padding'), '0');
});

test('one figure leads: the emphasised plain figure is the display size, the others a step down', () => {
  const ladder = ['--zx-text-md', '--zx-text-lg', '--zx-text-xl', '--zx-text-2xl', '--zx-text-3xl'];
  const step = (/** @type {string} */ selector) =>
    ladder.indexOf(/var\((--zx-text-[a-z0-9]+)\)/.exec(value(rule(selector), '--zx-stat-tile-value-size') ?? '')?.[1] ?? '');
  const framed = step('.zx-stat-tile');
  const plain = step('.zx-stat-tile[data-variant="plain"]');
  const lead = step('.zx-stat-tile[data-variant="plain"][data-emphasis="true"]');
  const framedLead = step('.zx-stat-tile[data-emphasis="true"]');
  assert.ok(plain >= 0 && lead >= 0 && framed >= 0 && framedLead >= 0, 'every figure size is a step of the type ladder');
  assert.ok(lead > plain, 'the emphasised plain figure is larger than the others in its row');
  // The record title is set at 2xl; a plain lead never outranks the page it sits on.
  assert.equal(ladder[lead], '--zx-text-2xl');
  assert.equal(framedLead, framed + 1, 'a framed tile leads one step above its own figure');
});

test('the figure keeps its weight and tabular digits whatever its size', () => {
  const figure = rule('.zx-stat-tile__value');
  assert.equal(value(figure, 'font-weight'), 'var(--zx-weight-title)');
  assert.equal(value(figure, 'font-variant-numeric'), 'tabular-nums');
  assert.equal(value(figure, 'font-size'), 'var(--zx-stat-tile-value-size)');
});
