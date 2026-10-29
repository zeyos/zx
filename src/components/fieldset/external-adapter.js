import { isElement } from '../../core/util.js';

/** @typedef {import('../field/field.js').Field} Field */
/** @typedef {import('../field/field.js').FieldAdapter} FieldAdapter */

/**
 * An element or component a Fieldset adopts with `addField(id, source)`: anything that renders
 * into an element. Components are read through the methods they have, elements through their
 * native properties.
 * @typedef {Element|{el?: Element, toElement?: () => Element}} ExternalSource
 */

/**
 * The value accessor pairs the library's components use, in the order they are tried. A reader
 * counts only when it takes no required argument (`Fieldset.getValue(id)` is not a reader), a
 * writer of another pair only when the value is its sole required argument.
 * - `getValue/setValue`: Field, CodeEditor, Filter, SortControl, Toggle (`getValue()` is the
 *   configured on-value or `false`, the same as the `toggle` field type reads).
 * - `get/set`: NumberField, Select, Slider, Rating, CheckButton, Datebox, Timebox, Search,
 *   CopyInput, DatePicker and the other pickers.
 * - `getValues/setValues`: Checklist, TagPicker, ValueList, MultiValueEditor, Fieldset, Form.
 * - `isChecked/setChecked`: boolean controls that name their state that way.
 * @type {ReadonlyArray<readonly [string, string]>}
 */
export const VALUE_METHODS = Object.freeze([
  Object.freeze(['getValue', 'setValue']),
  Object.freeze(['get', 'set']),
  Object.freeze(['getValues', 'setValues']),
  Object.freeze(['isChecked', 'setChecked'])
]);

/** Value properties a component may expose instead of methods, in the order they are tried. */
const VALUE_PROPERTIES = Object.freeze(['value', 'values', 'checked']);

/** Form controls the fallback disables or makes read-only inside a plain wrapper element. */
const CONTROLS = 'input, select, textarea, button';
const TEXT_CONTROLS = 'input, textarea';

/**
 * The element a source renders into.
 * @param {ExternalSource} source Element or component.
 * @returns {Element}
 */
export function externalElement(source) {
  if (isElement(source)) return /** @type {Element} */ (source);
  const component = /** @type {{el?: Element, toElement?: () => Element}} */ (source);
  if (typeof component.toElement === 'function') return component.toElement();
  if (isElement(component.el)) return /** @type {Element} */ (component.el);
  throw new TypeError('External field source must be an Element or a Component');
}

/**
 * Reads the current value of an element or component through the first value dialect it
 * supports (see {@link VALUE_METHODS}), then a `value`, `values`, or `checked` property, then the
 * element itself: `checked` for a checkbox or radio, `value` for any other control. Null when
 * the source has no value at all.
 * @param {ExternalSource} source Element or component.
 * @returns {unknown}
 */
export function readExternalValue(source) {
  return valueAccess(source, externalElement(source)).get();
}

/**
 * Reports whether an element or component is disabled: its `isDisabled()`, a `disabled`
 * property, the element's own `disabled`, an `aria-disabled="true"` or `data-disabled` root, or
 * a wrapper whose every form control is disabled.
 * @param {ExternalSource} source Element or component.
 * @returns {boolean}
 */
export function readExternalDisabled(source) {
  const el = externalElement(source);
  const component = isElement(source) ? null : /** @type {Record<string, any>} */ (source);
  if (component && callable(component, 'isDisabled', 0)) return Boolean(component.isDisabled());
  if (component && typeof component.disabled === 'boolean') return component.disabled;
  if (hasNativeProperty(el, 'disabled')) return Boolean(/** @type {any} */ (el).disabled) || el.hasAttribute('disabled');
  if (el.getAttribute('aria-disabled') === 'true') return true;
  const flag = el.getAttribute('data-disabled');
  if (flag !== null && flag !== 'false') return true;
  const controls = [...el.querySelectorAll(CONTROLS)];
  return controls.length > 0 && controls.every((control) => /** @type {any} */ (control).disabled);
}

/**
 * Reports whether an element or component is read-only: a `readonly`/`readOnly` property, the
 * element's own `readOnly`, or an `aria-readonly="true"` or `data-readonly` root.
 * @param {ExternalSource} source Element or component.
 * @returns {boolean}
 */
export function readExternalReadonly(source) {
  const el = externalElement(source);
  const component = isElement(source) ? null : /** @type {Record<string, any>} */ (source);
  for (const name of ['readonly', 'readOnly']) {
    if (component && typeof component[name] === 'boolean') return component[name];
  }
  if (hasNativeProperty(el, 'readOnly')) return Boolean(/** @type {any} */ (el).readOnly) || el.hasAttribute('readonly');
  if (el.getAttribute('aria-readonly') === 'true') return true;
  const flag = el.getAttribute('data-readonly');
  return flag !== null && flag !== 'false';
}

/**
 * Builds the Field adapter for an element or component that is not a registered field type.
 *
 * Values go through the source's own accessors ({@link readExternalValue}); disabling through
 * `setDisabled(bool)`, then `enable()`/`disable()`, then a `disabled` property, and only then the
 * DOM — the element's `disabled`, or for a plain wrapper `aria-disabled` plus `disabled` on every
 * form control inside it. Read-only goes through `setReadonly(bool)`/`setReadOnly(bool)`, a
 * `readonly`/`readOnly` property, or the element's own `readOnly`.
 *
 * Writes pass the caller's options to the component: `Field.setValue(v)` or
 * `Fieldset.setValues(values)` without `silent` lets the component emit its own `change` to its
 * own listeners, while the field emits one `change` for the write; with `silent` neither does.
 *
 * Given the field, a component's own `change` event becomes the field's `change`, and the native
 * `change` its inner controls bubble is dropped unless it carries a value the component did not
 * already report — so one edit is one field `change`, whether the component reports it, its
 * input does, or (Search, CopyInput) only its input does.
 *
 * `destroy()` puts the element back where it was found and undoes what the adapter changed:
 * attributes, the native value, disabled and read-only state.
 * @param {ExternalSource} source Element or component to adopt.
 * @param {Field|null} [field=null] The field the adapter serves; needed to forward events. Its
 *   `listen()` owns every listener the adapter adds, so destroying the field removes them.
 * @returns {FieldAdapter}
 */
export function externalAdapter(source, field = null) {
  const el = externalElement(source);
  const component = isElement(source) ? null : /** @type {Record<string, any>} */ (source);
  const parent = el.parentNode;
  const next = el.nextSibling;
  const attributes = new Map(['id', 'aria-labelledby', 'aria-describedby', 'aria-disabled', 'aria-invalid']
    .map((name) => [name, el.getAttribute(name)]));
  const native = component === null;
  const originalValue = native && hasNativeProperty(el, 'value') ? /** @type {any} */ (el).value : undefined;
  const originalChecked = native && isCheckable(el) ? /** @type {any} */ (el).checked : undefined;
  const originalDisabled = readExternalDisabled(source);
  const originalReadonly = readExternalReadonly(source);
  /** @type {Map<Element, {disabled?: boolean, readOnly?: boolean}>} */
  const poked = new Map();
  const value = valueAccess(source, el);
  const disabled = disabledAccess(component, el, poked);
  const readonly = readonlyAccess(component, el, poked);
  let lastDisabled = originalDisabled;
  let lastReadonly = originalReadonly;
  let setting = false;
  let reported = value.get();

  if (field && component && typeof component.addEventListener === 'function') {
    // Through the field's `listen()`, so destroying the field unsubscribes. A write through
    // `set()` is not forwarded: the Field reports that one itself.
    field.listen(/** @type {any} */ (component), 'change', () => {
      if (setting) return;
      reported = value.get();
      field.emit('change', { value: reported });
    });
    // Registered before the Field's own `change` listener on the same element, so a native
    // change the component already reported never reaches it.
    field.listen(el, 'change', (event) => {
      const current = value.get();
      if (sameValue(current, reported)) event.stopImmediatePropagation();
      else reported = current;
    });
  }

  /** @type {FieldAdapter} */
  const adapter = {
    el,
    get: () => value.get(),
    set: (next, options) => {
      setting = true;
      try { value.set(next, options); }
      finally { setting = false; }
      reported = value.get();
    },
    focus: () => {
      if (component && callable(component, 'focus', 0)) component.focus();
      else if (typeof (/** @type {any} */ (el).focus) === 'function') /** @type {any} */ (el).focus();
    },
    setDisabled: (state) => {
      lastDisabled = Boolean(state);
      disabled(lastDisabled);
    },
    destroy: () => {
      if (lastReadonly !== originalReadonly && readonly) readonly(originalReadonly);
      if (lastDisabled !== originalDisabled) disabled(originalDisabled);
      for (const [control, state] of poked) {
        if (state.disabled !== undefined) /** @type {any} */ (control).disabled = state.disabled;
        if (state.readOnly !== undefined) /** @type {any} */ (control).readOnly = state.readOnly;
      }
      poked.clear();
      for (const [name, saved] of attributes) {
        if (saved === null) el.removeAttribute(name);
        else el.setAttribute(name, saved);
      }
      if (originalValue !== undefined) /** @type {any} */ (el).value = originalValue;
      if (originalChecked !== undefined) /** @type {any} */ (el).checked = originalChecked;
      if (parent) parent.insertBefore(el, next?.parentNode === parent ? next : null);
      else el.remove();
    }
  };
  if (readonly) {
    adapter.setReadonly = (state) => {
      lastReadonly = Boolean(state);
      readonly(lastReadonly);
    };
  }
  return adapter;
}

/**
 * The value reader and writer for a source: the first {@link VALUE_METHODS} pair whose reader
 * exists (its own writer first, then any other dialect's), then a value property, then the
 * element.
 * @param {ExternalSource} source Element or component.
 * @param {Element} el Its element.
 * @returns {{get: () => unknown, set: (value: unknown, options?: {silent?: boolean}) => void}}
 */
function valueAccess(source, el) {
  const component = isElement(source) ? null : /** @type {Record<string, any>} */ (source);
  if (component) {
    const pair = VALUE_METHODS.find(([reader]) => callable(component, reader, 0));
    // The pair's own writer whatever its signature; another dialect's only when the value is its
    // sole required argument.
    const writer = !pair ? undefined : callable(component, pair[1], 2)
      ? pair[1]
      : VALUE_METHODS.map(([, name]) => name).find((name) => callable(component, name, 1));
    if (pair) {
      return {
        get: () => component[pair[0]](),
        // The caller's options pass through: a write that is not silent reaches the component's
        // own `change` listeners too, and the adapter does not forward it a second time.
        set: (next, options = {}) => {
          if (writer) component[writer](next, { ...options, silent: Boolean(options.silent) });
        }
      };
    }
    const property = VALUE_PROPERTIES.find((name) => name in component);
    if (property) {
      return {
        get: () => component[property],
        set: (next) => { component[property] = next; }
      };
    }
  }
  if (isCheckable(el)) {
    return {
      get: () => Boolean(/** @type {any} */ (el).checked),
      set: (next) => { /** @type {any} */ (el).checked = Boolean(next); }
    };
  }
  if (hasNativeProperty(el, 'value')) {
    return {
      get: () => /** @type {any} */ (el).value,
      set: (next) => { /** @type {any} */ (el).value = next == null ? '' : next; }
    };
  }
  return { get: () => null, set: () => {} };
}

/**
 * The disabling dialect for a source.
 * @param {Record<string, any>|null} component Component, or null for a plain element.
 * @param {Element} el Its element.
 * @param {Map<Element, {disabled?: boolean, readOnly?: boolean}>} poked Original states of the
 *   controls the DOM fallback touched.
 * @returns {(disabled: boolean) => void}
 */
function disabledAccess(component, el, poked) {
  if (component && callable(component, 'setDisabled', 1)) return (state) => component.setDisabled(state);
  if (component && callable(component, 'enable', 0) && callable(component, 'disable', 0)) {
    return (state) => (state ? component.disable() : component.enable());
  }
  if (component && typeof component.disabled === 'boolean') return (state) => { component.disabled = state; };
  if (hasNativeProperty(el, 'disabled')) return (state) => { /** @type {any} */ (el).disabled = state; };
  return (state) => {
    el.setAttribute('aria-disabled', String(state));
    for (const control of el.querySelectorAll(CONTROLS)) {
      remember(poked, control, 'disabled');
      /** @type {any} */ (control).disabled = state || Boolean(poked.get(control)?.disabled);
    }
  };
}

/**
 * The read-only dialect for a source, or null when it has none.
 * @param {Record<string, any>|null} component Component, or null for a plain element.
 * @param {Element} el Its element.
 * @param {Map<Element, {disabled?: boolean, readOnly?: boolean}>} poked Original states of the
 *   controls the DOM fallback touched.
 * @returns {((readonly: boolean) => void)|null}
 */
function readonlyAccess(component, el, poked) {
  if (component) {
    for (const name of ['setReadonly', 'setReadOnly']) {
      if (callable(component, name, 1)) return (state) => component[name](state);
    }
    for (const name of ['readonly', 'readOnly']) {
      if (typeof component[name] === 'boolean') return (state) => { component[name] = state; };
    }
    return null;
  }
  if (hasNativeProperty(el, 'readOnly')) return (state) => { /** @type {any} */ (el).readOnly = state; };
  const controls = [...el.querySelectorAll(TEXT_CONTROLS)];
  if (!controls.length) return null;
  return (state) => {
    for (const control of controls) {
      remember(poked, control, 'readOnly');
      /** @type {any} */ (control).readOnly = state || Boolean(poked.get(control)?.readOnly);
    }
  };
}

/**
 * @param {Map<Element, {disabled?: boolean, readOnly?: boolean}>} poked
 * @param {Element} control
 * @param {'disabled'|'readOnly'} name
 * @returns {void}
 */
function remember(poked, control, name) {
  const state = poked.get(control) ?? {};
  if (state[name] === undefined) state[name] = Boolean(/** @type {any} */ (control)[name]);
  poked.set(control, state);
}

/**
 * Whether `target[name]` is a method taking at most `arity` required arguments.
 * @param {Record<string, any>} target
 * @param {string} name
 * @param {number} arity
 * @returns {boolean}
 */
function callable(target, name, arity) {
  const fn = target[name];
  return typeof fn === 'function' && fn.length <= arity;
}

/** @param {Element} el @param {string} name @returns {boolean} */
function hasNativeProperty(el, name) {
  return ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'FIELDSET', 'OUTPUT'].includes(el.tagName) && name in el;
}

/** @param {Element} el @returns {boolean} */
function isCheckable(el) {
  const type = String(/** @type {any} */ (el).type ?? '').toLowerCase();
  return el.tagName === 'INPUT' && (type === 'checkbox' || type === 'radio');
}

/**
 * Value equality for change de-duplication: identical primitives, Dates at the same instant,
 * arrays and plain objects with the same JSON.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function sameValue(a, b) {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
  }
  return false;
}
