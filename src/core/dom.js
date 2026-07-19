import { isElement } from './util.js';

/** @typedef {{toElement: () => Node|null}} ElementProvider */
/** @typedef {Node|string|number|ElementProvider|null|undefined|Array<DomChild>} DomChild */
/**
 * @typedef {Object} HProps
 * @property {string|string[]} [class] Class name or names.
 * @property {string|Record<string, string|number>} [style] Inline styles.
 * @property {Record<string, unknown>} [dataset] Data properties.
 * @property {string} [ref] Ref name collected by `h.scope()`.
 */

/** @type {Record<string, Element>|null} */
let activeRefs = null;

/**
 * Creates an element and appends normalized children.
 * @param {string} tag Element tag name.
 * @param {(HProps & Record<string, any>)|DomChild} [props] Properties and attributes, or the first child.
 * @param {...DomChild} children Child values.
 * @returns {HTMLElement}
 */
export function h(tag, props, ...children) {
  const element = document.createElement(tag);
  let properties = props;
  if (!isPropsObject(properties)) {
    children.unshift(/** @type {DomChild} */ (properties));
    properties = {};
  }

  for (const [key, value] of Object.entries(properties)) {
    applyProperty(element, key, value);
  }
  appendChildren(element, children);
  return element;
}

/**
 * Runs a render operation with a ref collector active.
 * @template T
 * @param {Record<string, Element>} refs Object populated by `ref` properties.
 * @param {() => T} fn Synchronous render operation.
 * @returns {T}
 */
h.scope = function scope(refs, fn) {
  const previous = activeRefs;
  activeRefs = refs;
  try {
    return fn();
  } finally {
    activeRefs = previous;
  }
};

/**
 * Parses explicitly trusted component-generated HTML into a document fragment.
 * User and server content must never be passed to this function.
 * @param {string} html Trusted HTML string.
 * @returns {DocumentFragment}
 */
h.raw = function raw(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html);
  return template.content;
};

/**
 * Escapes text for safe insertion into an HTML string.
 * @param {unknown} str Value to escape.
 * @returns {string}
 */
export function htmlEscape(str) {
  return String(str).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

/**
 * Resolves an Element, selector, or object exposing `toElement()`.
 * @param {Element|string|ElementProvider|null|undefined} target Target to resolve.
 * @returns {Element|null}
 */
export function resolveElement(target) {
  if (target == null) return null;
  if (isElement(target)) return target;
  if (typeof target === 'string') return document.querySelector(target);
  if (typeof target.toElement === 'function') {
    const resolved = target.toElement();
    return isElement(resolved) ? resolved : null;
  }
  return null;
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isPropsObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  if (typeof value.nodeType === 'number') return false;
  return typeof value.toElement !== 'function';
}

/** @param {HTMLElement} element @param {string} key @param {any} value @returns {void} */
function applyProperty(element, key, value) {
  if (key === 'ref') {
    if (activeRefs && typeof value === 'string') activeRefs[value] = element;
    return;
  }
  if (key === 'class') {
    element.className = Array.isArray(value) ? value.flat(Infinity).filter(Boolean).join(' ') : String(value ?? '');
    return;
  }
  if (key === 'style') {
    if (typeof value === 'string') element.style.cssText = value;
    else if (value && typeof value === 'object') {
      for (const [property, styleValue] of Object.entries(value)) {
        if (property.startsWith('--') || property.includes('-')) {
          element.style.setProperty(property, String(styleValue));
        } else {
          element.style[property] = styleValue;
        }
      }
    }
    return;
  }
  if (key === 'dataset' && value && typeof value === 'object') {
    for (const [name, datasetValue] of Object.entries(value)) {
      if (datasetValue == null) delete element.dataset[name];
      else element.dataset[name] = String(datasetValue);
    }
    return;
  }
  if (/^on[a-z]/.test(key) && typeof value === 'function') {
    element.addEventListener(key.slice(2), value);
    return;
  }
  if (value == null) return;

  const attribute = ariaAttribute(key);
  if (attribute !== null) {
    element.setAttribute(attribute, String(value));
  } else if (key in element) {
    try {
      element[key] = value;
    } catch {
      element.setAttribute(key, String(value));
    }
  } else if (typeof value === 'boolean') {
    if (value) element.setAttribute(key, '');
    else element.removeAttribute(key);
  } else {
    element.setAttribute(key, String(value));
  }
}

/** @param {string} key @returns {string|null} */
function ariaAttribute(key) {
  if (key.startsWith('aria-')) return key;
  if (!/^aria[A-Z]/.test(key)) return null;
  return 'aria-' + key.slice(4).replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase()).replace(/^-/, '');
}

/** @param {Node} parent @param {DomChild[]} children @returns {void} */
function appendChildren(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      parent.append(document.createTextNode(String(child)));
    } else if (child && typeof child === 'object' && typeof child.nodeType === 'number') {
      parent.append(child);
    } else if (typeof child === 'object' && typeof child.toElement === 'function') {
      const element = child.toElement();
      if (element) parent.append(element);
    }
  }
}
