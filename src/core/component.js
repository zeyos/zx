// @ts-check
import { h, resolveElement } from './dom.js';
import { getLanguage, printf, translate } from './i18n.js';
import { deepMerge, isElement } from './util.js';

/** @typedef {Record<string, any>} ComponentOptions */
/** @typedef {(event: Event & {detail?: Record<string, unknown>}) => void} ComponentListener */

/** @type {WeakMap<Element, Component>} */
const registry = new WeakMap();

/**
 * Base class for lifecycle-safe Zx components.
 *
 * Generic over its own options type so a subclass can bind its `XOptions` typedef with
 * `@extends {Component<XOptions>}`. That is what types `new Select(target, { … })` for editors and
 * for TypeScript consumers: a subclass declares no constructor of its own, so it inherits this
 * signature, and without the binding every component would accept any object at all.
 *
 * @template {ComponentOptions} [TOptions=ComponentOptions]
 * @fires Component#event
 */
export class Component extends EventTarget {
  /** @type {ComponentOptions} */
  static defaults = {};

  /**
   * BEM block a subclass wants on its root, without the `zx-` prefix. Empty on the base, which is
   * the same falsy answer the undeclared property gave — declared so the statics are visible to
   * `this.constructor` and to the generated declarations.
   * @type {string}
   */
  static cssName = '';

  /** @type {Element} Root element. */
  el;

  /** @type {Record<string, Element>} Elements captured by `h()` ref properties. */
  refs;

  /** @type {Readonly<TOptions>} Merged component options. */
  options;

  #abort = new AbortController();
  #created = false;
  #destroyed = false;
  #addedRootClass = false;

  /**
   * Creates a component around an existing target, or asks `render()` to create its root.
   * @param {Element|string|null} target Existing element, selector, or null.
   * @param {TOptions} [options={}] Component options.
   */
  constructor(target, options = /** @type {TOptions} */ ({})) {
    super();
    /** `this.constructor` is typed `Function`, which hides the statics this class declares. */
    const self = /** @type {typeof Component} */ (this.constructor);
    this.#created = target === null;
    const resolved = resolveElement(target);
    if (target !== null && !resolved) throw new TypeError('Component target could not be resolved');
    this.el = /** @type {Element} */ (resolved);
    this.refs = {};

    const merged = /** @type {TOptions} */ (mergeOptions(self, options));
    const eventOptions = [];
    for (const [key, value] of Object.entries(merged)) {
      if (/^on[a-z]/.test(key) && typeof value === 'function') {
        eventOptions.push([key.slice(2), value]);
        delete merged[key];
      }
    }
    if (merged.msg && typeof merged.msg === 'object') Object.freeze(merged.msg);
    this.options = Object.freeze(merged);
    for (const [type, listener] of eventOptions) this.on(type, listener);

    let rendered;
    try {
      rendered = h.scope(this.refs, () => this.render());
    } catch (error) {
      this.#abort.abort();
      throw error;
    }
    if (this.#created) {
      const root = isElement(rendered) ? rendered : this.el;
      if (!isElement(root)) {
        this.#abort.abort();
        throw new TypeError('render() must return an Element (or assign this.el) when target is null');
      }
      this.el = root;
    }
    if (!isElement(this.el)) {
      this.#abort.abort();
      throw new TypeError('Component requires a root Element');
    }

    const cssName = self.cssName;
    if (typeof cssName === 'string' && cssName) {
      const className = `zx-${cssName}`;
      this.#addedRootClass = !this.el.classList.contains(className);
      this.el.classList.add(className);
    }
    registry.set(this.el, this);
  }

  /**
   * Renders or enhances the component root. Subclasses creating a root must return it.
   * @returns {Element|null}
   */
  render() {
    return this.el ?? null;
  }

  /**
   * Subscribes to a component-level event for this component's lifetime.
   * @param {string} type Lowercase event name.
   * @param {ComponentListener|EventListenerObject} fn Listener.
   * @returns {this}
   */
  on(type, fn) {
    this.addEventListener(type, fn, { signal: this.#abort.signal });
    return this;
  }

  /**
   * Removes a component-level event listener.
   * @param {string} type Event name.
   * @param {ComponentListener|EventListenerObject} fn Listener.
   * @returns {this}
   */
  off(type, fn) {
    this.removeEventListener(type, fn);
    return this;
  }

  /**
   * Subscribes to one component-level event occurrence.
   * @param {string} type Event name.
   * @param {ComponentListener|EventListenerObject} fn Listener.
   * @returns {this}
   */
  once(type, fn) {
    this.addEventListener(type, fn, { once: true, signal: this.#abort.signal });
    return this;
  }

  /**
   * MooTools-compatible alias of `on()`.
   * @param {string} type Event name.
   * @param {ComponentListener|EventListenerObject} fn Listener.
   * @returns {this}
   */
  addEvent(type, fn) {
    return this.on(type, fn);
  }

  /**
   * Dispatches a component event and a bubbling, composed `zx-*` DOM event.
   * @param {string} type Lowercase event name.
   * @param {Record<string, unknown>} [detail={}] Single event detail object.
   * @returns {Event & {detail: Record<string, unknown>}}
   * @fires Component#event
   */
  emit(type, detail = {}) {
    if (detail === null || typeof detail !== 'object' || Array.isArray(detail)) {
      throw new TypeError('Event detail must be an object');
    }
    const componentEvent = createCustomEvent(type, detail, { cancelable: true });
    this.dispatchEvent(componentEvent);
    if (this.el) {
      this.el.dispatchEvent(createCustomEvent(`zx-${type}`, detail, {
        bubbles: true,
        composed: true,
        cancelable: true
      }));
    }
    return componentEvent;
  }

  /**
   * Adds an automatically cleaned-up DOM event listener.
   * @param {EventTarget} element DOM event target.
   * @param {string} type Event name.
   * @param {EventListenerOrEventListenerObject} fn Listener.
   * @param {boolean|AddEventListenerOptions} [opts={}] Listener options.
   * @returns {this}
   */
  listen(element, type, fn, opts = {}) {
    const options = typeof opts === 'boolean' ? { capture: opts } : { ...opts };
    element.addEventListener(type, fn, { ...options, signal: this.#abort.signal });
    return this;
  }

  /**
   * Returns the component's root element.
   * @returns {Element}
   */
  toElement() {
    return this.el;
  }

  /**
   * Resolves and interpolates a component-local or global translation.
   * @param {string} key Message key.
   * @param {...unknown} args Positional interpolation values.
   * @returns {string}
   */
  msg(key, ...args) {
    const messages = this.options.msg;
    const lang = this.options.lang ?? this.options.language ?? getLanguage();
    const localized = messages?.[lang]?.[key];
    if (localized != null) return printf(String(localized), args);
    const direct = messages?.[key];
    if (direct != null) return printf(String(direct), args);
    return translate(key, args);
  }

  /**
   * Aborts listeners, unregisters the component, and removes roots created by the component.
   * Safe to call repeatedly.
   * @returns {void}
   */
  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#abort.abort();
    if (registry.get(this.el) === this) registry.delete(this.el);
    const cssName = /** @type {typeof Component} */ (this.constructor).cssName;
    if (this.#addedRootClass && typeof cssName === 'string' && this.el) {
      this.el.classList.remove(`zx-${cssName}`);
    }
    if (this.#created && this.el) this.el.remove();
  }

  /**
   * Retrieves the component currently registered for an element.
   * @param {Element} element Root element.
   * @returns {Component|null}
   */
  static from(element) {
    return registry.get(element) ?? null;
  }
}

/**
 * Generic component event emitted under the name passed to `emit()`.
 * @event Component#event
 * @type {CustomEvent<Record<string, unknown>>}
 */

/** @param {typeof Component} constructor @param {ComponentOptions} options @returns {ComponentOptions} */
function mergeOptions(constructor, options) {
  const chain = [];
  let current = constructor;
  while (current && current !== Function.prototype) {
    if (Object.prototype.hasOwnProperty.call(current, 'defaults')) chain.unshift(current.defaults);
    current = Object.getPrototypeOf(current);
  }

  const result = {};
  let messages = {};
  let hasMessages = false;
  for (const defaults of chain) {
    if (!defaults || typeof defaults !== 'object') continue;
    Object.assign(result, defaults);
    if (defaults.msg && typeof defaults.msg === 'object') {
      hasMessages = true;
      messages = deepMerge(messages, defaults.msg);
    }
  }
  Object.assign(result, options && typeof options === 'object' ? options : {});
  if (options?.msg && typeof options.msg === 'object') {
    hasMessages = true;
    messages = deepMerge(messages, options.msg);
  }
  if (hasMessages) result.msg = messages;
  return result;
}

/**
 * @param {string} type
 * @param {Record<string, unknown>} detail
 * @param {CustomEventInit<Record<string, unknown>>} init
 * @returns {Event & {detail: Record<string, unknown>}}
 */
function createCustomEvent(type, detail, init) {
  if (typeof CustomEvent === 'function') {
    return new CustomEvent(type, { ...init, detail });
  }
  const event = new Event(type, init);
  Object.defineProperty(event, 'detail', { configurable: true, enumerable: true, value: detail });
  return /** @type {Event & {detail: Record<string, unknown>}} */ (event);
}
