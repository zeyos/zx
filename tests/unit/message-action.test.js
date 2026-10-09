import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  MESSAGE_ACTION_MIN_TIMEOUT, messageTimeout, normalizeMessageAction
} from '../../src/components/message/message.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const source = read('../../src/components/message/message.js');
const css = read('../../src/components/message/message.css');

test('a message with an action stays at least eight seconds; zero still persists', () => {
  assert.equal(MESSAGE_ACTION_MIN_TIMEOUT, 8000);
  assert.equal(messageTimeout(4000, true), 8000);
  assert.equal(messageTimeout(12000, true), 12000);
  assert.equal(messageTimeout(0, true), 0);
  assert.equal(messageTimeout(undefined, true), 8000);
  // Without an action nothing changes.
  assert.equal(messageTimeout(4000, false), 4000);
  assert.equal(messageTimeout(4000), 4000);
  assert.equal(messageTimeout(-5, false), 0);
  assert.equal(messageTimeout('soon', false), 4000);
});

test('an action needs a label; its kind defaults to the secondary button', () => {
  for (const value of [null, undefined, 'Undo', 7, {}, { label: '   ' }, { onclick() {} }]) {
    assert.equal(normalizeMessageAction(value), null, `accepted ${JSON.stringify(value)}`);
  }
  const onclick = () => {};
  assert.deepEqual(normalizeMessageAction({ label: ' Undo ', onclick }),
    { label: 'Undo', kind: 'default', onclick });
  assert.deepEqual(normalizeMessageAction({ label: 'Approve', kind: 'primary' }),
    { label: 'Approve', kind: 'primary', onclick: null });
  assert.equal(normalizeMessageAction({ label: 'Retry', kind: 'loud' }).kind, 'default');
  assert.equal(normalizeMessageAction({ label: 'Delete', kind: 'danger' }).kind, 'danger');
});

test('the action is a small Zx button whose activation runs onclick and then closes the message', () => {
  assert.match(source, /button\(\{ label, kind, size: 'sm' \}\)/);
  // The message closes even when onclick throws.
  assert.match(source, /this\.listen\(control, 'click', \(event\) => \{[\s\S]{0,120}?try \{\s*onclick\?\.\([^)]*\(event\)\);\s*\} finally \{\s*this\._close\(entry\);/);
  assert.match(css, /\.zx-message__action\s*\{/);
});

test('hover and focus each hold the timer, and it resumes only once neither does', () => {
  for (const type of ['mouseenter', 'mouseleave', 'focusin', 'focusout']) {
    assert.match(source, new RegExp(`this\\.listen\\(node, '${type}'`), `no ${type} listener`);
  }
  assert.match(source, /_resume\(entry\) \{\s*if \(entry\.closed \|\| entry\.timer !== null \|\| entry\.hovered \|\| entry\.focused\) return;/);
  assert.match(source, /_schedule\(entry\) \{\s*if \(entry\.closed \|\| entry\.remaining <= 0 \|\| entry\.hovered \|\| entry\.focused\) return;/);
});

test('a leading visual takes the kind icon’s place and stays decorative', () => {
  assert.match(source, /class: 'zx-message__icon', ariaHidden: 'true' \},\s*settings\.leading \?\? icon\(/);
});
