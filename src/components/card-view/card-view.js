// @ts-check
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { uid } from '../../core/util.js';
import { normalizeViewFieldControls, RecordView, readViewField } from '../view/record-view.js';
import {
  createRecordCard, resolveRecordActions
} from './record-card.js';

/** @typedef {Record<string, any>} ViewRecord */
/** @typedef {import('../view/record-view.js').ViewField} ViewField */
/** @typedef {import('../view/record-view.js').RecordViewOptions} RecordViewOptions */
/** @typedef {import('./record-card.js').RecordCardValueSource} RecordCardValueSource */
/** @typedef {import('./record-card.js').RecordCardPreview} RecordCardPreview */
/** @typedef {import('./record-card.js').RecordCardLink} RecordCardLink */
/** @typedef {import('./record-card.js').RecordCardAction} RecordCardAction */

/**
 * @typedef {Object} CardViewOptions
 * @property {ViewField[]} [fields=[]] Shared ordered field descriptors.
 * @property {ViewRecord[]} [data=[]] Initial records.
 * @property {string|((record:ViewRecord)=>unknown)} [recordId='ID'] Stable record id accessor.
 * @property {import('../view/record-view.js').ViewSort|null} [sort=null] Initial shared sort.
 * @property {'local'|'server'} [sortMode='local'] Local sorting or event-only server sorting.
 * @property {false|'single'|'multi'} [selectable=false] Record selection behavior.
 * @property {'checkbox'|'card'} [selectionTrigger='checkbox'] Select through a checkbox or the non-interactive card surface.
 * @property {unknown[]} [selection=[]] Initially selected record ids.
 * @property {string[]} [fieldOrder=[]] Preferred shared field order.
 * @property {string[]} [hiddenFields=[]] Initially hidden metadata fields.
 * @property {boolean|import('../view/record-view.js').ViewFieldControlsConfig} [fieldControls=true]
 * Whether to expose shared field controls. `true` renders the chooser in the card toolbar and
 * `false` omits it; an object customises its `label` and mounts it into `target`.
 * @property {string|Node|(()=>string|Node)|null} [emptyText=null] Empty-result content.
 * @property {RecordCardValueSource} [titleField=null] Title field id or explicit resolver.
 * @property {RecordCardValueSource} [subtitleField=null] Subtitle field id or explicit resolver.
 * @property {string|((record:ViewRecord,index:number)=>RecordCardPreview)} [preview]
 * Preview field id or explicit resolver.
 * @property {string|((record:ViewRecord,index:number)=>unknown)|null} [previewAlt=null]
 * Preview alt field, literal, or resolver.
 * @property {RecordCardLink|((record:ViewRecord,index:number)=>RecordCardLink)} [link]
 * Safe native title link or resolver.
 * @property {RecordCardAction[]|((record:ViewRecord,index:number)=>RecordCardAction[])} [actions=[]]
 * Listener-free action descriptors or resolver.
 * @property {string|((record:ViewRecord,index:number)=>unknown)|null} [groupBy=null]
 * Field id or local group resolver.
 * @property {unknown[]} [groupOrder=[]] Preferred group ids; missing ids render as empty groups.
 * @property {number|string} [minCardWidth='15rem'] Responsive minimum card width.
 * @property {number|null} [maxColumns=null] Maximum cards per row; null is unconstrained.
 * @property {'outlined'|'raised'|'filled'} [variant='outlined'] Card surface treatment.
 * @property {number} [loadingCount=6] Skeleton cards shown while loading.
 * @property {1|2|3|4|5|6} [headingLevel=3] Per-card title heading level.
 * @property {string|null} [label=null] Accessible collection label; null resolves message
 *   `cardView.label`, "Card view".
 * @property {'tabs'|'roving'} [keyboard='tabs'] Keyboard model. `'tabs'` makes every card, title
 *   link, checkbox, and action its own Tab stop. `'roving'` — recommended for lists — follows the
 *   APG Grid pattern with row focus: the collection is one Tab stop, the arrow keys, Home/End, and
 *   PageUp/PageDown move between cards, Enter activates, Space selects, and the controls inside a
 *   card stay pointer targets with `tabindex="-1"`.
 * @property {boolean} [collapsibleGroups=false] Whether group headings carry a toggle that hides
 *   and shows the group's cards.
 * @property {unknown[]} [collapsedGroups=[]] Group ids that start collapsed.
 * @property {((context:CardGroupHeadingContext)=>Node|string|null|undefined)|null} [renderGroupHeading=null]
 *   Content of a group heading in place of its label. With `collapsibleGroups` it is placed inside
 *   the toggle button, so it must not contain interactive elements.
 * @property {(event:CustomEvent<Record<string,unknown>>)=>void} [onrecordaction]
 * @property {(event:CustomEvent<{id:string,collapsed:boolean,collapsedGroups:string[]}>)=>void} [ongroupcollapse]
 */

/**
 * What `renderGroupHeading` is given for one group.
 * @typedef {Object} CardGroupHeadingContext
 * @property {string} id Normalized group id (`''` for records without a value).
 * @property {string} label Default label.
 * @property {number} count Records in the group.
 * @property {ViewRecord[]} records The group's records in display order.
 * @property {boolean} collapsed Whether the group is collapsed.
 * @property {() => void} toggle Collapses or expands the group.
 */

/**
 * @typedef {Object} CardViewState
 * @property {1} version State schema version.
 * @property {string[]} fieldOrder Shared field order.
 * @property {string[]} hiddenFields Shared hidden fields.
 * @property {import('../view/record-view.js').ViewSort|null} sort Shared sort.
 * @property {string[]} groupOrder Preferred group ids.
 * @property {string} minCardWidth Responsive minimum card width.
 * @property {number|null} maxColumns Maximum cards per row.
 * @property {'outlined'|'raised'|'filled'} variant Surface treatment.
 * @property {string[]} collapsedGroups Collapsed group ids.
 */

/**
 * @typedef {Object} CardRecordGroup
 * @property {string|null} id Normalized group id, null for an ungrouped collection.
 * @property {string} label Display label.
 * @property {ViewRecord[]} records Records in current shared display order.
 */

/**
 * Responsive, schema-friendly record cards with shared fields, sorting, selection, state, groups,
 * safe preview media, native title links, and delegated actions.
 *
 * With `keyboard: 'roving'` the collection follows the WAI-ARIA APG Grid pattern with row focus,
 * the model `Table` uses: the content is a `grid`, each card a focusable `row` (`aria-selected`
 * when selectable, `aria-multiselectable` on the grid for `multi`), and the collection is a single
 * Tab stop. ArrowUp/ArrowDown move to the card above or below — columns are measured from where the
 * cards actually are, so a multi-column layout moves by visual row — ArrowLeft/ArrowRight within a
 * row, Home/End to the first or last card, PageUp/PageDown by a visible page. Enter activates
 * (`recordclick`), Space toggles selection in `selectable` modes (and activates otherwise),
 * Shift+movement extends a `multi` selection, and Ctrl/Cmd+A selects every rendered card. A
 * collapsible group heading is part of the same order: Enter or Space toggles it, ArrowLeft
 * collapses, ArrowRight expands. The current card is kept by record id across `setData`, sorting,
 * grouping, and collapsing, and focus is restored without scrolling.
 * @fires CardView#recordaction
 * @fires CardView#groupcollapse
 * @extends {RecordView}
 */
export class CardView extends RecordView {
  static cssName = 'card-view';

  /** @type {Readonly<CardViewOptions & RecordViewOptions>} */
  static defaults = {
    ...RecordView.defaults,
    selectionTrigger: 'checkbox',
    titleField: null,
    subtitleField: null,
    preview: undefined,
    previewAlt: null,
    link: undefined,
    actions: [],
    groupBy: null,
    groupOrder: [],
    minCardWidth: '15rem',
    maxColumns: null,
    variant: 'outlined',
    loadingCount: 6,
    headingLevel: 3,
    label: null,
    keyboard: 'tabs',
    collapsibleGroups: false,
    collapsedGroups: [],
    renderGroupHeading: null
  };

  /**
   * Creates or enhances a card view.
   * @param {Element|string|null} [target=null] Existing root, selector, or null.
   * @param {CardViewOptions & RecordViewOptions} [options={}] Card and shared view options.
   */
  constructor(target = null, options = {}) {
    super(target, options);
  }

  /** @returns {HTMLElement} Card-view root. */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('section'));
    this.el = root;
    this._cardCreatedRoot = created;
    this._cardOriginal = created ? null : snapshotTarget(root);
    this._cardCleaned = false;
    this._cardNodesById = new Map();
    const options = this._cardOptions();
    this._cardGroupOrder = normalizeGroupOrder(options.groupOrder);
    this._cardMinWidth = normalizeCardWidth(options.minCardWidth);
    this._cardMaxColumns = normalizeMaxColumns(options.maxColumns);
    this._cardVariant = normalizeCardVariant(options.variant);
    this._cardLoadingCount = normalizeLoadingCount(options.loadingCount);
    this._cardHeadingLevel = normalizeHeadingLevel(options.headingLevel);
    this._cardRoving = options.keyboard === 'roving';
    // Per instance, so two grouped views on one page never share heading or list ids.
    this._cardIdPrefix = uid('zx-card-view');
    this._cardCollapsed = new Set(normalizeGroupOrder(options.collapsedGroups));
    /** @type {{kind:'card'|'group', id:unknown}|null} */
    this._cardCurrent = null;
    this._cardCurrentIndex = 0;
    /** @type {HTMLElement|null} */
    this._cardTabStop = null;
    /** @type {number|null} */
    this._cardStickyX = null;
    this._cardMoving = false;
    /** @type {Map<string, HTMLElement>} */
    this._cardHeadersById = new Map();
    /** @type {Map<unknown, string>} */
    this._cardGroupOfId = new Map();
    /** @type {Map<Element, string>} */
    this._cardSectionIds = new Map();
    /** @type {WeakMap<Element, unknown>} */
    this._cardIdOfNode = new WeakMap();
    if (this._cardRoving) root.dataset.keyboard = 'roving';
    try {
      this._initRecordView(root);
      root.setAttribute('aria-label', String(options.label || this.msg('cardView.label')));
      const sort = h('label', { ref: 'sortWrap', class: 'zx-card-view__sort' },
        h('span', { class: 'zx-card-view__sort-label' }, this._message('cardView.sort', 'Sort')),
        h('select', { ref: 'sort', ariaLabel: this._message('cardView.sortCards', 'Sort cards') }));
      const toolbar = h('div', { class: 'zx-record-view__toolbar zx-card-view__toolbar' }, sort);
      if (normalizeViewFieldControls(this.options.fieldControls).enabled) {
        this._mountViewFieldControls(toolbar);
      }
      const content = h('div', { ref: 'content', class: 'zx-card-view__content' });
      root.replaceChildren(toolbar, content);
      this.listen(this.refs.sort, 'change', () => this._changeCardSort());
      this.listen(content, 'click', (event) => this._cardClick(/** @type {MouseEvent} */ (event)));
      this.listen(content, 'dblclick', (event) => this._cardDoubleClick(/** @type {MouseEvent} */ (event)));
      this.listen(content, 'keydown', (event) => {
        if (this._cardRoving) this._cardRovingKeydown(/** @type {KeyboardEvent} */ (event));
        else this._cardKeydown(/** @type {KeyboardEvent} */ (event));
      });
      if (this._cardRoving) {
        this.listen(content, 'focusin', (event) => this._cardFocusIn(/** @type {FocusEvent} */ (event)));
      }
      this.listen(content, 'error', (event) => this._cardPreviewError(event), true);
      this._applyCardLayout();
      this._renderCardSort();
      this._renderCards();
      return root;
    } catch (error) {
      this._removeViewFieldControls();
      if (!created) restoreTarget(root, this._cardOriginal);
      throw error;
    }
  }

  /** Returns shared plus CardView configuration, never records or rendered values. @returns {CardViewState} */
  getViewState() {
    return {
      ...super.getViewState(),
      groupOrder: [...this._cardGroupOrder],
      minCardWidth: this._cardMinWidth,
      maxColumns: this._cardMaxColumns,
      variant: this._cardVariant,
      collapsedGroups: [...this._cardCollapsed]
    };
  }

  /**
   * Restores shared and CardView configuration. Unknown shared fields reconcile in RecordView.
   * @param {Partial<CardViewState>|null} state Saved JSON-safe state.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  setViewState(state, options = {}) {
    const source = state && typeof state === 'object' ? state : {};
    if (Object.prototype.hasOwnProperty.call(source, 'groupOrder')) {
      this._cardGroupOrder = normalizeGroupOrder(source.groupOrder);
    }
    if (Object.prototype.hasOwnProperty.call(source, 'minCardWidth')) {
      this._cardMinWidth = normalizeCardWidth(source.minCardWidth);
    }
    if (Object.prototype.hasOwnProperty.call(source, 'maxColumns')) {
      this._cardMaxColumns = normalizeMaxColumns(source.maxColumns);
    }
    if (Object.prototype.hasOwnProperty.call(source, 'variant')) {
      this._cardVariant = normalizeCardVariant(source.variant);
    }
    if (Object.prototype.hasOwnProperty.call(source, 'collapsedGroups')) {
      this._cardCollapsed = new Set(normalizeGroupOrder(source.collapsedGroups));
    }
    this._applyCardLayout();
    return super.setViewState(source, options);
  }

  /**
   * Collapses or expands one group. A collapsed group keeps its heading and hides its cards.
   * @param {unknown} id Group id, as `groupBy` produces it.
   * @param {boolean} [collapsed=true] Next state.
   * @param {{silent?:boolean}} [options={}] Set `silent` to suppress `groupcollapse` and `statechange`.
   * @returns {this}
   * @fires CardView#groupcollapse
   */
  setGroupCollapsed(id, collapsed = true, options = {}) {
    const groupId = normalizeGroupId(id);
    if (this._cardCollapsed.has(groupId) === Boolean(collapsed)) return this;
    if (collapsed) this._cardCollapsed.add(groupId);
    else this._cardCollapsed.delete(groupId);
    this._renderCards();
    if (!options.silent) {
      this.emit('groupcollapse', { id: groupId, collapsed: Boolean(collapsed), collapsedGroups: [...this._cardCollapsed] });
      this.emit('statechange', { state: this.getViewState(), reason: 'groupcollapse' });
    }
    return this;
  }

  /** Returns the collapsed group ids. @returns {string[]} */
  getCollapsedGroups() {
    return [...this._cardCollapsed];
  }

  /** Restores an enhanced target exactly, or removes an owned root. @returns {void} */
  destroy() {
    if (this._cardCleaned) return;
    this._cardCleaned = true;
    super.destroy();
    if (!this._cardCreatedRoot) restoreTarget(this.el, this._cardOriginal);
  }

  /** @protected @param {string} reason Refresh reason. @returns {void} */
  _refreshView(reason) {
    if (!this.refs?.content) return;
    if (reason === 'selection') this._syncCardSelection();
    else this._renderCards();
    this._renderCardSort();
  }

  /** @private @returns {void} */
  _applyCardLayout() {
    if (!this.el) return;
    const root = /** @type {HTMLElement} */ (this.el);
    root.style.setProperty('--zx-card-view-min-card-width', this._cardMinWidth);
    const basis = this._cardMaxColumns ? `${100 / this._cardMaxColumns}%` : '0%';
    root.style.setProperty('--zx-card-view-column-basis', basis);
    if (this._cardMaxColumns) root.dataset.maxColumns = String(this._cardMaxColumns);
    else delete root.dataset.maxColumns;
  }

  /** @private @returns {void} */
  _renderCardSort() {
    if (!this.refs?.sort || !this.refs?.sortWrap) return;
    const select = /** @type {HTMLSelectElement} */ (this.refs.sort);
    const sort = this.getSort();
    const options = [h('option', {
      value: '', selected: sort === null
    }, this._message('cardView.unsorted', 'Unsorted'))];
    for (const field of this.getFields().filter((candidate) => candidate.sortable)) {
      options.push(h('option', {
        selected: sort?.id === field.id && sort.dir === 'asc',
        dataset: { sortId: field.id, sortDir: 'asc' }
      }, this._message('cardView.sortAscending', '%1 (ascending)', field.label)));
      options.push(h('option', {
        selected: sort?.id === field.id && sort.dir === 'desc',
        dataset: { sortId: field.id, sortDir: 'desc' }
      }, this._message('cardView.sortDescending', '%1 (descending)', field.label)));
    }
    select.replaceChildren(...options);
    /** @type {HTMLElement} */ (this.refs.sortWrap).hidden = options.length === 1;
  }

  /** @private @returns {void} */
  _changeCardSort() {
    const select = /** @type {HTMLSelectElement} */ (this.refs.sort);
    const option = select.selectedOptions[0];
    const id = option?.dataset.sortId;
    if (!id) this.setSort(null);
    else this.setSort(id, option.dataset.sortDir === 'desc' ? 'desc' : 'asc');
  }

  /** @private @returns {void} */
  _renderCards() {
    const content = /** @type {HTMLElement} */ (this.refs.content);
    const documentRef = content.ownerDocument;
    const activeElement = documentRef?.activeElement ?? null;
    const hadFocus = Boolean(activeElement && activeElement !== documentRef.body && content.contains(activeElement));
    // Read by node, not by `data-record-index`: `setData()` has already replaced the records the
    // index pointed into.
    const active = /** @type {Element|null} */ (content.querySelector('.zx-record-card:focus'));
    const activeId = active && this._cardIdOfNode.has(active) ? this._cardIdOfNode.get(active) : null;
    this._cardNodesById = new Map();
    this._cardHeadersById = new Map();
    this._cardGroupOfId = new Map();
    this._cardSectionIds = new Map();
    this._cardTabStop = null;
    if (this._cardRoving) {
      content.removeAttribute('role');
      content.removeAttribute('aria-label');
      content.removeAttribute('aria-multiselectable');
    }
    if (/** @type {HTMLElement} */ (this.el).dataset.loading === 'true') {
      content.replaceChildren(this._createCardSkeletons());
      this._syncCardEmptyFocus(hadFocus);
      return;
    }
    const groups = groupCardRecords(this._viewData, this._cardOptions().groupBy,
      this._cardGroupOrder, this._viewFields, this.msg('cardView.ungrouped'));
    if (this._viewData.length === 0 && groups.length === 0) {
      content.replaceChildren(this._createCardEmpty());
      this._syncCardEmptyFocus(hadFocus);
      return;
    }
    const fields = this.getFields();
    const visibleFields = this.getVisibleFields();
    const sections = groups.map((group, groupIndex) =>
      this._createCardGroup(group, fields, visibleFields, groupIndex));
    content.replaceChildren(...sections);
    if (this._cardRoving) {
      content.setAttribute('role', 'grid');
      content.setAttribute('aria-label', /** @type {HTMLElement} */ (this.el).getAttribute('aria-label') ?? '');
      if (this.options.selectable === 'multi') content.setAttribute('aria-multiselectable', 'true');
      this._syncCardEmptyFocus(false);
      this._syncCardRoving(hadFocus);
      return;
    }
    if (activeId !== null) {
      const next = this._cardNodesById.get(activeId);
      if (next) queueMicrotask(() => next.isConnected && next.focus());
    }
  }

  /** @private @param {CardRecordGroup} group @param {ViewField[]} fields @param {ViewField[]} visibleFields @param {number} groupIndex @returns {HTMLElement} */
  _createCardGroup(group, fields, visibleFields, groupIndex) {
    const options = this._cardOptions();
    const roving = this._cardRoving;
    const headingId = group.id === null ? null : `${this._cardIdPrefix}-group-${safeDomPart(group.id)}-${groupIndex}`;
    const collapsible = group.id !== null && Boolean(options.collapsibleGroups);
    const collapsed = collapsible && this._cardCollapsed.has(/** @type {string} */ (group.id));
    const list = h('ul', {
      class: 'zx-card-view__list',
      id: headingId ? `${headingId}-list` : undefined,
      role: roving ? (group.id === null ? 'rowgroup' : 'none') : undefined,
      ariaLabelledby: headingId ?? undefined,
      hidden: collapsed
    });
    for (const record of group.records) {
      const id = this._viewRecordId(record);
      if (group.id !== null) this._cardGroupOfId.set(id, group.id);
      if (collapsed) continue;
      const index = this._viewData.indexOf(record);
      const card = createRecordCard(record, index, {
        fields,
        visibleFields,
        titleField: options.titleField,
        subtitleField: options.subtitleField,
        preview: options.preview,
        previewAlt: options.previewAlt,
        link: options.link,
        actions: options.actions,
        selectable: this.options.selectable,
        selectionTrigger: options.selectionTrigger,
        selected: this._isViewSelected(id),
        variant: this._cardVariant,
        headingLevel: this._cardHeadingLevel,
        message: (key, ...args) => this.msg(key, ...args)
      });
      if (roving) this._makeCardRow(card, id);
      this._cardNodesById.set(id, card);
      this._cardIdOfNode.set(card, id);
      list.append(card);
    }
    if (group.records.length === 0 && !collapsed) {
      const text = this.msg('cardView.groupEmpty');
      list.append(roving
        ? h('li', { class: 'zx-card-view__group-empty', role: 'row' }, h('span', { role: 'gridcell' }, text))
        : h('li', { class: 'zx-card-view__group-empty' }, text));
    }
    if (group.id === null) return list;
    const header = this._createGroupHeader(group, /** @type {string} */ (headingId), collapsible, collapsed);
    const section = h('section', {
      class: 'zx-card-view__group',
      role: roving ? 'rowgroup' : undefined,
      ariaLabelledby: headingId,
      dataset: { collapsed: collapsible ? String(collapsed) : null }
    }, header, list);
    this._cardSectionIds.set(section, group.id);
    return section;
  }

  /**
   * Builds a group heading: the label (or `renderGroupHeading` content), inside an APG
   * disclosure button when the group can collapse.
   * @private
   * @param {CardRecordGroup} group Group.
   * @param {string} headingId Heading id.
   * @param {boolean} collapsible Whether the group can collapse.
   * @param {boolean} collapsed Whether it is collapsed.
   * @returns {HTMLElement}
   */
  _createGroupHeader(group, headingId, collapsible, collapsed) {
    const id = /** @type {string} */ (group.id);
    const render = this._cardOptions().renderGroupHeading;
    const custom = typeof render === 'function' ? render({
      id,
      label: group.label,
      count: group.records.length,
      records: [...group.records],
      collapsed,
      toggle: () => this.setGroupCollapsed(id, !this._cardCollapsed.has(id))
    }) : null;
    const label = custom == null ? group.label : isNode(custom) ? custom : String(custom);
    const labelNode = h('span', { class: 'zx-card-view__group-label' }, label);
    const roving = this._cardRoving;
    const content = collapsible ? h('button', {
      class: 'zx-card-view__group-toggle',
      type: 'button',
      tabindex: roving ? -1 : undefined,
      ariaExpanded: String(!collapsed),
      ariaControls: `${headingId}-list`,
      dataset: { groupToggle: '' }
    }, icon('chevron-down', { size: 14 }), labelNode) : labelNode;
    const heading = h('h2', { class: 'zx-card-view__group-heading', id: headingId }, content);
    const header = h('div', {
      class: 'zx-card-view__group-header',
      role: roving ? 'row' : undefined,
      ariaExpanded: roving && collapsible ? String(!collapsed) : undefined,
      ariaLabelledby: roving ? headingId : undefined,
      tabindex: roving && collapsible ? -1 : undefined,
      dataset: { cardItem: roving && collapsible ? 'group' : null }
    }, h('div', { class: 'zx-card-view__group-cell', role: roving ? 'rowheader' : undefined }, heading));
    if (roving && collapsible) this._cardHeadersById.set(id, header);
    return header;
  }

  /**
   * Turns a rendered card into a grid row for the roving model: row focus, `aria-selected` when
   * selectable, and the controls inside it out of the Tab order.
   * @private
   * @param {HTMLElement} card Card element.
   * @param {unknown} id Record id.
   * @returns {void}
   */
  _makeCardRow(card, id) {
    card.setAttribute('role', 'row');
    card.tabIndex = -1;
    card.dataset.cardItem = 'card';
    card.removeAttribute('aria-description');
    card.removeAttribute('aria-keyshortcuts');
    if (this.options.selectable) card.setAttribute('aria-selected', String(this._isViewSelected(id)));
    for (const child of card.children) child.setAttribute('role', 'gridcell');
    for (const control of card.querySelectorAll(FOCUSABLE)) {
      if (control !== card) /** @type {HTMLElement} */ (control).tabIndex = -1;
    }
  }

  /**
   * Moves the single Tab stop to the current item after a render — the same record or group by
   * id; else the heading of the collapsed group that now hides the card; else the item now at its
   * old position — and focuses it again, without scrolling, when the collection had focus.
   * @private
   * @param {boolean} hadFocus Whether focus was inside the collection before the render.
   * @returns {void}
   */
  _syncCardRoving(hadFocus) {
    const items = this._cardItems();
    if (items.length === 0) {
      this._syncCardEmptyFocus(hadFocus);
      return;
    }
    let item = this._cardItemFor(this._cardCurrent);
    if (!item && this._cardCurrent?.kind === 'card') {
      const groupId = this._cardGroupOfId.get(this._cardCurrent.id);
      item = groupId === undefined ? null : this._cardHeadersById.get(groupId) ?? null;
    }
    if (!item) item = items[Math.min(Math.max(this._cardCurrentIndex, 0), items.length - 1)];
    this._setCardTabStop(item, items);
    if (hadFocus) item.focus({ preventScroll: true });
  }

  /**
   * @private
   * @param {HTMLElement} item New Tab stop.
   * @param {HTMLElement[]} [items] Every item, when already collected.
   * @returns {void}
   */
  _setCardTabStop(item, items = this._cardItems()) {
    for (const candidate of items) if (candidate !== item) candidate.tabIndex = -1;
    item.tabIndex = 0;
    this._cardTabStop = item;
    const key = this._cardItemKey(item);
    if (key) this._cardCurrent = key;
    this._cardCurrentIndex = Math.max(0, items.indexOf(item));
  }

  /**
   * While loading or empty there is no card to hold focus: the content takes it rather than
   * letting it fall to the document, and gives the Tab order its old shape back afterwards.
   * @private
   * @param {boolean} hold Whether focus was inside and there is nothing to put it on.
   * @returns {void}
   */
  _syncCardEmptyFocus(hold) {
    if (!this._cardRoving) return;
    const content = /** @type {HTMLElement} */ (this.refs.content);
    if (hold) {
      if (!content.hasAttribute('tabindex')) {
        content.tabIndex = -1;
        content.setAttribute('data-empty-focus', '');
      }
      content.focus({ preventScroll: true });
    } else if (content.hasAttribute('data-empty-focus')) {
      content.removeAttribute('tabindex');
      content.removeAttribute('data-empty-focus');
    }
  }

  /** @private @returns {HTMLElement[]} Roving items in display order. */
  _cardItems() {
    return /** @type {HTMLElement[]} */ ([...this.refs.content.querySelectorAll('[data-card-item]')]);
  }

  /** @private @param {HTMLElement} item @returns {{kind:'card'|'group', id:unknown}|null} */
  _cardItemKey(item) {
    if (item.dataset.cardItem === 'group') {
      for (const [id, header] of this._cardHeadersById) if (header === item) return { kind: 'group', id };
      return null;
    }
    return this._cardIdOfNode.has(item) ? { kind: 'card', id: this._cardIdOfNode.get(item) } : null;
  }

  /** @private @param {{kind:'card'|'group', id:unknown}|null} key @returns {HTMLElement|null} */
  _cardItemFor(key) {
    if (!key) return null;
    if (key.kind === 'group') return this._cardHeadersById.get(/** @type {string} */ (key.id)) ?? null;
    return /** @type {HTMLElement|undefined} */ (this._cardNodesById.get(key.id)) ?? null;
  }

  /** @private @param {FocusEvent} event @returns {void} */
  _cardFocusIn(event) {
    const target = /** @type {Element|null} */ (event.target);
    const item = /** @type {HTMLElement|null} */ (target?.closest?.('[data-card-item]') ?? null);
    if (!item || !this.refs.content.contains(item)) return;
    if (this._cardTabStop !== item) this._setCardTabStop(item);
    if (!this._cardMoving) this._cardStickyX = item.getBoundingClientRect().left;
  }

  /**
   * The roving keyboard model; see the class description.
   * @private
   * @param {KeyboardEvent} event Key event.
   * @returns {void}
   */
  _cardRovingKeydown(event) {
    const target = /** @type {Element|null} */ (event.target);
    const item = /** @type {HTMLElement|null} */ (target?.closest?.('[data-card-item]') ?? null);
    if (!item || !this.refs.content.contains(item)) return;
    const onItem = target === item;
    if (!onItem && target?.matches?.(TEXT_ENTRY)) return;
    const items = this._cardItems();
    const index = items.indexOf(item);
    const kind = item.dataset.cardItem;
    const key = event.key;
    const multi = this.options.selectable === 'multi';
    if ((event.ctrlKey || event.metaKey) && (key === 'a' || key === 'A')) {
      if (!multi) return;
      event.preventDefault();
      this.setSelection(this._cardIdsOf(items));
      return;
    }
    if (onItem && (key === 'Enter' || key === ' ')) {
      event.preventDefault();
      if (kind === 'group') {
        const groupId = /** @type {string} */ (this._cardItemKey(item)?.id);
        this.setGroupCollapsed(groupId, !this._cardCollapsed.has(groupId));
        return;
      }
      const record = this._viewData[Number(item.dataset.recordIndex)];
      if (!record) return;
      const id = this._viewRecordId(record);
      if (key === ' ' && this.options.selectable) {
        this.toggleSelection(id);
        return;
      }
      this._activateCard(record, id, Number(item.dataset.recordIndex), event);
      if (this.options.selectable === 'single') this.toggleSelection(id, { selected: true });
      return;
    }
    if (kind === 'group' && onItem && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      event.preventDefault();
      const groupId = /** @type {string} */ (this._cardItemKey(item)?.id);
      this.setGroupCollapsed(groupId, key === 'ArrowLeft');
      return;
    }
    if (!NAVIGATION_KEYS.has(key)) return;
    const rects = items.map((candidate) => candidate.getBoundingClientRect());
    const vertical = key === 'ArrowUp' || key === 'ArrowDown' || key === 'PageUp' || key === 'PageDown';
    const x = vertical ? this._cardStickyX ?? rects[index].left : rects[index].left;
    const page = cardPageSize(viewportHeight(this.refs.content), rects[index].height);
    const next = cardGridTarget(rects, index, key, { page, x });
    if (next === null) return;
    event.preventDefault();
    if (next === index) return;
    const destination = items[next];
    if (!vertical) this._cardStickyX = rects[next].left;
    this._cardMoving = true;
    try {
      this._setCardTabStop(destination, items);
      destination.focus({ preventScroll: true });
      destination.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    } finally {
      this._cardMoving = false;
    }
    if (event.shiftKey && multi) {
      const span = items.slice(Math.min(index, next), Math.max(index, next) + 1);
      this.setSelection([...this.getSelectionIds(), ...this._cardIdsOf(span)]);
    }
  }

  /** @private @param {HTMLElement[]} items @returns {unknown[]} Record ids of the card items. */
  _cardIdsOf(items) {
    return items.filter((item) => item.dataset.cardItem === 'card')
      .map((item) => this._viewData[Number(item.dataset.recordIndex)])
      .filter(Boolean)
      .map((record) => this._viewRecordId(record));
  }

  /** @private @returns {HTMLElement} */
  _createCardSkeletons() {
    const list = h('ul', {
      class: 'zx-card-view__list zx-card-view__skeletons',
      ariaHidden: 'true'
    });
    for (let index = 0; index < this._cardLoadingCount; index += 1) {
      list.append(h('li', { class: 'zx-record-card zx-card-view__skeleton', tabindex: -1 },
        h('span', { class: 'zx-card-view__skeleton-preview zx-skeleton' }),
        h('span', { class: 'zx-card-view__skeleton-line zx-skeleton' }),
        h('span', { class: 'zx-card-view__skeleton-line zx-skeleton' }),
        h('span', { class: 'zx-card-view__skeleton-line zx-skeleton' })));
    }
    return list;
  }

  /** @private @returns {HTMLElement} */
  _createCardEmpty() {
    const empty = this.options.emptyText;
    const value = typeof empty === 'function' ? empty() : empty ?? this.msg('table.empty');
    return h('div', { class: 'zx-card-view__empty', role: 'status' }, isNode(value) ? value : String(value));
  }

  /** @private @returns {void} */
  _syncCardSelection() {
    for (const [id, card] of this._cardNodesById) {
      const selected = this._isViewSelected(id);
      card.dataset.selected = String(selected);
      if (this._cardRoving) {
        if (this.options.selectable) card.setAttribute('aria-selected', String(selected));
      } else if (this.options.selectable) {
        card.setAttribute('aria-description',
          this.msg(selected ? 'recordCard.selected' : 'recordCard.notSelected'));
      }
      const checkbox = /** @type {HTMLInputElement|null} */ (card.querySelector('[data-record-selection]'));
      if (checkbox) checkbox.checked = selected;
    }
  }

  /** @private @param {MouseEvent} event @returns {void} */
  _cardClick(event) {
    const target = /** @type {Element|null} */ (event.target);
    const toggle = /** @type {HTMLElement|null} */ (target?.closest?.('[data-group-toggle]'));
    if (toggle && this.refs.content.contains(toggle)) {
      const section = toggle.closest('.zx-card-view__group');
      const id = section ? this._cardSectionIds.get(section) : undefined;
      if (id !== undefined) this.setGroupCollapsed(id, !this._cardCollapsed.has(id));
      return;
    }
    const card = /** @type {HTMLElement|null} */ (target?.closest?.('.zx-record-card'));
    if (!card || !this.refs.content.contains(card)) return;
    const index = Number(card.dataset.recordIndex);
    const record = this._viewData[index];
    if (!record) return;
    const id = this._viewRecordId(record);
    const selection = /** @type {HTMLInputElement|null} */ (target?.closest?.('[data-record-selection]'));
    if (selection) {
      this.toggleSelection(id, { selected: selection.checked, range: event.shiftKey });
      return;
    }
    const actionElement = /** @type {HTMLElement|null} */ (target?.closest?.('[data-record-action]'));
    if (actionElement) {
      this._activateCardAction(record, id, index, actionElement.dataset.recordAction, event);
      return;
    }
    if (isInteractiveWithin(target, card) || hasCardTextSelection(card)) return;
    if (this.options.selectable && this._cardOptions().selectionTrigger === 'card') {
      this.toggleSelection(id, { range: event.shiftKey });
      card.focus({ preventScroll: true });
      return;
    }
    this._activateCard(record, id, index, event);
    if (this.options.selectable === 'single') this.toggleSelection(id, { selected: true });
  }

  /** @private @param {MouseEvent} event @returns {void} */
  _cardDoubleClick(event) {
    const target = /** @type {Element|null} */ (event.target);
    const card = /** @type {HTMLElement|null} */ (target?.closest?.('.zx-record-card'));
    if (!card || isInteractiveWithin(target, card) || hasCardTextSelection(card)) return;
    const index = Number(card.dataset.recordIndex);
    const record = this._viewData[index];
    if (!record) return;
    this.emit('recorddblclick', { record, id: this._viewRecordId(record), index, event });
  }

  /** @private @param {KeyboardEvent} event @returns {void} */
  _cardKeydown(event) {
    const card = /** @type {HTMLElement|null} */ (event.target instanceof Element
      ? event.target.closest('.zx-record-card') : null);
    if (!card || event.target !== card) return;
    const index = Number(card.dataset.recordIndex);
    const record = this._viewData[index];
    if (!record) return;
    const id = this._viewRecordId(record);
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.options.selectable && this._cardOptions().selectionTrigger === 'card') this.toggleSelection(id);
      else this._activateCard(record, id, index, event);
    } else if (event.key === ' ' && this.options.selectable) {
      event.preventDefault();
      this.toggleSelection(id);
    }
  }

  /** @private @param {ViewRecord} record @param {unknown} id @param {number} index @param {Event} event @returns {void} */
  _activateCard(record, id, index, event) {
    this.emit('recordclick', { record, id, index, event });
  }

  /** @private @param {ViewRecord} record @param {unknown} id @param {number} index @param {string|undefined} actionId @param {MouseEvent} event @returns {void} */
  _activateCardAction(record, id, index, actionId, event) {
    const action = resolveRecordActions(record, index, this._cardOptions().actions)
      .find((candidate) => candidate.id === actionId);
    if (!action || action.disabled) {
      event.preventDefault();
      return;
    }
    if (typeof action.onclick === 'function') action.onclick(record, index, event);
    const emitted = this.emit('recordaction', { record, id, index, action: { ...action }, event });
    if (emitted.defaultPrevented) event.preventDefault();
  }

  /** @private @param {Event} event @returns {void} */
  _cardPreviewError(event) {
    const image = /** @type {HTMLImageElement|null} */ (event.target);
    if (!image?.matches?.('[data-record-preview]')) return;
    const preview = /** @type {HTMLElement|null} */ (image.closest('.zx-record-card__preview'));
    if (preview) preview.dataset.failed = 'true';
    image.hidden = true;
  }

  /** @private @returns {Readonly<CardViewOptions & RecordViewOptions>} */
  _cardOptions() {
    return /** @type {Readonly<CardViewOptions & RecordViewOptions>} */ (this.options);
  }
}

/** Controls inside a card that would otherwise be Tab stops. */
const FOCUSABLE = 'a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

/** Targets inside a card where the arrow keys belong to the control. */
const TEXT_ENTRY = 'input:not([type="checkbox"]):not([type="radio"]),select,textarea,[contenteditable="true"]';

/** Keys the roving model moves on. */
const NAVIGATION_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);

/**
 * Sorts item rectangles into visual rows: items whose tops are within `tolerance` pixels share a
 * row, rows run top to bottom, and items within a row left to right.
 * @param {Array<{top:number,left:number}>} rects Item rectangles in display order.
 * @param {number} [tolerance=4] Pixels two tops may differ by and still share a row.
 * @returns {number[][]} Item indexes per row.
 */
export function cardGridRows(rects, tolerance = 4) {
  const order = rects.map((rect, index) => ({ index, top: Number(rect.top) || 0, left: Number(rect.left) || 0 }))
    .sort((a, b) => a.top - b.top || a.left - b.left);
  /** @type {{top:number, items:{index:number,left:number}[]}[]} */
  const rows = [];
  for (const entry of order) {
    const row = rows.at(-1);
    if (row && Math.abs(entry.top - row.top) <= tolerance) row.items.push(entry);
    else rows.push({ top: entry.top, items: [entry] });
  }
  return rows.map((row) => row.items.sort((a, b) => a.left - b.left).map((entry) => entry.index));
}

/**
 * How many columns the cards are laid out in: the length of the longest visual row.
 * @param {Array<{top:number,left:number}>} rects Item rectangles.
 * @returns {number} At least 1 for a non-empty list, 0 for an empty one.
 */
export function cardColumnCount(rects) {
  return cardGridRows(rects).reduce((max, row) => Math.max(max, row.length), 0);
}

/**
 * Where a navigation key moves in a laid-out card grid. ArrowUp/ArrowDown go to the previous or
 * next visual row and PageUp/PageDown `page` rows, landing on the item nearest to `x` (the column
 * the reader is travelling in); ArrowLeft/ArrowRight move within the row and stop at its ends;
 * Home/End go to the first or last item.
 * @param {Array<{top:number,left:number}>} rects Item rectangles in display order.
 * @param {number} index Current item.
 * @param {string} key `KeyboardEvent.key`.
 * @param {{page?:number, x?:number}} [options={}] Rows per page (default 10) and preferred x.
 * @returns {number|null} Next item index, or null when the key is not a move.
 */
export function cardGridTarget(rects, index, key, options = {}) {
  if (rects.length === 0) return null;
  const current = Math.min(Math.max(Math.trunc(Number(index) || 0), 0), rects.length - 1);
  if (key === 'Home') return 0;
  if (key === 'End') return rects.length - 1;
  const rows = cardGridRows(rects);
  const rowIndex = rows.findIndex((row) => row.includes(current));
  const row = rows[rowIndex];
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const position = row.indexOf(current) + (key === 'ArrowLeft' ? -1 : 1);
    return position < 0 || position >= row.length ? current : row[position];
  }
  const page = Math.max(1, Math.trunc(Number(options.page) || 10));
  const step = { ArrowUp: -1, ArrowDown: 1, PageUp: -page, PageDown: page }[key];
  if (step === undefined) return null;
  const targetRow = rows[Math.min(Math.max(rowIndex + step, 0), rows.length - 1)];
  if (targetRow === row) return current;
  const x = Number.isFinite(Number(options.x)) ? Number(options.x) : Number(rects[current].left) || 0;
  let best = targetRow[0];
  for (const candidate of targetRow) {
    if (Math.abs((Number(rects[candidate].left) || 0) - x) < Math.abs((Number(rects[best].left) || 0) - x)) best = candidate;
  }
  return best;
}

/**
 * How many rows a PageUp or PageDown moves: the rows that fit in the visible height, less one so
 * the row focus leaves stays in view. Falls back when either height is unknown.
 * @param {number} viewport Visible height of the scroll region.
 * @param {number} rowHeight Height of one row of cards.
 * @param {number} [fallback=10] Rows to move when the heights are unusable.
 * @returns {number} At least 1.
 */
export function cardPageSize(viewport, rowHeight, fallback = 10) {
  const visible = Number(viewport);
  const height = Number(rowHeight);
  if (!(visible > 0) || !(height > 0)) return Math.max(1, Math.trunc(fallback) || 10);
  return Math.max(1, Math.floor(visible / height) - 1);
}

/** @param {Element} element @returns {number} Visible height of its nearest vertical scroll container. */
function viewportHeight(element) {
  let node = element.parentElement;
  while (node && node !== element.ownerDocument.body) {
    const overflow = getComputedStyle(node).overflowY;
    if (/(auto|scroll|overlay)/.test(overflow) && node.scrollHeight > node.clientHeight) return node.clientHeight;
    node = node.parentElement;
  }
  return element.ownerDocument.defaultView?.innerHeight ?? 0;
}

/**
 * Groups a cloned record list without mutating records or caller arrays. Explicit order entries
 * are always materialized, including empty groups; remaining values keep first-seen order.
 * @param {ViewRecord[]} records Records in display order.
 * @param {CardViewOptions['groupBy']} groupBy Group field or resolver.
 * @param {unknown[]} [groupOrder=[]] Preferred group ids.
 * @param {ViewField[]} [fields=[]] Complete fields for accessor-aware grouping.
 * @param {string} [ungroupedLabel='Ungrouped'] Label of the group collecting records without a value.
 * @returns {CardRecordGroup[]} Deterministic groups.
 */
export function groupCardRecords(records, groupBy, groupOrder = [], fields = [], ungroupedLabel = 'Ungrouped') {
  if (!Array.isArray(records)) throw new TypeError('Card view records must be an array');
  if (groupBy == null) return records.length ? [{ id: null, label: '', records: [...records] }] : [];
  const preferred = normalizeGroupOrder(groupOrder);
  const groups = new Map(preferred.map((id) => [id, []]));
  for (const [index, record] of records.entries()) {
    const raw = typeof groupBy === 'function'
      ? groupBy(record, index)
      : readGroupField(record, index, groupBy, fields);
    const id = normalizeGroupId(raw);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(record);
  }
  return [...groups].map(([id, grouped]) => ({
    id,
    label: id || ungroupedLabel,
    records: grouped
  }));
}

/** @param {ViewRecord} record @param {number} index @param {string} id @param {ViewField[]} fields @returns {unknown} */
function readGroupField(record, index, id, fields) {
  const field = fields.find((candidate) => candidate.id === id);
  return field ? readViewField(field, record, index) : record?.[id];
}

/** @param {unknown} value @returns {string[]} */
function normalizeGroupOrder(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeGroupId))];
}

/** @param {unknown} value @returns {string} */
function normalizeGroupId(value) {
  return value == null || value === '' ? '' : String(value);
}

/** @param {unknown} value @returns {string} */
export function normalizeCardWidth(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? `${value}px` : '15rem';
  const text = String(value ?? '').trim();
  if (!text || text.length > 128 || /[;{}\u0000-\u001f\u007f]/.test(text)) return '15rem';
  if (/(?:url|image|image-set|cross-fade|element|expression)\s*\(/i.test(text)) return '15rem';
  if (typeof globalThis.CSS?.supports === 'function' && !globalThis.CSS.supports('width', text)) return '15rem';
  return text;
}

/** @param {unknown} value @returns {number|null} */
function normalizeMaxColumns(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.min(12, Math.floor(number))) : null;
}

/** @param {unknown} value @returns {'outlined'|'raised'|'filled'} */
function normalizeCardVariant(value) {
  return value === 'raised' || value === 'filled' ? value : 'outlined';
}

/** @param {unknown} value @returns {number} */
function normalizeLoadingCount(value) {
  const number = Number(value ?? 6);
  return Number.isFinite(number) ? Math.max(1, Math.min(50, Math.floor(number))) : 6;
}

/** @param {unknown} value @returns {1|2|3|4|5|6} */
function normalizeHeadingLevel(value) {
  const number = Number(value ?? 3);
  return /** @type {1|2|3|4|5|6} */ (Number.isInteger(number) && number >= 1 && number <= 6 ? number : 3);
}

/** @param {Element|null} target @param {HTMLElement} card @returns {boolean} */
function isInteractiveWithin(target, card) {
  const interactive = target?.closest?.('a,button,input,select,textarea,summary,[contenteditable="true"],[role="button"]');
  return Boolean(interactive && interactive !== card && card.contains(interactive));
}

/** @param {HTMLElement} card @returns {boolean} */
function hasCardTextSelection(card) {
  const selection = globalThis.getSelection?.();
  return Boolean(selection && !selection.isCollapsed
    && (selection.anchorNode && card.contains(selection.anchorNode)
      || selection.focusNode && card.contains(selection.focusNode)));
}

/** @param {unknown} value @returns {value is Node} */
function isNode(value) {
  return Boolean(value && typeof value === 'object'
    && typeof /** @type {{nodeType?:unknown}} */ (value).nodeType === 'number');
}

/** @param {string} value @returns {string} */
function safeDomPart(value) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'empty';
}
