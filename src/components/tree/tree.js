import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { ICON_SIZE, icon } from '../../core/icons.js';
import { typeahead } from '../../core/keyboard.js';
import { uid } from '../../core/util.js';
import { renderRowActions, rowActionMenu, setRowActionsTabbable } from '../../internal/row-actions.js';
import {
  createReaders, descendants, filterTree, findNode, flattenVisible, isBranch, pathTo, walk
} from './hierarchy.js';

/** @typedef {import('./hierarchy.js').TreeNode} TreeNode */
/** @typedef {import('../../internal/row-actions.js').RowAction} RowAction */
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
 * @property {((node: TreeNode) => Array<RowAction|Node>)|null} [rowActions=null] A row's actions:
 *   `{icon, label, onSelect(node), disabled?, danger?}` descriptors, or nodes placed as given. They
 *   rest out of sight and show while the row is pointed at, focused or selected; one or two show
 *   as icon buttons, more fold after the first into a "More actions" menu. Every descriptor is also
 *   in the row's context menu, and the focused row's actions follow it in the Tab order.
 * @property {string|null} [moreLabel=null] Name of a row's overflow menu; every action name is
 *   followed by the row's name ("More actions: Q3 plan"). Null reads the `tree.more` message.
 * @property {((node: TreeNode) => Promise<TreeNode[]>|TreeNode[])|null} [load=null] Lazy child loader.
 * @property {string} [filter=''] Label substring the tree is filtered by.
 * @property {string|null} [label=null] Accessible name of the tree; null reads the `tree.label`
 *   message ("Tree").
 * @property {string|null} [emptyText] Text shown when the tree is empty, by default the
 *   `tree.noItems` message ("Nothing to show"). Null shows none.
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
 * @extends {Component<TreeOptions>}
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
    rowActions: null,
    moreLabel: null,
    load: null,
    filter: '',
    label: null,
    // Undefined rather than null, which shows nothing.
    emptyText: undefined,
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
    this._loadGeneration = 0;
    this._destroyed = false;
    this._expanding = new Map();
    this._focusId = null;
    this._filter = '';
    /** @type {Array<import('../../internal/row-actions.js').RowActionStrip|undefined>} Per visible row. */
    this._strips = [];
    this._rowMenu = null;
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(this.el);

    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._readers = createReaders(this.options);
    this._childrenKey = this.options.childrenKey ?? 'children';

    root.setAttribute('role', 'tree');
    root.setAttribute('aria-label', String(this.options.label ?? this.msg('tree.label')));
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
    // Focus arriving on a row's action makes that row the tree's tab stop, without moving focus.
    this.listen(root, 'focusin', (event) => {
      const strip = this._stripOf(event.target);
      const row = strip ? this._rows[this._rowIndex(strip.closest('.zx-tree__row'))] : null;
      if (row && !Object.is(row.id, this._focusId)) {
        this._focusId = row.id;
        this._syncRows();
      }
    });
    if (typeof this.options.rowActions === 'function') {
      this._rowMenu = rowActionMenu(root, '.zx-tree__row', (element) => {
        const index = this._rowIndex(element);
        const strip = this._strips[index];
        return strip ? { actions: strip.actions, subject: this._subject(this._rows[index]) } : null;
      });
    }

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
    this._loadGeneration += 1;
    this._loading.clear();
    this._expanding.clear();
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
    if (this._destroyed) return this;
    const node = this.getNode(id);
    if (!node || !isBranch(node, this._readers)) return this;
    const loaded = this._readers.children(node);
    const needsLoad = Boolean(this.options.load) && (!loaded || loaded.length === 0);
    // An ID can already be in the expanded set without its children having been fetched
    // (`expanded` option, expandAll, `*`, filtering) — that still has to trigger the loader.
    if (this._expanded.has(id) && !needsLoad) return this;
    const operation = {};
    this._expanding.set(id, operation);
    const ok = await this._ensureChildren(node, id);
    if (this._destroyed || this._expanding.get(id) !== operation) return this;
    this._expanding.delete(id);
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
    this._expanding.delete(id);
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
    this._expanding.clear();
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
    for (const strip of this._strips.splice(0)) strip?.destroy();

    if (this._rows.length === 0) {
      const { emptyText = this.msg('tree.noItems') } = this.options;
      this.el.replaceChildren(h('div', { class: 'zx-tree__empty' }, this._message('tree.empty', emptyText)));
      return;
    }
    this.el.replaceChildren(...this._rows.map((row, index) => this._renderRow(row, index)));
    this._syncRows();
  }

  /**
   * @param {{node: TreeNode, id: unknown, level: number, posinset: number, setsize: number}} row Row spec.
   * @param {number} index Visible position.
   * @returns {HTMLElement}
   */
  _renderRow(row, index) {
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
      branch ? icon('chevron-right', { size: ICON_SIZE.chevron }) : null);
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
    const label = h('span', { class: 'zx-tree__label' }, content);
    element.append(label);

    const badge = row.node.badge != null ? h('span', { class: 'zx-tree__badge' }, String(row.node.badge)) : null;
    if (badge) element.append(badge);

    const strip = typeof this.options.rowActions === 'function'
      ? renderRowActions(this.options.rowActions(this._subject(row)), {
        block: 'tree',
        name: this._readers.label(row.node),
        moreLabel: String(this.options.moreLabel ?? this.msg('tree.more')),
        run: (action) => action.onSelect(this._subject(row))
      })
      : null;
    if (strip) {
      this._strips[index] = strip;
      // The row keeps the name its label (and count) gives it; the action names stay out of it.
      label.id = uid('zx-tree-label');
      if (badge) badge.id = uid('zx-tree-badge');
      element.setAttribute('aria-labelledby', badge ? `${label.id} ${badge.id}` : label.id);
      element.setAttribute('data-zx-reveal-host', '');
      element.append(strip.element);
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
      // The row holding the tab stop lends it to its actions: Tab walks them, then leaves the tree.
      setRowActionsTabbable(this._strips[index]?.element, index === focusIndex);

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
    const strip = this._stripOf(event.target);
    if (strip) {
      // An action acts on its row; it neither selects nor focuses it.
      const control = /** @type {HTMLElement|null} */ (/** @type {Element} */ (event.target).closest('[data-row-action]'));
      const index = this._rowIndex(strip.closest('.zx-tree__row'));
      const action = control ? this._strips[index]?.actions[Number(control.dataset.rowAction)] : null;
      if (action && !action.disabled) action.onSelect(this._subject(this._rows[index]));
      return;
    }
    const element = /** @type {Element} */ (event.target).closest('.zx-tree__row');
    if (!element) return;
    const index = this._rowIndex(element);
    if (index < 0) return;
    const row = this._rows[index];
    this._focusRow(index);

    const action = /** @type {Element} */ (event.target).closest('[data-action]');
    if (action?.dataset.action === 'twisty') {
      // toggle() re-renders every row, so focus has to be put back on this one afterwards.
      const generation = this._loadGeneration;
      if (isBranch(row.node, this._readers)) void this.toggle(row.id).then(() => {
        if (!this._destroyed && generation === this._loadGeneration && Object.is(this._focusId, row.id)) {
          this._focusNodeId(row.id);
        }
      });
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
    if (this._stripOf(event.target)) return;
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
    // Keys pressed on a row's action belong to that control: Enter runs it, the menu's arrows move
    // through the menu, and nothing walks the tree.
    if (this._stripOf(event.target)) return;
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
      case 'ArrowRight': {
        event.preventDefault();
        // Re-find the row by ID after the async expand: positional indices can have shifted.
        const generation = this._loadGeneration;
        if (branch && !expanded) void this.expand(row.id).then(() => {
          if (!this._destroyed && generation === this._loadGeneration && Object.is(this._focusId, row.id)) {
            this._focusNodeId(row.id);
          }
        });
        else if (expanded) this._focusRow(Math.min(this._rows.length - 1, index + 1));
        return;
      }
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
        // A printable key typed on a row belongs to the type-ahead: claimed, so the browser's
        // find-as-you-type and the page's single-key shortcuts do not act on it as well. Typing
        // into a control that `renderLabel` placed in a row stays that control's.
        if (!isTreeTypeaheadKey(event) || isTextEntry(event.target)) return;
        event.preventDefault();
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
   * @returns {Promise<boolean>}
   */
  async _ensureChildren(node, id) {
    const loaded = this._readers.children(node);
    if (!this.options.load || (loaded && loaded.length > 0)) return true;
    // One in-flight request per branch: concurrent expansions must not call the loader twice.
    if (this._loading.has(id)) return this._loading.get(id);
    const generation = this._loadGeneration;
    const request = (async () => {
      try {
        const children = await this.options.load(node);
        if (this._destroyed || generation !== this._loadGeneration) return false;
        node[this._childrenKey] = Array.isArray(children) ? children : [];
        // A branch that turns out to be empty must stop advertising children.
        if (node[this._childrenKey].length === 0) node.hasChildren = false;
        return true;
      } catch (error) {
        if (!this._destroyed && generation === this._loadGeneration) this.emit('error', { error, node, id });
        return false;
      }
    })();
    this._loading.set(id, request);
    if (!this._destroyed && generation === this._loadGeneration) this._syncRows();
    const ok = await request;
    if (this._destroyed || generation !== this._loadGeneration) return false;
    if (this._loading.get(id) === request) this._loading.delete(id);
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

  /**
   * The action strip an event target sits in, if any.
   * @param {EventTarget|null} target Event target.
   * @returns {HTMLElement|null}
   */
  _stripOf(target) {
    const element = target && /** @type {Node} */ (target).nodeType === 1 ? /** @type {Element} */ (target) : null;
    const strip = /** @type {HTMLElement|null} */ (element?.closest('.zx-tree__actions') ?? null);
    return strip && this.el.contains(strip) ? strip : null;
  }

  /**
   * What a row's actions receive: the node in the working tree, not a filtered copy.
   * @param {{node: TreeNode, id: unknown}|undefined} row Visible row.
   * @returns {TreeNode|null}
   */
  _subject(row) {
    return row ? this.getNode(row.id) ?? row.node : null;
  }

  /** @param {Element|null} element @returns {number} */
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
    this._destroyed = true;
    this._loadGeneration += 1;
    this._loading.clear();
    this._expanding.clear();
    const root = this.el;
    for (const strip of this._strips?.splice(0) ?? []) strip?.destroy();
    this._rowMenu?.destroy();
    this._rowMenu = null;
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

/**
 * Whether a key press is one the type-ahead consumes: a single printable character, not a space
 * (Space selects), with no Ctrl, Meta, or Alt (those are shortcuts). Shift is allowed, since it
 * only changes the letter's case.
 * @param {{key?: string, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean}} event Key event.
 * @returns {boolean}
 */
export function isTreeTypeaheadKey(event) {
  if (!event || event.ctrlKey || event.metaKey || event.altKey) return false;
  const key = typeof event.key === 'string' ? event.key : '';
  // The same test the shared type-ahead applies, so a key is claimed exactly when it is used.
  return key.length === 1 && !/\s/.test(key);
}

/** @param {EventTarget|null} target @returns {boolean} Whether typing into the target edits text. */
function isTextEntry(target) {
  const element = /** @type {HTMLElement|null} */ (target && /** @type {Node} */ (target).nodeType === 1
    ? target : null);
  if (!element) return false;
  if (element.isContentEditable) return true;
  if (element.localName === 'textarea' || element.localName === 'select') return true;
  if (element.localName !== 'input') return false;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'image', 'range', 'color', 'file']
    .includes(/** @type {HTMLInputElement} */ (element).type);
}
