import { h } from '../../core/dom.js';

/**
 * How a flag is drawn: `emoji` is the platform's flag glyph, `code` a small chip carrying the code
 * as text, `image` an `<img>` from a URL the application supplies, and `auto` the emoji where the
 * platform draws flag glyphs and the chip where it does not.
 * @typedef {'auto'|'emoji'|'code'|'image'} FlagKind
 */
/**
 * @typedef {Object} FlagOptions
 * @property {FlagKind} [kind='auto'] Drawing; `src` implies `image`.
 * @property {string|null} [src=null] Image URL. `{code}` in it is replaced by the lower-case region
 *   code and `{CODE}` by the upper-case one, so `'/flags/{code}.svg'` serves a whole flag set.
 * @property {string|null} [text=null] Text of the code chip, by default the region code. A chip
 *   also stands in for a flag when there is no valid region, as for a language without a country.
 * @property {string|null} [label=null] Accessible name. Without one the flag is decorative
 *   (`aria-hidden`) and must sit beside text that names the country or language.
 */
/**
 * What a picker draws in front of each choice: a {@link FlagKind} other than `image`, `none` for
 * nothing, or a function returning the content itself.
 * @typedef {'auto'|'emoji'|'code'|'none'|((region: string|null, item: Record<string, any>) => Node|string|null)} FlagMode
 */

/**
 * Every officially assigned ISO 3166-1 alpha-2 code, and `XK` (Kosovo), which is user-assigned but
 * in common use, in alphabetical order. `Select.country()` lists these when given no `countries`.
 * @type {ReadonlyArray<string>}
 */
export const COUNTRY_CODES = Object.freeze((
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS '
  + 'BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE '
  + 'EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM '
  + 'HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC '
  + 'LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA '
  + 'NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW '
  + 'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO '
  + 'TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'
).split(' '));

/** Code point of REGIONAL INDICATOR SYMBOL LETTER A, minus the code of `A`. */
const INDICATOR_OFFSET = 0x1F1E6 - 65;

/**
 * Settles a region code: two ASCII letters, upper-cased. Anything else — a numeric UN M.49 region
 * such as `419`, an empty value — is not a flag and reads as null.
 * @param {unknown} code Candidate region code.
 * @returns {string|null}
 */
export function normalizeRegion(code) {
  const text = typeof code === 'string' ? code.trim() : '';
  return /^[a-z]{2}$/i.test(text) ? text.toUpperCase() : null;
}

/**
 * Spells a region as its flag emoji: the pair of regional indicator symbols the platform's emoji
 * font draws as a flag (`'DE'` → 🇩🇪). Where the font has no flags the pair shows as two letters.
 * @param {unknown} code ISO 3166-1 alpha-2 region code.
 * @returns {string} The emoji, or `''` when the code is not two letters.
 */
export function flagEmoji(code) {
  const region = normalizeRegion(code);
  if (!region) return '';
  return String.fromCodePoint(...[...region].map((letter) => letter.charCodeAt(0) + INDICATOR_OFFSET));
}

/**
 * Reports whether this platform draws flag emoji as flags. Windows, for one, draws the regional
 * indicators as plain letters. The test draws a flag into a small canvas and looks for colour,
 * which costs a little each call, so a picker asks once and keeps the answer.
 * @param {Document|null} [doc=globalThis.document] Document to test in.
 * @returns {boolean} False without a document or a 2D canvas, as in Node.
 */
export function supportsFlagEmoji(doc = globalThis.document) {
  const canvas = /** @type {HTMLCanvasElement|null} */ (doc?.createElement?.('canvas') ?? null);
  let context = null;
  try {
    context = canvas?.getContext?.('2d', { willReadFrequently: true }) ?? null;
  } catch {
    context = null;
  }
  if (!canvas || !context) return false;
  const size = 24;
  canvas.width = size;
  canvas.height = size;
  context.textBaseline = 'top';
  context.font = `${size - 4}px sans-serif`;
  // Letters come out in the default black; a flag brings colour of its own.
  context.fillText(flagEmoji('DE'), 0, 0);
  let data;
  try {
    data = context.getImageData(0, 0, size, size).data;
  } catch {
    return false;
  }
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] > 0 && (data[index] !== data[index + 1] || data[index + 1] !== data[index + 2])) return true;
  }
  return false;
}

/**
 * Fills a flag URL template: `{code}` becomes the lower-case region code, `{CODE}` the upper-case.
 * @param {string} template URL template, such as `'/flags/{code}.svg'`.
 * @param {string} region Two-letter region code.
 * @returns {string}
 */
export function flagSource(template, region) {
  return String(template).replaceAll('{code}', region.toLowerCase()).replaceAll('{CODE}', region.toUpperCase());
}

/**
 * Draws a country flag, for a picker row, a table cell, or a profile — so a country reads the same
 * wherever it appears. The flag is decorative unless `label` is given: put the country's name
 * beside it.
 *
 * Zx ships no flag artwork. The default is the platform's flag emoji, and a code chip where the
 * platform has none; pass `src` to draw from any flag set the application serves.
 *
 * @param {string|null|undefined} code ISO 3166-1 alpha-2 region code (`'DE'`, `'at'`).
 * @param {FlagOptions} [options={}] Drawing and accessible-name options.
 * @returns {HTMLSpanElement} A `.zx-flag` element whose `data-kind` says how it was drawn.
 */
export function flag(code, options = {}) {
  const { kind = 'auto', src = null, text = null, label = null } = options ?? {};
  const region = normalizeRegion(code);
  let resolved = src ? 'image' : kind;
  if (resolved === 'auto') resolved = supportsFlagEmoji() ? 'emoji' : 'code';
  if (!region || (resolved === 'image' && !src)) resolved = 'code';
  let content;
  if (resolved === 'image') {
    content = h('img', {
      class: 'zx-flag__image',
      src: flagSource(/** @type {string} */ (src), /** @type {string} */ (region)),
      alt: '',
      loading: 'lazy',
      decoding: 'async'
    });
  } else if (resolved === 'emoji') {
    content = flagEmoji(region);
  } else {
    resolved = 'code';
    content = String(text ?? region ?? '').trim();
  }
  const element = /** @type {HTMLSpanElement} */ (h('span', {
    class: 'zx-flag',
    dataset: { kind: resolved, ...(region ? { region } : {}) }
  }, content));
  const name = label == null ? '' : String(label).trim();
  if (name) {
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', name);
  } else {
    element.setAttribute('aria-hidden', 'true');
  }
  return element;
}

/**
 * Builds the function a picker draws its flags with, resolving `auto` once rather than per row.
 * @param {FlagMode} mode What to draw.
 * @param {string|null} template Flag URL template; wins over the emoji and chip modes.
 * @returns {(region: string|null, text: string, item: Record<string, any>) => Node|string|null}
 */
export function flagRenderer(mode, template) {
  if (typeof mode === 'function') return (region, _text, item) => mode(region, item);
  if (mode === 'none' || mode === /** @type {any} */ (false)) return () => null;
  /** @type {FlagKind} */
  let kind = mode === 'emoji' || mode === 'code' ? mode : 'auto';
  if (template && kind !== 'code') kind = 'image';
  else if (kind === 'auto') kind = supportsFlagEmoji() ? 'emoji' : 'code';
  return (region, text) => flag(region, {
    kind,
    src: kind === 'image' ? template : null,
    text: text || null
  });
}
