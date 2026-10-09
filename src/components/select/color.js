import { isCssColor } from '../../core/util.js';

/** A reference to one custom property, such as `var(--zx-color-tone-blue-fg)`. */
const TOKEN_REFERENCE = /^var\(\s*--[\w-]+\s*\)$/;

/**
 * Accepts an item colour for an inline custom property: a CSS colour literal (`#0b7285`, `rgb(…)`,
 * `oklch(…)`, a named colour) or a reference to a design token (`var(--zx-color-tone-blue-fg)`),
 * so an item can follow the theme rather than fix one colour for light and dark alike. Anything
 * else — other functions, declarations, a `var()` with a fallback — is refused.
 *
 * Shared by `Select.entity()` and `TagPicker`, the two components that take a colour per item.
 *
 * @param {unknown} value Candidate colour.
 * @returns {string|null} The trimmed colour, or null when the value is not one.
 */
export function itemColor(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (TOKEN_REFERENCE.test(text)) return text;
  return isCssColor(text) ? text : null;
}
