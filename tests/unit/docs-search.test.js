import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeDocsSearchText, rankDocsSearch
} from '../../website/docs-search.js';

test('documentation search folds accents, punctuation, and camelCase symbols', () => {
  assert.equal(normalizeDocsSearchText('Über Grid.BillingItems()'), 'uber grid billing items');
});

test('documentation search requires every query term and ranks meaningful destinations', () => {
  const records = [
    { label: 'Billing guide', description: 'Editable transaction items', href: '#guide' },
    { label: 'Grid.BillingItems()', aliases: ['billing items preset'], href: '#preset' },
    { label: 'Grid', aliases: ['Grid.BillingItems()'], href: '#grid' },
    { label: 'Items', description: 'Generic list', href: '#items' }
  ];
  assert.deepEqual(rankDocsSearch(records, 'billing items').map((item) => item.href),
    ['#preset', '#grid', '#guide']);
});

test('documentation search is stable, limited, and blank-safe', () => {
  const records = Array.from({ length: 12 }, (_, index) => ({
    label: 'Result', href: `#${index}`
  }));
  assert.deepEqual(rankDocsSearch(records, 'result', 3).map((item) => item.href),
    ['#0', '#1', '#2']);
  assert.deepEqual(rankDocsSearch(records, '   '), []);
  assert.deepEqual(rankDocsSearch(records, 'missing'), []);
});
