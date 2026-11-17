// @ts-check
/**
 * Equality checks over the small collections components keep for their state — selections,
 * hidden fields, orders — so a setter can tell a real change from a repeat and stay silent.
 */

/**
 * Whether two sets hold the same members, in any order.
 * @param {Set<unknown>} left One set.
 * @param {Set<unknown>} right The other.
 * @returns {boolean}
 */
export function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

/**
 * Whether two arrays hold the same entries in the same order, compared with `Object.is`.
 * @param {unknown[]} left One array.
 * @param {unknown[]} right The other.
 * @returns {boolean}
 */
export function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
}
