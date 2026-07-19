import { Component } from '../../core/component.js';
import { h, resolveElement } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

/**
 * @typedef {Object} GroupboxOptions
 * @property {string} [title=''] Section title.
 * @property {boolean} [open=true] Initial expanded state.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open callback.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onclose] Close callback.
 */

/** @typedef {string|Node|Component} GroupboxContent */

/**
 * Collapsible section backed by native details and summary elements.
 * @fires Groupbox#open
 * @fires Groupbox#close
 */
export class Groupbox extends Component {
  static cssName = 'groupbox';

  /** @type {Readonly<GroupboxOptions>} */
  static defaults = { title: '', open: true };

  /**
   * Creates or adopts a native details section.
   * @param {Element|string|null} target Existing details, plain container, selector, or null.
   * @param {GroupboxOptions} [options={}] Groupbox options.
   */
  constructor(target, options = {}) {
    let normalizedTarget = target;
    let adoption = null;
    if (target !== null) {
      const resolved = resolveElement(target);
      if (resolved && resolved.localName !== 'details') {
        const details = document.createElement('details');
        const children = Array.from(resolved.childNodes);
        const parent = resolved.parentNode;
        const next = resolved.nextSibling;
        if (parent) parent.insertBefore(details, resolved);
        details.append(...children);
        resolved.remove();
        adoption = { original: resolved, details, children, parent, next };
        normalizedTarget = details;
      }
    }

    try {
      super(normalizedTarget, options);
    } catch (error) {
      if (adoption) restoreAdoption(adoption);
      throw error;
    }
    this._adoption = adoption;
  }

  /** @returns {HTMLDetailsElement} */
  render() {
    const created = !this.el;
    const details = /** @type {HTMLDetailsElement} */ (this.el ?? h('details'));
    if (details.localName !== 'details') throw new TypeError('Groupbox requires a details element');

    this._createdRoot = created;
    this._original = created ? null : snapshot(details);
    const contentNodes = Array.from(details.childNodes).filter((node) =>
      !(node.nodeType === 1 && /** @type {Element} */ (node).localName === 'summary')
    );
    const summary = h('summary', { class: 'zx-groupbox__summary', ref: 'summary' },
      h('span', { class: 'zx-groupbox__chevron', ariaHidden: 'true' },
        icon('chevron-right', { size: 16 })
      ),
      h('span', { class: 'zx-groupbox__title', ref: 'title' }, String(this.options.title))
    );
    const content = h('div', { class: 'zx-groupbox__content', ref: 'content' }, contentNodes);
    details.replaceChildren(summary, content);
    details.open = Boolean(this.options.open);
    this._lastOpen = details.open;
    this.listen(details, 'toggle', () => {
      const open = details.open;
      if (open === this._lastOpen) return;
      this._lastOpen = open;
      this.emit(open ? 'open' : 'close');
    });
    return details;
  }

  /**
   * Expands the section.
   * @returns {this}
   */
  open() {
    this.el.setAttribute('open', '');
    return this;
  }

  /**
   * Collapses the section.
   * @returns {this}
   */
  close() {
    this.el.removeAttribute('open');
    return this;
  }

  /**
   * Toggles the section.
   * @returns {this}
   */
  toggle() {
    return this.isOpen() ? this.close() : this.open();
  }

  /**
   * Reports whether the section is expanded.
   * @returns {boolean}
   */
  isOpen() {
    return /** @type {HTMLDetailsElement} */ (this.el).open;
  }

  /**
   * Replaces the visible title.
   * @param {string} title Next title.
   * @returns {this}
   */
  setTitle(title) {
    this.refs.title.textContent = String(title);
    return this;
  }

  /**
   * Replaces the section body.
   * @param {GroupboxContent} content Next text, node, or component.
   * @returns {this}
   */
  setContent(content) {
    const node = content instanceof Component ? content.toElement() : content;
    this.refs.content.replaceChildren();
    if (typeof node === 'string') this.refs.content.append(document.createTextNode(node));
    else if (node && typeof node.nodeType === 'number') this.refs.content.append(node);
    else throw new TypeError('Groupbox content must be a string, Node, or Component');
    return this;
  }

  /** @returns {void} */
  destroy() {
    if (this._cleaned) return;
    this._cleaned = true;
    super.destroy();
    if (this._adoption) {
      restoreAdoption(this._adoption);
    } else if (!this._createdRoot && this._original) {
      restore(this.el, this._original);
    }
  }
}

/**
 * Emitted when the native details element opens.
 * @event Groupbox#open
 * @type {CustomEvent<Record<string, never>>}
 */

/**
 * Emitted when the native details element closes.
 * @event Groupbox#close
 * @type {CustomEvent<Record<string, never>>}
 */

/** @param {Element} element @returns {{attributes: [string, string][], children: Node[]}} */
function snapshot(element) {
  return {
    attributes: Array.from(element.attributes, (attribute) => [attribute.name, attribute.value]),
    children: Array.from(element.childNodes)
  };
}

/** @param {Element} element @param {{attributes: [string, string][], children: Node[]}} state */
function restore(element, state) {
  for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);
  for (const [name, value] of state.attributes) element.setAttribute(name, value);
  element.replaceChildren(...state.children);
}

/**
 * @param {{original: Element, details: Element, children: Node[], parent: Node|null, next: Node|null}} state
 * @returns {void}
 */
function restoreAdoption(state) {
  state.original.replaceChildren(...state.children);
  if (state.details.parentNode) {
    state.details.replaceWith(state.original);
  } else if (state.parent) {
    const reference = state.next?.parentNode === state.parent ? state.next : null;
    state.parent.insertBefore(state.original, reference);
  }
}
