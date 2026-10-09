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
