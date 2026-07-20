import { CheckButton } from '../components/check-button/check-button.js';
import { Checklist } from '../components/checklist/checklist.js';
import { Datebox } from '../components/datebox/datebox.js';
import { Dialog } from '../components/dialog/dialog.js';
import { Groupbox } from '../components/groupbox/groupbox.js';
import { Search } from '../components/search/search.js';
import { Select } from '../components/select/select.js';
import { Tabbox } from '../components/tabbox/tabbox.js';
import { Table } from '../components/table/table.js';
import { Timebox } from '../components/timebox/timebox.js';
import { Toggle } from '../components/toggle/toggle.js';
import { formatDate, parseDate } from '../core/date.js';
import { INVALID_ATTRIBUTE, coerceAttribute, serializeAttribute } from './reflect.js';

/** @typedef {'string'|'number'|'boolean'|'json'} AttributeType */
/**
 * @typedef {Object} ElementAttribute
 * @property {AttributeType} [type='string'] Attribute representation.
 * @property {string|null} [option] Component option name; null keeps the value on the host only.
 * @property {string} [property] Host property name; defaults to camel-cased attribute name.
 * @property {unknown} [default] Property value used while the attribute is absent.
 * @property {boolean} [always=false] Pass the default to the component during initial creation.
 * @property {boolean} [rebuild=false] Recreate the component when this value changes.
 * @property {(value: unknown, host: HTMLElement) => unknown} [normalize] Value adapter.
 * @property {(value: unknown, host: HTMLElement) => string|null|typeof INVALID_ATTRIBUTE} [serialize]
 * Property serializer override.
 * @property {(component: InstanceType<typeof import('../core/component.js').Component>, value: any, host: HTMLElement) => void} [set]
 * Live component setter.
 * @property {(component: InstanceType<typeof import('../core/component.js').Component>, host: HTMLElement) => unknown} [get]
 * Live component getter.
 */
/** @typedef {Record<string, AttributeType|ElementAttribute>} ElementAttributeMap */
/**
 * @typedef {Object} ElementWrapperOptions
 * @property {boolean} [formAssociated=false] Whether the element participates in native forms.
 * @property {ElementAttributeMap} [attrs={}] Reflected attribute definitions.
 */

const COMPONENT_EVENTS = Object.freeze([
  'change', 'input', 'submit', 'clear', 'open', 'close', 'cancel', 'invalid',
  'query', 'loaded', 'rowclick', 'rowdblclick', 'sort', 'selectionchange', 'datachange'
]);

const TOGGLE_ATTRS = attributes({
  checked: bool({ always: true, set: (component, value) => component.set(value, { silent: true }), get: (component) => component.get() }),
  value: text({ default: true }),
  label: text({ default: null, rebuild: true }),
  disabled: bool({ always: true, set: setDisabled })
});

const CHECK_BUTTON_ATTRS = attributes({
  checked: bool({ always: true, set: (component, value) => component.set(value, { silent: true }), get: (component) => component.get() }),
  value: text({ option: null, default: 'on' }),
  label: text({ default: '', set: (component, value) => component.setLabel(value) }),
  icon: bool({ rebuild: true }),
  disabled: bool({ always: true, set: setDisabled })
});

const SELECT_ATTRS = attributes({
  items: json({ default: [], set: (component, value) => component.setItems(value) }),
  value: text({ default: null, set: (component, value) => component.set(value, { silent: true }), get: (component) => component.value }),
  'value-key': text({ property: 'valueKey', default: 'ID', rebuild: true }),
  'label-key': text({ property: 'labelKey', default: 'name', rebuild: true }),
  placeholder: text({ default: '', set: (component, value) => { component.refs.input.placeholder = value; } }),
  clearable: bool({ default: false, rebuild: true }),
  filter: text({ default: false, normalize: normalizeFilter, rebuild: true }),
  'search-keys': json({ property: 'searchKeys', default: null, rebuild: true }),
  'min-query': number({ property: 'minQuery', default: 0, rebuild: true }),
  debounce: number({ default: 200, rebuild: true }),
  'list-height': number({ property: 'listHeight', default: 280, rebuild: true }),
  disabled: bool({ always: true, set: setDisabled }),
  required: bool({ option: null, always: true }),
  name: text({ option: null, default: '' })
});

const CHECKLIST_ATTRS = attributes({
  items: json({ default: [], set: (component, value) => component.setItems(value) }),
  value: json({ option: null, default: [], set: (component, value) => component.setValues(value), get: (component) => component.getValues() }),
  'value-key': text({ property: 'valueKey', default: 'ID', rebuild: true }),
  'label-key': text({ property: 'labelKey', default: 'name', rebuild: true }),
  'checked-key': text({ property: 'checkedKey', default: 'on', rebuild: true }),
  search: bool({ rebuild: true }),
  height: number({ default: 280, rebuild: true }),
  'default-checked': bool({ property: 'defaultChecked', default: false, rebuild: true }),
  disabled: bool({ option: null, always: true, set: setChecklistDisabled }),
  name: text({ option: null, default: '' })
});

const DATEBOX_ATTRS = attributes({
  format: text({ default: '%d.%m.%Y', rebuild: true }),
  time: bool({ always: true, rebuild: true }),
  value: text({ option: null, default: null, normalize: normalizeDateValue, set: (component, value) => component.set(value, { silent: true }), get: (component, host) => dateValue(component.get(), Boolean(host.time)), serialize: serializeDateValue }),
  placeholder: text({ default: null, rebuild: true }),
  clearable: bool({ rebuild: true }),
  disabled: bool({ always: true, set: setDisabled }),
  required: bool({ option: null, always: true }),
  name: text({ option: null, default: '' })
});

const TIMEBOX_ATTRS = attributes({
  value: number({ default: 0, set: (component, value) => component.set(value, { silent: true }), get: (component) => component.get() }),
  unit: text({ default: 'minutes', rebuild: true }),
  seconds: bool({ always: true, rebuild: true }),
  signed: bool({ always: true, rebuild: true }),
  disabled: bool({ always: true, set: setDisabled }),
  name: text({ option: null, default: '' })
});

const SEARCH_ATTRS = attributes({
  value: text({ default: '', set: (component, value) => component.set(value, { silent: true }), get: (component) => component.get() }),
  placeholder: text({ default: '', set: (component, value) => { component.refs.input.placeholder = value; } }),
  clearable: bool({ rebuild: true }),
  debounce: number({ default: 250, rebuild: true })
});

const GROUPBOX_ATTRS = attributes({
  title: text({ default: '', set: (component, value) => component.setTitle(value) }),
  open: bool({ default: false, always: true, set: (component, value) => value ? component.open() : component.close(), get: (component) => component.isOpen() })
});

const TABBOX_ATTRS = attributes({
  tabs: json({ default: [], normalize: normalizeTabs, rebuild: true }),
  active: text({ default: null, set: (component, value) => { if (value !== null) component.openTab(value); }, get: (component) => component.getActive() }),
  'keep-alive': bool({ property: 'keepAlive', rebuild: true })
});

const TABLE_ATTRS = attributes({
  columns: json({ default: [], rebuild: true }),
  data: json({ default: [], set: (component, value) => component.setData(value), get: (component) => component.getData() }),
  'row-id': text({ property: 'rowId', default: 'ID', rebuild: true }),
  sort: json({ default: null, rebuild: true }),
  'sort-mode': text({ property: 'sortMode', default: 'local', rebuild: true }),
  selectable: text({ default: false, normalize: normalizeSelectable, rebuild: true }),
  'sticky-header': bool({ property: 'stickyHeader', rebuild: true }),
  height: text({ default: null, normalize: normalizeNumberOrString, rebuild: true }),
  'empty-text': text({ property: 'emptyText', default: null, rebuild: true }),
  zebra: bool({ rebuild: true })
});

const DIALOG_ATTRS = attributes({
  title: text({ default: '', set: (component, value) => component.setTitle(value) }),
  size: text({ default: 'md', normalize: normalizeNumberOrString, rebuild: true }),
  buttons: json({ default: [], set: (component, value) => component.setButtons(value) }),
  closable: bool({ rebuild: true }),
  open: bool({ option: null, default: false, always: true, set: (component, value) => value ? component.open() : component.close(), get: (component) => component.isOpen() })
});

const ELEMENTS = Object.freeze([
  ['toggle', Toggle, { formAssociated: true, attrs: TOGGLE_ATTRS }],
  ['check-button', CheckButton, { formAssociated: true, attrs: CHECK_BUTTON_ATTRS }],
  ['select', Select, { formAssociated: true, attrs: SELECT_ATTRS }],
  ['checklist', Checklist, { formAssociated: true, attrs: CHECKLIST_ATTRS }],
  ['datebox', Datebox, { formAssociated: true, attrs: DATEBOX_ATTRS }],
  ['timebox', Timebox, { formAssociated: true, attrs: TIMEBOX_ATTRS }],
  ['search', Search, { formAssociated: false, attrs: SEARCH_ATTRS }],
  ['groupbox', Groupbox, { formAssociated: false, attrs: GROUPBOX_ATTRS }],
  ['tabbox', Tabbox, { formAssociated: false, attrs: TABBOX_ATTRS }],
  ['table', Table, { formAssociated: false, attrs: TABLE_ATTRS }],
  ['dialog', Dialog, { formAssociated: false, attrs: DIALOG_ATTRS }]
]);

/**
 * Creates a light-DOM custom-element class backed by a Zx component.
 * Groupbox and Dialog wrappers adopt their host's initial children as component content;
 * other wrappers leave unrelated host children untouched and append their component root.
 *
 * @param {typeof import('../core/component.js').Component} ComponentClass Component constructor.
 * @param {ElementWrapperOptions} [wrapperOptions={}] Wrapper behavior.
 * @returns {typeof HTMLElement} Custom-element constructor.
 */
export function elementFor(ComponentClass, { formAssociated = false, attrs = {} } = {}) {
  const definitions = normalizeAttributes(attrs);
  const attributeNames = Object.freeze(Object.keys(definitions));
  const contentElement = ComponentClass === Groupbox || ComponentClass === Dialog;

  class ZxElement extends HTMLElement {
    static formAssociated = Boolean(formAssociated);

    /** @returns {string[]} Attributes observed by this wrapper. */
    static get observedAttributes() {
      return attributeNames;
    }

    constructor() {
      super();
      this._component = null;
      this._bridgeAbort = null;
      this._reflecting = new Set();
      this._propertyValues = new Map();
      this._defaults = null;
      this._contentNodes = null;
      this._disabledByForm = false;
      this._applying = false;
      this._internals = formAssociated && typeof this.attachInternals === 'function' ? this.attachInternals() : null;
    }

    /** Instantiates and mounts the backing component. @returns {void} */
    connectedCallback() {
      if (this._component) return;
      this._upgradeProperties(definitions);
      if (contentElement && this._contentNodes === null) this._contentNodes = Array.from(this.childNodes);
      if (formAssociated && this._defaults === null) this._captureDefaults(definitions);
      this._createComponent(ComponentClass, definitions, contentElement);
    }

    /** Destroys the backing component and all bridged listeners. @returns {void} */
    disconnectedCallback() {
      this._destroyComponent();
    }

    /**
     * Applies a reflected attribute change through its mapped component setter.
     * @param {string} name Attribute name.
     * @param {string|null} _oldValue Previous serialized value.
     * @param {string|null} newValue Next serialized value.
     * @returns {void}
     */
    attributeChangedCallback(name, _oldValue, newValue) {
      if (this._reflecting.has(name)) return;
      const definition = definitions[name];
      if (!definition) return;
      const coerced = coerceAttribute(newValue, definition.type);
      if (coerced === INVALID_ATTRIBUTE) return;
      this._propertyValues.delete(definition.property);
      const value = coerced === undefined ? cloneDefault(definition.default) : coerced;
      this._applyValue(name, definition, value);
    }

    /**
     * Applies effective disabled state supplied by a disabled fieldset or form owner.
     * @param {boolean} disabled Effective form-disabled state.
     * @returns {void}
     */
    formDisabledCallback(disabled) {
      this._disabledByForm = Boolean(disabled);
      this._syncEffectiveDisabled(definitions);
      this._syncFormState(ComponentClass);
    }

    /** Restores the control value captured at initial connection. @returns {void} */
    formResetCallback() {
      if (!this._defaults) return;
      const property = formControlProperty(ComponentClass);
      if (!property || !this._defaults.has(property)) return;
      this._applyControlValue(definitions, property, cloneDefault(this._defaults.get(property)));
    }

    /**
     * Restores browser-saved form state.
     * @param {File|string|FormData|null} state Saved state supplied by the browser.
     * @param {'restore'|'autocomplete'} _mode Restoration reason.
     * @returns {void}
     */
    formStateRestoreCallback(state, _mode) {
      if (typeof state !== 'string') return;
      const restored = restoredFormValue(ComponentClass, state);
      if (restored === INVALID_ATTRIBUTE) return;
      const property = formControlProperty(ComponentClass);
      if (property) this._applyControlValue(definitions, property, restored);
    }

    /** @returns {InstanceType<typeof import('../core/component.js').Component>|null} Backing component. */
    get component() {
      return this._component;
    }

    /** @returns {HTMLFormElement|null} Associated native form. */
    get form() {
      return this._internals?.form ?? null;
    }

    /** @returns {NodeList|null} Labels associated with this form control. */
    get labels() {
      return this._internals?.labels ?? null;
    }

    /** @returns {ValidityState|null} Current constraint-validation state. */
    get validity() {
      return this._internals?.validity ?? null;
    }

    /** @returns {string} Current constraint-validation message. */
    get validationMessage() {
      return this._internals?.validationMessage ?? '';
    }

    /** @returns {boolean} Whether this control is a constraint-validation candidate. */
    get willValidate() {
      return this._internals?.willValidate ?? false;
    }

    /** @returns {boolean} Whether the form control satisfies its constraints. */
    checkValidity() {
      return this._internals?.checkValidity() ?? true;
    }

    /** @returns {boolean} Whether the form control satisfies its constraints. */
    reportValidity() {
      return this._internals?.reportValidity() ?? true;
    }

    /** @param {Record<string, ElementAttribute>} defs @returns {void} */
    _upgradeProperties(defs) {
      for (const definition of Object.values(defs)) {
        const property = definition.property;
        if (!Object.prototype.hasOwnProperty.call(this, property)) continue;
        const value = this[property];
        delete this[property];
        this[property] = value;
      }
    }

    /** @param {Record<string, ElementAttribute>} defs @returns {void} */
    _captureDefaults(defs) {
      this._defaults = new Map();
      const property = formControlProperty(ComponentClass);
      if (property) {
        const entry = Object.values(defs).find((definition) => definition.property === property);
        if (entry) this._defaults.set(property, cloneDefault(this._readProperty(entry)));
      }
    }

    /**
     * @param {typeof import('../core/component.js').Component} Constructor
     * @param {Record<string, ElementAttribute>} defs
     * @param {boolean} adoptsContent
     * @returns {void}
     */
    _createComponent(Constructor, defs, adoptsContent) {
      const options = {};
      for (const [name, definition] of Object.entries(defs)) {
        const supplied = this._propertyValues.has(definition.property) || this.hasAttribute(name) || definition.always;
        if (!supplied || definition.option === null) continue;
        const value = this._currentValue(name, definition);
        if (value === INVALID_ATTRIBUTE || value === undefined) continue;
        options[definition.option] = normalizeValue(definition, value, this);
      }

      let content = null;
      if (adoptsContent) {
        content = document.createDocumentFragment();
        content.append(...this._contentNodes);
        options.content = content;
      }

      const component = new Constructor(null, options);
      this._component = component;
      if (ComponentClass === Groupbox && content) component.setContent(content);
      this.append(component.el);
      this._bridgeEvents(component, ComponentClass);

      for (const [name, definition] of Object.entries(defs)) {
        if (definition.option !== null || !definition.set) continue;
        const supplied = this._propertyValues.has(definition.property) || this.hasAttribute(name) || definition.always;
        if (!supplied) continue;
        const value = this._currentValue(name, definition);
        if (value !== INVALID_ATTRIBUTE && value !== undefined) this._applyValue(name, definition, value, true);
      }
      this._syncEffectiveDisabled(defs);
      this._syncFormState(ComponentClass);
    }

    /**
     * @param {InstanceType<typeof import('../core/component.js').Component>} component
     * @param {typeof import('../core/component.js').Component} Constructor
     * @returns {void}
     */
    _bridgeEvents(component, Constructor) {
      this._bridgeAbort?.abort();
      this._bridgeAbort = new AbortController();
      for (const type of COMPONENT_EVENTS) {
        component.on(type, (event) => {
          if (this._applying) return;
          this._syncFormState(Constructor);
          const bridged = new CustomEvent(`zx-${type}`, {
            detail: event.detail ?? {},
            bubbles: true,
            composed: true,
            cancelable: true
          });
          this.dispatchEvent(bridged);
          if (bridged.defaultPrevented) event.preventDefault();
        });
        component.el.addEventListener(`zx-${type}`, (event) => event.stopPropagation(), {
          signal: this._bridgeAbort.signal
        });
      }
    }

    /** @returns {void} */
    _destroyComponent() {
      this._bridgeAbort?.abort();
      this._bridgeAbort = null;
      if (!this._component) return;
      this._component.destroy();
      this._component = null;
    }

    /** @param {Record<string, ElementAttribute>} defs @param {boolean} adoptsContent @returns {void} */
    _rebuildComponent(defs, adoptsContent = contentElement) {
      if (!this._component) return;
      if (adoptsContent && this._contentNodes) {
        const fragment = document.createDocumentFragment();
        fragment.append(...this._contentNodes);
      }
      this._destroyComponent();
      this._createComponent(ComponentClass, defs, adoptsContent);
    }

    /**
     * @param {string} name
     * @param {ElementAttribute} definition
     * @param {unknown} value
     * @param {boolean} [initial=false]
     * @returns {void}
     */
    _applyValue(name, definition, value, initial = false) {
      if (!this._component) return;
      if (definition.rebuild && !initial) {
        this._rebuildComponent(definitions);
        return;
      }
      if (!definition.set) {
        this._syncFormState(ComponentClass);
        return;
      }
      this._applying = true;
      try {
        definition.set(this._component, normalizeValue(definition, value, this), this);
      } finally {
        this._applying = false;
      }
      if (name !== 'disabled') this._syncEffectiveDisabled(definitions);
      this._syncFormState(ComponentClass);
    }

    /** @param {Record<string, ElementAttribute>} defs @returns {void} */
    _syncEffectiveDisabled(defs) {
      if (!this._component || !defs.disabled?.set) return;
      this._applying = true;
      try {
        defs.disabled.set(this._component, this.hasAttribute('disabled') || this._disabledByForm, this);
      } finally {
        this._applying = false;
      }
    }

    /** @param {typeof import('../core/component.js').Component} Constructor @returns {void} */
    _syncFormState(Constructor) {
      if (!this._internals || !this._component) return;
      const { formValue, state, empty } = currentFormValue(Constructor, this._component, this);
      this._internals.setFormValue(formValue, state);
      if ((Constructor === Select || Constructor === Datebox) && this.hasAttribute('required') && empty) {
        const message = Constructor === Datebox ? 'Please enter a date.' : 'Please select a value.';
        this._internals.setValidity({ valueMissing: true }, message, this._component.refs.input);
      } else {
        this._internals.setValidity({});
      }
    }

    /**
     * @param {Record<string, ElementAttribute>} defs
     * @param {string} property
     * @param {unknown} value
     * @returns {void}
     */
    _applyControlValue(defs, property, value) {
      const entry = Object.entries(defs).find(([, definition]) => definition.property === property);
      if (!entry) return;
      this._applyValue(entry[0], entry[1], value);
    }

    /** @param {string} name @param {ElementAttribute} definition @returns {unknown} */
    _currentValue(name, definition) {
      if (this._propertyValues.has(definition.property)) return this._propertyValues.get(definition.property);
      const value = coerceAttribute(this.getAttribute(name), definition.type);
      return value === undefined ? definition.default : value;
    }

    /** @param {ElementAttribute} definition @returns {unknown} */
    _readProperty(definition) {
      if (this._component && definition.get) return definition.get(this._component, this);
      if (this._propertyValues.has(definition.property)) return this._propertyValues.get(definition.property);
      const value = coerceAttribute(this.getAttribute(definition.attribute), definition.type);
      if (value === INVALID_ATTRIBUTE || value === undefined) return cloneDefault(definition.default);
      return value;
    }

    /** @param {ElementAttribute} definition @param {unknown} value @returns {void} */
    _writeProperty(definition, value) {
      this._propertyValues.set(definition.property, value);
      const serialized = definition.serialize ?
        definition.serialize(value, this) : serializeAttribute(value, definition.type);
      if (serialized !== INVALID_ATTRIBUTE) {
        this._reflecting.add(definition.attribute);
        try {
          if (serialized === null) this.removeAttribute(definition.attribute);
          else this.setAttribute(definition.attribute, serialized);
        } finally {
          this._reflecting.delete(definition.attribute);
        }
      }
      this._applyValue(definition.attribute, definition, value);
    }
  }

  for (const definition of Object.values(definitions)) {
    if (Object.prototype.hasOwnProperty.call(ZxElement.prototype, definition.property)) continue;
    Object.defineProperty(ZxElement.prototype, definition.property, {
      configurable: true,
      enumerable: true,
      get() { return this._readProperty(definition); },
      set(value) { this._writeProperty(definition, value); }
    });
  }

  return ZxElement;
}

/**
 * Registers the supported Zx custom elements. Repeated calls and pre-registered names are safe.
 * This function is deliberately not called by the module.
 *
 * @param {string} [prefix='zx'] Custom-element name prefix.
 * @returns {void}
 */
export function defineElements(prefix = 'zx') {
  if (typeof customElements === 'undefined') {
    throw new Error('Custom elements are not available in this environment');
  }
  const normalizedPrefix = String(prefix).trim();
  for (const [suffix, Constructor, options] of ELEMENTS) {
    const name = `${normalizedPrefix}-${suffix}`;
    if (!customElements.get(name)) customElements.define(name, elementFor(Constructor, options));
  }
}

/** @param {ElementAttributeMap} attrs @returns {Readonly<Record<string, ElementAttribute>>} */
function normalizeAttributes(attrs) {
  const normalized = {};
  for (const [attribute, definition] of Object.entries(attrs)) {
    const details = typeof definition === 'string' ? { type: definition } : { ...definition };
    const property = details.property ?? camelCase(attribute);
    normalized[attribute] = Object.freeze({
      type: details.type ?? 'string',
      option: Object.prototype.hasOwnProperty.call(details, 'option') ? details.option : property,
      property,
      default: details.default,
      always: Boolean(details.always),
      rebuild: Boolean(details.rebuild),
      normalize: details.normalize,
      serialize: details.serialize,
      set: details.set,
      get: details.get,
      attribute
    });
  }
  return Object.freeze(normalized);
}

/** @param {Record<string, ElementAttribute>} value @returns {Readonly<Record<string, ElementAttribute>>} */
function attributes(value) {
  return normalizeAttributes(value);
}

/** @param {Partial<ElementAttribute>} [options={}] @returns {ElementAttribute} */
function text(options = {}) {
  return { type: 'string', ...options };
}

/** @param {Partial<ElementAttribute>} [options={}] @returns {ElementAttribute} */
function number(options = {}) {
  return { type: 'number', ...options };
}

/** @param {Partial<ElementAttribute>} [options={}] @returns {ElementAttribute} */
function bool(options = {}) {
  return { type: 'boolean', default: false, always: true, ...options };
}

/** @param {Partial<ElementAttribute>} [options={}] @returns {ElementAttribute} */
function json(options = {}) {
  return { type: 'json', ...options };
}

/** @param {string} value @returns {string} */
function camelCase(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

/** @param {ElementAttribute} definition @param {unknown} value @param {HTMLElement} host @returns {unknown} */
function normalizeValue(definition, value, host) {
  return definition.normalize ? definition.normalize(value, host) : value;
}

/** @param {any} component @param {boolean} disabled @returns {void} */
function setDisabled(component, disabled) {
  if (disabled) component.disable();
  else component.enable();
}

/** @param {any} component @param {boolean} disabled @returns {void} */
function setChecklistDisabled(component, disabled) {
  component.el.setAttribute('aria-disabled', String(disabled));
  if (component.refs.search) component.refs.search.disabled = disabled;
  for (const input of component.refs.list?.querySelectorAll('input') ?? []) input.disabled = disabled;
}

/** @param {unknown} value @returns {unknown} */
function normalizeFilter(value) {
  if (value === '' || value === 'true') return 'local';
  if (value === 'false') return false;
  return value;
}

/** @param {unknown} value @returns {unknown} */
function normalizeSelectable(value) {
  if (value === '' || value === 'true') return 'single';
  if (value === 'false') return false;
  return value;
}

/** @param {unknown} value @returns {unknown} */
function normalizeNumberOrString(value) {
  if (typeof value !== 'string' || value.trim() === '') return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

/** @param {unknown} value @returns {unknown} */
function normalizeTabs(value) {
  if (!Array.isArray(value)) return value;
  return value.map((tab) => {
    if (!tab || typeof tab !== 'object' || isNode(tab.content) || typeof tab.content === 'function') return tab;
    return { ...tab, content: document.createTextNode(String(tab.content ?? '')) };
  });
}

/** @param {unknown} value @returns {boolean} */
function isNode(value) {
  return Boolean(value && typeof value === 'object' && typeof value.nodeType === 'number');
}

/** @param {unknown} value @returns {unknown} */
function normalizeDateValue(value) {
  if (typeof value !== 'string') return value;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return parseDate(value, '%Y-%m-%dT%H:%M');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return parseDate(value, '%Y-%m-%d');
  return value;
}

/** @param {unknown} value @param {HTMLElement} host @returns {string|null|typeof INVALID_ATTRIBUTE} */
function serializeDateValue(value, host) {
  if (value instanceof Date) return dateValue(value, Boolean(host.time));
  return serializeAttribute(value, 'string');
}

/** @param {Date|null|unknown} value @param {boolean} includesTime @returns {string} */
function dateValue(value, includesTime) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  return formatDate(value, includesTime ? '%Y-%m-%dT%H:%M' : '%Y-%m-%d');
}

/** @param {typeof import('../core/component.js').Component} Constructor @returns {string|null} */
function formControlProperty(Constructor) {
  if (Constructor === Toggle || Constructor === CheckButton) return 'checked';
  if ([Select, Checklist, Datebox, Timebox].includes(Constructor)) return 'value';
  return null;
}

/**
 * @param {typeof import('../core/component.js').Component} Constructor
 * @param {any} component
 * @param {HTMLElement} host
 * @returns {{formValue: string|null, state: string, empty: boolean}}
 */
function currentFormValue(Constructor, component, host) {
  if (Constructor === Toggle || Constructor === CheckButton) {
    const checked = component.get();
    let configured = Constructor === Toggle ? true : 'on';
    if (host._propertyValues.has('value')) configured = host._propertyValues.get('value');
    else if (host.hasAttribute('value')) configured = host.getAttribute('value');
    return { formValue: checked ? String(configured) : null, state: String(checked), empty: !checked };
  }
  if (Constructor === Select) {
    const value = component.value;
    return { formValue: value === null ? null : String(value), state: JSON.stringify(value), empty: value === null || value === '' };
  }
  if (Constructor === Checklist) {
    const value = JSON.stringify(component.getValues());
    return { formValue: value, state: value, empty: value === '[]' };
  }
  if (Constructor === Datebox) {
    const value = dateValue(component.get(), Boolean(host.time));
    return { formValue: value || null, state: value, empty: value === '' };
  }
  const value = String(component.get());
  return { formValue: value, state: value, empty: false };
}

/** @param {typeof import('../core/component.js').Component} Constructor @param {string} state @returns {unknown|typeof INVALID_ATTRIBUTE} */
function restoredFormValue(Constructor, state) {
  if (Constructor === Toggle || Constructor === CheckButton) return state === 'true';
  if (Constructor === Select || Constructor === Checklist) return coerceAttribute(state, 'json');
  if (Constructor === Timebox) return coerceAttribute(state, 'number');
  return state;
}

/** @param {unknown} value @returns {unknown} */
function cloneDefault(value) {
  if (Array.isArray(value)) return value.slice();
  if (value instanceof Date) return new Date(value.getTime());
  return value;
}
