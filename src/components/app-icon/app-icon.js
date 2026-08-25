import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { icon as renderIcon } from '../../core/icons.js';
import { isCssColor } from '../../core/util.js';

/**
 * @typedef {Object} AppIconOptions
 * @property {string|Node|(()=>string|Node)|null} [icon=null] Icon name, node, or lazy renderer.
 * @property {string|null} [color=null] Identity colour; falls back to the accent colour.
 * @property {number|string} [size=36] Edge length in pixels or any CSS length.
 * @property {number|string} [iconSize='52%'] Glyph size.
 * @property {string|null} [label=null] Accessible image label; null makes the icon decorative.
 * @property {string|number|null} [badge=null] Optional corner badge.
 * @property {boolean} [selected=false] Whether the icon represents the active application.
 * @property {false|'subtle'|'strong'} [glass='subtle'] CSS-first glass treatment.
 * @property {string|string[]} [class] Additional class names.
 */

/**
 * Stable application-identity tile with progressive CSS glass treatment.
 * @extends {Component<AppIconOptions>}
 */
export class AppIcon extends Component {
  static cssName = 'app-icon';

  /** @type {Readonly<AppIconOptions>} */
  static defaults = {
    icon: null,
    color: null,
    size: 36,
    iconSize: '52%',
    label: null,
    badge: null,
    selected: false,
    glass: 'subtle',
    class: []
  };

  /** @returns {HTMLElement} */
  render() {
    this._createdRoot = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('span'));
    this.el = root;
    this._snapshot = this._createdRoot ? null : snapshotTarget(root);
    this._state = { ...this.options };
    this._appliedClasses = [];
    this._sync();
    return root;
  }

  /** Updates identity or presentation without replacing the root. @param {Partial<AppIconOptions>} values @returns {this} */
  set(values = {}) {
    if (!values || typeof values !== 'object') return this;
    Object.assign(this._state, values);
    this._sync();
    return this;
  }

  /** Restores an enhanced target. @returns {void} */
  destroy() {
    const root = this.el;
    const snapshot = this._snapshot;
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, snapshot);
  }

  /** @returns {void} */
  _sync() {
    const state = this._state;
    this.el.classList.remove(...this._appliedClasses);
    this._appliedClasses = [state.class].flat()
      .flatMap((value) => String(value ?? '').split(/\s+/)).filter(Boolean);
    this.el.classList.add(...this._appliedClasses);
    const size = cssLength(state.size, '36px');
    const glyphSize = cssLength(state.iconSize, '52%');
    this.el.style.setProperty('--zx-app-icon-size', size);
    this.el.style.setProperty('--zx-app-icon-glyph-size', glyphSize);
    if (isCssColor(state.color)) this.el.style.setProperty('--zx-app-icon-color', String(state.color));
    else this.el.style.removeProperty('--zx-app-icon-color');
    this.el.dataset.glass = normalizeGlass(state.glass);
    this.el.toggleAttribute('data-selected', Boolean(state.selected));

    const label = state.label == null ? '' : String(state.label).trim();
    if (label) {
      this.el.setAttribute('role', 'img');
      this.el.setAttribute('aria-label', label);
      this.el.removeAttribute('aria-hidden');
    } else {
      this.el.removeAttribute('role');
      this.el.removeAttribute('aria-label');
      this.el.setAttribute('aria-hidden', 'true');
    }

    const visual = resolveVisual(state.icon);
    const badge = state.badge == null || state.badge === '' ? null : h('span', {
      class: 'zx-app-icon__badge', ariaHidden: 'true'
    }, String(state.badge));
    const children = [
      h('span', { class: 'zx-app-icon__shine', ariaHidden: 'true' }),
      h('span', { class: 'zx-app-icon__glyph', ariaHidden: 'true' }, visual)
    ];
    // Native replaceChildren() stringifies nullish arguments. Only append a badge when it exists,
    // otherwise the icon gets a visible "null" text node that can also disturb optical centring.
    if (badge) children.push(badge);
    this.el.replaceChildren(...children);
  }
}

/**
 * Creates an AppIcon element without retaining a component lifecycle handle.
 * @param {AppIconOptions} [options={}] Icon options.
 * @returns {HTMLElement}
 */
export function appIcon(options = {}) {
  return new AppIcon(null, options).toElement();
}

/** @param {AppIconOptions['icon']} value @returns {Node|string|null} */
function resolveVisual(value) {
  const resolved = typeof value === 'function' ? value() : value;
  if (typeof resolved === 'string') return renderIcon(resolved, { size: '1em' });
  return resolved && typeof resolved === 'object' && typeof resolved.nodeType === 'number'
    ? /** @type {Node} */ (resolved) : null;
}

/** @param {unknown} value @param {string} fallback @returns {string} */
function cssLength(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return `${Math.max(1, value)}px`;
  const text = String(value ?? '').trim();
  return text && !/[;{}]/.test(text) ? text : fallback;
}

/** @param {unknown} value @returns {'none'|'subtle'|'strong'} */
function normalizeGlass(value) {
  if (value === false || value === 'none') return 'none';
  return value === 'strong' ? 'strong' : 'subtle';
}
