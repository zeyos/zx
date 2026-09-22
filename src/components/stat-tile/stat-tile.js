// @ts-check
import { Component } from '../../core/component.js';
import { h, restoreTarget, safeHref, snapshotTarget } from '../../core/dom.js';
import { formatCurrency, formatFileSize, formatNumber, formatPercent } from '../../core/format.js';
import { printf } from '../../core/i18n.js';
import { icon as createIcon } from '../../core/icons.js';
import { clamp } from '../../core/util.js';
import { skeleton } from '../skeleton/skeleton.js';

/** @typedef {'number'|'currency'|'percent'|'fileSize'|null} StatTileFormatName */
/** @typedef {StatTileFormatName|((value: number|string|null|undefined) => string)} StatTileFormat */
/** @typedef {'neutral'|'accent'|'success'|'warning'|'danger'|'info'} StatTileKind */
/** @typedef {'positive'|'negative'|'neutral'} StatTileDeltaKind */
/** @typedef {'up'|'down'|'flat'} StatTileDirection */

/**
 * @typedef {Object} StatTileDelta
 * @property {StatTileDirection} direction Which way the metric moved, read from the sign alone.
 * @property {string} sign `'+'`, `'−'` (U+2212), or `''` for an unchanged metric.
 * @property {string} magnitude The formatted absolute change, without a sign.
 * @property {string} text The visible change: `sign` followed by `magnitude`.
 */

/**
 * @typedef {Object} StatTileNameParts
 * @property {string} [label] The metric's name.
 * @property {string} [value] The formatted value.
 * @property {string} [delta] The change, already worded for speech (`'up 2'`, not `'+2'`).
 * @property {string} [deltaLabel] What the change is measured against.
 */

/**
 * @typedef {Object} StatTileOptions
 * @property {string} [label=''] The metric's name, set small above the value.
 * @property {number|string|null} [value=null] The metric. A string is rendered as given.
 * @property {StatTileFormat} [format='number'] How a numeric value is rendered: a named mode, a
 *   callback receiving the raw value, or null to print the value unformatted.
 * @property {string|null} [currency=null] ISO 4217 code used by `format: 'currency'`.
 * @property {string} [locale] BCP 47 tag for every formatter; defaults to the active language.
 * @property {number|string|null} [delta=null] Change against the previous period. Rendered with
 *   its own sign and an arrow, never with colour alone.
 * @property {StatTileDeltaKind} [deltaKind='neutral'] Whether the change is good, bad, or merely a
 *   change. This — not the sign's direction — picks the delta colour: a rising ticket count is not
 *   a success, so "up is good" is never assumed.
 * @property {StatTileFormat} [deltaFormat] How the delta is rendered; defaults to `format`.
 * @property {string} [deltaLabel=''] What the change is measured against, e.g. `'vs. last week'`.
 * @property {number[]} [trend=[]] Values for a decorative sparkline. Fewer than two usable numbers
 *   render nothing.
 * @property {string|null} [icon=null] Icon name from `icons.js`, shown beside the label.
 * @property {StatTileKind} [kind='neutral'] Semantic intent. It tints the icon and the sparkline
 *   and never the value, which stays at full text contrast whatever intent a record carries.
 * @property {string|null} [href=null] Destination. A tile with an href is an `<a>`.
 * @property {boolean} [clickable=false] Renders a `<button>` without an href. Passing `onclick`
 *   sets this implicitly; set it directly to subscribe with `on('click', …)` instead.
 * @property {boolean} [loading=false] Renders a skeleton shaped like the tile.
 * @property {Record<string, unknown>} [msg] Message overrides, keyed as `statTile.*`.
 * @property {(event: CustomEvent<{event: MouseEvent}>) => void} [onclick] Activation listener; its
 *   presence is what turns a tile with no href into a button. It is the tile's `click` event, as
 *   every Zx component's `on*` option is, so it receives the `CustomEvent` carrying the native
 *   event in `detail.event`.
 */

/** Semantic intents, in the order they are documented. */
const KINDS = Object.freeze(['neutral', 'accent', 'success', 'warning', 'danger', 'info']);

/** Delta intents. The sign says which way; this says whether that is good news. */
const DELTA_KINDS = Object.freeze(['positive', 'negative', 'neutral']);

/**
 * The built-in English text behind every `statTile.*` key. Kept as one table rather than repeated
 * at each call site so the fallbacks cannot drift from each other, and so a host translating the
 * component has the whole set in front of it.
 */
const MESSAGES = Object.freeze({
  'statTile.up': 'up %1',
  'statTile.down': 'down %1',
  'statTile.unchanged': 'no change',
  'statTile.loading': 'Loading'
});

/** Arrow glyph per direction. A delta is never colour alone, so the shape carries it too. */
const DIRECTION_ICONS = Object.freeze({ up: 'chevron-up', down: 'chevron-down', flat: 'minus' });

/** The sparkline's user-unit box. It is stretched to the rendered width by the viewBox. */
const TREND_WIDTH = 100;
const TREND_HEIGHT = 30;
/** Half the stroke plus a little, so the extreme points are not clipped by the box. */
const TREND_INSET = 2;

/** @type {Readonly<StatTileOptions>} */
const defaults = Object.freeze({
  label: '',
  value: null,
  format: 'number',
  currency: null,
  delta: null,
  deltaKind: 'neutral',
  deltaLabel: '',
  trend: [],
  icon: null,
  kind: 'neutral',
  href: null,
  clickable: false,
  loading: false
});

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Renders a metric: a label, the number it names, and — optionally — how that number moved.
 *
 * The value is the loudest thing on the tile; the label sits small above it and the delta and the
 * sparkline are subordinate to both. Nothing here assumes a fixed set of metrics: the label, the
 * intent colour, the icon and the formatting all arrive per instance, so a tile whose content
 * comes from a server is the normal case rather than the exception.
 *
 * The element shape follows the tile's behaviour, and a tag cannot be rewritten in place, so the
 * component normally builds its own root — pass `null` as the target, or use {@link statTile}. An
 * existing element is adopted only when its tag already is the one the options call for; a mismatch
 * throws rather than silently shipping a `<div>` with a click handler or a link that cannot
 * navigate.
 *
 * @fires StatTile#click
 * @extends {Component<StatTileOptions>}
 */
export class StatTile extends Component {
  static cssName = 'stat-tile';

  /** @type {Readonly<StatTileOptions>} */
  static defaults = defaults;

  /**
   * Creates or adopts one metric tile.
   * @param {Element|string|null} [target=null] Existing element of the required tag, or null.
   * @param {StatTileOptions} [options={}] Tile options.
   */
  constructor(target = null, options = {}) {
    // `Component` consumes every function-valued `on*` option into a component event listener, so
    // `options.onclick` no longer exists by the time `render()` chooses the element's tag. The
    // shape decision is taken here, before the base constructor, and carried across as a flag.
    super(target, {
      ...options,
      clickable: options?.clickable === true || typeof options?.onclick === 'function'
    });
  }

  /**
   * @returns {HTMLElement}
   * @throws {TypeError} When an adopted target is not the tag the options require.
   */
  render() {
    const tag = statTileTag(this.options);
    this._createdRoot = this.el === null;
    if (!this._createdRoot && this.el.tagName.toLowerCase() !== tag) {
      throw new TypeError(
        `StatTile needs a <${tag}> for these options, but the target is a `
        + `<${this.el.tagName.toLowerCase()}>. Pass null as the target to let it build its own.`);
    }
    const root = /** @type {HTMLElement} */ (this.el ?? h(tag));
    this.el = root;
    this._snapshot = this._createdRoot ? null : snapshotTarget(root);
    this._closed = false;
    this._state = { ...this.options };

    if (tag === 'button') /** @type {HTMLButtonElement} */ (root).type = 'button';
    fillStatTile(root, this._state, (key, ...args) => this._message(key, ...args));
    if (tag !== 'div') {
      this.listen(root, 'click', (event) => {
        this.emit('click', { event: /** @type {MouseEvent} */ (event) });
      });
    }
    return root;
  }

  /**
   * Replaces any subset of the tile's content and redraws it. This is how a tile leaves
   * `loading: true` behind once the server answers.
   * @param {StatTileOptions} options Options to merge over the current ones.
   * @returns {this}
   * @throws {TypeError} When the merged options would need a different element tag.
   */
  update(options = {}) {
    const next = { ...this._state, ...options };
    const tag = this.el.tagName.toLowerCase();
    if (statTileTag(next) !== tag) {
      throw new TypeError(
        `StatTile cannot change from <${tag}> to <${statTileTag(next)}> in place: href and `
        + 'clickable decide the element, and an element\'s tag is fixed once it exists.');
    }
    this._state = next;
    fillStatTile(/** @type {HTMLElement} */ (this.el), next, (key, ...args) => this._message(key, ...args));
    return this;
  }

  /**
   * Reports the tile's own accessible name, which is what assistive technology announces.
   * @returns {string} Label, value, and delta, in that order.
   */
  getAccessibleName() {
    return this.el.getAttribute('aria-label') ?? '';
  }

  /**
   * Aborts listeners and restores an adopted target to the state it was found in.
   * @returns {void}
   */
  destroy() {
    if (this._closed) return;
    this._closed = true;
    const root = this.el;
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, this._snapshot);
  }

  /**
   * Resolves a message through the host translator, falling back to the built-in English text.
   * @param {string} key Message key.
   * @param {...unknown} args Interpolation values.
   * @returns {string}
   */
  _message(key, ...args) {
    const resolved = this.msg(key, ...args);
    return resolved === key ? printf(MESSAGES[key] ?? key, args) : resolved;
  }
}

/**
 * Creates a tile that builds its own root: the convenience form of `new StatTile(null, options)`,
 * the way `tooltip()` stands in for `new Tooltip(…)`.
 *
 * It returns the component, not an element, so there is one construction idiom and one click path.
 * Call `.toElement()` for the node to place.
 *
 * @param {StatTileOptions} [opts={}] Tile options.
 * @returns {StatTile} The component, whose root is an `<a>`, a `<button>`, or a `<div>`.
 */
export function statTile(opts = {}) {
  return new StatTile(null, opts);
}

/**
 * Formats the metric itself.
 *
 * A string value is the host's own final text and is passed through untouched; an explicit
 * callback outranks that, because a host that supplies one has asked to decide every case.
 *
 * @param {number|string|null|undefined} value The metric.
 * @param {{format?: StatTileFormat, locale?: string, currency?: string|null}} [options={}] Mode,
 *   language, and currency.
 * @returns {string} The text to display; empty for a missing value.
 */
export function formatStatValue(value, options = {}) {
  const { format = 'number', locale, currency = null } = options;
  if (typeof format === 'function') return asText(format(value));
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';

  switch (format) {
    case 'currency': return formatCurrency(value, currency, { locale });
    case 'percent': return formatPercent(value, { locale });
    case 'fileSize': return formatFileSize(value, { locale });
    case 'number': return formatNumber(value, { locale });
    default: return asText(value);
  }
}

/**
 * Describes a change without judging it.
 *
 * The direction is read from the sign and nothing else; whether that direction is good news is
 * `deltaKind`'s business, not this function's. The magnitude is formatted from the absolute value
 * and the sign is prepended, because no locale prints a leading `+` on its own.
 *
 * @param {number|string|null|undefined} delta The change.
 * @param {{format?: StatTileFormat, locale?: string, currency?: string|null}} [options={}]
 *   Formatting, defaulting to the tile's own.
 * @returns {StatTileDelta|null} The change, or null when there is none to show.
 */
export function statDelta(delta, options = {}) {
  const number = finite(delta);
  if (number === null) return null;

  const direction = number > 0 ? 'up' : number < 0 ? 'down' : 'flat';
  // U+2212 MINUS SIGN rather than a hyphen: it is the same width as the digits beside it, which
  // keeps a column of tiles aligned. The accessible name never uses it — it says "down" instead.
  const sign = direction === 'up' ? '+' : direction === 'down' ? '−' : '';
  const magnitude = formatStatValue(Math.abs(number), options);
  return { direction, sign, magnitude, text: `${sign}${magnitude}` };
}

/**
 * Chooses the element a tile must be, from what the tile does.
 *
 * A destination is a link, an action is a button, and a tile that does neither is a plain
 * container. A `<div>` never gets a click handler, and an href that could execute script is not a
 * destination at all — it falls through to whichever shape the remaining options justify.
 *
 * @param {{href?: string|null, clickable?: boolean, onclick?: unknown}} [options={}] The options
 *   that carry behaviour.
 * @returns {'a'|'button'|'div'} The tag to render.
 */
export function statTileTag(options = {}) {
  if (safeHref(options.href)) return 'a';
  if (options.clickable === true || typeof options.onclick === 'function') return 'button';
  return 'div';
}

/**
 * Composes the tile's accessible name: label, then value, then how it changed.
 *
 * The sparkline is decoration and contributes nothing, and the delta arrives already worded —
 * `'up 2'` rather than `'+2'` — because a screen reader should not have to interpret a glyph.
 *
 * @param {StatTileNameParts} [parts={}] The pieces, already formatted and translated.
 * @returns {string} The name, with empty pieces dropped rather than left as stray punctuation.
 */
export function statTileName(parts = {}) {
  const change = [parts.delta, parts.deltaLabel].map(trimmed).filter(Boolean).join(' ');
  return [trimmed(parts.label), trimmed(parts.value), change].filter(Boolean).join(', ');
}

/**
 * Projects a series onto the sparkline's user-unit box.
 *
 * A series needs two usable numbers to be a line; a flat series is drawn down the middle rather
 * than along the floor, which would read as zero.
 *
 * @param {unknown[]} values The series, in order. Unusable entries are dropped.
 * @param {{width?: number, height?: number, inset?: number}} [box={}] The target box.
 * @returns {string|null} An SVG `points` list, or null when there is no line to draw.
 */
export function statTrendPoints(values, box = {}) {
  const { width = TREND_WIDTH, height = TREND_HEIGHT, inset = TREND_INSET } = box;
  const series = /** @type {number[]} */ ((Array.isArray(values) ? values : [])
    .map(finite)
    .filter((entry) => entry !== null));
  if (series.length < 2) return null;

  const low = Math.min(...series);
  const high = Math.max(...series);
  const top = inset;
  const bottom = Math.max(inset, height - inset);
  const span = high - low;
  const step = width / (series.length - 1);

  return series.map((entry, index) => {
    const x = index === series.length - 1 ? width : index * step;
    const y = span === 0 ? (top + bottom) / 2 : bottom - ((entry - low) / span) * (bottom - top);
    return `${round(x)},${round(y)}`;
  }).join(' ');
}

/**
 * Builds the tile's children into an element that already has the right tag, and (re)applies every
 * attribute the tile owns. Shared by the factory and the component so there is one tile, not two.
 * @param {HTMLElement} root The tile's root.
 * @param {StatTileOptions} options Fully merged options.
 * @param {(key: string, ...args: unknown[]) => string} message Message resolver.
 * @returns {void}
 */
function fillStatTile(root, options, message) {
  const kind = normalize(options.kind, KINDS, 'neutral');
  const label = asText(options.label);
  const loading = options.loading === true;

  // `add` rather than an assignment to `className`: an adopted target keeps the classes its host
  // put on it, and a redraw through `update()` does not quietly strip them.
  root.classList.add('zx-stat-tile');
  root.dataset.kind = kind;
  root.dataset.loading = String(loading);
  if (root.tagName.toLowerCase() === 'a') {
    // `setAttribute` rather than the reflected property, so `update()` can also take a destination
    // away again — assigning `''` to `.href` leaves a link pointing at the current page.
    const href = safeHref(options.href);
    if (href) root.setAttribute('href', href);
    else root.removeAttribute('href');
  }

  if (loading) {
    root.setAttribute('aria-busy', 'true');
    applyName(root, statTileName({ label, value: message('statTile.loading') }));
    root.replaceChildren(loadingBody(options));
    return;
  }

  root.removeAttribute('aria-busy');
  const value = formatStatValue(options.value, options);
  const delta = statDelta(options.delta, {
    format: options.deltaFormat ?? options.format,
    locale: options.locale,
    currency: options.currency
  });
  const deltaLabel = asText(options.deltaLabel);

  applyName(root, statTileName({
    label,
    value,
    delta: delta === null ? '' : spokenDelta(delta, message),
    deltaLabel
  }));

  const header = h('div', { class: 'zx-stat-tile__header' },
    h('span', { class: 'zx-stat-tile__label' }, label));
  const glyph = tileIcon(options.icon);
  if (glyph) header.append(h('span', { class: 'zx-stat-tile__icon' }, glyph));

  // `Element`, not `HTMLElement`: the sparkline is an SVG element and belongs in the same list.
  /** @type {Element[]} */
  const children = [header, h('div', { class: 'zx-stat-tile__value' }, value)];
  if (delta !== null) children.push(deltaBody(delta, deltaLabel, options.deltaKind));
  const trend = trendBody(options.trend);
  if (trend) children.push(trend);
  root.replaceChildren(...children);
}

/**
 * Builds the delta row: sign, arrow, and what the change is measured against.
 * @param {StatTileDelta} delta The change.
 * @param {string} deltaLabel Comparison text.
 * @param {StatTileDeltaKind|undefined} deltaKind Whether the change is good news.
 * @returns {HTMLElement}
 */
function deltaBody(delta, deltaLabel, deltaKind) {
  // The whole row is hidden from assistive technology: the root's own name already carries the
  // change, worded, and reading "+2" after "up 2" would say the same thing twice.
  const row = h('div', {
    class: 'zx-stat-tile__delta',
    ariaHidden: 'true',
    dataset: {
      kind: normalize(deltaKind, DELTA_KINDS, 'neutral'),
      direction: delta.direction
    }
  }, createIcon(DIRECTION_ICONS[delta.direction], { size: 12 }),
  h('span', { class: 'zx-stat-tile__delta-value' }, delta.text));

  if (deltaLabel) row.append(h('span', { class: 'zx-stat-tile__delta-label' }, deltaLabel));
  return row;
}

/**
 * Builds the sparkline, or nothing when the series cannot make a line.
 *
 * Inline SVG rather than `icon()`, because this is data and not a glyph — and `aria-hidden`,
 * because a line nobody can read is decoration and has to say so.
 * @param {unknown} values The series.
 * @returns {SVGSVGElement|null}
 */
function trendBody(values) {
  const points = statTrendPoints(/** @type {unknown[]} */ (values));
  if (points === null) return null;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'zx-stat-tile__trend');
  svg.setAttribute('viewBox', `0 0 ${TREND_WIDTH} ${TREND_HEIGHT}`);
  // The line stretches to whatever width the tile has; `non-scaling-stroke` below keeps that
  // stretch from thinning the stroke with it.
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const line = document.createElementNS(SVG_NS, 'polyline');
  line.setAttribute('points', points);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'currentColor');
  line.setAttribute('stroke-width', '1.5');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(line);
  return svg;
}

/**
 * Builds the placeholder: the tile's own shape in grey, not a spinner, so nothing moves when the
 * numbers arrive.
 * @param {StatTileOptions} options Fully merged options.
 * @returns {HTMLElement}
 */
function loadingBody(options) {
  const blocks = [
    h('div', { class: 'zx-stat-tile__header' }, skeleton({ width: '55%', height: '0.75rem' })),
    skeleton({ width: '70%', height: '1.75rem', radius: 'md' })
  ];
  if (options.delta !== null && options.delta !== undefined) {
    blocks.push(skeleton({ width: '40%', height: '0.75rem' }));
  }
  if (statTrendPoints(/** @type {unknown[]} */ (options.trend)) !== null) {
    blocks.push(skeleton({ width: '100%', height: `${TREND_HEIGHT}px`, radius: 'md' }));
  }
  return h('div', { class: 'zx-stat-tile__loading' }, ...blocks);
}

/**
 * Renders the tile's icon.
 *
 * The icon travels with the metric, which means it comes from a server: a name the built-in set
 * does not carry is bad data on one tile, not a reason for the dashboard around it to stop
 * rendering.
 *
 * This used to wrap `icon()` in a `try`/`catch`, because `icon()` threw `RangeError` on a name it
 * could not resolve. It no longer does — it renders an empty placeholder of the right size and
 * reports the name once — so the guard is gone with it. The difference on screen is that the tile
 * now keeps the icon's 16px box instead of closing the gap, which is the better of the two:
 * a row of tiles stays aligned when one of them has a name nobody configured.
 * @param {unknown} name Icon name.
 * @returns {Element|null}
 */
function tileIcon(name) {
  return name ? createIcon(String(name), { size: 16 }) : null;
}

/**
 * Words a change for speech, so the name says "up 2" where the tile shows "+2" and an arrow.
 * @param {StatTileDelta} delta The change.
 * @param {(key: string, ...args: unknown[]) => string} message Message resolver.
 * @returns {string}
 */
function spokenDelta(delta, message) {
  if (delta.direction === 'flat') return message('statTile.unchanged');
  return message(delta.direction === 'up' ? 'statTile.up' : 'statTile.down', delta.magnitude);
}

/**
 * Names the tile.
 *
 * A link and a button take their name from `aria-label` alone. A plain tile is not a widget, so it
 * needs a role before a name means anything: `group` gives it one without hiding the text inside
 * it, which `img` would.
 * @param {HTMLElement} root The tile's root.
 * @param {string} name The composed name.
 * @returns {void}
 */
function applyName(root, name) {
  const plain = root.tagName.toLowerCase() === 'div';
  if (name) {
    root.setAttribute('aria-label', name);
    if (plain) root.setAttribute('role', 'group');
    return;
  }
  // An empty tile has nothing to be named, and a named-nothing role is worse than no role.
  root.removeAttribute('aria-label');
  if (plain) root.removeAttribute('role');
}

/** @param {unknown} value @param {readonly string[]} allowed @param {string} fallback @returns {any} */
function normalize(value, allowed, fallback) {
  return allowed.includes(/** @type {string} */ (value)) ? value : fallback;
}

/**
 * Reads a usable number, or nothing.
 *
 * `Number()` alone would turn a gap in a series — `null`, `''`, a stray `false` — into a hard zero,
 * which a sparkline then draws as a crash to the floor and a delta reports as "no change". A gap is
 * absent data, not the number nought, so it is dropped instead.
 * @param {unknown} value Candidate number.
 * @returns {number|null}
 */
function finite(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  // Only numbers and numeric strings are numbers. `Number()` says otherwise about `null`, `''`,
  // `false` and `[]` — all of which it reads as 0 — so they never reach it.
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text === '') return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

/** @param {unknown} value @returns {string} */
function asText(value) {
  return value === null || value === undefined ? '' : String(value);
}

/** @param {unknown} value @returns {string} */
function trimmed(value) {
  return asText(value).trim();
}

/** @param {number} value @returns {number} Two decimals, which is finer than one device pixel here. */
function round(value) {
  return Math.round(clamp(value, -1e6, 1e6) * 100) / 100;
}

/**
 * Fired when a linked or clickable tile is activated. A tile with neither an href nor a click
 * handler is a `<div>` and never emits it.
 * @event StatTile#click
 * @type {CustomEvent<{event: MouseEvent}>}
 */
