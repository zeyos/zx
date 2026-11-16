import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Message, messageStackLayout, normalizeMessageHighlight } from '../../src/components/message/message.js';

const css = readFileSync(new URL('../../src/components/message/message.css', import.meta.url), 'utf8');

test('a highlight is a border, an animated border, or nothing', () => {
  assert.equal(normalizeMessageHighlight(true), 'border');
  assert.equal(normalizeMessageHighlight('border'), 'border');
  assert.equal(normalizeMessageHighlight('animated'), 'animated');
  for (const value of [false, undefined, null, '', 'glow', 1, {}]) {
    assert.equal(normalizeMessageHighlight(value), null, `accepted ${JSON.stringify(value)}`);
  }
});

test('floating messages stack unless Message.setStack(false) says otherwise', () => {
  assert.equal(Message.getStack(), true, 'floating regions stack by default');
  try {
    assert.equal(Message.setStack(false), false);
    assert.equal(Message.getStack(), false);
    assert.equal(Message.setStack('yes'), true, 'any truthy value stacks');
  } finally {
    Message.setStack(true);
  }
  // An inline area stacks only when asked.
  assert.equal(Message.defaults.stack, false);
});

test('an open stack lays its messages out one after another, a gap apart', () => {
  const { items, size } = messageStackLayout([60, 40, 90], true);
  assert.deepEqual(items.map((item) => item.y), [
    { px: 0, steps: 0 }, { px: 60, steps: 1 }, { px: 100, steps: 2 }
  ]);
  assert.ok(items.every((item) => item.scale === 1 && item.clip === null && !item.hidden));
  assert.deepEqual(size, { px: 190, steps: 2 });
});

test('a collapsed stack shows the front message and two behind it, each a peek further out', () => {
  const { items, size } = messageStackLayout([60, 40, 90, 50, 70], false);
  assert.deepEqual(items.map((item) => item.depth), [0, 1, 2, 2, 2]);
  assert.deepEqual(items.map((item) => item.hidden), [false, false, false, true, true]);
  assert.deepEqual(items.map((item) => item.scale), [1, 0.95, 0.9, 0.9, 0.9]);
  // Each one lines its far edge up with the front one's, then moves out by its peeks.
  assert.deepEqual(items.map((item) => item.y), [
    { px: 0, steps: 0 }, { px: 20, steps: 1 }, { px: -30, steps: 2 }, { px: 10, steps: 2 }, { px: -10, steps: 2 }
  ]);
  // The front one is whole; the rest keep only the strip that peeks out, a peek on screen.
  assert.equal(items[0].clip, null);
  assert.equal(items[1].clip.px, 40);
  assert.ok(Math.abs(items[1].clip.steps * 0.95 + 1) < 1e-9);
  assert.equal(items[2].clip.px, 90);
  assert.ok(Math.abs(items[2].clip.steps * 0.9 + 1) < 1e-9);
  assert.deepEqual(size, { px: 60, steps: 2 }, 'the front message and two peeks');
});

test('a stack of one or none is the front message or nothing', () => {
  assert.deepEqual(messageStackLayout([], false), { items: [], size: { px: 0, steps: 0 } });
  assert.deepEqual(messageStackLayout([], true), { items: [], size: { px: 0, steps: 0 } });
  assert.deepEqual(messageStackLayout([48], false).size, { px: 48, steps: 0 });
  assert.deepEqual(messageStackLayout([48, 52], false).size, { px: 48, steps: 1 });
  // Unmeasurable heights count as zero rather than poisoning the sums.
  assert.deepEqual(messageStackLayout([Number.NaN, -4, '30'], true).size, { px: 30, steps: 2 });
});

test('the stylesheet places stacked messages from the layout and keeps motion optional', () => {
  for (const property of ['--zx-message-y', '--zx-message-scale', '--zx-message-clip', '--zx-message-z',
    '--zx-message-stack-size', '--zx-message-stack-hold']) {
    assert.match(css, new RegExp(`var\\(${property}`), `${property} is never read`);
  }
  // Bottom placements, and every region on a phone, pile upwards.
  assert.match(css, /\[data-placement\^="bottom"\] \{[^}]*--zx-message-dir: -1/);
  assert.match(css, /@media \(max-width: 640px\) \{[^@]*--zx-message-dir: -1/);
  // The travelling light only moves where motion is welcome; otherwise the border stays still.
  const motion = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
  assert.match(motion, /\[data-highlight="animated"\]::before \{[^}]*animation: zx-message-sweep/);
  assert.match(css, /@property --zx-message-sweep \{[^}]*syntax: '<angle>'/);
  assert.match(css, /\.zx-message__toast\[data-highlight\] \{\s*border-color: var\(--zx-message-kind\);/);
});
