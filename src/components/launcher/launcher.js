import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { uid } from '../../core/util.js';

/**
 * @typedef {Object} LauncherItem
 * @property {string|number} id Stable item identifier.
 * @property {string} label Visible label.
 * @property {string} [description] Secondary text.
 * @property {string|string[]} [keywords] Additional search text.
 * @property {string} [group] Result group.
 * @property {string} [icon] Kernel icon name.
 * @property {string|number} [badge] Compact metadata.
 * @property {unknown} [value] Emitted value; defaults to `id`.
 * @property {string} [href] Native link target.
 * @property {string} [target] Native link browsing context.
 * @property {() => void} [invoke] Application-owned callback for non-link actions.
 * @property {boolean|number} [pinned] Pinned state or explicit pinned order.
 * @property {boolean} [disabled] Whether activation is unavailable.
 */
/**
 * @typedef {Object} LauncherSource
 * @property {string} id Source identifier.
 * @property {string} [label] Default group label.
 * @property {number} [minQuery] Per-source minimum query length.
 * @property {(query: string, context: {signal: AbortSignal}) => Promise<LauncherItem[]>|LauncherItem[]} load Loader.
 */
/**
 * @typedef {Object} LauncherOptions
 * @property {LauncherItem[]} [items=[]] Local application/action catalogue.
 * @property {LauncherSource[]} [sources=[]] Abortable asynchronous result sources.
 * @property {string} [query=''] Initial query.
 * @property {number} [debounce=250] Source-query delay in milliseconds.
 * @property {number} [minQuery=0] Global source minimum query length.
 * @property {number} [maxResults=100] Maximum combined results.
 * @property {string} [placeholder='Search applications and records'] Search-field placeholder.
 * @property {string} [label='Launcher'] Dialog and field label.
 * @property {string} [emptyText='No results'] Empty-state text.
 * @property {string} [loadingText='Searching…'] Loading-state text.
 * @property {'mod+k'|false} [shortcut='mod+k'] Optional global keyboard shortcut.
 * @property {(event: CustomEvent<LauncherSelectDetail>) => void} [onselect] Preventable selection listener.
 * @property {(event: CustomEvent<{query: string}>) => void} [onquery] Query-change listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onclose] Close listener.
 * @property {(event: CustomEvent<{source: LauncherSource, error: unknown}>) => void} [onerror] Source error listener.
 */
/** @typedef {{item: LauncherItem, value: unknown, source: string|null, query: string}} LauncherSelectDetail */
/** @typedef {LauncherItem & {_source?: string|null, _score?: number}} RankedLauncherItem */

/**
 * Abortable command/search dialog that emits application-owned actions without routing itself.
 * @fires Launcher#select
 * @fires Launcher#query
 * @fires Launcher#open
 * @fires Launcher#close
 * @fires Launcher#error
 * @extends {Component<LauncherOptions>}
 */
export class Launcher extends Component {
  static cssName = 'launcher';

  /** @type {Readonly<LauncherOptions>} */
  static defaults = {
    items: [],
    sources: [],
    query: '',
    debounce: 250,
    minQuery: 0,
    maxResults: 100,
    placeholder: 'Search applications and records',
    label: 'Launcher',
    emptyText: 'No results',
    loadingText: 'Searching…',
    shortcut: 'mod+k'
  };

  /**
   * Creates an owned launcher dialog or enhances an existing `<dialog>` target.
   * @param {HTMLDialogElement|string|null} [target=null] Dialog target, selector, or null.
   * @param {LauncherOptions} [options={}] Launcher options.
   */
  constructor(target = null, options = {}) {
    super(target, options);
  }

  /** @returns {HTMLDialogElement} */
  render() {
    if (this.el !== null && !(this.el instanceof HTMLDialogElement)) {
      throw new TypeError('Launcher target must be a <dialog> element');
    }
    this._createdRoot = this.el === null;
    const dialog = /** @type {HTMLDialogElement} */ (this.el ?? h('dialog'));
    this.el = dialog;
    this._original = this._createdRoot ? null : {
      attributes: Array.from(dialog.attributes, (attribute) => [attribute.name, attribute.value]),
      children: Array.from(dialog.childNodes)
    };
    this._items = normalizeItems(this.options.items);
    this._sources = normalizeSources(this.options.sources);
    this._sourceItems = new Map();
    this._query = String(this.options.query ?? '');
    this._results = [];
    this._active = -1;
    this._request = null;
    this._requestSequence = 0;
    this._queryTimer = null;
    this._busy = false;
    this._destroyed = false;

    const listId = uid('zx-launcher-results');
    const input = h('input', {
      ref: 'input',
      class: 'zx-launcher__input',
      type: 'search',
      role: 'combobox',
      autocomplete: 'off',
      spellcheck: false,
      ariaAutocomplete: 'list',
      ariaControls: listId,
      ariaExpanded: 'false',
      ariaLabel: this.options.label,
      placeholder: this.options.placeholder,
      value: this._query
    });
    const close = h('button', {
      ref: 'close',
      class: 'zx-icon-btn zx-launcher__close',
      type: 'button',
      ariaLabel: 'Close launcher'
    }, icon('x'));
    const status = h('div', {
      ref: 'status',
      class: 'zx-launcher__status',
      role: 'status',
      ariaLive: 'polite'
    });
    const results = h('div', {
      ref: 'results',
      class: 'zx-launcher__results',
      id: listId,
      role: 'listbox',
      ariaLabel: 'Launcher results'
    });
    dialog.setAttribute('aria-label', String(this.options.label));
    dialog.replaceChildren(
    h('div', { class: 'zx-launcher__surface' },
      h('div', { class: 'zx-launcher__search' }, icon('search'), input, close),
      status,
      results));
    dialog.dataset.state = 'closed';
    if (this._createdRoot) document.body.append(dialog);

    this.listen(input, 'input', () => {
      this._query = /** @type {HTMLInputElement} */ (input).value;
      this.emit('query', { query: this._query.trim() });
      this._refresh();
    });
    this.listen(input, 'keydown', (event) => this._onKeydown(/** @type {KeyboardEvent} */ (event)));
    this.listen(close, 'click', () => this.close());
    this.listen(results, 'click', (event) => {
      const option = /** @type {Element|null} */ (event.target)?.closest?.('[data-launcher-index]');
      if (!option || !results.contains(option)) return;
      this._activate(Number(option.getAttribute('data-launcher-index')), event);
    });
    this.listen(dialog, 'cancel', (event) => {
      event.preventDefault();
      this.close();
    });
    this.listen(dialog, 'close', () => {
      dialog.dataset.state = 'closed';
      input.setAttribute('aria-expanded', 'false');
      this._abortRequest();
      this.emit('close');
    });
    this.listen(document, 'keydown', (event) => this._onDocumentKeydown(/** @type {KeyboardEvent} */ (event)));
    this._renderResults();
    return dialog;
  }

  /** Opens the launcher and focuses/selects its query. @returns {this} @fires Launcher#open */
  open() {
    if (this.isOpen() || this._destroyed) return this;
    this.el.showModal();
    this.el.dataset.state = 'open';
    this.refs.input.setAttribute('aria-expanded', 'true');
    this._refresh();
    queueMicrotask(() => {
      if (!this.isOpen()) return;
      /** @type {HTMLInputElement} */ (this.refs.input).focus();
      /** @type {HTMLInputElement} */ (this.refs.input).select();
    });
    this.emit('open');
    return this;
  }

  /** Closes the launcher. @returns {this} */
  close() {
    if (this.isOpen()) this.el.close();
    return this;
  }

  /** Toggles the launcher. @returns {this} */
  toggle() {
    return this.isOpen() ? this.close() : this.open();
  }

  /** Reports whether the launcher is open. @returns {boolean} */
  isOpen() {
    return Boolean(this.el.open);
  }

  /** Focuses and selects the query field. @returns {this} */
  focus() {
    /** @type {HTMLInputElement} */ (this.refs.input).focus();
    /** @type {HTMLInputElement} */ (this.refs.input).select();
    return this;
  }

  /** Replaces the query and refreshes local and remote results. @param {string} query @returns {this} */
  setQuery(query) {
    this._query = String(query ?? '');
    /** @type {HTMLInputElement} */ (this.refs.input).value = this._query;
    this.emit('query', { query: this._query.trim() });
    this._refresh();
    return this;
  }

  /** Returns the untrimmed query. @returns {string} */
  getQuery() {
    return this._query;
  }

  /** Replaces local catalogue items. @param {LauncherItem[]} items @returns {this} */
  setItems(items) {
    this._items = normalizeItems(items);
    this._renderResults();
    return this;
  }

  /** Replaces asynchronous sources and aborts work from the old set. @param {LauncherSource[]} sources @returns {this} */
  setSources(sources) {
    this._abortRequest();
    this._sources = normalizeSources(sources);
    this._sourceItems.clear();
    this._refresh();
    return this;
  }

  /** Aborts sources and removes the owned dialog. @returns {void} */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    const original = this._original;
    this._abortRequest();
    if (this.isOpen()) this.el.close();
    super.destroy();
    if (!this._createdRoot && original) {
      for (const attribute of Array.from(this.el.attributes)) this.el.removeAttribute(attribute.name);
      for (const [name, value] of original.attributes) this.el.setAttribute(name, value);
      this.el.replaceChildren(...original.children);
    }
  }

  /** @returns {void} */
  _refresh() {
    this._sourceItems.clear();
    this._renderResults();
    this._abortRequest();
    if (this._sources.length === 0) return;
    const delay = Math.max(0, Number(this.options.debounce) || 0);
    this._queryTimer = setTimeout(() => this._loadSources(), delay);
  }

  /** @returns {Promise<void>} */
  async _loadSources() {
    this._queryTimer = null;
    const query = this._query.trim();
    const sources = this._sources.filter((source) =>
      query.length >= Math.max(Number(this.options.minQuery) || 0, Number(source.minQuery) || 0));
    if (sources.length === 0) return;
    const request = new AbortController();
    const sequence = ++this._requestSequence;
    this._request = request;
    this._setBusy(true);
    await Promise.all(sources.map(async (source) => {
      try {
        const loaded = await source.load(query, { signal: request.signal });
        if (request.signal.aborted || sequence !== this._requestSequence) return;
        this._sourceItems.set(source.id, normalizeItems(loaded).map((item) => ({ ...item, _source: source.id,
          group: item.group ?? source.label ?? '' })));
        this._renderResults();
      } catch (error) {
        if (request.signal.aborted || sequence !== this._requestSequence) return;
        this.emit('error', { source, error });
      }
    }));
    if (request.signal.aborted || sequence !== this._requestSequence) return;
    this._request = null;
    this._setBusy(false);
  }

  /** @param {boolean} busy @returns {void} */
  _setBusy(busy) {
    this._busy = busy;
    this.el.setAttribute('aria-busy', String(busy));
    this._renderStatus();
  }

  /** @returns {void} */
  _abortRequest() {
    if (this._queryTimer !== null) clearTimeout(this._queryTimer);
    this._queryTimer = null;
    this._request?.abort();
    this._request = null;
    this._requestSequence += 1;
    if (this._busy) this._setBusy(false);
  }

  /** @returns {void} */
  _renderResults() {
    const remote = orderedLauncherSourceItems(this._sources, this._sourceItems);
    const seen = new Set();
    const combined = [...this._items.map((item) => ({ ...item, _source: null })), ...remote]
      .filter((item) => {
        const key = String(item.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const ranked = rankLauncherItems(combined, this._query, this.options.maxResults);
    const groups = new Map();
    for (const item of ranked) {
      const group = String(item.group ?? '');
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(item);
    }
    // Grouping changes visual order, so it must also become keyboard order. Keeping the original
    // ranked indices made ArrowDown jump past an intervening option whenever groups interleaved.
    this._results = [...groups.values()].flat();
    this._active = this._results.findIndex((item) => !item.disabled);
    const nodes = [];
    let index = 0;
    for (const [group, items] of groups) {
      const options = items.map((item) => this._option(item, index++));
      if (group) nodes.push(h('div', {
        class: 'zx-launcher__group',
        role: 'group',
        ariaLabel: group
      }, h('div', { class: 'zx-launcher__group-label', ariaHidden: 'true' }, group), options));
      else nodes.push(...options);
    }
    this.refs.results.replaceChildren(...nodes);
    this._syncActive();
    this._renderStatus();
  }

  /** @param {RankedLauncherItem} item @param {number} index @returns {HTMLElement} */
  _option(item, index) {
    const tag = item.href ? 'a' : 'button';
    const children = [];
    if (item.icon) children.push(h('span', { class: 'zx-launcher__icon' }, icon(item.icon)));
    children.push(h('span', { class: 'zx-launcher__copy' },
      h('span', { class: 'zx-launcher__label' }, item.label),
      item.description ? h('span', { class: 'zx-launcher__description' }, item.description) : null));
    if (item.badge != null) children.push(h('span', { class: 'zx-launcher__badge' }, String(item.badge)));
    return /** @type {HTMLElement} */ (h(tag, {
      class: 'zx-launcher__option',
      type: tag === 'button' ? 'button' : null,
      href: item.href ?? null,
      target: item.target ?? null,
      role: 'option',
      id: uid('zx-launcher-option'),
      tabIndex: -1,
      ariaSelected: 'false',
      ariaDisabled: item.disabled ? 'true' : null,
      dataset: { launcherIndex: index, pinned: item.pinned ? 'true' : null }
    }, children));
  }

  /** @returns {void} */
  _renderStatus() {
    if (this._busy) this.refs.status.textContent = String(this.options.loadingText);
    else if (this._results.length === 0) this.refs.status.textContent = String(this.options.emptyText);
    else this.refs.status.textContent = '';
    this.refs.status.hidden = !this.refs.status.textContent;
  }

  /** @returns {void} */
  _syncActive() {
    const options = [...this.refs.results.querySelectorAll('[data-launcher-index]')];
    for (const option of options) {
      const selected = Number(option.getAttribute('data-launcher-index')) === this._active;
      option.setAttribute('aria-selected', String(selected));
    }
    const active = options.find((option) => Number(option.getAttribute('data-launcher-index')) === this._active);
    if (active) this.refs.input.setAttribute('aria-activedescendant', active.id);
    else this.refs.input.removeAttribute('aria-activedescendant');
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onKeydown(event) {
    if (event.key === 'Escape') {
      this.close();
      return;
    }
    if (event.key === 'Enter') {
      if (this._active < 0) return;
      event.preventDefault();
      const option = this.refs.results.querySelector(`[data-launcher-index="${this._active}"]`);
      option?.click();
      return;
    }
    const enabled = this._results.map((item, index) => item.disabled ? -1 : index).filter((index) => index >= 0);
    if (enabled.length === 0) return;
    let position = enabled.indexOf(this._active);
    if (event.key === 'Home' || event.key === 'PageUp') position = 0;
    else if (event.key === 'End' || event.key === 'PageDown') position = enabled.length - 1;
    else if (event.key === 'ArrowDown') position = (position + 1 + enabled.length) % enabled.length;
    else if (event.key === 'ArrowUp') position = (position - 1 + enabled.length) % enabled.length;
    else return;
    event.preventDefault();
    this._active = enabled[position];
    this._syncActive();
    this.refs.results.querySelector(`[data-launcher-index="${this._active}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  /** @param {number} index @param {Event} event @returns {void} */
  _activate(index, event) {
    const item = this._results[index];
    if (!item || item.disabled) {
      event.preventDefault();
      return;
    }
    const selected = this.emit('select', {
      item,
      value: item.value ?? item.id,
      source: item._source ?? null,
      query: this._query.trim()
    });
    if (selected.defaultPrevented) {
      event.preventDefault();
      return;
    }
    if (!item.href) {
      event.preventDefault();
      item.invoke?.();
    }
    this.close();
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onDocumentKeydown(event) {
    if (this.options.shortcut !== 'mod+k' || event.isComposing || event.key.toLowerCase() !== 'k'
      || (!event.metaKey && !event.ctrlKey) || event.altKey) return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      || (active instanceof HTMLElement && active.isContentEditable)) return;
    const modal = document.querySelector('dialog:modal');
    if (modal && modal !== this.el) return;
    event.preventDefault();
    this.open();
  }
}

/**
 * Ranks launcher items using the current ZeyOS application tiers.
 * @param {RankedLauncherItem[]} items Items to rank.
 * @param {string} query Query.
 * @param {number} [limit=100] Maximum returned items.
 * @returns {RankedLauncherItem[]}
 */
export function rankLauncherItems(items, query, limit = 100) {
  const needle = searchable(query).trim();
  const ranked = items.map((item, order) => ({ item, order, score: launcherScore(item, needle) }))
    .filter(({ score }) => score < Infinity);
  ranked.sort((a, b) => {
    if (needle === '') {
      const aPinned = pinOrder(a.item.pinned, a.order);
      const bPinned = pinOrder(b.item.pinned, b.order);
      if (aPinned !== bPinned) return aPinned - bPinned;
    }
    return a.score - b.score || compareLauncherText(a.item.label, b.item.label) || a.order - b.order;
  });
  const maximum = Math.max(0, Number(limit) || 0);
  return ranked.slice(0, maximum || 0).map(({ item, score }) => ({ ...item, _score: score }));
}

/** @param {RankedLauncherItem} item @param {string} needle @returns {number} */
function launcherScore(item, needle) {
  if (!needle) return item.pinned ? -1 : 0;
  const label = searchable(item.label);
  const identifier = searchable(item.id);
  const keywords = searchable(Array.isArray(item.keywords) ? item.keywords.join(' ') : item.keywords ?? '');
  if (label === needle) return 0;
  if (label.startsWith(needle)) return 10;
  if (label.split(/[^\p{L}\p{N}]+/u).some((word) => word.startsWith(needle))) return 20;
  if (label.includes(needle) || keywords.includes(needle)) return 30;
  if (identifier.includes(needle)) return 40;
  const acronym = label.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map((word) => word[0]).join('');
  if (acronym.startsWith(needle)) return 50;
  return Infinity;
}

/** @param {boolean|number|undefined} pinned @param {number} order @returns {number} */
function pinOrder(pinned, order) {
  if (typeof pinned === 'number' && Number.isFinite(pinned)) return pinned;
  if (pinned) return order;
  return Number.MAX_SAFE_INTEGER;
}

/** @param {unknown} value @returns {string} */
function searchable(value) {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Locale-independent ordering for equally ranked labels. @param {unknown} left @param {unknown} right @returns {number} */
function compareLauncherText(left, right) {
  const a = searchable(left);
  const b = searchable(right);
  if (a < b) return -1;
  if (a > b) return 1;
  const rawA = String(left ?? '').normalize('NFC');
  const rawB = String(right ?? '').normalize('NFC');
  return rawA < rawB ? -1 : rawA > rawB ? 1 : 0;
}

/** @param {unknown} items @returns {LauncherItem[]} */
function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item && typeof item === 'object' && item.id != null && item.label != null)
    .map((item) => ({ ...item, label: String(item.label) }));
}

/** @param {unknown} sources @returns {LauncherSource[]} */
function normalizeSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources.filter((source) => source && typeof source === 'object'
    && source.id != null && typeof source.load === 'function')
    .map((source) => ({ ...source, id: String(source.id) }));
}

/**
 * Flattens loaded source results in configured source order rather than response-completion order.
 * @param {LauncherSource[]} sources Configured sources.
 * @param {Map<string, RankedLauncherItem[]>} sourceItems Loaded result map.
 * @returns {RankedLauncherItem[]}
 */
export function orderedLauncherSourceItems(sources, sourceItems) {
  return sources.flatMap((source) => sourceItems.get(String(source.id)) ?? []);
}

/** Fired when a result is activated. @event Launcher#select @type {CustomEvent<LauncherSelectDetail>} */
/** Fired when the query changes. @event Launcher#query @type {CustomEvent<{query: string}>} */
/** Fired after the dialog opens. @event Launcher#open @type {CustomEvent<Record<string, never>>} */
/** Fired after the dialog closes. @event Launcher#close @type {CustomEvent<Record<string, never>>} */
/** Fired when one asynchronous source fails. @event Launcher#error @type {CustomEvent<{source: LauncherSource, error: unknown}>} */
