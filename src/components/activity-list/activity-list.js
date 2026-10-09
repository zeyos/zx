// @ts-check
import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { uid } from '../../core/util.js';
import { skeleton, skeletonText } from '../skeleton/skeleton.js';
import { ActivityItem } from '../activity-item/activity-item.js';

/** @typedef {import('../activity-item/activity-item.js').ActivityItemOptions} ActivityItemOptions */
/** @typedef {string|number|Node|Component|null} ActivityListContent */
/** @typedef {string|((item:ActivityItemOptions,index:number)=>unknown)|null} ActivityGroupReader */
/** @typedef {(group:unknown,items:ActivityItemOptions[])=>ActivityListContent} ActivityGroupLabel */
/**
 * Entry layout. `'default'` gives each entry its avatar, a heading row, and room for content;
 * below 30rem the time moves under the heading. `'compact'` is one line per entry at any width —
 * actor and summary reading as one sentence, the time at the trailing end, a small avatar, and
 * metadata as a muted second line — for a summary card narrower than 30rem.
 * @typedef {'default'|'compact'} ActivityListVariant
 */

/**
 * @typedef {Object} ActivityGroup
 * @property {unknown} id Group identity returned by the configured reader.
 * @property {ActivityItemOptions[]} items Activities in stable source order.
 */

/**
 * @typedef {Object} ActivityListOptions
 * @property {ActivityItemOptions[]} [items=[]] Initial activities in host-supplied chronological order.
 * @property {ActivityGroupReader} [groupBy=null] Property or resolver used for stable grouping.
 * @property {ActivityGroupLabel|null} [groupLabel=null] Group-heading renderer.
 * @property {string} [label='Activity'] Accessible collection name.
 * @property {ActivityListVariant} [variant='default'] Entry layout, reflected as `data-variant` on
 * the root. `'compact'` also makes an avatar descriptor without a `size` small.
 * @property {boolean} [loading=false] Whether initial or incremental activity is loading.
 * @property {number} [loadingCount=3] Placeholder rows shown for an empty loading list.
 * @property {string} [loadingText='Loading activity'] Loading status text.
 * @property {ActivityListContent} [emptyText='No activity yet'] Empty-state content.
 * @property {1|2|3|4|5|6} [groupHeadingLevel=2] Semantic group-heading level.
 * @property {1|2|3|4|5|6} [itemHeadingLevel=3] Default item-heading level.
 * @property {(event:CustomEvent<{items:ActivityItemOptions[]}>)=>void} [ondatachange]
 */

/**
 * Accessible chronological activity collection with stable grouping, loading/empty states, and
 * incremental update methods. Ordering stays host-controlled so paginated and live server results
 * are never silently re-sorted. Item `zx-action` events bubble through the list naturally.
 *
 * @fires ActivityList#datachange
 * @extends {Component<ActivityListOptions>}
 */
export class ActivityList extends Component {
  static cssName = 'activity-list';

  /** @type {Readonly<ActivityListOptions>} */
  static defaults = {
    items: [],
    groupBy: null,
    groupLabel: null,
    label: 'Activity',
    variant: 'default',
    loading: false,
    loadingCount: 3,
    loadingText: 'Loading activity',
    emptyText: 'No activity yet',
    groupHeadingLevel: 2,
    itemHeadingLevel: 3
  };

  /**
   * Creates or enhances an activity collection.
   * @param {Element|string|null} [target=null] Existing container, selector, or null.
   * @param {ActivityListOptions} [options={}] Collection options.
   */
  constructor(target = null, options = {}) {
    super(target, options);
  }

  /** @returns {HTMLElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('section'));
    this.el = root;
    this._createdRoot = created;
    this._original = created ? null : snapshotTarget(root);
    this._cleaned = false;
    this._items = normalizeActivityItems(this.options.items);
    this._loading = Boolean(this.options.loading);
    this._itemComponents = [];
    this._groupSequence = 0;
    root.setAttribute('aria-label', String(this.options.label || 'Activity'));
    this._variant = normalizeActivityListVariant(this.options.variant);
    if (this._variant === 'compact') root.dataset.variant = 'compact';
    try {
      this._renderList();
      return root;
    } catch (error) {
      this._destroyItems();
      if (!created) restoreTarget(root, this._original);
      throw error;
    }
  }

  /**
   * Replaces all activities.
   * @param {ActivityItemOptions[]} items Activities in desired chronological order.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  setItems(items, options = {}) {
    this._items = normalizeActivityItems(items);
    this._renderList();
    if (!options.silent) this._emitDataChange();
    return this;
  }

  /** Returns shallow descriptor copies in current display order. @returns {ActivityItemOptions[]} */
  getItems() {
    return this._items.map(cloneActivityDescriptor);
  }

  /** Returns a shallow descriptor copy by stable host ID. @param {unknown} id @returns {ActivityItemOptions|null} */
  getItem(id) {
    const item = this._items.find((candidate) => Object.is(candidate.id, id));
    return item ? cloneActivityDescriptor(item) : null;
  }

  /**
   * Adds activities after the current source order for older-page or forward-stream updates.
   * @param {ActivityItemOptions|ActivityItemOptions[]} items New activities.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  appendItems(items, options = {}) {
    const additions = normalizeActivityItems(Array.isArray(items) ? items : [items]);
    if (additions.length === 0) return this;
    this._items = normalizeActivityItems([...this._items, ...additions]);
    this._renderList();
    if (!options.silent) this._emitDataChange();
    return this;
  }

  /**
   * Adds activities before the current source order for newest-first live updates.
   * @param {ActivityItemOptions|ActivityItemOptions[]} items New activities.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  prependItems(items, options = {}) {
    const additions = normalizeActivityItems(Array.isArray(items) ? items : [items]);
    if (additions.length === 0) return this;
    this._items = normalizeActivityItems([...additions, ...this._items]);
    this._renderList();
    if (!options.silent) this._emitDataChange();
    return this;
  }

  /**
   * Patches the first activity whose ID is `Object.is`-equal to the requested ID.
   * @param {unknown} id Stable host identifier.
   * @param {Partial<ActivityItemOptions>} values Replacement fields.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  updateItem(id, values, options = {}) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      throw new TypeError('ActivityList update values must be an object');
    }
    const index = this._items.findIndex((candidate) => Object.is(candidate.id, id));
    if (index < 0) return this;
    const next = this._items.slice();
    next[index] = { ...next[index], ...values };
    this._items = normalizeActivityItems(next);
    this._renderList();
    if (!options.silent) this._emitDataChange();
    return this;
  }

  /**
   * Removes the first activity whose ID is `Object.is`-equal to the requested ID.
   * @param {unknown} id Stable host identifier.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  removeItem(id, options = {}) {
    const index = this._items.findIndex((candidate) => Object.is(candidate.id, id));
    if (index < 0) return this;
    this._items.splice(index, 1);
    this._renderList();
    if (!options.silent) this._emitDataChange();
    return this;
  }

  /** Sets initial/incremental loading presentation. @param {boolean} loading @returns {this} */
  setLoading(loading) {
    const next = Boolean(loading);
    if (next === this._loading) return this;
    this._loading = next;
    this._renderList();
    return this;
  }

  /** Restores an enhanced target exactly, or removes an owned list. @returns {void} */
  destroy() {
    if (this._cleaned) return;
    this._cleaned = true;
    this._destroyItems();
    super.destroy();
    if (!this._createdRoot) restoreTarget(this.el, this._original);
  }

  /** @private @returns {void} */
  _renderList() {
    this._destroyItems();
    this._groupSequence = 0;
    const root = /** @type {HTMLElement} */ (this.el);
    root.setAttribute('aria-busy', String(this._loading));
    /** @type {HTMLElement[]} */
    const content = [];
    try {
      if (this._items.length > 0) {
        const groupBy = this.options.groupBy ?? null;
        const groups = groupActivityItems(this._items, groupBy);
        const grouped = groupBy !== null;
        for (const group of groups) content.push(this._createGroup(group, grouped));
      } else if (!this._loading) {
        content.push(h('div', {
          class: 'zx-activity-list__empty', role: 'status'
        }, listContent(this.options.emptyText, 'ActivityList emptyText')));
      }
      if (this._loading) content.push(this._createLoading(this._items.length === 0));
      root.replaceChildren(...content);
    } catch (error) {
      this._destroyItems();
      throw error;
    }
  }

  /** @private @param {ActivityGroup} group @param {boolean} grouped @returns {HTMLElement} */
  _createGroup(group, grouped) {
    const list = h('ol', { class: 'zx-activity-list__items' });
    for (const item of group.items) {
      const component = new ActivityItem(null, {
        ...item,
        avatar: this._variant === 'compact' ? compactAvatar(item.avatar) : item.avatar,
        headingLevel: item.headingLevel ?? this.options.itemHeadingLevel
      });
      this._itemComponents.push(component);
      list.append(component.toElement());
    }
    if (!grouped) return list;
    this._groupSequence += 1;
    const headingId = uid(`zx-activity-list-group-${this._groupSequence}`);
    const label = this.options.groupLabel
      ? this.options.groupLabel(group.id, group.items.map(cloneActivityDescriptor))
      : String(group.id ?? 'Other');
    list.setAttribute('aria-labelledby', headingId);
    return h('section', { class: 'zx-activity-list__group', ariaLabelledby: headingId },
      h(`h${normalizeHeadingLevel(this.options.groupHeadingLevel, 2)}`, {
        class: 'zx-activity-list__group-heading', id: headingId
      }, listContent(label, 'ActivityList groupLabel')), list);
  }

  /** @private @param {boolean} placeholders @returns {HTMLElement} */
  _createLoading(placeholders) {
    const region = h('div', {
      class: 'zx-activity-list__loading', role: 'status', ariaLive: 'polite'
    }, h('span', { class: 'zx-activity-list__loading-label' }, String(this.options.loadingText)));
    if (!placeholders) return region;
    const rows = h('div', { class: 'zx-activity-list__skeletons', ariaHidden: 'true' });
    const count = normalizeLoadingCount(this.options.loadingCount);
    for (let index = 0; index < count; index += 1) {
      rows.append(h('div', { class: 'zx-activity-list__skeleton' },
        skeleton({ width: '2.25rem', height: '2.25rem', radius: 'full' }),
        skeletonText({ lines: 2, heading: true, lastLineWidth: index % 2 ? '58%' : '72%' })));
    }
    region.append(rows);
    return region;
  }

  /** @private @returns {void} */
  _destroyItems() {
    for (const item of this._itemComponents) item.destroy();
    this._itemComponents.length = 0;
  }

  /** @private @returns {void} */
  _emitDataChange() {
    this.emit('datachange', { items: this.getItems() });
  }
}

/**
 * Groups descriptors in first-seen group order while preserving source order within every group.
 * A null reader returns one ungrouped collection. Neither descriptors nor the input array mutate.
 * @param {ActivityItemOptions[]} items Activity descriptors.
 * @param {ActivityGroupReader} groupBy Group reader.
 * @returns {ActivityGroup[]}
 */
export function groupActivityItems(items, groupBy = null) {
  const source = normalizeActivityItems(items);
  if (groupBy === null) return source.length ? [{ id: null, items: source }] : [];
  if (typeof groupBy !== 'string' && typeof groupBy !== 'function') {
    throw new TypeError('ActivityList groupBy must be a property, function, or null');
  }
  const groups = new Map();
  source.forEach((item, index) => {
    const id = typeof groupBy === 'function' ? groupBy(item, index) : item[groupBy];
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(item);
  });
  return Array.from(groups, ([id, grouped]) => ({ id, items: grouped }));
}

/**
 * Validates and shallow-clones activity descriptors, including each slot array. Explicit
 * duplicate IDs are rejected while id-less entries remain valid.
 * @param {unknown} value Candidate descriptor array.
 * @returns {ActivityItemOptions[]}
 */
export function normalizeActivityItems(value) {
  if (!Array.isArray(value)) throw new TypeError('ActivityList items must be an array');
  const ids = new Set();
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError('ActivityList items must be descriptor objects');
    }
    for (const key of ['metadata', 'attachments', 'actions']) {
      if (item[key] !== undefined && !Array.isArray(item[key])) {
        throw new TypeError(`ActivityList item ${key} must be an array`);
      }
    }
    const descriptor = /** @type {ActivityItemOptions} */ (item);
    if (descriptor.id !== null && descriptor.id !== undefined) {
      if (ids.has(descriptor.id)) throw new RangeError(`Duplicate ActivityList id: ${String(descriptor.id)}`);
      ids.add(descriptor.id);
    }
    return cloneActivityDescriptor(descriptor);
  });
}

/** @param {ActivityItemOptions} item @returns {ActivityItemOptions} */
function cloneActivityDescriptor(item) {
  const avatar = item.avatar && isPlainObject(item.avatar) ? { ...item.avatar } : item.avatar;
  return {
    ...item,
    avatar,
    metadata: [...(item.metadata ?? [])],
    attachments: [...(item.attachments ?? [])],
    actions: [...(item.actions ?? [])]
  };
}

/** @param {ActivityListContent} value @param {string} label @returns {Node|string} */
function listContent(value, label) {
  if (value === null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object'
    && typeof (/** @type {{nodeType?:unknown}} */ (value)).nodeType === 'number') {
    return /** @type {Node} */ (value);
  }
  if (value instanceof Component) return value.toElement();
  throw new TypeError(`${label} must be text, a Node, a Component, or null`);
}

/** @param {unknown} value @returns {boolean} */
function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return typeof (/** @type {{nodeType?:unknown}} */ (value)).nodeType !== 'number'
    && !(value instanceof Component);
}

/** @param {unknown} value @param {1|2|3|4|5|6} fallback @returns {1|2|3|4|5|6} */
function normalizeHeadingLevel(value, fallback) {
  const level = Math.trunc(Number(value));
  return /** @type {1|2|3|4|5|6} */ (level >= 1 && level <= 6 ? level : fallback);
}

/**
 * Resolves the entry layout; anything but `'compact'` is the default layout.
 * @param {unknown} value Requested variant.
 * @returns {ActivityListVariant}
 */
export function normalizeActivityListVariant(value) {
  return value === 'compact' ? 'compact' : 'default';
}

/**
 * A compact entry is one line tall, so an avatar descriptor that leaves its size open gets the
 * small one. An explicit size, an Element, or no avatar passes through untouched.
 * @param {ActivityItemOptions['avatar']} avatar Avatar descriptor, Element, or null.
 * @returns {ActivityItemOptions['avatar']}
 */
function compactAvatar(avatar) {
  if (!isPlainObject(avatar)) return avatar;
  const descriptor = /** @type {import('../avatar/avatar.js').AvatarOptions} */ (avatar);
  return descriptor.size == null ? { ...descriptor, size: 'sm' } : descriptor;
}

/** @param {unknown} value @returns {number} */
function normalizeLoadingCount(value) {
  const count = Math.trunc(Number(value));
  return Number.isFinite(count) ? Math.max(1, Math.min(12, count)) : 3;
}

/**
 * Activity descriptors changed through a list mutation method.
 * @event ActivityList#datachange
 * @type {CustomEvent<{items:ActivityItemOptions[]}>}
 */
