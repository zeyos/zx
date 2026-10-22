import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { isCssColor, uid } from '../../core/util.js';
import { AppRailPresenter, appNavIcon, normalizeAppItems } from '../../internal/app-rail.js';
import { APP_ICON_TONES, appIcon } from '../app-icon/app-icon.js';
import { Dropdown } from '../dropdown/dropdown.js';
import { Tooltip } from '../tooltip/tooltip.js';

/** @typedef {import('../../internal/app-rail.js').AppNavItem} AppNavItem */
/** @typedef {import('../../internal/app-rail.js').AppNavSelectDetail} AppNavSelectDetail */
/** @typedef {import('../app-icon/app-icon.js').AppIconTone} ModuleTone */
/**
 * One module: an application-level destination or a module with a menu of its own.
 * @typedef {Object} ModuleItem
 * @property {string|number} id Stable module identifier.
 * @property {string} label Module name: the tile's accessible name, tooltip, and catalogue label.
 * @property {string|Node|{toElement: () => Node|null}|((context: Record<string, any>, item: AppNavItem) => Node|null)} [icon] Icon name, node, component, or factory.
 * @property {ModuleTone} [tone] Identity colour from the theme's categorical tones.
 * @property {string} [color] Identity colour as any CSS colour; takes precedence over `tone`.
 * @property {string|number} [badge] Count or status badge.
 * @property {boolean|number} [pinned] Shown on the bar, in this order when a number. When no
 *   module sets it, every module is on the bar; otherwise unpinned modules are in "All modules" only.
 * @property {string} [group] Group heading in the "All modules" catalogue.
 * @property {string} [description] Secondary text, shown as the catalogue entry's title.
 * @property {unknown} [value] Emitted value; defaults to `id`.
 * @property {string} [href] Native navigation target for a module without a menu.
 * @property {string} [target] Native link browsing context.
 * @property {() => void} [invoke] Application-owned non-link action.
 * @property {boolean} [disabled] Whether activation is unavailable.
 * @property {AppNavItem[]} [children] The module's menu. With `menus: 'flyout'` it opens beside
 *   the tile; it never renders inline.
 */
/**
 * @typedef {Object} ModuleBarOptions
 * @property {ModuleItem[]} [items=[]] Modules, in bar order.
 * @property {string|number|null} [active=null] Active destination id: a module, or any item in a module's menu.
 * @property {'vertical'|'horizontal'} [orientation='vertical'] Bar flow.
 * @property {'left'|'right'|'top'|'bottom'} [side='left'] Workspace edge the bar occupies.
 * @property {'tint'|'solid'|'plain'} [appearance='tint'] Tile treatment: the glyph in the module
 *   colour on a tint of it, the solid identity tile, or monochrome glyphs.
 * @property {'hidden'|'below'|'beside'} [labels='hidden'] Whether a vertical bar prints each
 *   module's name: under its tile (a narrow strip), beside it (a full navigation column, with the
 *   count at the end of the row), or not at all — the name then stays the accessible name and the
 *   tooltip. Horizontal bars never print names.
 * @property {'flyout'|'none'} [menus='flyout'] How a module's children are presented: in a flyout,
 *   or by an adjacent panel the application owns, in which case activating the module emits `select`.
 * @property {string|number|null} [expanded=null] With `menus: 'none'`, the module whose menu the
 *   adjacent panel shows.
 * @property {string|null} [controls=null] With `menus: 'none'`, the id of that panel.
 * @property {'auto'|'always'|'never'} [allModules='auto'] The "All modules" button: shown when a
 *   module does not fit or is unpinned, always, or never (the bar then scrolls).
 * @property {Node|string|number|{toElement: () => Node|null}|null} [header=null] Leading content, such as a product mark.
 * @property {Node|string|number|{toElement: () => Node|null}|null} [footer=null] Trailing content, such as an account menu.
 * @property {string|null} [label=null] Navigation accessible label. Omitted resolves `moduleBar.label`, English `Modules`.
 * @property {number} [openDelay=80] Flyout hover-open delay in milliseconds.
 * @property {number} [closeDelay=160] Flyout pointer and focus crossing grace in milliseconds.
 * @property {(item: AppNavItem, context: Record<string, any>) => Node|null} [renderIcon] Optional host icon renderer.
 * @property {(event: CustomEvent<AppNavSelectDetail>) => void} [onselect] Preventable activation listener.
 * @property {(event: CustomEvent<{item: AppNavItem, id: string|number, open: boolean}>) => void} [onflyoutchange] Flyout-state listener.
 * @property {(event: CustomEvent<{visible: Array<string|number>, overflow: Array<string|number>}>) => void} [onoverflowchange] Overflow listener.
 * @property {(event: CustomEvent<{open: boolean}>) => void} [onallmodules] "All modules" catalogue open-state listener.
 */

const APPEARANCES = ['tint', 'solid', 'plain'];
/** Modules above which the catalogue offers a filter field. */
const FILTER_THRESHOLD = 12;
/** Milliseconds after which type-ahead starts a new search. */
const TYPEAHEAD_RESET = 600;

/**
 * The module level of an application: one colour-coded tile per module in a vertical strip or a
 * horizontal bar. A module with a menu opens it in a flyout, or leaves it to an adjacent panel
 * (`menus: 'none'`, which is how `AppSidebar` composes the bar). Modules that do not fit, or are
 * not pinned, are one step away in the "All modules" catalogue. The bar is one Tab stop: arrow
 * keys, Home, End, and type-ahead move between tiles.
 * @fires ModuleBar#select
 * @fires ModuleBar#flyoutchange
 * @fires ModuleBar#overflowchange
 * @fires ModuleBar#allmodules
 * @extends {AppRailPresenter}
 */
export class ModuleBar extends AppRailPresenter {
  static cssName = 'module-bar';

  static partBlock = 'zx-module-bar';

  /** @type {Readonly<ModuleBarOptions>} */
  static defaults = {
    items: [],
    active: null,
    orientation: 'vertical',
    side: 'left',
    appearance: 'tint',
    labels: 'hidden',
    menus: 'flyout',
    expanded: null,
    controls: null,
    allModules: 'auto',
    header: null,
    footer: null,
    label: null,
    openDelay: 80,
    closeDelay: 160,
    renderIcon: null
  };

  /**
   * Creates or enhances a module bar.
   * @param {Element|string|null} [target=null] Bar target; a `<nav>` is created when null.
   * @param {ModuleBarOptions} [options={}] Bar options.
   */
  constructor(target = null, options = {}) {
    super(target, options);
  }

  /** @returns {HTMLElement} */
  render() {
    const root = /** @type {HTMLElement} */ (super.render());
    this._sections = new Map();
    this._items = liftSections(this._items, this._sections);
    this._appearance = APPEARANCES.includes(this.options.appearance) ? this.options.appearance : 'tint';
    this._menus = this.options.menus === 'none' ? 'none' : 'flyout';
    this._expandedId = this.options.expanded ?? null;
    this._labels = this.options.labels;
    this._promoted = null;
    this._catalogue = null;
    this._silenceCatalogue = false;
    this._catalogueTooltip = null;
    this._observer = null;
    this._partition = { visible: [], overflow: [] };
    this._rovingId = null;
    this._typeahead = { text: '', at: 0 };
    root.setAttribute('aria-label', this._labelText());
    root.dataset.appearance = this._appearance;
    root.dataset.menus = this._menus;
    root.dataset.allModules = ['always', 'never'].includes(this.options.allModules) ? this.options.allModules : 'auto';
    root.dataset.labels = labelsMode(this.options.labels, root.dataset.orientation);
    return root;
  }

  /** Replaces the modules and rebuilds the bar. @param {ModuleItem[]} items @returns {this} */
  setItems(items) {
    const sections = new Map();
    const modules = liftSections(normalizeAppItems(items), sections);
    this._sections = sections;
    return super.setItems(modules);
  }

  /** Returns a copy of the normalized modules. @returns {ModuleItem[]} */
  getItems() {
    return /** @type {ModuleItem[]} */ (super.getItems());
  }

  /**
   * Marks the active destination — a module, or anything in a module's menu — without routing.
   * The module holding it becomes current and stays on the bar.
   * @param {string|number|null} id Destination id.
   * @returns {this}
   */
  setActive(id) {
    return super.setActive(id);
  }

  /** Opens a module's menu flyout. @param {string|number} id Module id. @param {{focus?: boolean}} [options={}] Focus its first item. @returns {this} */
  openFlyout(id, options = {}) {
    return super.openFlyout(id, options);
  }

  /** Closes a module's menu flyout. @param {string|number} id Module id. @returns {this} */
  closeFlyout(id) {
    return super.closeFlyout(id);
  }

  /** Closes every menu flyout. @returns {this} */
  closeAllFlyouts() {
    return super.closeAllFlyouts();
  }

  /** Reports whether a module's menu flyout is open. @param {string|number} id Module id. @returns {boolean} */
  isFlyoutOpen(id) {
    return super.isFlyoutOpen(id);
  }

  /**
   * With `menus: 'none'`, names the module whose menu the adjacent panel now shows.
   * @param {string|number|null} id Module id, or null when the panel shows none.
   * @returns {this}
   */
  setExpanded(id) {
    this._expandedId = id ?? null;
    this._syncExpanded();
    this._layout();
    return this;
  }

  /**
   * Updates one badge in place — on the tile, in a flyout, and in the catalogue — without
   * rebuilding the bar. `null` removes it.
   * @param {string|number} id Module or menu item id.
   * @param {string|number|null} badge New badge.
   * @returns {this}
   */
  setBadge(id, badge) {
    const item = findItem(this._items, id);
    if (!item) return this;
    if (badge == null || badge === '') delete item.badge;
    else item.badge = badge;
    const key = String(id);
    for (const control of this.refs.list.querySelectorAll('.zx-module-bar__item[data-app-nav-value-id]')) {
      if (control.getAttribute('data-app-nav-value-id') === key) this._applyTileBadge(control, item);
    }
    for (const flyout of this._flyouts.values()) {
      for (const control of flyout.panel.querySelectorAll('[data-app-nav-value-id]')) {
        if (control.getAttribute('data-app-nav-value-id') === key) applyRowBadge(control, item, 'zx-app-rail__flyout-item');
      }
    }
    const entry = this._catalogueEntry(key);
    if (entry) applyRowBadge(entry, item, 'zx-module-bar__entry');
    return this;
  }

  /**
   * Changes flow or edge, keeping items, the active destination, and the expanded module.
   * @param {{orientation?: 'vertical'|'horizontal', side?: 'left'|'right'|'top'|'bottom'}} layout
   * @returns {this}
   */
  setLayout(layout = {}) {
    const orientation = layout.orientation === 'horizontal' || layout.orientation === 'vertical'
      ? layout.orientation : this.el.dataset.orientation;
    const sides = orientation === 'horizontal' ? ['top', 'bottom'] : ['left', 'right'];
    const side = sides.includes(layout.side ?? this.el.dataset.side) ? (layout.side ?? this.el.dataset.side) : sides[0];
    if (orientation === this.el.dataset.orientation && side === this.el.dataset.side) return this;
    this.el.dataset.orientation = orientation;
    this.el.dataset.side = side;
    this.el.dataset.labels = labelsMode(this._labels, orientation);
    this._rebuild();
    return this;
  }

  /**
   * Changes whether module names are printed — the expanded and collapsed states of a vertical
   * navigation column — keeping items, the active destination, and the expanded module.
   * @param {'hidden'|'below'|'beside'} labels
   * @returns {this}
   */
  setLabels(labels) {
    this._labels = labels;
    const next = labelsMode(labels, this.el.dataset.orientation);
    if (next === this.el.dataset.labels) return this;
    const active = document.activeElement;
    const focused = active instanceof HTMLElement && this.refs.list.contains(active)
      && active.matches('.zx-module-bar__item') ? rovingKey(active) : null;
    this.el.dataset.labels = next;
    this._rebuild();
    if (focused !== null) {
      /** @type {HTMLElement[]} */ ([...this.refs.list.querySelectorAll('.zx-module-bar__item')])
        .find((control) => rovingKey(control) === focused)?.focus();
    }
    return this;
  }

  /** Opens the "All modules" catalogue and focuses its filter or first entry. @returns {this} */
  openAllModules() {
    this._catalogue?.open();
    this._focusCatalogue();
    return this;
  }

  /** Closes the "All modules" catalogue. @returns {this} */
  closeAllModules() {
    this._catalogue?.close();
    return this;
  }

  /** Reports whether the "All modules" catalogue is open. @returns {boolean} */
  isAllModulesOpen() {
    return this._catalogue?.isOpen() ?? false;
  }

  /** Focuses the bar's Tab stop: the current module, else the first tile. @returns {this} */
  focus() {
    this._rovingStop()?.focus();
    return this;
  }

  /** Destroys flyouts, tooltips, and the catalogue, and restores or removes the root. @returns {void} */
  destroy() {
    super.destroy();
  }

  /** @param {Node|null} node @returns {boolean} @private */
  _containsNode(node) {
    return super._containsNode(node) || Boolean(node && this._catalogue?.getPanel().contains(node));
  }

  /** @returns {void} */
  _clearArtifacts() {
    super._clearArtifacts();
    this._observer?.disconnect();
    this._observer = null;
    this._catalogueTooltip?.destroy();
    this._catalogueTooltip = null;
    // A catalogue torn down with the bar is not a reader closing it.
    this._silenceCatalogue = true;
    this._catalogue?.destroy();
    this._silenceCatalogue = false;
    this._catalogue = null;
  }

  /** @param {AppNavItem} item @returns {boolean} */
  _flyoutsFor(item) {
    return this._menus === 'flyout' && !item.disabled;
  }

  /** @returns {boolean} */
  _tooltipFor() {
    return this.el.dataset.labels === 'hidden';
  }

  /** @param {AppNavItem} item @returns {HTMLElement} */
  _renderControl(item) {
    const menu = Boolean(item.children?.length);
    const tag = item.href && !menu ? 'a' : 'button';
    const named = this.el.dataset.labels !== 'hidden';
    const control = /** @type {HTMLElement} */ (h(tag, {
      class: 'zx-module-bar__item',
      type: tag === 'button' ? 'button' : null,
      href: tag === 'a' ? item.href : null,
      target: tag === 'a' ? item.target ?? null : null,
      rel: tag === 'a' && item.target ? 'noopener' : null,
      ariaDisabled: item.disabled ? 'true' : null,
      tabIndex: -1,
      dataset: { appNavId: String(item.id), appNavValueId: String(item.id) }
    },
    this._renderTile(item, 'bar'),
    named ? h('span', { class: 'zx-module-bar__label' }, item.label) : null));
    this._applyTileBadge(control, item);
    return control;
  }

  /** @returns {void} */
  _afterRebuild() {
    const list = this.refs.list;
    const order = barOrder(this._items);
    const rows = new Map();
    for (const row of [...list.children]) {
      const id = row.querySelector('[data-app-nav-value-id]')?.getAttribute('data-app-nav-value-id');
      if (id == null) continue;
      row.dataset.moduleId = id;
      rows.set(id, row);
    }
    // Bar order puts pinned modules first, in their pinned order; rows are moved once, here. A
    // section heads the first of its modules; on an icon strip it is drawn as a rule.
    let section = null;
    for (const item of order) {
      const row = rows.get(String(item.id));
      if (!row) continue;
      const label = this._sections.get(String(item.id)) ?? null;
      if (label !== null && label !== section) {
        list.append(h('li', { class: 'zx-module-bar__heading', dataset: { section: label } },
          h('span', { class: 'zx-module-bar__heading-label' }, label)));
      }
      section = label;
      list.append(row);
    }
    if (this._promoted !== null && !findItem(this._items, this._promoted)) this._promoted = null;
    this._buildCatalogue();
    this._interaction.listen(list, 'focusin', (event) => {
      const control = /** @type {Element} */ (event.target).closest?.('.zx-module-bar__item');
      if (control instanceof HTMLElement) this._setRovingStop(control);
    });
    this._interaction.listen(list, 'focusout', (event) => {
      if (!list.contains(/** @type {Node|null} */ (event.relatedTarget))) {
        this._rovingId = null;
        this._syncRoving();
      }
    });
    if (typeof ResizeObserver === 'function') {
      this._observer = new ResizeObserver(() => this._layout());
      this._observer.observe(list);
    }
  }

  /** @returns {void} */
  _syncActive() {
    super._syncActive();
    const activeId = this._active == null ? null : String(this._active);
    for (const control of this._tiles()) {
      const item = findItem(this._items, control.getAttribute('data-app-nav-value-id'));
      if (!item) continue;
      const state = currentState(item, activeId);
      if (state) control.setAttribute('aria-current', state);
      else control.removeAttribute('aria-current');
      if (state === 'true') control.dataset.activeDescendant = 'true';
      else delete control.dataset.activeDescendant;
    }
    for (const entry of this._catalogueEntries()) {
      const item = findItem(this._items, entry.dataset.moduleId);
      const state = item ? currentState(item, activeId) : null;
      if (state) entry.setAttribute('aria-current', state);
      else entry.removeAttribute('aria-current');
    }
    this._syncExpanded();
    this._layout();
  }

  /**
   * Shows the tiles that fit, in bar order, and moves the rest behind "All modules". Everything is
   * shown first so a bar sized by its content measures as not overflowing and never shrinks itself.
   * @returns {void}
   */
  _layout() {
    const list = this.refs.list;
    if (!list || !this._items) return;
    const rows = [...list.querySelectorAll(':scope > [data-module-id]')];
    const moreRow = list.querySelector(':scope > [data-module-bar-more]');
    const mode = this.el.dataset.allModules;
    const keep = [moduleOf(this._items, this._active)?.id, this._expandedId, this._promoted];
    let capacity = Infinity;
    if (mode !== 'never' && list.isConnected) {
      for (const row of rows) row.hidden = false;
      if (moreRow) moreRow.hidden = false;
      syncHeadings(list);
      capacity = measureCapacity(list, this.el.dataset.orientation === 'horizontal', rows.length + 1);
    }
    // An always-shown button takes its slot whether or not anything overflows.
    const partition = partitionModules(this._items, capacity, keep, mode === 'always');
    const visible = new Set(partition.visible.map((item) => String(item.id)));
    for (const row of rows) row.hidden = !visible.has(row.dataset.moduleId);
    syncHeadings(list);
    if (moreRow) moreRow.hidden = mode === 'never' || (mode === 'auto' && !partition.more);
    const ids = {
      visible: partition.visible.map((item) => item.id),
      overflow: partition.overflow.map((item) => item.id)
    };
    const changed = ids.visible.join('\u0000') !== this._partition.visible.join('\u0000')
      || ids.overflow.join('\u0000') !== this._partition.overflow.join('\u0000');
    this._partition = ids;
    this._syncRoving();
    // Before the bar is in a document nothing has been measured, so nothing has changed yet.
    if (changed && list.isConnected) this.emit('overflowchange', { ...ids });
  }

  /** @param {AppNavItem} item @param {'bar'|'catalogue'} location @returns {HTMLElement} */
  _renderTile(item, location) {
    const visual = appNavIcon(item, this.options.renderIcon, {
      orientation: this.el.dataset.orientation,
      collapsed: true,
      side: this.el.dataset.side,
      level: 1,
      location: location === 'bar' ? 'module' : 'catalogue'
    }) ?? h('span', { class: 'zx-module-bar__initial' }, item.label.trim().charAt(0).toUpperCase());
    const { tone, color } = resolveModuleColor(item);
    const tile = h('span', {
      class: 'zx-module-bar__tile',
      ariaHidden: 'true',
      dataset: { appearance: this._appearance, ...(tone ? { tone } : {}), ...(color ? { color: '' } : {}) }
    });
    if (this._appearance === 'solid') {
      tile.append(appIcon({
        icon: visual,
        color,
        tone: tone ?? (color ? null : 'slate'),
        size: 'var(--zx-module-bar-tile)',
        iconSize: '58%',
        glass: 'subtle'
      }));
    } else {
      if (color) tile.style.setProperty('--zx-module-bar-color', color);
      tile.append(visual);
    }
    return tile;
  }

  /** @param {HTMLElement} control @param {AppNavItem} item @returns {void} */
  _applyTileBadge(control, item) {
    control.querySelector(':scope > .zx-module-bar__badge')?.remove();
    const count = item.badge == null || item.badge === '' ? null : String(item.badge);
    control.setAttribute('aria-label', count === null ? item.label
      : this._message('moduleBar.itemBadge', '%1 (%2)', item.label, count));
    if (count === null) return;
    control.append(h('span', {
      class: 'zx-module-bar__badge',
      ariaHidden: 'true',
      // A three-digit pill on a tile stops being a badge and starts being a label: past two
      // characters it is drawn as a dot, and the figure lives on in the accessible name. A row
      // with its name printed beside the tile has room for the whole figure.
      dataset: { zxBadge: count.length > 2 && this.el.dataset.labels !== 'beside' ? 'dot' : 'count' }
    }, count));
  }

  /** Builds the "All modules" button and its catalogue for this render. @returns {void} */
  _buildCatalogue() {
    const label = this._message('moduleBar.more', 'All modules');
    const named = this.el.dataset.labels !== 'hidden';
    const button = h('button', {
      class: 'zx-module-bar__item',
      type: 'button',
      ariaLabel: label,
      tabIndex: -1,
      dataset: { moduleBarMore: '' }
    },
    h('span', { class: 'zx-module-bar__tile', ariaHidden: 'true', dataset: { appearance: 'plain' } }, icon('grid')),
    named ? h('span', { class: 'zx-module-bar__label' }, label) : null);
    this.refs.list.append(h('li', { class: 'zx-module-bar__row', dataset: { moduleBarMore: '' } }, button));
    if (!named) {
      this._catalogueTooltip = new Tooltip(button, {
        content: label,
        placement: /** @type {any} */ ({ left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[this.el.dataset.side] ?? 'right'),
        delay: 450
      });
    }

    const filter = this._items.length > FILTER_THRESHOLD ? h('input', {
      class: 'zx-module-bar__filter',
      type: 'search',
      autocomplete: 'off',
      placeholder: this._message('moduleBar.filter', 'Filter modules'),
      ariaLabel: this._message('moduleBar.filter', 'Filter modules')
    }) : null;
    const groups = new Map();
    for (const item of this._items) {
      const name = typeof item.group === 'string' ? item.group : this._sections.get(String(item.id)) ?? '';
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(item);
    }
    const sections = [...groups].map(([name, members]) => {
      const headingId = name ? uid('zx-module-bar-group') : null;
      return h('div', { class: 'zx-module-bar__group' },
        name ? h('div', { class: 'zx-module-bar__group-label', id: headingId }, name) : null,
        h('ul', { class: 'zx-module-bar__grid', ariaLabelledby: headingId },
          members.map((item) => h('li', { dataset: { moduleId: String(item.id) } }, this._catalogueControl(item)))));
    });
    const empty = h('p', { class: 'zx-module-bar__empty', hidden: true },
      this._message('moduleBar.empty', 'No modules'));
    const content = h('div', { class: 'zx-module-bar__catalogue' }, filter, ...sections, empty);
    const placement = /** @type {any} */ ({
      left: 'right-start', right: 'left-start', top: 'bottom-end', bottom: 'top-end'
    }[this.el.dataset.side] ?? 'right-start');
    const dropdown = new Dropdown(button, { content, placement, offset: 6 });
    const panel = dropdown.getPanel();
    panel.classList.add('zx-module-bar__popover');
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', label);
    this._catalogue = dropdown;
    dropdown.on('open', () => {
      this.closeAllFlyouts();
      this._catalogueTooltip?.hide();
      this.emit('allmodules', { open: true });
    });
    dropdown.on('close', () => {
      if (filter instanceof HTMLInputElement && filter.value) {
        filter.value = '';
        this._filterCatalogue('');
      }
      if (!this._silenceCatalogue) this.emit('allmodules', { open: false });
    });
    this._interaction.listen(button, 'click', () => {
      if (dropdown.isOpen()) this._focusCatalogue();
    });
    if (filter) {
      this._interaction.listen(filter, 'input', () => this._filterCatalogue(/** @type {HTMLInputElement} */ (filter).value));
    }
    this._interaction.listen(panel, 'click', (event) => this._onCatalogueClick(event));
    // Tabbing out of the catalogue closes it, as clicking outside does.
    this._interaction.listen(panel, 'focusout', (event) => {
      const next = /** @type {Node|null} */ (event.relatedTarget);
      if (next && !panel.contains(next) && next !== button) dropdown.close();
    });
    this._interaction.listen(panel, 'keydown', (event) => this._onCatalogueKeydown(/** @type {KeyboardEvent} */ (event)));
    // The entries are one Tab stop, the one last focused: arrows move inside the grid.
    this._interaction.listen(panel, 'focusin', (event) => {
      const entry = /** @type {Element} */ (event.target).closest?.('.zx-module-bar__entry');
      if (entry instanceof HTMLElement) this._syncCatalogueStop(entry);
    });
    this._syncCatalogueStop();
  }

  /**
   * Leave exactly one visible catalogue entry in the Tab order: `preferred`, else the current stop,
   * else the current module, else the first entry the filter shows.
   * @param {HTMLElement} [preferred]
   * @returns {void}
   */
  _syncCatalogueStop(preferred) {
    const all = this._catalogueEntries();
    const shown = all.filter((entry) => !entry.closest('li')?.hidden);
    const stop = (preferred && shown.includes(preferred) ? preferred : null)
      ?? shown.find((entry) => entry.tabIndex === 0 && entry.dataset.catalogueStop === 'true')
      ?? shown.find((entry) => entry.hasAttribute('aria-current')) ?? shown[0];
    for (const entry of all) {
      entry.tabIndex = entry === stop ? 0 : -1;
      if (entry === stop) entry.dataset.catalogueStop = 'true';
      else delete entry.dataset.catalogueStop;
    }
  }

  /** @param {AppNavItem} item @returns {HTMLElement} */
  _catalogueControl(item) {
    const menu = Boolean(item.children?.length);
    const tag = item.href && !menu ? 'a' : 'button';
    const control = /** @type {HTMLElement} */ (h(tag, {
      class: 'zx-module-bar__entry',
      type: tag === 'button' ? 'button' : null,
      href: tag === 'a' ? item.href : null,
      target: tag === 'a' ? item.target ?? null : null,
      rel: tag === 'a' && item.target ? 'noopener' : null,
      title: typeof item.description === 'string' ? item.description : null,
      ariaDisabled: item.disabled ? 'true' : null,
      dataset: { moduleId: String(item.id) }
    },
    this._renderTile(item, 'catalogue'),
    h('span', { class: 'zx-module-bar__entry-label' }, item.label)));
    applyRowBadge(control, item, 'zx-module-bar__entry');
    return control;
  }

  /** @param {MouseEvent|Event} event @returns {void} */
  _onCatalogueClick(event) {
    const control = /** @type {Element} */ (event.target).closest?.('.zx-module-bar__entry');
    if (!(control instanceof HTMLElement)) return;
    const item = findItem(this._items, control.dataset.moduleId);
    if (!item || item.disabled) {
      event.preventDefault();
      return;
    }
    if (item.children?.length && this._menus === 'flyout') {
      // A module with a menu is not a destination: it joins the bar for now and opens its menu.
      event.preventDefault();
      this._catalogue?.close();
      this._promoted = item.id;
      this._layout();
      const keyboard = event instanceof MouseEvent && event.detail === 0;
      this.openFlyout(item.id, { focus: keyboard });
      if (!keyboard) this._tiles().find((tile) => tile.getAttribute('data-app-nav-value-id') === String(item.id))?.focus();
      return;
    }
    // Choosing a module ends the catalogue's job whether or not a listener took over the routing.
    this._select(item, event);
    const panel = this._catalogue?.getPanel();
    this._catalogue?.close();
    // Focus left behind in the hidden catalogue goes to the module, which the bar now shows, or
    // back to the button that opened it.
    const active = document.activeElement;
    if (!active || active === document.body || panel?.contains(active)) {
      const tile = this._tiles().find((control) => control.getAttribute('data-app-nav-value-id') === String(item.id)
        && !control.closest('li')?.hidden);
      (tile ?? this.refs.list.querySelector('[data-module-bar-more] .zx-module-bar__item'))?.focus();
    }
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onCatalogueKeydown(event) {
    const panel = this._catalogue?.getPanel();
    if (!panel || event.altKey || event.ctrlKey || event.metaKey) return;
    const filter = panel.querySelector('.zx-module-bar__filter');
    const entries = this._catalogueEntries().filter((entry) => !entry.closest('li')?.hidden);
    const current = /** @type {Element} */ (event.target).closest?.('.zx-module-bar__entry');
    if (event.target === filter) {
      if (event.key === 'ArrowDown' && entries[0]) {
        event.preventDefault();
        entries[0].focus();
      }
      return;
    }
    if (!(current instanceof HTMLElement)) return;
    const index = entries.indexOf(current);
    let next = null;
    if (event.key === 'ArrowRight') next = entries[Math.min(entries.length - 1, index + 1)];
    else if (event.key === 'ArrowLeft') next = entries[Math.max(0, index - 1)];
    else if (event.key === 'Home') next = entries[0];
    else if (event.key === 'End') next = entries.at(-1);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      next = nearestInRow(entries, current, event.key === 'ArrowDown' ? 1 : -1);
      if (!next && event.key === 'ArrowUp' && filter instanceof HTMLElement) next = filter;
    } else if (filter instanceof HTMLElement && event.key.length === 1 && event.key !== ' ') {
      // Typing anywhere in the catalogue filters it: the character lands in the field.
      filter.focus();
      return;
    } else return;
    event.preventDefault();
    next?.focus();
  }

  /** @param {string} query @returns {void} */
  _filterCatalogue(query) {
    const panel = this._catalogue?.getPanel();
    if (!panel) return;
    const needle = query.trim().toLocaleLowerCase();
    let shown = 0;
    for (const group of panel.querySelectorAll('.zx-module-bar__group')) {
      let groupShown = 0;
      for (const row of group.querySelectorAll('li[data-module-id]')) {
        const item = findItem(this._items, /** @type {HTMLElement} */ (row).dataset.moduleId);
        const haystack = `${item?.label ?? ''} ${item?.description ?? ''} ${item?.group ?? ''}`.toLocaleLowerCase();
        const match = !needle || haystack.includes(needle);
        /** @type {HTMLElement} */ (row).hidden = !match;
        if (match) groupShown += 1;
      }
      /** @type {HTMLElement} */ (group).hidden = groupShown === 0;
      shown += groupShown;
    }
    const empty = panel.querySelector('.zx-module-bar__empty');
    if (empty instanceof HTMLElement) empty.hidden = shown > 0;
    this._syncCatalogueStop();
  }

  /** @returns {void} */
  _focusCatalogue() {
    const panel = this._catalogue?.getPanel();
    if (!panel || !this._catalogue?.isOpen()) return;
    const filter = panel.querySelector('.zx-module-bar__filter');
    const target = filter ?? this._catalogueEntries().find((entry) => entry.hasAttribute('aria-current'))
      ?? this._catalogueEntries()[0];
    if (target instanceof HTMLElement) target.focus();
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onRailKeydown(event) {
    const control = /** @type {Element} */ (event.target).closest?.('.zx-module-bar__item');
    if (!(control instanceof HTMLElement) || !this.refs.list.contains(control)) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const controls = this._rovingControls();
    const index = controls.indexOf(control);
    const horizontal = this.el.dataset.orientation === 'horizontal';
    const previous = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const next = horizontal ? 'ArrowRight' : 'ArrowDown';
    const into = /** @type {Record<string, string>} */ ({
      left: 'ArrowRight', right: 'ArrowLeft', top: 'ArrowDown', bottom: 'ArrowUp'
    })[this.el.dataset.side];
    const id = control.getAttribute('data-app-nav-id');
    if (event.key === into && id !== null && this._flyouts.has(id)) {
      event.preventDefault();
      this.openFlyout(id, { focus: true });
      return;
    }
    let target = null;
    if (event.key === 'Home') target = controls[0];
    else if (event.key === 'End') target = controls.at(-1);
    else if (event.key === previous) target = controls[(index - 1 + controls.length) % controls.length];
    else if (event.key === next) target = controls[(index + 1) % controls.length];
    else if (event.key.length === 1 && event.key !== ' ') target = this._typeaheadTarget(event.key, controls, index);
    else return;
    if (!target) return;
    event.preventDefault();
    // The Tab stop moves with the key, not only with the focus event a background window withholds.
    this._setRovingStop(target);
    target.focus();
  }

  /** @param {string} key @param {HTMLElement[]} controls @param {number} index @returns {HTMLElement|null} */
  _typeaheadTarget(key, controls, index) {
    const now = Date.now();
    const text = now - this._typeahead.at > TYPEAHEAD_RESET ? key : this._typeahead.text + key;
    this._typeahead = { text, at: now };
    const needle = text.toLocaleLowerCase();
    // Repeating one letter cycles through the modules that start with it.
    const repeated = [...needle].every((character) => character === needle[0]);
    const labelOf = (control) => (findItem(this._items, control.getAttribute('data-app-nav-value-id'))?.label
      ?? control.getAttribute('aria-label') ?? '').toLocaleLowerCase();
    const ordered = [...controls.slice(index + 1), ...controls.slice(0, index + 1)];
    const match = ordered.find((control) => labelOf(control).startsWith(needle))
      ?? (repeated ? ordered.find((control) => labelOf(control).startsWith(needle[0])) : null);
    if (match || text.length === 1) return match ?? null;
    // Nothing starts with the whole run: the key starts a new search of its own.
    this._typeahead = { text: key, at: now };
    return ordered.find((control) => labelOf(control).startsWith(key.toLocaleLowerCase())) ?? null;
  }

  /** @returns {HTMLElement[]} Every module tile, shown or not. */
  _tiles() {
    return /** @type {HTMLElement[]} */ ([...this.refs.list.querySelectorAll(
      ':scope > li > .zx-module-bar__item[data-app-nav-value-id]')]);
  }

  /** @returns {HTMLElement[]} The tiles and button the arrow keys move between, in bar order. */
  _rovingControls() {
    return /** @type {HTMLElement[]} */ ([...this.refs.list.querySelectorAll(':scope > li:not([hidden]) > .zx-module-bar__item')]);
  }

  /** @returns {HTMLElement|null} */
  _rovingStop() {
    const controls = this._rovingControls();
    if (this._rovingId !== null) {
      const focused = controls.find((control) => rovingKey(control) === this._rovingId);
      if (focused) return focused;
    }
    return controls.find((control) => control.hasAttribute('aria-current'))
      ?? controls.find((control) => control.getAttribute('aria-expanded') === 'true'
        && control.hasAttribute('data-app-nav-value-id'))
      ?? controls[0] ?? null;
  }

  /** @param {HTMLElement} control @returns {void} */
  _setRovingStop(control) {
    this._rovingId = rovingKey(control);
    this._syncRoving();
  }

  /** @returns {void} */
  _syncRoving() {
    const stop = this._rovingStop();
    for (const control of this.refs.list.querySelectorAll(':scope > li > .zx-module-bar__item')) {
      /** @type {HTMLElement} */ (control).tabIndex = control === stop ? 0 : -1;
    }
  }

  /** @returns {void} */
  _syncExpanded() {
    if (this._menus !== 'none') return;
    const expanded = this._expandedId == null ? null : String(this._expandedId);
    for (const control of this._tiles()) {
      const id = control.getAttribute('data-app-nav-value-id');
      const item = findItem(this._items, id);
      // A module the adjacent panel can show: one with a menu, or with panel content of its own.
      const panelled = Boolean(item?.children?.length || item?.header || item?.content) || id === expanded;
      if (!panelled) continue;
      control.setAttribute('aria-expanded', String(id === expanded));
      if (this.options.controls) control.setAttribute('aria-controls', String(this.options.controls));
    }
  }

  /** @returns {HTMLElement[]} */
  _catalogueEntries() {
    const panel = this._catalogue?.getPanel();
    return panel ? /** @type {HTMLElement[]} */ ([...panel.querySelectorAll('.zx-module-bar__entry')]) : [];
  }

  /** @param {string} id @returns {HTMLElement|null} */
  _catalogueEntry(id) {
    return this._catalogueEntries().find((entry) => entry.dataset.moduleId === id) ?? null;
  }

  /** @returns {string} */
  _labelText() {
    const label = this.options.label;
    return label == null || label === '' ? this._message('moduleBar.label', 'Modules') : String(label);
  }
}

/**
 * Splits modules into those the bar shows and those only "All modules" offers.
 *
 * Bar order is pinned modules first — by their pinned number, then as listed — and the rest as
 * listed. When any module is pinned, unpinned modules go to the catalogue. When the bar cannot
 * hold every candidate, one slot goes to the "All modules" button. Modules named in `keep` (the
 * current module, the module an adjacent panel shows) stay on the bar whatever their pin or
 * position, displacing the last module that is not kept.
 * @param {ModuleItem[]} items Modules.
 * @param {number} [capacity=Infinity] Slots the bar has room for, the button included.
 * @param {Array<string|number|null|undefined>|string|number|null} [keep=[]] Module ids that must stay visible.
 * @param {boolean} [reserve=false] Keep a slot for the button even when every module fits.
 * @returns {{visible: ModuleItem[], overflow: ModuleItem[], more: boolean}}
 */
export function partitionModules(items, capacity = Infinity, keep = [], reserve = false) {
  const list = Array.isArray(items) ? items.filter((item) => item && item.id != null) : [];
  const order = barOrder(list);
  const pinnedMode = list.some(isPinned);
  const candidates = pinnedMode ? order.filter(isPinned) : order;
  const limit = Number.isFinite(capacity) ? Math.max(1, Math.floor(capacity)) : Infinity;
  const needsMore = reserve || candidates.length < list.length || candidates.length > limit;
  const slots = needsMore ? Math.max(0, limit - 1) : limit;
  const visible = candidates.slice(0, slots);
  const kept = new Set([keep].flat().filter((id) => id != null).map(String));
  for (const id of kept) {
    const item = list.find((candidate) => String(candidate.id) === id);
    if (!item || visible.includes(item)) continue;
    if (visible.length >= slots) {
      const displaced = visible.findLastIndex((candidate) => !kept.has(String(candidate.id)));
      if (displaced >= 0) visible.splice(displaced, 1);
    }
    visible.push(item);
  }
  visible.sort((first, second) => order.indexOf(first) - order.indexOf(second));
  const overflow = list.filter((item) => !visible.includes(item));
  return { visible, overflow, more: overflow.length > 0 };
}

/**
 * Resolves a module's identity colour: a valid CSS `color` wins, then a known `tone`.
 * @param {{tone?: unknown, color?: unknown}} item Module.
 * @returns {{tone: ModuleTone|null, color: string|null}}
 */
export function resolveModuleColor(item) {
  const color = isCssColor(item?.color) ? String(item.color).trim() : null;
  if (color) return { tone: null, color };
  const tone = APP_ICON_TONES.includes(/** @type {any} */ (item?.tone)) ? /** @type {ModuleTone} */ (item.tone) : null;
  return { tone, color: null };
}

/**
 * Modules are one level: a section contributes its modules, and remembers itself as their heading.
 * @param {AppNavItem[]} items Normalized items.
 * @param {Map<string, string>} [sections] Filled with each sectioned module's heading.
 * @param {string|null} [heading=null] The section being lifted.
 * @returns {AppNavItem[]}
 */
export function liftSections(items, sections = new Map(), heading = null) {
  return items.flatMap((item) => {
    if (item.section) return liftSections(item.children ?? [], sections, item.label);
    if (heading !== null) sections.set(String(item.id), heading);
    return [item];
  });
}

/**
 * Shows a section heading only while one of its modules is on the bar, and marks the heading
 * that opens the bar, which an icon strip leaves out: a rule above the first module separates
 * nothing.
 * @param {HTMLElement} list Bar list.
 * @returns {void}
 */
function syncHeadings(list) {
  let heading = null;
  let any = false;
  let leading = true;
  const close = () => {
    if (heading) heading.hidden = !any;
  };
  for (const row of /** @type {HTMLElement[]} */ ([...list.children])) {
    if (row.classList.contains('zx-module-bar__heading')) {
      close();
      heading = row;
      any = false;
      if (leading) row.dataset.leading = '';
      else delete row.dataset.leading;
      continue;
    }
    if (row.hasAttribute('data-module-id') && !row.hidden) {
      any = true;
      leading = false;
    }
  }
  close();
}

/**
 * The labels a bar of this flow can print: vertical bars print them under or beside the tiles,
 * horizontal bars never.
 * @param {unknown} labels Requested mode.
 * @param {string|undefined} orientation Bar flow.
 * @returns {'hidden'|'below'|'beside'}
 */
function labelsMode(labels, orientation) {
  if (orientation !== 'vertical') return 'hidden';
  return labels === 'below' || labels === 'beside' ? labels : 'hidden';
}

/** @param {ModuleItem} item @returns {boolean} */
function isPinned(item) {
  return item.pinned === true || (typeof item.pinned === 'number' && Number.isFinite(item.pinned));
}

/** @param {ModuleItem[]} items @returns {ModuleItem[]} Pinned first, by pinned number, then as listed. */
function barOrder(items) {
  const rank = (item) => (typeof item.pinned === 'number' && Number.isFinite(item.pinned) ? item.pinned
    : item.pinned === true ? Number.MAX_SAFE_INTEGER - 1 : Number.MAX_SAFE_INTEGER);
  return items.map((item, index) => ({ item, index }))
    .sort((first, second) => rank(first.item) - rank(second.item) || first.index - second.index)
    .map(({ item }) => item);
}

/**
 * How many rows fit the list along its main axis, measured with every row shown.
 * @param {HTMLElement} list Bar list.
 * @param {boolean} horizontal Flow.
 * @param {number} count Rows, the button included.
 * @returns {number}
 */
function measureCapacity(list, horizontal, count) {
  const overflowing = horizontal ? list.scrollWidth > list.clientWidth + 1 : list.scrollHeight > list.clientHeight + 1;
  if (!overflowing) return Infinity;
  // Names may wrap a row to two lines: the tallest row decides, so no row is ever cut in half.
  const rows = /** @type {HTMLElement[]} */ ([...list.querySelectorAll(':scope > li:not([hidden]):not(.zx-module-bar__heading)')]);
  if (!rows.length) return Infinity;
  const headings = /** @type {HTMLElement[]} */ ([...list.querySelectorAll(':scope > li.zx-module-bar__heading:not([hidden])')]);
  const style = getComputedStyle(list);
  const gap = Number.parseFloat(horizontal ? style.columnGap : style.rowGap) || 0;
  const padding = horizontal
    ? (Number.parseFloat(style.paddingInlineStart) || 0) + (Number.parseFloat(style.paddingInlineEnd) || 0)
    : (Number.parseFloat(style.paddingBlockStart) || 0) + (Number.parseFloat(style.paddingBlockEnd) || 0);
  const size = Math.max(...rows.map((row) => (horizontal ? row.offsetWidth : row.offsetHeight)));
  const headingSpace = headings.reduce((sum, heading) => sum + gap + (horizontal ? heading.offsetWidth : heading.offsetHeight)
    + (Number.parseFloat(horizontal ? getComputedStyle(heading).marginInlineStart : getComputedStyle(heading).marginBlockStart) || 0)
    + (Number.parseFloat(horizontal ? getComputedStyle(heading).marginInlineEnd : getComputedStyle(heading).marginBlockEnd) || 0), 0);
  const available = (horizontal ? list.clientWidth : list.clientHeight) - padding - headingSpace;
  if (size <= 0 || available <= 0) return count;
  return Math.max(1, Math.floor((available + gap) / (size + gap)));
}

/** @param {HTMLElement[]} entries @param {HTMLElement} current @param {1|-1} direction @returns {HTMLElement|null} */
function nearestInRow(entries, current, direction) {
  const origin = current.getBoundingClientRect();
  const centre = origin.left + origin.width / 2;
  let best = null;
  let bestRow = Infinity;
  let bestDistance = Infinity;
  for (const entry of entries) {
    if (entry === current) continue;
    const rect = entry.getBoundingClientRect();
    const rowGap = direction > 0 ? rect.top - origin.bottom + 1 : origin.top - rect.bottom + 1;
    if (rowGap < 0) continue;
    const distance = Math.abs(rect.left + rect.width / 2 - centre);
    if (rowGap < bestRow - 1 || (Math.abs(rowGap - bestRow) <= 1 && distance < bestDistance)) {
      best = entry;
      bestRow = rowGap;
      bestDistance = distance;
    }
  }
  return best;
}

/** @param {HTMLElement} control @returns {string} */
function rovingKey(control) {
  return control.getAttribute('data-app-nav-value-id') ?? '\u0000more';
}

/** @param {AppNavItem} item @param {string|null} activeId @returns {'page'|'true'|null} */
function currentState(item, activeId) {
  if (activeId === null) return null;
  if (String(item.id) === activeId) return 'page';
  return containsItemId(item.children ?? [], activeId) ? 'true' : null;
}

/**
 * Updates the trailing badge of a row-shaped control (a flyout item, a catalogue entry).
 * @param {Element} control Row control.
 * @param {AppNavItem} item Its item.
 * @param {string} block The control's class, which names its parts.
 * @returns {void}
 */
function applyRowBadge(control, item, block) {
  const existing = control.querySelector(`:scope > .${block}-badge`);
  const count = item.badge == null || item.badge === '' ? null : String(item.badge);
  if (count === null) {
    existing?.remove();
    return;
  }
  if (existing) existing.textContent = count;
  else control.querySelector(`:scope > .${block}-label`)?.after(h('span', { class: `${block}-badge` }, count));
}

/**
 * The top-level module that is, or contains, an id.
 * @param {AppNavItem[]} items Modules.
 * @param {string|number|null|undefined} id Destination id.
 * @returns {AppNavItem|null}
 */
export function moduleOf(items, id) {
  if (id == null || !Array.isArray(items)) return null;
  const key = String(id);
  return items.find((item) => String(item.id) === key || containsItemId(item.children ?? [], key)) ?? null;
}

/** @param {AppNavItem[]} items @param {string|number|null|undefined} id @returns {AppNavItem|null} */
function findItem(items, id) {
  if (id == null) return null;
  for (const item of items ?? []) {
    if (String(item.id) === String(id)) return item;
    const child = findItem(item.children ?? [], id);
    if (child) return child;
  }
  return null;
}

/** @param {AppNavItem[]} items @param {string} id @returns {boolean} */
function containsItemId(items, id) {
  return items.some((item) => String(item.id) === id || containsItemId(item.children ?? [], id));
}

/** Fired when a module without a menu, a menu item, or (with `menus: 'none'`) any module is activated. @event ModuleBar#select @type {CustomEvent<AppNavSelectDetail>} */
/** Fired when a module's flyout opens or closes. @event ModuleBar#flyoutchange @type {CustomEvent<{item: AppNavItem, id: string|number, open: boolean}>} */
/** Fired when the modules on the bar change because of space, pins, or the current module. @event ModuleBar#overflowchange @type {CustomEvent<{visible: Array<string|number>, overflow: Array<string|number>}>} */
/** Fired when the "All modules" catalogue opens or closes. @event ModuleBar#allmodules @type {CustomEvent<{open: boolean}>} */
