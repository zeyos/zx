import assert from 'node:assert/strict';
import test from 'node:test';
import {
  QUEUE_LIMIT, addToQueue, emptyQueue, isQueueFull, queueLimit, removeFromQueue, takeNext
} from '../../src/components/composer/queue.js';

const message = (id) => ({ id, text: `Message ${id}` });
const ids = (queue) => queue.map((entry) => entry.id);

/** @param {...string} names @returns {{id: string, text: string}[]} */
function queueOf(...names) {
  return names.reduce((queue, name) => addToQueue(queue, message(name)).queue, []);
}

test('messages stay in the order they were added', () => {
  assert.deepEqual(ids(queueOf('a', 'b', 'c')), ['a', 'b', 'c']);
});

test('adding answers with the message added and leaves the given queue alone', () => {
  const before = queueOf('a');
  const entry = message('b');
  const { queue, item } = addToQueue(before, entry);
  assert.equal(item, entry);
  assert.deepEqual(ids(queue), ['a', 'b']);
  assert.deepEqual(ids(before), ['a']);
});

test('the limit refuses a message and keeps the queue as it was', () => {
  const full = queueOf('a', 'b');
  assert.equal(isQueueFull(queueOf('a'), 2), false);
  assert.equal(isQueueFull(full, 2), true);
  const { queue, item } = addToQueue(full, message('c'), 2);
  assert.equal(item, null);
  assert.deepEqual(ids(queue), ['a', 'b']);
  // A place that comes free can be taken again.
  const { queue: shorter } = removeFromQueue(full, 'a');
  assert.deepEqual(ids(addToQueue(shorter, message('c'), 2).queue), ['b', 'c']);
});

test('the limit is a whole number of one or more', () => {
  assert.equal(queueLimit(3), 3);
  assert.equal(queueLimit('4'), 4);
  assert.equal(queueLimit(2.9), 2);
  assert.equal(queueLimit(1), 1);
  for (const value of [0, -1, NaN, Infinity, null, undefined, 'many']) {
    assert.equal(queueLimit(value), QUEUE_LIMIT, String(value));
  }
  assert.equal(QUEUE_LIMIT, 10);
  assert.equal(isQueueFull(queueOf('a'), undefined), false);
});

test('removal takes one message from any place and keeps the rest in order', () => {
  const before = queueOf('a', 'b', 'c');
  const middle = removeFromQueue(before, 'b');
  assert.equal(middle.item.id, 'b');
  assert.deepEqual(ids(middle.queue), ['a', 'c']);
  assert.deepEqual(ids(removeFromQueue(before, 'a').queue), ['b', 'c']);
  assert.deepEqual(ids(removeFromQueue(before, 'c').queue), ['a', 'b']);
  assert.deepEqual(ids(before), ['a', 'b', 'c']);
});

test('removing an id that is not there changes nothing', () => {
  const { queue, item } = removeFromQueue(queueOf('a'), 'z');
  assert.equal(item, null);
  assert.deepEqual(ids(queue), ['a']);
});

test('taking the next answers one message at a time, first in, first out', () => {
  let queue = queueOf('a', 'b');
  const before = queue;
  const first = takeNext(queue);
  assert.equal(first.item.id, 'a');
  assert.deepEqual(ids(first.queue), ['b']);
  assert.deepEqual(ids(before), ['a', 'b']);
  queue = first.queue;
  const second = takeNext(queue);
  assert.equal(second.item.id, 'b');
  assert.deepEqual(second.queue, []);
});

test('taking from an empty queue answers with nothing', () => {
  assert.deepEqual(takeNext([]), { queue: [], item: null });
});

test('clearing answers with every message, in order, and an empty queue', () => {
  const before = queueOf('a', 'b');
  const { queue, items } = emptyQueue(before);
  assert.deepEqual(queue, []);
  assert.deepEqual(ids(items), ['a', 'b']);
  assert.deepEqual(ids(before), ['a', 'b']);
  assert.deepEqual(emptyQueue([]), { queue: [], items: [] });
});
