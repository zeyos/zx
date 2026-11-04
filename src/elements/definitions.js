import { INVALID_ATTRIBUTE, serializeAttribute } from './reflect.js';

/** @typedef {import('./reflect.js').AttributeType} AttributeType */
/**
 * @typedef {Object} ElementAttribute
 * @property {AttributeType} [type='string'] Attribute representation.
 * @property {string|null} [option] Component option name; null keeps the value on the host only.
 * @property {string} [property] Host property name; defaults to camel-cased attribute name.
 * @property {unknown} [default] Property value used while the attribute is absent.
 * @property {boolean} [always=false] Pass the default to the component during initial creation.
 * @property {boolean} [rebuild=false] Recreate the component when this value changes.
 * @property {boolean} [reflect=true] Write a value set on the property back to the attribute.
 * @property {boolean} [observed=true] Read the attribute at all; false makes this a property alone.
 * @property {(value: unknown, host: HTMLElement) => unknown} [normalize] Value adapter.
 * @property {(value: unknown, host: HTMLElement) => string|null|typeof INVALID_ATTRIBUTE} [serialize]
 * Property serializer override.
 * @property {(component: InstanceType<typeof import('../core/component.js').Component>, value: any, host: HTMLElement) => void} [set]
 * Live component setter.
 * @property {(component: any, host: HTMLElement) => unknown} [get]
 * Live component getter.
 */
/** @typedef {Record<string, AttributeType|ElementAttribute>} ElementAttributeMap */
/**
 * What a forwarded method does to the host's properties, worked out from its arguments, for a
 * method that changes an option the component has no getter for. Null forwards it and nothing else.
 * @typedef {((args: unknown[]) => Record<string, unknown>|null|undefined)|null} MethodTracker
 */
/** @typedef {Record<string, MethodTracker>} ElementMethodMap */

/** @param {string} value @returns {string} */
function camelCase(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

/**
 * Fills in every field of an attribute map. Normalizing an already normalized map changes nothing.
 * @param {ElementAttributeMap} attrs Attribute name to definition.
 * @returns {Readonly<Record<string, ElementAttribute>>}
 */
export function normalizeAttributes(attrs) {
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
      reflect: details.reflect !== false,
      observed: details.observed !== false,
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
export function attributes(value) {
  return normalizeAttributes(value);
}

/** @param {Partial<ElementAttribute>} [options={}] @returns {ElementAttribute} */
export function text(options = {}) {
  return { type: 'string', ...options };
}

/** @param {Partial<ElementAttribute>} [options={}] @returns {ElementAttribute} */
export function number(options = {}) {
  return { type: 'number', ...options };
}

/** @param {Partial<ElementAttribute>} [options={}] @returns {ElementAttribute} */
export function bool(options = {}) {
  return { type: 'boolean', default: false, always: true, ...options };
}

/** @param {Partial<ElementAttribute>} [options={}] @returns {ElementAttribute} */
export function json(options = {}) {
  return { type: 'json', ...options };
}

/**
 * An option that is on by default, or that stays undecided (`default: null`) until it is set.
 * @param {Partial<ElementAttribute>} [options={}]
 * @returns {ElementAttribute}
 */
export function flag(options = {}) {
  return { type: 'flag', default: true, ...options };
}

/**
 * Rich data: a JSON attribute is read for static markup, and a value set on the property stays
 * there, never serialized back into the attribute.
 * @param {Partial<ElementAttribute>} [options={}]
 * @returns {ElementAttribute}
 */
export function data(options = {}) {
  return { type: 'json', reflect: false, ...options };
}

/**
 * A value markup cannot express: a function, a node, an adapter. It has no attribute at all.
 * @param {Partial<ElementAttribute>} [options={}]
 * @returns {ElementAttribute}
 */
export function prop(options = {}) {
  return { type: 'json', reflect: false, observed: false, ...options };
}

/**
 * Reflects the plain values of an option that also takes a function, an object or a node. Those
 * stay on the property, because their text would mean nothing in an attribute.
 * @param {AttributeType} type Attribute representation.
 * @returns {(value: unknown) => string|null|typeof INVALID_ATTRIBUTE}
 */
export function reflectPlain(type) {
  return (value) => (value === null || value === undefined
    || ['string', 'number', 'boolean'].includes(typeof value)
    ? serializeAttribute(value, type)
    : INVALID_ATTRIBUTE);
}

/** @param {unknown} value @returns {unknown} */
export function normalizeSelectable(value) {
  if (value === '' || value === 'true') return 'single';
  if (value === 'false') return false;
  return value;
}

/** @param {unknown} value @returns {unknown} */
export function normalizeNumberOrString(value) {
  if (typeof value !== 'string' || value.trim() === '') return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

/**
 * Declares forwarded methods that need no property bookkeeping.
 * @param {...string} names Method names.
 * @returns {ElementMethodMap}
 */
export function forward(...names) {
  return Object.fromEntries(names.map((name) => [name, null]));
}

/**
 * A tracker for a method whose first argument is the new value of one property.
 * @param {string} property Host property name.
 * @returns {MethodTracker}
 */
export function records(property) {
  return ([value]) => ({ [property]: value });
}

/**
 * A tracker for a method whose first argument is a partial set of options, keyed as the
 * properties are.
 * @param {unknown[]} args Call arguments.
 * @returns {Record<string, unknown>|null}
 */
export function recordsPatch([partial]) {
  return partial && typeof partial === 'object' ? /** @type {Record<string, unknown>} */ (partial) : null;
}

/**
 * The calls made on an element before its component exists, oldest first.
 * @returns {{size: number, push: (name: string, args: unknown[]) => void, drain: (run: (name: string, args: unknown[]) => void, ready?: () => boolean) => void}}
 */
export function createCallQueue() {
  /** @type {{name: string, args: unknown[]}[]} */
  const calls = [];
  return {
    get size() {
      return calls.length;
    },
    push(name, args) {
      calls.push({ name, args });
    },
    /**
     * Runs the calls in order while `ready` holds. A call that throws stops the run where a
     * sequence of direct calls would have stopped; what follows it stays queued.
     */
    drain(run, ready = () => true) {
      while (calls.length > 0 && ready()) {
        const { name, args } = /** @type {{name: string, args: unknown[]}} */ (calls.shift());
        run(name, args);
      }
    }
  };
}

/**
 * What a forwarded call returns: the component's answer, with the component itself swapped for
 * the element, so a chain stays on the element.
 * @param {unknown} value Component method result.
 * @param {object} component Backing component.
 * @param {HTMLElement} host Custom element.
 * @returns {unknown}
 */
export function forwardedResult(value, component, host) {
  if (value === component) return host;
  if (value && typeof (/** @type {PromiseLike<unknown>} */ (value)).then === 'function') {
    return /** @type {PromiseLike<unknown>} */ (value).then((resolved) => (resolved === component ? host : resolved));
  }
  return value;
}

/**
 * Whether a call to a method the DOM also defines is the DOM's. `element.remove()` removes the
 * element and `element.remove(id)` an item; `element.append(node)` adds a child and
 * `element.append(block)` a block.
 * @param {string} name Method name.
 * @param {unknown[]} args Call arguments.
 * @returns {boolean}
 */
export function isDomCall(name, args) {
  if (name === 'remove') return args.length === 0;
  if (name !== 'append') return false;
  const [first] = args;
  return args.length !== 1 || first === null || typeof first !== 'object'
    || typeof (/** @type {{nodeType?: unknown}} */ (first)).nodeType === 'number';
}
