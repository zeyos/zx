import assert from 'node:assert/strict';
import test from 'node:test';

import { editableAllowsRoving, isEditableTarget, rovingStep } from '../../src/core/keyboard.js';

/*
 * The decisions `rovingTabindex` makes before it moves focus, as pure functions: which step a key
 * means (and how right-to-left changes that), and whether an editable target gives the key up.
 */

test('keys map to logical steps; right-to-left swaps only the horizontal arrows', () => {
  assert.equal(rovingStep('ArrowRight', 'horizontal'), 'next');
  assert.equal(rovingStep('ArrowLeft', 'horizontal'), 'previous');
  assert.equal(rovingStep('ArrowRight', 'horizontal', true), 'previous');
  assert.equal(rovingStep('ArrowLeft', 'horizontal', true), 'next');
  assert.equal(rovingStep('Home', 'horizontal', true), 'first');
  assert.equal(rovingStep('End', 'horizontal', true), 'last');
  assert.equal(rovingStep('ArrowDown', 'vertical', true), 'next', 'vertical groups ignore direction');
  assert.equal(rovingStep('ArrowUp', 'vertical'), 'previous');
  assert.equal(rovingStep('ArrowDown', 'horizontal'), null);
  assert.equal(rovingStep('ArrowLeft', 'vertical'), null);
  assert.equal(rovingStep('a', 'horizontal'), null);
});

test('text fields, selects, and contenteditable regions are editable; buttons and checkboxes are not', () => {
  assert.equal(isEditableTarget(input('text')), true);
  assert.equal(isEditableTarget(input('search')), true);
  assert.equal(isEditableTarget(input('number')), true);
  assert.equal(isEditableTarget({ tagName: 'TEXTAREA' }), true);
  assert.equal(isEditableTarget({ tagName: 'SELECT' }), true);
  assert.equal(isEditableTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isEditableTarget(input('checkbox')), false);
  assert.equal(isEditableTarget(input('button')), false);
  assert.equal(isEditableTarget({ tagName: 'BUTTON' }), false);
  assert.equal(isEditableTarget(null), false);
});

test('an editable target keeps Home/End and its arrows until the caret reaches the edge', () => {
  const field = input('text', 'invoice', 3, 3);
  assert.equal(editableAllowsRoving(field, 'previous'), false, 'the caret moves inside the text');
  assert.equal(editableAllowsRoving(field, 'next'), false);
  assert.equal(editableAllowsRoving(field, 'first'), false, 'Home goes to the start of the text');
  assert.equal(editableAllowsRoving(field, 'last'), false);
  assert.equal(editableAllowsRoving(input('text', 'invoice', 0, 0), 'previous'), true, 'at the start, leave');
  assert.equal(editableAllowsRoving(input('text', 'invoice', 7, 7), 'next'), true, 'at the end, leave');
  assert.equal(editableAllowsRoving(input('text', 'invoice', 0, 7), 'previous'), false,
    'a selection collapses first');
  assert.equal(editableAllowsRoving(input('number', '12', null, null), 'next'), false,
    'a field without a selection API owns its arrows');
  assert.equal(editableAllowsRoving({ tagName: 'SELECT' }, 'next'), false);
  assert.equal(editableAllowsRoving({ tagName: 'BUTTON' }, 'first'), true);
  assert.equal(editableAllowsRoving(input('checkbox'), 'next'), true);
});

/**
 * @param {string} type Input type.
 * @param {string} [value=''] Value.
 * @param {number|null} [start=0] Selection start.
 * @param {number|null} [end=start] Selection end.
 */
function input(type, value = '', start = 0, end = start) {
  return { tagName: 'INPUT', type, value, selectionStart: start, selectionEnd: end };
}
