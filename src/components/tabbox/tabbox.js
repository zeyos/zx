import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { uid } from '../../core/util.js';

/** @typedef {Node|Component|(() => Node|Component)} TabContent */

/**
 * @typedef {Object} TabDefinition
 * @property {string} name Stable tab name.
 * @property {string} title Visible tab label.
 * @property {TabContent} content Panel content or a lazy content factory.
 * @property {string} [icon] Icon name passed to `icon()`, shown before the title.
 * @property {boolean} [closable=false] Whether the tab shows a close control and Delete closes it.
 * @property {boolean} [disabled=false] Whether the tab is unavailable.
 */

/** @typedef {'divided'|'bracket'|'line'|'segmented'} TabboxVariant */

/**
 * Tab row appearances. All four are square-cornered; the boxed ones read the
 * `--zx-tabbox-radius` custom property if an application wants rounding back.
 */
const VARIANTS = new Set(['divided', 'bracket', 'line', 'segmented']);

/**
 * @typedef {Object} TabInsertOptions
 * @property {number} [index] Zero-based insertion index; omitted appends.
 */

/**
 * @typedef {Object} TabboxOptions
 * @property {TabDefinition[]} [tabs=[]] Initial tabs.
 * @property {string|null} [active=null] Initially active tab name, or the first enabled tab.
 * @property {TabboxVariant} [variant='divided'] `divided` sets flat blocks on a muted track above
 *   a bordered panel; `bracket` outlines folder tabs that fuse into that panel; `line` underlines
 *   the active tab across a full-width rule; `segmented` renders a compact group that reads as one
 *   control, for a toolbar or card header.
 * @property {boolean} [keepAlive=true] Keep inactive panel elements mounted.
 * @property {(event: CustomEvent<{name: string, previous: string|null}>) => void} [onchange] Change callback.
 * @property {(event: CustomEvent<{name: string}>) => void} [onclose] Close callback, fired when the
 *   user dismisses a closable tab.
 */

/**
 * @typedef {Object} TabRecord
 * @property {TabDefinition} definition Normalized definition.
 * @property {HTMLButtonElement} tab Tab element.
 * @property {HTMLElement} title Title element.
 * @property {HTMLElement} badge Badge element.
 * @property {HTMLElement} panel Tab panel.
 * @property {boolean} built Whether content has been mounted.
 */

/**
 * APG tabs with roving focus and manual activation.
 * @fires Tabbox#change
 * @fires Tabbox#close
 * @extends {Component<TabboxOptions>}
 */
export class Tabbox extends Component {
  static cssName = 'tabbox';

  /** @type {Readonly<TabboxOptions>} */
  static defaults = {
    tabs: [],
    active: null,
    variant: 'divided',
    keepAlive: true
  };

  /**
   * Creates or enhances a tabbox.
   * @param {Element|string|null} target Existing container, selector, or null.
   * @param {TabboxOptions} [options={}] Tabbox options.
   */
  constructor(target, options = {}) {
    super(target, options);
  }

  /** @returns {HTMLElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('section'));
    this.el = root;
    this._createdRoot = created;
    this._original = created ? null : snapshot(root);
    this._cleaned = false;
    /** @type {TabRecord[]} */
    this._tabs = [];
    /** @type {TabRecord|null} */
    this._active = null;
    this._keepAlive = Boolean(this.options.keepAlive);
    this._initializing = true;
    if (!VARIANTS.has(this.options.variant)) {
      throw new RangeError(`Unknown tabbox variant: ${this.options.variant}`);
    }
    root.dataset.variant = this.options.variant;

    const tablist = h('div', {
      class: 'zx-tabbox__tablist',
      ref: 'tablist',
      role: 'tablist',
      ariaOrientation: 'horizontal'
    });
    const panels = h('div', {
      class: 'zx-tabbox__panels',
      ref: 'panels'
    });
    root.replaceChildren(tablist, panels);

    if (!Array.isArray(this.options.tabs)) throw new TypeError('Tabbox tabs must be an array');
    for (const definition of this.options.tabs) this.addTab(definition);
    this._initializing = false;

    const requested = this.options.active === null ? null : this._find(this.options.active);
    const initial = requested && !requested.definition.disabled ? requested : this._enabledTabs()[0];
    if (initial) this._applyActive(initial);

    this.listen(tablist, 'click', (event) => {
      const tab = event.target.closest?.('[role="tab"]');
      if (!tab || !tablist.contains(tab)) return;
      const record = this._recordForTab(tab);
      if (!record || record.definition.disabled) return;
      if (event.target.closest?.('.zx-tabbox__close')) {
        this._closeTab(record);
        return;
      }
      this._setFocused(record);
      this.openTab(record.definition.name);
    });
    this.listen(tablist, 'keydown', (event) => this._onKeydown(event));
    return root;
  }

  /**
   * Adds a tab.
   * @param {TabDefinition} definition Tab definition.
   * @param {TabInsertOptions} [insert={}] Insertion options.
   * @returns {this}
   */
  addTab(definition, insert = {}) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw new TypeError('Tab definition must be an object');
    }
    if (typeof definition.name !== 'string' || definition.name === '') {
      throw new TypeError('Tab name must be a non-empty string');
    }
    if (this._find(definition.name)) throw new RangeError(`Tab already exists: ${definition.name}`);
    if (!isTabContent(definition.content)) {
      throw new TypeError('Tab content must be a Node, Component, or function');
    }

    const normalized = {
      name: definition.name,
      title: String(definition.title ?? ''),
      content: definition.content,
      icon: definition.icon ? String(definition.icon) : null,
      closable: Boolean(definition.closable),
      disabled: Boolean(definition.disabled)
    };
    const tabId = uid('zx-tab');
    const panelId = uid('zx-tabpanel');
    const title = h('span', { class: 'zx-tabbox__title' }, normalized.title);
    const badge = h('span', {
      class: 'zx-tabbox__badge',
      hidden: true
    });
    const children = [];
    if (normalized.icon) {
      children.push(h('span', { class: 'zx-tabbox__icon', ariaHidden: 'true' },
        icon(normalized.icon, { size: 16 })));
    }
    children.push(title, badge);
    if (normalized.closable) {
      // Deliberately a span and not a nested <button>: the tab itself is a button, and buttons
      // cannot nest. The tablist click handler routes clicks that land in here to _closeTab(),
      // and it stays out of the accessibility tree because Delete is the keyboard equivalent.
      children.push(h('span', {
        class: 'zx-tabbox__close zx-icon-btn',
        ariaHidden: 'true',
        title: 'Close'
      }, icon('x', { size: 14 })));
    }
    const tab = /** @type {HTMLButtonElement} */ (h('button', {
      class: 'zx-tabbox__tab',
      type: 'button',
      id: tabId,
      role: 'tab',
      tabindex: '-1',
      ariaControls: panelId,
      ariaSelected: 'false',
      ariaDisabled: normalized.disabled ? 'true' : null,
      dataset: { closable: normalized.closable ? 'true' : null }
    }, children));
    const panel = h('div', {
      class: 'zx-tabbox__panel',
      id: panelId,
      role: 'tabpanel',
      tabindex: '0',
      ariaLabelledby: tabId,
      hidden: true
    });
    /** @type {TabRecord} */
    const record = { definition: normalized, tab, title, badge, panel, built: false };
    const numericIndex = Number.isFinite(insert.index) ? Math.trunc(insert.index) : this._tabs.length;
    const index = Math.max(0, Math.min(this._tabs.length, numericIndex));
    const before = this._tabs[index] ?? null;
    this._tabs.splice(index, 0, record);
    this.refs.tablist.insertBefore(tab, before?.tab ?? null);
    if (this._keepAlive) this.refs.panels.insertBefore(panel, before?.panel ?? null);

    if (!this._initializing && !this._active && !normalized.disabled) this._applyActive(record);
    return this;
  }

  /**
   * Removes a tab by name.
   * @param {string} name Tab name.
   * @returns {this}
   */
  removeTab(name) {
    this._removeTab(name, false);
    return this;
  }

  /**
   * Activates an enabled tab unless its change event is vetoed.
   * @param {string} name Tab name.
   * @returns {this}
   * @fires Tabbox#change
   */
  openTab(name) {
    const record = this._find(name);
    if (!record || record.definition.disabled || record === this._active) return this;
    const previous = this._active?.definition.name ?? null;
    const event = this.emit('change', { name: record.definition.name, previous });
    if (event.defaultPrevented) return this;
    this._applyActive(record);
    return this;
  }

  /**
   * Alias of `openTab()`.
   * @param {string} name Tab name.
   * @returns {this}
   * @fires Tabbox#change
   */
  show(name) {
    return this.openTab(name);
  }

  /**
   * Returns the active tab name.
   * @returns {string|null}
   */
  getActive() {
    return this._active?.definition.name ?? null;
  }

  /**
   * Changes a tab title.
   * @param {string} name Tab name.
   * @param {string} title Next title.
   * @returns {this}
   */
  setTitle(name, title) {
    const record = this._require(name);
    record.definition.title = String(title ?? '');
    record.title.textContent = record.definition.title;
    return this;
  }

  /**
   * Sets or clears a tab badge.
   * @param {string} name Tab name.
   * @param {string|null} text Badge text, or null to remove it.
   * @returns {this}
   */
  setBadge(name, text) {
    const record = this._require(name);
    record.badge.textContent = text === null ? '' : String(text);
    record.badge.hidden = text === null;
    return this;
  }

  /**
   * Enables a tab.
   * @param {string} name Tab name.
   * @returns {this}
   */
  enableTab(name) {
    const record = this._require(name);
    if (!record.definition.disabled) return this;
    record.definition.disabled = false;
    record.tab.removeAttribute('aria-disabled');
    if (!this._active) this._applyActive(record);
    return this;
  }

  /**
   * Disables a tab, moving selection when it is active.
   * @param {string} name Tab name.
   * @returns {this}
   * @fires Tabbox#change
   */
  disableTab(name) {
    const record = this._require(name);
    if (record.definition.disabled) return this;
    if (record === this._active) {
      const replacement = this._enabledTabs().find((item) => item !== record) ?? null;
      if (replacement) {
        this.openTab(replacement.definition.name);
        if (this._active === record) return this;
      } else {
        record.tab.setAttribute('aria-selected', 'false');
        record.tab.tabIndex = -1;
        record.panel.hidden = true;
        if (!this._keepAlive) record.panel.remove();
        this._active = null;
      }
    }
    record.definition.disabled = true;
    record.tab.setAttribute('aria-disabled', 'true');
    record.tab.tabIndex = -1;
    return this;
  }

  /** @returns {void} */
  destroy() {
    if (this._cleaned) return;
    this._cleaned = true;
    super.destroy();
    if (!this._createdRoot && this._original) restore(this.el, this._original);
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onKeydown(event) {
    const tab = event.target.closest?.('[role="tab"]');
    if (!tab || !this.refs.tablist.contains(tab)) return;
    const current = this._recordForTab(tab);
    if (!current) return;
    const enabled = this._enabledTabs();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const offset = event.key === 'ArrowRight' ? 1 : -1;
      const index = enabled.indexOf(current);
      const next = enabled[(index + offset + enabled.length) % enabled.length];
      if (next) this._setFocused(next);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = event.key === 'Home' ? enabled[0] : enabled[enabled.length - 1];
      if (next) this._setFocused(next);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openTab(current.definition.name);
      return;
    }
    if (event.key === 'Delete' && current.definition.closable) {
      event.preventDefault();
      this._closeTab(current);
    }
  }

  /**
   * Closes a tab on a user gesture, keeping roving focus inside the tablist.
   * @param {TabRecord} record Tab to close.
   * @returns {void}
   * @fires Tabbox#close
   */
  _closeTab(record) {
    const index = this._tabs.indexOf(record);
    // Clicking the close control focuses its tab first in most browsers, so the element about to
    // be removed holds the focus; left alone, focus would fall back to <body>.
    const held = record.tab.contains(document.activeElement);
    if (!this._removeTab(record.definition.name, true)) return;
    const remaining = this._tabs[Math.min(index, this._tabs.length - 1)] ?? this._tabs[index - 1];
    const focusTarget = remaining && !remaining.definition.disabled ? remaining : this._active;
    // Roving tabindex has to move even for a mouse close, or Tab has no entry point left.
    if (focusTarget) this._setFocused(focusTarget, held);
  }

  /** @param {string} name @param {boolean} emitClose @returns {boolean} */
  _removeTab(name, emitClose) {
    const record = this._find(name);
    if (!record) return false;
    const index = this._tabs.indexOf(record);
    const remaining = this._tabs.filter((item) => item !== record);
    const enabled = remaining.filter((item) => !item.definition.disabled);
    const replacement = enabled.find((item) => this._tabs.indexOf(item) > index) ?? enabled.at(-1) ?? null;
    if (record === this._active && replacement) {
      const event = this.emit('change', {
        name: replacement.definition.name,
        previous: record.definition.name
      });
      if (event.defaultPrevented) return false;
    }

    this._tabs.splice(index, 1);
    record.tab.remove();
    record.panel.remove();
    if (record === this._active) {
      this._active = null;
      if (replacement) this._applyActive(replacement);
    }
    if (emitClose) this.emit('close', { name: record.definition.name });
    return true;
  }

  /** @param {TabRecord} record @returns {void} */
  _applyActive(record) {
    this._ensureContent(record);
    const previous = this._active;
    if (previous && previous !== record) {
      previous.tab.setAttribute('aria-selected', 'false');
      previous.panel.hidden = true;
      if (!this._keepAlive) previous.panel.remove();
    }
    this._active = record;
    record.tab.setAttribute('aria-selected', 'true');
    record.panel.hidden = false;
    if (record.panel.parentNode !== this.refs.panels) this.refs.panels.append(record.panel);
    this._setFocused(record, false);
  }

  /** @param {TabRecord} record @returns {void} */
  _ensureContent(record) {
    if (record.built) return;
    const content = typeof record.definition.content === 'function' ?
      record.definition.content() : record.definition.content;
    const node = content instanceof Component ? content.toElement() : content;
    if (!node || typeof node.nodeType !== 'number') {
      throw new TypeError(`Tab content factory for ${record.definition.name} must return a Node or Component`);
    }
    record.panel.append(node);
    record.built = true;
  }

  /** @param {TabRecord} record @param {boolean} [focus=true] @returns {void} */
  _setFocused(record, focus = true) {
    for (const item of this._tabs) item.tab.tabIndex = item === record ? 0 : -1;
    if (focus) record.tab.focus();
  }

  /** @returns {TabRecord[]} */
  _enabledTabs() {
    return this._tabs.filter((record) => !record.definition.disabled);
  }

  /** @param {string} name @returns {TabRecord|null} */
  _find(name) {
    return this._tabs.find((record) => record.definition.name === name) ?? null;
  }

  /** @param {string} name @returns {TabRecord} */
  _require(name) {
    const record = this._find(name);
    if (!record) throw new RangeError(`Unknown tab: ${name}`);
    return record;
  }

  /** @param {Element} tab @returns {TabRecord|null} */
  _recordForTab(tab) {
    return this._tabs.find((record) => record.tab === tab) ?? null;
  }
}

/**
 * Fired before the active tab changes. Calling `preventDefault()` vetoes the switch.
 * @event Tabbox#change
 * @type {CustomEvent<{name: string, previous: string|null}>}
 */

/**
 * Fired after the user removes a closable tab, through its close control or Delete.
 * `removeTab()` is silent.
 * @event Tabbox#close
 * @type {CustomEvent<{name: string}>}
 */

/** @param {unknown} content @returns {content is TabContent} */
function isTabContent(content) {
  if (typeof content === 'function' || content instanceof Component) return true;
  return Boolean(content && typeof content === 'object' && typeof content.nodeType === 'number');
}

/** @param {Element} element @returns {{attributes: Array<[string, string]>, children: Node[]}} */
function snapshot(element) {
  return {
    attributes: Array.from(element.attributes, (attribute) => [attribute.name, attribute.value]),
    children: Array.from(element.childNodes)
  };
}

/**
 * @param {Element} element
 * @param {{attributes: Array<[string, string]>, children: Node[]}} original
 * @returns {void}
 */
function restore(element, original) {
  for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);
  for (const [name, value] of original.attributes) element.setAttribute(name, value);
  element.replaceChildren(...original.children);
}
