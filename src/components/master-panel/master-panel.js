import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { isElement } from '../../core/util.js';
import { button } from '../button/button.js';

/** @typedef {string|Node|Component|null} MasterPanelContent */
/**
 * @typedef {Object} MasterPanelButtonDescriptor
 * @property {string} [label=''] Visible button label.
 * @property {string|null} [icon=null] Icon name from the kernel icon set.
 * @property {'default'|'primary'|'danger'|'ghost'} [kind='default'] Visual intent.
 * @property {'md'|'sm'} [size='md'] Control size.
 * @property {boolean} [disabled=false] Whether the button is disabled.
 * @property {string} [title] Native title text.
 * @property {(event: MouseEvent) => void} [onclick] Click callback.
 */
/** @typedef {Element|MasterPanelButtonDescriptor} MasterPanelButton */

const MODULE_NAMES = Object.freeze([
  'default', 'settings', 'accounts', 'billing', 'calendar', 'campaigns', 'clocking',
  'collection', 'contacts', 'contracts', 'enhancements', 'inventory', 'links',
  'mailinglists', 'messages', 'notes', 'opportunities', 'pricelists', 'procurement',
  'projects', 'tasks', 'tickets', 'pwd', 'system', 'usermgmt', 'usersettings', 'users', 'groups'
]);

/**
 * @typedef {Object} MasterPanelOptions
 * @property {string} [title=''] Header title.
 * @property {MasterPanelContent} [content=null] Scrollable body content.
 * @property {MasterPanelButton[]} [buttons=[]] Header action elements or button descriptors.
 * @property {string|null} [module=null] ZeyOS module name used for the header accent.
 * @property {MasterPanelContent} [footer=null] Optional fixed footer content.
 */

/**
 * Full-height page panel with fixed header and footer bars.
 * @extends {Component<MasterPanelOptions>}
 */
export class MasterPanel extends Component {
  static cssName = 'master-panel';

  /** @type {Readonly<MasterPanelOptions>} */
  static defaults = {
    title: '',
    content: null,
    buttons: [],
    module: null,
    footer: null
  };

  /**
   * Creates or enhances a page-level panel.
   * @param {Element|string|null} target Existing container, selector, or null.
   * @param {MasterPanelOptions} [options={}] Master-panel options.
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
    this._snapshot = created ? null : snapshotTarget(root);
    this._cleaned = false;
    /** @type {WeakMap<Element, (event: MouseEvent) => void>} Click callbacks of descriptor buttons. */
    this._clicks = new WeakMap();

    const originalContent = created ? [] : Array.from(root.childNodes);
    const header = h('header', { class: 'zx-master-panel__header' },
      h('h1', { class: 'zx-master-panel__title', ref: 'title' }),
      h('div', {
        class: 'zx-master-panel__buttons',
        ref: 'buttons',
        role: 'group',
        ariaLabel: this.msg('panel.actions')
      })
    );
    const content = h('div', {
      class: 'zx-master-panel__content',
      ref: 'content'
    });
    const footer = h('footer', {
      class: 'zx-master-panel__footer',
      ref: 'footer',
      hidden: true
    });
    root.replaceChildren(header, content, footer);
    // One listener for every descriptor button, present and future: buttons that setButtons()
    // replaces take their callbacks with them instead of piling up listeners until destroy().
    this.listen(this.refs.buttons, 'click', (event) => this._onButtonClick(/** @type {MouseEvent} */ (event)));

    const moduleName = normalizeModule(this.options.module);
    root.dataset.module = moduleName;
    this.setTitle(this.options.title);
    if (this.options.content !== null) this.setContent(this.options.content);
    else content.append(...originalContent);
    this.setButtons(this.options.buttons);
    this.setFooter(this.options.footer);
    return root;
  }

  /**
   * Replaces the header title.
   * @param {string} title Next title.
   * @returns {this}
   */
  setTitle(title) {
    this.refs.title.textContent = String(title ?? '');
    return this;
  }

  /**
   * Replaces the scrollable body.
   * @param {MasterPanelContent} content Next text, node, component, or null to clear.
   * @returns {this}
   */
  setContent(content) {
    replaceContent(this.refs.content, content, 'MasterPanel content');
    return this;
  }

  /**
   * Replaces the header action area.
   * @param {MasterPanelButton[]} list Button descriptors or elements.
   * @returns {this}
   */
  setButtons(list) {
    if (!Array.isArray(list)) throw new TypeError('MasterPanel buttons must be an array');
    const elements = list.map((item) => {
      if (isElement(item)) return item;
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new TypeError('MasterPanel buttons must be Elements or button descriptors');
      }
      const descriptor = { ...item };
      const onclick = descriptor.onclick;
      delete descriptor.onclick;
      const element = button(descriptor);
      if (typeof onclick === 'function') this._clicks.set(element, onclick);
      return element;
    });
    this.refs.buttons.replaceChildren(...elements);
    return this;
  }

  /**
   * Replaces or removes the fixed footer.
   * @param {MasterPanelContent} content Next footer content, or null to remove it.
   * @returns {this}
   */
  setFooter(content) {
    replaceContent(this.refs.footer, content, 'MasterPanel footer');
    this.refs.footer.hidden = content === null;
    return this;
  }

  /** @returns {void} */
  destroy() {
    if (this._cleaned) return;
    this._cleaned = true;
    super.destroy();
    if (!this._createdRoot) restoreTarget(this.el, this._snapshot);
  }

  /**
   * Runs the callback of the descriptor button a click landed in, with the button as `this`.
   * @param {MouseEvent} event Click inside the action area.
   * @returns {void}
   */
  _onButtonClick(event) {
    const area = this.refs.buttons;
    for (let node = /** @type {Element|null} */ (event.target); node && node !== area; node = node.parentElement) {
      const callback = this._clicks.get(node);
      if (callback) {
        callback.call(node, event);
        return;
      }
    }
  }
}

/** @param {Element} target @param {MasterPanelContent} content @param {string} label @returns {void} */
function replaceContent(target, content, label) {
  target.replaceChildren();
  if (content === null) return;
  if (typeof content === 'string') {
    target.append(document.createTextNode(content));
    return;
  }
  const node = content instanceof Component ? content.toElement() : content;
  if (node && typeof node.nodeType === 'number') {
    target.append(node);
    return;
  }
  throw new TypeError(`${label} must be a string, Node, Component, or null`);
}

/** @param {unknown} moduleName @returns {string} */
function normalizeModule(moduleName) {
  const normalized = String(moduleName ?? 'default').toLowerCase();
  return MODULE_NAMES.includes(normalized) ? normalized : 'default';
}
