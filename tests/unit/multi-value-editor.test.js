import assert from 'node:assert/strict';
import test from 'node:test';

import { MultiValueEditor } from '../../src/components/multi-value-editor/multi-value-editor.js';

/*
 * The disabled state, consistent with ValueList and Checklist: setDisabled(bool), disable(),
 * enable(), isDisabled(), and a `disabled` option. A prototype probe with stand-in controls drives
 * the state and the guards without a DOM; tests/regression/followup-api.js checks the rendered
 * editor and its field type in a browser.
 */
function control(tag) {
  return { tag, disabled: false };
}

function editorProbe(values = ['a', 'b', 'c']) {
  const editor = Object.create(MultiValueEditor.prototype);
  const attributes = new Map();
  editor.el = {
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    removeAttribute(name) { attributes.delete(name); }
  };
  editor._values = values.slice();
  editor._disabled = false;
  editor._armed = null;
  editor._add = control('button');
  editor._controls = [control('input'), control('button'), control('button')];
  editor._rows = { querySelectorAll: () => editor._controls };
  editor.rendered = 0;
  editor._renderRows = () => { editor.rendered += 1; };
  editor.emitted = [];
  editor.emit = (type, detail) => { editor.emitted.push([type, detail]); };
  return editor;
}

test('MultiValueEditor declares a disabled option, off by default', () => {
  assert.equal(MultiValueEditor.defaults.disabled, false);
});

test('MultiValueEditor.setDisabled() disables every control in place and marks the root', () => {
  const editor = editorProbe();
  assert.equal(editor.isDisabled(), false);
  assert.equal(editor.setDisabled(true), editor);
  assert.equal(editor.isDisabled(), true);
  assert.equal(editor.el.getAttribute('aria-disabled'), 'true');
  assert.equal(editor._add.disabled, true);
  assert.deepEqual(editor._controls.map((one) => one.disabled), [true, true, true]);
  assert.equal(editor.rendered, 0, 'the rows are not re-rendered, so an uncommitted edit survives');

  assert.equal(editor.enable(), editor);
  assert.equal(editor.isDisabled(), false);
  assert.equal(editor.el.getAttribute('aria-disabled'), null);
  assert.equal(editor._add.disabled, false);
  assert.deepEqual(editor._controls.map((one) => one.disabled), [false, false, false]);

  assert.equal(editor.disable(), editor);
  assert.equal(editor.isDisabled(), true);
  assert.equal(editor.emitted.length, 0, 'toggling the state is not a change of value');
});

test('MultiValueEditor disarms a row pressed for dragging when it is disabled', () => {
  const editor = editorProbe();
  const row = { draggable: true };
  editor._armed = row;
  editor.disable();
  assert.equal(row.draggable, false);
  assert.equal(editor._armed, null);
});

test('a disabled MultiValueEditor refuses to move rows, whatever asked for the move', () => {
  // Buttons, the handle's keys and a drop all reorder through _move(); the browser regression
  // drives the keys and buttons themselves.
  const editor = editorProbe();
  editor.disable();
  assert.equal(editor._move(0, 2, 'handle'), false);
  assert.deepEqual(editor._values, ['a', 'b', 'c']);
  assert.equal(editor.emitted.length, 0);

  editor.enable();
  assert.equal(editor._move(0, 2, 'handle'), true, 'enabled again, the same move goes through');
  assert.deepEqual(editor._values, ['b', 'c', 'a']);
  assert.deepEqual(editor.emitted, [['change', { values: ['b', 'c', 'a'] }]]);
});
