// @ts-check
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { RecordView, readViewField } from '../view/record-view.js';
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
 * @property {unknown[]} [selection=[]] Initially selected record ids.
 * @property {string[]} [fieldOrder=[]] Preferred shared field order.
 * @property {string[]} [hiddenFields=[]] Initially hidden metadata fields.
 * @property {boolean} [fieldControls=true] Whether to expose shared field controls.
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
 * @property {string} [label='Card view'] Accessible collection label.
 * @property {(event:CustomEvent<Record<string,unknown>>)=>void} [onrecordaction]
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
 * @fires CardView#recordaction
 * @extends {RecordView}
 */
export class CardView extends RecordView {
  static cssName = 'card-view';

  /** @type {Readonly<CardViewOptions & RecordViewOptions>} */
  static defaults = {
    ...RecordView.defaults,
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
    label: 'Card view'
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
    try {
      this._initRecordView(root);
      root.setAttribute('aria-label', String(options.label || 'Card view'));
      const sort = h('label', { ref: 'sortWrap', class: 'zx-card-view__sort' },
        h('span', { class: 'zx-card-view__sort-label' }, 'Sort'),
        h('select', { ref: 'sort', ariaLabel: 'Sort cards' }));
      const toolbar = h('div', { class: 'zx-record-view__toolbar zx-card-view__toolbar' }, sort);
      if (this.options.fieldControls) toolbar.append(this._createViewFieldControls('Fields'));
      const content = h('div', { ref: 'content', class: 'zx-card-view__content' });
      root.replaceChildren(toolbar, content);
      this.listen(this.refs.sort, 'change', () => this._changeCardSort());
      this.listen(content, 'click', (event) => this._cardClick(/** @type {MouseEvent} */ (event)));
      this.listen(content, 'dblclick', (event) => this._cardDoubleClick(/** @type {MouseEvent} */ (event)));
      this.listen(content, 'keydown', (event) => this._cardKeydown(/** @type {KeyboardEvent} */ (event)));
      this.listen(content, 'error', (event) => this._cardPreviewError(event), true);
      this._applyCardLayout();
      this._renderCardSort();
      this._renderCards();
      return root;
    } catch (error) {
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
      variant: this._cardVariant
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
    this._applyCardLayout();
    return super.setViewState(source, options);
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
    const options = [h('option', { value: '', selected: sort === null }, 'Unsorted')];
    for (const field of this.getFields().filter((candidate) => candidate.sortable)) {
      options.push(h('option', {
        selected: sort?.id === field.id && sort.dir === 'asc',
        dataset: { sortId: field.id, sortDir: 'asc' }
      }, `${field.label} (ascending)`));
      options.push(h('option', {
        selected: sort?.id === field.id && sort.dir === 'desc',
        dataset: { sortId: field.id, sortDir: 'desc' }
      }, `${field.label} (descending)`));
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
    const active = /** @type {Element|null} */ (content.querySelector('.zx-record-card:focus'));
    const activeIndex = active ? Number(/** @type {HTMLElement} */ (active).dataset.recordIndex) : -1;
    const activeRecord = activeIndex >= 0 ? this._viewData[activeIndex] : null;
    const activeId = activeRecord ? this._viewRecordId(activeRecord) : null;
    this._cardNodesById = new Map();
    if (/** @type {HTMLElement} */ (this.el).dataset.loading === 'true') {
      content.replaceChildren(this._createCardSkeletons());
      return;
    }
    const groups = groupCardRecords(this._viewData, this._cardOptions().groupBy,
      this._cardGroupOrder, this._viewFields);
    if (this._viewData.length === 0 && groups.length === 0) {
      content.replaceChildren(this._createCardEmpty());
      return;
    }
    const fields = this.getFields();
    const visibleFields = this.getVisibleFields();
    const sections = groups.map((group, groupIndex) =>
      this._createCardGroup(group, fields, visibleFields, groupIndex));
    content.replaceChildren(...sections);
    if (activeId !== null) {
      const next = this._cardNodesById.get(activeId);
      if (next) queueMicrotask(() => next.isConnected && next.focus());
    }
  }

  /** @private @param {CardRecordGroup} group @param {ViewField[]} fields @param {ViewField[]} visibleFields @param {number} groupIndex @returns {HTMLElement} */
  _createCardGroup(group, fields, visibleFields, groupIndex) {
    const options = this._cardOptions();
    const headingId = group.id === null ? null : `zx-card-view-group-${safeDomPart(group.id)}-${groupIndex}`;
    const list = h('ul', {
      class: 'zx-card-view__list',
      ariaLabelledby: headingId ?? undefined
    });
    for (const record of group.records) {
      const index = this._viewData.indexOf(record);
      const id = this._viewRecordId(record);
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
        selected: this._isViewSelected(id),
        variant: this._cardVariant,
        headingLevel: this._cardHeadingLevel
      });
      this._cardNodesById.set(id, card);
      list.append(card);
    }
    if (group.records.length === 0) {
      list.append(h('li', { class: 'zx-card-view__group-empty' }, 'No records in this group.'));
    }
    if (group.id === null) return list;
    return h('section', { class: 'zx-card-view__group', ariaLabelledby: headingId },
      h('h2', { class: 'zx-card-view__group-heading', id: headingId }, group.label), list);
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
      if (this.options.selectable) card.setAttribute('aria-selected', String(selected));
      const checkbox = /** @type {HTMLInputElement|null} */ (card.querySelector('[data-record-selection]'));
      if (checkbox) checkbox.checked = selected;
    }
  }

  /** @private @param {MouseEvent} event @returns {void} */
  _cardClick(event) {
    const target = /** @type {Element|null} */ (event.target);
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
      this._activateCard(record, id, index, event);
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

/**
 * Groups a cloned record list without mutating records or caller arrays. Explicit order entries
 * are always materialized, including empty groups; remaining values keep first-seen order.
 * @param {ViewRecord[]} records Records in display order.
 * @param {CardViewOptions['groupBy']} groupBy Group field or resolver.
 * @param {unknown[]} [groupOrder=[]] Preferred group ids.
 * @param {ViewField[]} [fields=[]] Complete fields for accessor-aware grouping.
 * @returns {CardRecordGroup[]} Deterministic groups.
 */
export function groupCardRecords(records, groupBy, groupOrder = [], fields = []) {
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
    label: id || 'Ungrouped',
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
