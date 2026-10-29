/**
 * The overview composition's model (see `overview.js`), kept apart from the DOM so it can be
 * tested without a page: how the chip bar and the filter drawer translate into each other, which
 * drawer rows are still being written, how a record is matched against the filter, how the records
 * are sorted, grouped, and counted for a page, and how the board's columns and swim lanes follow
 * the grouping.
 */
// The model module rather than the package entry: it loads in Node, where the unit tests run.
import { filterOperators } from '../../src/components/filter/filter-model.js';

/**
 * @typedef {{id?: string, field: string, operator: string, value: any}} ChipCondition
 * @typedef {{logic: 'and'|'or', conditions: ChipCondition[], advanced: any}} OverviewFilters
 * @typedef {(record: Record<string, any>, field: string) => any} ValueReader
 *   Reads a field's value from a record; the overview's reads `get(record)` where a field has one.
 * @typedef {{id: string|number, label: string, tone?: string|null}} OverviewBucket
 * @typedef {{buckets: OverviewBucket[], other?: OverviewBucket|null}} OverviewAxis
 *   A groupable field's buckets in order; `other`, when given, collects the records whose value is
 *   in none of them, so nothing drops out of a grouped view or a board.
 * @typedef {{id: string, label: string, tone: string|null, match: (record: Record<string, any>) => boolean}} OverviewGroup
 */

/**
 * The filter model as the expression the drawer edits: the nested expression when there is one,
 * otherwise one root group holding a condition per chip, joined by the chips' Match all/any.
 * @param {OverviewFilters} filters
 * @returns {any} A `FilterAst`.
 */
function filtersToAst({ logic, conditions, advanced }) {
  if (advanced) return structuredClone(advanced);
  return {
    version: 1,
    root: {
      kind: 'group', id: 'filter-root', logic,
      children: conditions.map((condition, index) => ({
        kind: 'condition', id: condition.id ?? `condition-${index}`,
        field: condition.field, operator: condition.operator, value: structuredClone(condition.value ?? null)
      }))
    }
  };
}

/**
 * The drawer's expression as the filter model. A root group of plain conditions is the chips
 * again — one chip per condition, its logic the Match all/any — so the drawer and the bar stay two
 * views of one filter; anything nested is kept whole and shows as the "Advanced filter" chip.
 * @param {any} ast A valid `FilterAst`.
 * @returns {OverviewFilters}
 */
function astToFilters(ast) {
  const { root } = ast;
  if (!root.children.every((child) => child.kind === 'condition')) {
    return { logic: root.logic, conditions: [], advanced: structuredClone(ast) };
  }
  return {
    logic: root.logic,
    conditions: root.children.map(({ id, field, operator, value }) => ({ id, field, operator, value })),
    advanced: null
  };
}

/** @param {unknown} entry @returns {boolean} Whether one value is filled in. */
function filled(entry) {
  return entry !== null && entry !== undefined && !(typeof entry === 'string' && entry.trim() === '');
}

/**
 * Whether a drawer row is still being written: a condition without a field, an operator, or the
 * value its operator needs, or a group with nothing complete in it yet. Such a row is not applied;
 * it waits in the drawer.
 * @param {any} node Filter node.
 * @returns {boolean}
 */
function isDraftNode(node) {
  if (node.kind === 'group') return !node.children.some((child) => !isDraftNode(child));
  if (!node.field || !node.operator) return true;
  const arity = filterOperators.find((operator) => operator.id === node.operator)?.arity ?? 'single';
  if (arity === 'none') return false;
  if (arity === 'many') return !Array.isArray(node.value) || node.value.length === 0 || !node.value.every(filled);
  if (arity === 'pair') return !Array.isArray(node.value) || node.value.length !== 2 || !node.value.every(filled);
  return !filled(node.value);
}

/**
 * The expression without the rows still being written, at any depth: what the list applies while
 * the drawer holds an unfinished row beside finished ones.
 * @param {any} ast `FilterAst`.
 * @returns {any} A new `FilterAst`.
 */
function withoutDrafts(ast) {
  /** @param {any} group @returns {any} */
  const prune = (group) => ({
    ...group,
    children: group.children.filter((child) => !isDraftNode(child))
      .map((child) => (child.kind === 'group' ? prune(child) : structuredClone(child)))
  });
  return { version: 1, root: prune(ast.root) };
}

/**
 * The value to hand an open drawer after the filter changed from outside it — a chip edited or
 * removed, Match all/any, a saved view: the committed expression, followed by the rows the drawer
 * still holds unfinished at its top level, so a change in the bar never throws away a row the
 * reader is writing. Drafts inside nested groups go with their group, which the committed
 * expression replaces.
 * @param {any} committed `FilterAst` of the filter as applied.
 * @param {any|null} drawer `FilterAst` the drawer shows now, or null.
 * @returns {any} A new `FilterAst`.
 */
function mergeDrafts(committed, drawer) {
  const next = structuredClone(committed);
  if (!drawer) return next;
  const taken = new Set();
  /** @param {any} node @returns {void} */
  const collect = (node) => {
    taken.add(node.id);
    if (node.kind === 'group') node.children.forEach(collect);
  };
  collect(next.root);
  for (const child of drawer.root.children) {
    if (isDraftNode(child) && !taken.has(child.id)) next.root.children.push(structuredClone(child));
  }
  return next;
}

/**
 * The board's two axes and the grouping, on the board. The rule, in every combination:
 *
 * - Swim lanes ARE the grouping. The View badge, Group by, and Swim lanes always name the same
 *   field, or none of them does.
 * - Columns and lanes are never the same field.
 * - Choosing a grouping (by Group by or by Swim lanes) that is the column field moves the columns
 *   to another axis: the lanes take the field the reader asked for.
 * - Choosing a column field that is the grouping swaps the axes: the lanes take the old column
 *   field, so the grouping changes with them rather than disappearing.
 * - Entering the board with a grouping equal to the columns resolves the same way as choosing it.
 *
 * With `collision: 'drop'` nothing moves: a grouping equal to the column field is kept but shows no
 * lanes on the board (see `boardLane()`), and comes back as the grouping off the board.
 *
 * @param {{columnBy: string, group: string}} board Current column field and grouping (`'none'`).
 * @param {{group?: string, columnBy?: string}} change What the reader chose.
 * @param {string[]} axes The fields the board can use, in preference order.
 * @param {'swap'|'drop'} [collision='swap'] What a collision does.
 * @returns {{columnBy: string, group: string}}
 */
function resolveBoardAxes({ columnBy, group }, change, axes, collision = 'swap') {
  if (collision === 'drop') return { columnBy: change.columnBy ?? columnBy, group: change.group ?? group };
  if (change.columnBy !== undefined && change.columnBy !== columnBy) {
    const nextColumns = change.columnBy;
    return { columnBy: nextColumns, group: group === nextColumns ? columnBy : group };
  }
  const nextGroup = change.group ?? group;
  if (nextGroup !== 'none' && nextGroup === columnBy) {
    const other = axes.find((axis) => axis !== nextGroup) ?? columnBy;
    return { columnBy: other, group: other === columnBy ? 'none' : nextGroup };
  }
  return { columnBy, group: nextGroup };
}

/**
 * The swim lanes a board shows: the grouping, unless it is the column field — which the 'swap'
 * rule never leaves, and the 'drop' rule shows as no lanes.
 * @param {{columnBy: string|null, group: string}} board
 * @returns {string|null}
 */
function boardLane({ columnBy, group }) {
  return group !== 'none' && group !== columnBy ? group : null;
}

/**
 * The bucket a value falls in: the bucket whose id it is (a number and its string match, as a
 * board column id is a string), the axis's `other` bucket for anything else, or the value itself
 * on an axis without one.
 * @param {unknown} value
 * @param {OverviewAxis} axis
 * @returns {unknown} A bucket id, or the value.
 */
function bucketOf(value, axis) {
  const bucket = axis.buckets.find((entry) => entry.id === value || (value != null && String(entry.id) === String(value)));
  if (bucket) return bucket.id;
  return axis.other ? axis.other.id : value;
}

/**
 * The value to store when a record is moved into a bucket by its id as a board reports it (a
 * string): the bucket's own id, typed as declared, or null for the `other` bucket.
 * @param {string|number|null} id
 * @param {OverviewAxis} axis
 * @returns {unknown}
 */
function bucketValue(id, axis) {
  if (axis.other && String(axis.other.id) === String(id)) return null;
  return axis.buckets.find((entry) => String(entry.id) === String(id))?.id ?? id;
}

/**
 * An axis's buckets as filter choices — its `other` bucket last — so a filter on the field can
 * pick exactly what a grouping or a board shows.
 * @param {OverviewAxis} axis
 * @returns {Array<{value: string|number, label: string}>}
 */
function axisChoices(axis) {
  return [...axis.buckets, ...(axis.other ? [axis.other] : [])].map(({ id, label }) => ({ value: id, label }));
}

/** @param {string} id Operator id. @returns {'none'|'single'|'pair'|'many'} */
function arityOf(id) {
  return filterOperators.find((operator) => operator.id === id)?.arity ?? 'single';
}

/**
 * The value a fresh condition starts with for an operator's arity, carried over from the previous
 * value where it still fits — switching "is" to "is any of" keeps the stage chosen.
 * @param {string} operator
 * @param {unknown} [previous]
 * @returns {unknown}
 */
function valueFor(operator, previous = null) {
  const arity = arityOf(operator);
  const first = Array.isArray(previous) ? previous[0] ?? null : previous;
  if (arity === 'none') return null;
  if (arity === 'many') return Array.isArray(previous) ? previous : first == null || first === '' ? [] : [first];
  if (arity === 'pair') return Array.isArray(previous) && previous.length === 2 ? previous : [first, null];
  return first;
}

/** @param {Record<string, any>} record @param {string} field @returns {any} The plain property. */
function readProperty(record, field) {
  return record[field];
}

/**
 * Whether one record satisfies one condition: the local stand-in for the query a server would run.
 * Dates are ISO strings, so they compare as text; "is" on a text field ignores case.
 * @param {Record<string, any>} record
 * @param {{field: string, operator: string, value: any}} condition
 * @param {{read?: ValueReader, type?: (field: string) => string|undefined}} [options] `read` reads a
 *   field's value (the plain property by default); `type` names a field's type.
 * @returns {boolean}
 */
function conditionMatches(record, { field, operator, value }, { read = readProperty, type } = {}) {
  const actual = read(record, field);
  const text = (entry) => String(entry ?? '').toLowerCase();
  const list = Array.isArray(actual) ? actual : actual == null ? [] : [actual];
  switch (operator) {
    case 'eq': return typeof actual === 'string' && type?.(field) === 'text' ? text(actual) === text(value) : actual === value;
    case 'neq': return actual !== value;
    case 'anyOf': return Array.isArray(value) && value.includes(actual);
    case 'noneOf': return !Array.isArray(value) || !value.includes(actual);
    case 'contains': return text(actual).includes(text(value));
    case 'notContains': return !text(actual).includes(text(value));
    case 'startsWith': return text(actual).startsWith(text(value));
    case 'endsWith': return text(actual).endsWith(text(value));
    case 'gt': return actual > value;
    case 'gte': return actual >= value;
    case 'lt': return actual < value;
    case 'lte': return actual <= value;
    case 'between': return Array.isArray(value) && actual >= value[0] && actual <= value[1];
    case 'notBetween': return !Array.isArray(value) || actual < value[0] || actual > value[1];
    case 'on': return actual === value;
    case 'notOn': return actual !== value;
    case 'before': return actual < value;
    case 'after': return actual > value;
    case 'onOrBefore': return actual <= value;
    case 'onOrAfter': return actual >= value;
    case 'containsAny': return Array.isArray(value) && value.some((entry) => list.includes(entry));
    case 'containsAll': return Array.isArray(value) && value.every((entry) => list.includes(entry));
    case 'containsNone': return !Array.isArray(value) || !value.some((entry) => list.includes(entry));
    case 'isEmpty': return Array.isArray(actual) ? actual.length === 0 : actual == null || actual === '';
    case 'isNotEmpty': return Array.isArray(actual) ? actual.length > 0 : actual != null && actual !== '';
    default: return true;
  }
}

/**
 * Whether a record satisfies a filter node: a condition, or a group of nodes joined by its logic.
 * An empty group matches everything.
 * @param {Record<string, any>} record
 * @param {any} node Filter node.
 * @param {{read?: ValueReader, type?: (field: string) => string|undefined}} [options]
 * @returns {boolean}
 */
function nodeMatches(record, node, options = {}) {
  if (node.kind !== 'group') return conditionMatches(record, node, options);
  if (!node.children?.length) return true;
  return node.logic === 'or'
    ? node.children.some((child) => nodeMatches(record, child, options))
    : node.children.every((child) => nodeMatches(record, child, options));
}

/**
 * The expression the filter model stands for: the advanced one, or the chips as one group.
 * @param {OverviewFilters} filters
 * @returns {any} A filter node.
 */
function filterExpression({ logic, conditions, advanced }) {
  return advanced ? advanced.root : { kind: 'group', logic, children: conditions };
}

/** @param {any} node @returns {number} The conditions in a filter expression, nested ones included. */
function conditionCount(node) {
  return node.kind === 'group' ? node.children.reduce((sum, child) => sum + conditionCount(child), 0) : 1;
}

/**
 * A grouping's groups, in bucket order — the `other` bucket last — each matching the records
 * whose value falls in it (`bucketOf()`).
 * @param {string|null} field Grouping field, or null for none.
 * @param {Record<string, OverviewAxis>} axes The groupable fields' buckets.
 * @param {ValueReader} [read]
 * @returns {OverviewGroup[]}
 */
function groupsOf(field, axes, read = readProperty) {
  const axis = field ? axes[field] : null;
  if (!axis) return [];
  return [...axis.buckets, ...(axis.other ? [axis.other] : [])].map(({ id, label, tone = null }) => ({
    id: String(id), label, tone: tone ?? null, match: (record) => bucketOf(read(record, field), axis) === id
  }));
}

/**
 * The records sorted by a sort, ties keeping their order. Grouped, the group order comes first,
 * so a page cuts through the groups in order rather than scattering each group over every page.
 * @param {Record<string, any>[]} rows
 * @param {{id: string, dir: 'asc'|'desc'}} sort
 * @param {{groups?: OverviewGroup[], value?: (record: Record<string, any>, id: string) => any}} [options]
 *   `value` reads the value a field sorts by.
 * @returns {Record<string, any>[]}
 */
function sortRecords(rows, { id, dir }, { groups = [], value = readProperty } = {}) {
  const factor = dir === 'desc' ? -1 : 1;
  const rank = (record) => (groups.length ? groups.findIndex((group) => group.match(record)) : 0);
  return rows.map((record, index) => ({ record, index })).sort((a, b) => {
    const left = value(a.record, id);
    const right = value(b.record, id);
    const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left ?? '').localeCompare(String(right ?? ''));
    return rank(a.record) - rank(b.record) || order * factor || a.index - b.index;
  }).map(({ record }) => record);
}

/**
 * How many of a group's records a page shows: "16", or "4 of 16" where the group runs on to
 * another page. The total counts every filtered record, not just the page.
 * @param {OverviewGroup} group
 * @param {Record<string, any>[]} slice The page.
 * @param {Record<string, any>[]} all Every filtered record.
 * @returns {string}
 */
function groupCount(group, slice, all) {
  const shown = slice.filter(group.match).length;
  const total = all.filter(group.match).length;
  return shown === total ? String(total) : `${shown} of ${total}`;
}

/**
 * A table page with a heading row before each group that has records on it. A heading row is
 * `{ID: 'group:<id>', kind: 'group', label, tone, count}`.
 * @param {Record<string, any>[]} slice The page.
 * @param {OverviewGroup[]} groups
 * @param {Record<string, any>[]} all Every filtered record.
 * @returns {Record<string, any>[]}
 */
function withGroupRows(slice, groups, all) {
  if (!groups.length) return slice;
  return groups.flatMap((group) => {
    const members = slice.filter(group.match);
    return members.length ? [{
      ID: `group:${group.id}`, kind: 'group', label: group.label, tone: group.tone, count: groupCount(group, slice, all)
    }, ...members] : [];
  });
}

export {
  arityOf, astToFilters, axisChoices, boardLane, bucketOf, bucketValue, conditionCount, conditionMatches, filterExpression, filtersToAst, groupCount, groupsOf,
  isDraftNode, mergeDrafts, nodeMatches, resolveBoardAxes, sortRecords, valueFor, withGroupRows, withoutDrafts
};
