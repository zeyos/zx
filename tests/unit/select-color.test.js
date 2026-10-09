import assert from 'node:assert/strict';
import test from 'node:test';

import { itemColor } from '../../src/components/select/color.js';

test('itemColor accepts colour literals', () => {
  assert.equal(itemColor('#0b7285'), '#0b7285');
  assert.equal(itemColor('rgb(11 114 133)'), 'rgb(11 114 133)');
  assert.equal(itemColor('oklch(0.6 0.1 220)'), 'oklch(0.6 0.1 220)');
  assert.equal(itemColor('  teal  '), 'teal');
});

test('itemColor accepts a reference to a design token', () => {
  assert.equal(itemColor('var(--zx-color-tone-blue-fg)'), 'var(--zx-color-tone-blue-fg)');
  assert.equal(itemColor(' var( --zx-color-accent ) '), 'var( --zx-color-accent )');
  assert.equal(itemColor('var(--brand_ink-2)'), 'var(--brand_ink-2)');
});

test('itemColor refuses anything that is not a colour or a plain token reference', () => {
  for (const value of [
    'var(--zx-color-accent, #000)',
    'var(--zx-color-accent);background:red',
    'var(zx-color-accent)',
    'url(https://example.test/x.png)',
    'red; background: url(x)',
    '',
    null,
    undefined,
    7,
    { color: 'red' }
  ]) {
    assert.equal(itemColor(value), null, `accepted ${JSON.stringify(value)}`);
  }
});
