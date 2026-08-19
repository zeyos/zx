import { h } from '../../core/dom.js';
import { clamp } from '../../core/util.js';

/**
 * @typedef {Object} SkeletonOptions
 * @property {string|number} [width='100%'] Block width; a number is read as pixels.
 * @property {string|number} [height='1rem'] Block height; a number is read as pixels.
 * @property {'sm'|'md'|'full'} [radius='sm'] Corner rounding. `full` with equal width and height
 *   gives the circle an avatar or icon placeholder needs.
 */

/**
 * @typedef {Object} SkeletonTextOptions
 * @property {number} [lines=3] Number of text lines.
 * @property {string|number} [width='100%'] Width of the block as a whole.
 * @property {boolean} [heading=false] Whether the first line is drawn taller, as a title.
 * @property {string|number} [lastLineWidth='60%'] Width of the final line, which reads as prose
 *   rather than as a filled rectangle.
 */

/**
 * @typedef {Object} SkeletonTableOptions
 * @property {number} [rows=5] Number of body rows.
 * @property {number} [columns=4] Number of columns.
 * @property {boolean} [header=true] Whether a header row is drawn.
 */

/**
 * Creates one placeholder block.
 *
 * Skeletons stand in for content whose shape is already known, which is what makes them worth
 * more than a spinner: the layout does not jump when the data arrives. Every skeleton is
 * `aria-hidden`, because a screen reader gains nothing from an announced grey box — set
 * `aria-busy="true"` on the region being filled instead, and remove it with the skeleton.
 *
 * @param {SkeletonOptions} [opts={}] Block options.
 * @returns {HTMLSpanElement}
 */
export function skeleton(opts = {}) {
  const options = { width: '100%', height: '1rem', radius: 'sm', ...opts };
  return /** @type {HTMLSpanElement} */ (h('span', {
    class: 'zx-skeleton',
    ariaHidden: 'true',
    dataset: { radius: RADII.has(options.radius) ? options.radius : 'sm' },
    style: { 'inline-size': size(options.width), 'block-size': size(options.height) }
  }));
}

/**
 * Creates a stack of placeholder lines standing in for a paragraph or a labelled value.
 * @param {SkeletonTextOptions} [opts={}] Text options.
 * @returns {HTMLDivElement}
 */
export function skeletonText(opts = {}) {
  const options = { lines: 3, width: '100%', heading: false, lastLineWidth: '60%', ...opts };
  const lines = clamp(Math.trunc(Number(options.lines) || 0), 1, 20);
  const element = /** @type {HTMLDivElement} */ (h('div', {
    class: 'zx-skeleton-text',
    ariaHidden: 'true',
    style: { 'inline-size': size(options.width) }
  }));

  for (let index = 0; index < lines; index += 1) {
    const heading = options.heading && index === 0;
    const last = index === lines - 1 && lines > 1;
    element.append(skeleton({
      width: last ? options.lastLineWidth : '100%',
      height: heading ? '1.5rem' : '0.75rem'
    }));
  }
  return element;
}

/**
 * Creates a placeholder grid the shape of a table that has not loaded yet.
 *
 * Rendered as plain elements rather than a `<table>`: there is no data to expose, and a table
 * whose cells are all empty is worse for assistive technology than no table at all.
 *
 * @param {SkeletonTableOptions} [opts={}] Table options.
 * @returns {HTMLDivElement}
 */
export function skeletonTable(opts = {}) {
  const options = { rows: 5, columns: 4, header: true, ...opts };
  const rows = clamp(Math.trunc(Number(options.rows) || 0), 1, 50);
  const columns = clamp(Math.trunc(Number(options.columns) || 0), 1, 20);
  const element = /** @type {HTMLDivElement} */ (h('div', {
    class: 'zx-skeleton-table',
    ariaHidden: 'true',
    style: { '--zx-skeleton-columns': String(columns) }
  }));

  if (options.header !== false) {
    element.append(row(columns, 'header'));
  }
  for (let index = 0; index < rows; index += 1) element.append(row(columns, 'body'));
  return element;
}

const RADII = new Set(['sm', 'md', 'full']);

/**
 * Builds one placeholder row.
 * @param {number} columns Number of cells.
 * @param {'header'|'body'} kind Row kind.
 * @returns {HTMLDivElement}
 */
function row(columns, kind) {
  const element = /** @type {HTMLDivElement} */ (h('div', {
    class: 'zx-skeleton-table__row',
    dataset: { kind }
  }));
  for (let index = 0; index < columns; index += 1) {
    element.append(h('span', { class: 'zx-skeleton-table__cell' },
      skeleton({ width: cellWidth(index, columns), height: '0.75rem' })));
  }
  return element;
}

/**
 * Cell widths that vary a little, so the placeholder reads as a table of values rather than as a
 * bar chart of identical blocks.
 * @param {number} index Column index.
 * @param {number} columns Column count.
 * @returns {string}
 */
function cellWidth(index, columns) {
  if (index === columns - 1) return '55%';
  return index % 2 === 0 ? '80%' : '65%';
}

/**
 * Normalizes a CSS length, reading a bare number as pixels.
 * @param {string|number} value Width or height.
 * @returns {string}
 */
function size(value) {
  return typeof value === 'number' ? `${value}px` : String(value ?? '');
}
