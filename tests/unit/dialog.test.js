import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { ActivityItem } from '../../src/components/activity-item/activity-item.js';
import { Calendar } from '../../src/components/calendar/calendar.js';
import { Card } from '../../src/components/card/card.js';
import { DatePicker } from '../../src/components/date-picker/date-picker.js';
import { MonthPicker } from '../../src/components/date-picker/month-picker.js';
import { TimePicker } from '../../src/components/date-picker/time-picker.js';
import { Dialog, normalizeDialogButtons } from '../../src/components/dialog/dialog.js';
import { Filter } from '../../src/components/filter/filter.js';
import { Launcher } from '../../src/components/launcher/launcher.js';
import { Message } from '../../src/components/message/message.js';
import { Panel } from '../../src/components/panel/panel.js';
import { Search } from '../../src/components/search/search.js';
import { Sheet } from '../../src/components/sheet/sheet.js';
import { Tabbox } from '../../src/components/tabbox/tabbox.js';
import { Timebox } from '../../src/components/timebox/timebox.js';
import { ValueList } from '../../src/components/value-list/value-list.js';
import { setTranslator } from '../../src/core/i18n.js';

const dialogSource = readFileSync(
  new URL('../../src/components/dialog/dialog.js', import.meta.url), 'utf8'
);
const modalSource = readFileSync(
  new URL('../../src/components/modal/modal.js', import.meta.url), 'utf8'
);
const sheetSource = readFileSync(
  new URL('../../src/components/sheet/sheet.js', import.meta.url), 'utf8'
);

test('footer button descriptors are copied, and disabled settles autofocus with it', () => {
  const source = [
    { label: 'Save', kind: 'primary', autofocus: true },
    { label: 'Submit', kind: 'primary', autofocus: true, disabled: true },
    { label: 7 }
  ];
  const buttons = normalizeDialogButtons(source);

  assert.deepEqual(buttons.map((button) => button.label), ['Save', 'Submit', '7']);
  assert.deepEqual(buttons.map((button) => button.disabled), [false, true, false]);

  // A disabled button must not be the control initial focus lands on, whatever the host wrote.
  assert.deepEqual(buttons.map((button) => button.autofocus), [true, false, false]);

  assert.notEqual(buttons[0], source[0], 'descriptors must be copies');
  assert.equal(Object.hasOwn(source[0], 'disabled'), false, 'the caller object must not be mutated');
  assert.deepEqual(normalizeDialogButtons(null), []);
  assert.deepEqual(normalizeDialogButtons(undefined), []);
  assert.deepEqual(normalizeDialogButtons('Save'), []);
});

test('a disabled footer button renders disabled, refuses activation, and is skipped by autofocus', () => {
  // `#renderButtons` hands the descriptor's disabled state to the button factory…
  assert.match(dialogSource, /button\(\{[^}]*disabled:\s*definition\.disabled/s);
  assert.match(dialogSource, /control\.autofocus = definition\.autofocus;/);

  // …the delegated footer listener refuses to run a disabled descriptor's action…
  assert.match(dialogSource, /#runButton\(definition\) \{[\s\S]{0,400}?if \(definition\.disabled\) return;/);

  /*
   * …and initial focus only accepts an autofocus candidate that is not disabled. The selection
   * itself moved to `Modal`, which is where every overlay now inherits it from, so the assertion
   * follows it rather than being dropped — and the dialog must not keep a second copy.
   */
  assert.match(modalSource, /querySelector\('\[autofocus\]:not\(\[disabled\]\)'\)/);
  assert.match(modalSource, /'button:not\(\[disabled\]\)'/);
  assert.doesNotMatch(dialogSource, /\[autofocus\]|FOCUSABLE_SELECTOR/);
});

test('Sheet inherits the footer-button behaviour instead of restating it', () => {
  assert.equal(Object.getPrototypeOf(Sheet.prototype), Dialog.prototype);
  for (const method of ['setButtons', 'addView', 'showView']) {
    assert.equal(Object.hasOwn(Sheet.prototype, method), false,
      `Sheet must not override ${method}(); it takes DialogButton descriptors through Dialog's footer`);
    assert.equal(Sheet.prototype[method], Dialog.prototype[method]);
  }
  // Sheet's open() adds a focus trap and then defers to Dialog's autofocus selection.
  assert.match(sheetSource, /open\(\) \{[\s\S]{0,600}?super\.open\(\);/);
  // The footer itself is Dialog's; Sheet neither builds buttons nor reads their descriptors.
  assert.doesNotMatch(sheetSource, /refs\.footer/);
  assert.doesNotMatch(sheetSource, /data-dialog-button|dialogButton/);
});

/**
 * Every entry is `[component class, source path, message key, today's English text]`. The English
 * column is the contract: an application that installs no translator must render exactly these
 * bytes, so the test asserts both that the key reaches a translator and that the fallback is the
 * string the component shipped with.
 */
const MESSAGES = [
  [Dialog, 'dialog/dialog.js', 'dialog.close', 'Close'],
  [Dialog, 'dialog/dialog.js', 'dialog.ok', 'OK'],
  [Dialog, 'dialog/dialog.js', 'dialog.cancel', 'Cancel'],
  [Dialog, 'dialog/dialog.js', 'dialog.promptValue', 'Prompt value'],
  [ActivityItem, 'activity-item/activity-item.js', 'activityItem.pending', 'Sending…'],
  [ActivityItem, 'activity-item/activity-item.js', 'activityItem.failed', 'Failed'],
  [ActivityItem, 'activity-item/activity-item.js', 'activityItem.label', 'Activity'],
  [ActivityItem, 'activity-item/activity-item.js', 'activityItem.actions', 'Actions for %1'],
  [ActivityItem, 'activity-item/activity-item.js', 'activityItem.metadata', 'Activity metadata'],
  [ActivityItem, 'activity-item/activity-item.js', 'activityItem.attachments', 'Attachments'],
  [ActivityItem, 'activity-item/activity-item.js', 'activityItem.untitled', 'activity'],
  [Search, 'search/search.js', 'search.label', 'Search'],
  [Search, 'search/search.js', 'search.clear', 'Clear search'],
  [Search, 'search/search.js', 'search.submit', 'Submit search'],
  [Search, 'search/search.js', 'search.submitTitle', 'Search'],
  [Message, 'message/message.js', 'message.close', 'Close message'],
  [Message, 'message/message.js', 'message.closeTitle', 'Close'],
  [Tabbox, 'tabbox/tabbox.js', 'tabbox.close', 'Close'],
  [Panel, 'panel/panel.js', 'panel.actions', 'Panel actions'],
  [Panel, 'panel/panel.js', 'panel.footerActions', 'Panel footer actions'],
  [Card, 'card/card.js', 'card.actions', 'Card actions'],
  [ValueList, 'value-list/value-list.js', 'valueList.values', 'Values'],
  [ValueList, 'value-list/value-list.js', 'valueList.add', 'Add value'],
  [ValueList, 'value-list/value-list.js', 'valueList.removable', '%1. Press Delete to remove.'],
  [ValueList, 'value-list/value-list.js', 'valueList.duplicate', 'This value already exists.'],
  [ValueList, 'value-list/value-list.js', 'valueList.invalid', 'This value is not valid.'],
  [ValueList, 'value-list/value-list.js', 'valueList.instructions',
    'Press Enter to add. Focus a value and press Ctrl plus Left or Right to reorder.'],
  [Timebox, 'timebox/timebox.js', 'timebox.duration', 'Duration in hours and minutes'],
  [Timebox, 'timebox/timebox.js', 'timebox.durationWithSeconds',
    'Duration in hours, minutes, and seconds'],
  [Timebox, 'timebox/timebox.js', 'timebox.toggleSign', 'Toggle duration sign'],
  [Timebox, 'timebox/timebox.js', 'timebox.hours', 'Hours'],
  [Timebox, 'timebox/timebox.js', 'timebox.minutes', 'Minutes'],
  [Timebox, 'timebox/timebox.js', 'timebox.seconds', 'Seconds'],
  [Launcher, 'launcher/launcher.js', 'launcher.label', 'Launcher'],
  [Launcher, 'launcher/launcher.js', 'launcher.placeholder', 'Search applications and records'],
  [Launcher, 'launcher/launcher.js', 'launcher.close', 'Close launcher'],
  [Launcher, 'launcher/launcher.js', 'launcher.results', 'Launcher results'],
  [Launcher, 'launcher/launcher.js', 'launcher.empty', 'No results'],
  [Launcher, 'launcher/launcher.js', 'launcher.loading', 'Searching…'],
  [Launcher, 'launcher/launcher.js', 'launcher.hintMove', 'Move'],
  [Launcher, 'launcher/launcher.js', 'launcher.hintOpen', 'Open'],
  [Launcher, 'launcher/launcher.js', 'launcher.hintClose', 'Close'],
  [Filter, 'filter/filter.js', 'filter.addFilter', 'Add filter'],
  [Filter, 'filter/filter.js', 'filter.addGroup', 'Add group'],
  [Filter, 'filter/filter.js', 'filter.addSubgroup', 'Add subgroup'],
  [Filter, 'filter/filter.js', 'filter.removeGroup', 'Remove group'],
  [Filter, 'filter/filter.js', 'filter.remove', 'Remove %1'],
  [Filter, 'filter/filter.js', 'filter.filterNoun', 'filter'],
  [Filter, 'filter/filter.js', 'filter.conditionNoun', 'Filter'],
  [Filter, 'filter/filter.js', 'filter.groupNoun', 'Filter group'],
  [Filter, 'filter/filter.js', 'filter.removed', '%1 removed'],
  [Filter, 'filter/filter.js', 'filter.apply', 'Apply filters'],
  [Filter, 'filter/filter.js', 'filter.clear', 'Clear'],
  [Filter, 'filter/filter.js', 'filter.rootLogic', 'Root filter logic'],
  [Filter, 'filter/filter.js', 'filter.groupLogic', 'Group filter logic'],
  [Filter, 'filter/filter.js', 'filter.matchAll', 'Match all'],
  [Filter, 'filter/filter.js', 'filter.matchAny', 'Match any'],
  [Filter, 'filter/filter.js', 'filter.matchAllConditions', 'Match all conditions'],
  [Filter, 'filter/filter.js', 'filter.matchAnyConditions', 'Match any conditions'],
  [Filter, 'filter/filter.js', 'filter.conditions', 'conditions'],
  [Filter, 'filter/filter.js', 'filter.inThisGroup', 'in this group'],
  [Filter, 'filter/filter.js', 'filter.field', 'Filter field'],
  [Filter, 'filter/filter.js', 'filter.operator', 'Filter operator'],
  [Filter, 'filter/filter.js', 'filter.chooseField', 'Choose a field…'],
  [Filter, 'filter/filter.js', 'filter.chooseOperator', 'Choose an operator…'],
  [Filter, 'filter/filter.js', 'filter.choosePart', 'Choose %1…'],
  [Filter, 'filter/filter.js', 'filter.unavailable', 'Unavailable: %1'],
  [Filter, 'filter/filter.js', 'filter.noValue', 'No value'],
  [Filter, 'filter/filter.js', 'filter.choose', 'Choose…'],
  [Filter, 'filter/filter.js', 'filter.booleanTrue', 'True'],
  [Filter, 'filter/filter.js', 'filter.booleanFalse', 'False'],
  [Filter, 'filter/filter.js', 'filter.commaSeparated', 'Comma-separated values'],
  [Filter, 'filter/filter.js', 'filter.fieldValue', '%1 value'],
  [Filter, 'filter/filter.js', 'filter.fieldValueAt', '%1 value %2'],
  [DatePicker, 'date-picker/date-picker.js', 'datePicker.previousMonth', 'Previous month'],
  [DatePicker, 'date-picker/date-picker.js', 'datePicker.nextMonth', 'Next month'],
  [DatePicker, 'date-picker/date-picker.js', 'datePicker.previousYear', 'Previous year'],
  [DatePicker, 'date-picker/date-picker.js', 'datePicker.nextYear', 'Next year'],
  [DatePicker, 'date-picker/date-picker.js', 'datePicker.calendar', 'Calendar'],
  [DatePicker, 'date-picker/date-picker.js', 'datePicker.weekNumber', 'Week number'],
  [DatePicker, 'date-picker/date-picker.js', 'datePicker.week', 'Week %1'],
  [DatePicker, 'date-picker/date-picker.js', 'datePicker.chooseMonthYear',
    'Choose month and year, %1'],
  [MonthPicker, 'date-picker/month-picker.js', 'monthPicker.previousYear', 'Previous year'],
  [MonthPicker, 'date-picker/month-picker.js', 'monthPicker.nextYear', 'Next year'],
  [MonthPicker, 'date-picker/month-picker.js', 'monthPicker.chooseMonth', 'Choose month'],
  [TimePicker, 'date-picker/time-picker.js', 'timePicker.label', 'Time'],
  [TimePicker, 'date-picker/time-picker.js', 'timePicker.hour', 'Hour'],
  [TimePicker, 'date-picker/time-picker.js', 'timePicker.minute', 'Minute'],
  [TimePicker, 'date-picker/time-picker.js', 'timePicker.minutes', 'Minutes'],
  [TimePicker, 'date-picker/time-picker.js', 'timePicker.second', 'Second'],
  [TimePicker, 'date-picker/time-picker.js', 'timePicker.clock', 'Pick the time on a clock'],
  [TimePicker, 'date-picker/time-picker.js', 'timePicker.selectHour', 'Select the hour'],
  [TimePicker, 'date-picker/time-picker.js', 'timePicker.selectMinutes', 'Select the minutes'],
  [Calendar, 'calendar/calendar.js', 'calendar.viewSwitch', 'Calendar view'],
  [Calendar, 'calendar/calendar.js', 'calendar.dayEvent', '%1, %2 event'],
  [Calendar, 'calendar/calendar.js', 'calendar.dayEvents', '%1, %2 events']
];

/**
 * Probes `_message()` without a DOM. The helper only needs `this.options`, so a bare prototype
 * instance is enough to exercise the seam the host translator arrives through.
 * @param {Function} Component Component class.
 * @param {Record<string, unknown>} [options={}] Options the probe should answer with.
 * @returns {{_message: (key: string, fallback: string, ...args: unknown[]) => string}}
 */
function probe(Component, options = {}) {
  const instance = Object.create(Component.prototype);
  instance.options = options;
  return instance;
}

test('every swept string keeps its English text and reaches the host translator', () => {
  const sources = new Map();
  for (const [, path] of MESSAGES) {
    if (!sources.has(path)) {
      sources.set(path, readFileSync(new URL(`../../src/components/${path}`, import.meta.url), 'utf8'));
    }
  }

  try {
    setTranslator(null);
    for (const [Component, path, key, english] of MESSAGES) {
      assert.equal(probe(Component)._message(key, english), english,
        `${key} must render its built-in English text when no translator is installed`);
      assert.ok(sources.get(path).includes(`'${key}'`),
        `${path} must resolve ${key}`);
      assert.ok(sources.get(path).includes(`'${english}'`),
        `${path} must keep the English fallback for ${key} byte-identical`);
    }

    setTranslator((key) => `de:${key}`);
    for (const [Component, , key, english] of MESSAGES) {
      assert.equal(probe(Component)._message(key, english), `de:${key}`,
        `${key} must be answerable by a host translator`);
    }
  } finally {
    setTranslator(null);
  }
});

test('interpolating fallbacks place their arguments where the English text does', () => {
  try {
    setTranslator(null);
    assert.equal(probe(ActivityItem)._message('activityItem.actions', 'Actions for %1', 'Invoice 7'),
      'Actions for Invoice 7');
    assert.equal(probe(ValueList)._message('valueList.removable', '%1. Press Delete to remove.', 'EUR'),
      'EUR. Press Delete to remove.');
    assert.equal(probe(Filter)._message('filter.fieldValueAt', '%1 value %2', 'Amount', 2),
      'Amount value 2');
    assert.equal(probe(DatePicker)._message('datePicker.week', 'Week %1', 34), 'Week 34');
    assert.equal(probe(Calendar)._message('calendar.dayEvents', '%1, %2 events', 'Monday', 3),
      'Monday, 3 events');

    // Calendar carries its own built-in `msg` bag; a dotted key must fall past it to the host.
    setTranslator((key) => (key === 'calendar.viewSwitch' ? 'Kalenderansicht' : null));
    const calendar = probe(Calendar, { msg: { today: 'Today', calendar: 'Calendar' } });
    assert.equal(calendar._message('calendar.viewSwitch', 'Calendar view'), 'Kalenderansicht');
    assert.equal(calendar.msg('today'), 'Today', 'the built-in bag must still answer its own keys');
  } finally {
    setTranslator(null);
  }
});
