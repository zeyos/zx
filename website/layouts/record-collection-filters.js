/**
 * The record collection's filter and board model, kept apart from the layout so it can be tested
 * without a page: how the chip bar and the filter drawer translate into each other, which drawer
 * rows are still being written, and how the board's columns and swim lanes follow the grouping.
 */
// The model module rather than the package entry: it loads in Node, where the unit tests run.
import { filterOperators } from '../../src/components/filter/filter-model.js';

/**
 * @typedef {{id?: string, field: string, operator: string, value: any}} ChipCondition
 * @typedef {{logic: 'and'|'or', conditions: ChipCondition[], advanced: any}} CollectionFilters
 */

/**
 * The filter model as the expression the drawer edits: the nested expression when there is one,
 * otherwise one root group holding a condition per chip, joined by the chips' Match all/any.
 * @param {CollectionFilters} filters
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
 * @returns {CollectionFilters}
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
 * @param {{columnBy: string, group: string}} board Current column field and grouping (`'none'`).
 * @param {{group?: string, columnBy?: string}} change What the reader chose.
 * @param {string[]} axes The fields the board can use, in preference order.
 * @returns {{columnBy: string, group: string}}
 */
function resolveBoardAxes({ columnBy, group }, change, axes) {
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

export { astToFilters, filtersToAst, isDraftNode, mergeDrafts, resolveBoardAxes, withoutDrafts };
