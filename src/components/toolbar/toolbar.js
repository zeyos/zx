import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { rovingTabindex } from '../../core/keyboard.js';
import { isElement } from '../../core/util.js';
import { button } from '../button/button.js';
import { MenuButton } from '../menu-button/menu-button.js';

/** Control selectors that can become a roving-tabindex stop. */
const FOCUSABLE = ['button', 'a[href]', 'input', 'select', 'textarea', '[tabindex]'];

/**
 * Roving-tabindex stops: focusable direct children of the toolbar, plus the controls of a grouped
 * child one level down (`buttonGroup()` renders a `[role="group"]` wrapper). Separators carry no
 * tabindex and therefore never match, and the child combinators keep deeper structures — a popover
 * panel rendered inside a composite item, for instance — out of the group.
 */
const ITEM_SELECTOR = FOCUSABLE
  .flatMap((selector) => [`.zx-toolbar > ${selector}`, `.zx-toolbar > [role="group"] > ${selector}`])
  .join(',');

/**
 * @typedef {Object} ToolbarItemDescriptor
 * @property {string} [name] Identifier for `getItem()`, `enable()`, `disable()`, and `setActive()`.
 * @property {string} [label] Visible button label.
 * @property {string} [icon] Icon name from `icons.js`.
 * @property {'default'|'primary'|'danger'|'ghost'} [kind='default'] Button kind.
 * @property {'md'|'sm'} [size] Button size; defaults to `'sm'` in a dense toolbar.
 * @property {boolean} [disabled=false] Whether the control starts disabled.
 * @property {string} [title] Native title text.
 * @property {boolean} [active=false] Renders the button as a pressed toggle (`aria-pressed`).
 * @property {(event: MouseEvent) => void} [onclick] Click callback, called after the `action` event.
 */

/** @typedef {Element|ToolbarItemDescriptor|'-'} ToolbarItem */

/**
 * @typedef {{type: 'separator'}
 *   |{type: 'element', element: Element}
 *   |{type: 'descriptor', descriptor: ToolbarItemDescriptor}} ToolbarEntry
 */

/**
 * @typedef {Object} ToolbarOptions
 * @property {ToolbarItem[]} [items=[]] Controls, separators (`'-'`), and ready-made Elements.
 * @property {'start'|'end'|'between'} [align='start'] Horizontal distribution.
 * @property {string} [label='Toolbar'] Accessible name of the toolbar.
 * @property {boolean} [overflow=true] Collapses items that no longer fit into a trailing menu.
 * @property {string} [overflowLabel='More'] Accessible name of the overflow menu trigger.
 * @property {boolean} [dense=false] Tighter spacing and small controls.
 * @property {(event: CustomEvent<{name: string|null, item: Element}>) => void} [onaction] Action listener.
 */

/**
 * APG toolbar: one tab stop, arrow keys between controls, Home and End to the ends, and an
 * optional overflow menu that swallows the items that no longer fit.
 * @fires Toolbar#action
 * @extends {Component<ToolbarOptions>}
 */
export class Toolbar extends Component {
  static cssName = 'toolbar';

  /** @type {Readonly<ToolbarOptions>} */
  static defaults = {
    items: [],
    align: 'start',
    label: 'Toolbar',
    overflow: true,
    overflowLabel: 'More',
    dense: false
  };

  /** @type {ReturnType<typeof rovingTabindex>} */
  #roving;
  /** @type {MenuButton|null} */
  #overflow = null;
  /** @type {ResizeObserver|null} */
  #observer = null;
  /** Re-entrancy guard: the measure pass writes layout the observer watches. */
  #measuring = false;
  /** Inline size of the last completed measure pass; `-1` forces the next one. */
  #lastWidth = -1;
  /**
   * Block size of the last completed measure pass. Switching density resizes the controls without
   * changing the row width, so the height belongs in the cache key.
   */
  #lastHeight = -1;
  /** Handle of the frame a pending observer-driven measure pass is scheduled in; `0` if none. */
  #frame = 0;
  #destroyed = false;

  /**
   * Creates a toolbar, or turns an existing element into one.
   * @param {Element|string|null} [target=null] Existing container, selector, or null to create one.
   * @param {ToolbarOptions} [options={}] Toolbar options.
   */
  constructor(target = null, options = {}) {
    super(target, options);

    if (this.options.overflow) {
      this.#overflow = new MenuButton(null, {
        icon: 'dots',
        label: '',
        kind: 'ghost',
        placement: 'bottom-end'
      });
      const trigger = /** @type {HTMLButtonElement} */ (this.#overflow.toElement());
      trigger.classList.add('zx-toolbar__overflow');
      trigger.setAttribute('aria-label', String(this.options.overflowLabel));
      trigger.setAttribute('title', String(this.options.overflowLabel));
      if (this.options.dense) trigger.setAttribute('data-size', 'sm');
      trigger.hidden = true;
    }

    this.#roving = rovingTabindex(this.el, ITEM_SELECTOR, { orientation: 'horizontal' });
    this.listen(this.el, 'click', (event) => this.#onClick(/** @type {MouseEvent} */ (event)));
    this.setItems(this._initialItems);

    if (this.#overflow && typeof ResizeObserver === 'function') {
      this.#observer = new ResizeObserver(() => this.#scheduleMeasure());
      this.#observer.observe(this.el);
    }
  }

  /**
   * Prepares the toolbar root. Instance state is initialized here because `render()` runs inside
   * the base constructor, before any class-field initializer.
   * @returns {HTMLElement}
   */
  render() {
    /** @type {ToolbarRecord[]} */
    this._records = [];
    /** @type {Map<string, ToolbarRecord>} */
    this._named = new Map();
    this._createdRoot = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._snapshot = this._createdRoot ? null : snapshotTarget(root);
    // An empty item list adopts whatever the target already contains; anything else is validated
    // by normalizeItems() rather than silently ignored here.
    const items = this.options.items;
    this._initialItems = Array.isArray(items) && items.length === 0 ?
      Array.from(root.children) : items;

    root.setAttribute('role', 'toolbar');
    root.setAttribute('aria-label', String(this.options.label));
    root.dataset.align = normalizeAlign(this.options.align);
    root.dataset.overflow = this.options.overflow ? 'true' : 'false';
    if (this.options.dense) root.dataset.dense = 'true';
    return root;
  }

  /**
   * Replaces every item and remeasures the overflow.
   * @param {ToolbarItem[]} list Controls, separators, and Elements.
   * @returns {this}
   */
  setItems(list) {
    for (const record of this._records) {
      if (record.type === 'element') record.element.hidden = record.userHidden;
    }
    this._records = normalizeItems(list).map((entry) => this.#createRecord(entry));
    this._named = new Map();
    for (const record of this._records) {
      if (record.name !== null && !this._named.has(record.name)) this._named.set(record.name, record);
    }

    const children = this._records.map((record) => record.element);
    if (this.#overflow) {
      this.#overflow.setItems([]);
      const trigger = /** @type {HTMLElement} */ (this.#overflow.toElement());
      trigger.hidden = true;
      children.push(trigger);
    }
    this.el.replaceChildren(...children);
    this.#lastWidth = -1;
    this.#lastHeight = -1;
    this.#measure();
    return this;
  }

  /**
   * Looks up an item element by name.
   * @param {string} name Descriptor name, or the `data-name` of an Element item.
   * @returns {Element|null}
   */
  getItem(name) {
    return this._named.get(String(name))?.element ?? null;
  }

  /**
   * Enables an item.
   * @param {string} name Item name.
   * @returns {this}
   */
  enable(name) {
    return this.#setDisabled(name, false);
  }

  /**
   * Disables an item.
   * @param {string} name Item name.
   * @returns {this}
   */
  disable(name) {
    return this.#setDisabled(name, true);
  }

  /**
   * Sets the pressed state of a toggle item.
   * @param {string} name Item name.
   * @param {boolean} [active=true] Whether the item reads as pressed.
   * @returns {this}
   */
  setActive(name, active = true) {
    const record = this._named.get(String(name));
    if (record) record.element.setAttribute('aria-pressed', active ? 'true' : 'false');
    return this;
  }

  /**
   * Removes listeners, the resize observer, the overflow menu, and any DOM changes made to an
   * adopted target.
   * @returns {void}
   */
  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#observer?.disconnect();
    this.#observer = null;
    if (this.#frame !== 0) cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#roving.destroy();
    this.#overflow?.destroy();
    this.#overflow = null;
    for (const record of this._records) {
      if (record.type === 'element') record.element.hidden = record.userHidden;
    }
    super.destroy();
    if (!this._createdRoot) restoreTarget(this.el, this._snapshot);
  }

  /**
   * Builds the element and bookkeeping for one normalized entry.
   * @param {ToolbarEntry} entry Normalized entry.
   * @returns {ToolbarRecord}
   */
  #createRecord(entry) {
    if (entry.type === 'separator') {
      return {
        type: 'separator',
        element: h('span', {
          class: 'zx-toolbar__separator',
          role: 'separator',
          ariaOrientation: 'vertical',
          dataset: { separator: 'true' }
        }),
        name: null,
        label: '',
        icon: null,
        onclick: null,
        userHidden: false
      };
    }
    if (entry.type === 'element') {
      const element = entry.element;
      return {
        type: 'element',
        element,
        name: /** @type {HTMLElement} */ (element).dataset?.name ?? null,
        label: elementLabel(element),
        icon: null,
        onclick: null,
        userHidden: Boolean(/** @type {HTMLElement} */ (element).hidden)
      };
    }

    const { name = null, active, onclick, ...rest } = entry.descriptor;
    const element = button({ size: this.options.dense ? 'sm' : 'md', ...rest });
    if (active !== undefined) element.setAttribute('aria-pressed', active ? 'true' : 'false');
    if (name !== null) element.dataset.name = String(name);
    return {
      type: 'descriptor',
      element,
      name: name === null ? null : String(name),
      label: String(rest.label ?? rest.title ?? ''),
      icon: rest.icon ?? null,
      onclick: typeof onclick === 'function' ? onclick : null,
      userHidden: false
    };
  }

  /**
   * Emits `action` for descriptor-built items and runs their own callback.
   * @param {MouseEvent} event Click event.
   * @returns {void}
   * @fires Toolbar#action
   */
  #onClick(event) {
    const target = /** @type {Node|null} */ (event.target);
    if (!target) return;
    const record = this._records.find((item) =>
      item.type === 'descriptor' && item.element.contains(target));
    if (!record) return;
    this.emit('action', { name: record.name, item: record.element });
    record.onclick?.(event);
  }

  /**
   * Applies a disabled state to an item and mirrors it in the overflow menu.
   * @param {string} name Item name.
   * @param {boolean} disabled Next disabled state.
   * @returns {this}
   */
  #setDisabled(name, disabled) {
    const record = this._named.get(String(name));
    if (!record) return this;
    const element = /** @type {HTMLButtonElement} */ (record.element);
    if ('disabled' in element) element.disabled = disabled;
    else if (disabled) element.setAttribute('aria-disabled', 'true');
    else element.removeAttribute('aria-disabled');
    this.#syncOverflowItems();
    return this;
  }

  /**
   * Queues one measure pass for the next frame. Observer notifications arriving in the same frame
   * collapse into that single pass, so the writes the pass makes can never drive the observer in a
   * tight loop — the worst case is one pass per frame, and the size check in `#measure()` turns a
   * pass triggered by our own writes into a no-op.
   * @returns {void}
   */
  #scheduleMeasure() {
    if (this.#frame !== 0 || this.#destroyed) return;
    if (typeof requestAnimationFrame !== 'function') {
      this.#measure();
      return;
    }
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#measure();
    });
  }

  /**
   * Hides the items that no longer fit and mirrors them into the overflow menu.
   *
   * Every pass starts by showing all items again, so its outcome depends only on the available
   * width and the intrinsic item widths — never on what the previous pass hid. That makes the pass
   * idempotent; combined with the size check below and the frame coalescing in
   * `#scheduleMeasure()`, the writes this makes can never drive the `ResizeObserver` in a loop.
   * @returns {void}
   */
  #measure() {
    if (this.#measuring || this.#destroyed || !this.#overflow) return;
    const root = /** @type {HTMLElement} */ (this.el);
    if (typeof getComputedStyle !== 'function' || !root.isConnected) return;

    const styles = getComputedStyle(root);
    const gap = parseFloat(styles.columnGap) || 0;
    const padding = (parseFloat(styles.paddingInlineStart) || 0)
      + (parseFloat(styles.paddingInlineEnd) || 0);
    const available = root.clientWidth - padding;
    const height = root.clientHeight;
    if (!(available > 0) || (available === this.#lastWidth && height === this.#lastHeight)) return;

    this.#measuring = true;
    try {
      const trigger = /** @type {HTMLElement} */ (this.#overflow.toElement());
      const candidates = this._records.filter((record) => !record.userHidden);
      for (const record of candidates) record.element.hidden = false;
      trigger.hidden = false;

      const widths = candidates.map((record) => record.element.getBoundingClientRect().width);
      const total = widths.reduce((sum, width) => sum + width, 0)
        + gap * Math.max(0, widths.length - 1);
      const triggerWidth = trigger.getBoundingClientRect().width;

      /** @type {ToolbarRecord[]} */
      const hidden = [];
      if (total > available) {
        const budget = available - triggerWidth - gap;
        let used = 0;
        let collapsed = false;
        candidates.forEach((record, index) => {
          const next = used + widths[index] + (used > 0 ? gap : 0);
          if (!collapsed && next <= budget) {
            used = next;
            return;
          }
          collapsed = true;
          record.element.hidden = true;
          hidden.push(record);
        });
        while (candidates.length > hidden.length) {
          const last = candidates[candidates.length - hidden.length - 1];
          if (last.type !== 'separator') break;
          last.element.hidden = true;
          hidden.unshift(last);
        }
      }

      const menuItems = overflowMenuItems(hidden);
      this.#overflow.setItems(menuItems);
      trigger.hidden = menuItems.length === 0;
      this.#lastWidth = available;
      this.#lastHeight = root.clientHeight;
    } finally {
      this.#measuring = false;
    }
  }

  /**
   * Rebuilds the overflow menu from the items currently hidden.
   * @returns {void}
   */
  #syncOverflowItems() {
    if (!this.#overflow) return;
    const hidden = this._records.filter((record) =>
      !record.userHidden && /** @type {HTMLElement} */ (record.element).hidden);
    this.#overflow.setItems(overflowMenuItems(hidden));
  }
}

/**
 * Emitted when a descriptor-built item is activated, from the toolbar or from the overflow menu.
 * @event Toolbar#action
 * @type {CustomEvent<{name: string|null, item: Element}>}
 */

/**
 * @typedef {Object} ToolbarRecord
 * @property {'separator'|'element'|'descriptor'} type Entry kind.
 * @property {Element} element Rendered element.
 * @property {string|null} name Lookup name.
 * @property {string} label Label mirrored into the overflow menu.
 * @property {string|null} icon Icon name mirrored into the overflow menu.
 * @property {((event: MouseEvent) => void)|null} onclick Descriptor callback.
 * @property {boolean} userHidden Whether the caller handed the item over already hidden.
 */

/**
 * Normalizes a raw item list: drops nullish entries, classifies each item, and collapses leading,
 * trailing, and repeated separators. Pure — it touches no DOM.
 * @param {ToolbarItem[]} list Raw item list.
 * @returns {ToolbarEntry[]}
 */
export function normalizeItems(list) {
  if (list != null && !Array.isArray(list)) throw new TypeError('Toolbar items must be an array');
  /** @type {ToolbarEntry[]} */
  const entries = [];
  for (const item of list ?? []) {
    if (item == null) continue;
    if (item === '-') {
      if (entries.length > 0 && entries[entries.length - 1].type !== 'separator') {
        entries.push({ type: 'separator' });
      }
      continue;
    }
    if (isElement(item)) {
      entries.push({ type: 'element', element: /** @type {Element} */ (item) });
      continue;
    }
    if (typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError('Toolbar items must be Elements, item descriptors, or "-"');
    }
    entries.push({ type: 'descriptor', descriptor: { .../** @type {object} */ (item) } });
  }
  while (entries.length > 0 && entries[entries.length - 1].type === 'separator') entries.pop();
  return entries;
}

/**
 * Mirrors hidden toolbar items as menu-button items. Selecting one clicks the original control, so
 * a collapsed item behaves exactly like the visible one.
 * @param {ToolbarRecord[]} records Hidden records, in toolbar order.
 * @returns {Array<import('../menu-button/menu-button.js').MenuButtonItem>}
 */
function overflowMenuItems(records) {
  /** @type {Array<import('../menu-button/menu-button.js').MenuButtonItem>} */
  const items = [];
  for (const record of records) {
    if (record.type === 'separator') {
      if (items.length > 0 && items[items.length - 1] !== '-') items.push('-');
      continue;
    }
    const element = /** @type {HTMLButtonElement} */ (record.element);
    items.push({
      label: record.label || elementLabel(element) || '…',
      icon: record.icon ?? undefined,
      value: record.name,
      disabled: Boolean(element.disabled) || element.getAttribute('aria-disabled') === 'true',
      onselect: () => element.click()
    });
  }
  while (items.length > 0 && items[items.length - 1] === '-') items.pop();
  return items;
}

/** @param {Element} element @returns {string} */
function elementLabel(element) {
  return (element.getAttribute('aria-label')
    ?? element.getAttribute('title')
    ?? element.textContent
    ?? '').trim();
}

/** @param {unknown} value @returns {'start'|'end'|'between'} */
function normalizeAlign(value) {
  return ['end', 'between'].includes(/** @type {string} */ (value)) ?
    /** @type {'end'|'between'} */ (value) : 'start';
}
