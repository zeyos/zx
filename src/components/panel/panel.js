import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { isElement, uid } from '../../core/util.js';
import { button } from '../button/button.js';

/** @typedef {string|Node|Component|null} PanelContent */
/**
 * @typedef {Object} PanelButtonDescriptor
 * @property {string} [label=''] Visible button label.
 * @property {string|null} [icon=null] Icon name from the kernel icon set.
 * @property {'default'|'primary'|'danger'|'ghost'} [kind='default'] Visual intent.
 * @property {'md'|'sm'} [size='md'] Control size.
 * @property {boolean} [disabled=false] Whether the button is disabled.
 * @property {string} [title] Native title text.
 * @property {(event: MouseEvent) => void} [onclick] Click callback.
 */
/** @typedef {Element|PanelButtonDescriptor} PanelButton */

/**
 * @typedef {Object} PanelOptions
 * @property {string} [title=''] Section title.
 * @property {PanelContent} [content=null] Initial body content.
 * @property {boolean} [open=true] Initial expanded state.
 * @property {boolean} [collapsible=true] Whether the header toggles the body.
 * @property {PanelButton[]} [buttons=[]] Header actions, right-aligned next to the title.
 * @property {PanelContent} [footer=null] Optional footer content.
 * @property {PanelButton[]} [footerButtons=[]] Footer actions, right-aligned in the footer bar.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open callback.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onclose] Close callback.
 */

/**
 * Framed, optionally collapsible titled section.
 *
 * The header is a row rather than one big button: the title and chevron form the collapse control
 * and the action area sits beside it, because a button may not contain other buttons.
 * @fires Panel#open
 * @fires Panel#close
 */
export class Panel extends Component {
  static cssName = 'panel';

  /** @type {Readonly<PanelOptions>} */
  static defaults = {
    title: '',
    content: null,
    open: true,
    collapsible: true,
    buttons: [],
    footer: null,
    footerButtons: []
  };

  /**
   * Creates or enhances a panel.
   * @param {Element|string|null} target Existing container, selector, or null.
   * @param {PanelOptions} [options={}] Panel options.
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
    this._open = Boolean(this.options.open);
    this._collapsible = Boolean(this.options.collapsible);

    this._hasFooterContent = false;

    const originalContent = created ? [] : Array.from(root.childNodes);
    const bodyId = uid('zx-panel-body');
    const title = h('span', { class: 'zx-panel__title', ref: 'title' });
    const toggleChildren = [];
    if (this._collapsible) {
      toggleChildren.push(h('span', {
        class: 'zx-panel__chevron',
        ariaHidden: 'true'
      }, icon('chevron-right', { size: 16 })));
    }
    toggleChildren.push(title);

    const toggle = this._collapsible ? h('button', {
      class: 'zx-panel__toggle',
      ref: 'toggle',
      type: 'button',
      ariaControls: bodyId,
      ariaExpanded: String(this._open)
    }, toggleChildren) : h('div', {
      class: 'zx-panel__toggle',
      ref: 'toggle'
    }, toggleChildren);
    const header = h('div', { class: 'zx-panel__header', ref: 'header' },
      toggle,
      h('div', {
        class: 'zx-panel__buttons',
        ref: 'buttons',
        role: 'group',
        ariaLabel: 'Panel actions'
      })
    );
    const content = h('div', {
      class: 'zx-panel__content',
      ref: 'content'
    });
    const body = h('div', {
      class: 'zx-panel__body',
      ref: 'body',
      id: bodyId
    }, content);
    const footer = h('div', {
      class: 'zx-panel__footer',
      ref: 'footer',
      hidden: true
    },
    h('div', { class: 'zx-panel__footer-content', ref: 'footerContent' }),
    h('div', {
      class: 'zx-panel__footer-buttons',
      ref: 'footerButtons',
      role: 'group',
      ariaLabel: 'Panel footer actions'
    }));
    root.replaceChildren(header, body, footer);

    this.setTitle(this.options.title);
    if (this.options.content !== null) this.setContent(this.options.content);
    else content.append(...originalContent);
    this.setButtons(this.options.buttons);
    this.setFooter(this.options.footer);
    this.setFooterButtons(this.options.footerButtons);
    this._syncOpenState();

    if (this._collapsible) {
      this.listen(toggle, 'click', () => this.toggle());
    }
    return root;
  }

  /**
   * Replaces the visible title.
   * @param {string} title Next title.
   * @returns {this}
   */
  setTitle(title) {
    this.refs.title.textContent = String(title ?? '');
    return this;
  }

  /**
   * Replaces the panel body.
   * @param {PanelContent} content Next text, node, component, or null to clear.
   * @returns {this}
   */
  setContent(content) {
    replaceContent(this.refs.content, content, 'Panel content');
    return this;
  }

  /**
   * Replaces the header action area, right-aligned beside the title.
   * @param {PanelButton[]} list Button descriptors or elements.
   * @returns {this}
   */
  setButtons(list) {
    this.refs.buttons.replaceChildren(...this._buildButtons(list, 'Panel buttons'));
    return this;
  }

  /**
   * Replaces or removes the footer content. The footer bar appears whenever it has content,
   * footer buttons, or both.
   * @param {PanelContent} content Next footer content, or null to remove it.
   * @returns {this}
   */
  setFooter(content) {
    replaceContent(this.refs.footerContent, content, 'Panel footer');
    this._hasFooterContent = content !== null;
    this._syncFooter();
    return this;
  }

  /**
   * Replaces the footer action area, right-aligned in the footer bar.
   * @param {PanelButton[]} list Button descriptors or elements.
   * @returns {this}
   */
  setFooterButtons(list) {
    this.refs.footerButtons.replaceChildren(
      ...this._buildButtons(list, 'Panel footer buttons'));
    this._syncFooter();
    return this;
  }

  /**
   * Expands the panel.
   * @returns {this}
   * @fires Panel#open
   */
  open() {
    if (this._open) return this;
    this._open = true;
    this._syncOpenState();
    this.emit('open');
    return this;
  }

  /**
   * Collapses the panel.
   * @returns {this}
   * @fires Panel#close
   */
  close() {
    if (!this._open) return this;
    this._open = false;
    this._syncOpenState();
    this.emit('close');
    return this;
  }

  /**
   * Toggles the panel's expanded state.
   * @returns {this}
   * @fires Panel#open
   * @fires Panel#close
   */
  toggle() {
    return this.isOpen() ? this.close() : this.open();
  }

  /**
   * Reports whether the body is expanded.
   * @returns {boolean}
   */
  isOpen() {
    return this._open;
  }

  /** @returns {void} */
  destroy() {
    if (this._cleaned) return;
    this._cleaned = true;
    super.destroy();
    if (!this._createdRoot && this._original) restore(this.el, this._original);
  }

  /** @returns {void} */
  _syncOpenState() {
    this.el.setAttribute('data-state', this._open ? 'open' : 'closed');
    this.refs.body.hidden = !this._open;
    if (this._collapsible) {
      this.refs.toggle.setAttribute('aria-expanded', String(this._open));
    }
  }

  /** @returns {void} */
  _syncFooter() {
    this.refs.footer.hidden = !this._hasFooterContent
      && this.refs.footerButtons.childElementCount === 0;
  }

  /**
   * Turns button descriptors into elements, passing through any Element unchanged.
   * @param {PanelButton[]} list Button descriptors or elements.
   * @param {string} label Error-message prefix.
   * @returns {Element[]}
   */
  _buildButtons(list, label) {
    if (!Array.isArray(list)) throw new TypeError(`${label} must be an array`);
    return list.map((item) => {
      if (isElement(item)) return item;
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new TypeError(`${label} must be Elements or button descriptors`);
      }
      const descriptor = { ...item };
      const onclick = descriptor.onclick;
      delete descriptor.onclick;
      const element = button(descriptor);
      if (typeof onclick === 'function') this.listen(element, 'click', onclick);
      return element;
    });
  }
}

/**
 * Emitted after the panel expands.
 * @event Panel#open
 * @type {CustomEvent<Record<string, never>>}
 */

/**
 * Emitted after the panel collapses.
 * @event Panel#close
 * @type {CustomEvent<Record<string, never>>}
 */

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

/** @param {Element} target @param {PanelContent} content @param {string} label @returns {void} */
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
