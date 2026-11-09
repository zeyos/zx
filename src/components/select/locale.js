import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { getLanguage } from '../../core/i18n.js';
import { flagRenderer, normalizeRegion } from '../flag/flag.js';

/** @typedef {import('./select.js').SelectOptions} SelectOptions */
/** @typedef {import('../flag/flag.js').FlagMode} FlagMode */

/**
 * A locale the picker offers, when a bare tag is not enough.
 * @typedef {Object} LocaleItem
 * @property {string} code BCP 47 language tag (`'de'`, `'de-AT'`, `'zh-Hant-TW'`).
 * @property {string} [name] Label, replacing the one `Intl.DisplayNames` gives.
 * @property {string} [description] Secondary text, replacing the localized name.
 * @property {string|null} [region] Flag region, replacing the one the tag implies; `null` draws the
 *   language chip instead of a flag.
 */
/**
 * @typedef {Object} LocaleSelectOptions
 * @property {Array<string|LocaleItem>} [locales] The locales to offer, in the order given. Tags are
 *   canonicalized (`'de_at'` → `'de-AT'`); an invalid tag is left out. Without it the picker offers
 *   a short list of widely used languages.
 * @property {Array<string|LocaleItem>} [preferred=[]] Locales pinned above the list, kept through
 *   filtering — the application's own languages above a long list, say.
 * @property {string|null} [preferredLabel=null] Heading above the pinned locales.
 * @property {string|null} [displayLocale=null] The language the secondary name is written in. By
 *   default the component's `lang` option, then the library language (`setLanguage()`).
 * @property {'both'|'native'|'localized'} [display='both'] `native` names each locale in its own
 *   language ("Deutsch"), `localized` in the display language ("German"), and `both` shows the
 *   native name with the localized one beneath it where the two differ — so a reader finds their
 *   language whichever language the interface is in.
 * @property {FlagMode} [flags='auto'] What stands before each locale: the flag of its region
 *   (`auto` draws flag emoji where the platform has them and a language chip where it does not;
 *   `emoji` forces the emoji), a language chip (`code`, the honest choice where a language is not a
 *   country), nothing (`none`), or a function returning the content.
 * @property {string|null} [flagUrl=null] Flag image URL template, such as `'/flags/{code}.svg'`;
 *   `{code}` is the lower-case region, `{CODE}` the upper-case. Draws flags from the application's
 *   own flag set instead of emoji.
 * @property {Record<string, string|null>} [flagRegions={}] Flag region per tag or language, for a
 *   language whose likely region is not the one the application means: `{ en: 'GB' }`. A tag with
 *   a region of its own (`en-US`) keeps it unless it is listed here itself.
 * @property {boolean} [sort=false] Orders the locales by label rather than as given.
 */

/** Languages offered when the application names none, as a starting point. */
const DEFAULT_LOCALES = Object.freeze([
  'en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'cs', 'sv', 'da', 'fi', 'nb', 'tr', 'ru', 'uk',
  'el', 'ar', 'he', 'hi', 'ja', 'ko', 'zh'
]);

/**
 * Builds the items a locale picker lists, without the DOM: one `{ID, name, nameLang, description,
 * region, language}` per valid tag; `nameLang` is the language `name` is written in. Exposed for
 * a table or a summary that names locales the same way.
 * @param {Array<string|LocaleItem>} locales Tags or locale items.
 * @param {Pick<LocaleSelectOptions, 'displayLocale'|'display'|'flagRegions'|'sort'>} [options={}]
 *   Naming options.
 * @returns {Array<{ID: string, name: string, nameLang: string|null, description: string, region: string|null, language: string}>}
 */
export function localeItems(locales, options = {}) {
  const displayLocale = options.displayLocale || getLanguage() || 'en';
  const display = options.display ?? 'both';
  const flagRegions = options.flagRegions ?? {};
  const localized = displayNames(displayLocale, 'language');
  const seen = new Set();
  const items = [];
  for (const entry of Array.isArray(locales) ? locales : []) {
    const spec = typeof entry === 'string' ? { code: entry } : entry;
    const code = canonicalLocale(spec?.code);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const locale = new Intl.Locale(code);
    const base = locale.baseName;
    const nativeName = capitalize(displayNames(base, 'language')?.of(base) ?? base, base);
    const localizedName = capitalize(localized?.of(base) ?? base, displayLocale);
    const name = spec.name ?? (display === 'localized' ? localizedName : nativeName);
    const description = spec.description
      ?? (display === 'both' && localizedName.toLocaleLowerCase() !== nativeName.toLocaleLowerCase() ? localizedName : '');
    items.push({
      ID: code,
      name: String(name),
      nameLang: spec.name != null ? null : display === 'localized' ? displayLocale : code,
      description: String(description),
      region: 'region' in spec ? normalizeRegion(spec.region) : localeRegion(locale, code, flagRegions),
      language: locale.language
    });
  }
  if (options.sort) {
    const collator = new Intl.Collator(displayLocale);
    items.sort((a, b) => collator.compare(a.name, b.name));
  }
  return items;
}

/**
 * Turns locale preset options into the Select options behind them.
 * @param {LocaleSelectOptions & SelectOptions} options Locale preset options.
 * @returns {SelectOptions}
 */
export function localeSelectOptions(options) {
  const {
    locales = DEFAULT_LOCALES, preferred = [], preferredLabel = null, displayLocale = null,
    display = 'both', flags = 'auto', flagUrl = null, flagRegions = {}, sort = false,
    value = null, ...rest
  } = options ?? {};
  const naming = {
    displayLocale: displayLocale || rest.lang || rest.language || getLanguage(),
    display,
    flagRegions,
    sort
  };
  const items = localeItems(locales, naming);
  const pinned = localeItems(preferred, { ...naming, sort: false });
  const drawFlag = flagRenderer(flags, flagUrl);
  const visual = (item) => drawFlag(item.region, item.language.toUpperCase(), item);
  return {
    filter: items.length + pinned.length > 7 ? 'local' : false,
    ...rest,
    label: rest.label || message('localePicker.label', options),
    placeholder: rest.placeholder || message('localePicker.placeholder', options),
    items,
    fixedItems: pinned,
    fixedLabel: pinned.length ? preferredLabel : null,
    valueKey: 'ID',
    labelKey: 'name',
    searchKeys: ['name', 'description', 'ID'],
    value: typeof value === 'string' ? canonicalLocale(value) ?? value : value,
    renderItem: (item) => pickerRow(visual(item), item.name, item.description, item.nameLang),
    renderValueAdornment: (item) => visual(item)
  };
}

/**
 * Draws one picker row with the Select entity anatomy: a visual, a label, and secondary text.
 * @param {Node|string|null} visual Flag or chip.
 * @param {string} label Primary text.
 * @param {string} subtitle Secondary text, or `''`.
 * @param {string|null} labelLang Language of the label, so a screen reader speaks "Deutsch" in German.
 * @returns {HTMLElement}
 */
function pickerRow(visual, label, subtitle, labelLang) {
  return h('span', { class: 'zx-select__entity' },
    visual ? h('span', { class: 'zx-select__entity-icon', ariaHidden: 'true' }, visual) : null,
    h('span', { class: 'zx-select__entity-copy' },
      h('span', { class: 'zx-select__entity-label', ...(labelLang ? { lang: labelLang } : {}) }, label),
      subtitle ? h('span', { class: 'zx-select__entity-subtitle' }, subtitle) : null));
}

/**
 * Canonicalizes a BCP 47 tag, accepting `_` for `-`.
 * @param {unknown} tag Candidate tag.
 * @returns {string|null} The canonical tag, or null when it is not one.
 */
export function canonicalLocale(tag) {
  if (typeof tag !== 'string' || !tag.trim()) return null;
  try {
    return Intl.getCanonicalLocales(tag.trim().replaceAll('_', '-'))[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * The flag region of a locale: an override for the tag or its language, else its own region, else
 * the likely region of its language (`de` → `DE`, `ja` → `JP`).
 * @param {Intl.Locale} locale Parsed locale.
 * @param {string} code Canonical tag.
 * @param {Record<string, string|null>} overrides `flagRegions`.
 * @returns {string|null}
 */
function localeRegion(locale, code, overrides) {
  if (Object.hasOwn(overrides, code)) return normalizeRegion(overrides[code]);
  if (locale.region) return normalizeRegion(locale.region);
  if (Object.hasOwn(overrides, locale.language)) return normalizeRegion(overrides[locale.language]);
  try {
    return normalizeRegion(locale.maximize().region);
  } catch {
    return null;
  }
}

/**
 * @param {string} locale Display locale.
 * @param {'language'|'region'} type Name type.
 * @returns {Intl.DisplayNames|null}
 */
function displayNames(locale, type) {
  try {
    return new Intl.DisplayNames([locale, 'en'], { type, fallback: 'code', languageDisplay: 'standard' });
  } catch {
    return null;
  }
}

/**
 * Upper-cases the first letter in the given locale's rules: some languages name themselves in
 * lower case ("français"), which reads as a typo at the head of a list row.
 * @param {string} text Name.
 * @param {string} locale Locale of the name.
 * @returns {string}
 */
function capitalize(text, locale) {
  const [first = '', ...rest] = String(text);
  try {
    return first.toLocaleUpperCase(locale) + rest.join('');
  } catch {
    return first.toUpperCase() + rest.join('');
  }
}

/**
 * Resolves a message before the instance exists, honouring the picker's own `msg` option.
 * @param {string} key Message key.
 * @param {Record<string, any>} options Options the picker was given.
 * @returns {string}
 */
function message(key, options) {
  return Component.prototype.msg.call({ options }, key);
}
