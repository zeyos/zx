import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { uid } from '../../core/util.js';

/** @typedef {string|Node|Component|null} PanelContent */

/**
 * @typedef {Object} PanelOptions
 * @property {string} [title=''] Section title.
 * @property {PanelContent} [content=null] Initial body content.
 * @property {boolean} [open=true] Initial expanded state.
 * @property {boolean} [collapsible=true] Whether the header toggles the body.
 * @property {PanelContent} [footer=null] Optional footer content.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open callback.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onclose] Close callback.
 */

/**
 * Framed, optionally collapsible titled section.
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
    footer: null
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

    const originalContent = created ? [] : Array.from(root.childNodes);
    const bodyId = uid('zx-panel-body');
    const title = h('span', { class: 'zx-panel__title', ref: 'title' });
    const headerChildren = [];
    if (this._collapsible) {
      headerChildren.push(h('span', {
        class: 'zx-panel__chevron',
        ariaHidden: 'true'
      }, icon('chevron-right', { size: 16 })));
    }
    headerChildren.push(title);

    const header = this._collapsible ? h('button', {
      class: 'zx-panel__header',
      ref: 'header',
      type: 'button',
      ariaControls: bodyId,
      ariaExpanded: String(this._open)
    }, headerChildren) : h('div', {
      class: 'zx-panel__header',
      ref: 'header'
    }, headerChildren);
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
    });
    root.replaceChildren(header, body, footer);

    this.setTitle(this.options.title);
    if (this.options.content !== null) this.setContent(this.options.content);
    else content.append(...originalContent);
    this.setFooter(this.options.footer);
    this._syncOpenState();

    if (this._collapsible) {
      this.listen(header, 'click', () => this.toggle());
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
   * Replaces or removes the footer.
   * @param {PanelContent} content Next footer content, or null to remove it.
   * @returns {this}
   */
  setFooter(content) {
    replaceContent(this.refs.footer, content, 'Panel footer');
    this.refs.footer.hidden = content === null;
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
      this.refs.header.setAttribute('aria-expanded', String(this._open));
    }
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
