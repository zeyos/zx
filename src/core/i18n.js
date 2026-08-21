// @ts-check
/** @typedef {(key: string) => string|null|undefined} Translator */

/** @type {Translator|null} */
let translator = null;
let language = 'en';

/**
 * Installs the host application's translation function, or clears it with null.
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
 * Translates a key through the injected host translator and interpolates arguments.
 * @param {string} key Translation key.
 * @param {unknown[]|Record<string, unknown>|string|number} [args] Interpolation arguments.
 * @returns {string}
 */
export function translate(key, args) {
  const translated = translator ? translator(key) : key;
  return printf(translated == null ? key : String(translated), args);
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
