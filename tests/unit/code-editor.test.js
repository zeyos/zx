import assert from 'node:assert/strict';
import test from 'node:test';

import { CodeEditor, editorPosition, indentSelection } from '../../src/components/code-editor/code-editor.js';

test('CodeEditor inserts a tab at a collapsed selection', () => {
  assert.deepEqual(indentSelection('alpha', 2, 2, '\t', false), {
    value: 'al\tpha', start: 3, end: 3
  });
});

test('CodeEditor indents and outdents all selected lines while retaining selection', () => {
  const indented = indentSelection('one\ntwo\nthree', 0, 7, '  ', false);
  assert.deepEqual(indented, {
    value: '  one\n  two\nthree', start: 2, end: 11
  });
  assert.deepEqual(indentSelection(indented.value, indented.start, indented.end, '  ', true), {
    value: 'one\ntwo\nthree', start: 0, end: 7
  });
});

test('CodeEditor outdent is a no-op on an unindented caret line', () => {
  assert.deepEqual(indentSelection('one\ntwo', 5, 5, '\t', true), {
    value: 'one\ntwo', start: 5, end: 5
  });
});

test('CodeEditor reports one-based line and column plus selected line count', () => {
  assert.deepEqual(editorPosition('one\ntwo\nthree', 5, 9), {
    line: 2, column: 2, lines: 2
  });
});

/*
 * Escape releases the Tab capture for one keystroke, so Escape then Tab leaves the editor. The
 * handler only reads the textarea and the options, so a prototype probe with a stand-in textarea
 * drives it without a DOM.
 */
function editorProbe(value = 'alpha') {
  const editor = Object.create(CodeEditor.prototype);
  editor.options = { indent: '\t' };
  editor._tabReleased = false;
  editor._input = {
    value, selectionStart: value.length, selectionEnd: value.length, readOnly: false, disabled: false,
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  };
  editor._updatePosition = () => {};
  editor.emit = () => {};
  return editor;
}

function key(name, modifiers = {}) {
  return {
    key: name, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, isComposing: false,
    ...modifiers,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; }
  };
}

test('CodeEditor captures Tab until Escape releases it for the next keystroke', () => {
  const editor = editorProbe();
  const captured = key('Tab');
  editor._handleKeydown(captured);
  assert.equal(captured.defaultPrevented, true, 'Tab indents by default');
  assert.equal(editor._input.value, 'alpha\t');

  editor._handleKeydown(key('Escape'));
  const released = key('Tab');
  editor._handleKeydown(released);
  assert.equal(released.defaultPrevented, false, 'Escape then Tab must leave the editor');
  assert.equal(editor._input.value, 'alpha\t', 'the released Tab must not indent');

  const recaptured = key('Tab');
  editor._handleKeydown(recaptured);
  assert.equal(recaptured.defaultPrevented, true, 'the release lasts one keystroke');
});

test('CodeEditor keeps the release across modifiers and ends it on any other key', () => {
  const editor = editorProbe();
  editor._handleKeydown(key('Escape'));
  editor._handleKeydown(key('Shift', { shiftKey: true }));
  const backwards = key('Tab', { shiftKey: true });
  editor._handleKeydown(backwards);
  assert.equal(backwards.defaultPrevented, false, 'Escape, Shift+Tab must leave the editor too');

  editor._handleKeydown(key('Escape'));
  editor._handleKeydown(key('a'));
  const typed = key('Tab');
  editor._handleKeydown(typed);
  assert.equal(typed.defaultPrevented, true, 'typing after Escape restores the capture');
});

/*
 * WP82 N1. `indent: ''` switches the Tab capture off altogether; the option's documentation says
 * so, and this is the behaviour it describes.
 */
test('CodeEditor with an empty indent leaves Tab and Shift+Tab to the browser', () => {
  const editor = editorProbe();
  editor.options = { indent: '' };
  for (const event of [key('Tab'), key('Tab', { shiftKey: true })]) {
    editor._handleKeydown(event);
    assert.equal(event.defaultPrevented, false);
  }
  assert.equal(editor._input.value, 'alpha');
});

test('CodeEditor never captures Tab with Ctrl, Alt or Meta, or while read-only or disabled', () => {
  const editor = editorProbe();
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) {
    const event = key('Tab', { [modifier]: true });
    editor._handleKeydown(event);
    assert.equal(event.defaultPrevented, false, modifier);
  }
  for (const state of ['readOnly', 'disabled']) {
    editor._input[state] = true;
    const event = key('Tab');
    editor._handleKeydown(event);
    assert.equal(event.defaultPrevented, false, state);
    editor._input[state] = false;
  }
  assert.equal(editor._input.value, 'alpha');
});

/*
 * WP82 N8. The error state follows Field: setHighlight(message, kind) / clearHighlight(),
 * `data-state` on the root, and for `danger` an alert, `aria-invalid` and the `invalid` event,
 * with the message as the textarea's description. Stand-in elements carry just the attribute
 * surface those two methods write.
 */
function fakeElement(attributes = {}) {
  const map = new Map(Object.entries(attributes));
  return {
    id: '', hidden: true, textContent: '', dataset: {},
    setAttribute(name, value) { map.set(name, String(value)); },
    getAttribute(name) { return map.get(name) ?? null; },
    removeAttribute(name) { map.delete(name); },
    hasAttribute(name) { return map.has(name); }
  };
}

function highlightProbe(describedBy) {
  const editor = Object.create(CodeEditor.prototype);
  editor.el = fakeElement();
  editor._input = fakeElement(describedBy ? { 'aria-describedby': describedBy } : {});
  editor._highlight = fakeElement();
  editor._highlight.id = 'hl';
  editor.emitted = [];
  editor.emit = (type, detail) => { editor.emitted.push([type, detail]); };
  return editor;
}

test('CodeEditor.setHighlight marks the error state the way a Field does', () => {
  const editor = highlightProbe();
  assert.equal(editor.setHighlight('Line 3: unexpected token'), editor);
  assert.equal(editor.el.dataset.state, 'danger');
  assert.equal(editor._highlight.textContent, 'Line 3: unexpected token');
  assert.equal(editor._highlight.hidden, false);
  assert.equal(editor._highlight.getAttribute('role'), 'alert');
  assert.equal(editor._input.getAttribute('aria-invalid'), 'true');
  assert.equal(editor._input.getAttribute('aria-describedby'), 'hl');
  assert.deepEqual(editor.emitted, [['invalid', { message: 'Line 3: unexpected token' }]]);
});

test('CodeEditor warning and success are statuses, not errors, and an unknown kind is danger', () => {
  const editor = highlightProbe();
  editor.setHighlight('Broken');
  for (const kind of ['warning', 'success']) {
    editor.setHighlight('Saved', kind);
    assert.equal(editor.el.dataset.state, kind);
    assert.equal(editor._highlight.getAttribute('role'), null);
    assert.equal(editor._input.getAttribute('aria-invalid'), null);
    assert.equal(editor._input.getAttribute('aria-describedby'), 'hl');
  }
  assert.equal(editor.emitted.length, 1, 'only danger emits invalid');
  editor.setHighlight('Broken', 'nonsense');
  assert.equal(editor.el.dataset.state, 'danger');
});

test('CodeEditor.clearHighlight and an empty message both clear, keeping foreign descriptions', () => {
  const editor = highlightProbe('field-description');
  editor.setHighlight('Broken');
  editor.setHighlight('Broken');
  assert.equal(editor._input.getAttribute('aria-describedby'), 'field-description hl', 'the id is added once');
  editor.setHighlight('');
  assert.equal('state' in editor.el.dataset, false);
  assert.equal(editor._highlight.hidden, true);
  assert.equal(editor._highlight.textContent, '');
  assert.equal(editor._highlight.getAttribute('role'), null);
  assert.equal(editor._input.getAttribute('aria-invalid'), null);
  assert.equal(editor._input.getAttribute('aria-describedby'), 'field-description');

  const bare = highlightProbe();
  bare.setHighlight('Broken').clearHighlight();
  assert.equal(bare._input.hasAttribute('aria-describedby'), false);
});

/*
 * Every other control spells it `readonly` / `setReadonly()`; the editor answers to both spellings.
 * The option is checked in tests/regression/followup-api.js, where the textarea is real.
 */
test('CodeEditor declares the readonly option beside readOnly, both off by default', () => {
  assert.equal(CodeEditor.defaults.readOnly, false);
  assert.equal(CodeEditor.defaults.readonly, false);
});

test('CodeEditor.setReadonly() is setReadOnly() under the other spelling', () => {
  const editor = Object.create(CodeEditor.prototype);
  editor.el = fakeElement();
  editor._input = { readOnly: false };
  assert.equal(editor.setReadonly(true), editor);
  assert.equal(editor._input.readOnly, true);
  assert.equal(editor.el.dataset.readonly, 'true');
  editor.setReadonly(0);
  assert.equal(editor._input.readOnly, false);
  assert.equal(editor.el.dataset.readonly, 'false');
  editor.setReadOnly(true);
  assert.equal(editor._input.readOnly, true, 'the original name keeps working');
});
