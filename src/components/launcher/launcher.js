import { Component } from '../../core/component.js';
import { h, safeHref } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { printf } from '../../core/i18n.js';
import { connectedOverlayHost, overlayHost } from '../../core/overlay-host.js';
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
 * @property {string|number} [hint] Muted text at the end of the row, such as a current value or a project.
 * @property {string|string[]|{label: string|string[], keys?: string}} [shortcut] Key labels drawn as
 *   key caps (`['⌘', 'K']`), or Button's `{label, keys}` shape. Display only: the Launcher binds nothing.
 * @property {string} [keys] The same shortcut in `aria-keyshortcuts` syntax (`'Meta+K'`), exposed on
 *   the option for assistive technology.
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
 * @property {LauncherItem[]|LauncherPageLoader} [items] Child items. An item with `items` opens them
 *   as a page instead of being selected: an array, or a loader called with the page's query.
 * @property {string} [placeholder] Search-field placeholder while this item's page is open.
 * @property {'rank'|'source'} [order='rank'] For a page whose `items` is a loader: whether Zx ranks
 *   the loaded items by the query, or keeps the loader's order.
 */
/**
 * Loads a page's items for its current query. It runs when the page opens and again, debounced, as
 * the query changes; a newer query aborts `signal`.
 * @typedef {(query: string, context: {signal: AbortSignal}) => LauncherItem[]|Promise<LauncherItem[]>} LauncherPageLoader
 */
/**
 * @typedef {Object} LauncherOpenOptions
 * @property {string|number|LauncherItem} [page] Opens straight into a page: the id of a local item
 *   with `items` (at any depth of array pages, whose path becomes the back stack), or a page item.
 */
/**
 * @typedef {Object} LauncherPageDetail
 * @property {LauncherItem|null} page The page now shown; null on the root.
 * @property {LauncherItem[]} path Every open page from the root down, the shown one last.
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
 * @property {string} [placeholder] Search-field placeholder. Omitted resolves `launcher.placeholder`, English `Search applications and records`.
 * @property {string} [label] Dialog and field label. Omitted resolves `launcher.label`, English `Launcher`.
 * @property {string} [closeLabel] Close-button accessible label. Omitted resolves `launcher.close`, English `Close launcher`.
 * @property {string} [resultsLabel] Results-region accessible label. Omitted resolves `launcher.results`, English `Launcher results`.
 * @property {string} [emptyText] Empty-state text. Omitted resolves `launcher.empty`, English `No results`.
 * @property {string} [loadingText] Loading-state text. Omitted resolves `launcher.loading`, English `Searching…`.
 * @property {'mod+k'|false} [shortcut='mod+k'] Optional global keyboard shortcut.
 * @property {false|{move?: string, open?: string, back?: string, close?: string}} [hints] Visible keyboard hints, or false.
 * @property {Element|string|null} [scope=null] Element whose nearest Zx theme scope owns an internally created launcher; defaults to the opener.
 * @property {(event: CustomEvent<LauncherSelectDetail>) => void} [onselect] Preventable selection listener.
 * @property {(event: CustomEvent<{query: string}>) => void} [onquery] Query-change listener.
 * @property {(event: CustomEvent<LauncherPageDetail>) => void} [onpage] Page-navigation listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onclose] Close listener.
 * @property {(event: CustomEvent<LauncherErrorDetail>) => void} [onerror] Source error listener.
 */
/**
 * A selection. `page` is the page the item was chosen on, null on the root.
 * @typedef {{item: LauncherItem, value: unknown, source: string|null, query: string, page: LauncherItem|null}} LauncherSelectDetail
 */
/**
 * A failed load. A page loader reports as a source whose id is `page:<page id>`, with `page` set.
 * @typedef {{source: LauncherSource, error: unknown, page: LauncherItem|null}} LauncherErrorDetail
 */
/** @typedef {LauncherItem & {_source?: string|null, _score?: number}} RankedLauncherItem */
/** @typedef {LauncherSource & {_page?: boolean}} LevelSource */
/**
 * One open page and the level beneath it, kept so going back restores that level as it was.
 * @typedef {Object} LauncherPageEntry
 * @property {LauncherItem} page The page item.
 * @property {LauncherItem[]} items Its normalized local items (an array page).
 * @property {LevelSource[]} sources Its loader as a source (a loader page).
 * @property {{query: string, activeId: string|null, sourceItems: Map<string, RankedLauncherItem[]>|null}} parent
 *   The level beneath: its query, its highlighted option, and its loaded results when they were complete.
 */

/**
 * Abortable command/search dialog that emits application-owned actions without routing itself.
 * Items with `items` open nested pages: an APG combobox whose listbox shows one page at a time.
 * @fires Launcher#select
 * @fires Launcher#query
 * @fires Launcher#page
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
    /*
     * The six labels default to null rather than to their English text so that an application
     * which installs a translator and passes no labels still gets a translated launcher. The
     * documented default is what `_message()` falls back to, so an untranslated application
     * renders exactly the same words as before.
     */
    placeholder: null,
    label: null,
    closeLabel: null,
    resultsLabel: null,
    emptyText: null,
    loadingText: null,
    shortcut: 'mod+k',
    hints: null,
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
    // Whether the current level's sources finished loading for its query: only complete results
    // are worth keeping for the way back from a page.
    this._settled = true;
    /** @type {LauncherPageEntry[]} */
    this._pages = [];
    this._restoreActiveId = null;
    this._announcePending = false;
    this._announceToggle = false;
    this._destroyed = false;

    const listId = uid('zx-launcher-results');
    const label = String(this.options.label ?? this._message('launcher.label', 'Launcher'));
    const placeholder = String(this.options.placeholder
      ?? this._message('launcher.placeholder', 'Search applications and records'));
    this._label = label;
    this._placeholder = placeholder;
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
      ariaLabel: label,
      placeholder,
      value: this._query
    });
    // The page you are on, before the query. Its × is one step back, like Backspace on an empty
    // query; the label is also part of the combobox's accessible name (see `_syncPage()`).
    const scopeBack = h('button', {
      ref: 'scopeBack',
      class: 'zx-icon-btn zx-launcher__scope-back',
      type: 'button'
    }, icon('x'));
    const scope = h('span', { ref: 'scope', class: 'zx-launcher__scope', hidden: true },
      h('span', { ref: 'scopeLabel', class: 'zx-launcher__scope-label' }), scopeBack);
    const close = h('button', {
      ref: 'close',
      class: 'zx-icon-btn zx-launcher__close',
      type: 'button',
      ariaLabel: this.options.closeLabel ?? this._message('launcher.close', 'Close launcher')
    }, icon('x'));
    const status = h('div', {
      ref: 'status',
      class: 'zx-launcher__status',
      role: 'status',
      ariaLive: 'polite'
    });
    // Says where a page change landed ("Agents, 7 results"). Kept apart from the visible status,
    // which only ever shows the loading and empty states.
    const announce = h('div', {
      ref: 'announce',
      class: 'zx-launcher__announce',
      role: 'status',
      ariaLive: 'polite',
      ariaAtomic: 'true'
    });
    const results = h('div', {
      ref: 'results',
      class: 'zx-launcher__results',
      id: listId,
      role: 'listbox',
      ariaLabel: this.options.resultsLabel ?? this._message('launcher.results', 'Launcher results')
    });
    const shortcut = this.options.shortcut === 'mod+k' ? h('kbd', {
      class: 'zx-launcher__shortcut',
      ariaHidden: 'true'
    }, launcherShortcutLabel()) : null;
    const footer = launcherHints(this.options.hints, {
      move: this._message('launcher.hintMove', 'Move'),
      open: this._message('launcher.hintOpen', 'Open'),
      back: this._message('launcher.hintBack', 'Back'),
      close: this._message('launcher.hintClose', 'Close')
    });
    dialog.setAttribute('aria-label', label);
    dialog.replaceChildren(
    h('div', { class: 'zx-launcher__surface' },
      h('div', {
        class: 'zx-launcher__search',
        dataset: { shortcut: shortcut ? 'true' : 'false' }
      }, icon('search'), scope, input, shortcut, close),
      status,
      results,
      footer,
      announce));
    dialog.dataset.state = 'closed';
    // A scope that is not in the document yet cannot say which themed region owns the dialog; it
    // stays detached until open() hosts it.
    if (this._createdRoot) connectedOverlayHost(this.options.scope)?.append(dialog);

    this.listen(input, 'input', () => {
      this._query = /** @type {HTMLInputElement} */ (input).value;
      // Typing answers a page change before its results do; the empty state speaks for itself.
      this._announcePending = false;
      this.emit('query', { query: this._query.trim() });
      this._refresh();
    });
    this.listen(input, 'keydown', (event) => this._onKeydown(/** @type {KeyboardEvent} */ (event)));
    this.listen(scopeBack, 'click', () => {
      this.back();
      /** @type {HTMLInputElement} */ (input).focus();
    });
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
      // The next opening starts on the root, so an application that sets the query or the items
      // before opening sets them on the level that will show. Reopened in the meantime, the
      // launcher keeps the page it was opened on.
      if (this._pages.length && !dialog.open) {
        this._unwind();
        this._announcePending = false;
        this._syncPage();
        this._renderResults();
        this._emitPage();
      }
      this.emit('close');
    });
    this.listen(document, 'keydown', (event) => this._onDocumentKeydown(/** @type {KeyboardEvent} */ (event)));
    this._renderResults();
    return dialog;
  }

  /**
   * Opens the launcher and focuses/selects its query. It opens on the root unless `page` names one;
   * already open, `page` navigates there.
   * @param {LauncherOpenOptions} [options={}] Open options.
   * @returns {this}
   * @fires Launcher#open
   * @fires Launcher#page
   */
  open(options = {}) {
    if (this._destroyed) return this;
    const target = options && typeof options === 'object' ? options.page : undefined;
    if (this.isOpen()) {
      const path = target == null ? [] : this._pagePath(target);
      if (path.length) this._goTo(path);
      return this;
    }
    if (this._createdRoot) {
      const host = overlayHost(this.options.scope);
      if (this.el.parentElement !== host) host.append(this.el);
    }
    const before = this._pages.map((entry) => entry.page);
    this.el.showModal();
    this.el.dataset.state = 'open';
    this.refs.input.setAttribute('aria-expanded', 'true');
    this._goTo(target == null ? [] : this._pagePath(target), { emit: false });
    queueMicrotask(() => {
      if (!this.isOpen()) return;
      /** @type {HTMLInputElement} */ (this.refs.input).focus();
      /** @type {HTMLInputElement} */ (this.refs.input).select();
    });
    this.emit('open');
    if (!samePath(before, this._pages.map((entry) => entry.page))) this._emitPage();
    return this;
  }

  /**
   * Goes back one page, restoring the level beneath with its query and highlighted option. Does
   * nothing on the root.
   * @returns {this}
   * @fires Launcher#page
   */
  back() {
    if (!this._pages.length) return this;
    const settled = this._popPage();
    this._syncPage();
    this._announcePending = this.isOpen();
    if (settled) this._renderResults();
    else this._refresh(true);
    this._emitPage();
    return this;
  }

  /** Returns the page shown, or null on the root. @returns {LauncherItem|null} */
  getPage() {
    return this._pages.at(-1)?.page ?? null;
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
    this._announcePending = false;
    this.emit('query', { query: this._query.trim() });
    this._refresh();
    return this;
  }

  /** Returns the untrimmed query. @returns {string} */
  getQuery() {
    return this._query;
  }

  /** Replaces the root's local catalogue items; an open page keeps its own. @param {LauncherItem[]} items @returns {this} */
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

  /** Replaces the root's asynchronous sources and aborts work from the old set; on a page they load once the root is back. @param {LauncherSource[]} sources @returns {this} */
  setSources(sources) {
    this._sources = normalizeSources(sources);
    // The sources belong to the root. On a page they wait: the root reloads when it is back.
    if (this._pages.length) {
      this._pages[0].parent.sourceItems = null;
      return this;
    }
    this._abortRequest();
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

  /**
   * Re-renders the current level and reloads its sources: debounced while typing, at once when a
   * page opens (so its loading state shows instead of a passing "No results").
   * @param {boolean} [immediate=false] Load without the debounce.
   * @returns {void}
   */
  _refresh(immediate = false) {
    this._abortRequest();
    this._sourceItems.clear();
    const { sources } = this._level();
    this._settled = sources.length === 0;
    if (immediate && sources.length) void this._loadSources();
    this._renderResults();
    if (immediate || sources.length === 0) return;
    const delay = Math.max(0, Number(this.options.debounce) || 0);
    this._queryTimer = setTimeout(() => this._loadSources(), delay);
  }

  /** @returns {Promise<void>} */
  async _loadSources() {
    this._queryTimer = null;
    const query = this._query.trim();
    const page = this._pages?.at(-1)?.page ?? null;
    // A page's own loader is its content, so it runs on the empty query whatever `minQuery` says.
    const sources = this._level().sources.filter((source) => visibleForQuery(source.when, query)
      && query.length >= Math.max(source._page ? 0 : Number(this.options.minQuery) || 0,
        Number(source.minQuery) || 0));
    if (sources.length === 0) {
      this._settled = true;
      return;
    }
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
          _source: source._page ? null : source.id,
          _sourceOrder: source.order === 'source',
          group: item.group ?? source.label ?? '',
          itemOrder: item.itemOrder ?? (source.order === 'source' ? itemOrder : undefined)
        })));
        this._renderResults();
      } catch (error) {
        if (request.signal.aborted || sequence !== this._requestSequence) return;
        this.emit('error', { source, error, page });
      }
    }));
    if (request.signal.aborted || sequence !== this._requestSequence) return;
    this._request = null;
    this._settled = true;
    this._setBusy(false);
  }

  /**
   * The level on screen: the root's items and sources, or the open page's.
   * @returns {{items: LauncherItem[], sources: LevelSource[]}}
   */
  _level() {
    return this._pages?.at(-1) ?? { items: this._items, sources: this._sources };
  }

  /**
   * Opens a page on top of the current level: what the user activated, or ArrowRight on its row.
   * @param {LauncherItem} item Page item.
   * @returns {void}
   */
  _openPage(item) {
    this._pushPage(item);
    this._syncPage();
    this._announcePending = this.isOpen();
    this._refresh(true);
    this._emitPage();
  }

  /**
   * Replaces the whole stack with `path` (empty for the root) and refreshes what it lands on.
   * @param {LauncherItem[]} path Pages from the root down.
   * @param {{emit?: boolean}} [options={}] Whether to report a change through `page`.
   * @returns {void}
   */
  _goTo(path, { emit = true } = {}) {
    const before = this._pages.map((entry) => entry.page);
    this._unwind();
    if (path.length) {
      // The root's results may be from an earlier opening; the way back loads them afresh.
      this._abortRequest();
      this._sourceItems.clear();
      this._settled = false;
      for (const item of path) this._pushPage(item);
    }
    this._syncPage();
    this._announcePending = this.isOpen() && path.length > 0;
    this._refresh(path.length > 0);
    if (emit && !samePath(before, path)) this._emitPage();
  }

  /** Pops every page, restoring the root's query, without rendering. @returns {void} */
  _unwind() {
    while (this._pages.length) this._popPage();
  }

  /**
   * Pushes a page, remembering the level beneath, and clears the query for it.
   * @param {LauncherItem} item Page item.
   * @returns {void}
   */
  _pushPage(item) {
    const active = this._active >= 0 ? this._results[this._active] : null;
    this._pages.push({
      page: item,
      items: Array.isArray(item.items) ? normalizeItems(item.items) : [],
      sources: typeof item.items === 'function' ? [launcherPageSource(item)] : [],
      parent: {
        query: this._query,
        activeId: active ? String(active.id) : null,
        sourceItems: this._settled ? new Map(this._sourceItems) : null
      }
    });
    this._setInputQuery('');
  }

  /**
   * Pops the top page and restores the level beneath.
   * @returns {boolean} Whether that level's results came back complete (no reload needed).
   */
  _popPage() {
    const entry = this._pages.pop();
    if (!entry) return true;
    this._announcePending = false;
    this._abortRequest();
    const { parent } = entry;
    this._setInputQuery(parent.query);
    this._sourceItems = parent.sourceItems ? new Map(parent.sourceItems) : new Map();
    this._settled = parent.sourceItems !== null;
    this._restoreActiveId = parent.activeId;
    return this._settled;
  }

  /** @param {string} query @returns {void} */
  _setInputQuery(query) {
    this._query = query;
    /** @type {HTMLInputElement} */ (this.refs.input).value = query;
    // A different level: nothing highlighted on the old one carries over by accident of its id.
    this._renderedQuery = null;
  }

  /**
   * Shows the open page in the search row: the chip, the combobox name and placeholder, and the
   * footer's Back hint.
   * @returns {void}
   */
  _syncPage() {
    const page = this.getPage();
    const { input, scope, scopeLabel, scopeBack, backHint } = this.refs;
    /** @type {HTMLElement} */ (scope).hidden = page === null;
    if (backHint) /** @type {HTMLElement} */ (backHint).hidden = page === null;
    this.el.toggleAttribute('data-page', page !== null);
    if (page === null) {
      input.setAttribute('aria-label', this._label);
      input.setAttribute('placeholder', this._placeholder);
      scopeLabel.textContent = '';
      return;
    }
    const parent = this._pages.at(-2)?.page.label ?? this._label;
    scopeLabel.textContent = page.label;
    scopeBack.setAttribute('aria-label', this._message('launcher.back', 'Back to %1', parent));
    input.setAttribute('aria-label', this._message('launcher.pageLabel', 'Search %1', page.label));
    input.setAttribute('placeholder', page.placeholder != null ? String(page.placeholder)
      : this._message('launcher.pagePlaceholder', 'Search'));
  }

  /** @returns {void} @fires Launcher#page */
  _emitPage() {
    const path = this._pages.map((entry) => entry.page);
    this.emit('page', { page: path.at(-1) ?? null, path });
  }

  /**
   * Resolves `open({ page })`: a page item as given, or the path to a local page by id.
   * @param {string|number|LauncherItem} target Page id or item.
   * @returns {LauncherItem[]}
   */
  _pagePath(target) {
    if (target && typeof target === 'object') {
      const item = /** @type {Record<string, any>} */ (target);
      if (!isLauncherPage(item) || item.label == null) return [];
      return [normalizeLauncherItem({ ...item, id: item.id ?? item.label })];
    }
    return findLauncherPage(this._items, /** @type {string|number} */ (target));
  }

  /**
   * The polite line a page change ends on: where the user is and how much is there.
   * @returns {string}
   */
  _pageStatus() {
    const label = this.getPage()?.label ?? this._label;
    const count = this._results.length;
    if (count === 0) return this._message('launcher.pageEmpty', '%1, no results', label);
    if (count === 1) return this._message('launcher.pageResult', '%1, 1 result', label);
    return this._message('launcher.pageResults', '%1, %2 results', label, count);
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
    // Back from a page, the option that opened it is highlighted again.
    const restored = this._restoreActiveId ?? null;
    this._restoreActiveId = null;
    const activeId = restored ?? (this._renderedQuery === queryKey && this._active >= 0 && this._results[this._active]
      ? String(this._results[this._active].id) : null);
    const query = this._query.trim();
    const level = this._level();
    const local = level.items.filter((item) => visibleForQuery(item.when, query));
    const rankedLocal = rankLauncherItems(local, query, this.options.maxResults);
    const remote = level.sources.flatMap((source) => {
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
    // A page row navigates inside the launcher, so it is never a link.
    const page = isLauncherPage(item);
    const href = page ? null : safeHref(item.href);
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
    if (item.hint != null && item.hint !== '') {
      children.push(h('span', { class: 'zx-launcher__hint' }, String(item.hint)));
    }
    const keys = launcherShortcutKeys(item);
    const caps = launcherShortcutCaps(item.shortcut);
    // Drawn caps are part of the option's name unless `keys` already exposes the shortcut.
    if (caps.length) children.push(h('span', { class: 'zx-launcher__keys', ariaHidden: keys ? 'true' : null },
      caps.map((cap) => h('kbd', { class: 'zx-launcher__key' }, cap))));
    if (page) children.push(h('span', { class: 'zx-launcher__chevron', ariaHidden: 'true' }, icon('chevron-right')));
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
      ariaKeyShortcuts: keys,
      dataset: {
        launcherIndex: index,
        pinned: item.pinned !== undefined && item.pinned !== false ? 'true' : null,
        kind: normalizeLauncherKind(item.kind),
        page: page ? 'true' : null
      }
    }, children));
  }

  /** @returns {void} */
  _renderStatus() {
    if (this._busy) {
      this.refs.status.textContent = String(this.options.loadingText
        ?? this._message('launcher.loading', 'Searching…'));
    } else if (this._results.length === 0) {
      this.refs.status.textContent = String(this.options.emptyText
        ?? this._message('launcher.empty', 'No results'));
    } else {
      this.refs.status.textContent = '';
    }
    this.refs.status.hidden = !this.refs.status.textContent;
    // A page change is announced once its level has rendered for its own query and finished
    // loading, so the count is the one the user will find.
    if (this._announcePending && !this._busy && this._renderedQuery === this._query) {
      this._announcePending = false;
      this._announceToggle = !this._announceToggle;
      // The trailing space makes a repeated identical line a change the live region reports.
      this.refs.announce.textContent = this._pageStatus() + (this._announceToggle ? '\u00a0' : '');
    }
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
    const plain = !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    // Backspace on an empty query leaves the page. A held key stops at the empty query instead of
    // running on through every page beneath it.
    if (event.key === 'Backspace' && plain && !event.repeat && this._pages.length && this._query === '') {
      event.preventDefault();
      this.back();
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
    if (/^Arrow(?:Left|Right|Up|Down)$/.test(event.key)) {
      const next = enabled.length ? this._spatialIndex(event.key, enabled) : null;
      if (next !== null) {
        event.preventDefault();
        this._active = next;
        this._syncActive();
        this.refs.results.querySelector(`[data-launcher-index="${this._active}"]`)
          ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (plain && !event.repeat && this._pageKey(event.key)) event.preventDefault();
        return;
      }
    }
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

  /**
   * ArrowRight on a page row opens it once the caret is at the end of the query (before that it
   * moves the caret); ArrowLeft on an empty query goes back. Application tiles keep both arrows
   * for moving through their grid, which the caller tries first.
   * @param {string} key ArrowLeft or ArrowRight.
   * @returns {boolean} Whether the key navigated.
   */
  _pageKey(key) {
    if (key === 'ArrowLeft') {
      if (!this._pages.length || this._query !== '') return false;
      this.back();
      return true;
    }
    const item = this._active >= 0 ? this._results[this._active] : null;
    if (!item || item.disabled || !isLauncherPage(item) || item.kind === 'application') return false;
    const input = /** @type {HTMLInputElement} */ (this.refs.input);
    const end = input.value.length;
    if (input.selectionStart !== end || input.selectionEnd !== end) return false;
    this._openPage(item);
    return true;
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
    if (isLauncherPage(item)) {
      event.preventDefault();
      this._openPage(item);
      // A pointer may have focused the option it pressed, which the new page just removed.
      /** @type {HTMLInputElement} */ (this.refs.input).focus();
      return;
    }
    const selected = this.emit('select', {
      item,
      value: item.value ?? item.id,
      source: item._source ?? null,
      query: this._query.trim(),
      page: this.getPage()
    });
    if (selected.defaultPrevented) {
      event.preventDefault();
      return;
    }
    // Close first: closing the dialog returns focus to where it was before the launcher opened, so
    // a command that redraws that element, or moves focus on purpose, has to run after it.
    this.close();
    if (!item.href) {
      event.preventDefault();
      item.invoke?.();
    }
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

  /**
   * Resolves a message through the host translator, falling back to the built-in English text.
   * @param {string} key Message key.
   * @param {string} fallback English default.
   * @param {...unknown} args Positional `%1`, `%2` values.
   * @returns {string}
   */
  _message(key, fallback, ...args) {
    const message = this.msg(key, ...args);
    return message === key ? printf(fallback, args) : message;
  }
}

/** @returns {string} */
function launcherShortcutLabel() {
  const platform = String((/** @type {any} */ (navigator)).userAgentData?.platform
    ?? navigator.platform ?? '');
  return /mac|iphone|ipad/i.test(platform) ? '⌘ K' : 'Ctrl K';
}

/**
 * @param {LauncherOptions['hints']} hints Host-supplied hint labels, or false to omit the row.
 * @param {{move: string, open: string, back: string, close: string}} defaults Resolved built-in labels.
 * @returns {HTMLElement|null}
 */
function launcherHints(hints, defaults) {
  if (hints === false) return null;
  const labels = hints && typeof hints === 'object' ? hints : {};
  return h('footer', { class: 'zx-launcher__hints', ariaHidden: 'true' },
    h('span', {}, h('kbd', {}, '↑↓←→'), labels.move ?? defaults.move),
    h('span', {}, h('kbd', {}, '↵'), labels.open ?? defaults.open),
    // Shown only on a page (`_syncPage()`).
    h('span', { ref: 'backHint', hidden: true }, h('kbd', {}, '⌫'), labels.back ?? defaults.back),
    h('span', {}, h('kbd', {}, 'Esc'), labels.close ?? defaults.close));
}

/**
 * Whether an item opens a page rather than being selected.
 * @param {unknown} item Candidate item.
 * @returns {boolean}
 */
export function isLauncherPage(item) {
  const items = /** @type {Record<string, any>|null} */ (item)?.items;
  return Boolean(item) && typeof item === 'object' && (Array.isArray(items) || typeof items === 'function');
}

/**
 * Finds a page among local items by id, descending through array pages (a loader's items are not
 * known until it runs).
 * @param {LauncherItem[]} items Root items.
 * @param {string|number} id Page item id.
 * @returns {LauncherItem[]} The pages from the root down to the match, or an empty array.
 */
export function findLauncherPage(items, id) {
  if (id == null) return [];
  const key = String(id);
  const seen = new Set();
  /** @param {unknown} list @param {LauncherItem[]} trail @returns {LauncherItem[]|null} */
  const visit = (list, trail) => {
    if (!Array.isArray(list) || seen.has(list)) return null;
    seen.add(list);
    for (const item of normalizeItems(list)) {
      if (!isLauncherPage(item)) continue;
      const path = [...trail, item];
      if (String(item.id) === key) return path;
      const found = visit(item.items, path);
      if (found) return found;
    }
    return null;
  };
  return visit(items, []) ?? [];
}

/**
 * Normalizes an item's `shortcut` into the key labels drawn as caps.
 * @param {unknown} shortcut `['⌘', 'K']`, one label, or `{label, keys}`.
 * @returns {string[]}
 */
export function launcherShortcutCaps(shortcut) {
  const labels = shortcut && typeof shortcut === 'object' && !Array.isArray(shortcut)
    ? /** @type {{label?: unknown}} */ (shortcut).label : shortcut;
  const caps = Array.isArray(labels) ? labels : labels == null ? [] : [labels];
  return caps.filter((cap) => cap != null && String(cap).trim() !== '').map((cap) => String(cap).trim());
}

/**
 * The `aria-keyshortcuts` value of an item: its `keys`, or the `keys` of a `{label, keys}` shortcut.
 * @param {LauncherItem} item Item.
 * @returns {string|null}
 */
function launcherShortcutKeys(item) {
  const shortcut = /** @type {any} */ (item.shortcut);
  const keys = item.keys ?? (shortcut && typeof shortcut === 'object' && !Array.isArray(shortcut) ? shortcut.keys : null);
  return typeof keys === 'string' && keys.trim() ? keys.trim() : null;
}

/**
 * A page loader as a source of its page, so it shares the debounce, abort, loading, and ranking
 * of the root's sources.
 * @param {LauncherItem} item Page item whose `items` is a loader.
 * @returns {LevelSource}
 */
function launcherPageSource(item) {
  return {
    id: `page:${String(item.id)}`,
    load: /** @type {LauncherPageLoader} */ (item.items),
    order: item.order === 'source' ? 'source' : 'rank',
    _page: true
  };
}

/**
 * Whether two page paths name the same pages.
 * @param {LauncherItem[]} left Path.
 * @param {LauncherItem[]} right Path.
 * @returns {boolean}
 */
function samePath(left, right) {
  return left.length === right.length
    && left.every((item, index) => item === right[index] || String(item.id) === String(right[index].id));
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
    if (typeof normalized.invoke !== 'function' && !isLauncherPage(normalized)) normalized.disabled = true;
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
/** Fired after a page opens or closes, or `open()` lands on a different page. @event Launcher#page @type {CustomEvent<LauncherPageDetail>} */
/** Fired after the dialog opens. @event Launcher#open @type {CustomEvent<Record<string, never>>} */
/** Fired after the dialog closes. @event Launcher#close @type {CustomEvent<Record<string, never>>} */
/** Fired when one asynchronous source or page loader fails. @event Launcher#error @type {CustomEvent<LauncherErrorDetail>} */
