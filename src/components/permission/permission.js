import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { uid } from '../../core/util.js';
import { Select } from '../select/select.js';

/** @typedef {Record<string, any>|string|number|boolean|symbol|bigint|null|undefined} PermissionGroup */
/**
 * @typedef {Object} PermissionOptions
 * @property {boolean|string|number|symbol|bigint|null} [value=true] Public, private, or group ID.
 * @property {PermissionGroup[]} [groups=[]] Available groups.
 * @property {string|((item: PermissionGroup) => unknown)} [groupsValueKey='ID'] Group ID property or reader.
 * @property {string|((item: PermissionGroup) => string)} [groupsLabelKey='name'] Group label property or reader.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<PermissionChangeDetail>) => void} [onchange] Change listener.
 */
/** @typedef {{value: unknown}} PermissionChangeDetail */

/**
 * Record-permission choice for private, public, and group access.
 *
 * @fires Permission#change
 */
export class Permission extends Component {
  static cssName = 'permission';

  /** @type {PermissionOptions} */
  static defaults = {
    value: true,
    groups: [],
    groupsValueKey: 'ID',
    groupsLabelKey: 'name'
  };

  /** @type {'private'|'public'|'group'} */
  _mode = 'public';
  /** @type {unknown} */
  _groupValue = null;
  /** @type {Select|null} */
  _groupSelect = null;
  /** @type {boolean} */
  _createdRoot = false;
  /** @type {Node[]} */
  _originalChildren = [];
  /** @type {HTMLElement|null} */
  _root = null;
  /** @type {string|null} */
  _originalState = null;

  /** @returns {HTMLElement} */
  render() {
    this._createdRoot = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this._root = root;
    if (!this._createdRoot) {
      this._originalChildren = Array.from(root.childNodes);
      this._originalState = root.getAttribute('data-state');
    }
    const name = uid('zx-permission');
    const choices = h('div', {
      class: 'zx-permission__choices',
      role: 'radiogroup',
      ariaLabel: this._message('permission.label', 'Permission')
    });
    const privateChoice = this._choice(name, 'private', this._message('permission.private', 'Private'));
    const publicChoice = this._choice(name, 'public', this._message('permission.public', 'Public'));
    const groupChoice = this._choice(name, 'group', this._message('permission.group', 'Group'));
    const groupHost = h('div', { ref: 'groupHost', class: 'zx-permission__groups' });
    choices.append(privateChoice.label, publicChoice.label, groupChoice.label, groupHost);
    root.replaceChildren(choices);
    this.refs.private = privateChoice.input;
    this.refs.public = publicChoice.input;
    this.refs.group = groupChoice.input;

    this._groupSelect = new Select(groupHost, {
      items: Array.isArray(this.options.groups) ? this.options.groups : [],
      valueKey: this.options.groupsValueKey,
      labelKey: this.options.groupsLabelKey,
      placeholder: this._message('permission.group', 'Group')
    });
    this._groupSelect.refs.input.setAttribute(
      'aria-label',
      this._message('permission.group', 'Group')
    );
    for (const input of [privateChoice.input, publicChoice.input, groupChoice.input]) {
      this.listen(input, 'change', () => {
        if (!input.checked) return;
        if (input.value === 'group') this._selectGroupMode();
        else this.set(input.value);
      });
    }
    this.listen(groupHost, 'zx-change', (event) => {
      event.stopPropagation();
      if (this._mode !== 'group') return;
      const previous = this.get();
      this._groupValue = /** @type {CustomEvent} */ (event).detail.value;
      const value = this.get();
      if (!Object.is(previous, value)) this.emit('change', { value });
    });

    this.set(this.options.value, { silent: true });
    return root;
  }

  /** Returns the normalized permission value. @returns {'private'|'public'|unknown} */
  get() {
    if (this._mode === 'private') return 'private';
    if (this._mode === 'public') return 'public';
    return this._groupValue;
  }

  /**
   * Sets a public, private, or group permission.
   * @param {boolean|string|number|symbol|bigint|null} value Permission value.
   * @param {{silent?: boolean}} [options={}] Update behavior.
   * @returns {this}
   * @fires Permission#change
   */
  set(value, { silent = false } = {}) {
    const previous = this.get();
    if (value === true || value === 'public') {
      this._mode = 'public';
    } else if (value === false || value === 'private') {
      this._mode = 'private';
    } else {
      this._mode = 'group';
      this._groupValue = value;
      this._groupSelect?.set(value, { silent: true });
    }
    this._sync();
    const next = this.get();
    if (!silent && !Object.is(previous, next)) this.emit('change', { value: next });
    return this;
  }

  /** Destroys the embedded Select and restores an enhanced target. @returns {void} */
  destroy() {
    this._groupSelect?.destroy();
    this._groupSelect = null;
    if (!this._createdRoot && this.el) {
      this.el.replaceChildren(...this._originalChildren);
      if (this._originalState === null) this.el.removeAttribute('data-state');
      else this.el.setAttribute('data-state', this._originalState);
    }
    super.destroy();
  }

  /** @returns {void} */
  _selectGroupMode() {
    const previous = this.get();
    this._mode = 'group';
    if (this._groupValue == null) {
      const first = Array.isArray(this.options.groups) ? this.options.groups[0] : null;
      this._groupValue = first == null ? null : read(first, this.options.groupsValueKey);
    }
    this._groupSelect?.set(this._groupValue, { silent: true });
    this._sync();
    const next = this.get();
    if (!Object.is(previous, next)) this.emit('change', { value: next });
  }

  /** @returns {void} */
  _sync() {
    /** @type {HTMLInputElement} */ (this.refs.private).checked = this._mode === 'private';
    /** @type {HTMLInputElement} */ (this.refs.public).checked = this._mode === 'public';
    /** @type {HTMLInputElement} */ (this.refs.group).checked = this._mode === 'group';
    if (this._mode === 'group') this._groupSelect?.enable();
    else this._groupSelect?.disable();
    this._root?.setAttribute('data-state', this._mode);
  }

  /**
   * @param {string} name
   * @param {'private'|'public'|'group'} value
   * @param {string} text
   * @returns {{label: HTMLLabelElement, input: HTMLInputElement}}
   */
  _choice(name, value, text) {
    const input = /** @type {HTMLInputElement} */ (h('input', {
      type: 'radio',
      name,
      value
    }));
    const label = /** @type {HTMLLabelElement} */ (h('label', {
      class: 'zx-permission__choice'
    }, input, h('span', {}, text)));
    return { label, input };
  }

  /** @param {string} key @param {string} fallback @returns {string} */
  _message(key, fallback) {
    const message = this.msg(key);
    return message === key ? fallback : message;
  }
}

/** Permission-value change. @event Permission#change @type {CustomEvent<PermissionChangeDetail>} */

/**
 * @param {PermissionGroup} item
 * @param {string|((item: PermissionGroup) => unknown)} reader
 * @returns {unknown}
 */
function read(item, reader) {
  if (typeof reader === 'function') return reader(item);
  if (item === null || typeof item !== 'object') return item;
  return item[reader];
}
