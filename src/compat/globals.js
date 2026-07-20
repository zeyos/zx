import { h, htmlEscape } from '../core/dom.js';
import { translate } from '../core/i18n.js';

/** @type {WeakMap<object, Map<unknown, unknown>>} */
const elementStorage = new WeakMap();

/**
 * Installs the small WeakMap-backed MooTools Element storage surface.
 * Existing implementations are never overwritten.
 * @param {typeof globalThis} [host=globalThis] Realm whose Element prototype is extended.
 * @returns {void}
 */
export function installElementStorage(host = globalThis) {
  const prototype = host?.Element?.prototype;
  if (!prototype) return;
  if (typeof prototype.store !== 'function') {
    Object.defineProperty(prototype, 'store', {
      configurable: true,
      writable: true,
      value: function store(key, value) {
        let values = elementStorage.get(this);
        if (!values) {
          values = new Map();
          elementStorage.set(this, values);
        }
        values.set(key, value);
        return this;
      }
    });
  }
  if (typeof prototype.retrieve !== 'function') {
    Object.defineProperty(prototype, 'retrieve', {
      configurable: true,
      writable: true,
      value: function retrieve(key, fallback = null) {
        let values = elementStorage.get(this);
        if (values?.has(key)) return values.get(key);
        if (arguments.length > 1) {
          if (!values) {
            values = new Map();
            elementStorage.set(this, values);
          }
          values.set(key, fallback);
        }
        return fallback;
      }
    });
  }
  if (typeof prototype.eliminate !== 'function') {
    Object.defineProperty(prototype, 'eliminate', {
      configurable: true,
      writable: true,
      value: function eliminate(key) {
        elementStorage.get(this)?.delete(key);
        return this;
      }
    });
  }
}

/**
 * Parses the legacy gx object-literal DOM dialect.
 * `html` is intentionally treated as trusted legacy markup via `h.raw()`.
 * @param {unknown} source Legacy tree value.
 * @returns {Node|false} Parsed node, or false for unsupported input.
 */
export function parse(source) {
  if (source && typeof source === 'object' && typeof source.toElement === 'function') {
    return source.toElement() ?? false;
  }
  if (source && typeof source === 'object' && typeof source.nodeType === 'number') return source;
  if (typeof source === 'string' || typeof source === 'number') return document.createTextNode(String(source));
  if (!source || typeof source !== 'object' || Array.isArray(source)) return false;

  const descriptor = source;
  const props = {};
  const events = [];
  const reserved = new Set(['tag', 'html', 'styles', 'classes', 'child', 'children', '_adopt', 'events']);
  for (const [key, value] of Object.entries(descriptor)) {
    if (reserved.has(key)) continue;
    if (/^on[A-Z]/.test(key) && typeof value === 'function') {
      events.push([key.slice(2).toLowerCase(), value]);
    } else if (key === 'class') {
      props.class = value;
    } else if (key === 'text') {
      props.textContent = value == null ? '' : String(value);
    } else {
      props[key] = value;
    }
  }
  if (descriptor.styles && typeof descriptor.styles === 'object') props.style = descriptor.styles;
  if (descriptor.classes != null) {
    const classes = Array.isArray(descriptor.classes) ? descriptor.classes : [descriptor.classes];
    props.class = [props.class, ...classes].flat().filter(Boolean);
  }
  const element = h(String(descriptor.tag ?? 'div'), props);
  for (const [type, listener] of events) element.addEventListener(type, listener);
  if (descriptor.events && typeof descriptor.events === 'object') {
    for (const [type, listener] of Object.entries(descriptor.events)) {
      if (typeof listener === 'function') element.addEventListener(type, listener);
    }
  }
  if (descriptor.html != null) element.append(h.raw(String(descriptor.html)));
  appendParsed(element, descriptor._adopt);
  appendParsed(element, descriptor.child);
  if (Array.isArray(descriptor.children)) {
    for (const child of descriptor.children) appendParsed(element, child);
  } else if (descriptor.children && typeof descriptor.children === 'object') {
    const names = [];
    for (const [name, childSource] of Object.entries(descriptor.children)) {
      const child = parse(childSource);
      if (!child) continue;
      element.append(child);
      element[`_${name}`] = child.retrieve?.('com') ?? child;
      names.push(name);
    }
    element.store?.('children', names);
  }
  return element;
}

/**
 * Explicitly installs legacy globals and prototype conveniences.
 * @param {typeof globalThis} [host=globalThis] Realm to modify.
 * @returns {typeof globalThis} The supplied realm.
 */
export function installGlobals(host = globalThis) {
  installElementStorage(host);
  host.__ = parse;
  const stringPrototype = host.String?.prototype;
  if (stringPrototype && typeof stringPrototype.htmlSpecialChars !== 'function') {
    Object.defineProperty(stringPrototype, 'htmlSpecialChars', {
      configurable: true,
      writable: true,
      value: function htmlSpecialChars() { return htmlEscape(String(this)); }
    });
  }
  const arrayPrototype = host.Array?.prototype;
  if (arrayPrototype && typeof arrayPrototype.findBy !== 'function') {
    Object.defineProperty(arrayPrototype, 'findBy', {
      configurable: true,
      writable: true,
      value: function findBy(matcher, value) {
        const predicate = typeof matcher === 'string' ? (item) => item?.[matcher] === value : matcher;
        if (typeof predicate !== 'function') return null;
        for (let index = this.length - 1; index >= 0; index -= 1) {
          if (predicate(this[index]) === true) return this[index];
        }
        return null;
      }
    });
  }
  if (host._ === undefined) host._ = (key, args) => translate(String(key), args);
  return host;
}

/** @param {Node} parent @param {unknown} source @returns {void} */
function appendParsed(parent, source) {
  if (source == null) return;
  const list = Array.isArray(source) ? source : [source];
  for (const item of list) {
    const child = parse(item);
    if (child) parent.append(child);
  }
}
