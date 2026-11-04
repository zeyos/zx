// @ts-check
import { Component } from '../../core/component.js';
import { h, restoreTarget, safeHref, snapshotTarget } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { prefersReducedMotion } from '../../core/motion.js';
import { uid } from '../../core/util.js';
import { Tooltip } from '../tooltip/tooltip.js';

/** @typedef {import('../../internal/agent-model.js').Source} Source */

/**
 * What a source is: it picks the glyph, and whether activating it can open an address.
 * @typedef {'web'|'file'|'record'|'call'} SourceKind
 */

/**
 * @typedef {Object} SourceListOptions
 * @property {Source[]} [sources=[]] The sources, in the order an answer's `[n]` citations number
 * them. Model text is data: every string reaches the page as text.
 * @property {string|null} [label] The visible label the list is named by, by default the
 * `sourceList.label` message ("Sources"). Empty or null hides it and names the list with that
 * message instead.
 * @property {'chips'|'list'} [layout='chips'] `'chips'` wraps short chips beside the label;
 * `'list'` gives each source a full-width row with its title and site.
 * @property {boolean} [numbered=true] Whether each source shows its number.
 * @property {Partial<Record<SourceKind, string>>} [icons={}] Icon names per source kind, over the
 * built-in `SOURCE_ICONS`.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<{source: Source, n: number}>) => void} [onselect] Activation
 * listener; `preventDefault()` keeps a web source from opening.
 */

/** Built-in glyph per source kind. */
export const SOURCE_ICONS = Object.freeze({
  web: 'link-2',
  file: 'file',
  record: 'table',
  call: 'gear'
});

const MESSAGES = Object.freeze({
  'sourceList.label': 'Sources',
  'sourceList.source': 'Source'
});

/** How long a highlighted source stays marked, in milliseconds. */
const HIGHLIGHT_MS = 2000;

/**
 * The sources an answer cites: a numbered chip (or row) for each, naming its site or title, with a
 * card of its title, site, and the passage used on hover and focus.
 *
 * Activating a source emits a preventable `select`. Unless it is prevented, a `web` source opens
 * its address in a new tab — only an absolute `https:` address, and never with access back to this
 * page; every other kind is left to the application, which might reveal the trace step the source
 * came from. The list never loads a favicon, a thumbnail, or any other remote resource.
 *
 * @fires SourceList#select
 * @extends {Component<SourceListOptions>}
 */
export class SourceList extends Component {
  static cssName = 'source-list';

  /** @type {Readonly<SourceListOptions>} */
  static defaults = {
    sources: [],
    // Undefined rather than null, which already hides the label.
    label: undefined,
    layout: 'chips',
    numbered: true,
    icons: {},
    msg: MESSAGES
  };

  /** @returns {HTMLElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._original = created ? null : snapshotTarget(root);
    if (!created) root.replaceChildren();
    this._destroyed = false;
    /** @type {Array<Source & {id: string}>} */
    this._sources = [];
    /** @type {HTMLButtonElement[]} */
    this._buttons = [];
    /** @type {Tooltip[]} */
    this._tooltips = [];
    /** @type {ReturnType<typeof setTimeout>|null} */
    this._highlightTimer = null;
    this._layout = this.options.layout === 'list' ? 'list' : 'chips';
    root.dataset.layout = this._layout;

    const { label: option = this.msg('sourceList.label') } = this.options;
    const label = typeof option === 'string' ? option.trim() : '';
    const labelId = uid('zx-source-list');
    const heading = label ? h('span', { class: 'zx-source-list__label', id: labelId }, label) : null;
    this._list = h('ol', {
      class: 'zx-source-list__items',
      'aria-labelledby': heading ? labelId : null,
      'aria-label': heading ? null : this.msg('sourceList.label')
    });
    root.append(...[heading, this._list].filter((node) => node !== null));

    this.listen(root, 'click', (event) => this._onClick(/** @type {MouseEvent} */ (event)));
    this._build(this.options.sources);
    return root;
  }

  /**
   * Replaces every source. Focus on a source stays on the source with the same `id`.
   * @param {Source[]} sources
   * @returns {this}
   */
  setSources(sources) {
    this._build(sources);
    return this;
  }

  /**
   * Points at one source, as a citation `[n]` in the answer does: scrolls it into view, puts focus
   * on it, and marks it with `data-state="highlighted"` for two seconds. A number is the source's
   * position, from 1; a string is its `id`. Anything else does nothing.
   * @param {number|string} n
   * @returns {this}
   */
  highlight(n) {
    const index = typeof n === 'number'
      ? Math.trunc(n) - 1
      : this._sources.findIndex((source) => source.id === String(n));
    const button = this._buttons[index];
    if (!button) return this;
    if (typeof button.scrollIntoView === 'function') {
      button.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: prefersReducedMotion(this.el) ? 'auto' : 'smooth' });
    }
    button.focus({ preventScroll: true });
    if (this._highlightTimer) clearTimeout(this._highlightTimer);
    for (const other of this._buttons) if (other !== button) delete other.dataset.state;
    button.dataset.state = 'highlighted';
    this._highlightTimer = setTimeout(() => {
      this._highlightTimer = null;
      if (button.dataset.state === 'highlighted') delete button.dataset.state;
    }, HIGHLIGHT_MS);
    return this;
  }

  /** @returns {Source[]} Copies of the sources, in order. */
  getSources() {
    return this._sources.map(cloneSource);
  }

  /** @returns {void} */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._highlightTimer) clearTimeout(this._highlightTimer);
    this._highlightTimer = null;
    this._releaseTooltips();
    super.destroy();
    if (this._original) restoreTarget(this.el, this._original);
  }

  /**
   * @private
   * @param {unknown} sources
   * @returns {void}
   */
  _build(sources) {
    const active = this.el.ownerDocument?.activeElement ?? null;
    const focused = active && this._list.contains(active)
      ? /** @type {HTMLElement|null} */ (active.closest('[data-source]'))?.dataset.source ?? null
      : null;
    if (this._highlightTimer) clearTimeout(this._highlightTimer);
    this._highlightTimer = null;
    this._releaseTooltips();
    this._sources = normalizeSources(sources);
    this._buttons = [];
    this._list.replaceChildren(...this._sources.map((source, index) => this._item(source, index)));
    const root = /** @type {HTMLElement} */ (this.el);
    if (this._sources.length) delete root.dataset.empty;
    else root.dataset.empty = '';
    if (focused) this._buttons.find((button) => button.dataset.source === focused)?.focus({ preventScroll: true });
  }

  /**
   * @private
   * @param {Source & {id: string}} source
   * @param {number} index
   * @returns {HTMLElement}
   */
  _item(source, index) {
    const kind = sourceKind(source);
    const n = index + 1;
    const numbered = this.options.numbered !== false;
    const where = sourcePlace(source);
    const button = /** @type {HTMLButtonElement} */ (h('button', {
      type: 'button',
      class: 'zx-source-list__source',
      dataset: { source: source.id, n: String(n), kind }
    },
    // Named "Source 1: bank.example", which keeps the visible "1" and name in the accessible name.
    numbered ? [
      h('span', { class: 'zx-source-list__sr' }, `${this.msg('sourceList.source')} `),
      h('span', { class: 'zx-source-list__n' }, String(n)),
      h('span', { class: 'zx-source-list__sr' }, ': ')
    ] : null,
    h('span', { class: 'zx-source-list__glyph', 'aria-hidden': 'true' }, icon(this._icon(kind), { size: 14 })),
    this._layout === 'list'
      ? h('span', { class: 'zx-source-list__copy' },
        h('span', { class: 'zx-source-list__title' }, source.title || sourceName(source)),
        where && where !== source.title ? h('span', { class: 'zx-source-list__site' }, where) : null)
      : h('span', { class: 'zx-source-list__name' }, sourceName(source))));
    this._buttons.push(button);
    this._tooltips.push(new Tooltip(button, {
      content: () => this._card(source),
      placement: 'top-start',
      maxWidth: 320
    }));
    return h('li', { class: 'zx-source-list__item' }, button);
  }

  /**
   * The card a source shows on hover and focus: its title, where it is (the host of a web
   * address), and the passage used.
   * @private
   * @param {Source & {id: string}} source
   * @returns {HTMLElement}
   */
  _card(source) {
    const kind = sourceKind(source);
    const where = sourcePlace(source);
    return h('span', { class: 'zx-source-list__card' },
      h('span', { class: 'zx-source-list__card-title' }, source.title || sourceName(source)),
      // A file named by its own title would say its name twice.
      where && where !== (source.title || sourceName(source))
        ? h('span', { class: 'zx-source-list__card-site' }, icon(this._icon(kind), { size: 12 }), where) : null,
      source.snippet ? h('span', { class: 'zx-source-list__card-snippet' }, String(source.snippet)) : null);
  }

  /** @private @param {SourceKind} kind @returns {string} */
  _icon(kind) {
    const custom = this.options.icons?.[kind];
    return typeof custom === 'string' && custom ? custom : SOURCE_ICONS[kind];
  }

  /** @private @returns {void} */
  _releaseTooltips() {
    for (const tooltip of this._tooltips) tooltip.destroy();
    this._tooltips = [];
  }

  /**
   * @private
   * @param {MouseEvent} event
   * @returns {void}
   */
  _onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const button = /** @type {HTMLElement|null} */ (target?.closest('[data-source]') ?? null);
    if (!button || !this._list.contains(button)) return;
    const index = Number(button.dataset.n) - 1;
    const source = this._sources[index];
    if (!source) return;
    const selected = this.emit('select', { source: cloneSource(source), n: index + 1 }, { honorDomCancellation: true });
    if (selected.defaultPrevented) return;
    const href = sourceHref(source);
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Fired when a source is activated. Preventable: `preventDefault()` keeps a web source from
 * opening its address.
 * @event SourceList#select
 * @type {CustomEvent<{source: Source, n: number}>}
 */

/* ------------------------------------------------------------------ pure helpers -- */

/**
 * @param {unknown} sources
 * @returns {Array<Source & {id: string}>}
 */
function normalizeSources(sources) {
  /** @type {Array<Source & {id: string}>} */
  const out = [];
  (Array.isArray(sources) ? sources : []).forEach((source, index) => {
    if (!source || typeof source !== 'object') return;
    const id = source.id == null || source.id === '' ? `source-${index + 1}` : String(source.id);
    out.push({ ...cloneSource(source), id, title: source.title == null ? '' : String(source.title) });
  });
  return out;
}

/** @param {Source} source @returns {Source} A copy that shares nothing with the original. */
function cloneSource(source) {
  const copy = { ...source };
  if (source.ref && typeof source.ref === 'object') copy.ref = { ...source.ref };
  return copy;
}

/**
 * A source's kind; a source without one is a web source.
 * @param {Source|null|undefined} source
 * @returns {SourceKind}
 */
export function sourceKind(source) {
  const kind = source?.kind ?? 'web';
  return Object.hasOwn(SOURCE_ICONS, kind) ? kind : 'web';
}

/**
 * The address a source may open: a `web` source's `href`, only when it is an absolute `https:`
 * URL that `safeHref()` accepts. Anything else — another kind, a relative or `http:` address, a
 * script scheme — gives null.
 * @param {Source|null|undefined} source
 * @returns {string|null}
 */
export function sourceHref(source) {
  if (!source || typeof source !== 'object' || sourceKind(source) !== 'web') return null;
  const href = safeHref(source.href);
  if (!href) return null;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * The host a web source opens, for its card: "bank.example". Null when it opens nothing.
 * @param {Source|null|undefined} source
 * @returns {string|null}
 */
export function sourceHost(source) {
  const href = sourceHref(source);
  return href ? new URL(href).host : null;
}

/**
 * The short name a chip shows: the source's `site`, else its title.
 * @param {Source|null|undefined} source
 * @returns {string}
 */
export function sourceName(source) {
  const site = source?.site == null ? '' : String(source.site).trim();
  return site || (source?.title == null ? '' : String(source.title));
}

/**
 * Where a source is, for its card and list row: the host a web source opens, else its `site`.
 * @param {Source} source
 * @returns {string}
 */
function sourcePlace(source) {
  return sourceHost(source) ?? (source.site == null ? '' : String(source.site));
}
