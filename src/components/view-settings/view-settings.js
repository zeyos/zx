import { Component } from '../../core/component.js';
import { h, highlightMatch, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { printf } from '../../core/i18n.js';
import { icon } from '../../core/icons.js';
import { uid } from '../../core/util.js';
import { Search } from '../search/search.js';
import { Select } from '../select/select.js';
import { Toggle } from '../toggle/toggle.js';

/**
 * Built-in field types: the glyph a row shows before the label and the word it is read as. The
 * vocabulary is the one `Filter` and the record views already speak; a host extends or overrides
 * it with the `types` option.
 * @type {Readonly<Record<string, {icon: string, key: string, label: string}>>}
 */
const FIELD_TYPES = Object.freeze({
  text: { icon: 'type', key: 'viewSettings.typeText', label: 'Text' },
  number: { icon: 'hash', key: 'viewSettings.typeNumber', label: 'Number' },
  money: { icon: 'hash', key: 'viewSettings.typeMoney', label: 'Money' },
  date: { icon: 'calendar', key: 'viewSettings.typeDate', label: 'Date' },
  datetime: { icon: 'calendar', key: 'viewSettings.typeDatetime', label: 'Date and time' },
  time: { icon: 'clock', key: 'viewSettings.typeTime', label: 'Time' },
  boolean: { icon: 'check', key: 'viewSettings.typeBoolean', label: 'Checkbox' },
  select: { icon: 'circle-chevron-down', key: 'viewSettings.typeSelect', label: 'Select' },
  status: { icon: 'circle-chevron-down', key: 'viewSettings.typeStatus', label: 'Status' },
  priority: { icon: 'circle-chevron-down', key: 'viewSettings.typePriority', label: 'Priority' },
  entity: { icon: 'folder', key: 'viewSettings.typeEntity', label: 'Linked record' },
  tags: { icon: 'tag', key: 'viewSettings.typeTags', label: 'Tags' },
  url: { icon: 'link-2', key: 'viewSettings.typeUrl', label: 'URL' },
  email: { icon: 'mail', key: 'viewSettings.typeEmail', label: 'Email' },
  image: { icon: 'image', key: 'viewSettings.typeImage', label: 'Image' },
  file: { icon: 'file', key: 'viewSettings.typeFile', label: 'File' },
  rating: { icon: 'star', key: 'viewSettings.typeRating', label: 'Rating' }
});

/** Other spellings of the built-in types, as servers and older field schemas send them. */
const TYPE_ALIASES = Object.freeze({
  string: 'text',
  textarea: 'text',
  int: 'number',
  integer: 'number',
  float: 'number',
  decimal: 'number',
  percent: 'number',
  currency: 'money',
  enum: 'select',
  bool: 'boolean',
  checkbox: 'boolean',
  link: 'url'
});

/**
 * Types whose values fall into a handful of named buckets, which is what grouping, board columns,
 * and swim lanes need. Free text is included: a short text field such as a city groups well, and
 * a host that disagrees passes `groupable: false` on the field.
 */
const DISCRETE_TYPES = new Set(['text', 'select', 'status', 'priority', 'boolean', 'entity']);

/** The sections in their default order. */
const SECTION_IDS = Object.freeze(['fields', 'grouping', 'board']);

/** Pixels a pointer must travel before a press on a handle becomes a drag. */
const DRAG_THRESHOLD = 4;

/** Distance from a scroll container's edge, in pixels, at which a drag starts scrolling it. */
const SCROLL_EDGE = 32;

/** Pixels a drag scrolls its container per frame while the pointer is in the edge band. */
const SCROLL_STEP = 12;

/**
 * One field as the settings know it: a record-view field descriptor plus what only the settings
 * need. Any other `ViewField` property (`get`, `render`, `width`, …) is carried along untouched.
 * @typedef {import('../view/record-view.js').ViewField & ViewSettingsFieldExtras} ViewSettingsField
 */

/**
 * @typedef {Object} ViewSettingsFieldExtras
 * @property {string} [type='text'] Field type; decides the glyph, the type name, and whether the
 *   field is offered for grouping. See the built-in type map in the documentation.
 * @property {boolean} [groupable] `false` keeps the field out of the grouping and board choices;
 *   `true` offers it whatever its type. Omitted offers it when its type is discrete.
 * @property {boolean} [locked=false] The panel offers no handle and no hide button for it, such as
 *   the record title; it keeps its place while the other fields arrange around it. This governs
 *   only what the panel offers: a bound view has no such notion, and when the view hides a locked
 *   field itself, the panel shows it under Hidden with Add like any other.
 */

/**
 * @typedef {Object} ViewSettingsBoard
 * @property {string|null} columnBy Field whose values are the board's columns.
 * @property {string|null} swimlaneBy Field whose values are the swim lanes, or null for none.
 * @property {boolean} [showEmptyColumns=true] Whether columns without cards stay visible.
 */

/**
 * The `board` option: the initial board settings plus the fields the board may use.
 * @typedef {Object} ViewSettingsBoardOptions
 * @property {string|null} [columnBy=null] Initial column field.
 * @property {string|null} [swimlaneBy=null] Initial swim-lane field, or null for none.
 * @property {boolean} [showEmptyColumns=true] Whether columns without cards stay visible.
 * @property {string[]} [fields] The field ids offered for columns and swim lanes, in this order.
 *   Omitted offers the same fields as the Group section.
 */

/**
 * @typedef {Object} ViewSettingsState
 * @property {string[]} fieldOrder Every field id, in order, hidden ones included.
 * @property {string[]} hiddenFields Hidden field ids, in field order.
 * @property {string|null} groupBy Grouping field, or null for none.
 * @property {ViewSettingsBoard|null} board Board settings, or null when the section is omitted.
 */

/**
 * @typedef {Object} ViewSettingsGrouping
 * @property {string[]} [fields] The field ids offered for grouping, in this order. Omitted offers
 *   every field with `groupable !== false` and a discrete type.
 */

/** @typedef {'fields'|'grouping'|'board'} ViewSettingsSection */
/** @typedef {'order'|'visibility'|'group'|'board'} ViewSettingsChangeReason */

/**
 * @typedef {Object} ViewSettingsOptions
 * @property {ViewSettingsField[]} [fields=[]] Field descriptors, in their default order. Bound to a
 *   view, a non-empty list is also the allow-list: the view's other fields are neither listed nor
 *   touched. An empty list takes every field the view has.
 * @property {string[]} [fieldOrder=[]] Preferred field order; missing fields append.
 * @property {string[]} [hiddenFields=[]] Hidden field ids. A field with `visible: false` starts
 *   hidden too; a locked field never does.
 * @property {string|null} [groupBy=null] Initial grouping field.
 * @property {boolean|ViewSettingsGrouping} [grouping=true] The Group section. `false` omits it;
 *   an object restricts the fields it offers.
 * @property {ViewSettingsBoardOptions|false} [board=false] The Board section (column field,
 *   swim-lane field, show empty columns) with its initial values and, in `fields`, the fields it
 *   offers; `false` omits it.
 * @property {ViewSettingsSection[]} [sections] Order and presence of the sections. Defaults to
 *   `['fields', 'grouping', 'board']`; a section whose option is `false` is always left out.
 * @property {Record<string, {icon?: string, label?: string}>} [types={}] Extends or overrides the
 *   built-in type map, keyed by type name.
 * @property {number} [searchThreshold=8] Field count above which the field search is shown.
 * @property {2|3|4|5|6} [headingLevel=3] Heading level of the section headings.
 * @property {string|null} [label=null] Accessible name of the region; omitted uses the
 *   `viewSettings.label` message ("View settings").
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<{state: ViewSettingsState, reason: ViewSettingsChangeReason}>) => void} [onchange]
 *   Any change the reader made.
 * @property {(event: CustomEvent<{order: string[]}>) => void} [onfieldorderchange] Field order changed.
 * @property {(event: CustomEvent<{visible: string[], hidden: string[]}>) => void} [onfieldvisibilitychange]
 *   A field was added or hidden.
 * @property {(event: CustomEvent<{field: string|null}>) => void} [ongroupchange] Grouping field changed.
 * @property {(event: CustomEvent<{board: ViewSettingsBoard}>) => void} [onboardchange] Board settings changed.
 */

/**
 * The content of a "View settings" panel for a record collection: which fields are shown and in
 * what order, which hidden field to bring back, what the records are grouped by, and which fields
 * a board uses for its columns and swim lanes. It is content, not a container — the host puts it
 * in a `Sheet`, a `Dropdown`, or a settings page.
 *
 * - **Fields** — the shown fields, in order, each with its type glyph. Rows are rearranged by
 *   dragging the handle (pointer, touch, or pen) or from the keyboard, and hidden with one button.
 *   The hidden fields are listed below with an explicit Add button; with more than
 *   `searchThreshold` fields a search narrows them, and Enter adds the first match.
 * - **Group by** — a `Select` of the groupable fields, with None.
 * - **Board** — column field, swim-lane field, and whether empty columns stay.
 *
 * Every move is announced through a polite live region ("Owner moved to position 3 of 6").
 *
 * `bind(view)` connects a `TableView`, `CardView`, or `KanbanView`: order and visibility are
 * pushed into the view and the view's own changes come back. Grouping and board settings are only
 * reported — the host decides how its views apply them.
 * @fires ViewSettings#change
 * @fires ViewSettings#fieldorderchange
 * @fires ViewSettings#fieldvisibilitychange
 * @fires ViewSettings#groupchange
 * @fires ViewSettings#boardchange
 * @extends {Component<ViewSettingsOptions>}
 */
export class ViewSettings extends Component {
  static cssName = 'view-settings';

  /** @type {Readonly<ViewSettingsOptions>} */
  static defaults = {
    fields: [],
    fieldOrder: [],
    hiddenFields: [],
    groupBy: null,
    grouping: true,
    board: false,
    types: {},
    searchThreshold: 8,
    headingLevel: 3,
    label: null
  };

  /**
   * Builds the panel. Runs inside the base constructor, so every piece of instance state is
   * initialized here rather than in a class field.
   * @returns {HTMLElement}
   */
  render() {
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(this.el);
    this._destroyed = false;
    /** @type {ViewSettingsField[]} */
    this._fields = normalizeViewSettingsFields(this.options.fields);
    // The ids the host named: bound to a view, the panel lists only these, so a field the view
    // keeps for another purpose — the title a card draws — is not offered as a column.
    this._ownIds = new Set(this._fields.map((field) => field.id));
    this._order = reconcileOrder(this._fields, this.options.fieldOrder);
    this._hidden = normalizeHidden(this._fields, this.options.hiddenFields, true);
    const ids = this._fields.length ? this._fields.map((field) => field.id) : null;
    this._groupBy = normalizeFieldId(this.options.groupBy, ids);
    this._board = normalizeBoard(this.options.board, ids);
    const boardOption = /** @type {ViewSettingsBoardOptions|false} */ (this.options.board);
    /** @type {string[]|null} */
    this._boardFields = boardOption && Array.isArray(boardOption.fields) ? boardOption.fields.map(String) : null;
    this._sections = normalizeSections(this.options.sections, this.options);
    this._query = '';
    /** @type {Search|null} */
    this._search = null;
    /** @type {Select|null} */
    this._groupSelect = null;
    /** @type {Select|null} */
    this._columnSelect = null;
    /** @type {Select|null} */
    this._laneSelect = null;
    /** @type {Toggle|null} */
    this._emptyToggle = null;
    /** @type {{view: Record<string, any>, controller: AbortController}|null} */
    this._bound = null;
    this._syncing = false;
    this._rendering = false;
    /** @type {{id: string, original: string[]}|null} */
    this._grab = null;
    /** @type {DragState|null} */
    this._drag = null;
    this._announceToken = 0;
    this._level = normalizeHeadingLevel(this.options.headingLevel);

    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', this.options.label ?? this._message('viewSettings.label', 'View settings'));

    this._instructionsId = uid('zx-view-settings-help');
    /** @type {Node[]} */
    const children = [];
    for (const section of this._sections) {
      if (section === 'fields') children.push(this._buildFieldsSection());
      if (section === 'grouping') children.push(this._buildGroupSection());
      if (section === 'board') children.push(this._buildBoardSection());
    }
    children.push(h('span', {
      class: 'zx-view-settings__instructions',
      id: this._instructionsId,
      hidden: true
    }, this._message('viewSettings.instructions',
      'Press Space to pick the field up, the arrow keys to move it, Space again to drop it, or Escape to cancel.')));
    // Always present and never hidden: a live region must be in the tree before its text changes.
    children.push(h('div', {
      class: 'zx-view-settings__status',
      ref: 'status',
      role: 'status',
      ariaLive: 'polite',
      ariaAtomic: 'true'
    }));
    root.replaceChildren(...children);

    if (this.refs.list) {
      const list = this.refs.list;
      this.listen(list, 'click', (event) => this._onShownClick(/** @type {MouseEvent} */ (event)));
      this.listen(list, 'keydown', (event) => this._onHandleKeydown(/** @type {KeyboardEvent} */ (event)));
      this.listen(list, 'focusout', (event) => this._onHandleFocusout(/** @type {FocusEvent} */ (event)));
      this.listen(list, 'pointerdown', (event) => this._onPointerDown(/** @type {PointerEvent} */ (event)));
      this.listen(list, 'pointermove', (event) => this._onPointerMove(/** @type {PointerEvent} */ (event)));
      this.listen(list, 'pointerup', (event) => this._onPointerUp(/** @type {PointerEvent} */ (event)));
      this.listen(list, 'pointercancel', () => this._cancelDrag());
      this.listen(list, 'lostpointercapture', () => {
        if (this._drag && !this._drag.ending) this._cancelDrag();
      });
      this.listen(this.refs.hidden, 'click', (event) => this._onHiddenClick(/** @type {MouseEvent} */ (event)));
      // Escape ends a drag wherever focus is; captured, so a surrounding Sheet does not close too.
      this.listen(root.ownerDocument ?? document, 'keydown', (event) => {
        const key = /** @type {KeyboardEvent} */ (event);
        if (key.key !== 'Escape' || !this._drag?.active) return;
        key.preventDefault();
        key.stopPropagation();
        this._cancelDrag(true);
      }, { capture: true });
      this._syncSearch();
      this._renderFields();
    }
    this._syncGroupControls();
    return root;
  }

  /**
   * Returns the current settings as a JSON-safe snapshot.
   * @returns {ViewSettingsState}
   */
  getState() {
    return {
      fieldOrder: [...this._order],
      hiddenFields: this._order.filter((id) => this._hidden.has(id)),
      groupBy: this._groupBy,
      board: this._board ? { ...this._board } : null
    };
  }

  /**
   * Applies part of a state. Unknown field ids are ignored, missing ones append, and a locked
   * field stays shown. Each part that actually changes emits its own event unless `silent`.
   * A keyboard pick-up or pointer drag in progress is canceled first.
   * @param {Partial<ViewSettingsState>} partial State to apply.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress events.
   * @returns {this}
   * @fires ViewSettings#fieldorderchange
   * @fires ViewSettings#fieldvisibilitychange
   * @fires ViewSettings#groupchange
   * @fires ViewSettings#boardchange
   */
  setState(partial, { silent = false } = {}) {
    this._settle();
    const source = partial && typeof partial === 'object' ? partial : {};
    const ids = this._fields.length ? this._fields.map((field) => field.id) : null;
    let orderChanged = false;
    let visibilityChanged = false;
    if (Array.isArray(source.fieldOrder)) {
      const next = reconcileOrder(this._fields, source.fieldOrder);
      orderChanged = !sameList(next, this._order);
      this._order = next;
    }
    if (Array.isArray(source.hiddenFields)) {
      const next = normalizeHidden(this._fields, source.hiddenFields, false);
      visibilityChanged = !sameSet(next, this._hidden);
      this._hidden = next;
    }
    let groupChanged = false;
    if (Object.hasOwn(source, 'groupBy')) {
      const next = normalizeFieldId(source.groupBy, ids);
      groupChanged = next !== this._groupBy;
      this._groupBy = next;
    }
    let boardChanged = false;
    if (Object.hasOwn(source, 'board') && this._board) {
      const next = normalizeBoard({ ...this._board, ...(source.board ?? {}) }, ids);
      boardChanged = !sameBoard(next, this._board);
      this._board = next;
    }
    this._renderFields();
    this._syncGroupControls();
    if (orderChanged || visibilityChanged) this._pushToView();
    if (silent) return this;
    if (orderChanged) this._emitOrder();
    if (visibilityChanged) this._emitVisibility();
    if (groupChanged) this._emitGroup();
    if (boardChanged) this._emitBoard();
    return this;
  }

  /**
   * Replaces the field descriptors, keeping order, visibility, grouping, and board settings for
   * every id that still exists.
   *
   * While a view is bound, the view owns the field list: change it with the view's own
   * `setFields()` and the panel follows through `statechange`. A `setFields()` here is not pushed
   * to the view and lasts only until the view's next change.
   * @param {ViewSettingsField[]} fields Next fields.
   * @returns {this}
   */
  setFields(fields) {
    this._settle();
    const previousHidden = this._order.filter((id) => this._hidden.has(id));
    const previousOrder = [...this._order];
    this._fields = normalizeViewSettingsFields(fields);
    this._ownIds = new Set(this._fields.map((field) => field.id));
    this._order = reconcileOrder(this._fields, previousOrder);
    // Fields new to the list start the way their descriptor says.
    const known = new Set(previousOrder);
    const hidden = [...previousHidden,
      ...this._fields.filter((field) => !known.has(field.id) && field.visible === false).map((field) => field.id)];
    this._hidden = normalizeHidden(this._fields, hidden, false);
    const ids = this._fields.map((field) => field.id);
    this._groupBy = normalizeFieldId(this._groupBy, ids);
    if (this._board) this._board = normalizeBoard(this._board, ids);
    this._syncSearch();
    this._renderFields();
    this._syncGroupControls();
    return this;
  }

  /**
   * Returns the field descriptors in their current order.
   * @returns {ViewSettingsField[]}
   */
  getFields() {
    const byId = new Map(this._fields.map((field) => [field.id, field]));
    return this._order.map((id) => ({ .../** @type {ViewSettingsField} */ (byId.get(id)) }));
  }

  /**
   * Shows a hidden field at the end of the shown list.
   * @param {string} id Field id.
   * @returns {this}
   * @fires ViewSettings#fieldvisibilitychange
   */
  showField(id) {
    const fieldId = String(id);
    if (!this._hidden.has(fieldId)) return this;
    this._settle();
    const next = showFieldInOrder(this._order, this._hidden, fieldId);
    const orderChanged = !sameList(next.order, this._order);
    this._order = next.order;
    this._hidden = new Set(next.hidden);
    this._renderFields();
    this._pushToView();
    if (orderChanged) this._emitOrder(false);
    this._emitVisibility();
    return this;
  }

  /**
   * Hides a shown field. A locked field and the last shown field cannot be hidden.
   * @param {string} id Field id.
   * @returns {this}
   * @fires ViewSettings#fieldvisibilitychange
   */
  hideField(id) {
    const fieldId = String(id);
    if (!this._canHide(fieldId)) return this;
    this._settle();
    this._hidden.add(fieldId);
    this._renderFields();
    this._pushToView();
    this._emitVisibility();
    return this;
  }

  /**
   * Moves a shown field to a position among the movable shown fields (locked ones keep theirs).
   * @param {string} id Field id.
   * @param {number} index Zero-based target position among the movable shown fields.
   * @returns {this}
   * @fires ViewSettings#fieldorderchange
   */
  moveField(id, index) {
    this._settle();
    const next = moveVisibleField(this._order, this._hidden, this._lockedIds(), String(id), index);
    if (sameList(next, this._order)) return this;
    this._order = next;
    this._renderFields();
    this._pushToView();
    this._emitOrder();
    return this;
  }

  /**
   * Connects a record view (`TableView`, `CardView`, `KanbanView`, or anything exposing the
   * `RecordView` state surface). The view's fields and state are read now; order and visibility
   * changes made here are pushed through `setFieldOrder()` and `setFieldVisible()`; and the view's
   * own `statechange` is followed, so a column hidden from a table header disappears here too.
   * The view's labels and types win over the panel's own descriptors, which supply only what the
   * view lacks (`locked`, `groupable`, a type the view leaves at its `'text'` default). While
   * bound, the view owns the field list; see `setFields()`.
   *
   * Grouping and board settings are never applied to the view — they are emitted, and the host
   * decides (a `CardView` is re-created or given a new `groupBy`, a `KanbanView` its axes). A
   * view's own `groupBy`, `columnBy`, and `swimlaneBy` options are adopted when they name fields.
   * @param {object} view Record view.
   * @param {{board?: ViewSettingsBoard|false}} [options={}] `board` replaces the board settings
   *   read from the view.
   * @returns {this}
   */
  bind(view, options = {}) {
    const candidate = /** @type {Record<string, any>} */ (view);
    if (!candidate || typeof candidate.getFields !== 'function' || typeof candidate.setFieldOrder !== 'function'
      || typeof candidate.setFieldVisible !== 'function' || typeof candidate.getHiddenFields !== 'function') {
      throw new TypeError('ViewSettings.bind() needs a record view');
    }
    this.unbind();
    // One controller per binding, aborted by `unbind()`, so a view the host has moved on from is
    // not kept alive by this panel until it is destroyed.
    const controller = new AbortController();
    this._bound = { view: candidate, controller };
    candidate.addEventListener('statechange', (/** @type {Event} */ event) => {
      if (this._syncing) return;
      const reason = /** @type {CustomEvent} */ (event).detail?.reason;
      this._pullFromView(reason === 'fields' || reason === 'restore');
    }, { signal: controller.signal });
    this._pullFromView(true);
    const viewOptions = candidate.options ?? {};
    const ids = this._fields.map((field) => field.id);
    if (typeof viewOptions.groupBy === 'string') this._groupBy = normalizeFieldId(viewOptions.groupBy, ids);
    if (this._board) {
      if (options.board) {
        this._board = normalizeBoard(options.board, ids);
      } else if (typeof viewOptions.columnBy === 'string') {
        this._board = normalizeBoard({
          columnBy: viewOptions.columnBy,
          swimlaneBy: typeof viewOptions.swimlaneBy === 'string' ? viewOptions.swimlaneBy : null,
          showEmptyColumns: viewOptions.showEmptyColumns !== false
        }, ids);
      }
    }
    this._syncGroupControls();
    return this;
  }

  /**
   * Releases a bound view. The settings keep their current state.
   * @returns {this}
   */
  unbind() {
    if (this._bound) {
      this._bound.controller.abort();
      this._bound = null;
    }
    return this;
  }

  /**
   * Focuses the field search, or the first control of the shown list when there is no search.
   * @returns {this}
   */
  focus() {
    if (this._search) {
      this._search.focus();
      return this;
    }
    const first = /** @type {HTMLElement|null} */ (this.el.querySelector(
      '.zx-view-settings__list button:not(:disabled), .zx-view-settings__hidden button:not(:disabled), '
      + '.zx-select__input, .zx-toggle'));
    first?.focus();
    return this;
  }

  /**
   * Destroys the nested controls, releases a bound view, and restores an enhanced target.
   * @returns {void}
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.unbind();
    if (this._drag) this._endDrag(this._drag);
    for (const control of [this._search, this._groupSelect, this._columnSelect, this._laneSelect, this._emptyToggle]) {
      control?.destroy();
    }
    this._search = null;
    this._groupSelect = null;
    this._columnSelect = null;
    this._laneSelect = null;
    this._emptyToggle = null;
    const root = this.el;
    super.destroy();
    if (!this._createdRoot) restoreTarget(root, this._snapshot);
  }

  /* ------------------------------------------------------------------ building -- */

  /**
   * @param {string} text Heading text.
   * @param {number} [offset=0] Levels below the section heading.
   * @param {string} [className='zx-view-settings__heading'] Heading class.
   * @returns {{element: HTMLElement, id: string}}
   */
  _heading(text, offset = 0, className = 'zx-view-settings__heading') {
    const id = uid('zx-view-settings-heading');
    const level = Math.min(6, this._level + offset);
    return { element: h(`h${level}`, { class: className, id }, text), id };
  }

  /** @returns {HTMLElement} The Fields section. */
  _buildFieldsSection() {
    const heading = this._heading(this._message('viewSettings.fields', 'Fields'));
    const shown = this._heading('', 1, 'zx-view-settings__subheading');
    const hidden = this._heading('', 1, 'zx-view-settings__subheading');
    this.refs.shownHeading = shown.element;
    this.refs.hiddenHeading = hidden.element;
    return h('section', {
      class: 'zx-view-settings__section',
      ref: 'fieldsSection',
      dataset: { section: 'fields' },
      ariaLabelledby: heading.id
    },
    heading.element,
    shown.element,
    h('div', { class: 'zx-view-settings__frame', ref: 'frame' },
      h('ul', { class: 'zx-view-settings__list', ref: 'list', ariaLabelledby: shown.id }),
      h('div', { class: 'zx-view-settings__drop-indicator', ref: 'indicator', ariaHidden: 'true', hidden: true })),
    hidden.element,
    h('div', { class: 'zx-view-settings__search-slot', ref: 'searchSlot' }),
    h('ul', { class: 'zx-view-settings__hidden', ref: 'hidden', ariaLabelledby: hidden.id }),
    h('p', { class: 'zx-view-settings__empty', ref: 'empty', hidden: true }));
  }

  /** @returns {HTMLElement} The Group section. */
  _buildGroupSection() {
    const text = this._message('viewSettings.group', 'Group by');
    const heading = this._heading(text);
    this._groupSelect = new Select(null, {
      items: [],
      clearable: true,
      noneLabel: this._message('viewSettings.none', 'None'),
      placeholder: this._message('viewSettings.none', 'None'),
      label: text,
      renderItem: (item) => this._optionContent(/** @type {SelectFieldItem} */ (item)),
      renderValueAdornment: (item) => this._typeGlyph(/** @type {SelectFieldItem} */ (item).type),
      msg: this.options.msg
    });
    this._groupSelect.on('change', (event) => {
      const value = /** @type {CustomEvent} */ (event).detail.value;
      this._setGroup(value == null ? null : String(value));
    });
    const control = /** @type {HTMLElement} */ (this._groupSelect.toElement());
    control.classList.add('zx-view-settings__group');
    return h('section', {
      class: 'zx-view-settings__section',
      dataset: { section: 'grouping' },
      ariaLabelledby: heading.id
    }, heading.element, control);
  }

  /** @returns {HTMLElement} The Board section. */
  _buildBoardSection() {
    const heading = this._heading(this._message('viewSettings.board', 'Board'));
    const columnsText = this._message('viewSettings.columns', 'Columns');
    const lanesText = this._message('viewSettings.swimlanes', 'Swim lanes');
    const renderItem = (item) => this._optionContent(/** @type {SelectFieldItem} */ (item));
    const adornment = (item) => this._typeGlyph(/** @type {SelectFieldItem} */ (item).type);
    this._columnSelect = new Select(null, {
      items: [],
      placeholder: this._message('viewSettings.chooseField', 'Choose a field'),
      label: columnsText,
      renderItem,
      renderValueAdornment: adornment,
      msg: this.options.msg
    });
    this._laneSelect = new Select(null, {
      items: [],
      clearable: true,
      noneLabel: this._message('viewSettings.none', 'None'),
      placeholder: this._message('viewSettings.none', 'None'),
      label: lanesText,
      renderItem,
      renderValueAdornment: adornment,
      msg: this.options.msg
    });
    this._emptyToggle = new Toggle(null, {
      label: this._message('viewSettings.emptyColumns', 'Show empty columns'),
      checked: this._board?.showEmptyColumns !== false
    });
    this._columnSelect.on('change', (event) => {
      const value = /** @type {CustomEvent} */ (event).detail.value;
      this._setBoard({ columnBy: value == null ? null : String(value) });
    });
    this._laneSelect.on('change', (event) => {
      const value = /** @type {CustomEvent} */ (event).detail.value;
      this._setBoard({ swimlaneBy: value == null ? null : String(value) });
    });
    this._emptyToggle.on('change', (event) => {
      this._setBoard({ showEmptyColumns: Boolean(/** @type {CustomEvent} */ (event).detail.checked) });
    });
    const toggle = /** @type {HTMLElement} */ (this._emptyToggle.toElement());
    toggle.classList.add('zx-view-settings__toggle');
    return h('section', {
      class: 'zx-view-settings__section zx-view-settings__board',
      dataset: { section: 'board' },
      ariaLabelledby: heading.id
    },
    heading.element,
    h('div', { class: 'zx-view-settings__setting' },
      h('span', { class: 'zx-view-settings__setting-label', ariaHidden: 'true' }, columnsText),
      this._columnSelect.toElement()),
    h('div', { class: 'zx-view-settings__setting' },
      h('span', { class: 'zx-view-settings__setting-label', ariaHidden: 'true' }, lanesText),
      this._laneSelect.toElement()),
    toggle);
  }

  /**
   * Creates or removes the field search to match the field count.
   * @returns {void}
   */
  _syncSearch() {
    const slot = this.refs.searchSlot;
    if (!slot) return;
    const wanted = this._fields.length > Math.max(0, Number(this.options.searchThreshold) || 0);
    if (wanted && !this._search) {
      const placeholder = this._message('viewSettings.search', 'Find a field');
      this._search = new Search(null, { placeholder, debounce: 0, msg: this.options.msg });
      const element = /** @type {HTMLElement} */ (this._search.toElement());
      element.classList.add('zx-view-settings__search');
      // `Search` names its input from the placeholder but leaves its search landmark unnamed.
      element.setAttribute('aria-label', placeholder);
      const input = /** @type {HTMLInputElement} */ (this._search.refs.input);
      // The native event rather than the component's debounced one: the list narrows per keystroke.
      this.listen(input, 'input', () => this._setQuery(input.value));
      this._search.on('clear', () => this._setQuery(''));
      this._search.on('submit', () => this._addFirstMatch());
      slot.replaceChildren(element);
    } else if (!wanted && this._search) {
      this._search.destroy();
      this._search = null;
      slot.replaceChildren();
      this._query = '';
    }
  }

  /* ------------------------------------------------------------------ rendering -- */

  /**
   * Rebuilds both field lists, then puts focus back: on the control asked for, or else on the same
   * control of the same field when focus was inside the lists. A pointer drag in progress ends —
   * the rows it measured are about to be replaced — and so does a keyboard pick-up, unless the
   * redraw is that pick-up's own step.
   * @param {{id: string, part: 'handle'|'hide'|'add'}|null} [focus=null] Control to focus afterwards.
   * @param {{keepGrab?: boolean}} [options={}] `keepGrab` marks a redraw made by the pick-up itself.
   * @returns {void}
   */
  _renderFields(focus = null, { keepGrab = false } = {}) {
    const list = this.refs.list;
    if (!list) return;
    if (this._drag) this._endDrag(this._drag);
    if (this._grab && !keepGrab) {
      const id = this._grab.id;
      this._grab = null;
      this._announceCanceled(id);
    }
    const restore = focus ?? this._activePart();
    this._rendering = true;
    const byId = new Map(this._fields.map((field) => [field.id, field]));
    const visible = this._order.filter((id) => !this._hidden.has(id));
    const hidden = this._order.filter((id) => this._hidden.has(id));
    const canHideAny = visible.length > 1;

    list.replaceChildren(...visible.map((id) => this._shownRow(/** @type {ViewSettingsField} */ (byId.get(id)), canHideAny)));
    this.refs.shownHeading.textContent = this._message('viewSettings.shown', 'Shown (%1)', visible.length);
    this.refs.hiddenHeading.textContent = this._message('viewSettings.hidden', 'Hidden (%1)', hidden.length);

    const matches = hidden
      .map((id) => /** @type {ViewSettingsField} */ (byId.get(id)))
      .filter((field) => matchesFieldQuery(field, this._query, this._typeLabel(field.type)));
    this.refs.hidden.replaceChildren(...matches.map((field) => this._hiddenRow(field)));
    const empty = /** @type {HTMLElement} */ (this.refs.empty);
    if (matches.length === 0) {
      empty.textContent = hidden.length === 0
        ? this._message('viewSettings.allShown', 'Every field is shown.')
        : this._message('viewSettings.noMatch', 'No hidden field matches “%1”.', this._query.trim());
      empty.hidden = false;
    } else {
      empty.hidden = true;
    }
    this.refs.hidden.hidden = matches.length === 0;
    if (this._grab) {
      const row = this._row(this._grab.id);
      if (row) row.dataset.state = 'grabbed';
      row?.querySelector('.zx-view-settings__handle')?.setAttribute('aria-pressed', 'true');
    }
    this._rendering = false;
    if (restore) this._focusPart(restore);
  }

  /**
   * @param {ViewSettingsField} field Field.
   * @param {boolean} canHideAny Whether more than one field is shown.
   * @returns {HTMLElement}
   */
  _shownRow(field, canHideAny) {
    const locked = Boolean(field.locked);
    const reorder = this._message('viewSettings.reorder', 'Reorder %1', field.label);
    const hide = this._message('viewSettings.hide', 'Hide %1', field.label);
    const handle = locked
      ? h('span', { class: 'zx-view-settings__handle', dataset: { placeholder: 'true' }, ariaHidden: 'true' })
      : h('button', {
        class: 'zx-view-settings__handle',
        type: 'button',
        ariaLabel: reorder,
        ariaDescribedby: this._instructionsId,
        ariaPressed: 'false',
        title: reorder,
        dataset: { action: 'handle' }
      }, icon('drag', { size: 16 }));
    const end = locked
      ? h('span', {
        class: 'zx-view-settings__lock',
        title: this._message('viewSettings.locked', 'Always shown')
      }, icon('lock', { size: 14 }),
      h('span', { class: 'zx-view-settings__sr' }, this._message('viewSettings.locked', 'Always shown')))
      : h('button', {
        class: 'zx-view-settings__hide',
        type: 'button',
        ariaLabel: hide,
        title: canHideAny ? hide : this._message('viewSettings.lastField', 'At least one field stays shown'),
        disabled: !canHideAny,
        dataset: { action: 'hide' }
      }, icon('eye', { size: 16 }));
    return h('li', {
      class: 'zx-view-settings__row',
      dataset: { fieldId: field.id, locked: locked ? 'true' : null }
    }, handle, h('span', { class: 'zx-view-settings__label' }, field.label), this._typeBadge(field.type), end);
  }

  /**
   * @param {ViewSettingsField} field Field.
   * @returns {HTMLElement}
   */
  _hiddenRow(field) {
    const add = this._message('viewSettings.addField', 'Add %1', field.label);
    return h('li', { class: 'zx-view-settings__row', dataset: { fieldId: field.id } },
      h('span', { class: 'zx-view-settings__label' }, highlightMatch(field.label, this._query)),
      this._typeBadge(field.type),
      h('button', {
        class: 'zx-btn zx-view-settings__add',
        type: 'button',
        ariaLabel: add,
        title: add,
        dataset: { kind: 'ghost', size: 'sm', action: 'add' }
      }, icon('plus', { size: 14 }), h('span', {}, this._message('viewSettings.add', 'Add'))));
  }

  /**
   * The type glyph a row shows before its label. The glyph is decorative; the type name is the
   * element's `title` for the pointer and visually hidden text for everyone else. It follows the
   * label in the source, so a row reads "Owner, Text" — the glyph is placed first by CSS.
   * @param {string|undefined} type Field type.
   * @returns {HTMLElement}
   */
  _typeBadge(type) {
    const name = this._typeLabel(type);
    return h('span', { class: 'zx-view-settings__type', title: name },
      this._typeGlyph(type),
      h('span', { class: 'zx-view-settings__sr' }, `, ${name}`));
  }

  /** @param {string|undefined} type @returns {Element} The type's decorative glyph. */
  _typeGlyph(type) {
    return icon(resolveFieldType(type, this.options.types).icon, { size: 14 });
  }

  /** @param {string|undefined} type @returns {string} The translated type name. */
  _typeLabel(type) {
    const resolved = resolveFieldType(type, this.options.types);
    return resolved.key ? this._message(resolved.key, resolved.label) : resolved.label;
  }

  /** @param {SelectFieldItem} item @returns {HTMLElement} Option content with the type glyph. */
  _optionContent(item) {
    return h('span', { class: 'zx-view-settings__option', title: this._typeLabel(item.type) },
      this._typeGlyph(item.type), h('span', {}, item.name));
  }

  /** Refreshes the grouping and board controls from state. @returns {void} */
  _syncGroupControls() {
    const groupIds = groupingFieldIds(this._fields, this.options.grouping);
    const boardIds = groupingFieldIds(this._fields,
      this._boardFields ? { fields: this._boardFields } : this.options.grouping);
    const items = (ids) => ids.map((id) => {
      const field = /** @type {ViewSettingsField} */ (this._fields.find((candidate) => candidate.id === id));
      return { ID: field.id, name: field.label, type: field.type };
    });
    if (this._groupSelect) {
      this._groupSelect.setItems(items(groupIds));
      this._groupSelect.set(this._groupBy, { silent: true });
    }
    if (this._board && this._columnSelect && this._laneSelect && this._emptyToggle) {
      this._columnSelect.setItems(items(boardIds));
      this._columnSelect.set(this._board.columnBy, { silent: true });
      this._laneSelect.setItems(items(boardIds.filter((id) => id !== this._board?.columnBy)));
      this._laneSelect.set(this._board.swimlaneBy, { silent: true });
      this._emptyToggle.set(this._board.showEmptyColumns !== false, { silent: true });
    }
  }

  /* ------------------------------------------------------------------ interaction -- */

  /** @param {string} query @returns {void} */
  _setQuery(query) {
    if (query === this._query) return;
    this._query = query;
    this._renderFields();
  }

  /** Adds the first hidden field matching the query; Enter in the search. @returns {void} */
  _addFirstMatch() {
    const first = this.refs.hidden?.querySelector('.zx-view-settings__row');
    const id = /** @type {HTMLElement|null} */ (first)?.dataset.fieldId;
    if (!id) return;
    this._addFromPanel(id, false);
  }

  /**
   * Shows a field from the hidden list and moves focus somewhere sensible.
   * @param {string} id Field id.
   * @param {boolean} fromButton Whether the Add button was used (focus moves to the next one).
   * @returns {void}
   */
  _addFromPanel(id, fromButton) {
    const rows = [...this.refs.hidden.querySelectorAll('.zx-view-settings__row')];
    const index = rows.findIndex((row) => /** @type {HTMLElement} */ (row).dataset.fieldId === id);
    const following = /** @type {HTMLElement|undefined} */ (rows[index + 1] ?? rows[index - 1])?.dataset.fieldId;
    this.showField(id);
    const field = this._field(id);
    const visible = this._order.filter((candidate) => !this._hidden.has(candidate));
    this._announce(this._message('viewSettings.added', '%1 added at position %2 of %3',
      field?.label ?? id, visible.indexOf(id) + 1, visible.length));
    if (!fromButton) return;
    if (following) this._focusPart({ id: following, part: 'add' });
    else if (this._search) this._search.focus();
    else this._focusPart({ id, part: 'hide' });
  }

  /** @param {MouseEvent} event @returns {void} */
  _onHiddenClick(event) {
    const button = /** @type {Element|null} */ (event.target)?.closest?.('[data-action="add"]');
    const row = button?.closest('.zx-view-settings__row');
    const id = /** @type {HTMLElement|null} */ (row)?.dataset.fieldId;
    if (id) this._addFromPanel(id, true);
  }

  /** @param {MouseEvent} event @returns {void} */
  _onShownClick(event) {
    const button = /** @type {Element|null} */ (event.target)?.closest?.('[data-action="hide"]');
    const row = button?.closest('.zx-view-settings__row');
    const id = /** @type {HTMLElement|null} */ (row)?.dataset.fieldId;
    if (!id || !this._canHide(id)) return;
    const visible = this._order.filter((candidate) => !this._hidden.has(candidate));
    const index = visible.indexOf(id);
    const neighbours = [...visible.slice(index + 1), ...visible.slice(0, index).reverse()];
    const next = neighbours.find((candidate) => this._canHideAfter(candidate, id));
    this.hideField(id);
    this._announce(this._message('viewSettings.hiddenField', '%1 hidden', this._field(id)?.label ?? id));
    if (next) this._focusPart({ id: next, part: 'hide' });
    else this.focus();
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onHandleKeydown(event) {
    const handle = /** @type {Element|null} */ (event.target)?.closest?.('[data-action="handle"]');
    const id = /** @type {HTMLElement|null} */ (handle?.closest('.zx-view-settings__row'))?.dataset.fieldId;
    if (!id) return;
    const movable = this._movableIds();
    const index = movable.indexOf(id);
    if (index < 0) return;
    const grabbed = this._grab?.id === id;
    let target = null;
    if (event.key === 'ArrowUp') target = index - 1;
    else if (event.key === 'ArrowDown') target = index + 1;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = movable.length - 1;
    if (target !== null) {
      event.preventDefault();
      if (target < 0 || target >= movable.length || target === index) return;
      this._moveFromKeyboard(id, target, !grabbed);
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (grabbed) this._drop();
      else this._pickUp(id);
      return;
    }
    if (event.key === 'Escape' && grabbed) {
      event.preventDefault();
      event.stopPropagation();
      this._cancelGrab();
    }
  }

  /** A picked-up field is dropped where it is when focus leaves it. @param {FocusEvent} event @returns {void} */
  _onHandleFocusout(event) {
    if (this._rendering || !this._grab) return;
    const handle = /** @type {Element|null} */ (event.target)?.closest?.('[data-action="handle"]');
    const id = /** @type {HTMLElement|null} */ (handle?.closest('.zx-view-settings__row'))?.dataset.fieldId;
    // Focus is on its way to `relatedTarget`; the drop redraws the rows, so a destination inside
    // them is looked up again afterwards rather than lost with the old row.
    if (id === this._grab.id) this._drop(this._partOf(/** @type {Element|null} */ (event.relatedTarget)));
  }

  /**
   * @param {string} id Field id.
   * @param {number} target Target index among movable fields.
   * @param {boolean} commit Whether the move is final (emitted) or part of a pick-up.
   * @returns {void}
   */
  _moveFromKeyboard(id, target, commit) {
    const next = moveVisibleField(this._order, this._hidden, this._lockedIds(), id, target);
    if (sameList(next, this._order)) return;
    this._order = next;
    this._renderFields({ id, part: 'handle' }, { keepGrab: !commit });
    this._announceMove(id);
    if (commit) {
      this._pushToView();
      this._emitOrder();
    }
  }

  /** @param {string} id @returns {void} */
  _pickUp(id) {
    this._grab = { id, original: [...this._order] };
    this._renderFields({ id, part: 'handle' }, { keepGrab: true });
    const { position, total } = this._position(id);
    this._announce(this._message('viewSettings.grabbed',
      '%1 picked up, position %2 of %3. Use the arrow keys to move it, Space to drop it, Escape to cancel.',
      this._field(id)?.label ?? id, position, total));
  }

  /**
   * @param {{id: string, part: 'handle'|'hide'|'add'}|null} [focus] Control to focus afterwards;
   *   omitted keeps focus on the dropped row's handle when it had it.
   * @returns {void}
   */
  _drop(focus) {
    const grab = this._grab;
    if (!grab) return;
    this._grab = null;
    const changed = !sameList(grab.original, this._order);
    const focused = this._row(grab.id)?.contains(this.el.ownerDocument?.activeElement ?? null);
    this._renderFields(focus !== undefined ? focus : focused ? { id: grab.id, part: 'handle' } : null);
    const { position, total } = this._position(grab.id);
    this._announce(this._message('viewSettings.dropped', '%1 dropped at position %2 of %3',
      this._field(grab.id)?.label ?? grab.id, position, total));
    if (changed) {
      this._pushToView();
      this._emitOrder();
    }
  }

  /** @returns {void} */
  _cancelGrab() {
    const grab = this._grab;
    if (!grab) return;
    this._grab = null;
    this._order = grab.original;
    this._renderFields({ id: grab.id, part: 'handle' });
    this._announceCanceled(grab.id);
  }

  /**
   * Ends whatever reordering is in progress before state changes from outside: a keyboard
   * pick-up returns the row to where it was, and a pointer drag is dropped nowhere.
   * @returns {void}
   */
  _settle() {
    if (this._drag) this._cancelDrag(true);
    if (this._grab) this._cancelGrab();
  }

  /** @param {string} id Field whose move was canceled. @returns {void} */
  _announceCanceled(id) {
    const { position, total } = this._position(id);
    this._announce(this._message('viewSettings.canceled', 'Move canceled. %1 is back at position %2 of %3',
      this._field(id)?.label ?? id, position, total));
  }

  /** @param {PointerEvent} event @returns {void} */
  _onPointerDown(event) {
    if (event.button !== 0 || this._drag) return;
    let handle = /** @type {Element|null} */ (event.target)?.closest?.('[data-action="handle"]');
    let row = /** @type {HTMLElement|null} */ (handle?.closest('.zx-view-settings__row') ?? null);
    const id = row?.dataset.fieldId;
    if (!handle || !row || !id) return;
    if (this._grab) {
      // Dropping a keyboard pick-up rebuilds the rows, so the pressed handle is looked up again.
      this._drop();
      row = this._row(id);
      handle = row?.querySelector('[data-action="handle"]') ?? null;
      if (!row || !handle) return;
    }
    this._drag = {
      id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, y: event.clientY,
      active: false, ending: false, handle: /** @type {HTMLElement} */ (handle), row,
      target: null, scroller: null, startScroll: 0, lastScroll: 0, frame: 0
    };
    try {
      /** @type {HTMLElement} */ (handle).setPointerCapture(event.pointerId);
    } catch {
      // A pointer that already ended cannot be captured; the press finishes on its pointerup.
    }
  }

  /** @param {PointerEvent} event @returns {void} */
  _onPointerMove(event) {
    const drag = this._drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    // A row redrawn out from under the pointer is a drag that can no longer land anywhere.
    if (!drag.row.isConnected) {
      this._cancelDrag();
      return;
    }
    drag.y = event.clientY;
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <= DRAG_THRESHOLD) return;
      this._beginDrag(drag);
    }
    event.preventDefault();
    this._positionDrag(drag);
  }

  /** @param {PointerEvent} event @returns {void} */
  _onPointerUp(event) {
    const drag = this._drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.active || !drag.row.isConnected) {
      this._endDrag(drag);
      return;
    }
    event.preventDefault();
    drag.y = event.clientY;
    this._positionDrag(drag);
    const target = drag.target;
    this._endDrag(drag);
    const next = target === null ? this._order
      : moveVisibleField(this._order, this._hidden, this._lockedIds(), drag.id, target);
    if (sameList(next, this._order)) {
      this._renderFields({ id: drag.id, part: 'handle' });
      return;
    }
    this._order = next;
    this._renderFields({ id: drag.id, part: 'handle' });
    this._announceMove(drag.id);
    this._pushToView();
    this._emitOrder();
  }

  /**
   * Starts a pointer drag: the dragged row follows the pointer, and a frame loop scrolls the
   * nearest scroll container while the pointer rests near its top or bottom edge.
   * @param {DragState} drag Press being promoted.
   * @returns {void}
   */
  _beginDrag(drag) {
    drag.active = true;
    drag.row.dataset.dragging = 'true';
    this.el.setAttribute('data-dragging', 'true');
    this.el.ownerDocument?.getSelection?.()?.removeAllRanges();
    drag.scroller = scrollContainer(this.refs.list);
    drag.startScroll = drag.scroller.scrollTop;
    drag.lastScroll = drag.startScroll;
    this._scheduleAutoScroll(drag);
    const { position, total } = this._position(drag.id);
    this._announce(this._message('viewSettings.dragging', '%1 picked up, position %2 of %3',
      this._field(drag.id)?.label ?? drag.id, position, total));
  }

  /** @param {DragState} drag Active drag. @returns {void} */
  _scheduleAutoScroll(drag) {
    drag.frame = requestAnimationFrame(() => {
      drag.frame = 0;
      if (this._drag !== drag || !drag.active || !drag.scroller) return;
      const delta = autoScrollDelta(drag.y, scrollEdges(drag.scroller),
        this.refs.list.getBoundingClientRect(), SCROLL_EDGE, SCROLL_STEP);
      if (delta !== 0) drag.scroller.scrollTop += delta;
      // Also catches a wheel scroll the reader made mid-drag, which moves the rows under a pointer
      // that has not moved.
      if (drag.scroller.scrollTop !== drag.lastScroll) this._positionDrag(drag);
      this._scheduleAutoScroll(drag);
    });
  }

  /**
   * Moves the dragged row under the pointer — compensating for any scroll since the drag began —
   * and updates the insertion line.
   * @param {DragState} drag Active drag.
   * @returns {void}
   */
  _positionDrag(drag) {
    const scroll = drag.scroller ? drag.scroller.scrollTop : 0;
    drag.lastScroll = scroll;
    const offset = drag.y - drag.startY + (scroll - drag.startScroll);
    drag.row.style.transform = `translateY(${Math.round(offset)}px)`;
    this._updateDropTarget(drag, drag.y);
  }

  /**
   * Resolves and marks the insertion point. The other rows are measured on every call rather than
   * once at the start, so a list scrolled mid-drag still drops where the line says.
   * @param {DragState} drag Active drag.
   * @param {number} y Pointer client y.
   * @returns {void}
   */
  _updateDropTarget(drag, y) {
    const frame = this.refs.frame.getBoundingClientRect();
    const slots = [...this.refs.list.children]
      .filter((row) => row !== drag.row)
      .map((row) => {
        const rect = row.getBoundingClientRect();
        return {
          id: /** @type {HTMLElement} */ (row).dataset.fieldId ?? '',
          top: rect.top - frame.top,
          bottom: rect.bottom - frame.top,
          middle: rect.top + rect.height / 2
        };
      });
    const gap = dropGapIndex(slots.map((slot) => slot.middle), y);
    const locked = this._lockedIds();
    const target = slots.slice(0, gap).filter((slot) => !locked.includes(slot.id)).length;
    drag.target = target;
    // Where the field would land, which locked fields can make differ from the gap under the pointer.
    const next = moveVisibleField(this._order, this._hidden, locked, drag.id, target)
      .filter((id) => !this._hidden.has(id));
    const after = next[next.indexOf(drag.id) + 1];
    const slot = slots.find((candidate) => candidate.id === after);
    const last = slots.at(-1);
    const indicator = /** @type {HTMLElement} */ (this.refs.indicator);
    const top = slot ? slot.top : last ? last.bottom : 0;
    indicator.style.insetBlockStart = `${Math.round(top)}px`;
    indicator.hidden = false;
  }

  /** @param {DragState} drag @returns {void} */
  _endDrag(drag) {
    drag.ending = true;
    if (drag.frame) cancelAnimationFrame(drag.frame);
    drag.frame = 0;
    try {
      drag.handle.releasePointerCapture(drag.pointerId);
    } catch {
      // Already released when the pointer was cancelled or the node detached.
    }
    drag.row.style.transform = '';
    delete drag.row.dataset.dragging;
    this.el.removeAttribute('data-dragging');
    const indicator = /** @type {HTMLElement|undefined} */ (this.refs.indicator);
    if (indicator) indicator.hidden = true;
    if (this._drag === drag) this._drag = null;
  }

  /** @param {boolean} [announce=false] Whether to say so. @returns {void} */
  _cancelDrag(announce = false) {
    const drag = this._drag;
    if (!drag) return;
    const wasActive = drag.active;
    this._endDrag(drag);
    if (!wasActive) return;
    if (announce) {
      const { position, total } = this._position(drag.id);
      this._announce(this._message('viewSettings.canceled', 'Move canceled. %1 is back at position %2 of %3',
        this._field(drag.id)?.label ?? drag.id, position, total));
    }
  }

  /* ------------------------------------------------------------------ state and events -- */

  /** @param {string|null} field @returns {void} */
  _setGroup(field) {
    if (field === this._groupBy) return;
    this._groupBy = field;
    this._emitGroup();
  }

  /** @param {Partial<ViewSettingsBoard>} patch @returns {void} */
  _setBoard(patch) {
    if (!this._board) return;
    const ids = this._fields.map((field) => field.id);
    const next = normalizeBoard({ ...this._board, ...patch }, ids);
    if (sameBoard(next, this._board)) return;
    this._board = next;
    this._syncGroupControls();
    this._emitBoard();
  }

  /** @param {boolean} [withChange=true] Whether `change` follows. @returns {void} */
  _emitOrder(withChange = true) {
    this.emit('fieldorderchange', { order: [...this._order] });
    if (withChange) this._emitChange('order');
  }

  /** @returns {void} */
  _emitVisibility() {
    const state = this.getState();
    this.emit('fieldvisibilitychange', {
      visible: state.fieldOrder.filter((id) => !this._hidden.has(id)),
      hidden: state.hiddenFields
    });
    this._emitChange('visibility');
  }

  /** @returns {void} */
  _emitGroup() {
    this.emit('groupchange', { field: this._groupBy });
    this._emitChange('group');
  }

  /** @returns {void} */
  _emitBoard() {
    if (!this._board) return;
    this.emit('boardchange', { board: { ...this._board } });
    this._emitChange('board');
  }

  /** @param {ViewSettingsChangeReason} reason @returns {void} */
  _emitChange(reason) {
    this.emit('change', { state: this.getState(), reason });
  }

  /** Pushes order and visibility into the bound view. @returns {void} */
  _pushToView() {
    const bound = this._bound;
    if (!bound) return;
    const view = bound.view;
    this._syncing = true;
    try {
      const known = new Set((view.getFieldOrder?.() ?? []).map(String));
      const order = this._order.filter((id) => known.size === 0 || known.has(id));
      view.setFieldOrder(order);
      const viewHidden = new Set((view.getHiddenFields() ?? []).map(String));
      // Shown first, hidden second: a view refuses to hide its last visible field, and hiding
      // before showing could momentarily be exactly that.
      for (const id of order) if (!this._hidden.has(id) && viewHidden.has(id)) view.setFieldVisible(id, true);
      for (const id of order) if (this._hidden.has(id) && !viewHidden.has(id)) view.setFieldVisible(id, false);
    } finally {
      this._syncing = false;
    }
  }

  /**
   * Reads fields, order, and visibility from the bound view. Silent: the view reported its own
   * change already, and echoing it from here would hand the host the same change twice.
   * @param {boolean} withFields Whether the field descriptors are re-read too.
   * @returns {void}
   */
  _pullFromView(withFields) {
    const bound = this._bound;
    if (!bound) return;
    const view = bound.view;
    this._settle();
    if (withFields) {
      const own = new Map(this._fields.map((field) => [field.id, field]));
      // A panel given its own fields lists those and no others; one given none lists the view's.
      const fields = /** @type {ViewSettingsField[]} */ (view.getFields())
        .filter((field) => this._ownIds.size === 0 || this._ownIds.has(String(field.id)))
        .map((field) => mergeViewField(own.get(String(field.id)) ?? null, field));
      this._fields = normalizeViewSettingsFields(fields);
      this._syncSearch();
    }
    this._order = reconcileOrder(this._fields, view.getFieldOrder?.() ?? this._order);
    // The view's visibility is mirrored as it is, locked fields included: `locked` is a promise
    // about what this panel offers, and the view has no such notion.
    this._hidden = normalizeHidden(this._fields, view.getHiddenFields(), false, true);
    const ids = this._fields.map((field) => field.id);
    this._groupBy = normalizeFieldId(this._groupBy, ids);
    if (this._board) this._board = normalizeBoard(this._board, ids);
    this._renderFields();
    if (withFields) this._syncGroupControls();
  }

  /* ------------------------------------------------------------------ helpers -- */

  /** @returns {string[]} Locked field ids. */
  _lockedIds() {
    return this._fields.filter((field) => field.locked).map((field) => field.id);
  }

  /** @returns {string[]} Shown, movable field ids in order. */
  _movableIds() {
    const locked = new Set(this._lockedIds());
    return this._order.filter((id) => !this._hidden.has(id) && !locked.has(id));
  }

  /** @param {string} id @returns {ViewSettingsField|undefined} */
  _field(id) {
    return this._fields.find((field) => field.id === id);
  }

  /** @param {string} id @returns {boolean} Whether the field may be hidden now. */
  _canHide(id) {
    const field = this._field(id);
    if (!field || field.locked || this._hidden.has(id)) return false;
    return this._order.filter((candidate) => !this._hidden.has(candidate)).length > 1;
  }

  /**
   * Whether `candidate` keeps a hide button once `removed` is hidden.
   * @param {string} candidate Field id.
   * @param {string} removed Field being hidden.
   * @returns {boolean}
   */
  _canHideAfter(candidate, removed) {
    const field = this._field(candidate);
    if (!field || field.locked) return false;
    return this._order.filter((id) => !this._hidden.has(id) && id !== removed).length > 1;
  }

  /** @param {string} id @returns {HTMLElement|null} The shown row for a field. */
  _row(id) {
    return /** @type {HTMLElement|undefined} */ ([...(this.refs.list?.children ?? [])]
      .find((row) => /** @type {HTMLElement} */ (row).dataset.fieldId === id)) ?? null;
  }

  /** @param {string} id @returns {{position: number, total: number}} 1-based place in the shown list. */
  _position(id) {
    const visible = this._order.filter((candidate) => !this._hidden.has(candidate));
    return { position: visible.indexOf(id) + 1, total: visible.length };
  }

  /** @param {string} id @returns {void} */
  _announceMove(id) {
    const { position, total } = this._position(id);
    this._announce(this._message('viewSettings.moved', '%1 moved to position %2 of %3',
      this._field(id)?.label ?? id, position, total));
  }

  /** @returns {{id: string, part: 'handle'|'hide'|'add'}|null} The focused row control, if any. */
  _activePart() {
    return this._partOf(this.el.ownerDocument?.activeElement ?? null);
  }

  /**
   * @param {Element|null} element A focus target.
   * @returns {{id: string, part: 'handle'|'hide'|'add'}|null} The row control it is, if any.
   */
  _partOf(element) {
    const active = /** @type {HTMLElement|null} */ (element);
    if (!active || !this.el.contains(active)) return null;
    const part = active.dataset?.action;
    const id = /** @type {HTMLElement|null} */ (active.closest('.zx-view-settings__row'))?.dataset.fieldId;
    if (!id || (part !== 'handle' && part !== 'hide' && part !== 'add')) return null;
    return { id, part };
  }

  /** @param {{id: string, part: 'handle'|'hide'|'add'}} focus @returns {void} */
  _focusPart(focus) {
    const scope = focus.part === 'add' ? this.refs.hidden : this.refs.list;
    const row = [...(scope?.children ?? [])]
      .find((candidate) => /** @type {HTMLElement} */ (candidate).dataset.fieldId === focus.id);
    let control = /** @type {HTMLElement|null} */ (row?.querySelector(`[data-action="${focus.part}"]`) ?? null);
    if (control && /** @type {HTMLButtonElement} */ (control).disabled) control = null;
    if (!control && row) control = /** @type {HTMLElement|null} */ (row.querySelector('button:not(:disabled)'));
    control?.focus();
  }

  /** @param {string} message @returns {void} */
  _announce(message) {
    const status = this.refs.status;
    if (!status) return;
    const token = ++this._announceToken;
    status.textContent = '';
    queueMicrotask(() => {
      if (token === this._announceToken && status.isConnected) status.textContent = message;
    });
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
 * Any change the reader made, after the specific event.
 * @event ViewSettings#change
 * @type {CustomEvent<{state: ViewSettingsState, reason: ViewSettingsChangeReason}>}
 */

/**
 * The field order changed.
 * @event ViewSettings#fieldorderchange
 * @type {CustomEvent<{order: string[]}>}
 */

/**
 * A field was added or hidden.
 * @event ViewSettings#fieldvisibilitychange
 * @type {CustomEvent<{visible: string[], hidden: string[]}>}
 */

/**
 * The grouping field changed; null is no grouping.
 * @event ViewSettings#groupchange
 * @type {CustomEvent<{field: string|null}>}
 */

/**
 * A board setting changed.
 * @event ViewSettings#boardchange
 * @type {CustomEvent<{board: ViewSettingsBoard}>}
 */

/**
 * @typedef {Object} DragState
 * @property {string} id Field being dragged.
 * @property {number} pointerId Pointer that pressed the handle.
 * @property {number} startX Pointer-down client x.
 * @property {number} startY Pointer-down client y.
 * @property {boolean} active Whether the press has travelled far enough to be a drag.
 * @property {boolean} ending Whether the drag is being torn down.
 * @property {HTMLElement} handle Captured handle.
 * @property {number} y Latest pointer client y.
 * @property {HTMLElement} row Dragged row.
 * @property {number|null} target Target index among the movable fields.
 * @property {Element|null} scroller Nearest scroll container of the list.
 * @property {number} startScroll Its scroll position when the drag began.
 * @property {number} lastScroll Its scroll position when the row was last placed.
 * @property {number} frame Pending auto-scroll frame, or 0.
 */

/** @typedef {{ID: string, name: string, type: string}} SelectFieldItem */

/* -------------------------------------------------------------------- pure helpers -- */

/**
 * Validates and clones field descriptors: ids become trimmed strings, a missing label is derived
 * from the id, `type` defaults to `'text'`, and `locked` and `groupable` are read as booleans.
 * @param {ViewSettingsField[]} fields Raw descriptors.
 * @returns {ViewSettingsField[]}
 */
export function normalizeViewSettingsFields(fields) {
  if (fields == null) return [];
  if (!Array.isArray(fields)) throw new TypeError('ViewSettings fields must be an array');
  const seen = new Set();
  /** @type {ViewSettingsField[]} */
  const normalized = [];
  fields.forEach((field, index) => {
    if (!field || typeof field !== 'object' || Array.isArray(field)) {
      throw new TypeError(`ViewSettings field at index ${index} must be an object`);
    }
    const id = String(field.id ?? '').trim();
    if (!id) throw new TypeError(`ViewSettings field at index ${index} requires an id`);
    if (seen.has(id)) throw new TypeError(`Duplicate ViewSettings field: ${id}`);
    seen.add(id);
    /** @type {ViewSettingsField} */
    const entry = {
      ...field,
      id,
      label: String(field.label ?? humanize(id)),
      type: String(field.type ?? 'text').trim() || 'text',
      locked: Boolean(field.locked)
    };
    if (field.groupable !== undefined) entry.groupable = Boolean(field.groupable);
    normalized.push(entry);
  });
  return normalized;
}

/**
 * Resolves a field type to its glyph and English name, through the host's `types` overrides, the
 * alias table (`int` → number, `enum` → select, …), and the built-in map. An unknown type keeps
 * its own name and the text glyph, so a server's new type still shows something sensible.
 * @param {string|null|undefined} type Field type.
 * @param {Record<string, {icon?: string, label?: string}>|null} [overrides=null] Host overrides.
 * @returns {{type: string, icon: string, label: string, key: string|null}} `key` is the message
 *   key of a built-in label, null for a host-supplied or derived one.
 */
export function resolveFieldType(type, overrides = null) {
  const raw = String(type ?? '').trim() || 'text';
  const id = Object.hasOwn(TYPE_ALIASES, raw) ? TYPE_ALIASES[raw] : raw;
  const builtin = Object.hasOwn(FIELD_TYPES, id) ? FIELD_TYPES[id] : null;
  const custom = overrides && typeof overrides === 'object'
    ? (Object.hasOwn(overrides, raw) ? overrides[raw] : Object.hasOwn(overrides, id) ? overrides[id] : null)
    : null;
  const resolvedType = builtin ? id : raw;
  const glyph = String(custom?.icon ?? builtin?.icon ?? 'type');
  if (custom?.label != null) return { type: resolvedType, icon: glyph, label: String(custom.label), key: null };
  if (builtin) return { type: resolvedType, icon: glyph, label: builtin.label, key: builtin.key };
  return { type: resolvedType, icon: glyph, label: humanize(raw), key: null };
}

/**
 * Whether a type sorts records into a few named buckets — what grouping, board columns, and swim
 * lanes need: text, select (and enum), status, priority, boolean, and entity.
 * @param {string|null|undefined} type Field type.
 * @returns {boolean}
 */
export function isDiscreteFieldType(type) {
  const raw = String(type ?? '').trim() || 'text';
  return DISCRETE_TYPES.has(Object.hasOwn(TYPE_ALIASES, raw) ? TYPE_ALIASES[raw] : raw);
}

/**
 * The field ids offered for grouping. `grouping.fields` restricts and orders them; otherwise every
 * field is offered whose `groupable` is `true`, or is not `false` and whose type is discrete.
 * @param {ViewSettingsField[]} fields Normalized fields.
 * @param {boolean|ViewSettingsGrouping|null|undefined} grouping The `grouping` option.
 * @returns {string[]}
 */
export function groupingFieldIds(fields, grouping) {
  if (grouping && typeof grouping === 'object' && Array.isArray(grouping.fields)) {
    const known = new Set(fields.map((field) => field.id));
    return [...new Set(grouping.fields.map(String))].filter((id) => known.has(id));
  }
  return fields
    .filter((field) => field.groupable === true || (field.groupable !== false && isDiscreteFieldType(field.type)))
    .map((field) => field.id);
}

/**
 * Whether a field matches a search query. Case and accents are ignored, every word must appear,
 * and the label, the id, and the type name are all searched — "date" finds every date field.
 * @param {{id: string, label?: string}} field Field.
 * @param {string} query Search text.
 * @param {string} [typeLabel=''] The field's type name.
 * @returns {boolean}
 */
export function matchesFieldQuery(field, query, typeLabel = '') {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = fold(`${field.label ?? ''} ${field.id} ${typeLabel}`);
  return terms.every((term) => haystack.includes(term));
}

/**
 * Moves one shown field to a position among the movable shown fields. Locked fields keep their
 * slots and hidden fields keep their place in the full order; the result is a new full order.
 * An unknown, hidden, or locked id returns an unchanged copy.
 * @param {string[]} order Full field order.
 * @param {Iterable<string>} hidden Hidden field ids.
 * @param {Iterable<string>} locked Locked field ids.
 * @param {string} id Field to move.
 * @param {number} index Target position among the movable shown fields; clamped.
 * @returns {string[]}
 */
export function moveVisibleField(order, hidden, locked, id, index) {
  const hiddenSet = new Set(hidden);
  const lockedSet = new Set(locked);
  const visible = order.filter((candidate) => !hiddenSet.has(candidate));
  const movable = visible.filter((candidate) => !lockedSet.has(candidate));
  const from = movable.indexOf(id);
  if (from < 0) return [...order];
  const requested = Number.isFinite(Number(index)) ? Math.round(Number(index)) : from;
  const target = Math.max(0, Math.min(movable.length - 1, requested));
  if (target === from) return [...order];
  movable.splice(from, 1);
  movable.splice(target, 0, id);
  let next = 0;
  const nextVisible = visible.map((candidate) => (lockedSet.has(candidate) ? candidate : movable[next++]));
  let slot = 0;
  return order.map((candidate) => (hiddenSet.has(candidate) ? candidate : nextVisible[slot++]));
}

/**
 * Shows a hidden field at the end of the shown fields: it leaves the hidden set and moves to just
 * after the last shown field, so "Add" puts it where the reader is looking.
 * @param {string[]} order Full field order.
 * @param {Iterable<string>} hidden Hidden field ids.
 * @param {string} id Field to show.
 * @returns {{order: string[], hidden: string[]}}
 */
export function showFieldInOrder(order, hidden, id) {
  const hiddenSet = new Set(hidden);
  if (!order.includes(id) || !hiddenSet.has(id)) return { order: [...order], hidden: [...hiddenSet] };
  hiddenSet.delete(id);
  const rest = order.filter((candidate) => candidate !== id);
  let last = -1;
  rest.forEach((candidate, index) => {
    if (!hiddenSet.has(candidate)) last = index;
  });
  rest.splice(last + 1, 0, id);
  return { order: rest, hidden: rest.filter((candidate) => hiddenSet.has(candidate)) };
}

/**
 * The gap a pointer is over, given the vertical midpoints of the rows: 0 is above the first row,
 * `middles.length` below the last.
 * @param {number[]} middles Row midpoints, top to bottom.
 * @param {number} y Pointer position.
 * @returns {number}
 */
export function dropGapIndex(middles, y) {
  const index = middles.findIndex((middle) => y < middle);
  return index < 0 ? middles.length : index;
}

/**
 * Merges a bound view's field with the panel's own descriptor for it. The view's label and type
 * win; the panel's descriptor supplies only what the view lacks — `locked`, `groupable`, and a
 * type where the view reports just the `'text'` default a record view fills in for none.
 * @param {ViewSettingsField|null} own The panel's descriptor, if it has one.
 * @param {ViewSettingsField} field The view's descriptor.
 * @returns {ViewSettingsField}
 */
export function mergeViewField(own, field) {
  if (!own) return { ...field };
  const viewType = field.type == null ? '' : String(field.type).trim();
  const type = viewType && viewType !== 'text' ? viewType : own.type ?? (viewType || 'text');
  return { ...own, ...field, label: field.label ?? own.label, type };
}

/**
 * How far a drag should scroll its container this frame: up when the pointer is within `edge`
 * pixels of the top and the list continues above, down likewise at the bottom, otherwise 0.
 * @param {number} y Pointer client y.
 * @param {{top: number, bottom: number}} edges The container's visible top and bottom.
 * @param {{top: number, bottom: number}} list The list's client rectangle.
 * @param {number} [edge=32] Width of the edge band in pixels.
 * @param {number} [step=12] Pixels per frame.
 * @returns {number}
 */
export function autoScrollDelta(y, edges, list, edge = SCROLL_EDGE, step = SCROLL_STEP) {
  if (y < edges.top + edge && list.top < edges.top) return -step;
  if (y > edges.bottom - edge && list.bottom > edges.bottom) return step;
  return 0;
}

/**
 * The nearest ancestor that scrolls vertically, or the document's scrolling element.
 * @param {Element} element Start element.
 * @returns {Element}
 */
function scrollContainer(element) {
  const documentScroller = element.ownerDocument.scrollingElement ?? element.ownerDocument.documentElement;
  let node = element.parentElement;
  while (node && node !== documentScroller && node !== element.ownerDocument.body) {
    const overflow = getComputedStyle(node).overflowY;
    if (/(auto|scroll|overlay)/.test(overflow) && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return documentScroller;
}

/** @param {Element} scroller @returns {{top: number, bottom: number}} Its visible top and bottom. */
function scrollEdges(scroller) {
  const view = scroller.ownerDocument.defaultView;
  if (scroller === scroller.ownerDocument.scrollingElement || scroller === scroller.ownerDocument.documentElement) {
    return { top: 0, bottom: view?.innerHeight ?? scroller.clientHeight };
  }
  const rect = scroller.getBoundingClientRect();
  return { top: rect.top, bottom: rect.bottom };
}

/**
 * Resolves the sections to render, in order: the `sections` option (or the default order) with
 * unknown and duplicate names dropped, and the grouping or board section removed when its option
 * is `false`.
 * @param {unknown} sections The `sections` option.
 * @param {{grouping?: unknown, board?: unknown}} options The `grouping` and `board` options.
 * @returns {ViewSettingsSection[]}
 */
export function normalizeSections(sections, options = {}) {
  const requested = Array.isArray(sections) ? sections.map(String) : [...SECTION_IDS];
  const result = /** @type {ViewSettingsSection[]} */ ([...new Set(requested)]
    .filter((id) => SECTION_IDS.includes(id)));
  return result.filter((id) => {
    if (id === 'grouping') return options.grouping !== false && options.grouping != null;
    if (id === 'board') return Boolean(options.board) && typeof options.board === 'object';
    return true;
  });
}

/**
 * Normalizes board settings. `false` and null mean no board. With `ids`, a field that does not
 * exist becomes null, and a swim-lane field equal to the column field is dropped.
 * @param {unknown} board Raw board settings.
 * @param {string[]|null} [ids=null] Known field ids, or null to skip the check.
 * @returns {ViewSettingsBoard|null}
 */
export function normalizeBoard(board, ids = null) {
  if (!board || typeof board !== 'object') return null;
  const source = /** @type {Partial<ViewSettingsBoard>} */ (board);
  const columnBy = normalizeFieldId(source.columnBy, ids);
  let swimlaneBy = normalizeFieldId(source.swimlaneBy, ids);
  if (swimlaneBy !== null && swimlaneBy === columnBy) swimlaneBy = null;
  return { columnBy, swimlaneBy, showEmptyColumns: source.showEmptyColumns !== false };
}

/** @param {unknown} value @param {string[]|null} ids @returns {string|null} */
function normalizeFieldId(value, ids) {
  if (value == null || value === '') return null;
  const id = String(value);
  return ids && !ids.includes(id) ? null : id;
}

/** @param {ViewSettingsField[]} fields @param {unknown} order @returns {string[]} */
function reconcileOrder(fields, order) {
  const available = fields.map((field) => field.id);
  const allowed = new Set(available);
  const preferred = Array.isArray(order) ? [...new Set(order.map(String))].filter((id) => allowed.has(id)) : [];
  return [...preferred, ...available.filter((id) => !preferred.includes(id))];
}

/**
 * @param {ViewSettingsField[]} fields
 * @param {unknown} hidden
 * @param {boolean} includeDefaults Whether `visible: false` descriptors count as hidden.
 * @param {boolean} [allowLocked=false] Whether locked fields may be hidden (a bound view's state).
 * @returns {Set<string>}
 */
function normalizeHidden(fields, hidden, includeDefaults, allowLocked = false) {
  const movable = new Set(fields.filter((field) => allowLocked || !field.locked).map((field) => field.id));
  const result = new Set(Array.isArray(hidden) ? hidden.map(String).filter((id) => movable.has(id)) : []);
  if (includeDefaults) for (const field of fields) if (field.visible === false && movable.has(field.id)) result.add(field.id);
  // One field always stays shown, the same rule a record view applies.
  if (fields.length && result.size >= fields.length) result.delete(fields[0].id);
  return result;
}

/** @param {unknown} value @returns {2|3|4|5|6} */
function normalizeHeadingLevel(value) {
  const number = Number(value ?? 3);
  return /** @type {2|3|4|5|6} */ (Number.isInteger(number) && number >= 2 && number <= 6 ? number : 3);
}

/** @param {unknown} value @returns {string} Lower-cased text without accents. */
function fold(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** @param {string} value @returns {string} A label derived from an id or type name. */
function humanize(value) {
  const source = String(value).split('.').at(-1) ?? '';
  if (source === 'ID') return 'ID';
  const text = source.replace(/([a-z\d])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : source;
}

/** @param {string[]} left @param {string[]} right @returns {boolean} */
function sameList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/** @param {Set<string>} left @param {Set<string>} right @returns {boolean} */
function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

/** @param {ViewSettingsBoard|null} left @param {ViewSettingsBoard|null} right @returns {boolean} */
function sameBoard(left, right) {
  if (!left || !right) return left === right;
  return left.columnBy === right.columnBy && left.swimlaneBy === right.swimlaneBy
    && left.showEmptyColumns === right.showEmptyColumns;
}
