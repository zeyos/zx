import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { printf } from '../../core/i18n.js';
import { icon } from '../../core/icons.js';
import { isElement } from '../../core/util.js';
import { badge } from '../badge/badge.js';
import { Search } from '../search/search.js';

/**
 * Built-in view shapes, so `views: ['auto', 'cards', 'table']` needs no labels of its own. A host
 * that wants other words hands descriptors instead.
 *
 * `auto` deliberately carries no icon: no glyph in the set says "whatever fits", and an icon that
 * has to be explained is worse than the word.
 * @type {Readonly<Record<string, {icon: string|null, key: string, fallback: string}>>}
 */
const VIEW_PRESETS = Object.freeze({
  auto: { icon: null, key: 'listToolbar.viewAuto', fallback: 'Auto' },
  cards: { icon: 'copy', key: 'listToolbar.viewCards', fallback: 'Cards' },
  table: { icon: 'list', key: 'listToolbar.viewTable', fallback: 'Table' },
  list: { icon: 'list', key: 'listToolbar.viewList', fallback: 'List' }
});

/**
 * @typedef {Object} ListToolbarSearch
 * @property {string} [placeholder] Field placeholder; also names the field. Defaults to the
 *   `listToolbar.search` message.
 * @property {string} [value=''] Initial query.
 * @property {number} [debounce=250] Debounce before `search` is emitted, in milliseconds.
 * @property {boolean} [clearable=true] Whether the field shows its clear control.
 */

/**
 * @typedef {Object} ListToolbarTool
 * @property {string} id Stable identifier, reported by `action` and addressed by `setBadge()`.
 * @property {string} [label=''] Visible label, and the base of the accessible name.
 * @property {string|null} [icon=null] Icon name from `icons.js`.
 * @property {string|number|null} [badge=null] Badge content. `null` renders no badge; `0` is a
 *   value and renders one.
 * @property {'neutral'|'accent'|'success'|'warning'|'danger'|'info'} [badgeKind='accent'] Badge intent.
 * @property {boolean} [pressed] Present makes the tool a toggle (`aria-pressed`), which flips on
 *   activation; absent makes it a plain button.
 * @property {boolean} [disabled=false] Whether the tool starts disabled.
 * @property {string} [title] Native tooltip; defaults to the accessible name.
 * @property {(event: MouseEvent) => void} [onclick] Callback, called after the `action` event.
 */

/**
 * @typedef {Object} ListToolbarView
 * @property {string} id View identifier reported by `viewchange`.
 * @property {string} [label] Visible label; omitted falls back to the built-in preset word.
 * @property {string|null} [icon] Icon name from `icons.js`.
 */

/**
 * @typedef {Object} ListToolbarOptions
 * @property {ListToolbarSearch|boolean} [search={}] Search field configuration; `false` omits it.
 * @property {number|null} [count=null] Initial result count shown in the live status line.
 * @property {((count: number) => string)|null} [countText=null] Formats the count line; omitted
 *   uses the `listToolbar.results` message (`'%1 results'`).
 * @property {Array<string|ListToolbarView>} [views=[]] Shape switch entries; `[]` omits the switch.
 * @property {string|null} [view=null] Initially selected shape; omitted selects the first entry.
 * @property {ListToolbarTool[]} [tools=[]] Tool buttons, in display order.
 * @property {string|null} [label=null] Accessible name of the bar; omitted uses the
 *   `listToolbar.label` message.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<{value: string}>) => void} [onsearch] Search listener.
 * @property {(event: CustomEvent<{view: string, previous: string|null}>) => void} [onviewchange] Shape listener.
 * @property {(event: CustomEvent<{id: string, pressed: boolean|null, tool: Element}>) => void} [onaction] Tool listener.
 */

/**
 * The bar above a record view: one search field, a live result count, the tools that change what
 * the list shows, and the shape switch. Every application writes this row, and most of them write
 * it slightly wrong — this is the composition, not a new primitive. It builds on `Search` and
 * `badge()` and reimplements neither.
 *
 * This is not `Toolbar`, which stays the right component for a row of commands. `Toolbar` is the
 * APG toolbar pattern — one tab stop, arrow keys between controls — and it collapses whatever no
 * longer fits into an overflow menu. Both are wrong here: the row contains a text input, where
 * arrow keys must move the caret, and the first thing an overflow menu would swallow is the badge
 * saying why the list is showing four rows out of twenty.
 *
 * Three properties are the reason it exists:
 *
 * - **A tool's badge is part of its accessible name.** A tool showing `2` announces as
 *   "Filters (2)"; the badge itself is `aria-hidden`, so the number is heard once, as part of the
 *   control, rather than found separately beside it.
 * - **The count line is a live region**, and `setCount(null)` clears it. The previous number
 *   describes the previous filters, and a stale count during a load is worse than none.
 * - **Tool buttons meet the 44 px target** in both densities. An icon button sized to its glyph is
 *   the control people miss twice before hitting once.
 *
 * `bind()` is optional sugar; the toolbar is fully functional without it.
 * @fires ListToolbar#search
 * @fires ListToolbar#viewchange
 * @fires ListToolbar#action
 * @extends {Component<ListToolbarOptions>}
 */
export class ListToolbar extends Component {
  static cssName = 'list-toolbar';

  /** @type {Readonly<ListToolbarOptions>} */
  static defaults = {
    search: {},
    count: null,
    countText: null,
    views: [],
    view: null,
    tools: [],
    label: null
  };

  /**
   * Creates the bar, or turns an existing element into one.
   * @param {Element|string|null} [target=null] Existing container, selector, or null to create one.
   * @param {ListToolbarOptions} [options={}] Toolbar options.
   */
  constructor(target = null, options = {}) {
    super(target, options);

    if (this.refs.tools) {
      this.listen(this.refs.tools, 'click', (event) => this._toolClick(/** @type {MouseEvent} */ (event)));
    }
    if (this.refs.views) {
      this.listen(this.refs.views, 'click', (event) => this._viewClick(/** @type {MouseEvent} */ (event)));
    }
    // Registered once rather than per `bind()`, so `unbind()` is a state change and never has to
    // take a listener back off a view that may already be gone.
    this.on('viewchange', (event) => {
      const bound = this._bound;
      const setter = bound?.capabilities.setShape;
      if (setter) bound.view[setter](/** @type {CustomEvent} */ (event).detail.view);
    });
  }

  /**
   * Builds the bar. Runs inside the base constructor, so every piece of instance state is
   * initialized here rather than in a class field.
   * @returns {HTMLElement}
   */
  render() {
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(this.el);
    this._destroyed = false;
    /** @type {Map<string, ToolRecord>} */
    this._tools = new Map();
    this._views = normalizeViewList(this.options.views);
    this._view = resolveView(this._views, this.options.view, null);
    this._count = null;
    /** @type {Search|null} */
    this._search = null;
    /** @type {{view: Record<string, any>, capabilities: RecordViewCapabilities}|null} */
    this._bound = null;
    /** @type {AdoptedElement[]} */
    this._adopted = [];
    /** @type {AdoptedElement|null} */
    this._chooser = null;

    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label',
      this.options.label ?? this._message('listToolbar.label', 'List controls'));

    /** @type {Node[]} */
    const children = [];
    const searchOptions = this._searchOptions();
    if (searchOptions) {
      this._search = new Search(null, searchOptions);
      const field = /** @type {HTMLElement} */ (this._search.toElement());
      field.classList.add('zx-list-toolbar__search');
      // `Search` debounces its own `input`; `submit` is the reader pressing Enter, which should
      // not wait for a timer that has already been reset by the keystroke before it.
      this._search.on('input', (event) => this.emit('search', { value: readValue(event) }));
      this._search.on('submit', (event) => this.emit('search', { value: readValue(event) }));
      children.push(field);
    }

    // Always rendered and never hidden: a live region has to be in the accessibility tree before
    // the text arrives, and toggling `display` on it is how announcements get lost. Empty, it is a
    // zero-width item in a row that already ends in blank space.
    children.push(h('span', {
      class: 'zx-list-toolbar__count',
      ref: 'count',
      role: 'status',
      ariaLive: 'polite',
      ariaAtomic: 'true'
    }));
    children.push(h('span', { class: 'zx-list-toolbar__spacer' }));
    children.push(h('div', { class: 'zx-list-toolbar__tools', ref: 'tools' }));
    if (this._views.length > 0) {
      children.push(h('div', {
        class: 'zx-list-toolbar__views',
        ref: 'views',
        role: 'group',
        ariaLabel: this._message('listToolbar.views', 'View')
      }));
    }
    root.replaceChildren(...children);

    this.setTools(this.options.tools);
    this._syncViews();
    this.setCount(this.options.count);
    return root;
  }

  /**
   * Replaces the count line. `null` clears it, which is the right answer while a request is in
   * flight: the number on screen describes the filters the reader has just changed.
   * @param {number|null} count Result count, or null.
   * @returns {this}
   */
  setCount(count) {
    this._count = countValue(count);
    this.refs.count.textContent = countLineText(count, this._countFormat());
    return this;
  }

  /**
   * Returns the count currently shown, or null when the line is empty.
   * @returns {number|null}
   */
  getCount() {
    return this._count;
  }

  /**
   * Replaces a tool's badge and its accessible name with it. `null` removes the badge.
   * @param {string} id Tool id.
   * @param {string|number|null} value Badge content; `0` is a value, `null` removes it.
   * @returns {this}
   */
  setBadge(id, value) {
    const record = this._tools.get(String(id));
    if (!record) return this;
    record.badge = normalizeToolBadge(value);
    this._syncTool(record);
    return this;
  }

  /**
   * Sets the pressed state of a toggle tool. A tool declared without `pressed` is a plain button
   * and is left alone.
   * @param {string} id Tool id.
   * @param {boolean} [pressed=true] Next state.
   * @returns {this}
   */
  setPressed(id, pressed = true) {
    const record = this._tools.get(String(id));
    if (!record?.toggle) return this;
    record.pressed = Boolean(pressed);
    record.element.setAttribute('aria-pressed', record.pressed ? 'true' : 'false');
    return this;
  }

  /**
   * Enables or disables a tool, for instance while its panel is loading.
   * @param {string} id Tool id.
   * @param {boolean} [disabled=true] Next state.
   * @returns {this}
   */
  setToolDisabled(id, disabled = true) {
    const record = this._tools.get(String(id));
    if (record) record.element.disabled = Boolean(disabled);
    return this;
  }

  /**
   * Replaces every tool. Elements adopted with `addTool()` and a chooser mounted by `bind()` stay
   * where they are.
   * @param {ListToolbarTool[]} tools Tool descriptors.
   * @returns {this}
   */
  setTools(tools) {
    for (const record of this._tools.values()) record.element.remove();
    this._tools = new Map();
    const elements = [];
    for (const descriptor of normalizeTools(tools)) {
      const record = this._createTool(descriptor);
      this._tools.set(record.id, record);
      elements.push(record.element);
    }
    // Prepended as one run, so the tools stay in declaration order and an adopted control — a
    // field chooser `bind()` moved here — keeps its place at the trailing edge of the slot.
    this.refs.tools.prepend(...elements);
    return this;
  }

  /**
   * Returns a tool's button element.
   * @param {string} id Tool id.
   * @returns {HTMLButtonElement|null}
   */
  getTool(id) {
    return this._tools.get(String(id))?.element ?? null;
  }

  /**
   * The element tools are mounted into. Hand it to a view as `fieldControls: {target}` to place
   * that view's field chooser in this bar without calling `bind()`.
   *
   * A control mounted here by somebody else stays theirs: the toolbar puts back what it adopted
   * through `addTool()` or `bind()`, and everything else goes wherever this slot goes. Use
   * `addTool()` instead to hand the toolbar an element it should return on `destroy()`.
   * @returns {HTMLElement}
   */
  getToolsElement() {
    return /** @type {HTMLElement} */ (this.refs.tools);
  }

  /**
   * Adopts a ready-made control into the tools slot. The element's original position is recorded,
   * and `destroy()` puts it back.
   * @param {Element} element Control to mount.
   * @returns {this}
   */
  addTool(element) {
    if (!isElement(element)) throw new TypeError('ListToolbar.addTool() needs an Element');
    if (this.refs.tools.contains(element)) return this;
    this._adopted.push(capturePosition(element));
    this.refs.tools.append(element);
    return this;
  }

  /**
   * Selects a view shape. A value outside `views` is ignored, so the switch can only ever report
   * one of the shapes it was configured with.
   * @param {string} view View id.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `viewchange`.
   * @returns {this}
   * @fires ListToolbar#viewchange
   */
  setView(view, { silent = false } = {}) {
    const next = resolveView(this._views, view, this._view);
    if (next === null || next === this._view) return this;
    const previous = this._view;
    this._view = next;
    this._syncViews();
    if (!silent) this.emit('viewchange', { view: next, previous });
    return this;
  }

  /**
   * Returns the selected view shape, or null when no shape switch is configured.
   * @returns {string|null}
   */
  getView() {
    return this._view;
  }

  /**
   * Returns the current query, or an empty string when the field is omitted.
   * @returns {string}
   */
  getSearch() {
    return this._search ? this._search.get() : '';
  }

  /**
   * Sets the query.
   * @param {string} value Next query.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `search`.
   * @returns {this}
   */
  setSearch(value, options = {}) {
    this._search?.set(value, options);
    return this;
  }

  /**
   * Focuses the search field, for a host that binds a "/" shortcut.
   * @returns {this}
   */
  focusSearch() {
    this._search?.focus();
    return this;
  }

  /**
   * Optional sugar for a `TableView` or `CardView`: it wires the shape switch to the view and
   * mounts the view's field chooser into this bar.
   *
   * Nothing is imported and nothing is required — every capability is feature-detected, so a view
   * that offers none of them still works and still gets `viewchange`, and the host swaps the view
   * itself. See `recordViewCapabilities()` for what is looked for.
   * @param {object} view A record view, or anything that quacks like one.
   * @returns {this}
   */
  bind(view) {
    if (view === null || typeof view !== 'object') {
      throw new TypeError('ListToolbar.bind() needs a record view');
    }
    this.unbind();
    const capabilities = recordViewCapabilities(view);
    this._bound = { view: /** @type {Record<string, any>} */ (view), capabilities };
    if (capabilities.getShape) {
      // Adopted silently, and only when the view's shape is one this switch offers: `setView()`
      // leaves the current shape alone for anything else.
      const current = view[capabilities.getShape]();
      if (current != null) this.setView(String(current), { silent: true });
    }
    this._mountFieldControls(view);
    return this;
  }

  /**
   * Releases a bound view and returns its field chooser to where it was found.
   * @returns {this}
   */
  unbind() {
    this._bound = null;
    if (this._chooser) {
      restorePosition(this._chooser, this.el);
      this._chooser = null;
    }
    return this;
  }

  /**
   * Destroys the search field, returns every adopted control to where it came from, and restores
   * an enhanced target to the markup it had before the takeover.
   * @returns {void}
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.unbind();
    // Before the root is removed, or the adopted controls would go with it.
    for (const entry of this._adopted.reverse()) restorePosition(entry, this.el);
    this._adopted = [];
    this._search?.destroy();
    this._search = null;
    const root = this.el;
    super.destroy();
    if (!this._createdRoot) restoreTarget(root, this._snapshot);
  }

  /* ------------------------------------------------------------------ internals -- */

  /** @returns {import('../search/search.js').SearchOptions|null} The options `Search` is built with. */
  _searchOptions() {
    const configured = this.options.search;
    if (configured === false || configured === null) return null;
    const settings = configured === true || configured === undefined ? {} : configured;
    if (typeof settings !== 'object' || Array.isArray(settings)) {
      throw new TypeError('ListToolbar search must be an options object or false');
    }
    return {
      ...settings,
      placeholder: String(settings.placeholder ?? this._message('listToolbar.search', 'Search'))
    };
  }

  /** @returns {(count: number) => string} The count formatter, host-supplied or translated. */
  _countFormat() {
    const custom = this.options.countText;
    if (typeof custom === 'function') return (value) => String(custom(value));
    return (value) => this._message('listToolbar.results', '%1 results', value.toLocaleString());
  }

  /**
   * Builds one tool button.
   * @param {Required<ListToolbarTool>} descriptor Normalized descriptor.
   * @returns {ToolRecord}
   */
  _createTool(descriptor) {
    const element = /** @type {HTMLButtonElement} */ (h('button', {
      class: 'zx-list-toolbar__tool',
      type: 'button',
      disabled: descriptor.disabled,
      dataset: { toolId: descriptor.id },
      ariaPressed: descriptor.pressed === null ? null : String(descriptor.pressed)
    }));
    if (descriptor.icon) element.append(icon(descriptor.icon, { size: 16 }));
    if (descriptor.label !== '') {
      element.append(h('span', { class: 'zx-list-toolbar__tool-label' }, descriptor.label));
    }

    /** @type {ToolRecord} */
    const record = {
      id: descriptor.id,
      element,
      label: descriptor.label || descriptor.title || descriptor.id,
      title: descriptor.title,
      badge: descriptor.badge,
      badgeKind: descriptor.badgeKind,
      badgeEl: null,
      toggle: descriptor.pressed !== null,
      pressed: Boolean(descriptor.pressed),
      onclick: descriptor.onclick
    };
    this._syncTool(record);
    return record;
  }

  /**
   * Rebuilds a tool's badge and the accessible name that carries it.
   *
   * The badge element is `aria-hidden`: the number it shows is already in the button's name, and a
   * screen reader meeting both would announce "Filters 2 2".
   * @param {ToolRecord} record Tool record.
   * @returns {void}
   */
  _syncTool(record) {
    record.badgeEl?.remove();
    record.badgeEl = null;
    if (record.badge !== null) {
      const element = badge({ label: record.badge, kind: record.badgeKind, size: 'sm' });
      element.classList.add('zx-list-toolbar__badge');
      element.setAttribute('aria-hidden', 'true');
      record.badgeEl = element;
      record.element.append(element);
    }
    const name = toolAccessibleName(record.label, record.badge,
      this._message('listToolbar.toolBadge', '%1 (%2)'));
    record.element.setAttribute('aria-label', name);
    record.element.setAttribute('title', record.title ?? name);
  }

  /**
   * Reports a tool activation and flips a toggle tool.
   * @param {MouseEvent} event Click event.
   * @returns {void}
   * @fires ListToolbar#action
   */
  _toolClick(event) {
    const target = /** @type {Element|null} */ (event.target);
    const element = target?.closest?.('[data-tool-id]');
    if (!element || !this.refs.tools.contains(element)) return;
    const record = this._tools.get(String(/** @type {HTMLElement} */ (element).dataset.toolId));
    // A control adopted with `addTool()`, or a chooser `bind()` mounted, is not ours to report on.
    if (!record) return;
    if (record.toggle) this.setPressed(record.id, !record.pressed);
    this.emit('action', {
      id: record.id,
      pressed: record.toggle ? record.pressed : null,
      tool: record.element
    });
    record.onclick?.(event);
  }

  /**
   * Selects the clicked shape.
   * @param {MouseEvent} event Click event.
   * @returns {void}
   */
  _viewClick(event) {
    const target = /** @type {Element|null} */ (event.target);
    const element = target?.closest?.('[data-view]');
    if (!element || !this.refs.views.contains(element)) return;
    this.setView(String(/** @type {HTMLElement} */ (element).dataset.view));
  }

  /** Rebuilds the shape switch, or just its pressed states. @returns {void} */
  _syncViews() {
    if (!this.refs.views) return;
    const group = /** @type {HTMLElement} */ (this.refs.views);
    if (group.childElementCount !== this._views.length) {
      group.replaceChildren(...this._views.map((view) => {
        const label = view.label ?? this._viewLabel(view.id);
        const element = h('button', {
          class: 'zx-list-toolbar__view',
          type: 'button',
          title: label,
          dataset: { view: view.id }
        });
        const glyph = view.icon === undefined ? VIEW_PRESETS[view.id]?.icon ?? null : view.icon;
        if (glyph) element.append(icon(glyph, { size: 16 }));
        element.append(h('span', { class: 'zx-list-toolbar__view-label' }, label));
        return element;
      }));
    }
    for (const element of group.children) {
      const selected = /** @type {HTMLElement} */ (element).dataset.view === this._view;
      element.setAttribute('aria-pressed', selected ? 'true' : 'false');
    }
  }

  /**
   * @param {string} id View id.
   * @returns {string} The translated preset word, or the id when the shape is the host's own.
   */
  _viewLabel(id) {
    const preset = VIEW_PRESETS[id];
    return preset ? this._message(preset.key, preset.fallback) : id;
  }

  /**
   * Moves a bound view's field chooser into the tools slot. A view that mounted it here itself —
   * `fieldControls: {target: toolbar.getToolsElement()}` — is already where it belongs and is left
   * alone, and a view with `fieldControls: false` has none to move.
   * @param {Record<string, any>} view Bound view.
   * @returns {void}
   */
  _mountFieldControls(view) {
    if (view.options?.fieldControls === false) return;
    const element = this._findFieldControls(view);
    if (!element || this.el.contains(element)) return;
    this._chooser = capturePosition(element);
    this.refs.tools.append(element);
  }

  /**
   * Finds a view's field chooser without importing the view, newest accessor first.
   * @param {Record<string, any>} view Bound view.
   * @returns {Element|null}
   */
  _findFieldControls(view) {
    if (typeof view.getFieldControls === 'function') {
      const element = view.getFieldControls();
      if (isElement(element)) return element;
    }
    if (isElement(view._viewFieldControls)) return view._viewFieldControls;
    const root = typeof view.toElement === 'function' ? view.toElement() : null;
    return isElement(root) ? root.querySelector('.zx-record-view__field-controls') : null;
  }

  /**
   * Resolves a message through the host translator, falling back to the built-in English text.
   * @param {string} key Message key.
   * @param {string} fallback Built-in text, with `%1`-style placeholders.
   * @param {...unknown} args Interpolation values.
   * @returns {string}
   */
  _message(key, fallback, ...args) {
    const message = this.msg(key, ...args);
    return message === key ? printf(fallback, args) : message;
  }
}

/**
 * Debounced query change, and the reader pressing Enter.
 * @event ListToolbar#search
 * @type {CustomEvent<{value: string}>}
 */

/**
 * Shape switch change.
 * @event ListToolbar#viewchange
 * @type {CustomEvent<{view: string, previous: string|null}>}
 */

/**
 * Tool activation. `pressed` is the new state of a toggle tool, and null for a plain button.
 * @event ListToolbar#action
 * @type {CustomEvent<{id: string, pressed: boolean|null, tool: Element}>}
 */

/**
 * @typedef {Object} ToolRecord
 * @property {string} id Tool id.
 * @property {HTMLButtonElement} element Rendered button.
 * @property {string} label Name the badge is composed onto.
 * @property {string|null} title Host-supplied tooltip.
 * @property {string|null} badge Normalized badge content.
 * @property {string} badgeKind Badge intent.
 * @property {HTMLElement|null} badgeEl Rendered badge.
 * @property {boolean} toggle Whether the tool carries `aria-pressed`.
 * @property {boolean} pressed Current pressed state.
 * @property {((event: MouseEvent) => void)|null} onclick Descriptor callback.
 */

/** @typedef {{element: Element, parent: Node|null, next: Node|null}} AdoptedElement */

/**
 * @typedef {Object} RecordViewCapabilities
 * @property {boolean} isRecordView Whether the object publishes the record-view state surface.
 * @property {string|null} setShape Method that changes the view shape, if any.
 * @property {string|null} getShape Method that reads the view shape, if any.
 * @property {boolean} events Whether the object emits component events.
 * @property {boolean} fieldControls Whether the object offers its field chooser through a method.
 */

/**
 * Describes what `bind()` can wire on an object, by feature rather than by class.
 *
 * `ListToolbar` must not import `TableView` or `CardView`: it would hard-depend on two components
 * a host may not use, and on their current shape. A record view is recognised instead by the state
 * surface `RecordView` publishes — `setViewState`/`getViewState` plus the component event
 * methods that carry `sortchange` and friends. Everything beyond that is optional and detected
 * one method at a time, so a view that grows a shape switch later is wired the day it does.
 *
 * Pure: it reads types, never the DOM.
 * @param {unknown} view Candidate view.
 * @returns {RecordViewCapabilities}
 */
export function recordViewCapabilities(view) {
  const candidate = /** @type {Record<string, unknown>} */ (view);
  const has = (name) => Boolean(candidate) && typeof candidate[name] === 'function';
  const pick = (...names) => names.find(has) ?? null;
  return {
    isRecordView: has('setViewState') && has('getViewState') && has('on') && has('toElement'),
    setShape: pick('setView', 'setViewShape'),
    getShape: pick('getView', 'getViewShape'),
    events: has('on') && has('emit'),
    fieldControls: has('getFieldControls')
  };
}

/**
 * Normalizes badge content. `null`, `undefined`, `false`, and `''` mean no badge; everything else
 * is text. `0` is a value: a tool that counts something and counts none of it still says so.
 * @param {unknown} value Badge content.
 * @returns {string|null}
 */
export function normalizeToolBadge(value) {
  if (value === null || value === undefined || value === false || value === '') return null;
  return String(value);
}

/**
 * Composes a tool's accessible name from its label and badge, so the badge is announced as part of
 * the control rather than as a second thing to find beside it: "Filters (2)".
 * @param {string} label Visible label.
 * @param {string|null} badgeText Normalized badge content.
 * @param {string} [template='%1 (%2)'] Composition template.
 * @returns {string}
 */
export function toolAccessibleName(label, badgeText, template = '%1 (%2)') {
  const name = String(label ?? '');
  if (badgeText === null || badgeText === undefined || badgeText === '') return name;
  return printf(template, [name, String(badgeText)]);
}

/**
 * Validates and copies tool descriptors.
 * @param {ListToolbarTool[]} tools Raw descriptors.
 * @returns {Required<ListToolbarTool>[]} Normalized descriptors.
 */
export function normalizeTools(tools) {
  if (tools != null && !Array.isArray(tools)) throw new TypeError('ListToolbar tools must be an array');
  const seen = new Set();
  const normalized = [];
  for (const tool of tools ?? []) {
    if (tool == null) continue;
    if (typeof tool !== 'object' || Array.isArray(tool)) {
      throw new TypeError('ListToolbar tools must be tool descriptors');
    }
    const id = String(tool.id ?? '').trim();
    if (!id) throw new TypeError('Every ListToolbar tool needs an id');
    if (seen.has(id)) throw new TypeError(`Duplicate ListToolbar tool: ${id}`);
    seen.add(id);
    normalized.push({
      id,
      label: String(tool.label ?? ''),
      icon: tool.icon ?? null,
      badge: normalizeToolBadge(tool.badge),
      badgeKind: String(tool.badgeKind ?? 'accent'),
      // null rather than false, so "a plain button" stays distinguishable from "a toggle that is
      // currently off" all the way down to the rendered attribute.
      pressed: tool.pressed === undefined ? null : Boolean(tool.pressed),
      disabled: Boolean(tool.disabled),
      title: tool.title === undefined ? null : String(tool.title),
      onclick: typeof tool.onclick === 'function' ? tool.onclick : null
    });
  }
  return /** @type {Required<ListToolbarTool>[]} */ (normalized);
}

/**
 * Normalizes the shape switch entries. Strings name a built-in preset or a shape of the host's
 * own; descriptors carry their own label and icon. Nullish and duplicate entries are dropped.
 * @param {Array<string|ListToolbarView>} views Raw entries.
 * @returns {Array<{id: string, label?: string, icon?: string|null}>}
 */
export function normalizeViewList(views) {
  if (views != null && !Array.isArray(views)) throw new TypeError('ListToolbar views must be an array');
  const seen = new Set();
  const normalized = [];
  for (const view of views ?? []) {
    if (view == null) continue;
    const descriptor = typeof view === 'object' ? view : { id: view };
    const id = String(descriptor.id ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const entry = /** @type {{id: string, label?: string, icon?: string|null}} */ ({ id });
    if (descriptor.label !== undefined) entry.label = String(descriptor.label);
    if (descriptor.icon !== undefined) entry.icon = descriptor.icon;
    normalized.push(entry);
  }
  return normalized;
}

/**
 * Resolves a requested shape against the configured list. A value the toolbar was not configured
 * with is never selected — the switch can only report shapes the host said it can render.
 * @param {Array<{id: string}>} views Normalized entries.
 * @param {unknown} requested Requested shape.
 * @param {string|null} current Shape to keep when the request is not on offer; `null` means the
 *   toolbar is choosing its initial shape and takes the first entry.
 * @returns {string|null} A configured shape id, or null when there are none.
 */
export function resolveView(views, requested, current) {
  const ids = views.map((view) => view.id);
  if (ids.length === 0) return null;
  if (requested != null && ids.includes(String(requested))) return String(requested);
  if (current === null) return ids[0];
  return ids.includes(current) ? current : ids[0];
}

/**
 * The text of the count line. Anything that is not a finite number — including `null` while a
 * request is in flight — is an empty line rather than a stale one.
 * @param {unknown} count Result count.
 * @param {(count: number) => string} format Formatter for a real count.
 * @returns {string}
 */
export function countLineText(count, format) {
  const value = countValue(count);
  return value === null ? '' : String(format(value));
}

/** @param {unknown} count @returns {number|null} A finite count, or null. */
function countValue(count) {
  if (count === null || count === undefined || count === '' || typeof count === 'boolean') return null;
  const value = Number(count);
  return Number.isFinite(value) ? value : null;
}

/** @param {Element} element @returns {AdoptedElement} Where an element was before it was adopted. */
function capturePosition(element) {
  return { element, parent: element.parentNode, next: element.nextSibling };
}

/**
 * Puts an adopted element back where it was found, or removes it when it had no place of its own.
 *
 * An element that is no longer inside the toolbar is left alone: a view that has been destroyed
 * takes its own field chooser with it, and re-inserting that node from under it would resurrect a
 * control nothing owns any more. A sibling that has since moved is no anchor either, so the
 * element goes back to the end of its original parent rather than throwing.
 * @param {AdoptedElement} entry Recorded position.
 * @param {Element} root Toolbar root the element must still be inside.
 * @returns {void}
 */
function restorePosition(entry, root) {
  const { element, parent, next } = entry;
  if (!root?.contains(element)) return;
  if (!parent) {
    element.remove();
    return;
  }
  if (next && next.parentNode === parent) parent.insertBefore(element, next);
  else parent.appendChild(element);
}

/** @param {Event} event @returns {string} The value carried by a `Search` event. */
function readValue(event) {
  return String(/** @type {CustomEvent<{value: string}>} */ (event).detail?.value ?? '');
}
