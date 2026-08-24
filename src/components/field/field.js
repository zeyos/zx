import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { uid } from '../../core/util.js';

/**
 * @typedef {Object} FieldOptions
 * @property {string|null} [id=null] Control ID and logical field identifier.
 * @property {string} [type='text'] Registered field type.
 * @property {string} [label=''] Visible label.
 * @property {string} [description=''] Supporting description.
 * @property {unknown} [value=undefined] Initial value.
 * @property {string} [placeholder=''] Control placeholder.
 * @property {boolean} [required=false] Whether a value is required.
 * @property {boolean} [disabled=false] Whether the control is disabled.
 * @property {string[]|Record<string, string>|null} [options=null] Select or option-list values.
 * @property {'stack'|'inline'} [layout='stack'] Label/control layout.
 * @property {Record<string, unknown>} [props={}] Adapter-specific control properties.
 * @property {FieldAdapterFactory} [adapter] Adapter used by the `custom` type.
 * @property {(event: CustomEvent<{value: unknown}>) => void} [onchange] Value change listener.
 * @property {(event: CustomEvent<{message: string}>) => void} [oninvalid] Validation failure listener.
 */

/**
 * @typedef {Object} FieldAdapter
 * @property {Element} el Control root.
 * @property {() => unknown} get Read the current value.
 * @property {(value: unknown, options?: {silent?: boolean}) => void} set Set the current value.
 * @property {() => void} focus Focus the control.
 * @property {(disabled: boolean) => void} setDisabled Set disabled state.
 * @property {() => void} [destroy] Release adapter-owned resources.
 */

/** @typedef {(field: Field, options: Readonly<FieldOptions>) => FieldAdapter} FieldAdapterFactory */
/** @typedef {{valid: boolean, value: number|string}} NumericCoercion */

/**
 * One labelled form control backed by a registered adapter.
 * @fires Field#change
 * @fires Field#invalid
 * @extends {Component<FieldOptions>}
 */
export class Field extends Component {
  static cssName = 'field';

  /** @type {FieldOptions & {msg: Record<string, string>}} */
  static defaults = {
    id: null,
    type: 'text',
    label: '',
    description: '',
    value: undefined,
    placeholder: '',
    required: false,
    disabled: false,
    options: null,
    layout: 'stack',
    props: {},
    msg: {
      'field.int': 'Enter a whole number.',
      'field.float': 'Enter a valid number.',
      'field.unknown': 'Unknown field type: %1'
    }
  };

  /** @type {Map<string, FieldAdapterFactory>} */
  static #adapters = new Map();

  /**
   * Registers or replaces a field adapter.
   * @param {string} type Adapter type name.
   * @param {FieldAdapterFactory} adapter Adapter factory.
   * @returns {typeof Field}
   */
  static register(type, adapter) {
    const name = String(type).trim().toLowerCase();
    if (!name) throw new TypeError('Field adapter type must not be empty');
    if (typeof adapter !== 'function') throw new TypeError('Field adapter must be a function');
    Field.#adapters.set(name, adapter);
    return this;
  }

  /**
   * Reports whether a field adapter is registered.
   * @param {string} type Adapter type name.
   * @returns {boolean}
   */
  static has(type) {
    return Field.#adapters.has(String(type).trim().toLowerCase());
  }

  // `adapter` (FieldAdapter), `initialValue`, and `controlId` are assigned in render();
  // declaring them as class fields would re-initialize them to undefined after the base
  // constructor (which calls render()) returns — see AGENTS.md.

  /** @returns {HTMLElement} */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    const type = String(this.options.type || 'text').toLowerCase();
    const layout = this.options.layout === 'inline' ? 'inline' : 'stack';
    this._ownedComponents = new Set();
    this._ownedNodes = [];
    this._rootAttributes = rememberAttributes(root, ['data-layout', 'data-field-type', 'data-disabled', 'data-state']);
    root.dataset.layout = layout;
    root.dataset.fieldType = type;

    this.controlId = this.options.id ? String(this.options.id) : uid('zx-field');
    const labelId = `${this.controlId}-label`;
    const descriptionId = `${this.controlId}-description`;
    const highlightId = `${this.controlId}-highlight`;
    const label = h('label', {
      class: 'zx-field__label',
      id: labelId,
      htmlFor: this.controlId
    }, String(this.options.label ?? ''), this.options.required ? h('span', {
      class: 'zx-field__required',
      ariaHidden: 'true'
    }, ' *') : null);
    const controlSlot = h('div', { class: 'zx-field__control' });
    const description = h('div', {
      class: 'zx-field__description',
      id: descriptionId
    }, String(this.options.description ?? ''));
    const highlight = h('div', {
      class: 'zx-field__highlight',
      id: highlightId,
      ariaLive: 'polite',
      hidden: true
    });
    const body = h('div', { class: 'zx-field__body' }, controlSlot, description, highlight);
    this._ownedNodes.push(label, body);
    root.append(label, body);

    const factory = Field.#adapters.get(type);
    if (!factory) {
      const message = this.msg('field.unknown', type);
      console.warn(`[zx.Field] ${message}`);
      this.adapter = errorAdapter(message, this.controlId);
    } else {
      try {
        this.adapter = validateAdapter(factory(this, /** @type {Readonly<FieldOptions>} */ (this.options)));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[zx.Field] Adapter "${type}" failed: ${message}`);
        this.adapter = errorAdapter(message, this.controlId);
      }
    }

    const control = this.adapter.el;
    if (!control.id) control.id = this.controlId;
    label.htmlFor = control.id;
    if (!isLabelable(control)) control.setAttribute('aria-labelledby', labelId);
    this._baseDescribedBy = control.getAttribute('aria-describedby') ?? '';
    controlSlot.append(control);
    this._descriptionId = String(this.options.description ?? '') ? descriptionId : '';
    this._highlightId = highlightId;
    this._highlight = highlight;
    this._syncDescription();
    this.initialValue = initialValue(type, this.options.value);
    this.adapter.set(this.initialValue, { silent: true });
    this.setDisabled(Boolean(this.options.disabled));
    this.listen(control, 'change', () => {
      this.emit('change', { value: this.getValue() });
    });
    return root;
  }

  /**
   * Returns the adapter value.
   * @returns {unknown}
   */
  getValue() {
    return this.adapter.get();
  }

  /**
   * Sets the adapter value.
   * @param {unknown} value New value.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `change`.
   * @returns {this}
   * @fires Field#change
   */
  setValue(value, { silent = false } = {}) {
    this.adapter.set(value, { silent });
    if (!silent) this.emit('change', { value: this.getValue() });
    return this;
  }

  /**
   * Focuses the adapter control.
   * @returns {this}
   */
  focus() {
    this.adapter.focus();
    return this;
  }

  /**
   * Restores the initial value without emitting `change`.
   * @returns {this}
   */
  reset() {
    this.setValue(this.initialValue, { silent: true });
    this.clearHighlight();
    return this;
  }

  /**
   * Enables or disables the adapter control.
   * @param {boolean} disabled Disabled state.
   * @returns {this}
   */
  setDisabled(disabled) {
    const value = Boolean(disabled);
    this.adapter.setDisabled(value);
    this.el.dataset.disabled = String(value);
    return this;
  }

  /**
   * Displays a validation or status message.
   * @param {string} message Message text.
   * @param {'danger'|'warning'|'success'} [kind='danger'] Message kind.
   * @returns {this}
   */
  setHighlight(message, kind = 'danger') {
    if (!message) return this.clearHighlight();
    const normalizedKind = ['danger', 'warning', 'success'].includes(kind) ? kind : 'danger';
    this.el.dataset.state = normalizedKind;
    this._highlight.textContent = String(message ?? '');
    this._highlight.hidden = !message;
    if (normalizedKind === 'danger' && message) {
      this._highlight.setAttribute('role', 'alert');
      this.adapter.el.setAttribute('aria-invalid', 'true');
      this.emit('invalid', { message: String(message) });
    } else {
      this._highlight.removeAttribute('role');
      this.adapter.el.removeAttribute('aria-invalid');
    }
    this._syncDescription(Boolean(message));
    return this;
  }

  /**
   * Clears the current validation or status message.
   * @returns {this}
   */
  clearHighlight() {
    delete this.el.dataset.state;
    this._highlight.textContent = '';
    this._highlight.hidden = true;
    this._highlight.removeAttribute('role');
    this.adapter.el.removeAttribute('aria-invalid');
    this._syncDescription(false);
    return this;
  }

  /**
   * Returns the adapter's control root.
   * @returns {Element}
   */
  getInput() {
    return this.adapter.el;
  }

  /**
   * Registers a child component for destruction with this field.
   * @template {Component} T
   * @param {T} component Child component.
   * @returns {T} The registered component.
   */
  own(component) {
    if (!(component instanceof Component)) throw new TypeError('Field.own() requires a Component');
    this._ownedComponents.add(component);
    return component;
  }

  /** @param {boolean} [highlighted=false] @returns {void} */
  _syncDescription(highlighted = false) {
    const ids = [this._baseDescribedBy, this._descriptionId, highlighted ? this._highlightId : '']
      .flatMap((value) => value.split(/\s+/)).filter(Boolean);
    if (ids.length) this.adapter.el.setAttribute('aria-describedby', [...new Set(ids)].join(' '));
    else this.adapter.el.removeAttribute('aria-describedby');
  }

  /** @returns {void} */
  destroy() {
    this.adapter?.destroy?.();
    for (const component of this._ownedComponents ?? []) component.destroy();
    this._ownedComponents?.clear();
    for (const node of this._ownedNodes ?? []) node.remove();
    restoreAttributes(this.el, this._rootAttributes ?? new Map());
    super.destroy();
  }
}

/**
 * Coerces a localized integer string. Empty strings remain empty and valid.
 * @param {unknown} input Input value.
 * @returns {NumericCoercion}
 */
export function coerceInteger(input) {
  if (typeof input === 'number') {
    return Number.isInteger(input) ? { valid: true, value: input } : { valid: false, value: String(input) };
  }
  const source = String(input ?? '').trim();
  if (source === '') return { valid: true, value: '' };
  const parsed = parseLocalizedNumber(source);
  if (parsed !== null && Number.isInteger(parsed)) return { valid: true, value: parsed };
  return { valid: false, value: source };
}

/**
 * Coerces a localized floating-point string. The rightmost comma or dot is the decimal separator
 * when both occur, so values such as `1.234,56` are accepted.
 * @param {unknown} input Input value.
 * @returns {NumericCoercion}
 */
export function coerceFloat(input) {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? { valid: true, value: input } : { valid: false, value: String(input) };
  }
  const source = String(input ?? '').trim();
  if (source === '') return { valid: true, value: '' };
  const parsed = parseLocalizedNumber(source);
  return parsed !== null ? { valid: true, value: parsed } : { valid: false, value: source };
}

/** @param {string} source @returns {number|null} */
function parseLocalizedNumber(source) {
  const compact = source.replace(/[\s\u00a0]/g, '');
  if (!/^[+-]?[\d.,]+$/.test(compact)) return null;
  const sign = /^[+-]/.test(compact) ? compact[0] : '';
  const unsigned = sign ? compact.slice(1) : compact;
  if (!/\d/.test(unsigned)) return null;
  const dots = [...unsigned.matchAll(/\./g)].map((match) => match.index);
  const commas = [...unsigned.matchAll(/,/g)].map((match) => match.index);
  let normalized;

  if (dots.length && commas.length) {
    const decimal = dots.at(-1) > commas.at(-1) ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    const decimalIndex = unsigned.lastIndexOf(decimal);
    const whole = unsigned.slice(0, decimalIndex);
    const fraction = unsigned.slice(decimalIndex + 1);
    if (!/^\d+$/.test(fraction) || !validGroupedWhole(whole, thousands)) return null;
    normalized = whole.split(thousands).join('') + '.' + fraction;
  } else if (commas.length > 1 || dots.length > 1) {
    const separator = commas.length ? ',' : '.';
    if (!validGroupedWhole(unsigned, separator)) return null;
    normalized = unsigned.split(separator).join('');
  } else if (commas.length === 1) {
    normalized = unsigned.replace(',', '.');
  } else {
    normalized = unsigned;
  }

  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;
  const result = Number(sign + normalized);
  return Number.isFinite(result) ? result : null;
}

/** @param {string} value @param {string} separator @returns {boolean} */
function validGroupedWhole(value, separator) {
  const groups = value.split(separator);
  return groups.length > 0 && /^\d{1,3}$/.test(groups[0]) && groups.slice(1).every((part) => /^\d{3}$/.test(part));
}

/** @param {string} type @param {unknown} value @returns {unknown} */
function initialValue(type, value) {
  if (value !== undefined) return value;
  if (type === 'checkbox') return false;
  return '';
}

/** @param {unknown} adapter @returns {FieldAdapter} */
function validateAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') throw new TypeError('Adapter must return an object');
  if (!(adapter.el && adapter.el.nodeType === 1)) throw new TypeError('Adapter must provide an Element');
  for (const method of ['get', 'set', 'focus', 'setDisabled']) {
    if (typeof adapter[method] !== 'function') throw new TypeError(`Adapter is missing ${method}()`);
  }
  return /** @type {FieldAdapter} */ (adapter);
}

/** @param {string} message @param {string} id @returns {FieldAdapter} */
function errorAdapter(message, id) {
  const el = h('div', { class: 'zx-field__error-control', id, role: 'alert', tabIndex: -1 }, message);
  return {
    el,
    get: () => null,
    set: () => {},
    focus: () => el.focus(),
    setDisabled: () => {}
  };
}

/** @param {Element} element @returns {boolean} */
function isLabelable(element) {
  return ['BUTTON', 'INPUT', 'METER', 'OUTPUT', 'PROGRESS', 'SELECT', 'TEXTAREA'].includes(element.tagName);
}

/** @param {HTMLElement} element @param {string[]} names @returns {Map<string, string|null>} */
function rememberAttributes(element, names) {
  return new Map(names.map((name) => [name, element.getAttribute(name)]));
}

/** @param {Element} element @param {Map<string, string|null>} attributes @returns {void} */
function restoreAttributes(element, attributes) {
  for (const [name, value] of attributes) {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }
}

/** @param {Readonly<FieldOptions>} options @param {Record<string, unknown>} base @returns {Record<string, unknown>} */
function controlProps(options, base) {
  const props = { ...(options.props ?? {}) };
  for (const key of Object.keys(props)) {
    if (/^on[a-z]/i.test(key) || key === 'content') delete props[key];
  }
  return { ...props, ...base };
}

/** @param {'input'|'textarea'} tag @param {string} type @returns {FieldAdapterFactory} */
function textAdapter(tag, type) {
  return (_field, options) => {
    const el = h(tag, controlProps(options, {
      type: tag === 'input' ? type : undefined,
      placeholder: options.placeholder,
      required: options.required,
      disabled: options.disabled
    }));
    return elementValueAdapter(el);
  };
}

/** @param {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} el @returns {FieldAdapter} */
function elementValueAdapter(el) {
  return {
    el,
    get: () => el.value,
    set: (value) => { el.value = value == null ? '' : String(value); },
    focus: () => el.focus(),
    setDisabled: (disabled) => { el.disabled = disabled; }
  };
}

/** @param {'int'|'float'} kind @returns {FieldAdapterFactory} */
function numericAdapter(kind) {
  return (field, options) => {
    const coerce = kind === 'int' ? coerceInteger : coerceFloat;
    const input = h('input', controlProps(options, {
      type: 'text',
      inputMode: kind === 'int' ? 'numeric' : 'decimal',
      placeholder: options.placeholder,
      required: options.required,
      disabled: options.disabled
    }));
    field.listen(input, 'blur', () => {
      const result = coerce(input.value);
      if (!result.valid) {
        field.setHighlight(field.msg(`field.${kind}`), 'danger');
        return;
      }
      if (result.value !== '') input.value = String(result.value);
      field.clearHighlight();
    });
    return {
      ...elementValueAdapter(input),
      get: () => coerce(input.value).value
    };
  };
}

/** @type {FieldAdapterFactory} */
const checkboxAdapter = (_field, options) => {
  const input = h('input', controlProps(options, {
    type: 'checkbox',
    required: options.required,
    disabled: options.disabled
  }));
  return {
    el: input,
    get: () => input.checked,
    set: (value) => { input.checked = Boolean(value); },
    focus: () => input.focus(),
    setDisabled: (disabled) => { input.disabled = disabled; }
  };
};

/** @type {FieldAdapterFactory} */
const selectAdapter = (_field, options) => {
  const select = h('select', controlProps(options, {
    required: options.required,
    disabled: options.disabled
  }));
  for (const [value, label] of normalizeOptions(options.options)) {
    select.append(h('option', { value }, label));
  }
  return elementValueAdapter(select);
};

/** @type {FieldAdapterFactory} */
const optionListAdapter = (_field, options) => {
  const root = h('div', {
    class: 'zx-field__option-list',
    role: 'radiogroup'
  });
  const name = options.id ? String(options.id) : uid('zx-option-list');
  const radios = normalizeOptions(options.options).map(([value, label], index) => {
    const input = h('input', {
      type: 'radio',
      name,
      value,
      required: Boolean(options.required) && index === 0,
      disabled: options.disabled
    });
    root.append(h('label', { class: 'zx-field__option' }, input, h('span', {}, label)));
    return input;
  });
  return {
    el: root,
    get: () => radios.find((radio) => radio.checked)?.value ?? '',
    set: (value) => {
      for (const radio of radios) radio.checked = String(value ?? '') === radio.value;
    },
    focus: () => (radios.find((radio) => radio.checked) ?? radios[0])?.focus(),
    setDisabled: (disabled) => {
      for (const radio of radios) radio.disabled = disabled;
      root.setAttribute('aria-disabled', String(disabled));
    }
  };
};

/** @type {FieldAdapterFactory} */
const htmlAdapter = (_field, options) => {
  const el = h('div', controlProps(options, { class: 'zx-field__static' }));
  let adopted = null;
  const set = (value) => {
    restoreAdopted(adopted);
    adopted = null;
    if (value && typeof value === 'object' && typeof value.nodeType === 'number') {
      adopted = { node: value, parent: value.parentNode, next: value.nextSibling };
      el.replaceChildren(value);
    } else {
      el.textContent = value == null ? '' : String(value);
    }
  };
  return {
    el,
    get: () => el.textContent,
    set,
    focus: () => {},
    setDisabled: (disabled) => { el.setAttribute('aria-disabled', String(disabled)); },
    destroy: () => restoreAdopted(adopted)
  };
};

/** @param {{node: Node, parent: Node|null, next: Node|null}|null} adopted @returns {void} */
function restoreAdopted(adopted) {
  if (!adopted) return;
  if (adopted.parent) adopted.parent.insertBefore(
    adopted.node,
    adopted.next?.parentNode === adopted.parent ? adopted.next : null
  );
  else adopted.node.remove();
}

/** @type {FieldAdapterFactory} */
const customAdapter = (field, options) => {
  if (typeof options.adapter !== 'function') throw new TypeError('Custom fields require options.adapter');
  return options.adapter(field, options);
};

/** @param {FieldOptions['options']} options @returns {Array<[string, string]>} */
function normalizeOptions(options) {
  if (Array.isArray(options)) return options.map((value) => [String(value), String(value)]);
  if (options && typeof options === 'object') {
    return Object.entries(options).map(([value, label]) => [value, String(label)]);
  }
  return [];
}

Field.register('text', textAdapter('input', 'text'));
Field.register('password', textAdapter('input', 'password'));
Field.register('textarea', textAdapter('textarea', 'text'));
Field.register('checkbox', checkboxAdapter);
Field.register('int', numericAdapter('int'));
Field.register('float', numericAdapter('float'));
Field.register('select', selectAdapter);
Field.register('optionlist', optionListAdapter);
Field.register('hidden', textAdapter('input', 'hidden'));
Field.register('html', htmlAdapter);
Field.register('custom', customAdapter);

/**
 * Field value change event.
 * @event Field#change
 * @type {CustomEvent<{value: unknown}>}
 */

/**
 * Field validation failure event.
 * @event Field#invalid
 * @type {CustomEvent<{message: string}>}
 */
