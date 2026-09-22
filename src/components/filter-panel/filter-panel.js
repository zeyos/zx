// @ts-check
import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { printf } from '../../core/i18n.js';
import { uid } from '../../core/util.js';
import { Checklist } from '../checklist/checklist.js';
import { NumberField, parseNumber } from '../number-field/number-field.js';

/**
 * Number of options past which the select filter's `Checklist` gets its search box. Below it the
 * box is a tab stop that filters a list already visible in one glance.
 */
const SEARCH_THRESHOLD = 8;

/** Epoch numbers below this are read as seconds, above it as milliseconds. */
const SECONDS_CUTOFF = 1e11;

/** Step a `float` filter uses when the field metadata names none. */
const FLOAT_STEP = 0.01;

/** @typedef {'from'|'to'} FilterPanelEdge */
/** @typedef {'text'|'select'|'date'|'number'} FilterPanelKind */
/** @typedef {'draft'|'live'} FilterPanelMode */
/** @typedef {'seconds'|'ms'|'iso'|((date: Date, edge: FilterPanelEdge) => unknown)} FilterPanelSerialize */

/**
 * @typedef {Object} FilterPanelOption
 * @property {unknown} value Option value, emitted unchanged.
 * @property {string} [label] Visible label; defaults to the value.
 */

/**
 * @typedef {Object} FilterPanelField
 * @property {string} type One of `text`, `select`, `date`, `date:range`, `int`, `float`, `number`,
 *   `int:range`, `float:range`, `number:range`. Any other type renders as a labelled placeholder
 *   naming it and is left out of the value.
 * @property {string} [label] Visible filter name; defaults to the field key.
 * @property {Array<FilterPanelOption|Record<string, unknown>|string|number>} [options] Select
 *   options. `{value, label}` and `{ID, name}` are both understood, as are bare primitives.
 * @property {number|null} [min] Lowest accepted number, applied to both range edges.
 * @property {number|null} [max] Highest accepted number, applied to both range edges.
 * @property {number} [step] Number increment; defaults to 1 for `int` and 0.01 for `float`.
 * @property {string} [placeholder] Placeholder for the text and number inputs.
 * @property {boolean} [search] Forces the select filter's search box on or off, overriding the
 *   eight-option threshold.
 */

/**
 * @typedef {Object} FilterPanelSpec
 * @property {FilterPanelKind} kind Control family the type belongs to.
 * @property {boolean} range Whether the type carries a `from`/`to` pair.
 * @property {boolean} integer Whether a number type is whole-valued.
 */

/**
 * @typedef {Object} FilterPanelApplyDetail
 * @property {Record<string, unknown>} value Committed filter values, pruned and serialized.
 */

/**
 * @typedef {Object} FilterPanelChangeDetail
 * @property {Record<string, unknown>} value The draft as it would be applied.
 * @property {string|null} field Field that moved, or null when the whole value was replaced.
 */

/**
 * @typedef {Object} FilterPanelOptions
 * @property {Record<string, FilterPanelField>} [fields={}] Field metadata exactly as a list
 *   response publishes it. An empty map is the ordinary case, not an error: it renders `emptyText`.
 * @property {string[]|null} [order=null] Display order by field key; omitted keeps object order.
 *   Keys the map does not declare are ignored, and fields the order omits follow in map order.
 * @property {Record<string, unknown>} [value={}] Applied filters. The draft starts as a copy.
 * @property {FilterPanelMode} [mode='draft'] `'draft'` collects edits until `apply()`; `'live'`
 *   applies every committed edit.
 * @property {FilterPanelSerialize} [serialize='seconds'] How a date leaves the component. A range's
 *   lower bound takes the start of its day and its upper bound the end, so a one-day range matches.
 * @property {string|null} [emptyText=null] Text shown when `fields` is empty; null resolves
 *   `filterPanel.empty`.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<FilterPanelApplyDetail>) => void} [onapply] Apply listener.
 * @property {(event: CustomEvent<FilterPanelChangeDetail>) => void} [onchange] Change listener.
 */

/**
 * Declarative filter form built from the field metadata a list endpoint publishes, producing the
 * query object that endpoint expects back.
 *
 * It is neither of the other two filter components: `DataFilter` filters rows that are already in
 * the browser, and `Filter` builds an operator AST. This one turns `{key: {type, label, options}}`
 * into controls and gives back `{key: value}` — pruned to the constraints that are actually set,
 * with `0` counted as one of them.
 *
 * Draft mode is the default because a control that applies on change reflows the list underneath
 * the panel being read, and costs a request per edit. `'live'` is the deliberate opt-in.
 *
 * Each control family commits at its own natural granularity: text filters on every keystroke,
 * dates when the picker produces a complete date, checkboxes immediately, and numbers when
 * `NumberField` commits them (blur, Enter, or a step) rather than half-typed.
 *
 * @fires FilterPanel#apply
 * @fires FilterPanel#change
 * @extends {Component<FilterPanelOptions>}
 */
export class FilterPanel extends Component {
  static cssName = 'filter-panel';

  /** @type {FilterPanelOptions} */
  static defaults = {
    fields: {},
    order: null,
    value: {},
    mode: 'draft',
    serialize: 'seconds',
    emptyText: null
  };

  /** @returns {HTMLElement} Panel root. */
  render() {
    // render() runs inside the base constructor, before class-field initializers would run.
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(/** @type {Element} */ (this.el));
    this._restored = false;
    this._entries = [];
    this._children = [];
    this._writing = false;
    this._draft = {};
    this._applied = {};
    this._appliedDraft = '';

    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;

    this._fields = orderFields(this.options.fields, this.options.order);
    this._draft = toDraft(this.options.value, this.options.fields);
    this._applied = serializeFilterValue(this._draft, this.options.fields, this.options.serialize);
    this._appliedDraft = draftKey(this._draft);

    const children = [];
    if (this._fields.length === 0) {
      children.push(h('p', {
        ref: 'empty',
        class: 'zx-filter-panel__empty',
        role: 'status'
      }, this.options.emptyText == null
        ? this._message('filterPanel.empty', 'No filters are available here.')
        : String(this.options.emptyText)));
    } else {
      const host = h('div', { ref: 'fields', class: 'zx-filter-panel__fields' });
      for (const { key, field, spec } of this._fields) host.append(this._buildField(key, field, spec));
      children.push(host, this._buildActions());
    }

    root.replaceChildren(...children);
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', this._message('filterPanel.label', 'Filters'));
    root.setAttribute('data-mode', this.options.mode === 'live' ? 'live' : 'draft');

    // Enter anywhere in the form is "apply", the keyboard equivalent of the button. Buttons are
    // excluded: Enter on one already activates it, and applying twice would emit twice.
    this.listen(root, 'keydown', (event) => {
      const key = /** @type {KeyboardEvent} */ (event).key;
      if (key !== 'Enter' || this.options.mode === 'live') return;
      const target = /** @type {HTMLElement|null} */ (event.target);
      if (!target?.matches?.('input:not([type="checkbox"]):not([type="radio"])')) return;
      event.preventDefault();
      this.apply();
    });

    this._syncActions();
    return root;
  }

  /**
   * Returns the applied value: only the constraints that are set, with dates serialized through
   * `serialize`. Unknown field types are never part of it.
   * @returns {Record<string, unknown>}
   */
  getValue() {
    return cloneValue(this._applied);
  }

  /**
   * Replaces both the applied value and the draft the controls show. Accepts what `getValue()`
   * returns as well as raw input values, so a value that survived a URL round-trip goes back in.
   * @param {Record<string, unknown>} value Filter values keyed by field.
   * @returns {this}
   * @fires FilterPanel#change
   */
  setValue(value) {
    this._draft = toDraft(value, this.options.fields);
    this._commit(this._draftValue());
    this._writeControls();
    this._syncActions();
    this.emit('change', { value: this.getValue(), field: null });
    return this;
  }

  /**
   * Commits the draft. In live mode every committed edit already does this; calling it directly is
   * how a host forces a reload with the values that are on screen.
   * @returns {this}
   * @fires FilterPanel#apply
   */
  apply() {
    const value = this._draftValue();
    this._commit(value);
    this._syncActions(value);
    this.emit('apply', { value: this.getValue() });
    return this;
  }

  /**
   * Restores the controls to the `value` the panel was constructed with **without committing**, so
   * the filters in force stay in force. This is the Cancel half of a sheet: the panel goes back to
   * showing what is being filtered by. Contrast `clear()`, which commits. In live mode there is no
   * uncommitted draft to hold back, so there it applies like any other edit.
   * @returns {this}
   * @fires FilterPanel#change
   * @fires FilterPanel#apply
   */
  reset() {
    return this._replaceDraft(toDraft(this.options.value, this.options.fields));
  }

  /**
   * Empties every control **and commits**, in both modes. "Clear the filters" has one meaning, and
   * leaving a list filtered behind a panel showing no filters is not it — the records look missing
   * and nothing on screen explains why. Contrast `reset()`, which restores the controls without
   * committing. The price is one unfiltered load at the moment the button is pressed, which is
   * also the feedback that says the filters are gone.
   * @returns {this}
   * @fires FilterPanel#change
   * @fires FilterPanel#apply
   */
  clear() {
    return this._replaceDraft(toDraft({}, this.options.fields), { commit: true });
  }

  /** Destroys the composed controls and puts an enhanced target back as found. @returns {void} */
  destroy() {
    for (const child of this._children) child.destroy();
    this._children = [];
    if (!this._restored && !this._createdRoot) {
      restoreTarget(/** @type {Element} */ (this.el), this._snapshot);
      this._restored = true;
    }
    super.destroy();
  }

  /** @returns {HTMLElement} The actions row. */
  _buildActions() {
    const actions = h('div', { ref: 'actions', class: 'zx-filter-panel__actions' });
    if (this.options.mode !== 'live') {
      const apply = h('button', {
        ref: 'apply',
        class: 'zx-btn zx-filter-panel__apply',
        type: 'button',
        dataset: { kind: 'primary', size: 'md' }
      }, h('span', { class: 'zx-btn__label' }, this._message('filterPanel.apply', 'Apply')));
      this.listen(apply, 'click', () => this.apply());
      actions.append(apply);
    }
    const clear = h('button', {
      ref: 'clear',
      class: 'zx-btn zx-filter-panel__clear',
      type: 'button',
      dataset: { kind: 'ghost', size: 'md' }
    }, h('span', { class: 'zx-btn__label' }, this._message('filterPanel.clear', 'Clear all')));
    this.listen(clear, 'click', () => this.clear());
    actions.append(clear);
    return actions;
  }

  /**
   * @param {string} key Field key.
   * @param {FilterPanelField} field Field metadata.
   * @param {FilterPanelSpec|null} spec Resolved type, or null when the type is unknown.
   * @returns {HTMLElement}
   */
  _buildField(key, field, spec) {
    const label = String(field.label ?? key);
    const wrapper = h('div', {
      class: 'zx-filter-panel__field',
      dataset: { field: key, type: String(field.type ?? '') }
    });

    if (!spec) {
      // Never dropped silently and never guessed at: the placeholder names the type it could not
      // render, so the gap is visible to whoever configured the instance.
      wrapper.setAttribute('data-state', 'unsupported');
      wrapper.append(
        h('span', { class: 'zx-filter-panel__label' }, label),
        h('p', { class: 'zx-filter-panel__unsupported', role: 'note' },
          this._message('filterPanel.unsupported', 'Unsupported filter type: %1', String(field.type ?? '')))
      );
      return wrapper;
    }

    if (spec.kind === 'select') wrapper.append(this._buildSelect(key, field, label));
    else if (spec.kind === 'text') wrapper.append(...this._buildText(key, field, label));
    else if (spec.kind === 'date') wrapper.append(...this._buildDate(key, field, label, spec));
    else wrapper.append(...this._buildNumber(key, field, label, spec));
    return wrapper;
  }

  /**
   * @param {string} key Field key.
   * @param {FilterPanelField} field Field metadata.
   * @param {string} label Visible filter name.
   * @returns {Element} The checklist root.
   */
  _buildSelect(key, field, label) {
    const options = normalizeOptions(field.options);
    const chosen = /** @type {unknown[]} */ (this._draft[key] ?? []);
    // `Checklist` renders its own heading and points `aria-labelledby` at it, so the group is named
    // after the filter rather than after the component; a second label above it would print both.
    const checklist = new Checklist(null, {
      items: options.map((option) => ({
        ...option,
        on: chosen.some((value) => sameValue(value, option.value))
      })),
      valueKey: 'value',
      labelKey: 'label',
      search: typeof field.search === 'boolean' ? field.search : options.length > SEARCH_THRESHOLD,
      height: 220,
      msg: { 'checklist.label': label }
    });
    checklist.on('change', () => this._edited(key, checklist.getValues()));
    this._isolate(checklist);
    this._children.push(checklist);
    this._entries.push({ key, write: (value) => checklist.setValues(/** @type {unknown[]} */ (value ?? [])) });
    return checklist.toElement();
  }

  /**
   * @param {string} key Field key.
   * @param {FilterPanelField} field Field metadata.
   * @param {string} label Visible filter name.
   * @returns {Element[]}
   */
  _buildText(key, field, label) {
    const id = uid('zx-filter-panel-text');
    const input = h('input', {
      id,
      class: 'zx-filter-panel__input',
      type: 'search',
      autocomplete: 'off',
      placeholder: String(field.placeholder ?? ''),
      value: String(this._draft[key] ?? '')
    });
    this.listen(input, 'input', () => this._edited(key, /** @type {HTMLInputElement} */ (input).value));
    this._entries.push({
      key,
      write: (value) => { /** @type {HTMLInputElement} */ (input).value = value == null ? '' : String(value); }
    });
    return [h('label', { class: 'zx-filter-panel__label', for: id }, label), input];
  }

  /**
   * @param {string} key Field key.
   * @param {FilterPanelField} field Field metadata.
   * @param {string} label Visible filter name.
   * @param {FilterPanelSpec} spec Resolved type.
   * @returns {Element[]}
   */
  _buildDate(key, field, label, spec) {
    if (!spec.range) {
      const id = uid('zx-filter-panel-date');
      const input = this._dateInput(String(this._draft[key] ?? ''), { id });
      this.listen(input, 'change', () => this._edited(key, /** @type {HTMLInputElement} */ (input).value));
      this._entries.push({
        key,
        write: (value) => { /** @type {HTMLInputElement} */ (input).value = value == null ? '' : String(value); }
      });
      return [h('label', { class: 'zx-filter-panel__label', for: id }, label), input];
    }

    const labelId = uid('zx-filter-panel-label');
    const draft = /** @type {{from?: unknown, to?: unknown}} */ (this._draft[key] ?? {});
    const inputs = {};
    const edges = /** @type {FilterPanelEdge[]} */ (['from', 'to']).map((edge) => {
      const id = uid('zx-filter-panel-date');
      const input = this._dateInput(String(draft[edge] ?? ''), {
        id,
        // One `<label for>` cannot name two inputs, so each edge carries the composed name. The
        // visible word is part of it, which is what keeps the spoken and the printed label agreed.
        ariaLabel: this._edgeName(label, edge)
      });
      inputs[edge] = input;
      this.listen(input, 'change', () => this._editedEdge(key, edge, /** @type {HTMLInputElement} */ (input).value));
      return h('div', { class: 'zx-filter-panel__edge' },
        h('label', { class: 'zx-filter-panel__edge-label', for: id }, this._edgeLabel(edge)),
        input);
    });

    this._entries.push({
      key,
      write: (value) => {
        const next = /** @type {{from?: unknown, to?: unknown}} */ (value ?? {});
        for (const edge of ['from', 'to']) {
          inputs[edge].value = next[edge] == null ? '' : String(next[edge]);
        }
      }
    });
    return [
      h('span', { class: 'zx-filter-panel__label', id: labelId }, label),
      h('div', { class: 'zx-filter-panel__range', role: 'group', ariaLabelledby: labelId }, edges)
    ];
  }

  /**
   * @param {string} value Initial `YYYY-MM-DD` value.
   * @param {Record<string, unknown>} props Extra properties.
   * @returns {HTMLInputElement}
   */
  _dateInput(value, props) {
    // A native date input, deliberately: the value has to round-trip through a URL and the platform
    // picker is the one keyboard path nobody has to test.
    return /** @type {HTMLInputElement} */ (h('input', {
      class: 'zx-filter-panel__input',
      type: 'date',
      autocomplete: 'off',
      value,
      ...props
    }));
  }

  /**
   * @param {string} key Field key.
   * @param {FilterPanelField} field Field metadata.
   * @param {string} label Visible filter name.
   * @param {FilterPanelSpec} spec Resolved type.
   * @returns {Element[]}
   */
  _buildNumber(key, field, label, spec) {
    const labelId = uid('zx-filter-panel-label');
    if (!spec.range) {
      const control = this._numberField(field, spec, label, /** @type {number|null} */ (this._draft[key] ?? null));
      control.on('change', () => this._edited(key, control.get()));
      this._entries.push({ key, write: (value) => control.set(/** @type {number|null} */ (value ?? null), { silent: true }) });
      return [
        h('span', { class: 'zx-filter-panel__label', id: labelId }, label),
        control.toElement()
      ];
    }

    const draft = /** @type {{from?: unknown, to?: unknown}} */ (this._draft[key] ?? {});
    const controls = {};
    const edges = /** @type {FilterPanelEdge[]} */ (['from', 'to']).map((edge) => {
      const control = this._numberField(field, spec, this._edgeName(label, edge),
        /** @type {number|null} */ (draft[edge] ?? null));
      controls[edge] = control;
      control.on('change', () => this._editedEdge(key, edge, control.get()));
      return h('div', { class: 'zx-filter-panel__edge' },
        h('span', { class: 'zx-filter-panel__edge-label' }, this._edgeLabel(edge)),
        control.toElement());
    });

    this._entries.push({
      key,
      write: (value) => {
        const next = /** @type {{from?: unknown, to?: unknown}} */ (value ?? {});
        for (const edge of ['from', 'to']) {
          controls[edge].set(/** @type {number|null} */ (next[edge] ?? null), { silent: true });
        }
      }
    });
    return [
      h('span', { class: 'zx-filter-panel__label', id: labelId }, label),
      h('div', { class: 'zx-filter-panel__range', role: 'group', ariaLabelledby: labelId }, edges)
    ];
  }

  /**
   * @param {FilterPanelField} field Field metadata.
   * @param {FilterPanelSpec} spec Resolved type.
   * @param {string} name Accessible name for the spinbutton.
   * @param {number|null} value Initial value.
   * @returns {NumberField}
   */
  _numberField(field, spec, name, value) {
    // `NumberField` snaps onto its step, so a float filter needs a fractional one or it would round
    // every amount to a whole number. Field metadata that names a `step` always wins.
    const step = Number.isFinite(Number(field.step)) && Number(field.step) > 0
      ? Number(field.step)
      : (spec.integer ? 1 : FLOAT_STEP);
    const control = new NumberField(null, {
      value,
      min: field.min == null ? null : Number(field.min),
      max: field.max == null ? null : Number(field.max),
      step,
      precision: spec.integer ? 0 : null,
      placeholder: String(field.placeholder ?? ''),
      label: name
    });
    this._isolate(control);
    this._children.push(control);
    return control;
  }

  /** @param {FilterPanelEdge} edge Range edge. @returns {string} */
  _edgeLabel(edge) {
    return edge === 'from' ? this._message('filterPanel.from', 'From') : this._message('filterPanel.to', 'To');
  }

  /** @param {string} label Filter name. @param {FilterPanelEdge} edge Range edge. @returns {string} */
  _edgeName(label, edge) {
    return edge === 'from'
      ? this._message('filterPanel.rangeFrom', '%1 from', label)
      : this._message('filterPanel.rangeTo', '%1 to', label);
  }

  /** @param {string} key Field key. @param {unknown} value Raw draft value. @returns {void} */
  _edited(key, value) {
    if (this._writing) return;
    this._draft[key] = value;
    this._afterEdit(key);
  }

  /**
   * @param {string} key Field key.
   * @param {FilterPanelEdge} edge Range edge.
   * @param {unknown} value Raw edge value.
   * @returns {void}
   */
  _editedEdge(key, edge, value) {
    if (this._writing) return;
    const current = this._draft[key];
    const range = current !== null && typeof current === 'object' && !Array.isArray(current)
      ? { .../** @type {Record<string, unknown>} */ (current) }
      : {};
    range[edge] = value;
    this._draft[key] = range;
    this._afterEdit(key);
  }

  /** @param {string} key Field key. @returns {void} */
  _afterEdit(key) {
    const value = this._draftValue();
    this._syncActions(value);
    this.emit('change', { value, field: key });
    if (this.options.mode === 'live') this.apply();
  }

  /**
   * Keeps a composed control's own bubbling DOM events off the panel root. `Checklist` and
   * `NumberField` both emit `zx-change`, which is a name this panel uses with a different detail,
   * so a host listening on the panel root would otherwise see two shapes of one event. They stay
   * available on the control's own root, exactly where that control put them.
   * @param {Component} child Composed control.
   * @returns {void}
   */
  _isolate(child) {
    for (const type of ['zx-change', 'zx-input']) {
      this.listen(child.el, type, (event) => event.stopPropagation());
    }
  }

  /**
   * @param {Record<string, unknown>} draft Replacement draft.
   * @param {{commit?: boolean}} [options={}] Set `commit` to apply the replacement as well.
   * @returns {this}
   */
  _replaceDraft(draft, { commit = false } = {}) {
    this._draft = draft;
    this._writeControls();
    const value = this._draftValue();
    // Live mode holds no uncommitted draft, so every replacement commits there whatever the caller
    // asked for. The commit lands before `change` is emitted so a listener reading the panel back
    // sees the state it is being told about; the `apply` event still follows `change`.
    const committing = commit || this.options.mode === 'live';
    if (committing) this._commit(value);
    this._syncActions(value);
    this.emit('change', { value, field: null });
    if (committing) this.emit('apply', { value: this.getValue() });
    return this;
  }

  /** @param {Record<string, unknown>} value The draft value becoming the applied one. @returns {void} */
  _commit(value) {
    this._applied = value;
    this._appliedDraft = draftKey(this._draft);
  }

  /** @returns {Record<string, unknown>} The draft, serialized and pruned. */
  _draftValue() {
    return serializeFilterValue(this._draft, this.options.fields, this.options.serialize);
  }

  /** Pushes the draft back into the controls without re-entering the edit path. @returns {void} */
  _writeControls() {
    this._writing = true;
    try {
      for (const entry of this._entries) entry.write(this._draft[entry.key]);
    } finally {
      this._writing = false;
    }
  }

  /** @param {Record<string, unknown>} [value] The draft value, when it is already at hand. @returns {void} */
  _syncActions(value = this._draftValue()) {
    const active = Object.keys(value).length > 0;
    const clear = /** @type {HTMLButtonElement|undefined} */ (this.refs.clear);
    // Disabled rather than hidden: a control that disappears moves everything below it while the
    // panel is being read.
    if (clear) clear.disabled = !active;
    if (this.options.mode === 'live' || this._fields.length === 0) return;
    const dirty = draftKey(this._draft) !== this._appliedDraft;
    if (dirty) this.el.setAttribute('data-state', 'dirty');
    else this.el.removeAttribute('data-state');
  }

  /**
   * Resolves a message through the host translator, falling back to the built-in English text.
   * @param {string} key Message key.
   * @param {string} fallback Built-in text, with `%1`-style placeholders.
   * @param {...unknown} args Interpolation values.
   * @returns {string}
   */
  _message(key, fallback, ...args) {
    const message = this.msg(key, ...args);
    return message === key ? printf(fallback, args) : message;
  }
}

/**
 * Committed filter values, ready to send to the list endpoint. In draft mode this is the Apply
 * button or `apply()`; in live mode it is every committed edit.
 * @event FilterPanel#apply
 * @type {CustomEvent<FilterPanelApplyDetail>}
 */

/**
 * Any change to the draft, with the field that moved (null when the whole value was replaced).
 * `value` is the draft as it would be applied.
 * @event FilterPanel#change
 * @type {CustomEvent<FilterPanelChangeDetail>}
 */

/**
 * Resolves a declared field type. Returns null for a type the panel cannot render, which is what
 * makes an unknown type a visible placeholder rather than a guess.
 * @param {unknown} type Declared type.
 * @returns {FilterPanelSpec|null}
 */
export function parseFieldType(type) {
  switch (String(type ?? '').trim().toLowerCase()) {
    case 'text': return { kind: 'text', range: false, integer: false };
    case 'select': return { kind: 'select', range: false, integer: false };
    case 'date': return { kind: 'date', range: false, integer: false };
    case 'date:range': return { kind: 'date', range: true, integer: false };
    case 'int': return { kind: 'number', range: false, integer: true };
    case 'float':
    case 'number': return { kind: 'number', range: false, integer: false };
    case 'int:range': return { kind: 'number', range: true, integer: true };
    case 'float:range':
    case 'number:range': return { kind: 'number', range: true, integer: false };
    default: return null;
  }
}

/**
 * Whether a value is a constraint rather than an absent one. `0` is a value; `''`, `null`,
 * `undefined`, `NaN`, `[]` and `{from: null, to: null}` are not.
 * @param {unknown} value Candidate value.
 * @returns {boolean}
 */
export function isActiveValue(value) {
  if (value === null || value === undefined) return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (Array.isArray(value)) return value.some((entry) => isActiveValue(entry));
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'object') return Object.values(value).some((entry) => isActiveValue(entry));
  return true;
}

/**
 * Drops every entry that is not a constraint, and every inactive edge of a range, so an
 * open-ended range emits only the bound it has.
 * @param {Record<string, unknown>} value Candidate values keyed by field.
 * @returns {Record<string, unknown>}
 */
export function pruneValue(value) {
  /** @type {Record<string, unknown>} */
  const result = {};
  if (!isPlainObject(value)) return result;
  for (const [key, entry] of Object.entries(value)) {
    if (isPlainObject(entry)) {
      /** @type {Record<string, unknown>} */
      const range = {};
      for (const [edge, edgeValue] of Object.entries(entry)) {
        if (isActiveValue(edgeValue)) range[edge] = edgeValue;
      }
      if (Object.keys(range).length > 0) result[key] = range;
      continue;
    }
    if (isActiveValue(entry)) result[key] = entry;
  }
  return result;
}

/**
 * Converts anything a calendar day can arrive as — a `YYYY-MM-DD` string, an ISO timestamp, a
 * `Date`, Unix seconds or milliseconds — into the local calendar day a native date input holds.
 * Numbers below 1e11 are read as seconds, which is the boundary between the two epochs in use.
 * @param {unknown} value Candidate day.
 * @returns {string} `YYYY-MM-DD`, or an empty string when there is no day in it.
 */
export function toDateInput(value) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : localDay(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return localDay(new Date(Math.abs(value) < SECONDS_CUTOFF ? value * 1000 : value));
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^-?\d+(\.\d+)?$/.test(text)) return toDateInput(Number(text));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : localDay(parsed);
}

/**
 * Serializes one calendar day at one edge of a range. The `from` edge takes the first instant of
 * its local day and the `to` edge the last, so a range whose ends name the same day still matches
 * everything recorded on it.
 * @param {unknown} day Calendar day in any form `toDateInput()` accepts.
 * @param {FilterPanelEdge} edge Which end of the range the day is.
 * @param {FilterPanelSerialize} [serialize='seconds'] Output format, or a function receiving the
 *   edge instant as a `Date`.
 * @returns {unknown} The serialized day, or null when there is no day.
 */
export function serializeDate(day, edge, serialize = 'seconds') {
  const text = toDateInput(day);
  if (!text) return null;
  const [year, month, date] = text.split('-').map(Number);
  const instant = edge === 'to'
    ? new Date(year, month - 1, date, 23, 59, 59, 999)
    : new Date(year, month - 1, date, 0, 0, 0, 0);
  if (typeof serialize === 'function') return serialize(instant, edge);
  if (serialize === 'ms') return instant.getTime();
  if (serialize === 'iso') return instant.toISOString();
  return Math.floor(instant.getTime() / 1000);
}

/**
 * Normalizes declared select options. `{value, label}`, `{ID, name}`, and bare primitives all
 * arrive from one instance or another.
 * @param {unknown} options Declared options.
 * @returns {Array<{value: unknown, label: string}>}
 */
export function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  const normalized = [];
  for (const option of options) {
    if (option !== null && typeof option === 'object') {
      const source = /** @type {Record<string, unknown>} */ (option);
      const value = 'value' in source ? source.value : source.ID;
      if (value === undefined) continue;
      const label = source.label ?? source.name ?? source.title;
      normalized.push({ value, label: label == null ? String(value) : String(label) });
      continue;
    }
    if (option === undefined) continue;
    normalized.push({ value: option, label: String(option) });
  }
  return normalized;
}

/**
 * Converts incoming values into the internal draft shape the controls hold: trimmed text, canonical
 * option values, `YYYY-MM-DD` days, and finite numbers. Fields with an unknown type are left out.
 * Running it on a draft returns the same draft, so it is safe on either shape.
 * @param {Record<string, unknown>|null|undefined} value Incoming values keyed by field.
 * @param {Record<string, FilterPanelField>} fields Field metadata.
 * @returns {Record<string, unknown>}
 */
export function toDraft(value, fields) {
  const source = isPlainObject(value) ? value : {};
  /** @type {Record<string, unknown>} */
  const draft = {};
  for (const [key, declared] of Object.entries(fields ?? {})) {
    const field = /** @type {FilterPanelField} */ (declared ?? {});
    const spec = parseFieldType(field.type);
    if (!spec) continue;
    const raw = source[key];
    if (spec.kind === 'text') {
      draft[key] = raw == null ? '' : String(raw).trim();
    } else if (spec.kind === 'select') {
      draft[key] = selectionOf(raw, normalizeOptions(field.options));
    } else if (spec.kind === 'date') {
      draft[key] = spec.range
        ? { from: toDateInput(readEdge(raw, 'from')), to: toDateInput(readEdge(raw, 'to')) }
        : toDateInput(raw);
    } else {
      draft[key] = spec.range
        ? { from: toNumberValue(readEdge(raw, 'from'), spec), to: toNumberValue(readEdge(raw, 'to'), spec) }
        : toNumberValue(raw, spec);
    }
  }
  return draft;
}

/**
 * Turns values into the query object a list endpoint is sent: only the constraints that are set,
 * dates serialized at the right edge, unknown field types excluded.
 * @param {Record<string, unknown>|null|undefined} value Values keyed by field, raw or drafted.
 * @param {Record<string, FilterPanelField>} fields Field metadata.
 * @param {FilterPanelSerialize} [serialize='seconds'] Date output format.
 * @returns {Record<string, unknown>}
 */
export function serializeFilterValue(value, fields, serialize = 'seconds') {
  const draft = toDraft(value, fields);
  /** @type {Record<string, unknown>} */
  const result = {};
  for (const [key, declared] of Object.entries(fields ?? {})) {
    const spec = parseFieldType(/** @type {FilterPanelField} */ (declared ?? {}).type);
    if (!spec) continue;
    const raw = draft[key];

    if (spec.kind === 'text') {
      if (raw !== '') result[key] = raw;
      continue;
    }
    if (spec.kind === 'select') {
      const chosen = /** @type {unknown[]} */ (raw);
      if (chosen.length > 0) result[key] = chosen.slice();
      continue;
    }
    if (spec.kind === 'date') {
      if (!spec.range) {
        // A single date names a day, so it serializes as that day's first instant.
        if (raw) result[key] = serializeDate(raw, 'from', serialize);
        continue;
      }
      const days = /** @type {{from: string, to: string}} */ (raw);
      /** @type {Record<string, unknown>} */
      const range = {};
      if (days.from) range.from = serializeDate(days.from, 'from', serialize);
      if (days.to) range.to = serializeDate(days.to, 'to', serialize);
      if (Object.keys(range).length > 0) result[key] = range;
      continue;
    }
    if (!spec.range) {
      if (raw !== null) result[key] = raw;
      continue;
    }
    const numbers = /** @type {{from: number|null, to: number|null}} */ (raw);
    /** @type {Record<string, unknown>} */
    const range = {};
    if (numbers.from !== null) range.from = numbers.from;
    if (numbers.to !== null) range.to = numbers.to;
    if (Object.keys(range).length > 0) result[key] = range;
  }
  return result;
}

/**
 * Field keys in display order: the ones `order` names first, in that order, then everything the
 * map declares that the order left out.
 * @param {Record<string, FilterPanelField>} fields Field metadata.
 * @param {string[]|null|undefined} order Requested display order.
 * @returns {Array<{key: string, field: FilterPanelField, spec: FilterPanelSpec|null}>}
 */
function orderFields(fields, order) {
  const declared = isPlainObject(fields) ? fields : {};
  const keys = Object.keys(declared);
  const requested = Array.isArray(order) ? order.filter((key) => keys.includes(key)) : [];
  const seen = new Set(requested);
  return [...requested, ...keys.filter((key) => !seen.has(key))]
    .map((key) => ({
      key,
      field: /** @type {FilterPanelField} */ (declared[key] ?? {}),
      spec: parseFieldType(declared[key]?.type)
    }));
}

/**
 * The option values a raw selection refers to, in option order. Matching is loose so a value that
 * came back as a string from a URL still finds the numeric option it names.
 * @param {unknown} raw Raw selection.
 * @param {Array<{value: unknown, label: string}>} options Normalized options.
 * @returns {unknown[]}
 */
function selectionOf(raw, options) {
  const requested = Array.isArray(raw) ? raw : (isActiveValue(raw) ? [raw] : []);
  if (options.length === 0) return requested.filter((value) => isActiveValue(value));
  return options
    .filter((option) => requested.some((value) => sameValue(value, option.value)))
    .map((option) => option.value);
}

/**
 * Reads one end of a range. `{from, to}` is the declared shape; a two-element array and a bare
 * scalar (read as the lower bound) are the two spellings that reach the component in practice.
 * @param {unknown} raw Raw range value.
 * @param {FilterPanelEdge} edge Range edge.
 * @returns {unknown}
 */
function readEdge(raw, edge) {
  if (raw === null || raw === undefined) return null;
  if (Array.isArray(raw)) return (edge === 'from' ? raw[0] : raw[1]) ?? null;
  if (isPlainObject(raw)) return edge in raw ? raw[edge] : null;
  return edge === 'from' ? raw : null;
}

/**
 * @param {unknown} raw Candidate number.
 * @param {FilterPanelSpec} spec Resolved type.
 * @returns {number|null}
 */
function toNumberValue(raw, spec) {
  const parsed = parseNumber(raw);
  if (parsed === null) return null;
  return spec.integer ? Math.trunc(parsed) : parsed;
}

/** @param {Date} date Instant. @returns {string} Local `YYYY-MM-DD`. */
function localDay(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * A type predicate, not a boolean: without the `value is` form TypeScript cannot narrow
 * the `unknown` it is handed, and `raw[edge]` / `{...entry}` fail declaration emit.
 * @param {unknown} value Candidate.
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

/** @param {unknown} left Left value. @param {unknown} right Right value. @returns {boolean} */
function sameValue(left, right) {
  if (Object.is(left, right)) return true;
  if (left === null || left === undefined || right === null || right === undefined) return false;
  return String(left) === String(right);
}

/** @param {Record<string, unknown>} value Emitted value. @returns {Record<string, unknown>} */
function cloneValue(value) {
  /** @type {Record<string, unknown>} */
  const copy = {};
  for (const [key, entry] of Object.entries(value)) {
    if (Array.isArray(entry)) copy[key] = entry.slice();
    else if (isPlainObject(entry)) copy[key] = { ...entry };
    else copy[key] = entry;
  }
  return copy;
}

/**
 * A comparable spelling of the draft. Draft values are only strings, finite numbers, null, arrays
 * and `{from, to}` pairs, so JSON is a faithful identity for them.
 * @param {Record<string, unknown>} draft Draft values.
 * @returns {string}
 */
function draftKey(draft) {
  return JSON.stringify(Object.keys(draft).sort().map((key) => [key, draft[key]]));
}
