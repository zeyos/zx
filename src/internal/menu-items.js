import { h, safeHref } from '../core/dom.js';
import { icon } from '../core/icons.js';

/** @typedef {'menuitem'|'menuitemcheckbox'|'menuitemradio'} MenuItemRole */
/**
 * @typedef {Object} MenuController
 * @property {() => unknown} close Close the owning menu.
 */
/**
 * @typedef {Object} MenuItem
 * @property {string} label Item label.
 * @property {string} [icon] Kernel icon name.
 * @property {unknown} [value] Value emitted on selection.
 * @property {boolean} [disabled=false] Whether selection is disabled.
 * @property {boolean} [danger=false] Whether the action is dangerous.
 * @property {string} [href] Native-link destination.
 * @property {string} [target] Native-link target.
 * @property {string} [rel] Native-link relationship.
 * @property {string} [description] Supporting text under the label.
 * @property {string|number} [badge] Compact trailing metadata.
 * @property {string} [shortcut] Keyboard shortcut label.
 * @property {string|number|Node} [adornment] Additional trailing content.
 * @property {MenuItemRole} [role='menuitem'] APG role.
 * @property {boolean} [checked=false] Checked state for checkbox/radio roles.
 * @property {(value: unknown, item: MenuItem, controller: MenuController) => void} [onselect]
 *   Selection callback.
 */
/**
 * @typedef {Object} MenuHeading
 * @property {'heading'} type Entry kind.
 * @property {string} label Visible heading.
 */
/** @typedef {{type: 'separator'}} MenuSeparator */
/** @typedef {MenuItem|MenuHeading|MenuSeparator|'-'} MenuEntry */

export const MENU_ITEM_SELECTOR = [
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]'
].join(',');

/**
 * Reports whether an entry is an interactive menu action.
 * @param {MenuEntry|unknown} entry Candidate entry.
 * @returns {entry is MenuItem}
 */
export function isMenuItem(entry) {
  return Boolean(entry && entry !== '-' && typeof entry === 'object'
    && !['heading', 'separator'].includes(String(/** @type {{type?: unknown}} */ (entry).type ?? '')));
}

/**
 * Resolves the only APG roles accepted by the shared action model.
 * @param {MenuItem} item Item definition.
 * @returns {MenuItemRole}
 */
export function menuItemRole(item) {
  return ['menuitemcheckbox', 'menuitemradio'].includes(String(item.role))
    ? /** @type {MenuItemRole} */ (item.role)
    : 'menuitem';
}

/**
 * Builds one menu's entries with shared structure and link safety.
 * @param {MenuEntry[]} entries Entry definitions.
 * @param {string} block CSS block name, without the `zx-` prefix.
 * @returns {HTMLElement[]}
 */
export function renderMenuEntries(entries, block) {
  const nodes = [];
  entries.forEach((entry, index) => {
    if (entry === '-' || (entry && typeof entry === 'object' && entry.type === 'separator')) {
      nodes.push(h('div', { class: `zx-${block}__separator`, role: 'separator' }));
      return;
    }
    if (entry && typeof entry === 'object' && entry.type === 'heading') {
      nodes.push(h('div', {
        class: `zx-${block}__heading`,
        role: 'presentation'
      }, String(entry.label ?? '')));
      return;
    }
    if (!isMenuItem(entry)) return;

    const role = menuItemRole(entry);
    const href = safeHref(entry.href);
    const target = entry.target == null ? null : String(entry.target);
    const rel = entry.rel == null
      ? (target === '_blank' ? 'noopener noreferrer' : null)
      : String(entry.rel);
    const content = [];
    const leading = [];
    if (role !== 'menuitem') {
      leading.push(h('span', {
        class: `zx-${block}__check`,
        'data-check-kind': role === 'menuitemradio' ? 'radio' : 'checkbox'
      }));
    }
    if (entry.icon) leading.push(icon(entry.icon));
    content.push(h('span', {
      class: `zx-${block}__leading`,
      ariaHidden: 'true'
    }, leading));
    content.push(h('span', { class: `zx-${block}__body` },
      h('span', { class: `zx-${block}__label` }, String(entry.label ?? '')),
      entry.description == null || entry.description === '' ? null : h('span', {
        class: `zx-${block}__description`
      }, String(entry.description))));

    const meta = [];
    if (entry.badge != null) {
      meta.push(h('span', { class: `zx-${block}__badge` }, String(entry.badge)));
    }
    if (entry.shortcut) {
      meta.push(h('kbd', { class: `zx-${block}__shortcut` }, String(entry.shortcut)));
    }
    if (entry.adornment != null) {
      const adornment = entry.adornment && typeof entry.adornment === 'object'
        && 'nodeType' in entry.adornment
        ? /** @type {Node} */ (entry.adornment)
        : String(entry.adornment);
      meta.push(h('span', { class: `zx-${block}__adornment` }, adornment));
    }
    if (meta.length) content.push(h('span', { class: `zx-${block}__meta` }, meta));

    const properties = {
      class: `zx-${block}__item`,
      role,
      tabindex: '-1',
      'data-menu-item': String(index),
      'data-danger': entry.danger ? 'true' : null,
      ariaDisabled: entry.disabled ? 'true' : null,
      ariaChecked: role === 'menuitem' ? null : String(Boolean(entry.checked))
    };
    if (href) {
      nodes.push(h('a', { ...properties, href, target, rel }, content));
    } else {
      nodes.push(h('button', { ...properties, type: 'button' }, content));
    }
  });
  return nodes;
}
