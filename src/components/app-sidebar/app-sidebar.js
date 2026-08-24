import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { uid } from '../../core/util.js';
import { AppRail, normalizeAppItems } from '../app-rail/app-rail.js';

/** @typedef {import('../app-rail/app-rail.js').AppNavItem} AppNavItem */
/** @typedef {import('../app-rail/app-rail.js').AppNavSelectDetail} AppNavSelectDetail */
/**
 * @typedef {Object} AppSidebarOptions
 * @property {AppNavItem[]} [items=[]] Application navigation tree.
 * @property {string|number|null} [active=null] Active item id.
 * @property {Array<string|number>} [expanded=[]] Initially expanded branch ids.
 * @property {boolean} [collapsed=false] Whether the minimized AppRail is shown.
 * @property {'left'|'right'} [side='left'] Workspace side.
 * @property {string} [label='Applications'] Navigation accessible label.
 * @property {Node|string|number|{toElement: () => Node|null}|null} [header=null] Expanded header content.
 * @property {Node|string|number|{toElement: () => Node|null}|null} [footer=null] Expanded sticky footer content.
 * @property {Node|string|number|{toElement: () => Node|null}|null} [railHeader=null] Minimized rail header content.
 * @property {Node|string|number|{toElement: () => Node|null}|null} [railFooter=null] Minimized rail footer content.
 * @property {(event: CustomEvent<AppNavSelectDetail>) => void} [onselect] Preventable action listener.
 * @property {(event: CustomEvent<{item: AppNavItem|null, id: string|number|null, expanded: boolean|null, ids: Array<string|number>}>) => void} [onbranchchange] Branch-state listener; bulk replacement reports null state.
 * @property {(event: CustomEvent<{collapsed: boolean}>) => void} [oncollapsechange] Presentation-state listener.
 */

/**
 * Expanded vertical application navigation; the only Xenon shell mode with inline descendants.
 * @fires AppSidebar#select
 * @fires AppSidebar#branchchange
 * @fires AppSidebar#collapsechange
 * @extends {Component<AppSidebarOptions>}
 */
export class AppSidebar extends Component {
  static cssName = 'app-sidebar';

  /** @type {Readonly<AppSidebarOptions>} */
  static defaults = {
    items: [],
    active: null,
    expanded: [],
    collapsed: false,
    side: 'left',
    label: 'Applications',
    header: null,
    footer: null,
    railHeader: null,
    railFooter: null
  };

  /**
   * Creates or enhances an application-sidebar host.
   * @param {Element|string|null} target Sidebar target.
   * @param {AppSidebarOptions} [options={}] Sidebar options.
   */
  constructor(target = null, options = {}) {
    super(target, options);
    this.listen(this.refs.rail, 'zx-select', (event) => event.stopPropagation());
    const expandButton = h('button', {
      class: 'zx-app-sidebar__rail-toggle zx-icon-btn',
      type: 'button',
      ariaLabel: 'Expand application sidebar'
    }, icon(this.el.dataset.side === 'right' ? 'chevron-left' : 'chevron-right'));
    this._railExpandButton = expandButton;
    const railHeader = h('div', { class: 'zx-app-sidebar__rail-header' }, expandButton);
    appendSlot(railHeader, this.options.railHeader);
    this._rail = new AppRail(this.refs.rail, {
      items: this._items,
      active: this._active,
      orientation: 'vertical',
      side: this.el.dataset.side,
      label: this.options.label,
      header: railHeader,
      footer: this.options.railFooter,
      onselect: (event) => {
        const selected = this.emit('select', event.detail);
        if (selected.defaultPrevented) event.preventDefault();
      }
    });
    this.listen(expandButton, 'click', () => {
      this.expand();
    });
    this._renderTree();
    this.setCollapsed(Boolean(this.options.collapsed), { silent: true });
  }

  /** @returns {HTMLElement} */
  render() {
    this._createdRoot = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('aside'));
    this.el = root;
    this._original = this._createdRoot ? null : {
      attributes: Array.from(root.attributes, (attribute) => [attribute.name, attribute.value]),
      children: Array.from(root.childNodes)
    };
    this._items = normalizeAppItems(this.options.items);
    this._active = this.options.active;
    this._expanded = new Set(Array.isArray(this.options.expanded) ? this.options.expanded.map(String) : []);
    this._collapsed = Boolean(this.options.collapsed);
    root.dataset.side = this.options.side === 'right' ? 'right' : 'left';

    const headerContent = h('div', { class: 'zx-app-sidebar__header-content' });
    appendSlot(headerContent, this.options.header);
    const collapseButton = h('button', {
      ref: 'collapse',
      class: 'zx-app-sidebar__collapse zx-icon-btn',
      type: 'button',
      ariaLabel: 'Minimize application sidebar'
    }, icon(root.dataset.side === 'right' ? 'chevron-right' : 'chevron-left'));
    const footer = h('footer', { class: 'zx-app-sidebar__footer' });
    appendSlot(footer, this.options.footer);
    footer.hidden = !footer.hasChildNodes();
    const expanded = h('div', { ref: 'expanded', class: 'zx-app-sidebar__expanded' },
      h('header', { class: 'zx-app-sidebar__header' }, headerContent, collapseButton),
      h('nav', { class: 'zx-app-sidebar__nav', ariaLabel: this.options.label },
        h('ul', { ref: 'list', class: 'zx-app-sidebar__list' })),
      footer);
    const rail = h('div', { ref: 'rail', class: 'zx-app-sidebar__rail' });
    root.replaceChildren(expanded, rail);
    this.listen(collapseButton, 'click', () => {
      this.collapse();
    });
    this.listen(this.refs.list, 'click', (event) => this._onTreeClick(event));
    return root;
  }

  /** Replaces the navigation tree in both expanded and rail presentations. @param {AppNavItem[]} items @returns {this} */
  setItems(items) {
    this._items = normalizeAppItems(items);
    this._reconcileExpanded();
    this._renderTree();
    this._rail.setItems(this._items);
    return this;
  }

  /** Sets the active id in both presentations without routing. @param {string|number|null} id @returns {this} */
  setActive(id) {
    this._active = id;
    this._syncActive();
    this._rail.setActive(id);
    return this;
  }

  /** Replaces expanded branch ids. @param {Array<string|number>} ids @param {{silent?: boolean}} [options={}] @returns {this} */
  setExpanded(ids, { silent = false } = {}) {
    this._expanded = new Set(Array.isArray(ids) ? ids.map(String) : []);
    this._reconcileExpanded();
    this._renderTree();
    if (!silent) this.emit('branchchange', {
      item: null,
      id: null,
      expanded: null,
      ids: this.getExpanded()
    });
    return this;
  }

  /** Returns expanded branch ids in navigation order. @returns {Array<string|number>} */
  getExpanded() {
    const ordered = [];
    walkItems(this._items, (item) => {
      if (this._expanded.has(String(item.id))) ordered.push(item.id);
    });
    return ordered;
  }

  /** Toggles one inline branch. @param {string|number} id @param {{silent?: boolean}} [options={}] @returns {this} */
  toggleBranch(id, { silent = false } = {}) {
    const item = findItem(this._items, id);
    if (!item?.children?.length) return this;
    const key = String(id);
    const expanded = !this._expanded.has(key);
    if (expanded) this._expanded.add(key);
    else this._expanded.delete(key);
    this._renderTree();
    if (!silent) this.emit('branchchange', { item, id: item.id, expanded, ids: this.getExpanded() });
    return this;
  }

  /** Shows the expanded sidebar presentation. @param {{silent?: boolean}} [options={}] @returns {this} */
  expand(options = {}) {
    return this.setCollapsed(false, options);
  }

  /** Shows the minimized AppRail presentation. @param {{silent?: boolean}} [options={}] @returns {this} */
  collapse(options = {}) {
    return this.setCollapsed(true, options);
  }

  /** Sets expanded/minimized presentation while preserving branch state. @param {boolean} collapsed @param {{silent?: boolean}} [options={}] @returns {this} */
  setCollapsed(collapsed, { silent = false } = {}) {
    const next = Boolean(collapsed);
    const changed = next !== this._collapsed;
    const active = document.activeElement;
    const focusRailToggle = next && Boolean(active && this.refs.expanded.contains(active));
    const focusSidebarToggle = !next && this._rail?._containsNode(active);
    if (!next) this._rail?.closeAllFlyouts();
    this._collapsed = next;
    this.el.dataset.collapsed = String(next);
    this.refs.expanded.hidden = next;
    this.refs.rail.hidden = !next;
    if (focusRailToggle) this._railExpandButton?.focus();
    else if (focusSidebarToggle) this.refs.collapse.focus();
    if (changed && !silent) this.emit('collapsechange', { collapsed: next });
    return this;
  }

  /** Reports whether the rail presentation is active. @returns {boolean} */
  isCollapsed() {
    return this._collapsed;
  }

  /** Returns the composed minimized rail. @returns {AppRail} */
  getRail() {
    return this._rail;
  }

  /** Destroys the rail and restores/removes the sidebar host. @returns {void} */
  destroy() {
    const original = this._original;
    this._rail.destroy();
    super.destroy();
    if (!this._createdRoot && original) {
      for (const attribute of Array.from(this.el.attributes)) this.el.removeAttribute(attribute.name);
      for (const [name, value] of original.attributes) this.el.setAttribute(name, value);
      this.el.replaceChildren(...original.children);
    }
  }

  /** @returns {void} */
  _renderTree() {
    const focused = this.refs.list.contains(document.activeElement)
      ? /** @type {Element} */ (document.activeElement).closest('[data-app-nav-id]')?.getAttribute('data-app-nav-id')
      : null;
    this.refs.list.replaceChildren(...this._items.map((item) => this._treeRow(item, 1)));
    this._syncActive();
    if (focused !== null) {
      const replacement = [...this.refs.list.querySelectorAll('[data-app-nav-id]')]
        .find((control) => control.getAttribute('data-app-nav-id') === focused) ?? null;
      visibleTreeControl(replacement)?.focus();
    }
  }

  /** @param {AppNavItem} item @param {number} level @returns {HTMLElement} */
  _treeRow(item, level) {
    const children = item.children ?? [];
    const hasChildren = children.length > 0;
    const key = String(item.id);
    const expanded = hasChildren && this._expanded.has(key);
    const childId = hasChildren ? uid('zx-app-sidebar-branch') : null;
    const control = navControl(item, hasChildren, expanded, childId);
    const row = h('li', {
      class: 'zx-app-sidebar__row',
      dataset: { level }
    }, control);
    if (hasChildren) {
      row.append(h('ul', {
        class: 'zx-app-sidebar__sublist',
        id: childId,
        hidden: !expanded
      }, children.map((child) => this._treeRow(child, level + 1))));
    }
    return row;
  }

  /** Handles dynamic tree controls without retaining detached nodes after a rerender. @param {Event} event @returns {void} */
  _onTreeClick(event) {
    const control = /** @type {Element|null} */ (event.target)?.closest?.('[data-app-nav-id]');
    if (!control || !this.refs.list.contains(control)) return;
    const item = findItem(this._items, control.getAttribute('data-app-nav-id'));
    if (!item || item.disabled) {
      event.preventDefault();
      return;
    }
    if (item.children?.length) this.toggleBranch(item.id);
    else this._select(item, event);
  }

  /** @param {AppNavItem} item @param {Event} event @returns {void} */
  _select(item, event) {
    if (item.disabled) {
      event.preventDefault();
      return;
    }
    const selected = this.emit('select', {
      item,
      id: item.id,
      value: item.value ?? item.id,
      href: item.href ?? null,
      event
    });
    if (selected.defaultPrevented) event.preventDefault();
    else if (!item.href) {
      event.preventDefault();
      item.invoke?.();
    }
  }

  /** @returns {void} */
  _syncActive() {
    const activeId = this._active == null ? null : String(this._active);
    for (const control of this.refs.list.querySelectorAll('[data-app-nav-id]')) {
      const item = findItem(this._items, control.getAttribute('data-app-nav-id'));
      const direct = activeId !== null && control.getAttribute('data-app-nav-id') === activeId;
      const descendant = activeId !== null && item
        ? containsItemId(item.children ?? [], activeId) : false;
      if (direct) {
        control.setAttribute('aria-current', 'page');
      } else control.removeAttribute('aria-current');
      if (descendant) control.dataset.activeDescendant = 'true';
      else delete control.dataset.activeDescendant;
    }
  }

  /** @returns {void} */
  _reconcileExpanded() {
    const branchIds = new Set();
    walkItems(this._items, (item) => { if (item.children?.length) branchIds.add(String(item.id)); });
    for (const id of this._expanded) if (!branchIds.has(id)) this._expanded.delete(id);
  }
}

/** @param {AppNavItem} item @param {boolean} disclosure @param {boolean} expanded @param {string|null} controls @returns {HTMLElement} */
function navControl(item, disclosure, expanded, controls) {
  const tag = item.href && !disclosure ? 'a' : 'button';
  return /** @type {HTMLElement} */ (h(tag, {
    class: 'zx-app-sidebar__item',
    type: tag === 'button' ? 'button' : null,
    href: tag === 'a' ? item.href : null,
    target: tag === 'a' ? item.target ?? null : null,
    ariaDisabled: item.disabled ? 'true' : null,
    ariaExpanded: disclosure ? String(expanded) : null,
    ariaControls: controls,
    dataset: { appNavId: String(item.id) }
  },
  item.icon ? h('span', { class: 'zx-app-sidebar__item-icon', ariaHidden: 'true' }, icon(item.icon)) : null,
  h('span', { class: 'zx-app-sidebar__item-label' }, item.label),
  item.badge != null ? h('span', { class: 'zx-app-sidebar__item-badge' }, String(item.badge)) : null,
  disclosure ? h('span', { class: 'zx-app-sidebar__item-disclosure', ariaHidden: 'true' },
    icon(expanded ? 'chevron-down' : 'chevron-right')) : null));
}

/** Returns a control or the nearest owning disclosure when that control is inside a collapsed branch. @param {Element|null} control @returns {HTMLElement|null} */
function visibleTreeControl(control) {
  let candidate = /** @type {HTMLElement|null} */ (control);
  while (candidate) {
    const hiddenList = candidate.closest('.zx-app-sidebar__sublist[hidden]');
    if (!hiddenList) return candidate;
    candidate = /** @type {HTMLElement|null} */ (hiddenList.parentElement?.firstElementChild ?? null);
  }
  return null;
}

/** @param {AppNavItem[]} items @param {string|number} id @returns {AppNavItem|null} */
function findItem(items, id) {
  for (const item of items) {
    if (String(item.id) === String(id)) return item;
    const child = findItem(item.children ?? [], id);
    if (child) return child;
  }
  return null;
}

/** @param {AppNavItem[]} items @param {(item: AppNavItem) => void} visit @returns {void} */
function walkItems(items, visit) {
  for (const item of items) {
    visit(item);
    walkItems(item.children ?? [], visit);
  }
}

/** @param {AppNavItem[]} items @param {string} id @returns {boolean} */
function containsItemId(items, id) {
  return items.some((item) => String(item.id) === id || containsItemId(item.children ?? [], id));
}

/** @param {Element} target @param {unknown} content @returns {void} */
function appendSlot(target, content) {
  if (content == null) return;
  if (typeof content === 'string' || typeof content === 'number') target.append(document.createTextNode(String(content)));
  else if (typeof content === 'object' && typeof content.toElement === 'function') {
    const element = content.toElement();
    if (element) target.append(element);
  } else if (typeof content === 'object' && typeof content.nodeType === 'number') target.append(content);
}

/** Fired when a destination/action is activated. @event AppSidebar#select @type {CustomEvent<AppNavSelectDetail>} */
/** Fired when an inline branch changes. @event AppSidebar#branchchange @type {CustomEvent<{item: AppNavItem|null, id: string|number|null, expanded: boolean|null, ids: Array<string|number>}>} */
/** Fired when expanded/minimized presentation changes. @event AppSidebar#collapsechange @type {CustomEvent<{collapsed: boolean}>} */
