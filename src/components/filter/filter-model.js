import { uid } from '../../core/util.js';

/** @typedef {null|boolean|number|string|FilterJson[]|{[key:string]: FilterJson}} FilterJson */
/** @typedef {{kind:'condition', id:string, field:string, operator:string, value:FilterJson}} FilterCondition */
/** @typedef {{kind:'group', id:string, logic:'and'|'or', children:FilterNode[]}} FilterGroup */
/** @typedef {FilterCondition|FilterGroup} FilterNode */
/** @typedef {{version:1, root:FilterGroup}} FilterAst */
/** @typedef {{id:string, label:string, arity:'none'|'single'|'pair'|'many', types:string[]}} FilterOperator */
/** @typedef {{id:string, label:string, type:string, operators?:string[], defaultOperator?:string}} FilterField */
/** @typedef {{nodeId:string, code:string, message:string}} FilterValidationError */

/** Core operators are application-neutral IDs; an adapter maps them to executable query syntax. */
export const filterOperators = Object.freeze([
  op('contains', 'contains', 'single', ['text']),
  op('notContains', 'does not contain', 'single', ['text']),
  op('eq', 'is', 'single', ['text', 'number', 'money', 'boolean', 'enum', 'status', 'priority', 'country', 'currency', 'unit', 'entity', 'date', 'datetime']),
  op('neq', 'is not', 'single', ['text', 'number', 'money', 'boolean', 'enum', 'status', 'priority', 'country', 'currency', 'unit', 'entity', 'date', 'datetime']),
  op('startsWith', 'starts with', 'single', ['text']),
  op('endsWith', 'ends with', 'single', ['text']),
  op('lt', 'is less than', 'single', ['number', 'money']),
  op('lte', 'is at most', 'single', ['number', 'money']),
  op('gt', 'is greater than', 'single', ['number', 'money']),
  op('gte', 'is at least', 'single', ['number', 'money']),
  op('on', 'is on', 'single', ['date', 'datetime']),
  op('notOn', 'is not on', 'single', ['date', 'datetime']),
  op('before', 'is before', 'single', ['date', 'datetime']),
  op('onOrBefore', 'is on or before', 'single', ['date', 'datetime']),
  op('after', 'is after', 'single', ['date', 'datetime']),
  op('onOrAfter', 'is on or after', 'single', ['date', 'datetime']),
  op('between', 'is between', 'pair', ['number', 'money', 'date', 'datetime']),
  op('notBetween', 'is not between', 'pair', ['number', 'money', 'date', 'datetime']),
  op('withinLast', 'is within the last', 'pair', ['date', 'datetime']),
  op('withinNext', 'is within the next', 'pair', ['date', 'datetime']),
  op('anyOf', 'is any of', 'many', ['enum', 'status', 'priority', 'country', 'currency', 'unit', 'entity']),
  op('noneOf', 'is none of', 'many', ['enum', 'status', 'priority', 'country', 'currency', 'unit', 'entity']),
  op('containsAny', 'contains any', 'many', ['tags']),
  op('containsAll', 'contains all', 'many', ['tags']),
  op('containsNone', 'contains none', 'many', ['tags']),
  op('isEmpty', 'is empty', 'none', ['text', 'number', 'money', 'date', 'datetime', 'boolean', 'enum', 'status', 'priority', 'country', 'currency', 'unit', 'entity', 'tags']),
  op('isNotEmpty', 'is not empty', 'none', ['text', 'number', 'money', 'date', 'datetime', 'boolean', 'enum', 'status', 'priority', 'country', 'currency', 'unit', 'entity', 'tags'])
]);

/** @returns {FilterAst} */
export function emptyFilterAst() {
  return { version: 1, root: { kind: 'group', id: uid('filter-root'), logic: 'and', children: [] } };
}

/** @param {Partial<FilterCondition>} [initial={}] @returns {FilterCondition} */
export function filterCondition(initial = {}) {
  return {
    kind: 'condition',
    id: String(initial.id || uid('filter-condition')),
    field: String(initial.field ?? ''),
    operator: String(initial.operator ?? ''),
    value: cloneFilterValue(initial.value ?? null)
  };
}

/**
 * Returns a defensive JSON-safe copy suitable for a condition value.
 * @param {unknown} value
 * @returns {FilterJson}
 */
export function cloneFilterValue(value) {
  return cloneJson(value);
}

/** @param {'and'|'or'} [logic='and'] @param {FilterNode[]} [children=[]] @returns {FilterGroup} */
export function filterGroup(logic = 'and', children = []) {
  return { kind: 'group', id: uid('filter-group'), logic, children };
}

/**
 * Parses untrusted state into a defensive JSON-safe AST. It rejects structural corruption but
 * deliberately keeps unknown field/operator IDs for semantic validation and migration UI.
 * @param {unknown} value
 * @param {{maxDepth?:number, maxConditions?:number}} [limits={}]
 * @returns {FilterAst}
 */
export function parseFilterAst(value, limits = {}) {
  const maxDepth = finiteLimit(limits.maxDepth, 3);
  const maxConditions = finiteLimit(limits.maxConditions, 50);
  if (!plainObject(value) || value.version !== 1 || !plainObject(value.root)) {
    throw new TypeError('Filter AST must have version 1 and a root group');
  }
  const ids = new Set();
  let conditions = 0;
  const visit = (raw, depth, root = false) => {
    if (!plainObject(raw)) throw new TypeError('Filter nodes must be plain objects');
    const id = String(raw.id ?? '').trim();
    if (!id || ids.has(id)) throw new TypeError('Filter node IDs must be non-empty and unique');
    ids.add(id);
    if (raw.kind === 'group') {
      if (depth > maxDepth) throw new RangeError('Filter group depth exceeds maxDepth');
      if (raw.logic !== 'and' && raw.logic !== 'or') throw new TypeError('Filter group logic must be and or or');
      if (!Array.isArray(raw.children)) throw new TypeError('Filter group children must be an array');
      return {
        kind: 'group', id, logic: raw.logic,
        children: raw.children.map((child) => visit(child, depth + 1, false))
      };
    }
    if (root || raw.kind !== 'condition') throw new TypeError('Filter root must be a group');
    conditions += 1;
    if (conditions > maxConditions) throw new RangeError('Filter condition count exceeds maxConditions');
    return {
      kind: 'condition', id,
      field: String(raw.field ?? ''), operator: String(raw.operator ?? ''),
      value: cloneJson(raw.value)
    };
  };
  const root = visit(value.root, 0, true);
  if (root.kind !== 'group') throw new TypeError('Filter root must be a group');
  return /** @type {FilterAst} */ ({ version: 1, root });
}

/** @param {FilterAst} value @returns {FilterAst} */
export function cloneFilterAst(value) {
  return parseFilterAst(value, { maxDepth: Infinity, maxConditions: Infinity });
}

/** @param {FilterAst} value @returns {string} */
export function stringifyFilterAst(value) {
  return JSON.stringify(cloneFilterAst(value));
}

/**
 * Performs field/operator/arity validation without compiling or executing the expression.
 * @param {FilterAst} ast
 * @param {FilterField[]} fields
 * @param {FilterOperator[]} [operators=filterOperators]
 * @returns {{valid:boolean, errors:FilterValidationError[]}}
 */
export function validateFilterAst(ast, fields, operators = filterOperators) {
  const errors = [];
  const fieldMap = new Map((Array.isArray(fields) ? fields : []).map((field) => [String(field.id), field]));
  const operatorMap = new Map((Array.isArray(operators) ? operators : []).map((operator) => [String(operator.id), operator]));
  const visit = (node, root = false) => {
    if (node.kind === 'group') {
      if (!root && node.children.length === 0) errors.push(error(node.id, 'empty-group', 'Nested groups need at least one condition'));
      node.children.forEach((child) => visit(child));
      return;
    }
    const field = fieldMap.get(node.field);
    if (!field) errors.push(error(node.id, 'unknown-field', node.field ? `Unavailable field: ${node.field}` : 'Choose a field'));
    const operator = operatorMap.get(node.operator);
    if (!operator) {
      errors.push(error(node.id, 'unknown-operator', node.operator ? `Unavailable operator: ${node.operator}` : 'Choose an operator'));
      return;
    }
    if (field) {
      const allowed = Array.isArray(field.operators) && field.operators.length
        ? field.operators : operators.filter((candidate) => candidate.types.includes(field.type)).map((candidate) => candidate.id);
      if (!allowed.includes(operator.id) || !operator.types.includes(field.type)) {
        errors.push(error(node.id, 'operator-type', `${operator.label} is not available for ${field.label}`));
      }
    }
    if (!validArity(operator.arity, node.value)) {
      errors.push(error(node.id, 'value', operator.arity === 'pair' ? 'Enter both values'
        : operator.arity === 'many' ? 'Choose at least one value'
          : operator.arity === 'none' ? 'This operator does not accept a value' : 'Enter a value'));
    }
  };
  visit(ast.root, true);
  return { valid: errors.length === 0, errors };
}

/** @param {string} id @param {string} label @param {FilterOperator['arity']} arity @param {string[]} types @returns {FilterOperator} */
function op(id, label, arity, types) { return Object.freeze({ id, label, arity, types: Object.freeze(types) }); }

/** @param {string} nodeId @param {string} code @param {string} message @returns {FilterValidationError} */
function error(nodeId, code, message) { return { nodeId, code, message }; }

/** @param {FilterOperator['arity']} arity @param {FilterJson} value @returns {boolean} */
function validArity(arity, value) {
  if (arity === 'none') return value === null;
  if (arity === 'pair') return Array.isArray(value) && value.length === 2 && value.every(filled);
  if (arity === 'many') return Array.isArray(value) && value.length > 0 && value.every(filled);
  return filled(value);
}

/** @param {unknown} value @returns {boolean} */
function filled(value) { return value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === ''); }

/** @param {unknown} value @param {WeakSet<object>} [seen=new WeakSet()] @returns {FilterJson} */
function cloneJson(value, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Filter values cannot contain non-finite numbers');
    return value;
  }
  if (typeof value !== 'object' || value instanceof Date || typeof value.nodeType === 'number') {
    throw new TypeError('Filter values must be JSON-safe');
  }
  if (seen.has(value)) throw new TypeError('Filter values cannot contain cycles');
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((item) => cloneJson(item, seen));
    seen.delete(value);
    return result;
  }
  if (!plainObject(value)) throw new TypeError('Filter values must be plain JSON objects');
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    // Assignment to `__proto__` is special on ordinary objects. Defining an own data property
    // preserves the JSON member without changing the clone's prototype.
    Object.defineProperty(result, key, {
      value: cloneJson(item, seen), enumerable: true, configurable: true, writable: true
    });
  }
  seen.delete(value);
  return result;
}

/** @param {unknown} value @returns {boolean} */
function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** @param {unknown} value @param {number} fallback @returns {number} */
function finiteLimit(value, fallback) {
  if (value === Infinity) return Infinity;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}
