import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { printf } from '../../core/i18n.js';
import { icon } from '../../core/icons.js';
import { uid } from '../../core/util.js';
import {
  AppRailPresenter as MinimizedPresenter, appNavIcon, normalizeAppItems
} from '../../internal/app-rail.js';
import { ModuleBar, liftSections, moduleOf } from '../module-bar/module-bar.js';
import { Tooltip } from '../tooltip/tooltip.js';

/** The modules layout's presentations, widest first. */
const PRESENTATIONS = Object.freeze(['expanded', 'compact', 'collapsed']);

/** @typedef {import('../../internal/app-rail.js').AppNavItem} AppNavItem */
/** @typedef {import('../../internal/app-rail.js').AppNavSelectDetail} AppNavSelectDetail */
/** @typedef {import('../module-bar/module-bar.js').ModuleItem} ModuleItem */
/**
 * A module in the modules layout: a `ModuleItem` whose panel may carry content of its own.
 * @typedef {ModuleItem & {header?: Node|{toElement: () => Node|null}, content?: Node|{toElement: () => Node|null}}} AppSidebarModule
 */
/**
 * Presentation of the module strip in the modules layout.
 * @typedef {Object} AppSidebarModuleBarOptions
 * @property {'tint'|'solid'|'plain'} [appearance='tint'] Tile treatment.
 * @property {'auto'|'beside'|'below'|'hidden'} [labels='auto'] Module names on the strip: `'auto'`
 *   prints them beside the tiles while expanded and leaves the icons alone while collapsed;
 *   `'hidden'` keeps the icon strip beside the panel; `'below'` prints them under the tiles.
 * @property {'auto'|'always'|'never'} [allModules='auto'] The "All modules" button.
 * @property {string|null} [label=null] Strip accessible label; omitted resolves `moduleBar.label`.
 */
/**
 * @typedef {Object} AppSidebarOptions
 * @property {AppNavItem[]|AppSidebarModule[]} [items=[]] Application navigation tree; in the
 *   modules layout its top level is the modules.
 * @property {string|number|null} [active=null] Active item id.
 * @property {Array<string|number>} [expanded=[]] Initially expanded branch ids.
 * @property {boolean} [collapsed=false] Whether the minimized presentation is shown.
 * @property {boolean} [collapsible=true] Whether vertical navigation exposes a mode toggle.
 * @property {'vertical'|'horizontal'} [orientation='vertical'] Navigation flow; horizontal is always minimized.
 * @property {'left'|'right'|'top'|'bottom'} [side='left'] Workspace edge occupied by navigation.
 * @property {'tree'|'modules'} [layout='tree'] `'modules'` draws the top level as a module strip
 *   beside a panel showing one module's menu; minimized, the strip remains and menus open as flyouts.
 * @property {string|number|null} [module=null] Modules layout: the module the panel shows first.
 *   Defaults to the module containing `active`, else the first module with a panel.
 * @property {AppSidebarModuleBarOptions} [moduleBar={}] Modules layout: strip presentation.
 * @property {'expanded'|'compact'|'collapsed'|null} [presentation=null] Modules layout: how much
 *   of the navigation shows — both menus expanded (module names beside the side menu), the module
 *   menu collapsed to icons beside the side menu, or both collapsed to the icon strip. Defaults
 *   to `collapsed` ? `'collapsed'` : `'expanded'`.
 * @property {Array<'expanded'|'compact'|'collapsed'>} [presentations=['expanded','compact','collapsed']]
 *   Modules layout: the presentations offered, widest first.
 * @property {boolean} [presentationSwitch=true] Modules layout: whether the strip's foot carries the
 *   switch between presentations. Turn it off when the choice lives elsewhere — an account menu,
 *   through `presentationChoice()`.
 * @property {string} [label='Applications'] Navigation accessible label.
 * @property {Node|string|number|{toElement: () => Node|null}|null} [header=null] Expanded header content;
 *   in the modules layout, content above every module's menu.
 * @property {Node|string|number|{toElement: () => Node|null}|null} [footer=null] Expanded sticky footer content.
 * @property {Node|string|number|{toElement: () => Node|null}|null} [railHeader=null] Minimized leading content;
 *   in the modules layout, the strip's leading content in both states.
 * @property {Node|string|number|{toElement: () => Node|null}|null} [railFooter=null] Minimized trailing content;
 *   in the modules layout, the strip's trailing content in both states.
 * @property {number} [openDelay=80] Minimized flyout hover-open delay.
 * @property {number} [closeDelay=160] Minimized flyout crossing grace.
 * @property {(item: AppNavItem, context: Record<string, any>) => Node|null} [renderIcon] Optional host icon renderer.
 * @property {(event: CustomEvent<AppNavSelectDetail>) => void} [onselect] Preventable action listener.
 * @property {(event: CustomEvent<{item: AppNavItem|null, id: string|number|null, expanded: boolean|null, ids: Array<string|number>}>) => void} [onbranchchange] Branch-state listener.
 * @property {(event: CustomEvent<{collapsed: boolean}>) => void} [oncollapsechange] Presentation-state listener.
 * @property {(event: CustomEvent<{item: AppNavItem, id: string|number, open: boolean}>) => void} [onflyoutchange] Minimized flyout-state listener.
 * @property {(event: CustomEvent<{item: AppNavItem, id: string|number, previous: string|number|null}>) => void} [onmodulechange] Preventable module-switch listener.
 * @property {(event: CustomEvent<{presentation: 'expanded'|'compact'|'collapsed', previous: 'expanded'|'compact'|'collapsed'}>) => void} [onpresentationchange] Presentation listener.
 */

/**
 * One application navigation component. Vertical expanded descendants render inline; minimized
 * vertical and horizontal descendants use pointer-, focus-, and keyboard-accessible flyouts. The
 * modules layout puts a `ModuleBar` of the top level beside a panel with the current module's menu.
 * @fires AppSidebar#select
 * @fires AppSidebar#branchchange
 * @fires AppSidebar#collapsechange
 * @fires AppSidebar#flyoutchange
 * @fires AppSidebar#modulechange
 * @fires AppSidebar#presentationchange
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
    layout: 'tree',
    module: null,
    moduleBar: {},
    presentation: null,
    presentations: ['expanded', 'compact', 'collapsed'],
    presentationSwitch: true,
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
    // A plain box: the <nav> inside is the landmark. An <aside> here would add an unnamed
    // complementary landmark around every navigation column.
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
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
    this._modules = this.options.layout === 'modules';
    this._moduleLabels = this.options.moduleBar?.labels ?? 'auto';
    this._compact = false;
    this._presentationGroup = null;
    this._stripTooltips = [];
    if (this._modules && PRESENTATIONS.includes(this.options.presentation)) {
      this._collapsed = this.options.presentation === 'collapsed';
      this._compact = this.options.presentation === 'compact';
    }
    this._shownId = this._modules ? this._resolveShown(this.options.module) : null;
    this._modeAbort = null;
    root.replaceChildren();
    return root;
  }

  /** Replaces the navigation tree in the active presentation. @param {AppNavItem[]} items @returns {this} */
  setItems(items) {
    this._items = normalizeAppItems(items);
    this._reconcileExpanded();
    if (this._modules) {
      this._shownId = this._resolveShown(this._shownId);
      this._rail?.setItems(this._items);
      if (this._rail instanceof ModuleBar && !this.isCollapsed()) this._rail.setExpanded(this._shownId);
      if (this.refs.list) this._renderPanelContent();
    } else if (this._rail) {
      this._rail.setItems(this._items);
      this._decorateRail();
    } else this._renderTree();
    return this;
  }

  /**
   * Returns a copy of the normalized items. A leaf has no `children` property, as it was written,
   * rather than the empty list normalization gives it.
   * @returns {AppNavItem[]}
   */
  getItems() {
    return copyItems(this._items);
  }

  /**
   * Sets the active id without routing. In the modules layout the panel follows the active route
   * into its module.
   * @param {string|number|null} id
   * @returns {this}
   */
  setActive(id) {
    this._active = id;
    if (this._rail) this._rail.setActive(id);
    if (this._modules) {
      const owner = moduleOf(this._moduleList(), id);
      if (owner && isPanelModule(owner) && String(owner.id) !== String(this._shownId)) {
        this._shownId = owner.id;
        if (this._rail instanceof ModuleBar && !this.isCollapsed()) this._rail.setExpanded(owner.id);
        if (this.refs.list) this._renderPanelContent();
        return this;
      }
    }
    if (this.refs.list) this._syncActive();
    return this;
  }

  /**
   * Updates one badge — a module's, or any destination's — without rebuilding the navigation.
   * @param {string|number} id Item id.
   * @param {string|number|null} badge New badge; null removes it.
   * @returns {this}
   */
  setBadge(id, badge) {
    const item = findItem(this._items, id);
    if (!item) return this;
    if (badge == null || badge === '') delete item.badge;
    else item.badge = badge;
    if (this._rail instanceof ModuleBar) this._rail.setBadge(id, badge);
    else if (this._rail) {
      this._rail.setItems(this._items);
      this._decorateRail();
    }
    if (this.refs.list) this._renderTree();
    return this;
  }

  /**
   * Modules layout: shows a module's menu in the panel. Fires a preventable `modulechange` unless silent.
   * @param {string|number} id Module id.
   * @param {{silent?: boolean}} [options={}]
   * @returns {this}
   */
  setModule(id, { silent = false } = {}) {
    this._showModule(id, { silent });
    return this;
  }

  /** Modules layout: the module whose menu the panel shows. @returns {string|number|null} */
  getModule() {
    return this._shownId;
  }

  /**
   * Modules layout: whether the strip prints module names — `'auto'` (beside the tiles while
   * expanded, none while collapsed), `'beside'`, `'below'`, or `'hidden'`. A narrow drawer that
   * has no room for a labelled strip beside the panel sets `'hidden'`.
   * @param {'auto'|'beside'|'below'|'hidden'} labels
   * @returns {this}
   */
  setModuleLabels(labels) {
    this._moduleLabels = labels;
    if (this._rail instanceof ModuleBar) this._rail.setLabels(this._stripLabels());
    this._syncPresentationSwitch();
    return this;
  }

  /**
   * How much of the navigation shows: `'expanded'` (in the modules layout, both menus),
   * `'compact'` (the module menu collapsed to icons beside the side menu), or `'collapsed'`.
   * @returns {'expanded'|'compact'|'collapsed'}
   */
  getPresentation() {
    if (this.isCollapsed()) return 'collapsed';
    return this._modules && this._stripLabels() === 'hidden' ? 'compact' : 'expanded';
  }

  /**
   * Shows the navigation as `'expanded'`, `'compact'` (modules layout), or `'collapsed'`.
   * @param {'expanded'|'compact'|'collapsed'} presentation
   * @param {{silent?: boolean}} [options={}]
   * @returns {this}
   */
  setPresentation(presentation, { silent = false } = {}) {
    if (!PRESENTATIONS.includes(presentation)) return this;
    return this._present(presentation === 'collapsed',
      presentation === 'collapsed' ? this._compact : this._modules && presentation === 'compact', { silent });
  }

  /** Moves to the next presentation the strip's switch offers, wrapping (Mod+B in an application). @returns {this} */
  togglePresentation() {
    return this.setPresentation(this._nextPresentation());
  }

  /** Replaces expanded branch ids. @param {Array<string|number>} ids @param {{silent?: boolean}} [options={}] @returns {this} */
  setExpanded(ids, { silent = false } = {}) {
    this._expanded = new Set(Array.isArray(ids) ? ids.map(String) : []);
    this._reconcileExpanded();
    if (this.refs.list) this._renderTree();
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
    if (!item?.children?.length || item.section) return this;
    const key = String(id);
    const expanded = !this._expanded.has(key);
    if (expanded) this._expanded.add(key);
    else this._expanded.delete(key);
    if (this.refs.list) {
      this._renderTree();
      if (expanded) this._markBranchMotion(key);
    }
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
    return this._present(Boolean(collapsed), this._compact, { silent });
  }

  /**
   * Applies a collapsed state and, in the modules layout, whether the module menu is collapsed
   * beside an expanded side menu; reports what changed.
   * @param {boolean} collapsed
   * @param {boolean} compact
   * @param {{silent?: boolean}} options
   * @returns {this}
   */
  _present(collapsed, compact, { silent = false }) {
    const previous = { collapsed: this.isCollapsed(), presentation: this.getPresentation() };
    const active = document.activeElement;
    const outgoingOwnedFocus = Boolean(active
      && (this.el.contains(active) || this._rail?._containsNode(active)));
    this._collapsed = collapsed;
    this._compact = Boolean(compact);
    const next = this.isCollapsed();
    if (previous.collapsed !== next) {
      this._renderMode();
      if (outgoingOwnedFocus) {
        // The switch's choice when there is a switch; otherwise the strip's own Tab stop, so focus
        // never falls to the page when the choice was made from a menu or a shortcut.
        const control = next ? this._railExpandButton : this.refs.collapse;
        if (control?.isConnected) control.focus();
        else this.focus();
      }
    } else if (this._rail instanceof ModuleBar) {
      // Only the strip's names change; the side menu and focus inside it stay as they are.
      this._rail.setLabels(this._stripLabels());
      this._syncPresentationSwitch();
    }
    const presentation = this.getPresentation();
    if (!silent) {
      if (previous.collapsed !== next) this.emit('collapsechange', { collapsed: next });
      if (previous.presentation !== presentation) {
        this.emit('presentationchange', { presentation, previous: previous.presentation });
      }
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

  /** Focuses the first navigation action: the module strip's Tab stop in the modules layout. @returns {this} */
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
    for (const tooltip of this._stripTooltips.splice(0)) tooltip.destroy();
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
    for (const tooltip of this._stripTooltips.splice(0)) tooltip.destroy();
    this._presentationGroup = null;
    this._rail?.destroy();
    this._rail = null;
    this._railExpandButton = null;
    for (const key of ['expanded', 'list', 'collapse', 'rail', 'panelTitle', 'panelLead', 'panelContent', 'panelNav']) {
      delete this.refs[key];
    }
    this.el.replaceChildren();
    this.el.dataset.orientation = this._orientation;
    this.el.dataset.side = this._side;
    this.el.dataset.collapsed = String(this.isCollapsed());
    this.el.dataset.layout = this._modules ? 'modules' : 'tree';
    if (this._modules) this._renderModules();
    else if (this.isCollapsed()) this._renderRail();
    else this._renderExpanded();
  }

  /** @returns {void} */
  _renderExpanded() {
    const headerContent = h('div', { class: 'zx-app-sidebar__header-content' });
    appendSlot(headerContent, this.options.header);
    const collapseButton = this._collapseButton();
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
    this._listenTree(list);
    this._renderTree();
  }

  /** @returns {HTMLButtonElement} The minimize control of an expanded presentation. */
  _collapseButton() {
    const button = /** @type {HTMLButtonElement} */ (h('button', {
      class: 'zx-app-sidebar__collapse zx-icon-btn',
      type: 'button',
      ariaLabel: this._message('appSidebar.minimize', 'Minimize application sidebar')
    }, icon(this._side === 'right' ? 'chevron-right' : 'chevron-left')));
    button.hidden = !this.options.collapsible;
    this._listenMode(button, 'click', () => this.collapse());
    return button;
  }

  /** @returns {HTMLButtonElement} The expand control at the head of a minimized vertical rail. */
  _expandButton() {
    const button = /** @type {HTMLButtonElement} */ (h('button', {
      class: 'zx-app-sidebar__rail-toggle zx-icon-btn',
      type: 'button',
      ariaLabel: this._message('appSidebar.expand', 'Expand application sidebar')
    }, icon(this._side === 'right' ? 'chevron-left' : 'chevron-right')));
    this._railExpandButton = button;
    this._listenMode(button, 'click', () => this.expand());
    return button;
  }

  /** @param {HTMLElement} list @returns {void} */
  _listenTree(list) {
    this._listenMode(list, 'click', (event) => this._onTreeClick(event));
    this._listenMode(list, 'keydown', (event) => this._onTreeKeydown(/** @type {KeyboardEvent} */ (event)));
  }

  /** @returns {void} */
  _renderRail() {
    const railHost = h('nav', { class: 'zx-app-sidebar__rail' });
    this.el.append(railHost);
    this.refs.rail = railHost;
    const showToggle = this._orientation === 'vertical' && Boolean(this.options.collapsible);
    const railHeader = h('div', { class: 'zx-app-sidebar__rail-header' });
    if (showToggle) railHeader.append(this._expandButton());
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
    this._decorateRail();
  }

  /**
   * The modules layout. Expanded, the strip leaves module menus to the panel beside it; minimized
   * or horizontal, the strip is the whole navigation and menus open as flyouts.
   * @returns {void}
   */
  _renderModules() {
    const expanded = !this.isCollapsed();
    const stripHeader = h('div', { class: 'zx-app-sidebar__rail-header' });
    appendSlot(stripHeader, this.options.railHeader);
    // One control for both levels, at the foot of the strip above whatever the strip ends with:
    // expanded, the module names and the panel; collapsed, the icons alone.
    const stripFoot = h('div', { class: 'zx-app-sidebar__strip-foot' });
    if (this._orientation === 'vertical' && this.options.collapsible && this.options.presentationSwitch !== false) {
      stripFoot.append(this._presentationSwitch(expanded));
    }
    appendSlot(stripFoot, this.options.railFooter);
    const host = h('nav', { class: 'zx-app-sidebar__strip' });
    const panelId = expanded ? uid('zx-app-sidebar-panel') : null;
    const container = expanded ? h('div', { class: 'zx-app-sidebar__modules' }, host) : host;
    this.el.append(container);
    this.refs.rail = host;
    const presentation = this.options.moduleBar && typeof this.options.moduleBar === 'object'
      ? this.options.moduleBar : {};
    /** @type {Record<string, any>} */
    const barOptions = {
      items: this._items,
      active: this._active,
      orientation: this._orientation,
      side: this._side,
      menus: expanded ? 'none' : 'flyout',
      expanded: expanded ? this._shownId : null,
      controls: panelId,
      header: stripHeader.hasChildNodes() ? stripHeader : null,
      footer: stripFoot.hasChildNodes() ? stripFoot : null,
      openDelay: this.options.openDelay,
      closeDelay: this.options.closeDelay,
      renderIcon: this.options.renderIcon,
      onselect: (event) => this._onModuleSelect(event, expanded),
      onflyoutchange: (event) => this.emit('flyoutchange', event.detail)
    };
    for (const key of ['appearance', 'allModules', 'label']) {
      if (presentation[key] != null) barOptions[key] = presentation[key];
    }
    barOptions.labels = this._stripLabels();
    this._rail = new ModuleBar(host, barOptions);
    for (const type of ['zx-select', 'zx-flyoutchange', 'zx-overflowchange', 'zx-allmodules']) {
      this._listenMode(host, type, (event) => event.stopPropagation());
    }
    if (!expanded) return;
    this._listenMode(host, 'keydown', (event) => this._onStripKeydown(/** @type {KeyboardEvent} */ (event)));
    container.append(this._renderPanel(/** @type {string} */ (panelId)));
  }

  /**
   * The modules layout's switch between its presentations: an APG radio group of one small
   * pictogram per presentation — both menus, the side menu beside module icons, the icons alone.
   * Its checked option is also the collapse control while expanded and the expand control while
   * collapsed, so focus lands on the checked option of its successor across a re-render.
   * @param {boolean} expanded Whether the side menu shows.
   * @returns {HTMLElement}
   */
  _presentationSwitch(expanded) {
    const labels = this._presentationLabels();
    const group = h('div', {
      class: 'zx-app-sidebar__presentation',
      role: 'radiogroup',
      ariaLabel: this._message('appSidebar.presentation', 'Navigation layout')
    });
    for (const name of this._presentationCycle()) {
      const option = /** @type {HTMLButtonElement} */ (h('button', {
        class: 'zx-app-sidebar__presentation-option',
        type: 'button',
        role: 'radio',
        ariaLabel: labels[name],
        dataset: { presentation: name }
      }, presentationGlyph(name)));
      group.append(option);
      this._stripTooltips.push(new Tooltip(option, {
        content: labels[name],
        placement: this._side === 'right' ? 'left' : 'right',
        delay: 450
      }));
    }
    this._listenMode(group, 'click', (event) => {
      const option = /** @type {Element} */ (event.target).closest?.('.zx-app-sidebar__presentation-option');
      if (option instanceof HTMLElement) this.setPresentation(/** @type {any} */ (option.dataset.presentation));
    });
    this._listenMode(group, 'keydown', (event) => this._onPresentationKeydown(/** @type {KeyboardEvent} */ (event)));
    this._presentationGroup = group;
    this._syncPresentationSwitch();
    const checked = /** @type {HTMLElement|null} */ (group.querySelector('[aria-checked="true"]'));
    if (expanded) this.refs.collapse = checked ?? group;
    else this._railExpandButton = checked ?? group;
    return group;
  }

  /**
   * The choice between presentations as a menu entry, for an account or settings menu that holds
   * it instead of the strip: `account.setItems([sidebar.presentationChoice(), …])`. It reads the
   * current presentation when called, so rebuild it after `presentationchange`.
   * @param {{label?: string}} [options={}] Row label; omitted resolves `appSidebar.presentation`.
   * @returns {import('../../internal/menu-items.js').MenuChoice}
   */
  presentationChoice({ label } = {}) {
    const labels = this._presentationLabels();
    return {
      type: 'choice',
      label: label ?? this._message('appSidebar.presentation', 'Navigation layout'),
      value: this.getPresentation(),
      options: this._presentationCycle().map((name) => ({
        value: name, label: labels[name], glyph: () => presentationGlyph(name)
      })),
      onselect: (value) => this.setPresentation(/** @type {any} */ (value))
    };
  }

  /** @returns {Record<'expanded'|'compact'|'collapsed', string>} */
  _presentationLabels() {
    return {
      expanded: this._message('appSidebar.presentationExpanded', 'Both menus expanded'),
      compact: this._message('appSidebar.presentationCompact', 'Module menu collapsed'),
      collapsed: this._message('appSidebar.presentationCollapsed', 'Both menus collapsed')
    };
  }

  /** Arrow keys move through the presentations and choose as they go, as in any radio group. @param {KeyboardEvent} event @returns {void} */
  _onPresentationKeydown(event) {
    const options = /** @type {HTMLElement[]} */ ([...(this._presentationGroup?.querySelectorAll('.zx-app-sidebar__presentation-option') ?? [])]);
    const index = options.indexOf(/** @type {HTMLElement} */ (event.target));
    if (index < 0 || event.altKey || event.ctrlKey || event.metaKey) return;
    let next;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = options[(index + 1) % options.length];
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = options[(index - 1 + options.length) % options.length];
    else if (event.key === 'Home') next = options[0];
    else if (event.key === 'End') next = options.at(-1);
    else return;
    event.preventDefault();
    const name = next.dataset.presentation;
    next.focus();
    this.setPresentation(/** @type {any} */ (name));
    // A change across collapsed re-renders the strip: focus goes to the new switch's choice.
    const replacement = this._presentationGroup?.querySelector(`.zx-app-sidebar__presentation-option[data-presentation="${name}"]`);
    if (replacement instanceof HTMLElement && replacement !== document.activeElement) replacement.focus();
  }

  /** Checks the current presentation's option and makes it the group's one Tab stop. @returns {void} */
  _syncPresentationSwitch() {
    const group = this._presentationGroup;
    if (!group) return;
    const current = this.getPresentation();
    for (const option of /** @type {HTMLElement[]} */ ([...group.querySelectorAll('.zx-app-sidebar__presentation-option')])) {
      const checked = option.dataset.presentation === current;
      option.setAttribute('aria-checked', String(checked));
      option.tabIndex = checked ? 0 : -1;
    }
    if (!group.querySelector('[aria-checked="true"]')) {
      const first = /** @type {HTMLElement|null} */ (group.querySelector('.zx-app-sidebar__presentation-option'));
      if (first) first.tabIndex = 0;
    }
  }

  /** @returns {Array<'expanded'|'compact'|'collapsed'>} The presentations the switch offers, widest first. */
  _presentationCycle() {
    const requested = Array.isArray(this.options.presentations) ? this.options.presentations : PRESENTATIONS;
    // A strip that never names its modules has no 'expanded' apart from 'compact', and one that
    // always names them under the tiles no 'compact' apart from 'expanded': offer only the one.
    const same = this._moduleLabels === 'hidden' ? 'expanded' : this._moduleLabels === 'below' ? 'compact' : null;
    const cycle = [...new Set(requested)].filter((name) => PRESENTATIONS.includes(name)
      && (name !== 'compact' || this._modules) && name !== same);
    return cycle.length >= 2 ? cycle : ['expanded', 'collapsed'];
  }

  /** @returns {'expanded'|'compact'|'collapsed'} */
  _nextPresentation() {
    const cycle = this._presentationCycle();
    const index = cycle.indexOf(this.getPresentation());
    return cycle[(index + 1) % cycle.length];
  }

  /**
   * What the strip prints for the current state: `'auto'` names the modules beside their tiles
   * while expanded and leaves the icons alone while collapsed.
   * @returns {'hidden'|'below'|'beside'}
   */
  _stripLabels() {
    const labels = this._moduleLabels;
    if (labels === 'below') return 'below';
    if (this.isCollapsed() || this._compact) return 'hidden';
    return labels === 'hidden' ? 'hidden' : 'beside';
  }

  /** @returns {AppSidebarModule[]} The modules, read through any sections that group them. */
  _moduleList() {
    return /** @type {AppSidebarModule[]} */ (liftSections(this._items));
  }

  /** @param {string} panelId @returns {HTMLElement} */
  _renderPanel(panelId) {
    const titleId = uid('zx-app-sidebar-module');
    const title = h('div', { class: 'zx-app-sidebar__panel-title', id: titleId });
    const lead = h('div', { class: 'zx-app-sidebar__panel-lead' });
    const list = h('ul', { class: 'zx-app-sidebar__list' });
    const nav = h('nav', { class: 'zx-app-sidebar__nav', ariaLabelledby: titleId }, list);
    const content = h('div', { class: 'zx-app-sidebar__panel-content' });
    const footer = h('footer', { class: 'zx-app-sidebar__footer' });
    appendSlot(footer, this.options.footer);
    footer.hidden = !footer.hasChildNodes();
    const panel = h('div', { class: 'zx-app-sidebar__panel', id: panelId },
      h('header', { class: 'zx-app-sidebar__header' },
        h('div', { class: 'zx-app-sidebar__header-content' }, title)),
      h('div', { class: 'zx-app-sidebar__panel-body' }, lead, nav, content),
      footer);
    Object.assign(this.refs, {
      expanded: panel, list,
      panelTitle: title, panelLead: lead, panelContent: content, panelNav: nav
    });
    this._listenTree(list);
    this._renderPanelContent();
    return panel;
  }

  /** Puts the shown module's title, header, menu, and content into the panel. @returns {void} */
  _renderPanelContent() {
    const module = this._shownModule();
    const { panelTitle, panelLead, panelContent, panelNav } = this.refs;
    if (!panelTitle) return;
    panelTitle.textContent = module?.label ?? '';
    // Slot nodes already in place stay put, so a menu refresh never takes focus out of them.
    placeSlots(panelLead, [this.options.header, module?.header]);
    placeSlots(panelContent, [module?.content]);
    /** @type {HTMLElement} */ (panelNav).hidden = !(module?.children?.length);
    this._renderTree();
  }

  /**
   * Shows a module's panel. Returns false when there is no such panel module or a listener
   * prevented the switch.
   * @param {string|number} id Module id.
   * @param {{silent?: boolean}} [options={}]
   * @returns {boolean}
   */
  _showModule(id, { silent = false } = {}) {
    if (!this._modules) return false;
    const module = this._moduleList().find((item) => String(item.id) === String(id));
    if (!module || !isPanelModule(module) || module.disabled) return false;
    if (String(module.id) === String(this._shownId)) return true;
    const previous = this._shownId;
    if (!silent && this.emit('modulechange', { item: module, id: module.id, previous }).defaultPrevented) return false;
    this._shownId = module.id;
    if (this._rail instanceof ModuleBar && !this.isCollapsed()) this._rail.setExpanded(module.id);
    if (this.refs.list) {
      this._renderPanelContent();
      // Only the panel that just changed animates; a re-render for any other reason does not.
      const body = this.refs.expanded?.querySelector('.zx-app-sidebar__panel-body');
      if (body instanceof HTMLElement) {
        delete body.dataset.moduleMotion;
        void body.offsetWidth;
        body.dataset.moduleMotion = 'enter';
      }
    }
    return true;
  }

  /** @param {CustomEvent<AppNavSelectDetail>} event @param {boolean} expanded @returns {void} */
  _onModuleSelect(event, expanded) {
    const module = this._moduleList().find((item) => String(item.id) === String(event.detail.id));
    if (module && isPanelModule(module)) {
      // A module with a panel is not a destination: choosing it shows the panel.
      event.preventDefault();
      const shown = this._showModule(module.id);
      if (shown && !expanded && this._orientation === 'vertical') {
        this.expand();
        visibleTreeControls(this.refs.list)[0]?.focus();
      }
      return;
    }
    const selected = this.emit('select', event.detail);
    if (selected.defaultPrevented) event.preventDefault();
  }

  /** The arrow toward the panel shows a module's menu and moves into it. @param {KeyboardEvent} event @returns {void} */
  _onStripKeydown(event) {
    const into = this._side === 'right' ? 'ArrowLeft' : 'ArrowRight';
    if (event.key !== into || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const control = /** @type {Element} */ (event.target).closest?.('.zx-module-bar__item[data-app-nav-value-id]');
    if (!control) return;
    const module = this._moduleList().find((item) => String(item.id) === control.getAttribute('data-app-nav-value-id'));
    if (!module || !isPanelModule(module) || !this._showModule(module.id)) return;
    event.preventDefault();
    const target = visibleTreeControls(this.refs.list)[0]
      ?? this.refs.expanded?.querySelector('.zx-app-sidebar__panel-body :is(a[href], button, input, select, textarea, [tabindex="0"])');
    if (target instanceof HTMLElement) target.focus();
  }

  /** @returns {AppSidebarModule|null} */
  _shownModule() {
    return this._moduleList().find((item) => String(item.id) === String(this._shownId)) ?? null;
  }

  /** @param {string|number|null|undefined} preferred @returns {string|number|null} */
  _resolveShown(preferred) {
    const panel = (id) => {
      if (id == null) return null;
      const module = this._moduleList().find((item) => String(item.id) === String(id));
      return module && isPanelModule(module) ? module : null;
    };
    return panel(preferred)?.id
      ?? panel(moduleOf(this._moduleList(), this._active)?.id)?.id
      ?? this._moduleList().find(isPanelModule)?.id
      ?? null;
  }

  /** @returns {AppNavItem[]} The items the tree draws: the shown module's menu in the modules layout. */
  _treeItems() {
    if (!this._modules) return this._items;
    return this._shownModule()?.children ?? [];
  }

  /**
   * Keeps a minimized rail's counts readable and audible.
   *
   * A rail destination is icon-only, so its accessible name is the label alone and the badge the
   * expanded tree showed as text is announced by nothing. Here the figure is folded back into the
   * name, and `data-zx-badge` tells the stylesheet whether the count still fits the target or has
   * to be drawn as a dot. Presentation only: no item, option, event, or listener is touched.
   * @returns {void}
   */
  _decorateRail() {
    const rail = this.refs.rail;
    if (!rail) return;
    for (const control of rail.querySelectorAll('.zx-app-rail__item[data-app-nav-value-id]')) {
      const badge = control.querySelector(':scope > .zx-app-rail__item-badge');
      if (!badge) continue;
      const item = findItem(this._items, control.getAttribute('data-app-nav-value-id'));
      if (!item || item.badge == null) continue;
      const count = String(item.badge);
      badge.dataset.zxBadge = count.length > 2 ? 'dot' : 'count';
      control.setAttribute('aria-label',
        this._message('appSidebar.itemBadge', '%1 (%2)', item.label, count));
    }
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
    this.refs.list.replaceChildren(...this._treeItems().map((item) => this._treeRow(item, 1)));
    this._syncActive();
    if (focused !== null) {
      const replacement = [...this.refs.list.querySelectorAll('[data-app-nav-id]')]
        .find((control) => control.getAttribute('data-app-nav-id') === focused) ?? null;
      visibleTreeControl(replacement)?.focus();
    }
  }

  /** @param {AppNavItem} item @param {number} level @returns {HTMLElement} */
  _treeRow(item, level) {
    if (item.section) return this._sectionRow(item, level);
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

  /**
   * A section: a heading over rows that stay at its own level. It names its list, so a screen
   * reader hears "Records, list, 3 items" rather than a heading floating above unrelated rows.
   * @param {AppNavItem} item Section.
   * @param {number} level Level its rows take.
   * @returns {HTMLElement}
   */
  _sectionRow(item, level) {
    const labelId = uid('zx-app-sidebar-section');
    const header = h('div', { class: 'zx-app-sidebar__section-header' },
      h('span', { class: 'zx-app-sidebar__section-label', id: labelId }, item.label));
    if (item.actions) {
      const actions = h('span', { class: 'zx-app-sidebar__section-actions' });
      appendSlot(actions, item.actions);
      header.append(actions);
    }
    return h('li', { class: 'zx-app-sidebar__section' }, header,
      h('ul', { class: 'zx-app-sidebar__section-list', ariaLabelledby: labelId },
        (item.children ?? []).map((child) => this._treeRow(child, level))));
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
        return;
      }
      // A top-level row of a module's menu: back out to that module's tile on the strip.
      if (this._modules && this._side === 'left' && this._rail instanceof ModuleBar) {
        const tile = this._rail._tiles().find((control) =>
          control.getAttribute('data-app-nav-value-id') === String(this._shownId));
        if (tile) {
          event.preventDefault();
          tile.focus();
        }
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

  /**
   * Flags the sublist a branch toggle just opened so the stylesheet can animate that one branch.
   *
   * `_renderTree()` rebuilds every row on every toggle, so a transition declared on the sublist
   * alone would replay on branches that never moved. The attribute is written after the rebuild
   * and disappears with the element on the next one, which is why it needs no teardown.
   * @param {string} key Branch id as a string.
   * @returns {void}
   */
  _markBranchMotion(key) {
    if (!this.refs.list) return;
    const control = [...this.refs.list.querySelectorAll('[data-app-nav-id]')]
      .find((candidate) => candidate.getAttribute('data-app-nav-id') === key) ?? null;
    const sublist = control?.parentElement?.querySelector(':scope > .zx-app-sidebar__sublist');
    if (sublist instanceof HTMLElement) sublist.dataset.branchMotion = 'expand';
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

  /** @returns {void} */
  _reconcileExpanded() {
    const branchIds = new Set();
    walkItems(this._items, (item) => {
      if (item.children?.length && !item.section) branchIds.add(String(item.id));
    });
    for (const id of this._expanded) if (!branchIds.has(id)) this._expanded.delete(id);
  }
}

/**
 * The pictogram of a presentation: a small window with its navigation drawn in it — the module
 * strip, wide when it is named, and the side menu when it shows. Built from boxes in the text
 * colour, so it follows the theme and forced colours and needs no icon set. Decorative.
 * @param {'expanded'|'compact'|'collapsed'} presentation
 * @returns {HTMLElement}
 */
export function presentationGlyph(presentation) {
  return /** @type {HTMLElement} */ (h('span', {
    class: 'zx-app-sidebar__presentation-glyph',
    ariaHidden: 'true',
    dataset: { presentation }
  }, h('span', { class: 'zx-app-sidebar__presentation-strip' }),
  h('span', { class: 'zx-app-sidebar__presentation-panel' })));
}

/**
 * Whether a module shows a panel — a menu, a header, or content of its own — rather than being a
 * destination itself.
 * @param {AppSidebarModule} module Top-level item.
 * @returns {boolean}
 */
function isPanelModule(module) {
  return Boolean(module.children?.length || module.header || module.content);
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

/**
 * Fills a slot region with its contents unless exactly those nodes are already there, and hides
 * the region while it is empty.
 * @param {HTMLElement} target Slot region.
 * @param {unknown[]} contents Slot values, as `appendSlot()` takes them.
 * @returns {void}
 */
function placeSlots(target, contents) {
  const staging = document.createDocumentFragment();
  const nodes = contents.flatMap((content) => {
    if (content == null) return [];
    if (typeof content === 'object' && typeof content.toElement === 'function') {
      const element = content.toElement();
      return element ? [element] : [];
    }
    if (typeof content === 'object' && typeof content.nodeType === 'number') return [content];
    appendSlot(staging, content);
    return [...staging.childNodes];
  });
  const current = [...target.childNodes];
  if (nodes.length !== current.length || nodes.some((node, index) => node !== current[index])) {
    target.replaceChildren(...nodes);
  }
  target.hidden = !target.hasChildNodes();
}

/** @param {'vertical'|'horizontal'} orientation @param {unknown} side @returns {'left'|'right'|'top'|'bottom'} */
function normalizeSide(orientation, side) {
  if (orientation === 'horizontal') return side === 'bottom' ? 'bottom' : 'top';
  return side === 'right' ? 'right' : 'left';
}

/** Fired when a destination/action is activated. @event AppSidebar#select @type {CustomEvent<AppNavSelectDetail>} */
/** Fired when an inline branch changes. @event AppSidebar#branchchange @type {CustomEvent<{item: AppNavItem|null, id: string|number|null, expanded: boolean|null, ids: Array<string|number>}>} */
/**
 * Copies a navigation tree, leaving out the empty `children` lists normalization adds to leaves.
 * @param {AppNavItem[]} items Normalized items.
 * @returns {AppNavItem[]}
 */
function copyItems(items) {
  return items.map((item) => {
    const { children, ...rest } = item;
    return children?.length ? { ...rest, children: copyItems(children) } : rest;
  });
}

/** Fired when expanded/minimized presentation changes. @event AppSidebar#collapsechange @type {CustomEvent<{collapsed: boolean}>} */
/** Fired when a minimized flyout changes. @event AppSidebar#flyoutchange @type {CustomEvent<{item: AppNavItem, id: string|number, open: boolean}>} */
/** Fired when how much of the navigation shows changes. @event AppSidebar#presentationchange @type {CustomEvent<{presentation: 'expanded'|'compact'|'collapsed', previous: 'expanded'|'compact'|'collapsed'}>} */
/** Fired before the modules layout's panel switches to another module; preventable. @event AppSidebar#modulechange @type {CustomEvent<{item: AppNavItem, id: string|number, previous: string|number|null}>} */
