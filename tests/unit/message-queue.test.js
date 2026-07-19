import assert from 'node:assert/strict';
import test from 'node:test';

import { MessageQueue } from '../../src/components/message/message.js';

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
