import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { printf } from '../../core/i18n.js';
import { Select } from '../select/select.js';
import { TagPicker } from '../tag-picker/tag-picker.js';
import {
  cloneFilterAst, cloneFilterValue, emptyFilterAst, filterCondition, filterGroup, filterOperators,
  parseFilterAst, validateFilterAst
} from './filter-model.js';

/** @typedef {import('./filter-model.js').FilterAst} FilterAst */
/**
 * @typedef {Object} FilterField
 * @property {string} id Stable allowlisted field ID.
 * @property {string} label Display label.
 * @property {'text'|'number'|'money'|'date'|'datetime'|'boolean'|'enum'|'status'|'priority'|'country'|'currency'|'unit'|'entity'|'tags'|'custom'} type Editor/operator type.
 * @property {string[]} [operators] Explicit allowlisted operator IDs.
 * @property {string} [defaultOperator] Initial operator ID.
 * @property {string|Node} [icon] Glyph beside the field's name in a `searchable` field picker, an
 *   icon name or a node; a native `<select>` cannot show one.
 * @property {Array<{value:string|number|boolean,label:string,icon?:Node|string,color?:string}>} [choices] Static choices; a
 *   choice's `icon` shows beside it in a `searchable` value picker.
 * @property {(context:{query:string,signal:AbortSignal,conditionId:string,field:FilterField})=>Promise<Array<{value:string|number|boolean,label:string}>>|Array<{value:string|number|boolean,label:string}>} [loadChoices] Async choices.
 * @property {(target:Element, context:{value:unknown,setValue:(value:unknown)=>void,field:FilterField,conditionId:string})=>({destroy?:()=>void}|void)} [editor] Custom editor.
 * @property {number} [minQuery=0] Async minimum query length.
 * @property {number} [debounce=200] Async debounce in milliseconds.
 */
/**
 * @typedef {Object} FilterOptions
 * @property {FilterField[]} fields Field definitions.
 * @property {FilterAst} [value] Initial expression.
 * @property {Array<{id:string,label:string,arity:'none'|'single'|'pair'|'many',types:string[]}>} [operators] Additional/overridden operators.
 * @property {boolean} [allowGroups=true] Whether nested groups may be authored.
 * @property {number} [maxDepth=3] Maximum nested group depth.
 * @property {number} [maxConditions=50] Maximum condition count.
 * @property {boolean} [searchable=false] Searchable field, operator and single-choice controls; a many-valued
 *   operator on a field with static choices gets a `TagPicker`.
 * @property {'standard'|'compact'} [layout='standard'] Condition layout; compact rows adapt to container width and
 *   show the group's "and"/"or" between them, a click on it switching the group's logic.
 * @property {'and'|'or'|null} [rootLogic=null] Restrict root logic without rewriting incompatible saved expressions.
 * @property {boolean} [showApply=true] Show the internal Apply button.
 * @property {boolean} [showRootActions=true] Show Add controls inside the root group as well as the footer.
 * @property {boolean} [autoApply=false] Emit apply after every valid mutation.
 * @property {boolean} [readonly=false] Prevent mutations while keeping values readable.
 * @property {boolean} [disabled=false] Disable all controls.
 * @property {string} [applyLabel] Apply button label. Omitted resolves `filter.apply`, English `Apply filters`.
 * @property {string} [clearLabel] Clear button label. Omitted resolves `filter.clear`, English `Clear`.
 * @property {(event:CustomEvent<Record<string,unknown>>)=>void} [onchange] Draft-change listener.
 * @property {(event:CustomEvent<Record<string,unknown>>)=>void} [onapply] Valid-apply listener.
 * @property {(event:CustomEvent<Record<string,unknown>>)=>void} [oninvalid] Invalid-apply listener.
 * @property {(event:CustomEvent<Record<string,unknown>>)=>void} [onquery] Async query listener.
 * @property {(event:CustomEvent<Record<string,unknown>>)=>void} [onloaded] Async loaded listener.
 * @property {(event:CustomEvent<Record<string,unknown>>)=>void} [onerror] Async failure listener.
 */

/**
 * Words the value builders render, resolved by the component that owns them.
 * @typedef {Object} FilterValueMessages
 * @property {string} choose Empty-choice option label.
 * @property {string} yes Boolean true label.
 * @property {string} no Boolean false label.
 * @property {string} commaSeparated Placeholder for a many-valued text input.
 * @property {(label: string) => string} value Accessible name for a single value control.
 * @property {(label: string, position: number) => string} valueAt Accessible name for one end of a pair.
 */

/**
 * Operators whose value is a relative span rather than a pair of dates. The model gives them
 * `pair` arity, so their value is the pair `[amount, unit]` — a positive whole number and one of
 * {@link RELATIVE_DATE_UNITS} — never two dates.
 */
const RELATIVE_DATE_OPERATORS = new Set(['withinLast', 'withinNext']);

/** Units a relative date span may be counted in, in the order the editor offers them. */
export const RELATIVE_DATE_UNITS = Object.freeze(['days', 'weeks', 'months']);

/** English unit words the relative-date editor falls back to. */
const RELATIVE_UNIT_WORDS = Object.freeze({ days: 'days', weeks: 'weeks', months: 'months' });

/** English text the value builders fall back to when they are called without a component. */
const BUILT_IN_VALUE_MESSAGES = Object.freeze({
  choose: 'Choose…',
  yes: 'True',
  no: 'False',
  commaSeparated: 'Comma-separated values',
  /** @param {string} label @returns {string} */
  value: (label) => `${label} value`,
  /** @param {string} label @param {number} position @returns {string} */
  valueAt: (label, position) => `${label} value ${position}`
});

/**
 * Backend-neutral dynamic filter expression editor.
 * @fires Filter#change
 * @fires Filter#apply
 * @fires Filter#invalid
 * @fires Filter#query
 * @fires Filter#loaded
 * @fires Filter#error
 * @extends {Component<FilterOptions>}
 */
export class Filter extends Component {
  static cssName = 'filter';

  /** @type {Readonly<FilterOptions>} */
  static defaults = {
    fields: [], value: null, operators: [], allowGroups: true, maxDepth: 3, maxConditions: 50,
    autoApply: false, readonly: false, disabled: false,
    searchable: false, layout: 'standard', rootLogic: null, showApply: true, showRootActions: true,
    applyLabel: null, clearLabel: null
  };

  /** @returns {HTMLElement} */
  render() {
    this._createdRoot = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._snapshot = this._createdRoot ? null : snapshotTarget(root);
    this._fields = (Array.isArray(this.options.fields) ? this.options.fields : []).map((field) => ({ ...field }));
    this._operators = mergeOperators(filterOperators, this.options.operators);
    this._readonly = Boolean(this.options.readonly);
    this._disabled = Boolean(this.options.disabled);
    this._async = new Map();
    this._customEditors = [];
    this._selectEditors = [];
    this._disposed = false;
    root.dataset.layout = this.options.layout === 'compact' ? 'compact' : 'standard';
    this._value = this.options.value == null ? emptyFilterAst()
      : parseFilterAst(this.options.value, this._limits());

    this.listen(root, 'change', (event) => this._handleChange(event));
    this.listen(root, 'input', (event) => this._handleInput(event));
    this.listen(root, 'click', (event) => this._handleClick(event));
    this._render();
    return root;
  }

  /** Returns a defensive AST copy. @returns {FilterAst} */
  getValue() { return cloneFilterAst(this._value); }

  /** Atomically replaces the AST. @param {unknown} value @param {{silent?:boolean}} [options={}] @returns {this} */
  setValue(value, { silent = false } = {}) {
    const parsed = parseFilterAst(value, this._limits());
    this._abortAll();
    this._value = parsed;
    this._render();
    if (!silent) this._changed('set', this._value.root.id);
    return this;
  }

  /** Adds a condition to a group. @param {string|null} [parentId=null] @param {Record<string,unknown>} [initial={}] @returns {string|null} */
  addCondition(parentId = null, initial = {}) {
    if (!this._canMutate() || conditionCount(this._value.root) >= Number(this.options.maxConditions)) return null;
    const parent = findGroup(this._value.root, parentId ?? this._value.root.id);
    if (!parent) return null;
    const first = this._fields[0];
    const field = String(initial.field ?? first?.id ?? '');
    const definition = this._field(field);
    const node = filterCondition({
      ...initial, field,
      operator: String(initial.operator ?? this._defaultOperator(definition) ?? '')
    });
    parent.children.push(node);
    this._render();
    this._changed('add', node.id);
    this.focus(node.id);
    return node.id;
  }

  /** Adds a nested group. @param {string|null} [parentId=null] @param {'and'|'or'} [logic='and'] @returns {string|null} */
  addGroup(parentId = null, logic = 'and') {
    if (!this._canMutate() || !this.options.allowGroups) return null;
    const parent = findGroup(this._value.root, parentId ?? this._value.root.id);
    if (!parent || groupDepth(this._value.root, parent.id) >= Number(this.options.maxDepth)) return null;
    const group = filterGroup(logic === 'or' ? 'or' : 'and');
    parent.children.push(group);
    this._render();
    this._changed('add', group.id);
    this.focus(group.id);
    return group.id;
  }

  /** Updates a node by stable ID. @param {string} id @param {Record<string,unknown>} patch @returns {this} */
  update(id, patch = {}) {
    if (!this._canMutate()) return this;
    const node = findNode(this._value.root, id);
    if (!node) return this;
    if (node.kind === 'group') {
      if (patch.logic === 'and' || patch.logic === 'or') node.logic = patch.logic;
    } else {
      if (Object.hasOwn(patch, 'field')) node.field = String(patch.field ?? '');
      if (Object.hasOwn(patch, 'operator')) node.operator = String(patch.operator ?? '');
      if (Object.hasOwn(patch, 'value')) node.value = parseValueJson(patch.value);
    }
    this._abort(id);
    this._render();
    this._changed('update', id);
    return this;
  }

  /** Removes a non-root node. @param {string} id @returns {this} */
  remove(id) {
    if (!this._canMutate() || id === this._value.root.id) return this;
    const parent = findParent(this._value.root, id);
    if (!parent) return this;
    const index = parent.children.findIndex((child) => child.id === id);
    const focusId = parent.children[index + 1]?.id ?? parent.children[index - 1]?.id ?? parent.id;
    const removed = removeNode(this._value.root, id);
    if (!removed) return this;
    this._abortTree(removed);
    this._render();
    const label = removed.kind === 'condition'
      ? this._field(removed.field)?.label ?? this._message('filter.conditionNoun', 'Filter')
      : this._message('filter.groupNoun', 'Filter group');
    this._announce(this._message('filter.removed', '%1 removed', label));
    this._changed('remove', id);
    this.focus(focusId);
    return this;
  }

  /** Moves a node into a group while preserving its identity. @param {string} id @param {string} parentId @param {number} index @returns {this} */
  move(id, parentId, index) {
    const node = findNode(this._value.root, id);
    const parent = findGroup(this._value.root, parentId);
    const previous = findParent(this._value.root, id);
    if (!this._canMutate() || id === this._value.root.id || !node || !parent || !previous
      || containsNode(node, parentId)) return this;
    const previousIndex = previous.children.findIndex((child) => child.id === id);
    const removed = previous.children.splice(previousIndex, 1)[0];
    parent.children.splice(Math.max(0, Math.min(parent.children.length, Number(index) || 0)), 0, removed);
    try { parseFilterAst(this._value, this._limits()); } catch {
      parent.children.splice(parent.children.indexOf(removed), 1);
      previous.children.splice(previousIndex, 0, removed);
      return this;
    }
    this._render();
    this._changed('move', id);
    return this;
  }

  /** Returns semantic validity and errors. @returns {{valid:boolean,errors:Array<Record<string,string>>}} */
  validate() {
    const result = validateFilterAst(this._value, this._fields, this._operators);
    for (const node of conditionNodes(this._value.root)) {
      if (!isRelativeDateOperator(this._operator(node.operator))) continue;
      // The model only checks that both halves of the pair are filled; a span also needs a
      // positive whole amount and a known unit, and "Enter both values" would misdescribe it.
      if (relativeDateValueError(node.value) === null) continue;
      const message = this._message('filter.relativeInvalid', 'Enter a whole number of days, weeks or months');
      const existing = result.errors.find((candidate) => candidate.nodeId === node.id && candidate.code === 'value');
      if (existing) existing.message = message;
      else result.errors.push({ nodeId: node.id, code: 'value', message });
      result.valid = false;
    }
    const error = rootLogicError(this._value, this.options.rootLogic);
    if (error) { result.valid = false; result.errors.push(error); }
    return result;
  }

  /** Applies only a valid AST. @returns {FilterAst|null} */
  apply() {
    if (this._disabled) return null;
    const result = this.validate();
    if (!result.valid) {
      this.emit('invalid', { errors: result.errors });
      this.focus(result.errors[0]?.nodeId);
      return null;
    }
    const value = this.getValue();
    this.emit('apply', { value });
    return value;
  }

  /** Clears all conditions. @param {{silent?:boolean}} [options={}] @returns {this} */
  clear({ silent = false } = {}) {
    if (!this._canMutate()) return this;
    this._abortAll();
    this._value.root.children = [];
    this._render();
    if (!silent) this._changed('clear', this._value.root.id);
    this.refs.add?.focus();
    return this;
  }

  /** Focuses a condition's field or the Add button. @param {string|null} [id=null] @returns {this} */
  focus(id = null) {
    const selector = id
      ? `[data-node-id="${cssEscape(id)}"] :is([data-filter-field], [data-filter-focus="field"], [data-filter-logic], [data-filter-action="add"])`
      : '[data-filter-action="add"]';
    queueMicrotask(() => {
      if (this._disposed) return;
      const target = /** @type {HTMLElement|null} */ (this.el.querySelector(selector)) ?? this.refs.add;
      target?.focus();
    });
    return this;
  }

  /** @param {boolean} readonly @returns {this} */
  setReadonly(readonly) { this._readonly = Boolean(readonly); this._render(); return this; }
  /** @returns {this} */
  enable() { this._disabled = false; this._render(); return this; }
  /** @returns {this} */
  disable() { this._disabled = true; this._abortAll(); this._render(); return this; }

  /** @returns {void} */
  destroy() {
    this._disposed = true;
    this._renderVersion += 1;
    this._abortAll();
    this._destroyEditors();
    const root = this.el;
    const snapshot = this._snapshot;
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, snapshot);
  }

  /** @returns {void} */
  _render() {
    this._destroyEditors();
    this._renderVersion = (this._renderVersion ?? 0) + 1;
    const status = h('div', { ref: 'status', class: 'zx-filter__status', role: 'status', ariaLive: 'polite' });
    const tree = this._renderGroup(this._value.root, 0, true);
    const actions = h('div', { class: 'zx-filter__actions' },
      actionButton('add', this._value.root.id, 'plus', this._message('filter.addFilter', 'Add filter'), { ref: 'add', disabled: this._blocked() }),
      this.options.allowGroups ? actionButton('add-group', this._value.root.id, 'folder', this._message('filter.addGroup', 'Add group'), { disabled: this._blocked() }) : null,
      actionButton('clear', '', 'x', String(this.options.clearLabel ?? this._message('filter.clear', 'Clear')), { disabled: this._blocked() }),
      this.options.showApply ? actionButton('apply', '', 'check', String(this.options.applyLabel ?? this._message('filter.apply', 'Apply filters')), { kind: 'primary', disabled: this._disabled }) : null
    );
    this.el.replaceChildren(status, tree, actions);
    this.refs.status = status;
    this.refs.add = /** @type {HTMLElement} */ (this.el.querySelector('[data-filter-action="add"]'));
    this.el.toggleAttribute('data-readonly', this._readonly);
    this.el.toggleAttribute('data-disabled', this._disabled);
    const result = this.validate();
    this.el.dataset.valid = String(result.valid);
    for (const error of result.errors) this.el.querySelector(`[data-node-id="${cssEscape(error.nodeId)}"]`)?.setAttribute('data-invalid', '');
  }

  /** @param {any} group @param {number} depth @param {boolean} root @returns {HTMLElement} */
  _renderGroup(group, depth, root) {
    const children = h('ol', { class: 'zx-filter__children' },
      group.children.map((node, index) => {
        const item = node.kind === 'group' ? this._renderGroup(node, depth + 1, false) : this._renderCondition(node);
        if (index > 0 && this.options.layout === 'compact') item.prepend(this._connector(group, root));
        return item;
      }));
    const logic = h('select', {
      class: 'zx-filter__logic', dataset: { filterLogic: '', nodeId: group.id },
      ariaLabel: root ? this._message('filter.rootLogic', 'Root filter logic')
        : this._message('filter.groupLogic', 'Group filter logic'),
      disabled: this._blocked()
    },
    h('option', { value: 'and', selected: group.logic === 'and' }, this._message('filter.matchAll', 'Match all')),
    h('option', { value: 'or', selected: group.logic === 'or' }, this._message('filter.matchAny', 'Match any')));
    const legend = h('legend', { class: 'zx-filter__legend' },
      root && this.options.rootLogic
        ? (group.logic === 'or'
          ? this._message('filter.matchAnyConditions', 'Match any conditions')
          : this._message('filter.matchAllConditions', 'Match all conditions'))
        : [logic, h('span', {}, root ? this._message('filter.conditions', 'conditions')
          : this._message('filter.inThisGroup', 'in this group'))]);
    const controls = h('div', { class: 'zx-filter__group-actions' },
      actionButton('add', group.id, 'plus', this._message('filter.addFilter', 'Add filter'), { disabled: this._blocked() }),
      this.options.allowGroups && depth < Number(this.options.maxDepth)
        ? actionButton('add-group', group.id, 'folder', this._message('filter.addSubgroup', 'Add subgroup'), { disabled: this._blocked() }) : null,
      // Named on the button too: the compact layout hides the word and leaves the glyph.
      root ? null : actionButton('remove', group.id, 'trash', this._message('filter.removeGroup', 'Remove group'),
        { disabled: this._blocked(), ariaLabel: this._message('filter.removeGroup', 'Remove group') })
    );
    return h(root ? 'fieldset' : 'li', {
      class: 'zx-filter__group', dataset: { nodeId: group.id, depth: String(depth) }
    }, root ? legend : h('fieldset', {}, legend, children, controls), root ? children : null, root && this.options.showRootActions ? controls : null);
  }

  /**
   * The word between two rows of a compact group — "and" or "or" — so the logic reads down the
   * list rather than only from the group's legend. A click switches the group's logic. It is a
   * pointer shortcut kept out of the Tab order: the legend's select is the same control, reached
   * once per group rather than once per row. A restricted root shows the word without the switch.
   * @param {any} group Group the rows belong to.
   * @param {boolean} root Whether it is the root group.
   * @returns {HTMLElement}
   */
  _connector(group, root) {
    const { word, name } = filterConnectorText(group.logic, (key, fallback, ...args) => this._message(key, fallback, ...args));
    if (this._blocked() || (root && this.options.rootLogic)) {
      return h('span', { class: 'zx-filter__connector', ariaHidden: 'true', dataset: { connector: group.id } }, word);
    }
    return h('button', {
      type: 'button', class: 'zx-filter__connector', tabindex: '-1',
      dataset: { filterAction: 'toggle-logic', nodeId: group.id, connector: group.id },
      ariaLabel: name
    }, word);
  }

  /**
   * Rewrites a group's connectors after its logic changed through the legend's select, which is
   * not redrawn — the reader's focus is on it.
   * @param {any} group
   * @returns {void}
   */
  _syncConnectors(group) {
    const { word, name } = filterConnectorText(group.logic, (key, fallback, ...args) => this._message(key, fallback, ...args));
    for (const connector of this.el.querySelectorAll(`[data-connector="${cssEscape(group.id)}"]`)) {
      connector.textContent = word;
      if (connector.tagName === 'BUTTON') connector.setAttribute('aria-label', name);
    }
  }

  /** @param {any} node @returns {HTMLElement} */
  _renderCondition(node) {
    const field = this._field(node.field);
    const operators = this._operatorsFor(field);
    const operator = this._operator(node.operator);
    const fieldChoices = this._fields.map((candidate) => ({value: candidate.id, label: candidate.label, icon: candidate.icon}));
    if (node.field && !field) fieldChoices.push({value: node.field, label: this._unavailable(node.field)});
    const operatorChoices = operators.map((candidate) => ({value: candidate.id, label: candidate.label}));
    if (node.operator && !operators.some((candidate) => candidate.id === node.operator)) operatorChoices.push({value: node.operator, label: this._unavailable(node.operator)});
    const fieldSelect = this.options.searchable ? this._searchSelect(fieldChoices, node.field, this._message('filter.field', 'Filter field'), node.id, 'field', (value) => {
      const selectedField = this._field(String(value));
      this.update(node.id, {field: String(value), operator: this._defaultOperator(selectedField) ?? '', value: null});
      this.focus(node.id);
    }) : h('select', {
      class: 'zx-filter__field', dataset: { filterField: '', nodeId: node.id },
      ariaLabel: this._message('filter.field', 'Filter field'), disabled: this._blocked()
    },
    h('option', { value: '', selected: !node.field }, this._message('filter.chooseField', 'Choose a field…')),
    this._fields.map((candidate) => h('option', { value: candidate.id, selected: candidate.id === node.field }, candidate.label)),
    node.field && !field ? h('option', { value: node.field, selected: true }, this._unavailable(node.field)) : null);
    const operatorSelect = this.options.searchable ? this._searchSelect(operatorChoices, node.operator, this._message('filter.operator', 'Filter operator'), node.id, 'operator', (value) => {
      this.update(node.id, {operator: String(value), value: null});
      queueMicrotask(() => this.el.querySelector(`[data-node-id="${cssEscape(node.id)}"] :is([data-filter-value], [data-filter-focus="value"])`)?.focus());
    }) : h('select', {
      class: 'zx-filter__operator', dataset: { filterOperator: '', nodeId: node.id },
      ariaLabel: this._message('filter.operator', 'Filter operator'), disabled: this._blocked()
    },
    h('option', { value: '', selected: !node.operator }, this._message('filter.chooseOperator', 'Choose an operator…')),
    operators.map((candidate) => h('option', { value: candidate.id, selected: candidate.id === node.operator }, candidate.label)),
    node.operator && !operators.some((candidate) => candidate.id === node.operator)
      ? h('option', { value: node.operator, selected: true }, this._unavailable(node.operator)) : null);
    return h('li', { class: 'zx-filter__condition', dataset: { nodeId: node.id } },
      fieldSelect, operatorSelect, this._renderValue(node, field, operator),
      this._removeConditionButton(node, field)
    );
  }

  /** @param {any} node @param {FilterField|null} field @param {any} operator @returns {HTMLElement} */
  _renderValue(node, field, operator) {
    const host = h('div', { class: 'zx-filter__value' });
    if (!field || !operator) return host;
    if (operator.arity === 'none') return h('div', { class: 'zx-filter__value zx-filter__value--empty' }, this._message('filter.noValue', 'No value'));
    if (field.type === 'custom' && typeof field.editor === 'function') {
      const renderVersion = this._renderVersion;
      queueMicrotask(() => {
        if (renderVersion !== this._renderVersion || !this.el.contains(host)) return;
        const handle = field.editor(host, {
          value: node.value, field, conditionId: node.id,
          setValue: (value) => this._setNodeValue(node.id, parseValueJson(value))
        });
        if (handle && typeof handle.destroy === 'function') this._customEditors.push(handle);
      });
      return host;
    }
    const messages = this._valueMessages();
    if (isRelativeDateOperator(operator)) return this._relativeDateEditor(node, field);
    const values = operator.arity === 'pair' ? (Array.isArray(node.value) ? node.value : [null, null]) : [node.value];
    if (operator.arity === 'many') {
      if (this.options.searchable && Array.isArray(field.choices) && field.choices.length) {
        return h('div', { class: 'zx-filter__value', dataset: { arity: 'many' } }, this._tagPicker(field, node, messages));
      }
      const control = choiceSelect(field, node, values[0], true, this._blocked(), 0, messages);
      if (control) return h('div', { class: 'zx-filter__value' }, control);
      return h('div', { class: 'zx-filter__value' }, valueInput(field, node.id, Array.isArray(node.value) ? node.value.join(', ') : '', 0, this._blocked(), true, messages));
    }
    const choices = field.choices?.length ? field.choices : field.type === 'boolean' ? [{value: true, label: messages.yes}, {value: false, label: messages.no}] : null;
    const controls = values.map((value, index) => this.options.searchable && choices
      ? this._searchSelect(choices, value, operator.arity === 'pair' ? messages.valueAt(field.label, index + 1) : messages.value(field.label), node.id, 'value', (selected) => {
        const next = operator.arity === 'pair' ? (Array.isArray(node.value) ? [...node.value] : [null, null]) : null;
        if (next) next[index] = selected;
        this._setNodeValue(node.id, next ?? selected);
      }) : choiceSelect(field, node, value, false, this._blocked(), index, messages)
      ?? valueInput(field, node.id, value, index, this._blocked(), false, messages));
    return h('div', { class: 'zx-filter__value', dataset: { arity: operator.arity } }, controls);
  }

  /**
   * The editor for a relative date span (`withinLast`, `withinNext`): a whole-number amount and a
   * unit select. Both controls write the pair `[amount, unit]`; a value that is not such a pair —
   * two dates saved by an older editor, say — shows as an empty amount in days.
   * @param {any} node Condition.
   * @param {FilterField} field Date field.
   * @returns {HTMLElement}
   */
  _relativeDateEditor(node, field) {
    const span = readRelativeDateValue(node.value);
    const amount = h('input', {
      type: 'number', min: '1', step: '1', inputMode: 'numeric',
      value: span.amount === null ? '' : String(span.amount),
      dataset: { filterValue: '', filterRelative: 'amount', nodeId: node.id, valueIndex: '0' },
      ariaLabel: this._message('filter.relativeAmount', '%1: number of units', field.label),
      disabled: this._blocked()
    });
    const unit = h('select', {
      dataset: { filterValue: '', filterRelative: 'unit', nodeId: node.id, valueIndex: '1' },
      ariaLabel: this._message('filter.relativeUnit', '%1: unit', field.label),
      disabled: this._blocked()
    }, RELATIVE_DATE_UNITS.map((id) => h('option', { value: id, selected: id === span.unit },
      this._message(`filter.unit.${id}`, RELATIVE_UNIT_WORDS[id]))));
    return h('div', { class: 'zx-filter__value', dataset: { arity: 'relative' } },
      h('span', { class: 'zx-filter__value-control' }, amount),
      h('span', { class: 'zx-filter__value-control' }, unit));
  }

  /**
   * Owns a themed picker and defers mutation until Select finishes its selection event.
   * @param {Array<{value:unknown,label:string}>} items Choices.
   * @param {unknown} value Selected value.
   * @param {string} label Accessible name.
   * @param {string} nodeId Condition ID.
   * @param {string} part Focus target name.
   * @param {(value:unknown)=>void} changed Selection handler.
   * @returns {HTMLElement} Picker root.
   */
  _searchSelect(items, value, label, nodeId, part, changed) {
    const version = this._renderVersion;
    // Choices with a glyph show it in the list and before the chosen value; without, plain text.
    const glyphs = items.some((item) => choiceGlyph(item) !== null) ? {
      renderItem: (item) => h('span', { class: 'zx-filter__choice' },
        choiceGlyph(item) ?? h('span', { class: 'zx-filter__choice-icon' }),
        h('span', { class: 'zx-filter__choice-label' }, String(item.label ?? ''))),
      renderValueAdornment: (item) => choiceGlyph(item)
    } : {};
    const select = new Select(null, {
      items, valueKey: 'value', labelKey: 'label', value, label, filter: 'local',
      disabled: this._blocked(), placeholder: this._message('filter.choosePart', 'Choose %1…', part),
      ...glyphs,
      onchange: ({detail}) => queueMicrotask(() => {
        if (!this._disposed && version === this._renderVersion && this._canMutate()) changed(detail.value);
      })
    });
    this._selectEditors.push(select);
    select.el.classList.add('zx-filter__picker');
    select.refs.input.dataset.filterFocus = part;
    select.refs.input.dataset.nodeId = nodeId;
    return /** @type {HTMLElement} */ (select.el);
  }

  /**
   * Owns a themed multi-value picker for a many-valued operator on a field with static choices:
   * the chosen values as removable tags, the rest in a searchable list. It writes the value without
   * redrawing the editor, so the list stays open while the reader picks several.
   * @param {FilterField} field Field with `choices`.
   * @param {any} node Condition.
   * @param {FilterValueMessages} messages Resolved value-builder text.
   * @returns {HTMLElement} Picker root.
   */
  _tagPicker(field, node, messages) {
    // A language the host set on this editor applies to the picker too.
    const own = /** @type {Record<string, any>} */ (this.options);
    const lang = own.lang ?? own.language;
    const picker = new TagPicker(null, {
      items: filterTagItems(field.choices),
      valueKey: 'value', labelKey: 'label',
      values: Array.isArray(node.value) ? node.value : [],
      disabled: this._blocked(), placeholder: messages.choose,
      // The host's messages reach the picker's own strings; its input is named after the field.
      msg: withFilterMessage(this.options.msg, 'tagPicker.input', messages.value(field.label)),
      ...(lang ? { lang } : {}),
      onchange: ({ detail }) => {
        if (!this._disposed && this._canMutate()) this._setNodeValue(node.id, filterTagValue(detail.values));
      }
    });
    this._selectEditors.push(picker);
    picker.el.classList.add('zx-filter__picker');
    if (picker.refs.input) {
      picker.refs.input.dataset.filterFocus = 'value';
      picker.refs.input.dataset.nodeId = node.id;
    }
    return /** @type {HTMLElement} */ (picker.el);
  }

  /** @param {Event} event @returns {void} */
  _handleChange(event) {
    if (!this._canMutate()) return;
    const target = /** @type {HTMLInputElement|HTMLSelectElement|null} */ (event.target);
    const id = target?.dataset.nodeId;
    if (!target || !id) return;
    if (target.dataset.filterField !== undefined) {
      const node = findNode(this._value.root, id);
      if (node?.kind !== 'condition') return;
      node.field = target.value;
      const field = this._field(node.field);
      node.operator = this._defaultOperator(field) ?? '';
      node.value = null;
      this._abort(id); this._render(); this._changed('update', id); this.focus(id);
    } else if (target.dataset.filterOperator !== undefined) {
      const node = findNode(this._value.root, id);
      if (node?.kind !== 'condition') return;
      node.operator = target.value; node.value = null;
      this._abort(id); this._render(); this._changed('update', id);
      queueMicrotask(() => /** @type {HTMLElement|null} */ (this.el.querySelector(`[data-node-id="${cssEscape(id)}"] [data-filter-value]`))?.focus());
    } else if (target.dataset.filterLogic !== undefined) {
      const node = findNode(this._value.root, id);
      if (node?.kind === 'group' && !(node === this._value.root && this.options.rootLogic)) node.logic = target.value === 'or' ? 'or' : 'and';
      if (node?.kind === 'group') this._syncConnectors(node);
      this._changed('update', id);
    } else if (target.dataset.filterValue !== undefined) this._valueInput(target);
  }

  /** @param {Event} event @returns {void} */
  _handleInput(event) {
    if (!this._canMutate()) return;
    const target = /** @type {HTMLInputElement|null} */ (event.target);
    if (!target || target.dataset.filterValue === undefined) return;
    this._valueInput(target);
    const id = target.dataset.nodeId;
    const node = findNode(this._value.root, id);
    const field = node?.kind === 'condition' ? this._field(node.field) : null;
    if (field?.loadChoices) this._scheduleChoices(node.id, field, target.value);
  }

  /** @param {HTMLInputElement|HTMLSelectElement} target @returns {void} */
  _valueInput(target) {
    const node = findNode(this._value.root, target.dataset.nodeId);
    if (node?.kind !== 'condition') return;
    const operator = this._operator(node.operator);
    const field = this._field(node.field);
    if (!operator || !field) return;
    let value;
    if (isRelativeDateOperator(operator)) {
      const row = target.closest('.zx-filter__value');
      const amount = /** @type {HTMLInputElement|null} */ (row?.querySelector('[data-filter-relative="amount"]') ?? null);
      const unit = /** @type {HTMLSelectElement|null} */ (row?.querySelector('[data-filter-relative="unit"]') ?? null);
      value = relativeDateValue(amount?.value ?? '', unit?.value ?? RELATIVE_DATE_UNITS[0]);
    } else if (target instanceof HTMLSelectElement && target.multiple) {
      value = Array.from(target.selectedOptions, (option) => parseScalar(option.value, field.type));
    } else if (operator.arity === 'many') {
      value = target.value.split(',').map((item) => item.trim()).filter(Boolean).map((item) => parseScalar(item, field.type));
    } else if (operator.arity === 'pair') {
      const pair = Array.isArray(node.value) ? [...node.value] : [null, null];
      pair[Number(target.dataset.valueIndex) || 0] = parseScalar(target.value, field.type);
      value = pair;
    } else value = parseScalar(target.value, field.type);
    this._setNodeValue(node.id, /** @type {any} */ (value));
  }

  /** @param {MouseEvent} event @returns {void} */
  _handleClick(event) {
    const button = /** @type {HTMLElement|null} */ (event.target)?.closest?.('[data-filter-action]');
    if (!button || !this.el.contains(button)) return;
    const action = button.dataset.filterAction;
    const id = button.dataset.nodeId || null;
    if (action === 'add') this.addCondition(id);
    else if (action === 'add-group') this.addGroup(id);
    else if (action === 'remove' && id) this.remove(id);
    else if (action === 'clear') this.clear();
    else if (action === 'toggle-logic' && id) {
      const logic = nextFilterGroupLogic(this._value, id, this.options.rootLogic);
      if (!logic) return;
      this.update(id, { logic });
      // The connector was redrawn under the pointer; the group's own select keeps the focus.
      this.focus(id);
    }
    else if (action === 'apply') this.apply();
  }

  /** @param {string} id @param {any} value @returns {void} */
  _setNodeValue(id, value) {
    const node = findNode(this._value.root, id);
    if (node?.kind !== 'condition') return;
    node.value = value;
    const result = this.validate();
    this.el.dataset.valid = String(result.valid);
    const row = this.el.querySelector(`[data-node-id="${cssEscape(id)}"]`);
    row?.toggleAttribute('data-invalid', result.errors.some((candidate) => candidate.nodeId === id));
    this._changed('update', id);
  }

  /** @param {string} reason @param {string} nodeId @returns {void} */
  _changed(reason, nodeId) {
    const result = this.validate();
    const value = this.getValue();
    this.emit('change', { value, valid: result.valid, errors: result.errors, reason, nodeId });
    if (this.options.autoApply && result.valid) this.emit('apply', { value });
  }

  /** @param {string} id @param {FilterField} field @param {string} query @returns {void} */
  _scheduleChoices(id, field, query) {
    this._abort(id);
    if (query.length < Number(field.minQuery ?? 0)) return;
    const controller = new AbortController();
    this._setAsyncBusy(id, true);
    const entry = { controller, timer: setTimeout(async () => {
      this.emit('query', { conditionId: id, fieldId: field.id, query });
      try {
        const choices = await field.loadChoices({ query, signal: controller.signal, conditionId: id, field });
        if (controller.signal.aborted || this._async.get(id)?.controller !== controller) return;
        const input = this.el.querySelector(`[data-node-id="${cssEscape(id)}"] [data-filter-value]`);
        const listId = input?.getAttribute('list');
        const list = listId ? this.el.querySelector(`#${cssEscape(listId)}`) : null;
        if (list) list.replaceChildren(...(Array.isArray(choices) ? choices : []).map((choice) => h('option', { value: choice.value }, choice.label)));
        this.emit('loaded', { conditionId: id, fieldId: field.id, query, choices });
      } catch (error) {
        if (!controller.signal.aborted) this.emit('error', { conditionId: id, fieldId: field.id, query, error: error instanceof Error ? error : new Error(String(error)) });
      } finally {
        if (this._async.get(id)?.controller === controller) {
          this._async.delete(id);
          this._setAsyncBusy(id, false);
        }
      }
    }, Math.max(0, Number(field.debounce ?? 200))) };
    this._async.set(id, entry);
  }

  /** @param {string} id @returns {void} */
  _abort(id) { const entry = this._async.get(id); if (entry) { clearTimeout(entry.timer); entry.controller.abort(); this._async.delete(id); this._setAsyncBusy(id, false); } }
  /** @param {string} id @param {boolean} busy @returns {void} */
  _setAsyncBusy(id, busy) {
    const input = this.el.querySelector(`[data-node-id="${cssEscape(id)}"] [data-filter-value]`);
    if (busy) input?.setAttribute('aria-busy', 'true');
    else input?.removeAttribute('aria-busy');
  }
  /** @param {any} node @returns {void} */
  _abortTree(node) { if (node.kind === 'condition') this._abort(node.id); else node.children.forEach((child) => this._abortTree(child)); }
  /** @returns {void} */
  _abortAll() { for (const id of [...this._async.keys()]) this._abort(id); }
  /** @returns {void} */
  _destroyEditors() {
    for (const editor of [...(this._customEditors ?? []), ...(this._selectEditors ?? [])]) editor.destroy?.();
    this._customEditors = []; this._selectEditors = [];
  }
  /** @returns {boolean} */
  _blocked() { return this._readonly || this._disabled; }
  /** @returns {boolean} */
  _canMutate() { return !this._blocked(); }
  /** @returns {{maxDepth:number,maxConditions:number}} */
  _limits() { return { maxDepth: Number(this.options.maxDepth), maxConditions: Number(this.options.maxConditions) }; }
  /** @param {string} id @returns {FilterField|null} */
  _field(id) { return this._fields.find((field) => field.id === id) ?? null; }
  /** @param {string} id @returns {any} */
  _operator(id) { return this._operators.find((operator) => operator.id === id) ?? null; }
  /** @param {FilterField|null} field @returns {any[]} */
  _operatorsFor(field) { if (!field) return []; const ids = field.operators?.length ? field.operators : null; return this._operators.filter((operator) => ids ? ids.includes(operator.id) : operator.types.includes(field.type)); }
  /** @param {FilterField|null} field @returns {string|null} */
  _defaultOperator(field) { return field?.defaultOperator && this._operatorsFor(field).some((operator) => operator.id === field.defaultOperator) ? field.defaultOperator : this._operatorsFor(field)[0]?.id ?? null; }
  /** @param {string} text @returns {void} */
  _announce(text) { if (this.refs.status) this.refs.status.textContent = text; }

  /** Names a field or operator a saved expression refers to that this instance does not offer.
   * @param {string} id Unknown field or operator ID. @returns {string} */
  _unavailable(id) { return this._message('filter.unavailable', 'Unavailable: %1', id); }

  /** @param {any} node Condition. @param {FilterField|null} field Resolved field. @returns {HTMLElement} */
  _removeConditionButton(node, field) {
    const label = this._message('filter.remove', 'Remove %1',
      field?.label ?? this._message('filter.filterNoun', 'filter'));
    return actionButton('remove', node.id, 'trash', label,
      { disabled: this._blocked(), ariaLabel: label });
  }

  /**
   * Resolves the strings the two value builders need. They are module functions so that the
   * markup they produce stays testable without a component, which means the words have to be
   * handed to them rather than looked up inside.
   * @returns {FilterValueMessages}
   */
  _valueMessages() {
    return {
      choose: this._message('filter.choose', 'Choose…'),
      yes: this._message('filter.booleanTrue', 'True'),
      no: this._message('filter.booleanFalse', 'False'),
      commaSeparated: this._message('filter.commaSeparated', 'Comma-separated values'),
      value: (label) => this._message('filter.fieldValue', '%1 value', label),
      valueAt: (label, position) => this._message('filter.fieldValueAt', '%1 value %2', label, position)
    };
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

/** @param {string} action @param {string} id @param {string} iconName @param {string} label @param {Record<string,any>} [props={}] `kind` picks the Button kind; the rest are element properties. @returns {HTMLElement} */
function actionButton(action, id, iconName, label, props = {}) {
  const { kind, ...rest } = props;
  return h('button', {
    type: 'button', class: 'zx-btn', ...rest,
    dataset: { filterAction: action, nodeId: id, size: 'sm', ...(kind ? { kind } : {}) }
  }, icon(iconName), h('span', {}, label));
}

/**
 * The word a compact row's connector shows for a group's logic, and the name it is read by. The
 * name starts with the visible word (WCAG 2.5.3, label in name) and says what a click does.
 * @param {'and'|'or'} logic Group logic.
 * @param {(key: string, fallback: string, ...args: unknown[]) => string} [message] Message
 *   resolver; omitted uses the built-in English text.
 * @returns {{word: string, name: string}}
 */
export function filterConnectorText(logic, message = (_key, fallback, ...args) => printf(fallback, args)) {
  const word = logic === 'or' ? message('filter.or', 'or') : message('filter.and', 'and');
  const name = logic === 'or'
    ? message('filter.switchToAll', '%1 — switch to all', word)
    : message('filter.switchToAny', '%1 — switch to any', word);
  return { word, name };
}

/**
 * The logic a group's connector switches it to: the other one, or null when there is no such
 * group or it is the root and `rootLogic` restricts it. The group's select offers the same two
 * values, so the connector and the select always name one state.
 * @param {FilterAst} value Expression.
 * @param {string} groupId Group to switch.
 * @param {'and'|'or'|null} [rootLogic=null] Root restriction, as the `rootLogic` option.
 * @returns {'and'|'or'|null}
 */
export function nextFilterGroupLogic(value, groupId, rootLogic = null) {
  const group = findGroup(value?.root, groupId);
  if (!group || (group === value.root && rootLogic)) return null;
  return group.logic === 'or' ? 'and' : 'or';
}

/**
 * Builds the value of a relative date condition from what its two controls hold: the pair
 * `[amount, unit]`. An empty or non-numeric amount is kept as null — the condition is then
 * incomplete rather than silently zero — and an unknown unit falls back to days.
 * @param {unknown} amount Amount control value.
 * @param {unknown} unit Unit control value.
 * @returns {[number|null, 'days'|'weeks'|'months']}
 */
export function relativeDateValue(amount, unit) {
  const text = String(amount ?? '').trim();
  const number = text === '' ? NaN : Number(text);
  const unitId = RELATIVE_DATE_UNITS.includes(String(unit)) ? String(unit) : RELATIVE_DATE_UNITS[0];
  return [Number.isFinite(number) ? number : null, /** @type {'days'|'weeks'|'months'} */ (unitId)];
}

/**
 * Reads a stored relative date value for display. Anything that is not `[amount, unit]` — null,
 * or two dates written by the date-pair editor these operators used to get — reads as an empty
 * amount in days.
 * @param {unknown} value Stored condition value.
 * @returns {{amount: number|null, unit: 'days'|'weeks'|'months'}}
 */
export function readRelativeDateValue(value) {
  if (!Array.isArray(value) || value.length !== 2 || !RELATIVE_DATE_UNITS.includes(String(value[1]))) {
    return { amount: null, unit: 'days' };
  }
  const amount = typeof value[0] === 'number' && Number.isFinite(value[0]) ? value[0] : null;
  return { amount, unit: /** @type {'days'|'weeks'|'months'} */ (String(value[1])) };
}

/**
 * Why a relative date value is unusable, or null when it is a positive whole number of a known
 * unit: `[7, 'days']`, `[2, 'weeks']`, `[3, 'months']`.
 * @param {unknown} value Condition value.
 * @returns {'shape'|'amount'|'unit'|null}
 */
export function relativeDateValueError(value) {
  if (!Array.isArray(value) || value.length !== 2) return 'shape';
  if (!RELATIVE_DATE_UNITS.includes(String(value[1])) || typeof value[1] !== 'string') return 'unit';
  if (typeof value[0] !== 'number' || !Number.isInteger(value[0]) || value[0] < 1) return 'amount';
  return null;
}

/**
 * Static choices as `TagPicker` items: the raw value — a number stays a number — the label, and
 * the icon as given, a name or a node (the picker copies a node).
 * @param {FilterField['choices']} choices
 * @returns {Array<{value: string|number|boolean, label: string, icon?: Node|string, color?: string}>}
 */
export function filterTagItems(choices) {
  return (Array.isArray(choices) ? choices : []).map((choice) => ({
    value: choice.value, label: choice.label,
    ...(choice.icon ? { icon: choice.icon } : {}),
    ...(choice.color ? { color: choice.color } : {})
  }));
}

/**
 * The value a `TagPicker` change writes into a many-valued condition: a JSON-safe copy of the
 * chosen raw values, in the order chosen.
 * @param {unknown} values Picker values.
 * @returns {import('./filter-model.js').FilterJson}
 */
export function filterTagValue(values) {
  return cloneFilterValue(Array.isArray(values) ? [...values] : []);
}

/**
 * A host's `msg` option with one more message: added as a plain key and to every locale table,
 * since a locale entry is looked up first and would otherwise win.
 * @param {Record<string, any>|null|undefined} msg Host messages, flat or by locale.
 * @param {string} key Message key.
 * @param {string} value Message text.
 * @returns {Record<string, any>}
 */
export function withFilterMessage(msg, key, value) {
  const result = {};
  for (const [name, entry] of Object.entries(msg && typeof msg === 'object' ? msg : {})) {
    result[name] = entry && typeof entry === 'object' ? { ...entry, [key]: value } : entry;
  }
  result[key] = value;
  return result;
}

/**
 * A choice's glyph for a themed picker: an icon name drawn through `icon()`, or a copy of a node.
 * @param {{icon?: unknown}} item Field or value choice.
 * @returns {HTMLElement|null}
 */
function choiceGlyph(item) {
  const glyph = item?.icon;
  const content = typeof glyph === 'string' && glyph ? icon(glyph, { size: 14 })
    : glyph && typeof glyph === 'object' && typeof /** @type {Node} */ (glyph).nodeType === 'number'
      ? /** @type {Node} */ (glyph).cloneNode(true) : null;
  return content ? h('span', { class: 'zx-filter__choice-icon', ariaHidden: 'true' }, content) : null;
}

/** @param {FilterField} field @param {any} node @param {any} value @param {boolean} multiple @param {boolean} disabled @param {number} [index=0] @param {FilterValueMessages} [messages=BUILT_IN_VALUE_MESSAGES] @returns {HTMLSelectElement|null} */
function choiceSelect(field, node, value, multiple, disabled, index = 0, messages = BUILT_IN_VALUE_MESSAGES) {
  const choices = Array.isArray(field.choices) && field.choices.length
    ? field.choices
    : field.type === 'boolean'
      ? [{ value: true, label: messages.yes }, { value: false, label: messages.no }]
      : null;
  if (!choices) return null;
  const values = new Set(Array.isArray(value) ? value.map(String) : [String(value ?? '')]);
  return /** @type {HTMLSelectElement} */ (h('select', {
    dataset: { filterValue: '', nodeId: node.id, valueIndex: String(index) },
    ariaLabel: messages.value(field.label), multiple, disabled
  }, !multiple ? h('option', { value: '', selected: !values.has(String(value)) || value == null }, messages.choose) : null,
  choices.map((choice) => h('option', { value: choice.value, selected: values.has(String(choice.value)) }, choice.label))));
}

/** @param {FilterField} field @param {string} id @param {any} value @param {number} index @param {boolean} disabled @param {boolean} [many=false] @param {FilterValueMessages} [messages=BUILT_IN_VALUE_MESSAGES] @returns {HTMLElement} */
function valueInput(field, id, value, index, disabled, many = false, messages = BUILT_IN_VALUE_MESSAGES) {
  const type = many ? 'text' : ['number', 'money'].includes(field.type) ? 'number' : field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : 'text';
  const listId = field.loadChoices ? `zx-filter-choices-${id}-${index}` : null;
  const input = /** @type {HTMLInputElement} */ (h('input', {
    type, value: value ?? '', dataset: { filterValue: '', nodeId: id, valueIndex: String(index) },
    ariaLabel: index ? messages.valueAt(field.label, index + 1) : messages.value(field.label), disabled,
    placeholder: many ? messages.commaSeparated : '', list: listId
  }));
  return h('span', { class: 'zx-filter__value-control' },
    input, listId ? h('datalist', { id: listId }) : null);
}

/** @param {{id?: string, arity?: string}|null|undefined} operator @returns {boolean} */
function isRelativeDateOperator(operator) {
  return Boolean(operator) && (RELATIVE_DATE_OPERATORS.has(String(operator.id)) || operator.arity === 'relative');
}
/** @param {any} node @returns {any[]} Every condition under a node, in document order. */
function conditionNodes(node) { if (!node) return []; if (node.kind === 'condition') return [node]; return node.children.flatMap((child) => conditionNodes(child)); }
/** @param {unknown} value @param {string} type @returns {any} */
function parseScalar(value, type) { if (value === '') return null; if (['number', 'money'].includes(type)) { const number = Number(value); return Number.isFinite(number) ? number : null; } if (type === 'boolean') return value === 'true'; return value; }
/** @param {unknown} value @returns {any} */
function parseValueJson(value) { return cloneFilterValue(value === undefined ? null : value); }
/** @param {any} root @param {string} id @returns {any|null} */
function findNode(root, id) { if (!root || root.id === id) return root ?? null; if (root.kind === 'group') for (const child of root.children) { const match = findNode(child, id); if (match) return match; } return null; }
/** @param {any} root @param {string} id @returns {any|null} */
function findGroup(root, id) { if (!root) return null; const node = findNode(root, id); return node?.kind === 'group' ? node : null; }
/** @param {any} root @param {string} id @returns {any|null} */
function findParent(root, id) { if (root?.kind !== 'group') return null; if (root.children.some((child) => child.id === id)) return root; for (const child of root.children) { const parent = findParent(child, id); if (parent) return parent; } return null; }
/** @param {any} root @param {string} id @returns {any|null} */
function removeNode(root, id) { if (root.kind !== 'group') return null; const index = root.children.findIndex((child) => child.id === id); if (index >= 0) return root.children.splice(index, 1)[0]; for (const child of root.children) { const found = removeNode(child, id); if (found) return found; } return null; }
/** @param {any} node @param {string} id @returns {boolean} */
function containsNode(node, id) { return Boolean(node && findNode(node, id)); }
/** @param {any} node @returns {number} */
function conditionCount(node) { return node.kind === 'condition' ? 1 : node.children.reduce((sum, child) => sum + conditionCount(child), 0); }
/** @param {any} node @returns {string[]} */
/** @param {any} root @param {string} id @param {number} [depth=0] @returns {number} */
function groupDepth(root, id, depth = 0) { if (root.id === id) return depth; if (root.kind === 'group') for (const child of root.children) { if (child.kind === 'group') { const found = groupDepth(child, id, depth + 1); if (found >= 0) return found; } } return -1; }
/** @param {any[]} base @param {any[]} extra @returns {any[]} */
function mergeOperators(base, extra) { const map = new Map(base.map((item) => [item.id, { ...item, types: [...item.types] }])); for (const item of Array.isArray(extra) ? extra : []) if (item?.id) map.set(String(item.id), { ...item, id: String(item.id), types: Array.isArray(item.types) ? [...item.types] : [] }); return [...map.values()]; }
/** @param {string} value @returns {string} */
function cssEscape(value) { return globalThis.CSS?.escape ? CSS.escape(value) : String(value).replaceAll(/[^a-zA-Z0-9_-]/g, '\\$&'); }

/** @event Filter#change @type {CustomEvent<Record<string,unknown>>} */
/** @event Filter#apply @type {CustomEvent<{value:FilterAst}>} */
/** @event Filter#invalid @type {CustomEvent<Record<string,unknown>>} */
/** @event Filter#query @type {CustomEvent<Record<string,unknown>>} */
/** @event Filter#loaded @type {CustomEvent<Record<string,unknown>>} */
/** @event Filter#error @type {CustomEvent<Record<string,unknown>>} */

/**
 * Reports a restricted root mismatch without mutating the supplied expression.
 * @param {FilterAst} value Expression to validate.
 * @param {'and'|'or'|null} logic Required root logic.
 * @returns {Record<string,string>|null} Actionable validation error, or null.
 */
export function rootLogicError(value, logic) {
  if (!logic || value.root.logic === logic) return null;
  return {nodeId: value.root.id, code: 'root-logic', message: `This filter requires match ${logic === 'or' ? 'any' : 'all'} conditions.`};
}
