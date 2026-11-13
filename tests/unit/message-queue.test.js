import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { Message, MessageQueue, normalizeMessagePlacement } from '../../src/components/message/message.js';

test('MessageQueue caps active items and promotes pending items FIFO', () => {
  const activated = [];
  const queue = new MessageQueue(2, (item) => activated.push(item));

  assert.equal(queue.enqueue('first'), 'active');
  assert.equal(queue.enqueue('second'), 'active');
  assert.equal(queue.enqueue('third'), 'pending');
  assert.equal(queue.enqueue('fourth'), 'pending');
  assert.equal(queue.activeCount, 2);
  assert.equal(queue.pendingCount, 2);
  assert.deepEqual(activated, ['first', 'second']);

  assert.equal(queue.remove('first'), 'active');
  assert.deepEqual(activated, ['first', 'second', 'third']);
  assert.equal(queue.activeCount, 2);
  assert.equal(queue.pendingCount, 1);

  queue.remove('second');
  assert.deepEqual(activated, ['first', 'second', 'third', 'fourth']);
});

test('MessageQueue removes pending items without consuming active capacity', () => {
  const activated = [];
  const queue = new MessageQueue(1, (item) => activated.push(item));
  queue.enqueue('active');
  queue.enqueue('cancelled');
  queue.enqueue('next');

  assert.equal(queue.remove('cancelled'), 'pending');
  assert.equal(queue.pendingCount, 1);
  assert.equal(queue.remove('missing'), null);
  queue.remove('active');
  assert.deepEqual(activated, ['active', 'next']);
});

test('MessageQueue clear returns and removes active and pending entries', () => {
  const queue = new MessageQueue(1);
  queue.enqueue(1);
  queue.enqueue(2);
  assert.deepEqual(queue.clear(), { active: [1], pending: [2] });
  assert.equal(queue.activeCount, 0);
  assert.equal(queue.pendingCount, 0);
});

test('floating Message CSS is upper-right/content-sized with an opaque transparency fallback', () => {
  const css = readFileSync(fileURLToPath(new URL(
    '../../src/components/message/message.css', import.meta.url)), 'utf8');
  assert.match(css, /\.zx-message-region\s*\{[^}]*position:\s*fixed;[^}]*inset-block-start:/s);
  assert.match(css, /\.zx-message-region\s*\{[^}]*block-size:\s*max-content;/s);
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)[\s\S]*backdrop-filter:\s*none;/);
  for (const token of ['info-bg', 'success-bg', 'warning-bg', 'danger-bg']) {
    assert.match(css, new RegExp(`--zx-message-fallback-bg:\\s*var\\(--zx-color-${token}\\)`));
  }
  assert.match(css, /prefers-reduced-transparency[\s\S]*background:\s*var\(--zx-message-fallback-bg\)/);
});

test('a floating placement is one of the six, and anything else is the fallback', () => {
  for (const placement of ['top-start', 'top', 'top-end', 'bottom-start', 'bottom', 'bottom-end']) {
    assert.equal(normalizeMessagePlacement(placement), placement);
  }
  for (const value of [undefined, null, '', 'left', 'top-center', 'TOP-END', 'constructor', 3]) {
    assert.equal(normalizeMessagePlacement(value), 'top-end', `${String(value)} is not a placement`);
    assert.equal(normalizeMessagePlacement(value, 'bottom'), 'bottom');
  }
});

test('Message.setPlacement() sets the default placement and restores top-end on anything unknown', () => {
  assert.equal(Message.getPlacement(), 'top-end', 'the corner messages have always used');
  try {
    assert.equal(Message.setPlacement('bottom-start'), 'bottom-start');
    assert.equal(Message.getPlacement(), 'bottom-start');
    assert.equal(Message.setPlacement('nowhere'), 'top-end');
    assert.equal(Message.getPlacement(), 'top-end');
  } finally {
    Message.setPlacement('top-end');
  }
});

test('the region is placed by attribute, with logical properties and one public offset', () => {
  const css = readFileSync(fileURLToPath(new URL(
    '../../src/components/message/message.css', import.meta.url)), 'utf8');
  // The offset is public and falls back to the spacing token, so setting nothing changes nothing.
  assert.match(css, /--zx-message-inset:\s*var\(--zx-message-offset,\s*var\(--zx-space-4\)\)/);
  assert.equal(css.match(/var\(--zx-message-offset/g).length, 1, 'read in one place only');
  // Without an attribute, and for top-end, the region is where it has always been.
  assert.match(css, /\.zx-message-region\s*\{[^}]*inset-block-start:\s*var\(--zx-message-inset\);[^}]*inset-inline-end:\s*var\(--zx-message-inset\);/s);
  assert.match(css, /\[data-placement\$="-start"\]\s*\{[^}]*inset-inline-start:\s*var\(--zx-message-inset\);[^}]*inset-inline-end:\s*auto;/s);
  assert.match(css, /\[data-placement="top"\],\s*\.zx-message-region\[data-placement="bottom"\]\s*\{[^}]*margin-inline:\s*auto;/s);
  assert.match(css, /\[data-placement\^="bottom"\]\s*\{[^}]*inset-block-start:\s*auto;[^}]*inset-block-end:\s*var\(--zx-message-inset\);/s);
  // Physical sides would not follow the writing direction.
  const region = css.slice(css.indexOf('.zx-message-region {'), css.indexOf('.zx-message__toast {'));
  assert.doesNotMatch(region, /(?<![\w-])(?:left|right|top|bottom)\s*:/);
  // A toast at the foot travels the other way, and only where motion is welcome.
  assert.match(css, /\[data-placement\^="bottom"\]\s*\{[^}]*--zx-message-shift:\s*var\(--zx-space-2\);/s);
  const motion = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
  assert.match(motion, /animation:\s*zx-message-enter/);
  assert.doesNotMatch(css.slice(0, css.indexOf('@media (prefers-reduced-motion: no-preference)')), /animation:/);
});
