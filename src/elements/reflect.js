/**
 * Attribute value types supported by the custom-element wrappers.
 * @typedef {'string'|'number'|'boolean'|'json'} AttributeType
 */

/** Sentinel returned when an attribute value cannot be safely applied. */
export const INVALID_ATTRIBUTE = Symbol('invalid attribute');

/**
 * Coerces a serialized attribute into a component option value.
 * Missing boolean attributes are false; other missing attributes are undefined.
 *
 * @param {string|null} value Attribute text, or null when the attribute is absent.
 * @param {AttributeType} [type='string'] Requested option type.
 * @param {(message: string) => void} [warn=console.warn] Invalid-value reporter.
 * @returns {string|number|boolean|unknown|undefined|typeof INVALID_ATTRIBUTE}
 */
export function coerceAttribute(value, type = 'string', warn = console.warn) {
  assertType(type);
  if (type === 'boolean') return value !== null;
  if (value === null) return undefined;
  if (type === 'string') return value;

  if (type === 'number') {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
    warn(`Ignoring invalid number attribute: ${JSON.stringify(value)}`);
    return INVALID_ATTRIBUTE;
  }

  try {
    return JSON.parse(value);
  } catch {
    warn(`Ignoring invalid JSON attribute: ${JSON.stringify(value)}`);
    return INVALID_ATTRIBUTE;
  }
}

/**
 * Serializes a property value for attribute reflection.
 * A null return value means the corresponding attribute should be removed.
 *
 * @param {unknown} value Property value.
 * @param {AttributeType} [type='string'] Attribute representation.
 * @param {(message: string) => void} [warn=console.warn] Invalid-value reporter.
 * @returns {string|null|typeof INVALID_ATTRIBUTE}
 */
export function serializeAttribute(value, type = 'string', warn = console.warn) {
  assertType(type);
  if (type === 'boolean') return value ? '' : null;
  if (value === null || value === undefined) return null;

  if (type === 'number') {
    const number = Number(value);
    if (Number.isFinite(number)) return String(number);
    warn(`Ignoring invalid number property: ${String(value)}`);
    return INVALID_ATTRIBUTE;
  }

  if (type === 'json') {
    try {
      const serialized = JSON.stringify(value);
      if (serialized !== undefined) return serialized;
    } catch {
      // Report through the common warning below.
    }
    warn('Ignoring property that cannot be serialized as JSON');
    return INVALID_ATTRIBUTE;
  }

  return String(value);
}

/** @param {unknown} type @returns {asserts type is AttributeType} */
function assertType(type) {
  if (!['string', 'number', 'boolean', 'json'].includes(String(type))) {
    throw new TypeError(`Unknown reflected attribute type: ${String(type)}`);
  }
}
