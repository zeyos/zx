import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { uid } from '../../core/util.js';
import {
  AppRailPresenter as MinimizedPresenter, appNavIcon, normalizeAppItems
} from '../../internal/app-rail.js';

/** @typedef {import('../../internal/app-rail.js').AppNavItem} AppNavItem */
/** @typedef {import('../../internal/app-rail.js').AppNavSelectDetail} AppNavSelectDetail */
/**
 * @typedef {Object} AppSidebarOptions
 * @property {AppNavItem[]} [items=[]] Application navigation tree.
 * @property {string|number|null} [active=null] Active item id.
 * @property {Array<string|number>} [expanded=[]] Initially expanded branch ids.
 * @property {boolean} [collapsed=false] Whether the minimized presentation is shown.
 * @property {boolean} [collapsible=true] Whether vertical navigation exposes a mode toggle.
 * @property {'vertical'|'horizontal'} [orientation='vertical'] Navigation flow; horizontal is always minimized.
 * @property {'left'|'right'|'top'|'bottom'} [side='left'] Workspace edge occupied by navigation.
 * @property {string} [label='Applications'] Navigation accessible label.
 * @property {Node|string|number|{toElement: () => Node|null}|null} [header=null] Expanded header content.
 * @property {Node|string|number|{toElement: () => Node|null}|null} [footer=null] Expanded sticky footer content.
 * @property {Node|string|number|{toElement: () => Node|null}|null} [railHeader=null] Minimized leading content.
 * @property {Node|string|number|{toElement: () => Node|null}|null} [railFooter=null] Minimized trailing content.
 * @property {number} [openDelay=80] Minimized flyout hover-open delay.
 * @property {number} [closeDelay=160] Minimized flyout crossing grace.
 * @property {(item: AppNavItem, context: Record<string, any>) => Node|null} [renderIcon] Optional host icon renderer.
 * @property {(event: CustomEvent<AppNavSelectDetail>) => void} [onselect] Preventable action listener.
 * @property {(event: CustomEvent<{item: AppNavItem|null, id: string|number|null, expanded: boolean|null, ids: Array<string|number>}>) => void} [onbranchchange] Branch-state listener.
 * @property {(event: CustomEvent<{collapsed: boolean}>) => void} [oncollapsechange] Presentation-state listener.
 * @property {(event: CustomEvent<{item: AppNavItem, id: string|number, open: boolean}>) => void} [onflyoutchange] Minimized flyout-state listener.
 */

/**
 * One application navigation component. Vertical expanded descendants render inline; minimized
 * vertical and horizontal descendants use pointer-, focus-, and keyboard-accessible flyouts.
 * @fires AppSidebar#select
 * @fires AppSidebar#branchchange
 * @fires AppSidebar#collapsechange
 * @fires AppSidebar#flyoutchange
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
    collapsible: true,
    orientation: 'vertical',
    side: 'left',
    label: 'Applications',
    header: null,
    footer: null,
    railHeader: null,
    railFooter: null,
    openDelay: 80,
    closeDelay: 160,
    renderIcon: null
  };

  /**
   * Creates or enhances an application-navigation host.
   * @param {Element|string|null} [target=null] Navigation target.
   * @param {AppSidebarOptions} [options={}] Navigation options.
   */
  constructor(target = null, options = {}) {
    super(target, options);
    this._rail = null;
    this._railExpandButton = null;
    this._renderMode();
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
    this._expanded = new Set(Array.isArray(this.options.expanded)
      ? this.options.expanded.map(String) : []);
    this._collapsed = Boolean(this.options.collapsed);
    this._orientation = this.options.orientation === 'horizontal' ? 'horizontal' : 'vertical';
    this._side = normalizeSide(this._orientation, this.options.side);
    this._modeAbort = null;
    root.replaceChildren();
    return root;
  }

  /** Replaces the navigation tree in the active presentation. @param {AppNavItem[]} items @returns {this} */
  setItems(items) {
    this._items = normalizeAppItems(items);
    this._reconcileExpanded();
    if (this._rail) this._rail.setItems(this._items);
    else this._renderTree();
    return this;
  }

  /** Returns a shallow copy of normalized items. @returns {AppNavItem[]} */
  getItems() {
    return this._items.map((item) => ({
      ...item,
      children: item.children?.map((child) => ({ ...child }))
    }));
  }

  /** Sets the active id without routing. @param {string|number|null} id @returns {this} */
  setActive(id) {
    this._active = id;
    if (this._rail) this._rail.setActive(id);
    else this._syncActive();
    return this;
  }

  /** Replaces expanded branch ids. @param {Array<string|number>} ids @param {{silent?: boolean}} [options={}] @returns {this} */
  setExpanded(ids, { silent = false } = {}) {
    this._expanded = new Set(Array.isArray(ids) ? ids.map(String) : []);
    this._reconcileExpanded();
    if (!this._rail) this._renderTree();
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
    if (!this._rail) this._renderTree();
    if (!silent) this.emit('branchchange', {
      item,
      id: item.id,
      expanded,
      ids: this.getExpanded()
    });
    return this;
  }

  /** Shows the expanded vertical presentation. @param {{silent?: boolean}} [options={}] @returns {this} */
  expand(options = {}) {
    return this.setCollapsed(false, options);
  }

  /** Shows the minimized presentation. @param {{silent?: boolean}} [options={}] @returns {this} */
  collapse(options = {}) {
    return this.setCollapsed(true, options);
  }

  /** Sets the saved vertical expanded/minimized state. @param {boolean} collapsed @param {{silent?: boolean}} [options={}] @returns {this} */
  setCollapsed(collapsed, { silent = false } = {}) {
    const previous = this.isCollapsed();
    const active = document.activeElement;
    const outgoingOwnedFocus = Boolean(active
      && (this.el.contains(active) || this._rail?._containsNode(active)));
    this._collapsed = Boolean(collapsed);
    const next = this.isCollapsed();
    if (previous !== next) {
      this._renderMode();
      if (outgoingOwnedFocus) {
        if (next) this._railExpandButton?.focus();
        else this.refs.collapse?.focus();
      }
      if (!silent) this.emit('collapsechange', { collapsed: next });
    }
    return this;
  }

  /** Reports the effective presentation state; horizontal navigation is always minimized. @returns {boolean} */
  isCollapsed() {
    return this._orientation === 'horizontal' || this._collapsed;
  }

  /**
   * Changes navigation flow/edge without replacing state.
   * @param {{orientation?: 'vertical'|'horizontal', side?: 'left'|'right'|'top'|'bottom'}} layout
   * @param {{silent?: boolean}} [options]
   * @returns {this}
   */
  setLayout(layout = {}, { silent = false } = {}) {
    const orientation = layout.orientation === 'horizontal' ? 'horizontal'
      : layout.orientation === 'vertical' ? 'vertical' : this._orientation;
    const side = normalizeSide(orientation, layout.side ?? this._side);
    if (orientation === this._orientation && side === this._side) return this;
    const previous = this.isCollapsed();
    const active = document.activeElement;
    const outgoingOwnedFocus = Boolean(active
      && (this.el.contains(active) || this._rail?._containsNode(active)));
    const focusedId = outgoingOwnedFocus && active instanceof Element
      ? active.closest('[data-app-nav-id]')?.getAttribute('data-app-nav-id') ?? null : null;
    this._orientation = orientation;
    this._side = side;
    this._renderMode();
    const next = this.isCollapsed();
    if (outgoingOwnedFocus) {
      const replacement = focusedId === null ? null
        : [...this.el.querySelectorAll('[data-app-nav-id]')]
          .find((control) => control.getAttribute('data-app-nav-id') === focusedId) ?? null;
      if (replacement instanceof HTMLElement) replacement.focus();
      else if (next) this.focus();
      else if (this.refs.collapse instanceof HTMLElement && !this.refs.collapse.hidden) {
        this.refs.collapse.focus();
      } else visibleTreeControls(this.refs.list)[0]?.focus();
    }
    if (previous !== next && !silent) this.emit('collapsechange', { collapsed: next });
    return this;
  }

  /** Opens a minimized descendant flyout. @param {string|number} id @param {{focus?: boolean}} [options={}] @returns {this} */
  openFlyout(id, options = {}) {
    this._rail?.openFlyout(id, options);
    return this;
  }

  /** Closes a minimized descendant flyout. @param {string|number} id @returns {this} */
  closeFlyout(id) {
    this._rail?.closeFlyout(id);
    return this;
  }

  /** Closes every minimized flyout. @returns {this} */
  closeAllFlyouts() {
    this._rail?.closeAllFlyouts();
    return this;
  }

  /** Reports whether a minimized flyout is open. @param {string|number} id @returns {boolean} */
  isFlyoutOpen(id) {
    return this._rail?.isFlyoutOpen(id) ?? false;
  }

  /** Focuses the first navigation action. @returns {this} */
  focus() {
    if (this._rail) this._rail.focus();
    else visibleTreeControls(this.refs.list)[0]?.focus();
    return this;
  }

  /** Destroys flyouts and restores/removes the host. @returns {void} */
  destroy() {
    const original = this._original;
    this._modeAbort?.abort();
    this._modeAbort = null;
    this._rail?.destroy();
    this._rail = null;
    super.destroy();
    if (!this._createdRoot && original) {
      for (const attribute of Array.from(this.el.attributes)) this.el.removeAttribute(attribute.name);
      for (const [name, value] of original.attributes) this.el.setAttribute(name, value);
      this.el.replaceChildren(...original.children);
    }
  }

  /** Mounts exactly one expanded tree or minimized flyout presentation. @returns {void} */
  _renderMode() {
    this._modeAbort?.abort();
    this._modeAbort = new AbortController();
    this._rail?.destroy();
    this._rail = null;
    this._railExpandButton = null;
    for (const key of ['expanded', 'list', 'collapse', 'rail']) delete this.refs[key];
    this.el.replaceChildren();
    this.el.dataset.orientation = this._orientation;
    this.el.dataset.side = this._side;
    this.el.dataset.collapsed = String(this.isCollapsed());
    if (this.isCollapsed()) this._renderRail();
    else this._renderExpanded();
  }

  /** @returns {void} */
  _renderExpanded() {
    const headerContent = h('div', { class: 'zx-app-sidebar__header-content' });
    appendSlot(headerContent, this.options.header);
    const collapseButton = h('button', {
      class: 'zx-app-sidebar__collapse zx-icon-btn',
      type: 'button',
      ariaLabel: 'Minimize application sidebar'
    }, icon(this._side === 'right' ? 'chevron-right' : 'chevron-left'));
    collapseButton.hidden = !this.options.collapsible;
    const footer = h('footer', { class: 'zx-app-sidebar__footer' });
    appendSlot(footer, this.options.footer);
    footer.hidden = !footer.hasChildNodes();
    const list = h('ul', { class: 'zx-app-sidebar__list' });
    const expanded = h('div', { class: 'zx-app-sidebar__expanded' },
      h('header', { class: 'zx-app-sidebar__header' }, headerContent, collapseButton),
      h('nav', { class: 'zx-app-sidebar__nav', ariaLabel: this.options.label }, list),
      footer);
    this.refs.expanded = expanded;
    this.refs.list = list;
    this.refs.collapse = collapseButton;
    this.el.append(expanded);
    this._listenMode(collapseButton, 'click', () => this.collapse());
    this._listenMode(list, 'click', (event) => this._onTreeClick(event));
    this._listenMode(list, 'keydown', (event) => this._onTreeKeydown(/** @type {KeyboardEvent} */ (event)));
    this._renderTree();
  }

  /** @returns {void} */
  _renderRail() {
    const railHost = h('nav', { class: 'zx-app-sidebar__rail' });
    this.el.append(railHost);
    this.refs.rail = railHost;
    const showToggle = this._orientation === 'vertical' && Boolean(this.options.collapsible);
    const railHeader = h('div', { class: 'zx-app-sidebar__rail-header' });
    if (showToggle) {
      const expandButton = h('button', {
        class: 'zx-app-sidebar__rail-toggle zx-icon-btn',
        type: 'button',
        ariaLabel: 'Expand application sidebar'
      }, icon(this._side === 'right' ? 'chevron-left' : 'chevron-right'));
      railHeader.append(expandButton);
      this._railExpandButton = expandButton;
      this._listenMode(expandButton, 'click', () => this.expand());
    }
    appendSlot(railHeader, this.options.railHeader);
    this._rail = new MinimizedPresenter(railHost, {
      items: this._items,
      active: this._active,
      orientation: this._orientation,
      side: this._side,
      label: this.options.label,
      header: railHeader.hasChildNodes() ? railHeader : null,
      footer: this.options.railFooter,
      openDelay: this.options.openDelay,
      closeDelay: this.options.closeDelay,
      renderIcon: this.options.renderIcon,
      onselect: (event) => {
        const selected = this.emit('select', event.detail);
        if (selected.defaultPrevented) event.preventDefault();
      },
      onflyoutchange: (event) => this.emit('flyoutchange', event.detail)
    });
    this._listenMode(railHost, 'zx-select', (event) => event.stopPropagation());
    this._listenMode(railHost, 'zx-flyoutchange', (event) => event.stopPropagation());
  }

  /** @param {EventTarget} target @param {string} type @param {EventListener} listener @returns {void} */
  _listenMode(target, type, listener) {
    target.addEventListener(type, listener, { signal: this._modeAbort.signal });
  }

  /** @returns {void} */
  _renderTree() {
    if (!this.refs.list) return;
    const focused = this.refs.list.contains(document.activeElement)
      ? /** @type {Element} */ (document.activeElement).closest('[data-app-nav-id]')
        ?.getAttribute('data-app-nav-id')
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
    const visual = appNavIcon(item, this.options.renderIcon, {
      orientation: this._orientation,
      collapsed: false,
      side: this._side,
      level,
      location: level === 1 ? 'root' : 'inline'
    });
    const control = navControl(item, hasChildren, expanded, childId, visual);
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

  /** @param {Event} event @returns {void} */
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

  /** @param {KeyboardEvent} event @returns {void} */
  _onTreeKeydown(event) {
    const current = /** @type {Element|null} */ (event.target)?.closest?.('[data-app-nav-id]');
    if (!(current instanceof HTMLElement)) return;
    const item = findItem(this._items, current.getAttribute('data-app-nav-id'));
    const controls = visibleTreeControls(this.refs.list);
    const index = controls.indexOf(current);
    if (event.key === 'ArrowRight' && item?.children?.length) {
      event.preventDefault();
      if (!this._expanded.has(String(item.id))) this.toggleBranch(item.id);
      else visibleTreeControls(current.parentElement?.querySelector('.zx-app-sidebar__sublist'))[0]?.focus();
      return;
    }
    if (event.key === 'ArrowLeft') {
      if (item?.children?.length && this._expanded.has(String(item.id))) {
        event.preventDefault();
        this.toggleBranch(item.id);
        return;
      }
      const parentList = current.closest('.zx-app-sidebar__sublist');
      const parentControl = parentList?.parentElement?.querySelector(':scope > [data-app-nav-id]');
      if (parentControl instanceof HTMLElement) {
        event.preventDefault();
        parentControl.focus();
      }
      return;
    }
    let nextIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = controls.length - 1;
    else if (event.key === 'ArrowDown') nextIndex = Math.min(controls.length - 1, index + 1);
    else if (event.key === 'ArrowUp') nextIndex = Math.max(0, index - 1);
    else return;
    event.preventDefault();
    controls[nextIndex]?.focus();
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
    if (!this.refs.list) return;
    const activeId = this._active == null ? null : String(this._active);
    for (const control of this.refs.list.querySelectorAll('[data-app-nav-id]')) {
      const item = findItem(this._items, control.getAttribute('data-app-nav-id'));
      const direct = activeId !== null && control.getAttribute('data-app-nav-id') === activeId;
      const descendant = activeId !== null && item
        ? containsItemId(item.children ?? [], activeId) : false;
      if (direct) control.setAttribute('aria-current', 'page');
      else control.removeAttribute('aria-current');
      if (descendant) control.dataset.activeDescendant = 'true';
      else delete control.dataset.activeDescendant;
    }
  }

  /** @returns {void} */
  _reconcileExpanded() {
    const branchIds = new Set();
    walkItems(this._items, (item) => {
      if (item.children?.length) branchIds.add(String(item.id));
    });
    for (const id of this._expanded) if (!branchIds.has(id)) this._expanded.delete(id);
  }
}

/** @param {AppNavItem} item @param {boolean} disclosure @param {boolean} expanded @param {string|null} controls @param {Node|null} visual @returns {HTMLElement} */
function navControl(item, disclosure, expanded, controls, visual) {
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
  visual ? h('span', { class: 'zx-app-sidebar__item-icon', ariaHidden: 'true' }, visual) : null,
  h('span', { class: 'zx-app-sidebar__item-label' }, item.label),
  item.badge != null ? h('span', { class: 'zx-app-sidebar__item-badge' }, String(item.badge)) : null,
  disclosure ? h('span', { class: 'zx-app-sidebar__item-disclosure', ariaHidden: 'true' },
    icon(expanded ? 'chevron-down' : 'chevron-right')) : null));
}

/** @param {Element|null|undefined} root @returns {HTMLElement[]} */
function visibleTreeControls(root) {
  if (!root) return [];
  return /** @type {HTMLElement[]} */ ([...root.querySelectorAll('[data-app-nav-id]')]
    .filter((control) => !control.closest('.zx-app-sidebar__sublist[hidden]')));
}

/** Returns a control or its nearest owning disclosure when inside a collapsed branch. @param {Element|null} control @returns {HTMLElement|null} */
function visibleTreeControl(control) {
  let candidate = /** @type {HTMLElement|null} */ (control);
  while (candidate) {
    const hiddenList = candidate.closest('.zx-app-sidebar__sublist[hidden]');
    if (!hiddenList) return candidate;
    candidate = /** @type {HTMLElement|null} */ (hiddenList.parentElement?.firstElementChild ?? null);
  }
  return null;
}

/** @param {AppNavItem[]} items @param {string|number|null} id @returns {AppNavItem|null} */
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
  if (typeof content === 'string' || typeof content === 'number') {
    target.append(document.createTextNode(String(content)));
  } else if (typeof content === 'object' && typeof content.toElement === 'function') {
    const element = content.toElement();
    if (element) target.append(element);
  } else if (typeof content === 'object' && typeof content.nodeType === 'number') target.append(content);
}

/** @param {'vertical'|'horizontal'} orientation @param {unknown} side @returns {'left'|'right'|'top'|'bottom'} */
function normalizeSide(orientation, side) {
  if (orientation === 'horizontal') return side === 'bottom' ? 'bottom' : 'top';
  return side === 'right' ? 'right' : 'left';
}

/** Fired when a destination/action is activated. @event AppSidebar#select @type {CustomEvent<AppNavSelectDetail>} */
/** Fired when an inline branch changes. @event AppSidebar#branchchange @type {CustomEvent<{item: AppNavItem|null, id: string|number|null, expanded: boolean|null, ids: Array<string|number>}>} */
/** Fired when expanded/minimized presentation changes. @event AppSidebar#collapsechange @type {CustomEvent<{collapsed: boolean}>} */
/** Fired when a minimized flyout changes. @event AppSidebar#flyoutchange @type {CustomEvent<{item: AppNavItem, id: string|number, open: boolean}>} */
