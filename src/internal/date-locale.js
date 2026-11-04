import { getLanguage } from '../core/i18n.js';

/**
 * The locale `Intl` writes a date in: the component's own option, then the active language. An
 * English language leaves the choice to the browser, as these components always have, and so does
 * a tag `Intl` cannot use, which would otherwise throw while drawing.
 * @param {string|string[]|null} [option] The component's `locale` option.
 * @returns {string|string[]|undefined}
 */
export function dateLocale(option) {
  if (option != null) return option;
  const language = getLanguage();
  if (/^en(?:-|$)/i.test(language)) return undefined;
  try {
    Intl.getCanonicalLocales(language);
    return language;
  } catch {
    return undefined;
  }
}
