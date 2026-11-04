import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentThread } from '../../src/components/agent-thread/agent-thread.js';

/* ------------------------------------------------------------------ registering item types -- */

test('register() refuses only the types the library always draws', () => {
  for (const type of ['user', 'text', 'answer', 'trace', 'approval', 'notice', 'zx-placeholder']) {
    assert.throws(() => AgentThread.register(type, () => null), /is built in/, type);
    assert.equal(AgentThread.has(type), true, type);
  }
});

test('surface and placeholder stay free for an application, as they were', () => {
  // `has()` answers false until then, so an application that guards its register() call still
  // registers, and the library does not silently draw its items instead.
  assert.equal(AgentThread.has('surface'), false);
  assert.equal(AgentThread.has('placeholder'), false);
  assert.doesNotThrow(() => AgentThread.register('surface', () => null));
  assert.doesNotThrow(() => AgentThread.register('placeholder', () => null));
  assert.equal(AgentThread.has('surface'), true);
  assert.equal(AgentThread.has('placeholder'), true);
});
