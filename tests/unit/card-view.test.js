import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  groupCardRecords, normalizeCardWidth
} from '../../src/components/card-view/card-view.js';
import {
  resolveRecordActions, resolveRecordLink, resolveRecordPreview
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
  assert.equal(normalizeCardWidth('18rem; color: red'), '18rem');
  assert.equal(normalizeCardWidth(-1), '18rem');
});

test('shared record-card helper stays listener-free and text-safe by construction', () => {
  const source = readFileSync(new URL('../../src/components/card-view/record-card.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\.addEventListener\s*\(/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.match(source, /export function createRecordCard\(record, index, options = \{\}\)/);
  assert.match(source, /data(?:set)?:?\s*\{[^}]*recordAction/s);
});
