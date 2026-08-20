import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { typeahead } from '../../core/keyboard.js';
import { uid } from '../../core/util.js';
import { createReaders, isBranch, pathTo } from '../tree/hierarchy.js';

/** @typedef {import('../tree/hierarchy.js').TreeNode} TreeNode */
/**
 * @typedef {Object} FinderOptions
 * @property {TreeNode[]} [items=[]] Nested nodes.
 * @property {string|((node: TreeNode) => unknown)} [valueKey='ID'] Node ID property or reader.
 * @property {string|((node: TreeNode) => string)} [labelKey='name'] Node label property or reader.
 * @property {string} [childrenKey='children'] Property holding child nodes.
 * @property {unknown[]} [path=[]] Initially selected node IDs, from the root down.
 * @property {((node: TreeNode) => Promise<TreeNode[]>|TreeNode[])|null} [load=null] Lazy child loader.
 * @property {((node: TreeNode) => Node|string|null)|null} [preview=null] Renderer for the leaf preview pane.
 * @property {string} [rootLabel=''] Accessible name of the first column.
 * @property {number} [columnWidth=220] Column width in pixels.
 * @property {number|string|null} [height=320] Component height in pixels or any CSS length.
 * @property {boolean} [icons=true] Whether to render folder and file icons.
 * @property {((node: TreeNode) => Node|string)|null} [renderItem=null] Row renderer.
 * @property {string} [emptyText='Empty'] Text shown in an empty column.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<{path: unknown[], nodes: TreeNode[], node: TreeNode|null}>) => void} [onchange] Path listener.
 * @property {(event: CustomEvent<{node: TreeNode, id: unknown}>) => void} [onactivate] Activation listener.
 * @property {(event: CustomEvent<{error: Error, node: TreeNode, id: unknown}>) => void} [onerror] Loader-failure listener.
 */

/**
 * Miller-columns hierarchy browser: each column lists the children of the row selected in the
 * column to its left, the way the macOS Finder's column view works.
 *
 * Columns are linked listboxes with a single roving tab stop across the whole component: Up and
 * Down move inside a column, Right steps into the selection's children, Left steps back.
 *
 * @fires Finder#change
 * @fires Finder#activate
 * @fires Finder#error
 * @extends {Component<FinderOptions>}
 */
export class Finder extends Component {
  static cssName = 'finder';

  /** @type {FinderOptions} */
  static defaults = {
    items: [],
    valueKey: 'ID',
    labelKey: 'name',
    childrenKey: 'children',
    path: [],
    load: null,
    preview: null,
    rootLabel: '',
    columnWidth: 220,
    height: 320,
    icons: true,
    renderItem: null,
    emptyText: 'Empty'
  };

  /** @returns {HTMLElement} */
  render() {
    // render() runs inside the base constructor, before class-field initializers would run.
    this._items = [];
    this._path = [];
    this._columns = [];
    this._activeColumn = 0;
    /** @type {Map<unknown, Promise<void>>} In-flight lazy loads, keyed by node ID. */
    this._loading = new Map();
    this._pathSequence = 0;
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(this.el);

    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._readers = createReaders(this.options);
    this._childrenKey = this.options.childrenKey ?? 'children';

    root.style.setProperty('--zx-finder-column', `${Number(this.options.columnWidth) || 220}px`);
    if (this.options.height !== null) {
      root.style.blockSize = typeof this.options.height === 'number'
        ? `${this.options.height}px`
        : String(this.options.height);
    }

    this._items = Array.isArray(this.options.items) ? this.options.items.slice() : [];
    this._handleTypeahead = typeahead(
      () => this._columnNodes(this._activeColumn).map((node) => this._readers.label(node)),
      (_label, index) => this._selectAt(this._activeColumn, index, { focus: true })
    );

    this.listen(root, 'click', (event) => this._onClick(/** @type {MouseEvent} */ (event)));
    this.listen(root, 'dblclick', (event) => this._onDoubleClick(/** @type {MouseEvent} */ (event)));
    this.listen(root, 'keydown', (event) => this._onKeydown(/** @type {KeyboardEvent} */ (event)));

    // Paint the root column immediately: setPath() may await a loader, and the component must
    // never be a blank box in the meantime.
    this._render({});
    void this.setPath(this.options.path, { silent: true });
    return root;
  }

  /**
   * Returns the selected IDs from the root down.
   * @returns {unknown[]}
   */
  getPath() {
    return this._path.slice();
  }

  /**
   * Returns the selected nodes from the root down.
   * @returns {TreeNode[]}
   */
  getNodes() {
    let level = this._items;
    const nodes = [];
    for (const id of this._path) {
      const node = level.find((candidate) => Object.is(this._readers.value(candidate), id));
      if (!node) break;
      nodes.push(node);
      level = this._readers.children(node) ?? [];
    }
    return nodes;
  }

  /**
   * Returns the deepest selected node.
   * @returns {TreeNode|null}
   */
  getSelection() {
    const nodes = this.getNodes();
    return nodes.length > 0 ? nodes[nodes.length - 1] : null;
  }

  /**
   * Selects a path, loading every branch along it.
   * @param {unknown[]} ids Node IDs from the root down.
   * @param {{silent?: boolean, focus?: boolean}} [options={}] Behavior.
   * @returns {Promise<this>}
   * @fires Finder#change
   */
  async setPath(ids, { silent = false, focus = false } = {}) {
    const sequence = this._pathSequence + 1;
    this._pathSequence = sequence;
    const wanted = Array.isArray(ids) ? ids.slice() : [];
    const path = [];
    let level = this._items;

    for (const id of wanted) {
      const node = level.find((candidate) => Object.is(this._readers.value(candidate), id));
      if (!node) break;
      path.push(id);
      if (!isBranch(node, this._readers)) break;
      await this._ensureChildren(node);
      // A slower earlier call must not overwrite a newer path once its loaders resolve.
      if (sequence !== this._pathSequence) return this;
      level = this._readers.children(node) ?? [];
    }
    this._path = path;
    this._activeColumn = Math.max(0, path.length - 1);
    this._render({ focus });
    if (!silent) this._emitChange();
    return this;
  }

  /**
   * Reveals and selects a node anywhere in the tree.
   * @param {unknown} id Node ID.
   * @param {{silent?: boolean}} [options={}] Behavior.
   * @returns {Promise<this>}
   */
  async reveal(id, { silent = false } = {}) {
    const chain = pathTo(this._items, id, this._readers);
    if (chain.length === 0) return this;
    return this.setPath(chain.map((node) => this._readers.value(node)), { silent });
  }

  /**
   * Replaces the whole hierarchy and clears the path.
   * @param {TreeNode[]} items Nested nodes.
   * @returns {this}
   */
  setItems(items) {
    this._items = Array.isArray(items) ? items.slice() : [];
    this._path = [];
    this._render({});
    return this;
  }

  /** Focuses the active column. @returns {this} */
  focus() {
    const row = this._activeRow(this._activeColumn) ?? this._rowAt(this._activeColumn, 0);
    row?.focus();
    return this;
  }

  /* ---------------------------------------------------------------- rendering -- */

  /**
   * Rebuilds every column from the current path.
   * @param {{focus?: boolean}} options Behavior.
   * @returns {void}
   */
  _render({ focus = false }) {
    const nodes = this.getNodes();
    // `selectedId` uses `undefined` for "nothing selected" so a node whose own ID is null still
    // renders as selected.
    /** @type {{nodes: TreeNode[], selectedId: unknown, owner: TreeNode|null}[]} */
    const columns = [{ nodes: this._items, selectedId: this._path[0], owner: null }];

    nodes.forEach((node, index) => {
      if (!isBranch(node, this._readers)) return;
      const children = this._readers.children(node) ?? [];
      columns.push({ nodes: children, selectedId: this._path[index + 1], owner: node });
    });

    this._columns = columns;
    this._activeColumn = Math.min(this._activeColumn, columns.length - 1);

    const elements = columns.map((column, index) => this._renderColumn(column, index));
    const leaf = nodes[nodes.length - 1] ?? null;
    if (this.options.preview && leaf && !isBranch(leaf, this._readers)) {
      const content = this.options.preview(leaf);
      if (content) elements.push(h('div', { class: 'zx-finder__preview' }, content));
    }
    this.el.replaceChildren(...elements);
    this._syncTabStop();

    // Keep the deepest column in view as the path grows.
    const last = this.el.lastElementChild;
    last?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (focus) this.focus();
  }

  /**
   * @param {{nodes: TreeNode[], selectedId: unknown, owner: TreeNode|null}} column Column spec.
   * @param {number} index Column index.
   * @returns {HTMLElement}
   */
  _renderColumn(column, index) {
    const label = column.owner
      ? this._readers.label(column.owner)
      : String(this.options.rootLabel || this._message('finder.root', 'Root'));
    const list = h('div', {
      class: 'zx-finder__list',
      role: 'listbox',
      ariaLabel: label,
      dataset: { column: String(index) }
    });

    if (column.nodes.length === 0) {
      const loading = column.owner !== null && this._loading.has(this._readers.value(column.owner));
      list.append(h('div', { class: 'zx-finder__empty' }, loading
        ? this._message('finder.loading', 'Loading…')
        : this._message('finder.empty', this.options.emptyText)));
    }

    for (const node of column.nodes) {
      const id = this._readers.value(node);
      const branch = isBranch(node, this._readers);
      const selected = column.selectedId !== undefined && Object.is(id, column.selectedId);
      const row = h('div', {
        class: 'zx-finder__row',
        id: uid('zx-finder-row'),
        role: 'option',
        tabIndex: -1,
        ariaSelected: String(selected)
      });
      if (this.options.icons) {
        row.append(h('span', { class: 'zx-finder__icon', ariaHidden: 'true' },
          icon(branch ? 'folder' : 'file', { size: 14 })));
      }
      row.append(h('span', { class: 'zx-finder__label' },
        this.options.renderItem ? this.options.renderItem(node) : this._readers.label(node)));
      if (branch) {
        row.append(h('span', { class: 'zx-finder__chevron', ariaHidden: 'true' },
          icon('chevron-right', { size: 11 })));
      }
      row.toggleAttribute('data-branch', branch);
      list.append(row);
    }
    return h('div', { class: 'zx-finder__column' }, list);
  }

  /** Keeps exactly one tab stop across all columns. @returns {void} */
  _syncTabStop() {
    const rows = this.el.querySelectorAll('.zx-finder__row');
    rows.forEach((row) => { row.tabIndex = -1; });
    const active = this._activeRow(this._activeColumn) ?? this._rowAt(this._activeColumn, 0) ?? rows[0];
    if (active) active.tabIndex = 0;
  }

  /* -------------------------------------------------------------- interaction -- */

  /** @param {MouseEvent} event @returns {void} */
  _onClick(event) {
    const row = /** @type {Element} */ (event.target).closest('.zx-finder__row');
    if (!row) return;
    const { column, index } = this._locate(row);
    if (column < 0) return;
    void this._selectAt(column, index, { focus: true });
  }

  /** @param {MouseEvent} event @returns {void} */
  _onDoubleClick(event) {
    const row = /** @type {Element} */ (event.target).closest('.zx-finder__row');
    if (!row) return;
    const { column, index } = this._locate(row);
    const node = this._columnNodes(column)[index];
    // Branches open on double-click; only leaves are "activated".
    if (!node) return;
    if (isBranch(node, this._readers)) void this._enter(column, index);
    else this.emit('activate', { node, id: this._readers.value(node) });
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onKeydown(event) {
    // The preview pane holds arbitrary application markup; its own controls keep their keys.
    if (/** @type {Element} */ (event.target).closest('.zx-finder__preview')) return;
    const column = this._activeColumn;
    const nodes = this._columnNodes(column);
    if (nodes.length === 0 && !['ArrowLeft'].includes(event.key)) return;
    const current = Math.max(0, nodes.findIndex(
      (node) => Object.is(this._readers.value(node), this._columns[column]?.selectedId)));

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        void this._selectAt(column, Math.min(nodes.length - 1, current + 1), { focus: true });
        return;
      case 'ArrowUp':
        event.preventDefault();
        void this._selectAt(column, Math.max(0, current - 1), { focus: true });
        return;
      case 'Home':
        event.preventDefault();
        void this._selectAt(column, 0, { focus: true });
        return;
      case 'End':
        event.preventDefault();
        void this._selectAt(column, nodes.length - 1, { focus: true });
        return;
      case 'ArrowRight': {
        event.preventDefault();
        const node = nodes[current];
        if (!node || !isBranch(node, this._readers)) return;
        void this._enter(column, current);
        return;
      }
      case 'ArrowLeft':
        event.preventDefault();
        if (column === 0) return;
        this._path = this._path.slice(0, column);
        this._activeColumn = column - 1;
        this._render({ focus: true });
        this._emitChange();
        return;
      case 'Enter': {
        event.preventDefault();
        const node = nodes[current];
        if (!node) return;
        if (isBranch(node, this._readers)) void this._enter(column, current);
        else this.emit('activate', { node, id: this._readers.value(node) });
        return;
      }
      default:
        this._handleTypeahead(event);
    }
  }

  /**
   * Selects a row in a column, truncating the path below it.
   * @param {number} column Column index.
   * @param {number} index Row index inside the column.
   * @param {{focus?: boolean}} [options={}] Behavior.
   * @returns {Promise<void>}
   * @fires Finder#change
   */
  async _selectAt(column, index, { focus = false } = {}) {
    const node = this._columnNodes(column)[index];
    if (!node) return;
    const id = this._readers.value(node);
    // Re-selecting the row that is already selected would replace the element under the pointer
    // and break the browser's own double-click detection.
    if (this._path.length === column + 1 && Object.is(this._path[column], id)) {
      this._activeColumn = column;
      this._syncTabStop();
      if (focus) this.focus();
      return;
    }
    this._path = [...this._path.slice(0, column), id];
    this._activeColumn = column;
    if (isBranch(node, this._readers)) await this._ensureChildren(node);
    this._render({ focus });
    this._emitChange();
  }

  /**
   * Moves into a branch's children column.
   * @param {number} column Column index.
   * @param {number} index Row index.
   * @returns {Promise<void>}
   */
  async _enter(column, index) {
    await this._selectAt(column, index);
    const children = this._columnNodes(column + 1);
    if (children.length === 0) {
      this._activeColumn = column;
      this._syncTabStop();
      this.focus();
      return;
    }
    this._activeColumn = column + 1;
    // Entering an unvisited column lands on its first row.
    if (this._path.length <= column + 1) await this._selectAt(column + 1, 0, { focus: true });
    else {
      this._syncTabStop();
      this.focus();
    }
  }

  /* ------------------------------------------------------------------ internals -- */

  /**
   * Loads a branch's children through the configured loader, once.
   * @param {TreeNode} node Branch node.
   * @returns {Promise<void>}
   */
  async _ensureChildren(node) {
    const loaded = this._readers.children(node);
    if (!this.options.load || (loaded && loaded.length > 0)) return;
    const id = this._readers.value(node);
    // One in-flight request per branch, so a double navigation never calls the loader twice.
    const pending = this._loading.get(id);
    if (pending) return pending;
    const request = (async () => {
      try {
        const children = await this.options.load(node);
        node[this._childrenKey] = Array.isArray(children) ? children : [];
        if (node[this._childrenKey].length === 0) node.hasChildren = false;
      } catch (error) {
        node[this._childrenKey] = [];
        this.emit('error', { error, node, id });
      } finally {
        this._loading.delete(id);
      }
    })();
    this._loading.set(id, request);
    return request;
  }

  /** @param {number} column @returns {TreeNode[]} */
  _columnNodes(column) {
    return this._columns[column]?.nodes ?? [];
  }

  /** @param {Element} row @returns {{column: number, index: number}} */
  _locate(row) {
    const list = row.closest('.zx-finder__list');
    if (!list) return { column: -1, index: -1 };
    return {
      column: Number(list.dataset.column),
      index: [...list.querySelectorAll('.zx-finder__row')].indexOf(row)
    };
  }

  /** @param {number} column @param {number} index @returns {HTMLElement|null} */
  _rowAt(column, index) {
    const list = this.el.querySelector(`.zx-finder__list[data-column="${column}"]`);
    return /** @type {HTMLElement|null} */ (list?.querySelectorAll('.zx-finder__row')[index] ?? null);
  }

  /** @param {number} column @returns {HTMLElement|null} */
  _activeRow(column) {
    const list = this.el.querySelector(`.zx-finder__list[data-column="${column}"]`);
    return /** @type {HTMLElement|null} */ (list?.querySelector('[aria-selected="true"]') ?? null);
  }

  /** @returns {void} */
  _emitChange() {
    const nodes = this.getNodes();
    this.emit('change', {
      path: this.getPath(),
      nodes,
      node: nodes.length > 0 ? nodes[nodes.length - 1] : null
    });
  }

  /** @param {string} key @param {string} fallback @returns {string} */
  _message(key, fallback) {
    const message = this.msg(key);
    return message === key ? fallback : message;
  }

  /** Restores an enhanced target to the markup it had before the takeover. @returns {void} */
  destroy() {
    // Invalidate any in-flight path resolution so a late loader cannot re-render a dead component.
    this._pathSequence += 1;
    const root = this.el;
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, this._snapshot);
  }
}

/** Path change. @event Finder#change @type {CustomEvent<{path: unknown[], nodes: TreeNode[], node: TreeNode|null}>} */
/** Leaf activated by Enter or double-click. @event Finder#activate @type {CustomEvent<{node: TreeNode, id: unknown}>} */
/** A lazy loader rejected. @event Finder#error @type {CustomEvent<{error: Error, node: TreeNode, id: unknown}>} */
