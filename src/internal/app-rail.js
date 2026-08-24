import { Component } from '../core/component.js';
import { h, safeHref } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { Dropdown } from '../components/dropdown/dropdown.js';
import { Tooltip } from '../components/tooltip/tooltip.js';

/**
 * @typedef {Object} AppNavItem
 * @property {string|number} id Stable item identifier.
 * @property {string} label Visible/accessibility label.
 * @property {string|Node|{toElement: () => Node|null}|((context: Record<string, any>, item: AppNavItem) => Node|null)} [icon] Icon name, node, component, or factory.
 * @property {string|number} [badge] Count or status badge.
 * @property {unknown} [value] Emitted value; defaults to `id`.
 * @property {string} [href] Native navigation target; executable/data schemes are disabled.
 * @property {string} [target] Native link browsing context.
 * @property {() => void} [invoke] Application-owned non-link action.
 * @property {boolean} [disabled] Whether activation is unavailable.
 * @property {AppNavItem[]} [children] Child destinations/actions.
 */
/**
 * @typedef {Object} AppRailPresenterOptions
 * @property {AppNavItem[]} [items=[]] Application navigation tree.
 * @property {string|number|null} [active=null] Active item id.
 * @property {'vertical'|'horizontal'} [orientation='vertical'] Rail flow.
 * @property {'left'|'right'|'top'|'bottom'} [side='left'] Workspace edge occupied by the rail.
 * @property {string} [label='Applications'] Navigation accessible label.
 * @property {Node|string|number|{toElement: () => Node|null}|null} [header=null] Leading rail content.
 * @property {Node|string|number|{toElement: () => Node|null}|null} [footer=null] Trailing rail content.
 * @property {number} [openDelay=80] Hover-open delay in milliseconds.
 * @property {number} [closeDelay=160] Pointer/focus crossing grace in milliseconds.
 * @property {(item: AppNavItem, context: Record<string, any>) => Node|null} [renderIcon] Optional host icon renderer.
 * @property {(event: CustomEvent<AppNavSelectDetail>) => void} [onselect] Preventable action listener.
 * @property {(event: CustomEvent<{item: AppNavItem, id: string|number, open: boolean}>) => void} [onflyoutchange] Flyout-state listener.
 */
/** @typedef {{item: AppNavItem, id: string|number, value: unknown, href: string|null, event: Event}} AppNavSelectDetail */
/** @typedef {{key: string, parentKey: string|null, item: AppNavItem, trigger: HTMLElement, panel: HTMLElement, dropdown: Dropdown}} RailFlyout */

/**
 * Minimized application navigation; descendants always open in hover/focus flyouts, never inline.
 * @fires AppRailPresenter#select
 * @fires AppRailPresenter#flyoutchange
 * @extends {Component<AppRailPresenterOptions>}
 */
export class AppRailPresenter extends Component {
  static cssName = 'app-rail';

  /** @type {Readonly<AppRailPresenterOptions>} */
  static defaults = {
    items: [],
    active: null,
    orientation: 'vertical',
    side: 'left',
    label: 'Applications',
    header: null,
    footer: null,
    openDelay: 80,
    closeDelay: 160,
    renderIcon: null
  };

  /**
   * Creates or enhances a rail host.
   * @param {Element|string|null} target Rail target.
   * @param {AppRailPresenterOptions} [options={}] Rail options.
   */
  constructor(target = null, options = {}) {
    super(target, options);
    this._rebuild();
  }

  /** @returns {HTMLElement} */
  render() {
    this._createdRoot = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('nav'));
    this.el = root;
    this._original = this._createdRoot ? null : {
      attributes: Array.from(root.attributes, (attribute) => [attribute.name, attribute.value]),
      children: Array.from(root.childNodes)
    };
    this._items = normalizeAppItems(this.options.items);
    this._active = this.options.active;
    this._flyouts = new Map();
    this._tooltips = [];
    this._tooltipById = new Map();
    this._interaction = null;
    this._openTimers = new Map();
    this._closeTimers = new Map();
    this._pointerFocus = new WeakSet();
    this._silenceFlyoutEvents = false;
    root.setAttribute('aria-label', String(this.options.label));
    if (root.tagName !== 'NAV') root.setAttribute('role', 'navigation');
    root.dataset.orientation = this.options.orientation === 'horizontal' ? 'horizontal' : 'vertical';
    const sides = root.dataset.orientation === 'horizontal' ? ['top', 'bottom'] : ['left', 'right'];
    root.dataset.side = sides.includes(this.options.side) ? this.options.side : sides[0];
    const header = h('div', { class: 'zx-app-rail__header' });
    const footer = h('div', { class: 'zx-app-rail__footer' });
    appendSlot(header, this.options.header);
    appendSlot(footer, this.options.footer);
    header.hidden = !header.hasChildNodes();
    footer.hidden = !footer.hasChildNodes();
    root.replaceChildren(header, h('ul', { ref: 'list', class: 'zx-app-rail__list' }), footer);
    this.listen(root, 'keydown', (event) => this._onRailKeydown(/** @type {KeyboardEvent} */ (event)));
    return root;
  }

  /** Replaces navigation items and closes removed flyouts. @param {AppNavItem[]} items @returns {this} */
  setItems(items) {
    this._items = normalizeAppItems(items);
    this._rebuild();
    return this;
  }

  /** Sets the active item without routing. @param {string|number|null} id @returns {this} */
  setActive(id) {
    this._active = id;
    this._syncActive();
    return this;
  }

  /** Returns a shallow copy of normalized items. @returns {AppNavItem[]} */
  getItems() {
    return this._items.map((item) => ({ ...item, children: item.children?.map((child) => ({ ...child })) }));
  }

  /** Opens one item's flyout, optionally focusing its first action. @param {string|number} id @param {{focus?: boolean}} [options={}] @returns {this} */
  openFlyout(id, { focus = false } = {}) {
    const flyout = this._resolveFlyout(id);
    if (!flyout) return this;
    const branch = [flyout];
    let owner = flyout.parentKey === null ? null : this._flyouts.get(flyout.parentKey) ?? null;
    while (owner) {
      branch.unshift(owner);
      owner = owner.parentKey === null ? null : this._flyouts.get(owner.parentKey) ?? null;
    }
    if (branch.some((member) => member.item.disabled)) return this;
    this._cancelFlyoutTimers(flyout, true);
    for (const [otherId, other] of this._flyouts) {
      if (otherId !== flyout.key && other.dropdown.isOpen() && !this._isAncestor(other, flyout)) {
        this.closeFlyout(otherId);
      }
    }
    for (const member of branch) {
      this._tooltipById.get(String(member.item.id))?.hide();
      member.dropdown.open();
    }
    if (focus) firstAction(flyout.panel)?.focus();
    return this;
  }

  /** Closes one flyout. @param {string|number} id @returns {this} */
  closeFlyout(id) {
    const flyout = this._resolveFlyout(id);
    if (!flyout) return this;
    for (const descendant of [...this._flyouts.values()].reverse()) {
      if (descendant !== flyout && this._isAncestor(flyout, descendant)) {
        this._cancelTimers(descendant.key);
        descendant.dropdown.close();
      }
    }
    this._cancelTimers(flyout.key);
    flyout.dropdown.close();
    return this;
  }

  /** Closes every flyout and cancels pending hover/focus transitions. @returns {this} */
  closeAllFlyouts() {
    for (const flyout of this._flyouts.values()) {
      if (flyout.parentKey === null) this.closeFlyout(flyout.key);
    }
    for (const flyout of [...this._flyouts.values()].reverse()) {
      this._cancelTimers(flyout.key);
      if (flyout.dropdown.isOpen()) flyout.dropdown.close();
    }
    return this;
  }

  /** Reports whether an item's flyout is open. @param {string|number} id @returns {boolean} */
  isFlyoutOpen(id) {
    return this._resolveFlyout(id)?.dropdown.isOpen() ?? false;
  }

  /** Focuses the first top-level rail item. @returns {this} */
  focus() {
    firstAction(this.refs.list)?.focus();
    return this;
  }

  /** Reports whether a node belongs to this rail, including detached flyout panels. @param {Node|null} node @returns {boolean} @private */
  _containsNode(node) {
    return Boolean(node && (this.el.contains(node)
      || [...this._flyouts.values()].some((flyout) => flyout.panel.contains(node))));
  }

  /** Destroys body popovers/tooltips and restores or removes the root. @returns {void} */
  destroy() {
    const original = this._original;
    this._clearArtifacts();
    super.destroy();
    if (!this._createdRoot && original) {
      for (const attribute of Array.from(this.el.attributes)) this.el.removeAttribute(attribute.name);
      for (const [name, value] of original.attributes) this.el.setAttribute(name, value);
      this.el.replaceChildren(...original.children);
    }
  }

  /** @returns {void} */
  _rebuild() {
    this._clearArtifacts();
    this.refs.list.replaceChildren();
    this._interaction = new RailListenerScope(/** @type {HTMLElement} */ (this.el));
    this._items.forEach((item) => {
      const hasChildren = Array.isArray(item.children) && item.children.length > 0;
      const control = navControl(item, {
        className: 'zx-app-rail__item',
        index: String(item.id),
        iconOnly: true,
        disclosure: hasChildren,
        disclosureIcon: railDisclosureIcon(this.el.dataset.side),
        visual: appNavIcon(item, this.options.renderIcon, {
          orientation: this.el.dataset.orientation,
          collapsed: true,
          side: this.el.dataset.side,
          level: 1,
          location: 'root'
        })
      });
      const row = h('li', { class: 'zx-app-rail__row' }, control);
      this.refs.list.append(row);
      const tooltip = new Tooltip(control, {
        content: item.label,
        placement: tooltipPlacement(this.el.dataset.side),
        delay: 450
      });
      this._tooltips.push(tooltip);
      this._tooltipById.set(String(item.id), tooltip);
      if (hasChildren) this._buildFlyout(item, control, String(item.id), null);
      else this._interaction.listen(control, 'click', (event) => {
        const selected = this._select(item, event);
        if (!selected.defaultPrevented) {
          for (const flyout of this._flyouts.values()) {
            if (flyout.parentKey === null && flyout.dropdown.isOpen()) this.closeFlyout(flyout.key);
          }
        }
      });
    });
    this._interaction.listen(document, 'pointerdown', (event) => {
      const open = [...this._flyouts.values()].filter((flyout) => flyout.dropdown.isOpen());
      if (open.length === 0) return;
      const path = event.composedPath();
      if (open.some((flyout) => path.includes(flyout.panel) || path.includes(flyout.trigger))) return;
      for (const flyout of open) if (flyout.parentKey === null) this.closeFlyout(flyout.key);
    });
    this._syncActive();
  }

  /** @param {AppNavItem} item @param {HTMLElement} trigger @param {string} key @param {string|null} parentKey @returns {void} */
  _buildFlyout(item, trigger, key, parentKey) {
    const list = h('ul', { class: 'zx-app-rail__flyout-list' });
    for (const child of item.children ?? []) {
      const childKey = `${key}/${child.id}`;
      const hasChildren = Boolean(child.children?.length);
      const control = navControl(child, {
        className: 'zx-app-rail__flyout-item',
        index: childKey,
        iconOnly: false,
        disclosure: hasChildren,
        disclosureIcon: nestedDisclosureIcon(this.el.dataset.side),
        visual: appNavIcon(child, this.options.renderIcon, {
          orientation: this.el.dataset.orientation,
          collapsed: true,
          side: this.el.dataset.side,
          level: childKey.split('/').length,
          location: 'flyout'
        })
      });
      list.append(h('li', {}, control));
      if (hasChildren) this._buildFlyout(child, control, childKey, key);
      else this._interaction.listen(control, 'click', (event) => {
        const selected = this._select(child, event);
        if (!selected.defaultPrevented) this._closeFlyoutChain(key);
      });
    }
    const panel = h('div', {
      class: 'zx-app-rail__flyout'
    }, h('div', { class: 'zx-app-rail__flyout-title' }, item.label), list);
    const dropdown = new Dropdown(trigger, {
      openOn: 'manual',
      placement: parentKey === null ? flyoutPlacement(this.el.dataset.side)
        : nestedFlyoutPlacement(this.el.dataset.side),
      content: panel,
      offset: 6
    });
    const actualPanel = dropdown.getPanel();
    actualPanel.classList.add('zx-app-rail__popover');
    actualPanel.setAttribute('role', 'region');
    actualPanel.setAttribute('aria-label', `${item.label} sub-navigation`);
    const flyout = { key, parentKey, item, trigger, panel: actualPanel, dropdown };
    this._flyouts.set(key, flyout);
    dropdown.on('open', () => {
      if (!this._silenceFlyoutEvents) this.emit('flyoutchange', { item, id: item.id, open: true });
    });
    dropdown.on('close', () => {
      if (!this._silenceFlyoutEvents) this.emit('flyoutchange', { item, id: item.id, open: false });
    });

    this._interaction.listen(trigger, 'pointerdown', () => {
      this._pointerFocus.add(trigger);
      queueMicrotask(() => this._pointerFocus.delete(trigger));
    });
    this._interaction.listen(trigger, 'pointerenter', (event) => {
      if (/** @type {PointerEvent} */ (event).pointerType === 'touch') return;
      this._scheduleOpen(key);
    });
    this._interaction.listen(trigger, 'pointerleave', () => this._scheduleClose(key));
    this._interaction.listen(trigger, 'focus', () => {
      if (!this._pointerFocus.has(trigger)) this.openFlyout(key);
    });
    this._interaction.listen(trigger, 'focusout', (event) => {
      if (!actualPanel.contains(/** @type {Node|null} */ (event.relatedTarget))) this._scheduleClose(key);
    });
    this._interaction.listen(trigger, 'click', (event) => {
      event.preventDefault();
      if (event instanceof MouseEvent && event.detail === 0) this.openFlyout(key, { focus: true });
      else this.openFlyout(key);
    });
    this._interaction.listen(actualPanel, 'pointerenter', () => this._cancelFlyoutTimers(flyout, true));
    this._interaction.listen(actualPanel, 'pointerleave', () => this._scheduleFlyoutClose(flyout, true));
    this._interaction.listen(actualPanel, 'focusin', () => this._cancelFlyoutTimers(flyout, true));
    this._interaction.listen(actualPanel, 'focusout', (event) => {
      if (event.relatedTarget !== trigger && !actualPanel.contains(/** @type {Node|null} */ (event.relatedTarget))) {
        this._scheduleFlyoutClose(flyout, true);
      }
    });
    this._interaction.listen(actualPanel, 'keydown', (event) => this._onFlyoutKeydown(
      /** @type {KeyboardEvent} */ (event), flyout));
  }

  /** @param {AppNavItem} item @param {Event} event @returns {Event} */
  _select(item, event) {
    if (item.disabled) {
      event.preventDefault();
      const canceled = new Event('select', { cancelable: true });
      canceled.preventDefault();
      return canceled;
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
    return selected;
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onRailKeydown(event) {
    const controls = topLevelControls(this.refs.list);
    const current = /** @type {Element|null} */ (event.target)?.closest?.('[data-app-nav-id]');
    const index = controls.indexOf(current);
    if (index < 0) return;
    const horizontal = this.el.dataset.orientation === 'horizontal';
    const previous = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const next = horizontal ? 'ArrowRight' : 'ArrowDown';
    const into = ({ left: 'ArrowRight', right: 'ArrowLeft', top: 'ArrowDown', bottom: 'ArrowUp' })[this.el.dataset.side];
    const id = current.getAttribute('data-app-nav-id');
    if (event.key === into && this._flyouts.has(String(id))) {
      event.preventDefault();
      this.openFlyout(String(id), { focus: true });
      return;
    }
    let nextIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = controls.length - 1;
    else if (event.key === previous) nextIndex = (index - 1 + controls.length) % controls.length;
    else if (event.key === next) nextIndex = (index + 1) % controls.length;
    else return;
    event.preventDefault();
    controls[nextIndex]?.focus();
  }

  /** @param {KeyboardEvent} event @param {RailFlyout} flyout @returns {void} */
  _onFlyoutKeydown(event, flyout) {
    const controls = actions(flyout.panel);
    const current = /** @type {Element|null} */ (event.target)?.closest?.('a, button');
    const index = controls.indexOf(current);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      const nested = [...this._flyouts.values()].find((candidate) =>
        candidate.trigger === current && candidate.dropdown.isOpen());
      if (nested) {
        this.closeFlyout(nested.key);
        this._restoreFocus(nested.trigger);
        return;
      }
      this.closeFlyout(flyout.key);
      this._restoreFocus(flyout.trigger);
      return;
    }
    const nested = [...this._flyouts.values()].find((candidate) => candidate.trigger === current);
    const into = this.el.dataset.side === 'right' ? 'ArrowLeft' : 'ArrowRight';
    const out = into === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight';
    if (nested && event.key === into) {
      event.preventDefault();
      event.stopPropagation();
      this.openFlyout(nested.key, { focus: true });
      return;
    }
    if (flyout.parentKey !== null && event.key === out) {
      event.preventDefault();
      event.stopPropagation();
      this.closeFlyout(flyout.key);
      this._restoreFocus(flyout.trigger);
      return;
    }
    if (controls.length === 0) return;
    let nextIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = controls.length - 1;
    else if (event.key === 'ArrowDown') nextIndex = (index + 1 + controls.length) % controls.length;
    else if (event.key === 'ArrowUp') nextIndex = (index - 1 + controls.length) % controls.length;
    else return;
    event.preventDefault();
    controls[nextIndex]?.focus();
  }

  /** @param {string|number} id @returns {void} */
  _scheduleOpen(id) {
    const key = String(id);
    this._cancelTimer(this._closeTimers, key);
    this._cancelTimer(this._openTimers, key);
    const delay = Math.max(0, Number(this.options.openDelay) || 0);
    this._openTimers.set(key, setTimeout(() => {
      this._openTimers.delete(key);
      this.openFlyout(id);
    }, delay));
  }

  /** @param {string|number} id @returns {void} */
  _scheduleClose(id) {
    const key = String(id);
    this._cancelTimer(this._openTimers, key);
    this._cancelTimer(this._closeTimers, key);
    const delay = Math.max(0, Number(this.options.closeDelay) || 0);
    this._closeTimers.set(key, setTimeout(() => {
      this._closeTimers.delete(key);
      const flyout = this._flyouts.get(key);
      if (!flyout) return;
      if (this._branchInteracting(flyout)) return;
      this.closeFlyout(key);
    }, delay));
  }

  /** Schedules a flyout and, when leaving a detached panel, each owning flyout for re-evaluation. @param {RailFlyout} flyout @param {boolean} ancestors @returns {void} */
  _scheduleFlyoutClose(flyout, ancestors) {
    let current = flyout;
    while (current) {
      this._scheduleClose(current.key);
      if (!ancestors || current.parentKey === null) break;
      current = this._flyouts.get(current.parentKey) ?? null;
    }
  }

  /** Resolves a public id or internal descendant path. @param {string|number} id @returns {RailFlyout|null} */
  _resolveFlyout(id) {
    const key = String(id);
    return this._flyouts.get(key)
      ?? [...this._flyouts.values()].find((flyout) => String(flyout.item.id) === key)
      ?? null;
  }

  /** Closes the root flyout that owns a selected descendant. @param {string} key @returns {void} */
  _closeFlyoutChain(key) {
    let flyout = this._flyouts.get(key) ?? null;
    while (flyout?.parentKey !== null) flyout = this._flyouts.get(flyout.parentKey) ?? null;
    if (flyout) this.closeFlyout(flyout.key);
  }

  /** Reports whether one flyout owns another through its parent chain. @param {RailFlyout} ancestor @param {RailFlyout} descendant @returns {boolean} */
  _isAncestor(ancestor, descendant) {
    let parentKey = descendant.parentKey;
    while (parentKey !== null) {
      if (parentKey === ancestor.key) return true;
      parentKey = this._flyouts.get(parentKey)?.parentKey ?? null;
    }
    return false;
  }

  /** Cancels crossing timers for a flyout and optionally every owning flyout. @param {RailFlyout} flyout @param {boolean} ancestors @returns {void} */
  _cancelFlyoutTimers(flyout, ancestors) {
    let current = flyout;
    while (current) {
      this._cancelTimers(current.key);
      if (!ancestors || current.parentKey === null) break;
      current = this._flyouts.get(current.parentKey) ?? null;
    }
  }

  /** Reports pointer/focus presence in a flyout branch, including detached descendant panels. @param {RailFlyout} flyout @returns {boolean} */
  _branchInteracting(flyout) {
    if (flyout.trigger.matches(':hover') || flyout.panel.matches(':hover')
      || flyout.trigger === document.activeElement || flyout.panel.contains(document.activeElement)) return true;
    return [...this._flyouts.values()].some((candidate) => this._isAncestor(flyout, candidate)
      && candidate.dropdown.isOpen()
      && (candidate.trigger.matches(':hover') || candidate.panel.matches(':hover')
        || candidate.trigger === document.activeElement || candidate.panel.contains(document.activeElement)));
  }

  /** Restores trigger focus without immediately reopening the flyout through its focus handler. @param {HTMLElement} trigger @returns {void} */
  _restoreFocus(trigger) {
    this._pointerFocus.add(trigger);
    trigger.focus();
    queueMicrotask(() => this._pointerFocus.delete(trigger));
  }

  /** @param {string} key @returns {void} */
  _cancelTimers(key) {
    this._cancelTimer(this._openTimers, key);
    this._cancelTimer(this._closeTimers, key);
  }

  /** @param {Map<string, ReturnType<typeof setTimeout>>} timers @param {string} key @returns {void} */
  _cancelTimer(timers, key) {
    const timer = timers.get(key);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(key);
  }

  /** @returns {void} */
  _syncActive() {
    const activeId = this._active == null ? null : String(this._active);
    for (const control of this.refs.list.querySelectorAll('[data-app-nav-id]')) {
      const direct = activeId !== null && control.getAttribute('data-app-nav-value-id') === activeId;
      const flyout = this._flyouts.get(String(control.getAttribute('data-app-nav-id')));
      const descendant = activeId !== null && flyout
        ? containsItemId(flyout.item.children ?? [], activeId) : false;
      if (direct) control.setAttribute('aria-current', 'page');
      else control.removeAttribute('aria-current');
      if (descendant) control.dataset.activeDescendant = 'true';
      else delete control.dataset.activeDescendant;
    }
    for (const flyout of this._flyouts.values()) {
      const descendant = activeId !== null && containsItemId(flyout.item.children ?? [], activeId);
      if (descendant) flyout.trigger.dataset.activeDescendant = 'true';
      else delete flyout.trigger.dataset.activeDescendant;
      for (const control of flyout.panel.querySelectorAll('[data-app-nav-value-id]')) {
        if (activeId !== null && control.getAttribute('data-app-nav-value-id') === activeId) {
          control.setAttribute('aria-current', 'page');
        } else control.removeAttribute('aria-current');
      }
    }
  }

  /** @returns {void} */
  _clearArtifacts() {
    for (const timer of this._openTimers ? this._openTimers.values() : []) clearTimeout(timer);
    for (const timer of this._closeTimers ? this._closeTimers.values() : []) clearTimeout(timer);
    this._openTimers?.clear?.();
    this._closeTimers?.clear?.();
    this._interaction?.destroy?.();
    for (const tooltip of this._tooltips ?? []) tooltip.destroy();
    this._silenceFlyoutEvents = true;
    for (const flyout of this._flyouts?.values?.() ?? []) flyout.dropdown.destroy();
    this._silenceFlyoutEvents = false;
    this._tooltips = [];
    this._tooltipById = new Map();
    this._interaction = null;
    this._flyouts = new Map();
  }
}

/** Owns listeners attached to one dynamic rail render so `setItems()` can release them immediately. */
class RailListenerScope extends Component {
  /** @param {HTMLElement} host Rail host. */
  constructor(host) {
    super(null);
    host.append(this.el);
  }

  /** @returns {HTMLElement} */
  render() {
    return h('span', { hidden: true, 'data-zx-app-rail-listener-scope': '' });
  }
}

/**
 * Normalizes an application navigation tree without mutating caller data.
 * @param {unknown} items Candidate tree.
 * @returns {AppNavItem[]}
 */
export function normalizeAppItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item && typeof item === 'object' && item.id != null && item.label != null)
    .map((item) => {
      const normalized = {
        ...item,
        label: String(item.label),
        children: Array.isArray(item.children) ? normalizeAppItems(item.children) : []
      };
      if (item.href == null) return normalized;
      const href = safeHref(item.href);
      if (href !== null) normalized.href = href;
      else {
        delete normalized.href;
        if (normalized.children.length === 0 && typeof normalized.invoke !== 'function') {
          normalized.disabled = true;
        }
      }
      return normalized;
    });
}

/**
 * Resolves a host-rendered or item-owned navigation icon without moving a mounted source node.
 * @param {AppNavItem} item Navigation item.
 * @param {unknown} renderer Optional component-level renderer.
 * @param {Record<string, any>} context Presentation context.
 * @returns {Node|null}
 */
export function appNavIcon(item, renderer, context) {
  let visual = typeof renderer === 'function' ? renderer(item, context) : null;
  if (visual == null) visual = item.icon;
  if (typeof visual === 'function') visual = visual(context, item);
  if (typeof visual === 'string') return icon(visual);
  if (visual instanceof Node) return visual.cloneNode(true);
  if (visual && typeof visual === 'object'
    && typeof (/** @type {any} */ (visual)).toElement === 'function') {
    const element = (/** @type {any} */ (visual)).toElement();
    return element instanceof Node ? element.cloneNode(true) : null;
  }
  return null;
}

/** @param {AppNavItem} item @param {{className: string, index: string, iconOnly: boolean, disclosure: boolean, disclosureIcon: string, visual: Node|null}} options @returns {HTMLElement} */
function navControl(item, { className, index, iconOnly, disclosure, disclosureIcon, visual }) {
  const href = safeHref(item.href);
  const tag = href && !disclosure ? 'a' : 'button';
  return /** @type {HTMLElement} */ (h(tag, {
    class: className,
    type: tag === 'button' ? 'button' : null,
    href: tag === 'a' ? href : null,
    target: tag === 'a' ? item.target ?? null : null,
    rel: tag === 'a' ? 'noopener' : null,
    ariaLabel: iconOnly ? item.label : null,
    ariaDisabled: item.disabled ? 'true' : null,
    dataset: { appNavId: index, appNavValueId: String(item.id) }
  },
  visual ? h('span', { class: `${className}-icon`, ariaHidden: 'true' }, visual) : null,
  h('span', { class: `${className}-label` }, item.label),
  item.badge != null ? h('span', { class: `${className}-badge` }, String(item.badge)) : null,
  disclosure ? h('span', { class: `${className}-disclosure`, ariaHidden: 'true' }, icon(disclosureIcon)) : null));
}

/** @param {string} side @returns {string} */
function railDisclosureIcon(side) {
  return { left: 'chevron-right', right: 'chevron-left', top: 'chevron-down', bottom: 'chevron-up' }[side]
    ?? 'chevron-right';
}

/** @param {string} side @returns {string} */
function nestedDisclosureIcon(side) {
  return side === 'right' ? 'chevron-left' : 'chevron-right';
}

/** @param {string} side @returns {'right-start'|'left-start'|'bottom-start'|'top-start'} */
function flyoutPlacement(side) {
  return /** @type {any} */ ({ left: 'right-start', right: 'left-start', top: 'bottom-start', bottom: 'top-start' }[side]
    ?? 'right-start');
}

/** @param {string} side @returns {'right-start'|'left-start'} */
function nestedFlyoutPlacement(side) {
  return side === 'right' ? 'left-start' : 'right-start';
}

/** @param {string} side @returns {'right'|'left'|'bottom'|'top'} */
function tooltipPlacement(side) {
  return /** @type {any} */ ({ left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[side] ?? 'right');
}

/** @param {Element} root @returns {HTMLElement[]} */
function actions(root) {
  return /** @type {HTMLElement[]} */ ([...root.querySelectorAll('a:not([aria-disabled="true"]), button:not([aria-disabled="true"])')]);
}

/** @param {Element} root @returns {HTMLElement|null} */
function firstAction(root) {
  return actions(root)[0] ?? null;
}

/** @param {Element} list @returns {HTMLElement[]} */
function topLevelControls(list) {
  return /** @type {HTMLElement[]} */ ([...list.children].map((row) => row.querySelector('[data-app-nav-id]')).filter(Boolean));
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

/** Fired when a destination/action is activated. @event AppRailPresenter#select @type {CustomEvent<AppNavSelectDetail>} */
/** Fired when a flyout opens or closes. @event AppRailPresenter#flyoutchange @type {CustomEvent<{item: AppNavItem, id: string|number, open: boolean}>} */
