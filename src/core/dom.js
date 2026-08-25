// @ts-check
import { escapeRegExp, isElement } from './util.js';

/** @typedef {{toElement: () => Node|null}} ElementProvider */
/** @typedef {Node|string|number|ElementProvider|null|undefined|Array<DomChild>} DomChild */
/** @typedef {Record<string, any>} DomBuilderProperties */
/**
 * @typedef {Object} HProps
 * @property {string|string[]} [class] Class name or names.
 * @property {string|Record<string, string|number>} [style] Inline styles.
 * @property {Record<string, unknown>} [dataset] Data properties.
 * @property {string} [ref] Ref name collected by `h.scope()`.
 */

/** @type {Record<string, Element>|null} */
let activeRefs = null;

/** Properties the ZeyOS builder historically assigns through the DOM property rather than an attribute. */
const DOM_BUILDER_PROPERTIES = new Set([
  'href', 'id', 'lang', 'name', 'rel', 'src', 'target', 'title', 'value'
]);

/** @type {WeakMap<EventTarget, Map<string, {handlers: Function[], listener: EventListener}>>} */
const compactEvents = new WeakMap();

/**
 * @typedef {Object} CompactTag
 * @property {string} tag Element tag, defaulting to `div`.
 * @property {string} id Element id.
 * @property {string} className Space-delimited class string.
 */

/**
 * Parses the compact ZeyOS builder grammar: `tag#id.class names`. The order intentionally matches
 * the established function—class text begins at the first dot, then id is read from the remaining
 * tag portion—so thousands of existing call sites retain the same meaning.
 * @param {string} compact Compact element description.
 * @returns {CompactTag}
 */
export function parseCompactTag(compact) {
  if (typeof compact !== 'string') throw new TypeError('DOM builder tag must be a string');
  let tag = compact;
  let className = '';
  let id = '';
  let index = tag.indexOf('.');
  if (index !== -1) {
    className = tag.slice(index + 1);
    tag = tag.slice(0, index);
  }
  index = tag.indexOf('#');
  if (index !== -1) {
    id = tag.slice(index + 1);
    tag = tag.slice(0, index);
  }
  return { tag: tag || 'div', id, className };
}

/**
 * ZeyOS's compact DOM builder, now a first-class Zx primitive. Primitive content is assigned as
 * text and object content is appended as a Node; HTML strings are never parsed.
 *
 * Existing syntax is preserved (`__('button.primary', {Daction: 'save'}, 'Save')`). Zx components
 * exposing `toElement()` are the one additive extension, so a component may replace a UI factory
 * without changing the surrounding builder call.
 * @param {string} compact `tag#id.class names`; an omitted tag creates a `div`.
 * @param {DomBuilderProperties|null} [properties=null] ZeyOS builder properties.
 * @param {unknown} [content=null] Text-safe content.
 * @returns {HTMLElement}
 */
export function compactElement(compact, properties = null, content = null) {
  const description = parseCompactTag(compact);
  const element = document.createElement(description.tag);
  if (description.id) element.id = description.id;
  if (description.className) element.className = description.className;

  if (description.tag === 'a') {
    const anchor = /** @type {HTMLAnchorElement} */ (element);
    anchor.rel = 'noopener';
    anchor.tabIndex = -1;
  } else if (description.tag === 'button') {
    /** @type {HTMLButtonElement} */ (element).type = 'button';
  } else if (description.tag === 'input' || description.tag === 'textarea') {
    const control = /** @type {any} */ (element);
    control.autocapitalize = 'none';
    control.autocomplete = 'off';
    control.autocorrect = 'off';
    control.spellcheck = false;
  }

  if (properties) applyCompactProperties(element, properties);
  setCompactContent(element, content);
  return element;
}

/** Public compact-builder alias for concise application DOM construction. */
export const __ = compactElement;

/**
 * Returns a trimmed native-link destination unless its parsed scheme can execute document code.
 * Relative URLs, fragments, and ordinary application protocols remain valid; malformed and
 * control-obfuscated script/data schemes are rejected.
 * @param {unknown} value Candidate href.
 * @returns {string|null}
 */
export function safeHref(value) {
  if (typeof value !== 'string') return null;
  const href = value.trim();
  if (!href) return null;
  try {
    const protocol = new URL(href, globalThis.location?.href ?? 'https://zx.invalid/').protocol;
    if (['javascript:', 'data:', 'vbscript:'].includes(protocol.toLowerCase())) return null;
  } catch {
    return null;
  }
  return href;
}

/**
 * Applies the established ZeyOS property rules to an existing element:
 * `Dname` → `data-name`, `SfontSize` → `style.fontSize`, `on*` → a legacy-compatible listener,
 * booleans/built-ins → DOM properties, and everything else → attributes.
 * @param {HTMLElement} element Target element.
 * @param {DomBuilderProperties} properties Properties to apply.
 * @returns {HTMLElement} The target, for chaining.
 */
export function applyCompactProperties(element, properties) {
  // `for…in` is intentional: the established builder also applies enumerable properties inherited
  // from a shared descriptor prototype. Changing that during migration would silently drop them.
  for (const name in properties ?? {}) {
    const value = properties[name];
    if (value == null) continue;
    if (name[0] === 'D') {
      element.setAttribute(`data-${name.slice(1)}`, String(value));
    } else if (name[0] === 'S') {
      element.style[name.slice(1)] = value;
    } else if (name.startsWith('on')) {
      if (typeof value !== 'function') {
        throw new TypeError(`Compact DOM event ${name} must be a function`);
      }
      onCompactEvent(element, name.slice(2), value);
    } else if (typeof value === 'boolean' || DOM_BUILDER_PROPERTIES.has(name)) {
      element[name] = value;
    } else {
      element.setAttribute(name, String(value));
    }
  }
  return element;
}

/**
 * Appends one child and returns the parent: the pure-function equivalent of `parent._(child)`.
 * Primitive values become text; a component exposing `toElement()` is accepted additively.
 * @param {Node} parent Parent node.
 * @param {unknown} child Child content.
 * @returns {Node}
 */
export function appendContent(parent, child) {
  if (child == null) return parent;
  const resolved = resolveCompactProvider(child);
  if (resolved == null) return parent;
  if (typeof resolved === 'object') parent.appendChild(/** @type {Node} */ (resolved));
  else parent.appendChild(document.createTextNode(String(resolved)));
  return parent;
}

/**
 * Creates and appends a compact element, returning the parent: the pure equivalent of `parent.__`.
 * @param {Node} parent Parent node.
 * @param {string} compact Compact element description.
 * @param {DomBuilderProperties|null} [properties=null] Builder properties.
 * @param {unknown} [content=null] Text-safe content.
 * @returns {Node}
 */
export function appendCompact(parent, compact, properties = null, content = null) {
  parent.appendChild(compactElement(compact, properties, content));
  return parent;
}

/**
 * Creates and appends a compact element, returning the child: the pure equivalent of `parent.$__`.
 * @param {Node} parent Parent node.
 * @param {string} compact Compact element description.
 * @param {DomBuilderProperties|null} [properties=null] Builder properties.
 * @param {unknown} [content=null] Text-safe content.
 * @returns {HTMLElement}
 */
export function appendCompactChild(parent, compact, properties = null, content = null) {
  const child = compactElement(compact, properties, content);
  parent.appendChild(child);
  return child;
}

/**
 * Creates a document fragment with normalized modern Zx children. Unlike the exact compact
 * builder, this convenience accepts arrays and flattens them like `h()`.
 * @param {...(DomChild|boolean)} children Fragment children.
 * @returns {DocumentFragment}
 */
export function fragment(...children) {
  const result = document.createDocumentFragment();
  appendChildren(result, /** @type {DomChild[]} */ (children));
  return result;
}

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

/** @typedef {{children: Node[], attributes: [string, string][]}} TargetSnapshot */

/**
 * Captures an enhanced target's children and attributes so `destroy()` can put it back exactly as
 * it was found.
 * @param {Element} element Target being taken over.
 * @returns {TargetSnapshot}
 */
export function snapshotTarget(element) {
  return {
    children: Array.from(element.childNodes),
    attributes: Array.from(element.attributes, (attribute) => [attribute.name, attribute.value])
  };
}

/**
 * Restores a target captured by `snapshotTarget()`.
 * @param {Element} element Target to restore.
 * @param {TargetSnapshot|null} snapshot Snapshot taken before the takeover, or null to do nothing.
 * @returns {void}
 */
export function restoreTarget(element, snapshot) {
  if (!snapshot) return;
  for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);
  for (const [name, value] of snapshot.attributes) element.setAttribute(name, value);
  element.replaceChildren(...snapshot.children);
}

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
 * @typedef {Object} HighlightOptions
 * @property {string} [className='zx-mark'] Class applied to each generated `<mark>`.
 */

/**
 * Wraps every case-insensitive occurrence of a query in a `<mark>` element and returns the result
 * as a fragment. The text is placed in text nodes and the marks are built element by element, so
 * this is safe for user and server data — no HTML is ever parsed. An empty or whitespace-only
 * query yields the text unchanged in a single text node.
 * @param {unknown} text Text to search.
 * @param {unknown} query Search term, matched literally.
 * @param {HighlightOptions} [options={}] Marking options.
 * @returns {DocumentFragment}
 */
export function highlightMatch(text, query, options = {}) {
  const { className = 'zx-mark' } = options;
  const source = text == null ? '' : String(text);
  const needle = query == null ? '' : String(query).trim();
  const fragment = document.createDocumentFragment();

  if (needle === '' || source === '') {
    fragment.append(document.createTextNode(source));
    return fragment;
  }

  const pattern = new RegExp(escapeRegExp(needle), 'gi');
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > cursor) {
      fragment.append(document.createTextNode(source.slice(cursor, match.index)));
    }
    const mark = document.createElement('mark');
    if (className) mark.className = String(className);
    mark.append(document.createTextNode(match[0]));
    fragment.append(mark);
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) fragment.append(document.createTextNode(source.slice(cursor)));
  return fragment;
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
  // Duck-typed on purpose: a Node or a component is a child, anything else is the props object.
  const candidate = /** @type {Record<string, unknown>} */ (value);
  if (typeof candidate.nodeType === 'number') return false;
  return typeof candidate.toElement !== 'function';
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
  // ARIAMixin reflection: ariaHasPopup -> aria-haspopup, ariaValueMin -> aria-valuemin.
  return 'aria-' + key.slice(4).toLowerCase();
}

/** @param {Node} parent @param {DomChild[]} children @returns {void} */
function appendChildren(parent, children) {
  // `flat(Infinity)` erases the element type, and `append` lives on ParentNode rather than Node.
  const host = /** @type {ParentNode} */ (parent);
  // Cast before flattening: `DomChild` is recursive, and flattening it to an unbounded depth is a
  // type the compiler gives up on ("excessively deep") though the runtime behaviour is trivial.
  for (const raw of /** @type {any[]} */ (children).flat(Infinity)) {
    if (raw == null) continue;
    if (typeof raw === 'string' || typeof raw === 'number') {
      host.append(document.createTextNode(String(raw)));
      continue;
    }
    if (typeof raw !== 'object') continue;
    const child = /** @type {{nodeType?: number, toElement?: () => Node|null}} */ (raw);
    if (typeof child.nodeType === 'number') {
      host.append(/** @type {Node} */ (raw));
    } else if (typeof child.toElement === 'function') {
      const element = child.toElement();
      if (element) host.append(element);
    }
  }
}

/**
 * Applies the compact builder's exact single-content contract. Objects are passed to native
 * `appendChild`, while primitives replace textContent. Providers are the explicit Zx extension.
 * @param {HTMLElement} element Target element.
 * @param {unknown} content Builder content.
 * @returns {void}
 */
function setCompactContent(element, content) {
  if (content == null) return;
  const resolved = resolveCompactProvider(content);
  if (resolved == null) return;
  if (typeof resolved === 'object') element.appendChild(/** @type {Node} */ (resolved));
  else element.textContent = String(resolved);
}

/**
 * Resolves the one additive component-provider extension without normalizing any other object.
 * Arrays and plain objects therefore retain the native `appendChild` failure contract.
 * @param {unknown} value Candidate content.
 * @returns {unknown}
 */
function resolveCompactProvider(value) {
  if (value && typeof value === 'object') {
    // A native Node always wins, even if application code attached a `toElement()` method to it.
    // Classic passes every object straight to appendChild; provider resolution is additive only
    // for component-like objects that are not already DOM nodes.
    if (typeof (/** @type {any} */ (value)).nodeType === 'number') return value;
    if (typeof (/** @type {any} */ (value)).toElement === 'function') {
      return (/** @type {ElementProvider} */ (value)).toElement();
    }
  }
  return value;
}

/**
 * Registers an event with the established ZeyOS callback contract: handlers run newest-first,
 * receive `(event, event.target)` (or the key code for keyboard events), and may return false to
 * prevent the default action. This exported registry is shared by compact properties, removal,
 * and synthetic firing so the legacy `DOM` facade can delegate all three operations to it.
 * @param {EventTarget} target Event target.
 * @param {string} type Event name.
 * @param {Function} handler Listener.
 * @param {boolean} [passive=false] Native passive-listener hint.
 * @returns {EventTarget}
 */
export function onCompactEvent(target, type, handler, passive = false) {
  if (typeof handler !== 'function') throw new TypeError('Compact DOM event handler must be a function');
  const eventType = String(type);
  let events = compactEvents.get(target);
  if (!events) {
    events = new Map();
    compactEvents.set(target, events);
  }
  const registered = events.get(eventType);
  if (registered) {
    registered.handlers.push(handler);
    return target;
  }
  const handlers = [handler];
  /** @type {EventListener} */
  const listener = (event) => dispatchCompactEvent(target, handlers, event);
  events.set(eventType, { handlers, listener });
  try {
    target.addEventListener(eventType, listener, { passive });
  } catch {
    target.addEventListener(eventType, listener);
  }
  return target;
}

/**
 * Removes one registered handler, matching the established duplicate-registration behavior.
 * @param {EventTarget} target Event target.
 * @param {string} type Event name.
 * @param {Function} handler Handler to remove.
 * @returns {EventTarget}
 */
export function offCompactEvent(target, type, handler) {
  const eventType = String(type);
  const events = compactEvents.get(target);
  const registered = events?.get(eventType);
  if (!registered) return target;
  const index = registered.handlers.indexOf(handler);
  if (index === -1) return target;
  registered.handlers.splice(index, 1);
  if (registered.handlers.length === 0) {
    target.removeEventListener(eventType, registered.listener);
    events.delete(eventType);
    if (events.size === 0) compactEvents.delete(target);
  }
  return target;
}

/**
 * Invokes compact handlers without dispatching unrelated native listeners.
 * @param {EventTarget} target Event target.
 * @param {string} type Event name.
 * @param {Event|Record<string, any>|null} [event=null] Event-like object.
 * @returns {EventTarget}
 */
export function fireCompactEvent(target, type, event = null) {
  const eventType = String(type);
  const events = compactEvents.get(target);
  // Match DOM.fireEvt's guard: a requested type must be registered before an event is considered.
  if (!events?.has(eventType)) return target;
  const actual = event ?? compactSyntheticEvent(target, eventType);
  // DOM.handleEvt then dispatches by the supplied event's own type. This distinction matters for
  // hand-built event objects even though normal ZeyOS callers omit the optional event argument.
  const registered = events.get(String((/** @type {any} */ (actual)).type));
  if (registered) dispatchCompactEvent(target, registered.handlers, actual);
  return target;
}

/** @param {EventTarget} target @param {Function[]} handlers @param {Event|Record<string, any>} event */
function dispatchCompactEvent(target, handlers, event) {
  const value = /** @type {any} */ (event);
  const secondary = String(value.type).startsWith('key') ? value.which : value.target;
  for (let index = handlers.length - 1; index >= 0; index -= 1) {
    if (handlers[index].call(target, event, secondary) === false) value.preventDefault();
  }
}

/** @param {EventTarget} target @param {string} type @returns {Record<string, any>} */
function compactSyntheticEvent(target, type) {
  const event = {
    target,
    type,
    which: -1,
    defaultPrevented: false,
    preventDefault() { event.defaultPrevented = true; }
  };
  return event;
}
