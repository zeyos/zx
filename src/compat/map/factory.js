import { button, buttonGroup, icon, icons } from '../../index.js';
import { warnFunctionOnce } from './helpers.js';

/** Legacy glyph names accepted by `Factory.Icon()`. */
const ICON_NAMES = Object.freeze({
  list: 'list', plus: 'plus', clock: 'clock', range: 'filter', reload: 'reload', clear: 'x',
  settings: 'gear', eye: 'eye', trash: 'trash', fields: 'list', search: 'search', lock: 'lock',
  checked: 'check', question: 'info'
});

/** Legacy ZeyOS DOM factory mapped to Zx button and icon primitives. */
export const Factory = Object.freeze({
  /** @param {string} name @returns {SVGSVGElement} */
  Icon(name) {
    warnFactory();
    const mapped = ICON_NAMES[name] ?? (icons[name] ? name : null);
    if (!mapped) throw new RangeError(`Unsupported legacy icon: ${name}`);
    return icon(mapped);
  },
  /** @param {string} text @param {string} [type=''] @param {string} [iconName] @param {Record<string, any>} [options={}] @returns {HTMLButtonElement} */
  Button(text, type = '', iconName, options = {}) {
    warnFactory();
    const element = button({
      label: String(text ?? ''), icon: iconName ? ICON_NAMES[iconName] ?? iconName : null,
      kind: buttonKind(type), disabled: Boolean(options.disabled), title: options.title,
      onclick: options.onclick ?? options.onClick
    });
    for (const name of ['id', 'name', 'value']) if (options[name] != null) element.setAttribute(name, String(options[name]));
    return element;
  },
  /** @param {HTMLButtonElement[]} buttons @returns {HTMLDivElement} */
  ButtonsGroup(buttons) { warnFactory(); return buttonGroup(Array.isArray(buttons) ? buttons : []); }
});

/** @returns {void} */
function warnFactory() { warnFunctionOnce(warnFactory, 'gx.zeyos.Factory', 'button/icon'); }

/** @param {unknown} type @returns {'default'|'primary'|'danger'|'ghost'} */
function buttonKind(type) {
  const value = String(type ?? '').toLowerCase();
  if (value === 'dark' || value === 'em') return 'primary';
  if (value.includes('danger') || value.includes('error')) return 'danger';
  if (value.includes('ghost') || value.includes('link')) return 'ghost';
  return 'default';
}
