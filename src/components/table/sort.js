/** @typedef {'asc'|'desc'} SortDirection */

/**
 * Compares strings with the host locale's collation rules.
 * @param {unknown} left Left value.
 * @param {unknown} right Right value.
 * @returns {number} Negative, zero, or positive comparison result.
 */
export function compareStrings(left, right) {
  return String(left).localeCompare(String(right));
}

/**
 * Compares numeric values.
 * @param {number} left Left value.
 * @param {number} right Right value.
 * @returns {number} Negative, zero, or positive comparison result.
 */
export function compareNumbers(left, right) {
  return left - right;
}

/**
 * Compares Date values by their timestamps.
 * @param {Date} left Left date.
 * @param {Date} right Right date.
 * @returns {number} Negative, zero, or positive comparison result.
 */
export function compareDates(left, right) {
  return left.getTime() - right.getTime();
}

/**
 * Compares values according to their runtime type. Nullish values are always placed last,
 * including for descending sorts.
 * @param {unknown} left Left value.
 * @param {unknown} right Right value.
 * @param {SortDirection} [direction='asc'] Sort direction.
 * @returns {number} Negative, zero, or positive comparison result.
 */
export function compareValues(left, right, direction = 'asc') {
  const leftNull = left == null;
  const rightNull = right == null;
  if (leftNull || rightNull) {
    if (leftNull && rightNull) return 0;
    return leftNull ? 1 : -1;
  }

  let result;
  if (left instanceof Date && right instanceof Date) {
    result = compareDates(left, right);
  } else if (typeof left === 'number' && typeof right === 'number') {
    result = compareNumbers(left, right);
  } else {
    result = compareStrings(left, right);
  }
  return direction === 'desc' ? -result : result;
}

/**
 * Creates a row comparator for a sort-value accessor.
 * @template T
 * @param {(row: T) => unknown} getValue Sort-value accessor.
 * @param {SortDirection} [direction='asc'] Sort direction.
 * @returns {(left: T, right: T) => number} Row comparator.
 */
export function createComparator(getValue, direction = 'asc') {
  return (left, right) => compareValues(getValue(left), getValue(right), direction);
}

/**
 * Returns a stably sorted copy of an array without mutating the input.
 * @template T
 * @param {T[]} rows Rows to sort.
 * @param {(row: T) => unknown} getValue Sort-value accessor.
 * @param {SortDirection} [direction='asc'] Sort direction.
 * @returns {T[]} Sorted copy.
 */
export function sortRows(rows, getValue, direction = 'asc') {
  const compare = createComparator(getValue, direction);
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => compare(left.row, right.row) || left.index - right.index)
    .map(({ row }) => row);
}
