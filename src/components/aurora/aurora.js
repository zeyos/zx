import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { isCssColor } from '../../core/util.js';

const PRESETS = Object.freeze(['source', 'confluence', 'horizon', 'diagonal', 'edge', 'curtain']);
const INTENSITIES = Object.freeze(['subtle', 'balanced', 'vivid']);
const COLOR_PROPERTIES = Object.freeze([
  '--zx-aurora-color-1', '--zx-aurora-color-2',
  '--zx-aurora-color-3', '--zx-aurora-color-4'
]);

/**
 * @typedef {Object} AuroraOptions
 * @property {'source'|'confluence'|'horizon'|'diagonal'|'edge'|'curtain'} [preset='source']
 *   Geometry of the ambient light field.
 * @property {string[]} [colors=[]] Zero to four concrete CSS colours. An empty list uses semantic
 *   Zx colours; shorter palettes repeat across the four gradient fields.
 * @property {'subtle'|'balanced'|'vivid'} [intensity='subtle'] Strength of the light field.
 */

/**
 * Decorative multicolour ambient light for an existing application surface.
 * Aurora owns no application content or interaction: it enhances the target in place and renders
 * its pointer-transparent light field behind the target's existing children.
 * @extends {Component<AuroraOptions>}
 */
export class Aurora extends Component {
  static cssName = 'aurora';

  /** @type {Readonly<AuroraOptions>} */
  static defaults = {
    preset: 'source',
    colors: [],
    intensity: 'subtle'
  };

  /**
   * Creates or enhances an Aurora surface.
   * @param {Element|string|null} [target=null] Existing surface, selector, or null.
   * @param {AuroraOptions} [options={}] Aurora options.
   */
  constructor(target = null, options = {}) {
    super(target, options);
  }

  /** @returns {HTMLElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._createdRoot = created;
    this._original = created ? null : snapshotTarget(root);
    this._cleaned = false;
    this._initialColors = COLOR_PROPERTIES.map((property) => ({
      property,
      value: root.style.getPropertyValue(property),
      priority: root.style.getPropertyPriority(property)
    }));
    this._colors = [];

    this.setPreset(this.options.preset);
    this.setIntensity(this.options.intensity);
    this.setColors(this.options.colors);
    return root;
  }

  /** Sets the light-field geometry without replacing surface content. @param {string} preset @returns {this} */
  setPreset(preset) {
    this.el.dataset.preset = normalizeAuroraPreset(preset);
    return this;
  }

  /** Sets zero to four concrete colours without replacing surface content. @param {string[]|null} colors @returns {this} */
  setColors(colors) {
    const palette = normalizeAuroraColors(colors);
    const fields = expandAuroraColors(palette);
    this._colors = [...palette];
    this.el.dataset.colors = palette.length === 0 ? 'semantic' : String(palette.length);

    if (fields.length === 0) {
      for (const initial of this._initialColors) {
        if (initial.value) this.el.style.setProperty(initial.property, initial.value, initial.priority);
        else this.el.style.removeProperty(initial.property);
      }
      return this;
    }
    for (let index = 0; index < COLOR_PROPERTIES.length; index += 1) {
      this.el.style.setProperty(COLOR_PROPERTIES[index], fields[index]);
    }
    return this;
  }

  /** Sets the light-field strength without replacing surface content. @param {string} intensity @returns {this} */
  setIntensity(intensity) {
    this.el.dataset.intensity = normalizeAuroraIntensity(intensity);
    return this;
  }

  /** Restores an enhanced target exactly, or removes an owned surface. @returns {void} */
  destroy() {
    if (this._cleaned) return;
    this._cleaned = true;
    super.destroy();
    if (!this._createdRoot) restoreTarget(this.el, this._original);
  }
}

/** @param {unknown} value @returns {'source'|'confluence'|'horizon'|'diagonal'|'edge'|'curtain'} */
export function normalizeAuroraPreset(value) {
  const preset = String(value ?? '').trim().toLowerCase();
  if (!PRESETS.includes(preset)) throw new TypeError(`Unknown Aurora preset: ${value}`);
  return /** @type {'source'|'confluence'|'horizon'|'diagonal'|'edge'|'curtain'} */ (preset);
}

/** @param {unknown} value @returns {'subtle'|'balanced'|'vivid'} */
export function normalizeAuroraIntensity(value) {
  const intensity = String(value ?? '').trim().toLowerCase();
  if (!INTENSITIES.includes(intensity)) throw new TypeError(`Unknown Aurora intensity: ${value}`);
  return /** @type {'subtle'|'balanced'|'vivid'} */ (intensity);
}

/** @param {unknown} value @returns {string[]} */
export function normalizeAuroraColors(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError('Aurora colors must be an array');
  if (value.length > COLOR_PROPERTIES.length) {
    throw new TypeError('Aurora accepts at most four colors');
  }
  return value.map((color) => {
    if (!isCssColor(color)) throw new TypeError(`Invalid Aurora color: ${color}`);
    return color.trim();
  });
}

/**
 * Repeats a one-to-three-colour palette deterministically across four gradient fields.
 * @param {string[]} colors
 * @returns {string[]}
 */
export function expandAuroraColors(colors) {
  if (colors.length === 0) return [];
  if (colors.length === 1) return [colors[0], colors[0], colors[0], colors[0]];
  if (colors.length === 2) return [colors[0], colors[1], colors[0], colors[1]];
  if (colors.length === 3) return [colors[0], colors[1], colors[2], colors[1]];
  return [...colors];
}
