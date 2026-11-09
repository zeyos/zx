import assert from 'node:assert/strict';
import test from 'node:test';

import { buildZeyosEntitySelectConfig } from '../../src/zeyos/select.js';

test('ZeyOS entity config forwards recents and keeps creation application-owned', () => {
  const recent = [{ ID: 7, name: 'Recent account' }];
  let invoked = null;
  const client = {
    schema: {
      describe: () => ({ fields: { ID: { type: 'integer' }, name: { type: 'text', indexed: true } } }),
      fields: () => ['ID', 'name'],
      operations: () => ['listAccounts']
    },
    api: { listAccounts: async () => ({ data: [] }) }
  };
  const config = buildZeyosEntitySelectConfig(client, 'accounts', {
    recent,
    create: { label: 'Create account…', oninvoke: (detail) => { invoked = detail; } }
  });

  assert.deepEqual(config.recent, recent);
  assert.equal(config.valueKey, 'ID');
  assert.equal(typeof config.renderItem, 'function');
  assert.equal(typeof config.renderValueAdornment, 'function');
  assert.equal(config.actions.at(-1).label, 'Create account…');
  config.actions.at(-1).invoke({ query: 'Ada' });
  assert.equal(invoked.resource, 'accounts');
  assert.equal(invoked.query, 'Ada');
});

test('entity select defaults translate while explicit labels remain application owned', async () => {
  const { setLanguage, setTranslator } = await import('../../src/core/i18n.js');
  const { de } = await import('../../src/locales/de.js');
  const client = { schema: { describe: () => ({ fields: { ID: { type: 'integer' }, name: { type: 'text' } } }), fields: () => ['ID', 'name'], operations: () => ['listAccounts'] }, api: { listAccounts: async () => [] } };
  try {
    setLanguage('de'); setTranslator((key) => de[key]);
    const config = buildZeyosEntitySelectConfig(client, 'accounts', { create: true, none: true });
    assert.equal(config.noneLabel, de['select.none']);
    assert.equal(config.actions.at(-1).label, de['select.create']);
    assert.equal(config.actions.at(-1).group, de['select.createGroup']);
    const custom = buildZeyosEntitySelectConfig(client, 'accounts', { none: 'No account', create: { label: 'Add account', group: 'Actions' } });
    assert.equal(custom.noneLabel, 'No account');
    assert.equal(custom.actions.at(-1).label, 'Add account');
    assert.equal(custom.actions.at(-1).group, 'Actions');
  } finally { setTranslator(null); setLanguage('en'); }
});
