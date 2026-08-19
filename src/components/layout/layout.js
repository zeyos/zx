import { h } from '../../core/dom.js';

/**
 * @typedef {Object} StackOptions
 * @property {'column'|'row'} [direction='column'] Flow direction.
 * @property {number|string} [gap=4] Space between children. A number 1–8 picks the matching
 *   `--zx-space-*` step; a string is used as-is.
 * @property {'start'|'center'|'end'|'stretch'|'baseline'} [align] Cross-axis alignment.
 * @property {'start'|'center'|'end'|'between'|'around'} [justify] Main-axis distribution.
 * @property {boolean} [wrap=false] Whether a row wraps.
 * @property {boolean} [inline=false] Whether the stack is laid out inline.
 * @property {string} [class=''] Extra class names.
 */

/**
 * @typedef {Object} GridOptions
 * @property {number|null} [columns=null] Column count at full width. Null fills the row with as
 *   many tracks of `min` width as fit.
 * @property {number|string} [min='16rem'] Narrowest a track may get before the grid drops a
 *   column. A number is read as pixels.
 * @property {number|string} [gap=4] Space between cells, as in `stack`.
 * @property {'start'|'center'|'end'|'stretch'} [align] Block-axis alignment of each cell.
 * @property {string} [class=''] Extra class names.
 */

/**
 * @typedef {Object} AspectOptions
 * @property {string} [ratio='16 / 9'] Aspect ratio of the box.
 * @property {'cover'|'contain'|'fill'} [fit='cover'] How the single child fills the box.
 * @property {string} [class=''] Extra class names.
 */

/** @typedef {import('../../core/dom.js').DomChild} DomChild */

/**
 * Creates a one-dimensional flow of children with consistent spacing.
 *
 * Zx ships no page grid on purpose: an ERP screen is a shell of panels, and `SplitView`,
 * `MasterPanel`, and `Panel` already own that layer. `stack` and `grid` are the small pieces that
 * were missing under them — the spacing every form section, toolbar row, and card list was
 * otherwise re-inventing with an ad-hoc flex rule.
 *
 * @param {StackOptions} [options={}] Stack options.
 * @param {...DomChild} children Children.
 * @returns {HTMLDivElement}
 */
export function stack(options = {}, ...children) {
  const element = /** @type {HTMLDivElement} */ (h('div', {
    class: ['zx-stack', options.class ?? ''],
    dataset: {
      direction: options.direction === 'row' ? 'row' : null,
      align: ALIGN.has(options.align) ? options.align : null,
      justify: JUSTIFY.has(options.justify) ? options.justify : null,
      wrap: options.wrap ? 'true' : null,
      inline: options.inline ? 'true' : null
    },
    style: gapStyle('--zx-stack-gap', options.gap)
  }, children));
  return element;
}

/**
 * Creates a grid that keeps its tracks readable, dropping a column when the container gets too
 * narrow to hold them at `min` width.
 *
 * The reflow is intrinsic — `auto-fit` against a `min` track width — so a grid behaves the same
 * in a full-width page, a split pane, and a modal. Nothing here consults the viewport, which is
 * the usual reason a "responsive" grid still breaks inside a narrow panel.
 *
 * @param {GridOptions} [options={}] Grid options.
 * @param {...DomChild} children Cells.
 * @returns {HTMLDivElement}
 */
export function grid(options = {}, ...children) {
  const columns = Number(options.columns);
  const style = {
    ...gapStyle('--zx-grid-gap', options.gap),
    '--zx-grid-min': length(options.min ?? '16rem')
  };
  if (Number.isFinite(columns) && columns >= 1) {
    style['--zx-grid-columns'] = String(Math.trunc(columns));
  }
  return /** @type {HTMLDivElement} */ (h('div', {
    class: ['zx-grid', options.class ?? ''],
    dataset: {
      columns: Number.isFinite(columns) && columns >= 1 ? 'true' : null,
      align: ALIGN.has(options.align) ? options.align : null
    },
    style
  }, children));
}

/**
 * Creates a box that holds a fixed aspect ratio whatever its width, so an image, a map, or a
 * chart placeholder reserves its space before it loads.
 * @param {AspectOptions} [options={}] Aspect options.
 * @param {...DomChild} children The single child to fit.
 * @returns {HTMLDivElement}
 */
export function aspect(options = {}, ...children) {
  return /** @type {HTMLDivElement} */ (h('div', {
    class: ['zx-aspect', options.class ?? ''],
    style: {
      '--zx-aspect-ratio': String(options.ratio ?? '16 / 9'),
      '--zx-aspect-fit': FIT.has(options.fit) ? options.fit : 'cover'
    }
  }, children));
}

const ALIGN = new Set(['start', 'center', 'end', 'stretch', 'baseline']);
const JUSTIFY = new Set(['start', 'center', 'end', 'between', 'around']);
const FIT = new Set(['cover', 'contain', 'fill']);

/**
 * Resolves a gap into a custom property, mapping 1–8 onto the spacing scale.
 * @param {string} property Custom property to set.
 * @param {number|string|undefined} gap Gap option.
 * @returns {Record<string, string>}
 */
function gapStyle(property, gap) {
  if (gap === undefined || gap === null || gap === '') return {};
  const step = Number(gap);
  if (Number.isInteger(step) && step >= 1 && step <= 8) {
    return { [property]: `var(--zx-space-${step})` };
  }
  return { [property]: String(gap) };
}

/**
 * Normalizes a CSS length, reading a bare number as pixels.
 * @param {string|number} value Length.
 * @returns {string}
 */
function length(value) {
  return typeof value === 'number' ? `${value}px` : String(value);
}
