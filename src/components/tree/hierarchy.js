/**
 * Shared helpers for the hierarchical components (`TreeView` and `Finder`). Both take the same
 * nested node shape and the same `valueKey` / `labelKey` / `childrenKey` readers, so the reading
 * and walking logic lives here once.
 * @module
 */

/** @typedef {Record<string, any>} TreeNode */
/** @typedef {string|((node: TreeNode) => unknown)} NodeReader */
/**
 * @typedef {Object} NodeReaders
 * @property {(node: TreeNode) => unknown} value Node ID.
 * @property {(node: TreeNode) => string} label Node label.
 * @property {(node: TreeNode) => TreeNode[]|null} children Loaded children, or null when unknown.
 */

/**
 * Builds reader functions for one component's key configuration.
 * @param {{valueKey?: NodeReader, labelKey?: NodeReader, childrenKey?: string}} options Key configuration.
 * @returns {NodeReaders}
 */
export function createReaders({ valueKey = 'ID', labelKey = 'name', childrenKey = 'children' } = {}) {
  return {
    value: (node) => (typeof valueKey === 'function' ? valueKey(node) : node?.[valueKey]),
    label: (node) => String((typeof labelKey === 'function' ? labelKey(node) : node?.[labelKey]) ?? ''),
    children: (node) => {
      const children = node?.[childrenKey];
      return Array.isArray(children) ? children : null;
    }
  };
}

/**
 * Reports whether a node can have children: it already has some, or it is explicitly marked as a
 * branch whose children have not been loaded yet.
 * @param {TreeNode} node Node to inspect.
 * @param {NodeReaders} readers Node readers.
 * @returns {boolean}
 */
export function isBranch(node, readers) {
  if (node?.hasChildren === true) return true;
  const children = readers.children(node);
  return Array.isArray(children) && children.length > 0;
}

/**
 * Depth-first walk over every node, deepest last.
 * @param {TreeNode[]} nodes Root nodes.
 * @param {NodeReaders} readers Node readers.
 * @param {(node: TreeNode, context: {level: number, parent: TreeNode|null, index: number, siblings: TreeNode[]}) => void} visit Visitor.
 * @param {{level?: number, parent?: TreeNode|null}} [context={}] Starting context.
 * @returns {void}
 */
export function walk(nodes, readers, visit, { level = 1, parent = null } = {}) {
  nodes.forEach((node, index) => {
    visit(node, { level, parent, index, siblings: nodes });
    const children = readers.children(node);
    if (children) walk(children, readers, visit, { level: level + 1, parent: node });
  });
}

/**
 * Finds a node by ID anywhere in the tree.
 * @param {TreeNode[]} nodes Root nodes.
 * @param {unknown} id Node ID.
 * @param {NodeReaders} readers Node readers.
 * @returns {TreeNode|null}
 */
export function findNode(nodes, id, readers) {
  let found = null;
  walk(nodes, readers, (node) => {
    if (found === null && Object.is(readers.value(node), id)) found = node;
  });
  return found;
}

/**
 * Returns the chain of nodes from a root down to the node with the given ID, inclusive.
 * @param {TreeNode[]} nodes Root nodes.
 * @param {unknown} id Node ID.
 * @param {NodeReaders} readers Node readers.
 * @returns {TreeNode[]} Empty when the ID is not in the tree.
 */
export function pathTo(nodes, id, readers) {
  for (const node of nodes) {
    if (Object.is(readers.value(node), id)) return [node];
    const children = readers.children(node);
    if (!children) continue;
    const below = pathTo(children, id, readers);
    if (below.length > 0) return [node, ...below];
  }
  return [];
}

/**
 * Returns every descendant of a node, excluding the node itself.
 * @param {TreeNode} node Root of the sub-tree.
 * @param {NodeReaders} readers Node readers.
 * @returns {TreeNode[]}
 */
export function descendants(node, readers) {
  const result = [];
  const children = readers.children(node);
  if (children) walk(children, readers, (child) => result.push(child));
  return result;
}

/**
 * Flattens the tree to the rows a tree view currently shows: every root, plus the children of
 * every expanded branch. The returned rows carry the ARIA bookkeeping each row needs.
 * @param {TreeNode[]} nodes Root nodes.
 * @param {NodeReaders} readers Node readers.
 * @param {Set<unknown>} expanded IDs of expanded branches.
 * @returns {{node: TreeNode, id: unknown, level: number, parent: TreeNode|null, posinset: number, setsize: number}[]}
 */
export function flattenVisible(nodes, readers, expanded) {
  const rows = [];
  const push = (list, level, parent) => {
    list.forEach((node, index) => {
      const id = readers.value(node);
      rows.push({ node, id, level, parent, posinset: index + 1, setsize: list.length });
      if (!expanded.has(id)) return;
      const children = readers.children(node);
      if (children && children.length > 0) push(children, level + 1, node);
    });
  };
  push(nodes, 1, null);
  return rows;
}

/**
 * Filters a tree to the nodes matching a predicate, keeping the ancestors that lead to a match.
 * @param {TreeNode[]} nodes Root nodes.
 * @param {NodeReaders} readers Node readers.
 * @param {(node: TreeNode) => boolean} matches Predicate.
 * @param {string} childrenKey Property the filtered children are written to.
 * @returns {TreeNode[]} New nodes; the originals are not mutated.
 */
export function filterTree(nodes, readers, matches, childrenKey) {
  const result = [];
  for (const node of nodes) {
    const children = readers.children(node) ?? [];
    const keptChildren = filterTree(children, readers, matches, childrenKey);
    if (matches(node) || keptChildren.length > 0) {
      result.push(keptChildren.length > 0 || children.length > 0
        ? { ...node, [childrenKey]: keptChildren }
        : node);
    }
  }
  return result;
}
