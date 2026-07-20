import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHECKLIST_OPTION_MAP,
  FIELD_TYPE_MAP,
  LEGACY_EVENT_ARGS,
  SELECT_OPTION_MAP,
  TABLE_OPTION_MAP,
  renameOptions,
  resolveTabName,
  translateChecklistOptions,
  translateDateboxFormat,
  translateFieldOptions,
  translateSelectOptions,
  translateTabboxOptions,
  translateTableOptions
} from '../../src/compat/map/options.js';

test('translation tables expose the documented option renames', () => {
  assert.equal(SELECT_OPTION_MAP.elementIndex, 'valueKey');
  assert.equal(SELECT_OPTION_MAP.elementLabel, 'labelKey');
  assert.equal(SELECT_OPTION_MAP.elementSelect, 'renderValue');
  assert.equal(CHECKLIST_OPTION_MAP.listActive, 'checkedKey');
  assert.equal(TABLE_OPTION_MAP.cols, 'columns');
  assert.equal(FIELD_TYPE_MAP.gxselect, 'zxselect');
  assert.deepEqual(renameOptions({ data: [1], onSelect() {}, custom: true }, SELECT_OPTION_MAP), {
    items: [1], custom: true
  });
});

test('Select and Checklist translations retain data while renaming readers', () => {
  const rows = [{ ID: 1, name: 'One' }];
  const select = translateSelectOptions({
    data: rows, elementIndex: 'key', elementLabel: 'title', elementSelect: 'caption',
    allowEmpty: true, msg: { noSelection: 'Choose' }, height: '240px'
  });
  assert.deepEqual(select.items, rows);
  assert.notEqual(select.items, rows);
  assert.equal(select.valueKey, 'key');
  assert.equal(select.labelKey, 'title');
  assert.equal(select.renderValue, 'caption');
  assert.equal(select.clearable, true);
  assert.equal(select.placeholder, 'Choose');
  assert.equal(select.listHeight, 240);

  const getItemValue = (item) => item.code;
  const checklist = translateChecklistOptions({
    data: rows, listValue: 'code', listFormat: 'label', listActive: 'checked',
    defaultState: true, getItemValue, height: '180px'
  });
  assert.equal(checklist.items, rows);
  assert.equal(checklist.valueKey, getItemValue);
  assert.equal(checklist.labelKey, 'label');
  assert.equal(checklist.checkedKey, 'checked');
  assert.equal(checklist.defaultChecked, true);
  assert.equal(checklist.height, 180);
});

test('Table translation adapts legacy structure rows and initial sort', () => {
  const source = {
    cols: [
      { id: 'name', label: 'Name', filter: 'desc', width: '2fr' },
      { id: 'total', label: 'Total', filterable: false }
    ],
    data: [{ ID: 7, name: 'Alpha', total: 3 }],
    structure: (row) => [{ label: row.name }, row.total]
  };
  const translated = translateTableOptions(source, (cell) => cell?.label ?? cell);
  assert.equal(translated.columns[0].id, 'name');
  assert.equal(translated.columns[0].sortable, true);
  assert.equal(translated.columns[1].sortable, false);
  assert.equal(translated.columns[0].render(source.data[0], 0), 'Alpha');
  assert.equal(translated.columns[1].render(source.data[0], 0), 3);
  assert.deepEqual(translated.sort, { id: 'name', dir: 'desc' });
  assert.equal(translated.sortMode, 'server');
});

test('legacy events receive positional argument shapes', () => {
  const wrapper = { marker: true, _legacyColumn: (id) => ({ id, legacy: true }) };
  const item = { ID: 3 };
  assert.deepEqual(LEGACY_EVENT_ARGS.select({ item }, wrapper), [item, wrapper]);
  assert.deepEqual(LEGACY_EVENT_ARGS.noselect({}, wrapper), [null, wrapper]);
  assert.deepEqual(LEGACY_EVENT_ARGS.tabChange({ name: 'details' }), ['details']);
  assert.deepEqual(LEGACY_EVENT_ARGS.tableFilter({ id: 'name', dir: 'asc' }, wrapper), [
    { id: 'name', legacy: true }, 'asc'
  ]);

  const tableRow = { tagName: 'TR' };
  const original = { target: { closest: (selector) => selector === 'tr' ? tableRow : null } };
  const data = { ID: 9 };
  assert.deepEqual(LEGACY_EVENT_ARGS.tableClick({ row: data, event: original }), [data, tableRow, original]);
});

test('Datebox token arrays and tab indexes translate deterministically', () => {
  assert.equal(
    translateDateboxFormat(['d', '.', 'M', '.', 'y', '&nbsp;', 'h', ':', 'i']),
    '%d.%m.%Y %H:%M'
  );
  assert.equal(translateDateboxFormat('%d/%m/%Y'), '%d/%m/%Y');

  const frames = [
    { name: 'overview', title: 'Overview', content: 'A' },
    { name: 'details', title: 'Details', content: 'B' }
  ];
  assert.equal(resolveTabName(frames, 2), 'details');
  assert.equal(resolveTabName(frames, 'overview'), 'overview');
  assert.equal(resolveTabName(frames, 0), null);
  assert.equal(translateTabboxOptions({ frames, show: 2 }).active, 'details');
});

test('legacy field descriptors map layout, type, and initial value', () => {
  const field = translateFieldOptions({
    id: 'customer', type: 'gxselect', label: 'Customer', default: 12,
    horizontal: ['col-md-3', 'col-md-9'], required: true
  });
  assert.equal(field.type, 'zxselect');
  assert.equal(field.layout, 'inline');
  assert.equal(field.value, 12);
  assert.equal(field.required, true);
});
