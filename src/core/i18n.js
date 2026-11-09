// @ts-check
import { defaultMessages, legacyMessageKeys } from './messages.js';

export { defaultMessages };

/** @typedef {(key: string) => string|null|undefined} Translator */

/** @type {Translator|null} */
let translator = null;
let language = 'en';
/** @type {Map<string, Intl.PluralRules>} */
const pluralRules = new Map();

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
 * Selects a cardinal plural message before interpolation. The host's selected category, `other`,
 * and unsuffixed message are tried before English, which uses its own plural rules.
 * @param {string} key Unsuffixed translation key.
 * @param {number} count Finite numeric count, independent of interpolation arguments.
 * @param {unknown[]|Record<string, unknown>|string|number} [args] Interpolation arguments.
 * @param {{locale?: string}} [options={}] Plural-rule locale; defaults to the active language.
 * @returns {string}
 */
export function translatePlural(key, count, args, { locale } = {}) {
  const text = pluralMessage(pluralKeys(key, count, locale), hostMessage)
    ?? pluralMessage(pluralKeys(key, count, 'en'), defaultMessage)
    ?? key;
  return printf(text, args);
}

/**
 * Resolves a supported explicit locale, then the active language, then English. Locale lists
 * retain their preference order. Support is checked by the consuming Intl service, whose locale
 * data may differ from NumberFormat's; internal formatting consumers share this precedence.
 * @param {string|string[]|null} [option] Explicit locale or locale list.
 * @param {{supportedLocalesOf: (locales: string|string[]) => string[]}} [service=Intl.NumberFormat] Consuming Intl service.
 * @returns {string|string[]}
 */
export function formattingLocale(option, service = Intl.NumberFormat) {
  for (const candidate of [option, getLanguage(), 'en']) {
    if (candidate == null) continue;
    try {
      const locales = service.supportedLocalesOf(Intl.getCanonicalLocales(candidate));
      if (locales.length) return Array.isArray(candidate) ? locales : locales[0];
    } catch { /* An unusable explicit option falls through to the active language. */ }
  }
  return 'en';
}

/**
 * Ordered keys within one message source. Internal helper shared with Component.msgPlural.
 * @param {string} key Unsuffixed key.
 * @param {number} count Finite numeric count.
 * @param {string} [locale] Plural-rule locale.
 * @returns {string[]}
 */
export function pluralKeys(key, count, locale) {
  if (typeof count !== 'number' || !Number.isFinite(count)) {
    throw new TypeError('Plural count must be a finite number');
  }
  const effective = formattingLocale(locale, Intl.PluralRules);
  const cacheKey = String(effective);
  let rules = pluralRules.get(cacheKey);
  if (!rules) {
    rules = new Intl.PluralRules(effective);
    pluralRules.set(cacheKey, rules);
  }
  const category = rules.select(count);
  const legacy = legacyMessageKey(key);
  return [...new Set([`${key}.${category}`, `${key}.other`, key, ...(legacy ? [legacy] : [])])];
}

/**
 * Returns the first available message without asking a translator for subsequent keys.
 * @param {string[]} keys Candidate keys.
 * @param {(key: string) => string|null} lookup One message source.
 * @returns {string|null}
 */
export function pluralMessage(keys, lookup) {
  for (const key of keys) {
    const text = lookup(key);
    if (text !== null) return text;
  }
  return null;
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
  // One pass: a value already written into the text is never read as a placeholder.
  let legacyIndex = 0;
  return String(str).replace(/%(\d+)|%([A-Za-z_][\w.-]*)%(?!\d)/g, (placeholder, indexText, key) => {
    if (indexText !== undefined) {
      const index = Number(indexText) - 1;
      let value;
      if (positional) value = positional[index];
      else if (Object.prototype.hasOwnProperty.call(args, indexText)) value = args[indexText];
      return value == null ? placeholder : String(value);
    }
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
}
