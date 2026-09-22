import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { button } from '../button/button.js';
import { Select } from '../select/select.js';

/** @typedef {{id:string,label:string}} SortField */
/** @typedef {{id:string,dir:'asc'|'desc'}} SortValue */
/**
 * @typedef {Object} SortControlOptions
 * @property {SortField[]} [fields=[]] Available sort fields, in display order.
 * @property {SortValue|null} [value=null] Initial sort; null chooses the first field ascending.
 * @property {string} [label='Sort by'] Accessible field label and direction-name prefix.
 * @property {{asc?:string,desc?:string}} [labels={}] Current/next direction labels, defaulting to Ascending/Descending.
 * @property {boolean} [disabled=false] Whether interaction is disabled.
 * @property {(event:CustomEvent<{value:SortValue}>)=>void} [onchange] Atomic field/direction change.
 */

/**
 * A searchable field selector with an adjacent direction toggle and one shared sort value.
 * @fires SortControl#change
 * @extends {Component<SortControlOptions>}
 */
export class SortControl extends Component {
  static cssName = 'sort-control';
  /** @type {SortControlOptions} */
  static defaults = { fields: [], value: null, label: 'Sort by', labels: {}, disabled: false };

  /** @returns {HTMLElement} */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(root);
    this.el = root;
    this._value = normalizeSortValue(this.options.value, this.options.fields);
    this._disabled = Boolean(this.options.disabled || !this.options.fields.length);
    this._direction = button({ kind: 'ghost', disabled: this._disabled });
    this._direction.classList.add('zx-sort-control__direction');
    this.listen(this._direction, 'click', () => {
      if (this._disabled || !this._value) return;
      this.setValue({ id: this._value.id, dir: this._value.dir === 'asc' ? 'desc' : 'asc' });
    });
    this._select = new Select(null, {
      items: sortChoices(this.options.fields), valueKey: 'id', labelKey: 'label',
      value: this._value?.id ?? null, label: this.options.label,
      filter: 'local', disabled: this._disabled,
      onchange: ({ detail }) => {
        if (!detail.item) return;
        this.setValue({ id: detail.item.id, dir: this._value?.dir ?? 'asc' });
      }
    });
    // The owned Select's DOM event must not duplicate the composite's atomic event.
    this.listen(this._select.el, 'zx-change', (event) => event.stopPropagation());
    root.replaceChildren(this._direction, this._select.el);
    this._syncDirection();
    return root;
  }

  /** Returns a defensive copy of the current sort. @returns {SortValue|null} */
  getValue() { return this._value ? { ...this._value } : null; }

  /**
   * Replaces the field and direction atomically; rejects unavailable fields and directions.
   * @param {SortValue|null} value Sort state, or null for the first field ascending.
   * @param {{silent?:boolean}} [options={}] Suppress change when silent.
   * @returns {this}
   */
  setValue(value, { silent = false } = {}) {
    const next = normalizeSortValue(value, this.options.fields);
    const changed = sortKey(next) !== sortKey(this._value);
    this._value = next;
    this._select.set(next?.id ?? null, { silent: true });
    this._syncDirection();
    if (changed && !silent) this.emit('change', { value: this.getValue() });
    return this;
  }

  /** Enables both controls when fields are available. @returns {this} */
  enable() {
    this._disabled = !this.options.fields.length;
    if (!this._disabled) this._select.enable();
    this._direction.disabled = this._disabled;
    return this;
  }
  /** Disables both controls and closes the option panel. @returns {this} */
  disable() {
    this._disabled = true;
    this._select.disable();
    this._direction.disabled = true;
    return this;
  }

  /** Updates the icon and accessible current/next direction text. @private @returns {void} */
  _syncDirection() {
    const dir = this._value?.dir ?? 'asc';
    const next = dir === 'asc' ? 'desc' : 'asc';
    const labels = { asc: 'Ascending', desc: 'Descending', ...this.options.labels };
    this._direction.replaceChildren(icon(dir === 'asc' ? 'arrow-up-wide-short' : 'arrow-down-wide-short'));
    this._direction.dataset.direction = dir;
    this._direction.setAttribute('aria-label', `${this.options.label}: ${labels[dir]}`);
    this._direction.title = `${labels[dir]} → ${labels[next]}`;
  }

  /** Focuses the searchable control. @returns {this} */
  focus() { this._select.focus(); return this; }
  /** Releases the owned Select and restores an enhanced target. @returns {void} */
  destroy() {
    this._select?.destroy();
    super.destroy();
    if (!this._createdRoot) restoreTarget(this.el, this._snapshot);
  }
}

/**
 * Validates a sort against available fields without retaining caller-owned state.
 * @param {SortValue|null} value Requested sort.
 * @param {SortField[]} fields Available fields.
 * @returns {SortValue|null} Normalized sort, or null for an empty catalogue.
 */
export function normalizeSortValue(value, fields) {
  if (!fields.length) return null;
  if (value == null) return { id: String(fields[0].id), dir: 'asc' };
  if (!fields.some((field) => String(field.id) === String(value.id))) throw new RangeError('Unknown sort field');
  if (value.dir !== 'asc' && value.dir !== 'desc') throw new RangeError('Unknown sort direction');
  return { id: String(value.id), dir: value.dir };
}

/**
 * Builds one searchable record per field without retaining caller-owned objects.
 * @param {SortField[]} fields Available fields.
 * @returns {SortField[]} Choice records.
 */
export function sortChoices(fields) {
  return fields.map((field) => ({ id: String(field.id), label: field.label }));
}

/** @param {SortValue|null} value Sort state. @returns {string} Stable choice key. */
function sortKey(value) { return value ? JSON.stringify([value.id, value.dir]) : ''; }

/** @event SortControl#change @type {CustomEvent<{value:SortValue}>} */
