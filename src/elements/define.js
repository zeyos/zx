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
import {
  attributes, bool, createCallQueue, forwardedResult, isDomCall, json, normalizeAttributes,
  normalizeNumberOrString, normalizeSelectable, number, text
} from './definitions.js';
import { KIT_ELEMENTS } from './kit.js';
import { INVALID_ATTRIBUTE, coerceAttribute, serializeAttribute } from './reflect.js';

/** @typedef {import('./definitions.js').ElementAttribute} ElementAttribute */
/** @typedef {import('./definitions.js').ElementAttributeMap} ElementAttributeMap */
/** @typedef {import('./definitions.js').ElementMethodMap} ElementMethodMap */
/**
 * @typedef {Object} ElementWrapperOptions
 * @property {boolean} [formAssociated=false] Whether the element participates in native forms.
 * @property {ElementAttributeMap} [attrs={}] Reflected attribute definitions.
 * @property {string[]|null} [events=null] The component's events. Declared, each also reaches the
 * host under its plain name, and no DOM event of that name passes through from inside the
 * component. Left out, the common `zx-*` set is bridged.
 * @property {ElementMethodMap|null} [methods=null] Component methods the element forwards. Declared,
 * the element also carries its live values across a rebuild and across removal.
 */

const COMPONENT_EVENTS = Object.freeze([
  'change', 'input', 'submit', 'clear', 'open', 'close', 'cancel', 'invalid',
  'query', 'loaded', 'rowclick', 'rowdblclick', 'sort', 'selectionchange', 'datachange'
]);

/** Form-control accessors every wrapper carries; an element that is no form control may reuse the names. */
const FORM_ACCESSORS = Object.freeze(['form', 'labels', 'validity', 'validationMessage', 'willValidate']);

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
  'display-format': text({ property: 'displayFormat', default: null, rebuild: true }),
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
  variant: text({ default: 'divided', rebuild: true }),
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
  ['dialog', Dialog, { formAssociated: false, attrs: DIALOG_ATTRS }],
  ...KIT_ELEMENTS
]);

/**
 * Creates a light-DOM custom-element class backed by a Zx component.
 * Groupbox and Dialog wrappers adopt their host's initial children as component content;
 * other wrappers leave unrelated host children untouched and append their component root.
 *
 * A wrapper that declares `methods` forwards them: `element.upsert(item)` calls the component, and
 * a call made while no component exists is queued and runs, in order, once it does. A forwarded
 * call returns the component's answer, with the component itself replaced by the element; a
 * queued call returns undefined. A wrapper that declares `events` dispatches each one on the host
 * under its plain name as well as `zx-<type>`. The plain event does not bubble; `zx-<type>` does.
 *
 * @param {typeof import('../core/component.js').Component} ComponentClass Component constructor.
 * @param {ElementWrapperOptions} [wrapperOptions={}] Wrapper behavior.
 * @returns {typeof HTMLElement} Custom-element constructor.
 */
export function elementFor(ComponentClass, {
  formAssociated = false, attrs = {}, events = null, methods = null
} = {}) {
  const definitions = normalizeAttributes(attrs);
  const attributeNames = Object.freeze(
    Object.keys(definitions).filter((name) => definitions[name].observed));
  const byProperty = new Map(Object.values(definitions).map((definition) => [definition.property, definition]));
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
      this._calls = createCallQueue();
      this._internals = formAssociated && typeof this.attachInternals === 'function' ? this.attachInternals() : null;
    }

    /** Instantiates and mounts the backing component, then runs the calls queued for it. @returns {void} */
    connectedCallback() {
      if (this._component) return;
      this._upgradeProperties(definitions);
      if (contentElement && this._contentNodes === null) this._contentNodes = Array.from(this.childNodes);
      if (formAssociated && this._defaults === null) this._captureDefaults(definitions);
      this._createComponent(ComponentClass, definitions, contentElement);
      this._calls.drain((name, args) => this._invoke(name, args), () => this._component !== null);
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
        if (!this._supplied(name, definition) || definition.option === null) continue;
        const value = this._currentValue(name, definition);
        if (value === INVALID_ATTRIBUTE || value === undefined) continue;
        options[definition.option] = normalizeValue(definition, value, this);
      }
      // As options, so an event fired during construction (a chart's `ready`) is heard as well.
      for (const type of events ?? []) {
        options[`on${type}`] = (event) => this._dispatchBridged(Constructor, type, event, true);
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
        if (!this._supplied(name, definition)) continue;
        const value = this._currentValue(name, definition);
        if (value !== INVALID_ATTRIBUTE && value !== undefined) this._applyValue(name, definition, value, true);
      }
      this._syncEffectiveDisabled(defs);
      this._syncFormState(ComponentClass);
    }

    /**
     * @param {string} name
     * @param {ElementAttribute} definition
     * @returns {boolean} Whether a value was given for this definition, or its default always applies.
     */
    _supplied(name, definition) {
      return this._propertyValues.has(definition.property)
        || (definition.observed && this.hasAttribute(name))
        || definition.always;
    }

    /**
     * @param {InstanceType<typeof import('../core/component.js').Component>} component
     * @param {typeof import('../core/component.js').Component} Constructor
     * @returns {void}
     */
    _bridgeEvents(component, Constructor) {
      this._bridgeAbort?.abort();
      this._bridgeAbort = new AbortController();
      const stop = (event) => event.stopPropagation();
      const { signal } = this._bridgeAbort;
      for (const type of events ?? COMPONENT_EVENTS) {
        component.el.addEventListener(`zx-${type}`, stop, { signal });
        if (events) component.el.addEventListener(type, stop, { signal });
        else component.on(type, (event) => this._dispatchBridged(Constructor, type, event, false));
      }
    }

    /**
     * Re-dispatches a component event on the host. Either copy being cancelled cancels the original.
     * @param {typeof import('../core/component.js').Component} Constructor
     * @param {string} type Component event name.
     * @param {Event & {detail?: Record<string, unknown>}} event Component event.
     * @param {boolean} plain Whether the plain name is dispatched too.
     * @returns {void}
     */
    _dispatchBridged(Constructor, type, event, plain) {
      if (this._applying) return;
      this._syncFormState(Constructor);
      const detail = event.detail ?? {};
      const bridged = new CustomEvent(`zx-${type}`, { detail, bubbles: true, composed: true, cancelable: true });
      this.dispatchEvent(bridged);
      if (bridged.defaultPrevented) event.preventDefault();
      if (!plain) return;
      const named = new CustomEvent(type, { detail, cancelable: true });
      this.dispatchEvent(named);
      if (named.defaultPrevented) event.preventDefault();
    }

    /**
     * Runs a forwarded call, or queues it until a component exists.
     * @param {string} name Method name.
     * @param {unknown[]} args Call arguments.
     * @returns {unknown}
     */
    _forward(name, args) {
      if (this._component) return this._invoke(name, args);
      this._calls.push(name, args);
      return undefined;
    }

    /** @param {string} name @param {unknown[]} args @returns {unknown} */
    _invoke(name, args) {
      const component = this._component;
      const result = component[name](...args);
      this._recordProperties(methods?.[name]?.(args));
      return forwardedResult(result, component, this);
    }

    /**
     * Brings properties in step with what a forwarded method changed, without applying it again.
     * @param {Record<string, unknown>|null|undefined} changed Values by property name.
     * @returns {void}
     */
    _recordProperties(changed) {
      for (const [property, value] of Object.entries(changed ?? {})) {
        const definition = byProperty.get(property);
        if (!definition || value === undefined) continue;
        this._propertyValues.set(property, value);
        this._reflectProperty(definition, value);
      }
    }

    /**
     * Copies the component's live values to the host, so the next component starts where this one
     * stopped. Only an element that forwards methods can drift from what it was given.
     * @param {ElementAttribute|null} changed The definition being replaced, which keeps its new value.
     * @returns {void}
     */
    _keepLiveValues(changed) {
      if (!methods) return;
      for (const definition of Object.values(definitions)) {
        if (!definition.get || definition === changed) continue;
        this._propertyValues.set(definition.property, definition.get(this._component, this));
      }
    }

    /** @param {ElementAttribute|null} [changed=null] @returns {void} */
    _destroyComponent(changed = null) {
      this._bridgeAbort?.abort();
      this._bridgeAbort = null;
      if (!this._component) return;
      this._keepLiveValues(changed);
      this._component.destroy();
      this._component = null;
    }

    /**
     * @param {Record<string, ElementAttribute>} defs
     * @param {boolean} [adoptsContent]
     * @param {ElementAttribute|null} [changed=null] The definition that asked for the rebuild.
     * @returns {void}
     */
    _rebuildComponent(defs, adoptsContent = contentElement, changed = null) {
      if (!this._component) return;
      if (adoptsContent && this._contentNodes) {
        const fragment = document.createDocumentFragment();
        fragment.append(...this._contentNodes);
      }
      this._destroyComponent(changed);
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
        this._rebuildComponent(definitions, contentElement, definition);
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
        const message = this._component.msg(Constructor === Datebox ? 'datebox.required' : 'select.required');
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

    /** @param {ElementAttribute} definition @returns {unknown} The attribute's value; undefined without one. */
    _attributeValue(definition) {
      return definition.observed
        ? coerceAttribute(this.getAttribute(definition.attribute), definition.type)
        : undefined;
    }

    /** @param {string} name @param {ElementAttribute} definition @returns {unknown} */
    _currentValue(name, definition) {
      if (this._propertyValues.has(definition.property)) return this._propertyValues.get(definition.property);
      const value = this._attributeValue(definition);
      return value === undefined ? definition.default : value;
    }

    /** @param {ElementAttribute} definition @returns {unknown} */
    _readProperty(definition) {
      if (this._component && definition.get) return definition.get(this._component, this);
      if (this._propertyValues.has(definition.property)) return this._propertyValues.get(definition.property);
      const value = this._attributeValue(definition);
      if (value === INVALID_ATTRIBUTE || value === undefined) return cloneDefault(definition.default);
      return value;
    }

    /** @param {ElementAttribute} definition @param {unknown} value @returns {void} */
    _writeProperty(definition, value) {
      this._propertyValues.set(definition.property, value);
      this._reflectProperty(definition, value);
      this._applyValue(definition.attribute, definition, value);
    }

    /** @param {ElementAttribute} definition @param {unknown} value @returns {void} */
    _reflectProperty(definition, value) {
      if (!definition.reflect) return;
      const serialized = definition.serialize ?
        definition.serialize(value, this) : serializeAttribute(value, definition.type);
      if (serialized === INVALID_ATTRIBUTE) return;
      this._reflecting.add(definition.attribute);
      try {
        if (serialized === null) this.removeAttribute(definition.attribute);
        else this.setAttribute(definition.attribute, serialized);
      } finally {
        this._reflecting.delete(definition.attribute);
      }
    }
  }

  for (const definition of Object.values(definitions)) {
    const owned = Object.prototype.hasOwnProperty.call(ZxElement.prototype, definition.property);
    if (owned && (formAssociated || !FORM_ACCESSORS.includes(definition.property))) continue;
    Object.defineProperty(ZxElement.prototype, definition.property, {
      configurable: true,
      enumerable: true,
      get() { return this._readProperty(definition); },
      set(value) { this._writeProperty(definition, value); }
    });
  }

  for (const name of Object.keys(methods ?? {})) {
    Object.defineProperty(ZxElement.prototype, name, {
      configurable: true,
      writable: true,
      value(...args) {
        return isDomCall(name, args) ? HTMLElement.prototype[name].apply(this, args) : this._forward(name, args);
      }
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

/** @param {unknown} value @returns {unknown} A copy, so a caller can never reach the shared default. */
function cloneDefault(value) {
  if (Array.isArray(value)) return value.map(cloneDefault);
  if (value instanceof Date) return new Date(value.getTime());
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneDefault(entry)]));
  }
  return value;
}
