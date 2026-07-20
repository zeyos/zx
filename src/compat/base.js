import { installElementStorage } from './globals.js';

/** @typedef {(detail: Record<string, any>, event: Event) => unknown[]} LegacyArgumentMapper */
/**
 * @typedef {Object} LegacyEventMapping
 * @property {string} type Zx event name.
 * @property {LegacyArgumentMapper} [args] Legacy positional argument adapter.
 * @property {(detail: Record<string, any>, event: Event) => boolean} [filter] Optional event filter.
 */
/** @typedef {Record<string, string|LegacyEventMapping>} LegacyEventMap */
/**
 * @typedef {Object} WrapperConfiguration
 * @property {LegacyEventMap} [events]
 * @property {Record<string, string|Element|(() => Element|null)>} [ui]
 * @property {Record<string, string|((value: unknown) => void)>} [setters]
 */

/**
 * MooTools-flavoured façade shared by compatibility component wrappers.
 * @fires GxWrapper#legacy-event
 */
export class GxWrapper {
  /** Fully qualified legacy class name shown in migration warnings. */
  static legacyName = 'gx.ui.Container';

  /**
   * Initializes legacy options and callback-style `onEvent` options.
   * Subclasses call `_attach()` after constructing their Zx implementation.
   * @param {Record<string, any>} [options={}] Legacy options.
   * @param {Record<string, any>} [defaults={}] Legacy defaults.
   */
  constructor(options = {}, defaults = {}) {
    warnClassOnce(this.constructor);
    this.gx = this.constructor.legacyName;
    this.options = { ...defaults, ...(options && typeof options === 'object' ? options : {}) };
    this._events = new Map();
    this._mappedListeners = [];
    this._domAbort = new AbortController();
    this._zx = null;
    this._ui = {};
    this._display = this._ui;
    this._uiMap = {};
    this._optionSetters = {};
    this._destroyed = false;
    for (const [key, value] of Object.entries(this.options)) {
      if (/^on[A-Z]/.test(key) && typeof value === 'function') this.addEvent(key, value);
    }
  }

  /**
   * Subscribes a legacy callback.
   * @param {string} type Legacy event name, with or without an `on` prefix.
   * @param {Function} fn Callback receiving legacy positional arguments.
   * @returns {this}
   */
  addEvent(type, fn) {
    if (typeof fn !== 'function') return this;
    const name = normalizeEventName(type);
    const handlers = this._events.get(name) ?? new Set();
    handlers.add(fn);
    this._events.set(name, handlers);
    return this;
  }

  /**
   * Removes one callback, or all callbacks of a type when omitted.
   * @param {string} type Legacy event name.
   * @param {Function} [fn] Callback to remove.
   * @returns {this}
   */
  removeEvent(type, fn) {
    const name = normalizeEventName(type);
    if (fn === undefined) this._events.delete(name);
    else {
      const handlers = this._events.get(name);
      handlers?.delete(fn);
      if (handlers?.size === 0) this._events.delete(name);
    }
    return this;
  }

  /**
   * Fires a legacy event synchronously.
   * @param {string} type Legacy event name.
   * @param {unknown|unknown[]} [args=[]] Positional argument array or one argument.
   * @returns {this}
   * @fires GxWrapper#legacy-event
   */
  fireEvent(type, args = []) {
    const values = Array.isArray(args) ? args : [args];
    const handlers = [...(this._events.get(normalizeEventName(type)) ?? [])];
    for (const handler of handlers) handler.apply(this, values);
    return this;
  }

  /**
   * Applies multiple post-construction legacy options.
   * @param {Record<string, unknown>} options Option values.
   * @returns {this}
   */
  setOptions(options) {
    if (!options || typeof options !== 'object') return this;
    for (const [name, value] of Object.entries(options)) this.setOption(name, value);
    return this;
  }

  /**
   * Applies one post-construction option through a declared setter.
   * Unsupported dynamic options are retained on `options` and warn once per class/key.
   * @param {string} option Legacy option name.
   * @param {unknown} value New value.
   * @returns {this}
   */
  setOption(option, value) {
    const name = String(option);
    this.options[name] = value;
    if (/^on[A-Z]/.test(name) && typeof value === 'function') {
      this.addEvent(name, value);
      return this;
    }
    const setter = this._optionSetters[name];
    if (typeof setter === 'function') setter.call(this, value);
    else if (typeof setter === 'string' && typeof this[setter] === 'function') this[setter](value);
    else warnOptionOnce(this.constructor, name);
    return this;
  }

  /**
   * Returns the wrapped component root.
   * @returns {Element|null}
   */
  toElement() {
    return this._zx?.toElement?.() ?? this._zx?.el ?? null;
  }

  /**
   * Resolves a legacy `_ui` key, falling back to the component root.
   * @param {string} [key='root'] Legacy display key.
   * @returns {Element|null}
   */
  display(key = 'root') {
    const name = key || 'root';
    if (name === 'root') return this.toElement();
    const mapped = this._uiMap[name];
    if (typeof mapped === 'function') return mapped.call(this) ?? this.toElement();
    if (typeof mapped === 'string') return this._zx?.refs?.[mapped] ?? this.toElement();
    if (mapped?.nodeType === 1) return mapped;
    return this._ui[name] ?? this.toElement();
  }

  /**
   * Returns the supported legacy coordinate subset.
   * @returns {{width: number, height: number, top: number, left: number}}
   */
  getCoordinates() {
    const rectangle = this.toElement()?.getBoundingClientRect?.();
    return rectangle ? {
      width: rectangle.width,
      height: rectangle.height,
      top: rectangle.top,
      left: rectangle.left
    } : { width: 0, height: 0, top: 0, left: 0 };
  }

  /**
   * Updates one root style property.
   * @param {string} property CSS property.
   * @param {unknown} value CSS value.
   * @returns {this}
   */
  setStyle(property, value) {
    const element = /** @type {HTMLElement|null} */ (this.toElement());
    if (!element) return this;
    if (String(property).startsWith('--') || String(property).includes('-')) {
      element.style.setProperty(String(property), String(value));
    } else {
      element.style[property] = value;
    }
    return this;
  }

  /**
   * Updates supported root coordinates.
   * @param {Record<string, unknown>} coordinates Coordinate styles.
   * @returns {this}
   */
  setCoordinates(coordinates = {}) {
    for (const key of ['width', 'height', 'top', 'right', 'bottom', 'left']) {
      if (coordinates[key] == null) continue;
      const value = typeof coordinates[key] === 'number' ? `${coordinates[key]}px` : coordinates[key];
      this.setStyle(key, value);
    }
    return this;
  }

  /**
   * Destroys the wrapped component and legacy event subscriptions.
   * @returns {void}
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._domAbort.abort();
    const root = this.toElement();
    if (root?.retrieve?.('com') === this) root.eliminate('com');
    for (const [type, listener] of this._mappedListeners) this._zx?.off?.(type, listener);
    this._mappedListeners.length = 0;
    this._events.clear();
    this._zx?.destroy?.();
  }

  /**
   * Attaches a constructed Zx component and its translation metadata.
   * @param {any} component Wrapped Zx component.
   * @param {WrapperConfiguration} [configuration={}] Event, display, and setter maps.
   * @returns {this}
   */
  _attach(component, configuration = {}) {
    this._zx = component;
    this._uiMap = { ...(configuration.ui ?? {}) };
    this._optionSetters = { ...(configuration.setters ?? {}) };
    const root = this.toElement();
    if (root) {
      installElementStorage(globalThis);
      root.store?.('com', this);
      this._ui.root = root;
      for (const key of Object.keys(this._uiMap)) this._ui[key] = this.display(key);
    }
    for (const [legacyType, declaration] of Object.entries(configuration.events ?? {})) {
      const mapping = typeof declaration === 'string' ? { type: declaration } : declaration;
      const listener = (event) => {
        const detail = event.detail ?? {};
        if (mapping.filter && !mapping.filter.call(this, detail, event)) return;
        const args = mapping.args ? mapping.args.call(this, detail, event) : [];
        this.fireEvent(legacyType, args);
      };
      component.on?.(mapping.type, listener);
      this._mappedListeners.push([mapping.type, listener]);
    }
    return this;
  }

  /**
   * Adds a DOM listener owned by this wrapper.
   * @param {EventTarget} target Event target.
   * @param {string} type Event type.
   * @param {EventListenerOrEventListenerObject} listener Listener.
   * @param {AddEventListenerOptions} [options={}] Listener options.
   * @returns {this}
   */
  _listen(target, type, listener, options = {}) {
    target.addEventListener(type, listener, { ...options, signal: this._domAbort.signal });
    return this;
  }

  /** @param {Element|null} element @param {boolean} active @returns {void} */
  _mirrorAct(element, active) {
    element?.classList.toggle('act', Boolean(active));
  }
}

/** Generic legacy event dispatched by a mapped Zx event. @event GxWrapper#legacy-event */

/** @param {typeof GxWrapper} constructor @returns {void} */
function warnClassOnce(constructor) {
  if (Object.hasOwn(constructor, '_compatWarned') && constructor._compatWarned) return;
  Object.defineProperty(constructor, '_compatWarned', { configurable: true, value: true, writable: true });
  console.warn(`${constructor.legacyName} is running on the Zx compat layer — migrate to ${replacementName(constructor.legacyName)}`);
}

/** @param {typeof GxWrapper} constructor @param {string} option @returns {void} */
function warnOptionOnce(constructor, option) {
  if (!Object.hasOwn(constructor, '_compatOptionWarnings')) {
    Object.defineProperty(constructor, '_compatOptionWarnings', { configurable: true, value: new Set() });
  }
  if (constructor._compatOptionWarnings.has(option)) return;
  constructor._compatOptionWarnings.add(option);
  console.warn(`${constructor.legacyName}.setOption("${option}") cannot update the wrapped Zx component dynamically`);
}

/** @param {string} name @returns {string} */
function replacementName(name) {
  const className = name.split('.').at(-1);
  return `zx.${className}`;
}

/** @param {string} type @returns {string} */
function normalizeEventName(type) {
  const value = String(type ?? '');
  return (/^on[A-Z]/.test(value) ? value.slice(2) : value).toLowerCase();
}
