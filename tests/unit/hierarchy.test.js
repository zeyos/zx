import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createReaders, descendants, filterTree, findNode, flattenVisible, isBranch, pathTo, walk
} from '../../src/components/tree/hierarchy.js';

const readers = createReaders();

/** @returns {import('../../src/components/tree/hierarchy.js').TreeNode[]} */
function tree() {
  return [
    {
      ID: 'sales',
      name: 'Sales',
      children: [
        { ID: 'leads', name: 'Leads' },
        { ID: 'quotes', name: 'Quotes', children: [{ ID: 'q1', name: 'Q1 draft' }] }
      ]
    },
    { ID: 'billing', name: 'Billing', children: [] },
    { ID: 'archive', name: 'Archive', hasChildren: true }
  ];
}

test('createReaders resolves keys and custom reader functions', () => {
  const custom = createReaders({ valueKey: (node) => node.slug, labelKey: 'title', childrenKey: 'kids' });
  const node = { slug: 'a', title: 'Alpha', kids: [{ slug: 'b', title: 'Beta' }] };
  assert.equal(custom.value(node), 'a');
  assert.equal(custom.label(node), 'Alpha');
  assert.equal(custom.children(node).length, 1);
  assert.equal(custom.children({ slug: 'x' }), null);
});

test('isBranch covers loaded children and not-yet-loaded branches', () => {
  const [sales, billing, archive] = tree();
  assert.equal(isBranch(sales, readers), true);
  assert.equal(isBranch(billing, readers), false, 'an empty children array is a leaf');
  assert.equal(isBranch(archive, readers), true, 'hasChildren marks an unloaded branch');
  assert.equal(isBranch({ ID: 'x', name: 'X' }, readers), false);
});

test('walk visits every node depth-first with level and parent context', () => {
  const seen = [];
  walk(tree(), readers, (node, context) => {
    seen.push([readers.value(node), context.level, context.parent ? readers.value(context.parent) : null]);
  });
  assert.deepEqual(seen, [
    ['sales', 1, null],
    ['leads', 2, 'sales'],
    ['quotes', 2, 'sales'],
    ['q1', 3, 'quotes'],
    ['billing', 1, null],
    ['archive', 1, null]
  ]);
});

test('findNode and pathTo locate nodes at any depth', () => {
  const nodes = tree();
  assert.equal(readers.label(findNode(nodes, 'q1', readers)), 'Q1 draft');
  assert.equal(findNode(nodes, 'missing', readers), null);
  assert.deepEqual(pathTo(nodes, 'q1', readers).map(readers.value), ['sales', 'quotes', 'q1']);
  assert.deepEqual(pathTo(nodes, 'sales', readers).map(readers.value), ['sales']);
  assert.deepEqual(pathTo(nodes, 'missing', readers), []);
});

test('descendants excludes the node itself', () => {
  const sales = tree()[0];
  assert.deepEqual(descendants(sales, readers).map(readers.value), ['leads', 'quotes', 'q1']);
  assert.deepEqual(descendants({ ID: 'x' }, readers), []);
});

test('flattenVisible expands only the branches in the expanded set', () => {
  const nodes = tree();
  const collapsed = flattenVisible(nodes, readers, new Set());
  assert.deepEqual(collapsed.map((row) => row.id), ['sales', 'billing', 'archive']);
  assert.deepEqual(collapsed.map((row) => row.level), [1, 1, 1]);
  assert.deepEqual(collapsed.map((row) => row.posinset), [1, 2, 3]);
  assert.equal(collapsed[0].setsize, 3);

  const open = flattenVisible(nodes, readers, new Set(['sales', 'quotes']));
  assert.deepEqual(open.map((row) => row.id), ['sales', 'leads', 'quotes', 'q1', 'billing', 'archive']);
  assert.deepEqual(open.map((row) => row.level), [1, 2, 2, 3, 1, 1]);
  assert.equal(readers.value(open[3].parent), 'quotes');
});

test('filterTree keeps matches and the ancestors leading to them', () => {
  const nodes = tree();
  const kept = filterTree(nodes, readers, (node) => readers.label(node).includes('Q1'), 'children');
  assert.deepEqual(kept.map(readers.value), ['sales']);
  assert.deepEqual(kept[0].children.map(readers.value), ['quotes']);
  assert.deepEqual(kept[0].children[0].children.map(readers.value), ['q1']);
  // The source tree is never mutated.
  assert.equal(nodes[0].children.length, 2);
});

test('filterTree keeps a matching branch even when no child matches', () => {
  const kept = filterTree(tree(), readers, (node) => readers.value(node) === 'sales', 'children');
  assert.deepEqual(kept.map(readers.value), ['sales']);
  assert.deepEqual(kept[0].children, []);
});

test('filterTree does not leak pruned children into check-state calculations', () => {
  // A branch with two children of which only one matches must keep just the match, so callers
  // that need the full subtree have to resolve the original node instead of the filtered copy.
  const nodes = [{ ID: 'a', name: 'A', children: [{ ID: 'b', name: 'match' }, { ID: 'c', name: 'other' }] }];
  const kept = filterTree(nodes, readers, (node) => readers.label(node) === 'match', 'children');
  assert.deepEqual(kept[0].children.map(readers.value), ['b']);
  assert.deepEqual(nodes[0].children.map(readers.value), ['b', 'c']);
});
