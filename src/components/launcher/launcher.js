import { Component } from '../../core/component.js';
import { h, safeHref } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { overlayHost } from '../../core/overlay-host.js';
import { uid } from '../../core/util.js';

/**
 * @typedef {Object} LauncherItem
 * @property {string|number} id Stable item identifier.
 * @property {string} label Visible label.
 * @property {string} [description] Secondary text.
 * @property {string|string[]} [keywords] Additional search text.
 * @property {string} [group] Result group.
 * @property {string|Node|((item: LauncherItem) => Node|null)} [icon] Decorative icon name, node, or factory.
 * @property {string|number} [badge] Compact metadata.
 * @property {'application'|'record'|'action'} [kind='action'] Tile or row presentation.
 * @property {boolean} [current=false] Whether this is the current application or destination.
 * @property {'always'|'empty'|'query'} [when='always'] Query state in which the item is visible.
 * @property {number} [groupOrder] Explicit group order.
 * @property {number} [itemOrder] Stable order within equally ranked results.
 * @property {unknown} [value] Emitted value; defaults to `id`.
 * @property {string} [href] Native link target; executable/data schemes are disabled.
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
 * @property {'always'|'empty'|'query'} [when='always'] Query state in which the source runs.
 * @property {'rank'|'source'} [order='rank'] Whether Zx ranks results or preserves source order.
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
 * @property {string} [closeLabel='Close launcher'] Close-button accessible label.
 * @property {string} [resultsLabel='Launcher results'] Results-region accessible label.
 * @property {string} [emptyText='No results'] Empty-state text.
 * @property {string} [loadingText='Searching…'] Loading-state text.
 * @property {'mod+k'|false} [shortcut='mod+k'] Optional global keyboard shortcut.
 * @property {false|{move?: string, open?: string, close?: string}} [hints] Visible keyboard hints, or false.
 * @property {Element|string|null} [scope=null] Element whose nearest Zx theme scope owns an internally created launcher; defaults to the opener.
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
    closeLabel: 'Close launcher',
    resultsLabel: 'Launcher results',
    emptyText: 'No results',
    loadingText: 'Searching…',
    shortcut: 'mod+k',
    hints: { move: 'Move', open: 'Open', close: 'Close' },
    scope: null
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
    this._renderedQuery = null;
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
      ariaLabel: this.options.closeLabel
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
      ariaLabel: this.options.resultsLabel
    });
    const shortcut = this.options.shortcut === 'mod+k' ? h('kbd', {
      class: 'zx-launcher__shortcut',
      ariaHidden: 'true'
    }, launcherShortcutLabel()) : null;
    const footer = launcherHints(this.options.hints);
    dialog.setAttribute('aria-label', String(this.options.label));
    dialog.replaceChildren(
    h('div', { class: 'zx-launcher__surface' },
      h('div', {
        class: 'zx-launcher__search',
        dataset: { shortcut: shortcut ? 'true' : 'false' }
      }, icon('search'), input, shortcut, close),
      status,
      results,
      footer));
    dialog.dataset.state = 'closed';
    if (this._createdRoot) overlayHost(this.options.scope).append(dialog);

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
    this.listen(results, 'pointermove', (event) => {
      const option = /** @type {Element|null} */ (event.target)?.closest?.('[data-launcher-index]');
      if (!option || !results.contains(option)) return;
      const index = Number(option.getAttribute('data-launcher-index'));
      if (!Number.isInteger(index) || this._results[index]?.disabled || index === this._active) return;
      this._active = index;
      this._syncActive();
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
    if (this._createdRoot) {
      const host = overlayHost(this.options.scope);
      if (this.el.parentElement !== host) host.append(this.el);
    }
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

  /** Marks one local item as the current destination. @param {string|number|null} id Item id. @returns {this} */
  setCurrent(id) {
    const key = id == null ? null : String(id);
    this._items = this._items.map((item) => ({ ...item, current: key !== null && String(item.id) === key }));
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
    const sources = this._sources.filter((source) => visibleForQuery(source.when, query)
      && query.length >= Math.max(Number(this.options.minQuery) || 0, Number(source.minQuery) || 0));
    if (sources.length === 0) return;
    const request = new AbortController();
    const sequence = ++this._requestSequence;
    this._request = request;
    this._setBusy(true);
    await Promise.all(sources.map(async (source) => {
      try {
        const loaded = await source.load(query, { signal: request.signal });
        if (request.signal.aborted || sequence !== this._requestSequence) return;
        this._sourceItems.set(source.id, normalizeItems(loaded).map((item, itemOrder) => ({
          ...item,
          _source: source.id,
          _sourceOrder: source.order === 'source',
          group: item.group ?? source.label ?? '',
          itemOrder: item.itemOrder ?? (source.order === 'source' ? itemOrder : undefined)
        })));
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
    const queryKey = this._query;
    const activeId = this._renderedQuery === queryKey && this._active >= 0 && this._results[this._active]
      ? String(this._results[this._active].id) : null;
    const query = this._query.trim();
    const local = this._items.filter((item) => visibleForQuery(item.when, query));
    const rankedLocal = rankLauncherItems(local, query, this.options.maxResults);
    const remote = this._sources.flatMap((source) => {
      const loaded = this._sourceItems.get(String(source.id)) ?? [];
      return source.order === 'source'
        ? loaded.filter((item) => visibleForQuery(item.when, query))
        : rankLauncherItems(loaded.filter((item) => visibleForQuery(item.when, query)),
          query, this.options.maxResults);
    });
    const seen = new Set();
    const combined = [...rankedLocal.map((item) => ({ ...item, _source: null })), ...remote]
      .filter((item) => {
        const key = String(item.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, Math.max(0, Number(this.options.maxResults) || 0));
    const groups = new Map();
    for (const item of combined) {
      const group = String(item.group ?? '');
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(item);
    }
    // Grouping changes visual order, so it must also become keyboard order. Keeping the original
    // ranked indices made ArrowDown jump past an intervening option whenever groups interleaved.
    this._results = [...groups.values()].flat();
    this._renderedQuery = queryKey;
    const preserved = activeId === null ? -1
      : this._results.findIndex((item) => !item.disabled && String(item.id) === activeId);
    this._active = preserved >= 0 ? preserved : this._results.findIndex((item) => !item.disabled);
    const nodes = [];
    let index = 0;
    for (const [group, items] of groups) {
      const options = items.map((item) => this._option(item, index++));
      if (group) nodes.push(h('div', {
        class: 'zx-launcher__group',
        role: 'group',
        ariaLabel: group,
        dataset: { layout: items.every((item) => item.kind === 'application') ? 'grid' : 'list' }
      }, h('div', { class: 'zx-launcher__group-label', ariaHidden: 'true' }, group), options));
      else nodes.push(...options);
    }
    this.refs.results.replaceChildren(...nodes);
    this._syncActive();
    this._renderStatus();
  }

  /** @param {RankedLauncherItem} item @param {number} index @returns {HTMLElement} */
  _option(item, index) {
    const href = safeHref(item.href);
    const tag = href ? 'a' : 'button';
    const children = [];
    const visual = launcherItemIcon(item);
    if (visual) children.push(h('span', {
      class: 'zx-launcher__icon',
      ariaHidden: 'true'
    }, visual));
    children.push(h('span', { class: 'zx-launcher__copy' },
      h('span', { class: 'zx-launcher__label' }, item.label),
      item.description ? h('span', { class: 'zx-launcher__description' }, item.description) : null));
    if (item.badge != null) children.push(h('span', { class: 'zx-launcher__badge' }, String(item.badge)));
    return /** @type {HTMLElement} */ (h(tag, {
      class: 'zx-launcher__option',
      type: tag === 'button' ? 'button' : null,
      href,
      target: item.target ?? null,
      rel: tag === 'a' ? 'noopener' : null,
      role: 'option',
      id: uid('zx-launcher-option'),
      tabIndex: -1,
      ariaSelected: 'false',
      ariaDisabled: item.disabled ? 'true' : null,
      ariaCurrent: item.current ? 'page' : null,
      dataset: {
        launcherIndex: index,
        pinned: item.pinned !== undefined && item.pinned !== false ? 'true' : null,
        kind: normalizeLauncherKind(item.kind)
      }
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
    if (/^Arrow(?:Left|Right|Up|Down)$/.test(event.key)) {
      const next = this._spatialIndex(event.key, enabled);
      if (next !== null) {
        event.preventDefault();
        this._active = next;
        this._syncActive();
        this.refs.results.querySelector(`[data-launcher-index="${this._active}"]`)
          ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') return;
    }
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

  /** @param {string} direction @param {number[]} enabled @returns {number|null} */
  _spatialIndex(direction, enabled) {
    const current = this.refs.results.querySelector(`[data-launcher-index="${this._active}"]`);
    if (!(current instanceof HTMLElement)) return null;
    if ((direction === 'ArrowLeft' || direction === 'ArrowRight')
      && this._results[this._active]?.kind !== 'application') return null;
    const candidates = [...this.refs.results.querySelectorAll('[data-launcher-index]')]
      .filter((option) => enabled.includes(Number(option.getAttribute('data-launcher-index')))
        && (direction !== 'ArrowLeft' && direction !== 'ArrowRight'
          || option.getAttribute('data-kind') === 'application'));
    const next = findSpatialLauncherOption(candidates, current, direction);
    return next ? Number(next.getAttribute('data-launcher-index')) : null;
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
      || Number(event.metaKey) + Number(event.ctrlKey) !== 1 || event.altKey || event.shiftKey) return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      || active instanceof HTMLSelectElement
      || (active instanceof HTMLElement && active.isContentEditable)) return;
    const modal = document.querySelector('dialog:modal');
    if (modal && modal !== this.el) return;
    event.preventDefault();
    this.open();
  }
}

/** @returns {string} */
function launcherShortcutLabel() {
  const platform = String((/** @type {any} */ (navigator)).userAgentData?.platform
    ?? navigator.platform ?? '');
  return /mac|iphone|ipad/i.test(platform) ? '⌘ K' : 'Ctrl K';
}

/** @param {LauncherOptions['hints']} hints @returns {HTMLElement|null} */
function launcherHints(hints) {
  if (hints === false) return null;
  const labels = hints && typeof hints === 'object' ? hints : {};
  return h('footer', { class: 'zx-launcher__hints', ariaHidden: 'true' },
    h('span', {}, h('kbd', {}, '↑↓←→'), labels.move ?? 'Move'),
    h('span', {}, h('kbd', {}, '↵'), labels.open ?? 'Open'),
    h('span', {}, h('kbd', {}, 'Esc'), labels.close ?? 'Close'));
}

/** @param {LauncherItem} item @returns {Node|null} */
function launcherItemIcon(item) {
  let visual = item.icon;
  if (typeof visual === 'function') visual = visual(item);
  if (typeof visual === 'string') return icon(visual);
  if (visual instanceof Node) return visual.cloneNode(true);
  if (visual && typeof visual === 'object'
    && typeof (/** @type {any} */ (visual)).toElement === 'function') {
    const element = (/** @type {any} */ (visual)).toElement();
    return element instanceof Node ? element.cloneNode(true) : null;
  }
  return null;
}

/** @param {unknown} kind @returns {'application'|'record'|'action'} */
function normalizeLauncherKind(kind) {
  return kind === 'application' || kind === 'record' ? kind : 'action';
}

/** @param {unknown} when @param {string} query @returns {boolean} */
function visibleForQuery(when, query) {
  if (when === 'empty') return query === '';
  if (when === 'query') return query !== '';
  return true;
}

/**
 * Finds the nearest launcher option in a visual direction. Horizontal movement is constrained by
 * the caller to application tiles; vertical movement may cross from the app grid into row groups.
 * @param {Element[]} options Candidate options.
 * @param {HTMLElement} current Active option.
 * @param {string} direction Arrow key.
 * @returns {Element|null}
 */
function findSpatialLauncherOption(options, current, direction) {
  const origin = current.getBoundingClientRect();
  if (origin.width === 0 && origin.height === 0) return null;
  const originX = origin.left + origin.width / 2;
  const originY = origin.top + origin.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const option of options) {
    if (option === current) continue;
    const rect = option.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - originX;
    const dy = rect.top + rect.height / 2 - originY;
    let valid = false;
    let score = Infinity;
    if (direction === 'ArrowLeft') {
      valid = dx < -2 && Math.abs(dy) < Math.max(origin.height, rect.height) / 2;
      score = Math.abs(dx) + Math.abs(dy) * 4;
    } else if (direction === 'ArrowRight') {
      valid = dx > 2 && Math.abs(dy) < Math.max(origin.height, rect.height) / 2;
      score = Math.abs(dx) + Math.abs(dy) * 4;
    } else if (direction === 'ArrowUp') {
      valid = dy < -2;
      score = Math.abs(dy) * 10 + Math.abs(dx);
    } else if (direction === 'ArrowDown') {
      valid = dy > 2;
      score = Math.abs(dy) * 10 + Math.abs(dx);
    }
    if (valid && score < bestScore) {
      best = option;
      bestScore = score;
    }
  }
  return best;
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
    const aGroup = finiteOrder(a.item.groupOrder);
    const bGroup = finiteOrder(b.item.groupOrder);
    if (aGroup !== bGroup) return aGroup - bGroup;
    if (needle === '') {
      const aPinned = pinOrder(a.item.pinned, a.order);
      const bPinned = pinOrder(b.item.pinned, b.order);
      if (aPinned !== bPinned) return aPinned - bPinned;
    }
    return a.score - b.score
      || finiteOrder(a.item.itemOrder) - finiteOrder(b.item.itemOrder)
      || compareLauncherText(a.item.label, b.item.label)
      || a.order - b.order;
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

/** @param {unknown} value @returns {number} */
function finiteOrder(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
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
    .map((item) => normalizeLauncherItem(item));
}

/** @param {Record<string, any>} item @returns {LauncherItem} */
function normalizeLauncherItem(item) {
  const normalized = { ...item, label: String(item.label) };
  if (item.href == null) return normalized;
  const href = safeHref(item.href);
  if (href !== null) normalized.href = href;
  else {
    delete normalized.href;
    if (typeof normalized.invoke !== 'function') normalized.disabled = true;
  }
  return normalized;
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
