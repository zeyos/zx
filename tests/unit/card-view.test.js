import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  groupCardRecords, normalizeCardWidth
} from '../../src/components/card-view/card-view.js';
import {
  createRecordCard, partitionRecordCardFields, resolveRecordActions, resolveRecordLink,
  resolveRecordPreview
} from '../../src/components/card-view/record-card.js';

const fields = [
  { id: 'opportunity', label: 'Opportunity', sortable: true },
  { id: 'stage', label: 'Stage', get: (record) => record.pipeline.stage },
  { id: 'preview', label: 'Preview', visible: false }
];

test('card grouping honors accessors, explicit empty groups, and source order without mutation', () => {
  const records = [
    { ID: 1, opportunity: 'Northwind', pipeline: { stage: 'Proposal' } },
    { ID: 2, opportunity: 'Aurora', pipeline: { stage: 'Qualified' } },
    { ID: 3, opportunity: 'Contoso', pipeline: { stage: 'Proposal' } }
  ];
  const groups = groupCardRecords(records, 'stage', ['Qualified', 'Negotiation'], fields);
  assert.deepEqual(groups.map(({ id, records: grouped }) => [id, grouped.map((record) => record.ID)]), [
    ['Qualified', [2]],
    ['Negotiation', []],
    ['Proposal', [1, 3]]
  ]);
  assert.deepEqual(records.map((record) => record.ID), [1, 2, 3]);
  assert.deepEqual(groupCardRecords(records, null).map((group) => group.records), [records]);
  assert.deepEqual(groupCardRecords([], 'stage'), []);
});

test('preview resolution accepts safe URLs and nodes while rejecting executable or non-image schemes', () => {
  const record = { preview: '/media/northwind.webp', name: 'Northwind' };
  assert.deepEqual(resolveRecordPreview(record, 0, 'preview', 'name', fields), {
    node: null,
    src: '/media/northwind.webp',
    alt: 'Northwind',
    fit: 'cover',
    rejected: false
  });
  assert.deepEqual(resolveRecordPreview(record, 0, () => ({
    src: 'javascript:alert(1)', alt: 'Unsafe', fit: 'contain'
  }), null, fields), {
    node: null,
    src: null,
    alt: 'Unsafe',
    fit: 'contain',
    rejected: true
  });
  assert.deepEqual(resolveRecordPreview(record, 0, () => 'file:///Users/example/private.png', null, fields), {
    node: null,
    src: null,
    alt: '',
    fit: 'cover',
    rejected: true
  });
  assert.equal(resolveRecordPreview(record, 0, () => null, null, fields), null);

  const nodeLike = { nodeType: 1, textContent: 'Initials' };
  const nodePreview = resolveRecordPreview(record, 0, () => /** @type {any} */ (nodeLike), 'Logo', fields);
  assert.equal(nodePreview.node, nodeLike);
  assert.equal(nodePreview.rejected, false);
});

test('primary links are safe, normalized, and add noopener for new tabs', () => {
  const record = { ID: 1, route: '/opportunities/1' };
  assert.deepEqual(resolveRecordLink(record, 0, (item) => ({
    href: item.route,
    target: '_blank',
    rel: 'external'
  })), {
    href: '/opportunities/1',
    target: '_blank',
    rel: 'external noopener'
  });
  assert.equal(resolveRecordLink(record, 0, 'javascript:alert(1)'), null);
  assert.equal(resolveRecordLink(record, 0, { href: 'data:text/html,bad' }), null);
});

test('delegated actions are cloned, stable, and discard invalid controls', () => {
  const onclick = () => {};
  const source = [
    { id: 'open', label: 'Open', icon: 'eye', onclick },
    { id: 'unsafe', label: 'Unsafe', href: 'javascript:alert(1)' },
    { id: '', label: 'Missing id' },
    { id: 'unnamed' },
    null
  ];
  const actions = resolveRecordActions({ ID: 1 }, 0, /** @type {any} */ (source));
  assert.deepEqual(actions, [{ id: 'open', label: 'Open', icon: 'eye', onclick }]);
  assert.notEqual(actions[0], source[0]);
});

test('card widths normalize numbers and reject declaration-breaking values', () => {
  assert.equal(normalizeCardWidth(280), '280px');
  assert.equal(normalizeCardWidth('clamp(15rem, 30vw, 22rem)'), 'clamp(15rem, 30vw, 22rem)');
  assert.equal(normalizeCardWidth('18rem; color: red'), '15rem');
  assert.equal(normalizeCardWidth(-1), '15rem');
});

test('shared card slots partition visible fields in order without duplication or mutation', () => {
  const slottedFields = [
    { id: 'title', label: 'Title' },
    { id: 'category', label: 'Category', view: { card: { slot: 'eyebrow-start' } } },
    { id: 'due', label: 'Due', view: { card: { slot: 'eyebrow-end' } } },
    { id: 'status', label: 'Status', view: { card: { slot: 'title-prefix' } } },
    { id: 'owner', label: 'Owner' },
    { id: 'unknown', label: 'Unknown', view: { card: { slot: 'future-slot' } } },
    { id: 'subtitle', label: 'Subtitle' },
    { id: 'title-copy', label: 'Title copy', duplicate: true,
      view: { card: { slot: 'eyebrow-start' } } }
  ];
  const before = structuredClone(slottedFields);
  const groups = partitionRecordCardFields(slottedFields, 'title', 'subtitle');

  assert.deepEqual(groups.eyebrowStart.map((field) => field.id), ['category', 'title-copy']);
  assert.deepEqual(groups.eyebrowEnd.map((field) => field.id), ['due']);
  assert.deepEqual(groups.titlePrefix.map((field) => field.id), ['status']);
  assert.deepEqual(groups.metadata.map((field) => field.id), ['owner', 'unknown']);
  assert.deepEqual(slottedFields, before);
  assert.equal(Object.values(groups).flat().length, 6);
});

test('shared card slots are opt-in and preserve the default metadata contract', () => {
  const ordinary = [
    { id: 'title', label: 'Title' },
    { id: 'owner', label: 'Owner' },
    { id: 'malformed', label: 'Malformed', view: { card: 'eyebrow-start' } },
    { id: 'subtitle', label: 'Subtitle', duplicate: true }
  ];
  const groups = partitionRecordCardFields(ordinary, 'title', 'subtitle');

  assert.deepEqual(groups.eyebrowStart, []);
  assert.deepEqual(groups.eyebrowEnd, []);
  assert.deepEqual(groups.titlePrefix, []);
  assert.deepEqual(groups.metadata.map((field) => field.id), ['owner', 'malformed', 'subtitle']);
});

test('shared card slots render in semantic order with safe text, Nodes, and title-link boundaries', () => {
  withFakeDocument(() => {
    const dueNode = globalThis.document.createElement('time');
    dueNode.textContent = 'Tomorrow';
    const slottedFields = [
      { id: 'title', label: 'Title' },
      { id: 'category', label: 'Category', render: () => '<strong>Sales</strong>',
        view: { card: { slot: 'eyebrow-start' } } },
      { id: 'due', label: 'Due', render: () => dueNode,
        view: { card: { slot: 'eyebrow-end' } } },
      { id: 'status', label: 'Status', render: () => 'In progress',
        view: { card: { slot: 'title-prefix' } } },
      { id: 'owner', label: 'Owner' },
      { id: 'unknown', label: 'Unknown', view: { card: { slot: 'later' } } }
    ];
    const card = createRecordCard({
      title: 'Renew Northwind', owner: 'Ari', unknown: 'Fallback'
    }, 0, {
      fields: slottedFields,
      visibleFields: slottedFields,
      titleField: 'title',
      link: '/records/1'
    });
    const body = findClass(card, 'zx-record-card__body');
    assert.ok(body);
    assert.deepEqual(body.children.map((child) => child.className), [
      'zx-record-card__eyebrow', 'zx-record-card__header', 'zx-record-card__metadata'
    ]);

    const eyebrow = body.children[0];
    assert.equal(eyebrow.children[0].tagName, 'DL');
    assert.equal(eyebrow.children[0].dataset.cardSlot, 'eyebrow-start');
    assert.equal(eyebrow.children[1].dataset.cardSlot, 'eyebrow-end');
    assert.equal(findClass(eyebrow.children[0], 'zx-record-card__label').tagName, 'DT');
    assert.equal(findClass(eyebrow.children[0], 'zx-record-card__value').textContent,
      '<strong>Sales</strong>');
    assert.equal(findClass(eyebrow.children[1], 'zx-record-card__value').children[0], dueNode);

    const titleRow = findClass(body, 'zx-record-card__title-row');
    assert.deepEqual(titleRow.children.map((child) => child.className), [
      'zx-record-card__title-prefix', 'zx-record-card__heading'
    ]);
    assert.equal(titleRow.children[0].tagName, 'DL');
    assert.equal(titleRow.children[1].children[0].tagName, 'A');
    assert.equal(titleRow.children[1].children[0].href, '/records/1');

    const metadata = body.children[2];
    assert.deepEqual(metadata.children.map((field) => field.dataset.fieldId), ['owner', 'unknown']);
  });
});

test('selectable cards keep listitem semantics without unsupported aria-selected', () => {
  withFakeDocument(() => {
    const card = createRecordCard({ title: 'Renew Northwind' }, 0, {
      fields: [{ id: 'title', label: 'Title' }],
      titleField: 'title',
      selectable: 'single',
      selected: true
    });
    assert.equal(card.tagName, 'LI');
    assert.equal(card.attributes.get('aria-description'), 'Selected');
    assert.equal(card.attributes.has('aria-selected'), false);
    assert.equal(card.dataset.selected, 'true');
  });
});

test('compact card styling is scoped away from the shared Kanban card anatomy', () => {
  const source = readFileSync(new URL('../../src/components/card-view/card-view.css', import.meta.url), 'utf8');
  assert.match(source, /\.zx-card-view \.zx-record-card__preview\s*\{/);
  assert.match(source, /\.zx-card-view \.zx-record-card__metadata\s*\{[^}]*display:\s*flex/s);
  assert.match(source, /--zx-card-view-preview-size:\s*1\.75rem/);
  assert.match(source, /grid-template-columns:\s*repeat\(auto-fill/);
  assert.match(source, /-webkit-line-clamp:\s*2/);
  assert.match(source, /\.zx-card-view \.zx-card-view__skeleton-preview\s*\{[^}]*--zx-card-view-preview-size/s);
  assert.match(source, /@media \(pointer:\s*coarse\)[\s\S]*min-block-size:\s*44px/);
  assert.match(source, /\.zx-record-card\[data-selected="true"\]/);
  assert.doesNotMatch(source, /\.zx-record-card\[aria-selected="true"\]/);
  assert.doesNotMatch(source, /(?<!\.zx-card-view )\.zx-record-card__preview\s*\{[^}]*inline-size:\s*1\.5rem/s);
});

test('shared record-card helper stays listener-free and text-safe by construction', () => {
  const source = readFileSync(new URL('../../src/components/card-view/record-card.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\.addEventListener\s*\(/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.match(source, /export function createRecordCard\(record, index, options = \{\}\)/);
  assert.match(source, /ariaLabelledby:\s*headingId/);
  assert.match(source, /data(?:set)?:?\s*\{[^}]*recordAction/s);
  assert.match(source, /class:\s*'zx-record-card__eyebrow'/);
  assert.match(source, /class:\s*'zx-record-card__title-row'/);
  assert.match(source, /h\('div',\s*\{ class:\s*'zx-record-card__body' \},\s*eyebrow,\s*header,\s*metadata\)/);
  assert.match(source, /h\('dt',\s*\{ class:\s*'zx-record-card__label' \},\s*field\.label\)/);
});

/** @param {() => void} run */
function withFakeDocument(run) {
  const previous = globalThis.document;
  globalThis.document = /** @type {any} */ (new FakeDocument());
  try {
    run();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

/** @param {any} node @param {string} className @returns {any|null} */
function findClass(node, className) {
  if (String(node?.className ?? '').split(/\s+/).includes(className)) return node;
  for (const child of node?.children ?? []) {
    const match = findClass(child, className);
    if (match) return match;
  }
  return null;
}

class FakeNode {
  /** @param {number} [nodeType=1] */
  constructor(nodeType = 1) {
    this.nodeType = nodeType;
    /** @type {FakeNode[]} */
    this.children = [];
    this.parentNode = null;
  }

  /** @param {FakeNode} child */
  appendChild(child) {
    if (!(child instanceof FakeNode)) throw new TypeError('appendChild requires a Node');
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  /** @param {...FakeNode} children */
  append(...children) {
    for (const child of children) this.appendChild(child);
  }
}

class FakeElement extends FakeNode {
  /** @param {string} tag */
  constructor(tag) {
    super(1);
    this.tagName = String(tag).toUpperCase();
    this.className = '';
    this.id = '';
    this.href = '';
    this.dataset = {};
    this.style = {};
    this.attributes = new Map();
    this._textContent = '';
  }

  get textContent() {
    return this.children.length
      ? this.children.map((child) => /** @type {any} */ (child).textContent).join('')
      : this._textContent;
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  /** @param {string} name @param {unknown} value */
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

class FakeText extends FakeNode {
  /** @param {unknown} value */
  constructor(value) {
    super(3);
    this.textContent = String(value);
  }
}

class FakeDocument {
  /** @param {string} tag */
  createElement(tag) {
    return new FakeElement(tag);
  }

  /** @param {unknown} value */
  createTextNode(value) {
    return new FakeText(value);
  }
}
