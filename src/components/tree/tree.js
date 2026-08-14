import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { typeahead } from '../../core/keyboard.js';
import { uid } from '../../core/util.js';
import {
  createReaders, descendants, filterTree, findNode, flattenVisible, isBranch, pathTo, walk
} from './hierarchy.js';

/** @typedef {import('./hierarchy.js').TreeNode} TreeNode */
/**
 * @typedef {Object} TreeOptions
 * @property {TreeNode[]} [items=[]] Nested nodes.
 * @property {string|((node: TreeNode) => unknown)} [valueKey='ID'] Node ID property or reader.
 * @property {string|((node: TreeNode) => string)} [labelKey='name'] Node label property or reader.
 * @property {string} [childrenKey='children'] Property holding child nodes.
 * @property {unknown[]} [expanded=[]] Initially expanded node IDs.
 * @property {false|'single'|'multi'} [selection='single'] Selection mode.
 * @property {unknown[]} [selected=[]] Initially selected node IDs.
 * @property {boolean} [checkboxes=false] Whether to render tri-state checkboxes.
 * @property {unknown[]} [checked=[]] Initially checked node IDs.
 * @property {boolean} [icons=true] Whether to render folder and file icons.
 * @property {((node: TreeNode) => Node|string)|null} [renderLabel=null] Label renderer.
 * @property {((node: TreeNode) => Promise<TreeNode[]>|TreeNode[])|null} [load=null] Lazy child loader.
 * @property {string} [filter=''] Label substring the tree is filtered by.
 * @property {string} [label='Tree'] Accessible name of the tree.
 * @property {string} [emptyText='Nothing to show'] Text shown when the tree is empty.
 * @property {number|string|null} [height=null] Scroll height in pixels or any CSS length.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<{node: TreeNode, id: unknown, ids: unknown[]}>) => void} [onselect] Selection listener.
 * @property {(event: CustomEvent<{node: TreeNode, id: unknown}>) => void} [onexpand] Expand listener.
 * @property {(event: CustomEvent<{node: TreeNode, id: unknown}>) => void} [oncollapse] Collapse listener.
 * @property {(event: CustomEvent<{node: TreeNode, id: unknown}>) => void} [onactivate] Activation listener.
 * @property {(event: CustomEvent<{ids: unknown[], node: TreeNode|null}>) => void} [oncheck] Check listener.
 * @property {(event: CustomEvent<{error: Error, node: TreeNode, id: unknown}>) => void} [onerror] Loader-failure listener.
 */

/**
 * Hierarchical tree implementing the APG tree pattern.
 *
 * Rows are rendered as a flat list carrying `aria-level` / `aria-setsize` / `aria-posinset`
 * rather than nested `role="group"` containers — the flattened variant the APG allows. It keeps
 * roving tabindex, arrow-key movement, and virtualization-friendly re-rendering simple.
 *
 * @fires TreeView#select
 * @fires TreeView#expand
 * @fires TreeView#collapse
 * @fires TreeView#activate
 * @fires TreeView#check
 * @fires TreeView#error
 */
export class TreeView extends Component {
  static cssName = 'tree';

  /** @type {TreeOptions} */
  static defaults = {
    items: [],
    valueKey: 'ID',
    labelKey: 'name',
    childrenKey: 'children',
    expanded: [],
    selection: 'single',
    selected: [],
    checkboxes: false,
    checked: [],
    icons: true,
    renderLabel: null,
    load: null,
    filter: '',
    label: 'Tree',
    emptyText: 'Nothing to show',
    height: null
  };

  /** @returns {HTMLElement} */
  render() {
    // render() runs inside the base constructor, before class-field initializers would run.
    this._items = [];
    this._rows = [];
    this._expanded = new Set();
    this._selected = new Set();
    this._checked = new Set();
    /** @type {Map<unknown, Promise<boolean>>} In-flight lazy loads, keyed by node ID. */
    this._loading = new Map();
    this._focusId = null;
    this._filter = '';
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(this.el);

    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._readers = createReaders(this.options);
    this._childrenKey = this.options.childrenKey ?? 'children';

    root.setAttribute('role', 'tree');
    root.setAttribute('aria-label', String(this.options.label ?? 'Tree'));
    root.tabIndex = 0;
    if (this.options.selection === 'multi') root.setAttribute('aria-multiselectable', 'true');
    if (this.options.height !== null) {
      root.style.blockSize = typeof this.options.height === 'number'
        ? `${this.options.height}px`
        : String(this.options.height);
      root.style.overflowY = 'auto';
    }

    this._items = cloneNodes(this.options.items);
    for (const id of toIterable(this.options.expanded)) this._expanded.add(id);
    for (const id of toIterable(this.options.selected)) this._selected.add(id);
    // The initial tab stop belongs on the first selected node, not always on row zero.
    const [firstSelected] = this._selected;
    if (firstSelected !== undefined) {
      this._focusId = firstSelected;
      for (const node of this.getPath(firstSelected).slice(0, -1)) {
        this._expanded.add(this._readers.value(node));
      }
    }
    for (const id of toIterable(this.options.checked)) this._applyCheck(id, true, { silent: true });

    // Typeahead searches from the row after the focused one, so repeating a letter walks through
    // every match instead of sticking on the first.
    this._handleTypeahead = typeahead(
      () => this._rotatedRows().map((row) => this._readers.label(row.node)),
      (_label, index) => this._focusNodeId(this._rotatedRows()[index]?.id)
    );

    this.listen(root, 'keydown', (event) => this._onKeydown(/** @type {KeyboardEvent} */ (event)));
    this.listen(root, 'click', (event) => this._onClick(/** @type {MouseEvent} */ (event)));
    this.listen(root, 'dblclick', (event) => this._onDoubleClick(/** @type {MouseEvent} */ (event)));
    this.listen(root, 'focus', () => {
      // Focusing the container hands focus straight to the active row.
      if (this._rows.length > 0 && !this._rowElement(this._focusId)) this._focusRow(0);
    });

    // Runs the same expansion logic as setFilter() so an initial filter behaves identically.
    if (String(this.options.filter ?? '') !== '') this.setFilter(this.options.filter);
    else this._renderRows();
    return root;
  }

  /* --------------------------------------------------------------------- data -- */

  /**
   * Replaces the whole tree.
   * @param {TreeNode[]} items Nested nodes.
   * @returns {this}
   */
  setItems(items) {
    this._items = cloneNodes(items);
    this._renderRows();
    return this;
  }

  /**
   * Returns the working copy of the tree, including lazily loaded children.
   * @returns {TreeNode[]}
   */
  getItems() {
    return this._items;
  }

  /**
   * Looks a node up by ID.
   * @param {unknown} id Node ID.
   * @returns {TreeNode|null}
   */
  getNode(id) {
    return findNode(this._items, id, this._readers);
  }

  /**
   * Returns the chain of nodes from a root down to the given node.
   * @param {unknown} id Node ID.
   * @returns {TreeNode[]}
   */
  getPath(id) {
    return pathTo(this._items, id, this._readers);
  }

  /**
   * Filters the tree by a label substring, keeping the ancestors of every match.
   * @param {string} query Search text; an empty string restores the full tree.
   * @returns {this}
   */
  setFilter(query) {
    this._filter = String(query ?? '');
    if (this._filter !== '') {
      // A filtered tree is only useful expanded, so every surviving branch opens.
      for (const node of this._visibleItems()) {
        walk([node], this._readers, (child) => this._expanded.add(this._readers.value(child)));
      }
    }
    this._renderRows();
    return this;
  }

  /* ---------------------------------------------------------------- expansion -- */

  /**
   * Expands one branch, loading its children first when a lazy loader is configured.
   * @param {unknown} id Node ID.
   * @returns {Promise<this>}
   * @fires TreeView#expand
   */
  async expand(id) {
    const node = this.getNode(id);
    if (!node || !isBranch(node, this._readers)) return this;
    const loaded = this._readers.children(node);
    const needsLoad = Boolean(this.options.load) && (!loaded || loaded.length === 0);
    // An ID can already be in the expanded set without its children having been fetched
    // (`expanded` option, expandAll, `*`, filtering) — that still has to trigger the loader.
    if (this._expanded.has(id) && !needsLoad) return this;
    const ok = await this._ensureChildren(node, id);
    if (!ok) return this;
    this._expanded.add(id);
    this._renderRows();
    this.emit('expand', { node, id });
    return this;
  }

  /**
   * Collapses one branch.
   * @param {unknown} id Node ID.
   * @returns {this}
   * @fires TreeView#collapse
   */
  collapse(id) {
    if (!this._expanded.delete(id)) return this;
    const node = this.getNode(id);
    this._renderRows();
    if (node) this.emit('collapse', { node, id });
    return this;
  }

  /**
   * Expands or collapses one branch.
   * @param {unknown} id Node ID.
   * @returns {Promise<this>}
   */
  async toggle(id) {
    if (this._expanded.has(id)) return this.collapse(id);
    return this.expand(id);
  }

  /**
   * Expands every already-loaded branch.
   * @returns {this}
   */
  expandAll() {
    walk(this._items, this._readers, (node) => {
      if (isBranch(node, this._readers)) this._expanded.add(this._readers.value(node));
    });
    this._renderRows();
    return this;
  }

  /** Collapses every branch. @returns {this} */
  collapseAll() {
    this._expanded.clear();
    this._renderRows();
    return this;
  }

  /**
   * Expands every ancestor of a node so the node becomes visible.
   * @param {unknown} id Node ID.
   * @returns {this}
   */
  reveal(id) {
    const chain = this.getPath(id);
    for (const node of chain.slice(0, -1)) this._expanded.add(this._readers.value(node));
    this._renderRows();
    return this;
  }

  /* ---------------------------------------------------------------- selection -- */

  /**
   * Selects one node, replacing the selection in single mode.
   * @param {unknown} id Node ID.
   * @param {{silent?: boolean, additive?: boolean}} [options={}] Selection behavior.
   * @returns {this}
   * @fires TreeView#select
   */
  select(id, { silent = false, additive = false } = {}) {
    if (this.options.selection === false) return this;
    const node = this.getNode(id);
    if (!node) return this;
    if (this.options.selection === 'multi' && additive) {
      if (this._selected.has(id)) this._selected.delete(id);
      else this._selected.add(id);
    } else {
      this._selected.clear();
      this._selected.add(id);
    }
    this._syncRows();
    if (!silent) this.emit('select', { node, id, ids: this.getSelection() });
    return this;
  }

  /**
   * Returns the selected node IDs.
   * @returns {unknown[]}
   */
  getSelection() {
    return [...this._selected];
  }

  /**
   * Replaces the selection.
   * @param {unknown[]} ids Node IDs.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `select`.
   * @returns {this}
   */
  setSelection(ids, { silent = true } = {}) {
    const list = toIterable(ids);
    // Single mode must never render two aria-selected rows.
    this._selected = new Set(this.options.selection === 'multi' ? list : list.slice(0, 1));
    this._syncRows();
    if (!silent) {
      const [first] = this._selected;
      this.emit('select', { node: this.getNode(first) ?? null, id: first, ids: this.getSelection() });
    }
    return this;
  }

  /** Clears the selection. @returns {this} */
  clearSelection() {
    this._selected.clear();
    this._syncRows();
    return this;
  }

  /* ------------------------------------------------------------------ checking -- */

  /**
   * Returns the checked node IDs.
   * @param {{leavesOnly?: boolean}} [options={}] Set `leavesOnly` to skip fully checked branches.
   * @returns {unknown[]}
   */
  getChecked({ leavesOnly = false } = {}) {
    if (!leavesOnly) return [...this._checked];
    return [...this._checked].filter((id) => {
      const node = this.getNode(id);
      return node !== null && !isBranch(node, this._readers);
    });
  }

  /**
   * Replaces the checked set, propagating each ID down its sub-tree.
   * @param {unknown[]} ids Node IDs.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `check`.
   * @returns {this}
   * @fires TreeView#check
   */
  setChecked(ids, { silent = true } = {}) {
    this._checked.clear();
    for (const id of toIterable(ids)) this._applyCheck(id, true, { silent: true });
    this._syncRows();
    if (!silent) this.emit('check', { ids: this.getChecked(), node: null });
    return this;
  }

  /**
   * Checks or unchecks one node and its sub-tree.
   * @param {unknown} id Node ID.
   * @param {boolean} checked Next state.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `check`.
   * @returns {this}
   * @fires TreeView#check
   */
  check(id, checked, { silent = false } = {}) {
    const node = this._applyCheck(id, checked, { silent: true });
    this._syncRows();
    if (!silent && node) this.emit('check', { ids: this.getChecked(), node });
    return this;
  }

  /* ----------------------------------------------------------------- focusing -- */

  /**
   * Moves DOM focus to a node, revealing it first.
   * @param {unknown} id Node ID.
   * @returns {this}
   */
  focusNode(id) {
    this.reveal(id);
    const index = this._rows.findIndex((row) => Object.is(row.id, id));
    if (index >= 0) this._focusRow(index);
    return this;
  }

  /* ---------------------------------------------------------------- rendering -- */

  /** @returns {TreeNode[]} */
  _visibleItems() {
    if (this._filter === '') return this._items;
    const needle = this._filter.trim().toLocaleLowerCase();
    if (needle === '') return this._items;
    return filterTree(
      this._items,
      this._readers,
      (node) => this._readers.label(node).toLocaleLowerCase().includes(needle),
      this._childrenKey
    );
  }

  /** Rebuilds every row from the current tree, expansion set, and filter. @returns {void} */
  _renderRows() {
    const items = this._visibleItems();
    this._rows = flattenVisible(items, this._readers, this._expanded);

    if (this._rows.length === 0) {
      this.el.replaceChildren(h('div', { class: 'zx-tree__empty' },
        this._message('tree.empty', this.options.emptyText)));
      return;
    }
    this.el.replaceChildren(...this._rows.map((row) => this._renderRow(row)));
    this._syncRows();
  }

  /**
   * @param {{node: TreeNode, id: unknown, level: number, posinset: number, setsize: number}} row Row spec.
   * @returns {HTMLElement}
   */
  _renderRow(row) {
    const branch = isBranch(row.node, this._readers);
    const expanded = branch && this._expanded.has(row.id);
    const element = h('div', {
      class: 'zx-tree__row',
      role: 'treeitem',
      id: uid('zx-tree-item'),
      tabIndex: -1,
      ariaLevel: String(row.level),
      ariaSetSize: String(row.setsize),
      ariaPosInSet: String(row.posinset),
      dataset: { level: String(row.level) }
    });
    element.style.setProperty('--zx-tree-level', String(row.level - 1));

    const twisty = h('span', { class: 'zx-tree__twisty', ariaHidden: 'true' },
      branch ? icon('chevron-right', { size: 12 }) : null);
    twisty.dataset.action = 'twisty';
    element.append(twisty);

    if (this.options.checkboxes) {
      const box = /** @type {HTMLInputElement} */ (h('input', {
        class: 'zx-tree__checkbox',
        type: 'checkbox',
        tabIndex: -1,
        ariaHidden: 'true'
      }));
      box.dataset.action = 'checkbox';
      element.append(box);
    }

    if (this.options.icons) {
      element.append(h('span', { class: 'zx-tree__icon', ariaHidden: 'true' },
        icon(branch ? (expanded ? 'folder-open' : 'folder') : 'file', { size: 14 })));
    }

    const content = this.options.renderLabel
      ? this.options.renderLabel(row.node)
      : this._readers.label(row.node);
    element.append(h('span', { class: 'zx-tree__label' }, content));

    if (row.node.badge != null) {
      element.append(h('span', { class: 'zx-tree__badge' }, String(row.node.badge)));
    }
    return element;
  }

  /** Applies expansion, selection, check, loading, and roving-tabindex state to every row. */
  _syncRows() {
    const elements = this.el.querySelectorAll('.zx-tree__row');
    let focusIndex = this._rows.findIndex((row) => Object.is(row.id, this._focusId));
    if (focusIndex < 0) focusIndex = 0;

    elements.forEach((element, index) => {
      const row = this._rows[index];
      if (!row) return;
      const branch = isBranch(row.node, this._readers);
      const expanded = branch && this._expanded.has(row.id);
      if (branch) element.setAttribute('aria-expanded', String(expanded));
      else element.removeAttribute('aria-expanded');
      if (this.options.selection !== false) {
        element.setAttribute('aria-selected', String(this._selected.has(row.id)));
      }
      element.toggleAttribute('data-branch', branch);
      element.toggleAttribute('data-loading', this._loading.has(row.id));
      element.tabIndex = index === focusIndex ? 0 : -1;

      const box = /** @type {HTMLInputElement|null} */ (element.querySelector('.zx-tree__checkbox'));
      if (box) {
        // Always resolve against the unfiltered tree: a filtered clone has pruned children and
        // would report "checked" for a branch with unchecked hidden descendants.
        const state = this._checkState(this.getNode(row.id) ?? row.node);
        box.checked = state === 'checked';
        box.indeterminate = state === 'partial';
        element.setAttribute('aria-checked', state === 'partial' ? 'mixed' : String(box.checked));
      }
      const glyph = element.querySelector('.zx-tree__icon');
      if (glyph && this.options.icons) {
        glyph.replaceChildren(icon(branch ? (expanded ? 'folder-open' : 'folder') : 'file', { size: 14 }));
      }
    });
    this._focusId = this._rows[focusIndex]?.id ?? null;
    // The container only takes focus while it is empty; otherwise a row owns the tab stop.
    this.el.tabIndex = this._rows.length === 0 ? 0 : -1;
  }

  /* -------------------------------------------------------------- interaction -- */

  /** @param {MouseEvent} event @returns {void} */
  _onClick(event) {
    const element = /** @type {Element} */ (event.target).closest('.zx-tree__row');
    if (!element) return;
    const index = this._rowIndex(element);
    if (index < 0) return;
    const row = this._rows[index];
    this._focusRow(index);

    const action = /** @type {Element} */ (event.target).closest('[data-action]');
    if (action?.dataset.action === 'twisty') {
      // toggle() re-renders every row, so focus has to be put back on this one afterwards.
      if (isBranch(row.node, this._readers)) void this.toggle(row.id).then(() => this._focusNodeId(row.id));
      return;
    }
    const node = this.getNode(row.id) ?? row.node;
    if (action?.dataset.action === 'checkbox') {
      this.check(row.id, this._checkState(node) !== 'checked');
      return;
    }
    if (this.options.checkboxes && this.options.selection === false) {
      this.check(row.id, this._checkState(node) !== 'checked');
      return;
    }
    this.select(row.id, { additive: event.ctrlKey || event.metaKey });
  }

  /** @param {MouseEvent} event @returns {void} */
  _onDoubleClick(event) {
    const element = /** @type {Element} */ (event.target).closest('.zx-tree__row');
    if (!element) return;
    const row = this._rows[this._rowIndex(element)];
    if (!row) return;
    if (isBranch(row.node, this._readers)) {
      void this.toggle(row.id).then(() => this._focusNodeId(row.id));
    } else {
      this.emit('activate', { node: row.node, id: row.id });
    }
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onKeydown(event) {
    const index = this._rows.findIndex((row) => Object.is(row.id, this._focusId));
    if (index < 0 || this._rows.length === 0) return;
    const row = this._rows[index];
    const branch = isBranch(row.node, this._readers);
    const expanded = branch && this._expanded.has(row.id);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this._focusRow(Math.min(this._rows.length - 1, index + 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        this._focusRow(Math.max(0, index - 1));
        return;
      case 'ArrowRight':
        event.preventDefault();
        // Re-find the row by ID after the async expand: positional indices can have shifted.
        if (branch && !expanded) void this.expand(row.id).then(() => this._focusNodeId(row.id));
        else if (expanded) this._focusRow(Math.min(this._rows.length - 1, index + 1));
        return;
      case 'ArrowLeft': {
        event.preventDefault();
        if (expanded) {
          this.collapse(row.id);
          this._focusNodeId(row.id);
        } else if (row.parent) {
          this._focusNodeId(this._readers.value(row.parent));
        }
        return;
      }
      case 'Home':
        event.preventDefault();
        this._focusRow(0);
        return;
      case 'End':
        event.preventDefault();
        this._focusRow(this._rows.length - 1);
        return;
      case 'Enter':
        event.preventDefault();
        if (this.options.selection !== false) this.select(row.id);
        this.emit('activate', { node: row.node, id: row.id });
        return;
      case ' ':
        event.preventDefault();
        if (this.options.checkboxes) {
          this.check(row.id, this._checkState(this.getNode(row.id) ?? row.node) !== 'checked');
        }
        else if (this.options.selection !== false) {
          this.select(row.id, { additive: this.options.selection === 'multi' });
        }
        return;
      case '*':
        event.preventDefault();
        this._expandSiblings(row);
        return;
      default:
        this._handleTypeahead(event);
    }
  }

  /**
   * Expands every sibling branch of a row, the APG `*` shortcut.
   * @param {{parent: TreeNode|null}} row Focused row.
   * @returns {void}
   */
  _expandSiblings(row) {
    const siblings = row.parent ? this._readers.children(row.parent) ?? [] : this._visibleItems();
    const focused = this._focusId;
    for (const node of siblings) {
      if (isBranch(node, this._readers)) this._expanded.add(this._readers.value(node));
    }
    this._renderRows();
    this._focusNodeId(focused);
  }

  /* ------------------------------------------------------------------ internals -- */

  /**
   * Loads a branch's children through the configured loader, once.
   * @param {TreeNode} node Branch node.
   * @param {unknown} id Node ID.
   * @returns {Promise<void>}
   */
  async _ensureChildren(node, id) {
    const loaded = this._readers.children(node);
    if (!this.options.load || (loaded && loaded.length > 0)) return true;
    // One in-flight request per branch: concurrent expansions must not call the loader twice.
    if (this._loading.has(id)) {
      await this._loading.get(id);
      return Array.isArray(this._readers.children(node));
    }
    const request = (async () => {
      try {
        const children = await this.options.load(node);
        node[this._childrenKey] = Array.isArray(children) ? children : [];
        // A branch that turns out to be empty must stop advertising children.
        if (node[this._childrenKey].length === 0) node.hasChildren = false;
        return true;
      } catch (error) {
        this.emit('error', { error, node, id });
        return false;
      } finally {
        this._loading.delete(id);
      }
    })();
    this._loading.set(id, request);
    this._syncRows();
    const ok = await request;
    this._syncRows();
    return ok;
  }

  /**
   * @param {unknown} id Node ID.
   * @param {boolean} checked Next state.
   * @param {{silent?: boolean}} options Behavior.
   * @returns {TreeNode|null}
   */
  _applyCheck(id, checked, { silent }) {
    const node = this.getNode(id);
    if (!node) return null;
    const ids = [id, ...descendants(node, this._readers).map((child) => this._readers.value(child))];
    for (const value of ids) {
      if (checked) this._checked.add(value);
      else this._checked.delete(value);
    }
    if (!silent) this._syncRows();
    return node;
  }

  /**
   * Derives a node's tri-state check state from its descendants.
   * @param {TreeNode} node Node to inspect.
   * @returns {'checked'|'partial'|'unchecked'}
   */
  _checkState(node) {
    const children = this._readers.children(node);
    if (!children || children.length === 0) {
      return this._checked.has(this._readers.value(node)) ? 'checked' : 'unchecked';
    }
    const states = children.map((child) => this._checkState(child));
    if (states.every((state) => state === 'checked')) return 'checked';
    if (states.every((state) => state === 'unchecked')) return 'unchecked';
    return 'partial';
  }

  /**
   * The visible rows starting just after the focused one, wrapping around.
   * @returns {{node: TreeNode, id: unknown}[]}
   */
  _rotatedRows() {
    const from = this._rows.findIndex((row) => Object.is(row.id, this._focusId));
    if (from < 0) return this._rows;
    return [...this._rows.slice(from + 1), ...this._rows.slice(0, from + 1)];
  }

  /** @param {Element} element @returns {number} */
  _rowIndex(element) {
    return [...this.el.querySelectorAll('.zx-tree__row')].indexOf(element);
  }

  /** @param {unknown} id @returns {Element|null} */
  _rowElement(id) {
    const index = this._rows.findIndex((row) => Object.is(row.id, id));
    return index < 0 ? null : this.el.querySelectorAll('.zx-tree__row')[index] ?? null;
  }

  /** @param {number} index @returns {void} */
  _focusRow(index) {
    const row = this._rows[index];
    if (!row) return;
    this._focusId = row.id;
    this._syncRows();
    const element = /** @type {HTMLElement|null} */ (this._rowElement(row.id));
    element?.focus();
    element?.scrollIntoView({ block: 'nearest' });
  }

  /** @param {unknown} id @returns {void} */
  _focusNodeId(id) {
    if (id === undefined) return;
    const index = this._rows.findIndex((row) => Object.is(row.id, id));
    if (index >= 0) this._focusRow(index);
  }

  /** @param {string} key @param {string} fallback @returns {string} */
  _message(key, fallback) {
    const message = this.msg(key);
    return message === key ? fallback : message;
  }

  /** Restores an enhanced target to the markup it had before the takeover. @returns {void} */
  destroy() {
    const root = this.el;
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, this._snapshot);
  }
}

/** Selection change. @event TreeView#select @type {CustomEvent<{node: TreeNode, id: unknown, ids: unknown[]}>} */
/** Branch expanded. @event TreeView#expand @type {CustomEvent<{node: TreeNode, id: unknown}>} */
/** Branch collapsed. @event TreeView#collapse @type {CustomEvent<{node: TreeNode, id: unknown}>} */
/** Node activated by Enter or double-click. @event TreeView#activate @type {CustomEvent<{node: TreeNode, id: unknown}>} */
/** Checked set changed. @event TreeView#check @type {CustomEvent<{ids: unknown[], node: TreeNode|null}>} */
/** A lazy loader rejected. @event TreeView#error @type {CustomEvent<{error: Error, node: TreeNode, id: unknown}>} */

/**
 * Copies the caller's nodes so lazily loaded children never mutate the passed-in data.
 * @param {TreeNode[]} nodes Source nodes.
 * @returns {TreeNode[]}
 */
function cloneNodes(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node) => {
    if (node === null || typeof node !== 'object') return node;
    const copy = { ...node };
    for (const [key, value] of Object.entries(copy)) {
      if (Array.isArray(value)) copy[key] = cloneNodes(value);
    }
    return copy;
  });
}

/** @param {unknown} value @returns {unknown[]} */
function toIterable(value) {
  return Array.isArray(value) ? value : [];
}
