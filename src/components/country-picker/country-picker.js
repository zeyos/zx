import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { getLanguage } from '../../core/i18n.js';
import { COUNTRY_CODES, flagRenderer, normalizeRegion } from '../flag/flag.js';
import { Select } from '../select/select.js';

/** @typedef {import('../select/select.js').SelectOptions} SelectOptions */
/** @typedef {import('../flag/flag.js').FlagMode} FlagMode */

/**
 * A country the picker offers, when a bare code is not enough.
 * @typedef {Object} CountryItem
 * @property {string} code ISO 3166-1 alpha-2 code (`'DE'`).
 * @property {string} [name] Label, replacing the one `Intl.DisplayNames` gives.
 * @property {string} [description] Secondary text, such as a calling code or a currency.
 */
/**
 * @typedef {Object} CountryPickerOptions
 * @property {Array<string|CountryItem>} [countries] The countries to offer. Without it, every
 *   ISO 3166-1 country (`COUNTRY_CODES`). A code that is not two letters is left out.
 * @property {Array<string|CountryItem>} [preferred=[]] Countries pinned above the list, in the
 *   order given and kept through filtering — the markets an application serves, say.
 * @property {string|null} [preferredLabel=null] Heading above the pinned countries.
 * @property {string|null} [displayLocale=null] The language country names are written in. By
 *   default the component's `lang` option, then the library language (`setLanguage()`).
 * @property {FlagMode} [flags='auto'] What stands before each country: its flag (`auto` draws flag
 *   emoji where the platform has them and a code chip where it does not; `emoji` forces the emoji),
 *   the code chip (`code`), nothing (`none`), or a function returning the content.
 * @property {string|null} [flagUrl=null] Flag image URL template, such as `'/flags/{code}.svg'`;
 *   `{code}` is the lower-case code, `{CODE}` the upper-case. Draws flags from the application's
 *   own flag set instead of emoji.
 * @property {boolean} [showCode=false] Shows the ISO code as secondary text.
 * @property {boolean} [sort=true] Orders the countries by name in the display language; `false`
 *   keeps the order given.
 */

/**
 * Country picker: a filterable `Select` over ISO 3166-1 countries, each named in the interface's
 * language and drawn with its flag. Names come from `Intl.DisplayNames`, so no translation table
 * ships with it. The value is the upper-case alpha-2 code (`'DE'`); `set()` accepts either case.
 *
 * Search matches the name, the code, and the English name, so "Germany" finds Deutschland in a
 * German interface. Everything else is Select: the APG combobox and its keyboard map, `change`,
 * `clearable`, `disabled`, and the field type (`zxselect` with `preset: 'country'`).
 *
 * @fires Select#change
 * @fires Select#open
 * @fires Select#close
 * @extends {Select}
 */
export class CountryPicker extends Select {
  /**
   * Creates a country picker.
   * @param {Element|string|null} target Component target.
   * @param {CountryPickerOptions & SelectOptions} [options={}] Country options, and Select overrides
   *   other than items, readers, and renderers.
   */
  constructor(target, options = {}) {
    super(target, countrySelectOptions(options));
    this.el.setAttribute('data-preset', 'country');
  }

  /**
   * Selects a country by code, in either case, or by item.
   * @param {unknown} idOrItem Code, item, or null.
   * @param {import('../select/select.js').SelectSetOptions} [options={}] Set options.
   * @returns {this}
   */
  set(idOrItem, options = {}) {
    return super.set(typeof idOrItem === 'string' ? normalizeRegion(idOrItem) ?? idOrItem : idOrItem, options);
  }

  /**
   * Builds the items a country picker lists, without the DOM: one `{ID, name, description, alias}`
   * per valid code, where `alias` is the English name. Exposed for a table or a summary that names
   * countries the same way.
   * @param {Array<string|CountryItem>} [countries=COUNTRY_CODES] Codes or country items.
   * @param {Pick<CountryPickerOptions, 'displayLocale'|'showCode'|'sort'>} [options={}] Naming options.
   * @returns {Array<{ID: string, name: string, description: string, alias: string}>}
   */
  static items(countries = COUNTRY_CODES, options = {}) {
    const displayLocale = options.displayLocale || getLanguage() || 'en';
    const names = displayNames(displayLocale);
    const english = displayNames('en');
    const seen = new Set();
    const items = [];
    for (const entry of Array.isArray(countries) ? countries : []) {
      const spec = typeof entry === 'string' ? { code: entry } : entry;
      const code = normalizeRegion(spec?.code);
      if (!code || seen.has(code)) continue;
      seen.add(code);
      items.push({
        ID: code,
        name: String(spec.name ?? names?.of(code) ?? code),
        description: String(spec.description ?? (options.showCode ? code : '')),
        alias: String(english?.of(code) ?? code)
      });
    }
    if (options.sort ?? true) {
      const collator = new Intl.Collator(displayLocale);
      items.sort((a, b) => collator.compare(a.name, b.name));
    }
    return items;
  }
}

/**
 * Turns country-picker options into the Select options behind them.
 * @param {CountryPickerOptions & SelectOptions} options Country-picker options.
 * @returns {SelectOptions}
 */
function countrySelectOptions(options) {
  const {
    countries = COUNTRY_CODES, preferred = [], preferredLabel = null, displayLocale = null,
    flags = 'auto', flagUrl = null, showCode = false, sort = true, value = null, ...rest
  } = options ?? {};
  const naming = { displayLocale: displayLocale || rest.lang || rest.language || getLanguage(), showCode };
  const items = CountryPicker.items(countries, { ...naming, sort });
  const pinned = CountryPicker.items(preferred, { ...naming, sort: false });
  const drawFlag = flagRenderer(flags, flagUrl);
  const visual = (item) => drawFlag(item.ID, item.ID, item);
  return {
    filter: 'local',
    ...rest,
    label: rest.label || message('countryPicker.label', options),
    placeholder: rest.placeholder || message('countryPicker.placeholder', options),
    items,
    fixedItems: pinned,
    fixedLabel: pinned.length ? preferredLabel : null,
    valueKey: 'ID',
    labelKey: 'name',
    searchKeys: ['name', 'ID', 'alias', 'description'],
    value: typeof value === 'string' ? normalizeRegion(value) ?? value : value,
    renderItem: (item) => pickerRow(visual(item), item.name, item.description),
    renderValueAdornment: (item) => visual(item)
  };
}

/**
 * Draws one picker row with the Select entity anatomy: a visual, a label, and secondary text.
 * @param {Node|string|null} visual Flag or chip.
 * @param {string} label Primary text.
 * @param {string} subtitle Secondary text, or `''`.
 * @returns {HTMLElement}
 */
function pickerRow(visual, label, subtitle) {
  return h('span', { class: 'zx-select__entity' },
    visual ? h('span', { class: 'zx-select__entity-icon', ariaHidden: 'true' }, visual) : null,
    h('span', { class: 'zx-select__entity-copy' },
      h('span', { class: 'zx-select__entity-label' }, label),
      subtitle ? h('span', { class: 'zx-select__entity-subtitle' }, subtitle) : null));
}

/**
 * @param {string} locale Display locale.
 * @returns {Intl.DisplayNames|null}
 */
function displayNames(locale) {
  try {
    return new Intl.DisplayNames([locale, 'en'], { type: 'region', fallback: 'code' });
  } catch {
    return null;
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
