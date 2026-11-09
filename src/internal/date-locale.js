import { formattingLocale } from '../core/i18n.js';

/**
 * The locale `Intl` writes a date in: a supported component option, then the active language,
 * including regional English, then English when neither can be used.
 * @param {string|string[]|null} [option] The component's `locale` option.
 * @returns {string|string[]}
 */
export function dateLocale(option) {
  return formattingLocale(option, Intl.DateTimeFormat);
}
