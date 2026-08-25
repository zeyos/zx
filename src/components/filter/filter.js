import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
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
 * @property {Array<{value:string|number|boolean,label:string,icon?:Node|string,color?:string}>} [choices] Static choices.
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
 * @property {boolean} [autoApply=false] Emit apply after every valid mutation.
 * @property {boolean} [readonly=false] Prevent mutations while keeping values readable.
 * @property {boolean} [disabled=false] Disable all controls.
 * @property {string} [applyLabel='Apply filters'] Apply button label.
 * @property {string} [clearLabel='Clear'] Clear button label.
 * @property {(event:CustomEvent<Record<string,unknown>>)=>void} [onchange] Draft-change listener.
 * @property {(event:CustomEvent<Record<string,unknown>>)=>void} [onapply] Valid-apply listener.
 * @property {(event:CustomEvent<Record<string,unknown>>)=>void} [oninvalid] Invalid-apply listener.
 * @property {(event:CustomEvent<Record<string,unknown>>)=>void} [onquery] Async query listener.
 * @property {(event:CustomEvent<Record<string,unknown>>)=>void} [onloaded] Async loaded listener.
 * @property {(event:CustomEvent<Record<string,unknown>>)=>void} [onerror] Async failure listener.
 */

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
    applyLabel: 'Apply filters', clearLabel: 'Clear'
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
    const label = removed.kind === 'condition' ? this._field(removed.field)?.label ?? 'Filter' : 'Filter group';
    this._announce(`${label} removed`);
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
  validate() { return validateFilterAst(this._value, this._fields, this._operators); }

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
      ? `[data-node-id="${cssEscape(id)}"] :is([data-filter-field], [data-filter-logic], [data-filter-action="add"])`
      : '[data-filter-action="add"]';
    queueMicrotask(() => /** @type {HTMLElement|null} */ (this.el.querySelector(selector))?.focus());
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
      actionButton('add', this._value.root.id, 'plus', 'Add filter', { ref: 'add', disabled: this._blocked() }),
      this.options.allowGroups ? actionButton('add-group', this._value.root.id, 'folder', 'Add group', { disabled: this._blocked() }) : null,
      actionButton('clear', '', 'x', String(this.options.clearLabel), { disabled: this._blocked() }),
      actionButton('apply', '', 'check', String(this.options.applyLabel), { class: 'zx-button--primary', disabled: this._disabled })
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
      group.children.map((node) => node.kind === 'group' ? this._renderGroup(node, depth + 1, false) : this._renderCondition(node)));
    const logic = h('select', {
      class: 'zx-filter__logic', dataset: { filterLogic: '', nodeId: group.id },
      ariaLabel: root ? 'Root filter logic' : 'Group filter logic', disabled: this._blocked()
    },
    h('option', { value: 'and', selected: group.logic === 'and' }, 'Match all'),
    h('option', { value: 'or', selected: group.logic === 'or' }, 'Match any'));
    const legend = h('legend', { class: 'zx-filter__legend' }, logic, h('span', {}, root ? 'conditions' : 'in this group'));
    const controls = h('div', { class: 'zx-filter__group-actions' },
      actionButton('add', group.id, 'plus', 'Add filter', { disabled: this._blocked() }),
      this.options.allowGroups && depth < Number(this.options.maxDepth)
        ? actionButton('add-group', group.id, 'folder', 'Add subgroup', { disabled: this._blocked() }) : null,
      root ? null : actionButton('remove', group.id, 'trash', 'Remove group', { disabled: this._blocked() })
    );
    return h(root ? 'fieldset' : 'li', {
      class: 'zx-filter__group', dataset: { nodeId: group.id, depth: String(depth) }
    }, root ? legend : h('fieldset', {}, legend, children, controls), root ? children : null, root ? controls : null);
  }

  /** @param {any} node @returns {HTMLElement} */
  _renderCondition(node) {
    const field = this._field(node.field);
    const operators = this._operatorsFor(field);
    const operator = this._operator(node.operator);
    const fieldSelect = h('select', {
      class: 'zx-filter__field', dataset: { filterField: '', nodeId: node.id },
      ariaLabel: 'Filter field', disabled: this._blocked()
    },
    h('option', { value: '', selected: !node.field }, 'Choose a field…'),
    this._fields.map((candidate) => h('option', { value: candidate.id, selected: candidate.id === node.field }, candidate.label)),
    node.field && !field ? h('option', { value: node.field, selected: true }, `Unavailable: ${node.field}`) : null);
    const operatorSelect = h('select', {
      class: 'zx-filter__operator', dataset: { filterOperator: '', nodeId: node.id },
      ariaLabel: 'Filter operator', disabled: this._blocked()
    },
    h('option', { value: '', selected: !node.operator }, 'Choose an operator…'),
    operators.map((candidate) => h('option', { value: candidate.id, selected: candidate.id === node.operator }, candidate.label)),
    node.operator && !operators.some((candidate) => candidate.id === node.operator)
      ? h('option', { value: node.operator, selected: true }, `Unavailable: ${node.operator}`) : null);
    return h('li', { class: 'zx-filter__condition', dataset: { nodeId: node.id } },
      fieldSelect, operatorSelect, this._renderValue(node, field, operator),
      actionButton('remove', node.id, 'trash', `Remove ${field?.label ?? 'filter'}`, { disabled: this._blocked() })
    );
  }

  /** @param {any} node @param {FilterField|null} field @param {any} operator @returns {HTMLElement} */
  _renderValue(node, field, operator) {
    const host = h('div', { class: 'zx-filter__value' });
    if (!field || !operator) return host;
    if (operator.arity === 'none') return h('div', { class: 'zx-filter__value zx-filter__value--empty' }, 'No value');
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
    const values = operator.arity === 'pair' ? (Array.isArray(node.value) ? node.value : [null, null]) : [node.value];
    if (operator.arity === 'many') {
      const control = choiceSelect(field, node, values[0], true, this._blocked());
      if (control) return h('div', { class: 'zx-filter__value' }, control);
      return h('div', { class: 'zx-filter__value' }, valueInput(field, node.id, Array.isArray(node.value) ? node.value.join(', ') : '', 0, this._blocked(), true));
    }
    const controls = values.map((value, index) => choiceSelect(field, node, value, false, this._blocked(), index)
      ?? valueInput(field, node.id, value, index, this._blocked()));
    return h('div', { class: 'zx-filter__value', dataset: { arity: operator.arity } }, controls);
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
      if (node?.kind === 'group') node.logic = target.value === 'or' ? 'or' : 'and';
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
    if (target instanceof HTMLSelectElement && target.multiple) {
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
  _destroyEditors() { for (const editor of this._customEditors ?? []) editor.destroy?.(); this._customEditors = []; }
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
}

/** @param {string} action @param {string} id @param {string} iconName @param {string} label @param {Record<string,any>} [props={}] @returns {HTMLElement} */
function actionButton(action, id, iconName, label, props = {}) {
  return h('button', { type: 'button', class: ['zx-button', 'zx-button--sm', props.class].filter(Boolean), ...props, dataset: { filterAction: action, nodeId: id } }, icon(iconName, { size: 13 }), h('span', {}, label));
}

/** @param {FilterField} field @param {any} node @param {any} value @param {boolean} multiple @param {boolean} disabled @param {number} [index=0] @returns {HTMLSelectElement|null} */
function choiceSelect(field, node, value, multiple, disabled, index = 0) {
  const choices = Array.isArray(field.choices) && field.choices.length
    ? field.choices
    : field.type === 'boolean'
      ? [{ value: true, label: 'True' }, { value: false, label: 'False' }]
      : null;
  if (!choices) return null;
  const values = new Set(Array.isArray(value) ? value.map(String) : [String(value ?? '')]);
  return /** @type {HTMLSelectElement} */ (h('select', {
    dataset: { filterValue: '', nodeId: node.id, valueIndex: String(index) },
    ariaLabel: `${field.label} value`, multiple, disabled
  }, !multiple ? h('option', { value: '', selected: !values.has(String(value)) || value == null }, 'Choose…') : null,
  choices.map((choice) => h('option', { value: choice.value, selected: values.has(String(choice.value)) }, choice.label))));
}

/** @param {FilterField} field @param {string} id @param {any} value @param {number} index @param {boolean} disabled @param {boolean} [many=false] @returns {HTMLElement} */
function valueInput(field, id, value, index, disabled, many = false) {
  const type = many ? 'text' : ['number', 'money'].includes(field.type) ? 'number' : field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : 'text';
  const listId = field.loadChoices ? `zx-filter-choices-${id}-${index}` : null;
  const input = /** @type {HTMLInputElement} */ (h('input', {
    type, value: value ?? '', dataset: { filterValue: '', nodeId: id, valueIndex: String(index) },
    ariaLabel: `${field.label} value${index ? ` ${index + 1}` : ''}`, disabled,
    placeholder: many ? 'Comma-separated values' : '', list: listId
  }));
  return h('span', { class: 'zx-filter__value-control' },
    input, listId ? h('datalist', { id: listId }) : null);
}

/** @param {unknown} value @param {string} type @returns {any} */
function parseScalar(value, type) { if (value === '') return null; if (['number', 'money'].includes(type)) { const number = Number(value); return Number.isFinite(number) ? number : null; } if (type === 'boolean') return value === 'true'; return value; }
/** @param {unknown} value @returns {any} */
function parseValueJson(value) { return cloneFilterValue(value === undefined ? null : value); }
/** @param {any} root @param {string} id @returns {any|null} */
function findNode(root, id) { if (!root || root.id === id) return root ?? null; if (root.kind === 'group') for (const child of root.children) { const match = findNode(child, id); if (match) return match; } return null; }
/** @param {any} root @param {string} id @returns {any|null} */
function findGroup(root, id) { const node = findNode(root, id); return node?.kind === 'group' ? node : null; }
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
