import assert from 'node:assert/strict';
import test from 'node:test';

import { editorPosition, indentSelection } from '../../src/components/code-editor/code-editor.js';

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
