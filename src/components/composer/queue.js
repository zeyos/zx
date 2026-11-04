// @ts-check
/**
 * The queue behind the Composer's queued messages, as pure functions: each takes the queue as it
 * stands and answers with a new one, in the order the messages were added, and never changes what
 * it was given. It knows nothing of messages but their `id`.
 */

/** Most messages that wait at once when `queueLimit` names no usable number. */
export const QUEUE_LIMIT = 10;

/**
 * The limit an option names: a whole number of one or more, anything else `QUEUE_LIMIT`.
 * @param {unknown} value
 * @returns {number}
 */
export function queueLimit(value) {
  const limit = Math.floor(Number(value));
  return Number.isFinite(limit) && limit >= 1 ? limit : QUEUE_LIMIT;
}

/**
 * Whether the queue has no room for another message.
 * @param {readonly {id: string}[]} queue
 * @param {unknown} [limit]
 * @returns {boolean}
 */
export function isQueueFull(queue, limit) {
  return queue.length >= queueLimit(limit);
}

/**
 * Adds a message at the end, as far as the limit allows.
 * @template {{id: string}} T
 * @param {readonly T[]} queue
 * @param {T} entry
 * @param {unknown} [limit]
 * @returns {{queue: T[], item: T|null}} The new queue, and the message added: null when the queue
 * was full and stays as it was.
 */
export function addToQueue(queue, entry, limit) {
  if (isQueueFull(queue, limit)) return { queue: [...queue], item: null };
  return { queue: [...queue, entry], item: entry };
}

/**
 * Takes one message out, wherever it stands.
 * @template {{id: string}} T
 * @param {readonly T[]} queue
 * @param {string} id
 * @returns {{queue: T[], item: T|null}} The new queue, and the message taken: null when no message
 * has that id.
 */
export function removeFromQueue(queue, id) {
  const item = queue.find((entry) => entry.id === String(id)) ?? null;
  return { queue: queue.filter((entry) => entry !== item), item };
}

/**
 * Takes the message whose turn it is.
 * @template {{id: string}} T
 * @param {readonly T[]} queue
 * @returns {{queue: T[], item: T|null}} The new queue, and the first message: null when there is
 * none.
 */
export function takeNext(queue) {
  const [item = null, ...rest] = queue;
  return { queue: rest, item };
}

/**
 * Takes every message out.
 * @template {{id: string}} T
 * @param {readonly T[]} queue
 * @returns {{queue: T[], items: T[]}} The empty queue, and the messages taken, in order.
 */
export function emptyQueue(queue) {
  return { queue: [], items: [...queue] };
}
