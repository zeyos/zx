// @ts-check
import { defaultMessages, legacyMessageKeys } from './messages.js';

export { defaultMessages };

/** @typedef {(key: string) => string|null|undefined} Translator */

/** @type {Translator|null} */
let translator = null;
let language = 'en';

/**
 * Installs the host application's translation function, or clears it with null. The function
 * answers one key at a time; returning null, undefined, or the key itself means "no translation",
 * and resolution moves on to the default English catalogue (`defaultMessages`).
 * @param {Translator|null} fn Translator function.
 * @returns {void}
 */
export function setTranslator(fn) {
  if (fn !== null && typeof fn !== 'function') {
    throw new TypeError('Translator must be a function or null');
  }
  translator = fn;
}

/**
 * Sets the active language identifier.
 * @param {string} lang Language identifier such as "en" or "de-AT".
 * @returns {void}
 */
export function setLanguage(lang) {
  language = String(lang || 'en');
}

/**
 * Returns the active language identifier.
 * @returns {string}
 */
export function getLanguage() {
  return language;
}

/**
 * Asks the host translator for one key, without interpolating. A translator that returns null,
 * undefined, or the key itself has no answer.
 * @param {string} key Message key.
 * @returns {string|null} The translation, or null when there is none.
 */
export function hostMessage(key) {
  if (!translator) return null;
  const translated = translator(key);
  if (translated == null) return null;
  const text = String(translated);
  return text === key ? null : text;
}

/**
 * Looks one key up in the default English catalogue.
 * @param {string} key Message key.
 * @returns {string|null} The English text, or null when the catalogue has no entry.
 */
export function defaultMessage(key) {
  return Object.prototype.hasOwnProperty.call(defaultMessages, key)
    ? /** @type {Record<string, string>} */ (defaultMessages)[key] : null;
}

/**
 * The key a renamed message key replaced, which is still honoured for one major version.
 * @param {string} key Current message key.
 * @returns {string|null} The former key, or null when the key was never renamed.
 */
export function legacyMessageKey(key) {
  return Object.prototype.hasOwnProperty.call(legacyMessageKeys, key)
    ? /** @type {Record<string, string>} */ (legacyMessageKeys)[key] : null;
}

/**
 * Translates a key and interpolates arguments. The host translator answers first (then, for a
 * renamed key, the translator again under its former name), then the default English catalogue;
 * a key neither knows comes back unchanged.
 * @param {string} key Translation key.
 * @param {unknown[]|Record<string, unknown>|string|number} [args] Interpolation arguments.
 * @returns {string}
 */
export function translate(key, args) {
  const legacy = legacyMessageKey(key);
  const text = hostMessage(key) ?? (legacy ? hostMessage(legacy) : null) ?? defaultMessage(key) ?? key;
  return printf(text, args);
}

/**
 * Replaces one-based numeric placeholders and legacy percent-delimited placeholders.
 * Arrays replace `%1`, `%2`, and legacy placeholders in encounter order; objects replace
 * named placeholders such as `%name%`.
 * @param {string} str Template string.
 * @param {unknown[]|Record<string, unknown>|string|number} [args] Replacement values.
 * @returns {string}
 */
export function printf(str, args) {
  if (args == null) return String(str);

  const positional = Array.isArray(args) ? args :
    (typeof args === 'object' ? null : [args]);
  let output = String(str).replace(/%(\d+)/g, (placeholder, indexText) => {
    const index = Number(indexText) - 1;
    let value;
    if (positional) value = positional[index];
    else if (Object.prototype.hasOwnProperty.call(args, indexText)) value = args[indexText];
    return value == null ? placeholder : String(value);
  });

  let legacyIndex = 0;
  output = output.replace(/%([A-Za-z_][\w.-]*)%/g, (placeholder, key) => {
    if (!positional && Object.prototype.hasOwnProperty.call(args, key)) {
      const value = args[key];
      return value == null ? placeholder : String(value);
    }
    if (positional && legacyIndex < positional.length) {
      const value = positional[legacyIndex];
      legacyIndex += 1;
      return value == null ? placeholder : String(value);
    }
    return placeholder;
  });
  return output;
}
