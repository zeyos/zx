// @ts-check
import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { captureItemFocus, restoreItemFocus } from '../../core/keyboard.js';
import { skeleton, skeletonText } from '../skeleton/skeleton.js';
import { FileItem, normalizeFileItem } from '../file-item/file-item.js';

/** @typedef {import('../file-item/file-item.js').FileItemOptions} FileItemOptions */
/** @typedef {import('../file-item/file-item.js').FileItemState} FileItemState */

/**
 * @typedef {Object} FileListOptions
 * @property {FileItemOptions[]} [items=[]] Initial files in host-supplied order.
 * @property {string} [label='Files'] Accessible collection name.
 * @property {boolean} [loading=false] Whether initial or incremental files are loading.
 * @property {number} [loadingCount=3] Placeholder rows shown for an empty loading list.
 * @property {string} [loadingText='Loading files'] Loading status text.
 * @property {string|number|Node|Component|null} [emptyText='No files'] Empty-state content.
 * @property {(event: CustomEvent<{id: unknown, index: number, file: Readonly<FileItemState>, href: string, event: MouseEvent}>) => void} [onactivate]
 *   Preventable native-file-link listener.
 * @property {(event: CustomEvent<{id: string, fileId: unknown, index: number, action: object, file: Readonly<FileItemState>, event: MouseEvent}>) => void} [onaction]
 *   Preventable file-action listener.
 * @property {(event: CustomEvent<{items: Readonly<FileItemState>[]}>) => void} [ondatachange]
 *   Collection mutation listener.
 */

/**
 * Accessible collection for durable and transient files. Ordering and mutation are local
 * presentation concerns only; transport, authorization, and persistence remain host-owned.
 *
 * Mutations are reconciled by file `id`: a file whose descriptor did not change keeps its row
 * untouched, a changed one is updated in place through `FileItem.set()`, and only added or removed
 * files create or drop rows. Upload progress can therefore tick through `updateItem()` while the
 * reader's focus — on that file's Cancel button, say — and the list's scroll position stay put.
 * Files without an `id` cannot be matched and are rebuilt on every mutation.
 * @fires FileList#activate
 * @fires FileList#action
 * @fires FileList#datachange
 * @extends {Component<FileListOptions>}
 */
export class FileList extends Component {
  static cssName = 'file-list';

  /** @type {Readonly<FileListOptions>} */
  static defaults = {
    items: [],
    label: 'Files',
    loading: false,
    loadingCount: 3,
    loadingText: 'Loading files',
    emptyText: 'No files'
  };

  /**
   * Creates or enhances a file collection.
   * @param {Element|string|null} [target=null] Existing host, selector, or null.
   * @param {FileListOptions} [options={}] Collection presentation.
   */
  constructor(target = null, options = {}) {
    super(target, options);
  }

  /** @returns {HTMLElement} */
  render() {
    this._createdRoot = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('section'));
    this.el = root;
    this._snapshot = this._createdRoot ? null : snapshotTarget(root);
    this._destroyed = false;
    this._items = normalizeFileListItems(this.options.items);
    this._loading = Boolean(this.options.loading);
    this._itemComponents = [];
    /** @type {Map<FileItem, {row: HTMLElement, state: FileItemState}>} */
    this._itemRecords = new Map();
    this._itemList = /** @type {HTMLElement|null} */ (null);
    this._emptyRegion = /** @type {HTMLElement|null} */ (null);
    this._loadingRegion = /** @type {HTMLElement|null} */ (null);
    this._loadingPlaceholders = false;

    root.setAttribute('aria-label', String(this.options.label || 'Files'));
    this.listen(root, 'zx-activate', (event) => this._forwardActivate(/** @type {CustomEvent} */ (event)));
    this.listen(root, 'zx-action', (event) => this._forwardAction(/** @type {CustomEvent} */ (event)));
    try {
      this._renderList();
      return root;
    } catch (error) {
      this._destroyItems();
      if (!this._createdRoot) restoreTarget(root, this._snapshot);
      throw error;
    }
  }

  /**
   * Replaces every file.
   * @param {FileItemOptions[]} items Ordered file descriptors.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  setItems(items, options = {}) {
    this._items = normalizeFileListItems(items);
    this._renderList();
    if (!options.silent) this._emitDataChange();
    return this;
  }

  /** Returns defensive snapshots in display order. @returns {Readonly<FileItemState>[]} */
  getItems() {
    return this._itemComponents.map((item) => item.getFile());
  }

  /** Returns a defensive snapshot by stable ID. @param {unknown} id File id. @returns {Readonly<FileItemState>|null} */
  getItem(id) {
    const component = this._itemComponents.find((item) => Object.is(item.getFile().id, id));
    return component?.getFile() ?? null;
  }

  /**
   * Adds one file at a bounded index.
   * @param {FileItemOptions} item File descriptor.
   * @param {number} [index] Insertion position; omitted means append.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  addItem(item, index = this._items.length, options = {}) {
    const position = Math.max(0, Math.min(this._items.length, Math.trunc(Number(index)) || 0));
    const next = this._items.slice();
    next.splice(position, 0, normalizeFileItem(item));
    return this.setItems(next, options);
  }

  /**
   * Patches the first file whose ID is `Object.is`-equal to `id`.
   * @param {unknown} id File id.
   * @param {Partial<FileItemOptions>} values Replacement fields.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  updateItem(id, values, options = {}) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      throw new TypeError('FileList update values must be an object');
    }
    const index = this._items.findIndex((item) => Object.is(item.id, id));
    if (index < 0) return this;
    const next = this._items.slice();
    next[index] = normalizeFileItem({ ...next[index], ...values });
    return this.setItems(next, options);
  }

  /**
   * Removes the first file whose ID is `Object.is`-equal to `id`.
   * @param {unknown} id File id.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  removeItem(id, options = {}) {
    const index = this._items.findIndex((item) => Object.is(item.id, id));
    if (index < 0) return this;
    const next = this._items.slice();
    next.splice(index, 1);
    return this.setItems(next, options);
  }

  /** Sets initial/incremental loading presentation. @param {boolean} loading Loading state. @returns {this} */
  setLoading(loading) {
    const next = Boolean(loading);
    if (next === this._loading) return this;
    this._loading = next;
    this._renderList();
    return this;
  }

  /** Restores an enhanced target exactly, or removes an owned collection. @returns {void} */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    const root = this.el;
    this._destroyItems();
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, this._snapshot);
  }

  /**
   * Brings the rendered rows in line with `_items`, keyed by file id, and keeps focus on the
   * control that held it when that control's row was updated or removed.
   * @returns {void}
   */
  _renderList() {
    const root = /** @type {HTMLElement} */ (this.el);
    const focus = captureItemFocus(root, (element) => {
      const index = this._itemComponents.findIndex((item) => item.el?.contains(element));
      return index < 0 ? null : { key: { component: this._itemComponents[index], index }, element: this._itemComponents[index].el };
    });
    root.setAttribute('aria-busy', String(this._loading));
    try {
      this._reconcileItems();
    } catch (error) {
      this._destroyItems();
      throw error;
    }
    /** @type {HTMLElement[]} */
    const content = [];
    if (this._items.length) content.push(/** @type {HTMLElement} */ (this._itemList));
    else if (!this._loading) {
      this._emptyRegion ??= h('div', {
        class: 'zx-file-list__empty', role: 'status'
      }, listContent(this.options.emptyText, 'FileList emptyText'));
      content.push(this._emptyRegion);
    }
    if (this._loading) content.push(this._createLoading(this._items.length === 0));
    syncChildren(root, content);
    restoreItemFocus(root, focus, (key) => {
      const memo = /** @type {{component: FileItem, index: number}} */ (key);
      if (this._itemComponents.includes(memo.component)) return memo.component.el;
      // The focused file went away: its successor — or the new last file — takes over.
      const fallback = this._itemComponents[Math.min(memo.index, this._itemComponents.length - 1)];
      return fallback?.el ?? null;
    });
  }

  /**
   * Keyed reconciliation of `FileItem` children. Rows are only moved when out of place, because
   * detaching a row — even to re-insert it a moment later — takes focus out of it.
   * @returns {void}
   */
  _reconcileItems() {
    const previous = this._itemComponents;
    /** @type {Map<unknown, FileItem>} */
    const byId = new Map();
    for (const component of previous) {
      const id = this._itemRecords.get(component)?.state.id ?? null;
      if (id !== null) byId.set(id, component);
    }
    /** @type {FileItem[]} */
    const next = [];
    for (const descriptor of this._items) {
      const existing = descriptor.id === null ? undefined : byId.get(descriptor.id);
      if (existing) {
        byId.delete(descriptor.id);
        const record = /** @type {{row: HTMLElement, state: FileItemState}} */ (this._itemRecords.get(existing));
        if (!sameDescriptor(record.state, descriptor)) existing.set(descriptor);
        record.state = descriptor;
        next.push(existing);
        continue;
      }
      const component = new FileItem(null, descriptor);
      this._itemRecords.set(component, {
        row: h('li', { class: 'zx-file-list__item' }, component),
        state: descriptor
      });
      next.push(component);
    }
    const kept = new Set(next);
    for (const component of previous) {
      if (kept.has(component)) continue;
      this._itemRecords.get(component)?.row.remove();
      this._itemRecords.delete(component);
      component.destroy();
    }
    this._itemComponents = next;
    if (next.length === 0) return;
    const list = this._itemList ??= h('ol', { class: 'zx-file-list__items' });
    syncChildren(list, next.map((component) => /** @type {{row: HTMLElement}} */ (this._itemRecords.get(component)).row));
  }

  /**
   * The loading region, kept across renders while its shape stays the same so that its live
   * status is not re-announced by every mutation that happens during a load.
   * @param {boolean} placeholders Whether skeleton rows stand in for an empty list.
   * @returns {HTMLElement}
   */
  _createLoading(placeholders) {
    if (this._loadingRegion && this._loadingPlaceholders === placeholders) return this._loadingRegion;
    this._loadingPlaceholders = placeholders;
    this._loadingRegion = this._buildLoading(placeholders);
    return this._loadingRegion;
  }

  /** @param {boolean} placeholders @returns {HTMLElement} */
  _buildLoading(placeholders) {
    const region = h('div', {
      class: 'zx-file-list__loading', role: 'status', ariaLive: 'polite'
    }, h('span', { class: 'zx-file-list__loading-label' }, String(this.options.loadingText)));
    if (!placeholders) return region;
    const rows = h('div', { class: 'zx-file-list__skeletons', ariaHidden: 'true' });
    for (let index = 0; index < normalizeLoadingCount(this.options.loadingCount); index += 1) {
      rows.append(h('div', { class: 'zx-file-list__skeleton' },
        skeleton({ width: '2rem', height: '2rem', radius: 'md' }),
        skeletonText({ lines: 2, lastLineWidth: index % 2 ? '48%' : '64%' })));
    }
    region.append(rows);
    return region;
  }

  /** @returns {void} */
  _destroyItems() {
    for (const item of this._itemComponents) item.destroy();
    this._itemComponents = [];
    this._itemRecords?.clear();
    this._itemList?.replaceChildren();
  }

  /** @param {CustomEvent} event @returns {void} */
  _forwardActivate(event) {
    const component = this._componentForEvent(event);
    if (!component) return;
    const index = this._itemComponents.indexOf(component);
    const detail = /** @type {{href?:string,event?:MouseEvent}} */ (event.detail ?? {});
    const file = component.getFile();
    const forwarded = this.emit('activate', {
      id: file.id,
      index,
      file,
      href: String(detail.href ?? ''),
      event: detail.event
    }, { honorDomCancellation: true });
    if (forwarded.defaultPrevented) event.preventDefault();
  }

  /** @param {CustomEvent} event @returns {void} */
  _forwardAction(event) {
    const component = this._componentForEvent(event);
    if (!component) return;
    const index = this._itemComponents.indexOf(component);
    const detail = /** @type {{id?:string,action?:object,event?:MouseEvent}} */ (event.detail ?? {});
    const file = component.getFile();
    const forwarded = this.emit('action', {
      id: String(detail.id ?? ''),
      fileId: file.id,
      index,
      action: detail.action ?? {},
      file,
      event: detail.event
    }, { honorDomCancellation: true });
    if (forwarded.defaultPrevented) event.preventDefault();
  }

  /** @param {CustomEvent} event @returns {FileItem|null} */
  _componentForEvent(event) {
    if (event.target === this.el) return null;
    return this._itemComponents.find((item) => event.target === item.el) ?? null;
  }

  /** @returns {void} */
  _emitDataChange() {
    this.emit('datachange', { items: this.getItems() });
  }
}

/**
 * Validates, normalizes, and clones file descriptors without mutating the input.
 * Explicit duplicate IDs are rejected; id-less rows remain valid.
 * @param {unknown} value Candidate descriptors.
 * @returns {FileItemState[]}
 */
export function normalizeFileListItems(value) {
  if (!Array.isArray(value)) throw new TypeError('FileList items must be an array');
  const ids = new Set();
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError('FileList items must be descriptor objects');
    }
    const normalized = normalizeFileItem(/** @type {FileItemOptions} */ (item));
    if (normalized.id !== null) {
      if (ids.has(normalized.id)) throw new RangeError(`Duplicate FileList id: ${String(normalized.id)}`);
      ids.add(normalized.id);
    }
    return cloneFileDescriptor(normalized);
  });
}

/** @param {FileItemState} item @returns {FileItemState} */
function cloneFileDescriptor(item) {
  return {
    ...item,
    metadata: item.metadata.map((entry) => ({ ...entry })),
    link: item.link ? { ...item.link } : null,
    actions: [...item.actions],
    locale: item.locale
  };
}

/**
 * Makes `parent`'s children exactly `children`, in order, moving only the nodes that are out of
 * place so that an untouched node — and the focus inside it — never leaves the document.
 * @param {Element} parent Container.
 * @param {Node[]} children Desired children.
 * @returns {void}
 */
function syncChildren(parent, children) {
  const wanted = new Set(children);
  for (const node of [...parent.childNodes]) if (!wanted.has(node)) node.remove();
  children.forEach((node, index) => {
    const current = parent.childNodes[index] ?? null;
    if (current !== node) parent.insertBefore(node, current);
  });
}

/**
 * Structural equality for normalized file descriptors: primitives by value, arrays and plain
 * objects member by member, and Nodes, Components, or functions by identity.
 * @param {unknown} left Previous value.
 * @param {unknown} right Next value.
 * @returns {boolean}
 */
function sameDescriptor(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => sameDescriptor(value, right[index]));
  }
  if (!isPlainRecord(left) || !isPlainRecord(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && sameDescriptor(left[key], right[key]));
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainRecord(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** @param {unknown} value @param {string} label @returns {Node|string} */
function listContent(value, label) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value instanceof Component) return value.toElement();
  if (typeof value === 'object'
    && typeof /** @type {{nodeType?:unknown}} */ (value).nodeType === 'number') {
    return /** @type {Node} */ (value);
  }
  throw new TypeError(`${label} must be text, a Node, a Component, or null`);
}

/** @param {unknown} value @returns {number} */
function normalizeLoadingCount(value) {
  const count = Math.trunc(Number(value));
  return Number.isFinite(count) ? Math.max(1, Math.min(12, count)) : 3;
}

/** File descriptors changed through a list mutation method. @event FileList#datachange @type {CustomEvent<{items:Readonly<FileItemState>[]}>} */
/** A file link activated through the list. @event FileList#activate @type {CustomEvent<{id:unknown,index:number,file:Readonly<FileItemState>,href:string,event:MouseEvent}>} */
/** A file action activated through the list. @event FileList#action @type {CustomEvent<{id:string,fileId:unknown,index:number,action:object,file:Readonly<FileItemState>,event:MouseEvent}>} */
