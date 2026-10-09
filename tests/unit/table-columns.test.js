import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  editorSelectsOnEntry, normalizeTableColumns, tableColumnName, tableHeaderName
} from '../../src/components/table/table.js';

/*
 * What a column is called where it is named rather than shown, which editors replace their value
 * on the first keystroke, and the header and frame rules that keep a table's columns alike. The
 * DOM half — `data-column` on every cell, the `aria-label` on a blank header — is exercised in the
 * browser; the decisions are pure and live here.
 */

const css = readFileSync(new URL('../../src/components/table/table.css', import.meta.url), 'utf8');
const source = readFileSync(new URL('../../src/components/table/table.js', import.meta.url), 'utf8');

/** @param {string} selector @returns {string} The declarations of the first rule for a selector. */
function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(match, `no rule for ${selector}`);
  return match[1];
}

test('a column is named by its ariaLabel, then its label, then its id', () => {
  assert.equal(tableColumnName({ id: 'qty', label: 'Quantity' }), 'Quantity');
  assert.equal(tableColumnName({ id: 'pos', label: '#', ariaLabel: 'Position' }), 'Position');
  assert.equal(tableColumnName({ id: 'actions', label: '' }), 'actions');
  assert.equal(tableColumnName({ id: 'actions', label: '   ', ariaLabel: '  ' }), 'actions');
  assert.equal(tableColumnName({ id: 'actions', label: '', ariaLabel: 'Row actions' }), 'Row actions');
  assert.equal(tableColumnName(null), '');
});

test('only a blank or explicitly named header gets an aria-label', () => {
  // A visible label already names its header; repeating it as aria-label would add nothing.
  assert.equal(tableHeaderName({ id: 'qty', label: 'Quantity' }), null);
  // A blank header is announced by its key rather than as an empty column.
  assert.equal(tableHeaderName({ id: 'actions', label: '' }), 'actions');
  assert.equal(tableHeaderName({ id: 'flag', label: ' ' }), 'flag');
  // An explicit name wins, with or without a visible label.
  assert.equal(tableHeaderName({ id: 'actions', label: '', ariaLabel: 'Row actions' }), 'Row actions');
  assert.equal(tableHeaderName({ id: 'pos', label: '#', ariaLabel: 'Position' }), 'Position');
});

test('normalized columns keep an empty label empty, so the header can stay blank', () => {
  const [blank, missing] = normalizeTableColumns([{ id: 'actions', label: '' }, { id: 'name' }]);
  assert.equal(blank.label, '');
  assert.equal(tableHeaderName(blank), 'actions');
  // A missing label still falls back to the id as visible text, exactly as before.
  assert.equal(missing.label, 'name');
  assert.equal(tableHeaderName(missing), null);
});

test('text, number, and date editors select their content on entry; the others do not', () => {
  // Typing "6" into a number editor showing "1.00" must give 6, not 1.006.
  for (const type of ['text', 'number', 'date']) assert.equal(editorSelectsOnEntry(type), true, type);
  for (const type of ['textarea', 'select', 'checkbox', 'custom', '', undefined]) {
    assert.equal(editorSelectsOnEntry(/** @type {any} */ (type)), false, String(type));
  }
  assert.match(source, /if \(editorSelectsOnEntry\(entry\.type\) && typeof control\.select === 'function'\) control\.select\(\);/);
});

test('every header and body cell carries data-column, editable or not', () => {
  assert.match(source, /h\('th', \{ scope: 'col', dataset: \{ column: column\.id \} \}\)/);
  // Written outside the edit-mode branch, so a read-only table can be styled per column.
  assert.match(source, /cell\.dataset\.label = column\.label;\n\s*cell\.dataset\.column = column\.id;\n\s*if \(column\.popin === false\)/);
  // A read-only table still activates the row when a control inside a cell is clicked.
  assert.doesNotMatch(source, /^\s*if \(isInteractiveCellContent\(target\)\) return;/m);
});

test('sortable and plain headers share the header type, and no gutter is reserved', () => {
  const button = rule('.zx-table__sort-button');
  assert.match(button, /font:\s*inherit/);
  assert.match(button, /letter-spacing:\s*inherit/);
  const scroll = rule('.zx-table__scroll');
  assert.match(scroll, /scrollbar-gutter:\s*auto/);
  assert.doesNotMatch(css, /scrollbar-gutter:\s*stable/);
});
