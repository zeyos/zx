import { DatePicker, MonthPicker, TimePicker, h } from '../../src/index.js';

/** @param {number} value @returns {string} */
function pad(value) {
  return String(value).padStart(2, '0');
}

export default {
  title: 'Date/Time picker',
  group: 'Inputs',
  api: ['DatePicker', 'MonthPicker', 'TimePicker'],
  blurb: 'Three inline pickers \u2014 a calendar, a month grid, and a time control \u2014 each a roving '
    + 'grid with one tab stop.',

  examples: [
    {
      title: 'Calendar with bounds and week numbers',
      blurb: 'min and max mark out-of-range days aria-disabled rather than removing them, so the '
        + 'grid keeps its shape and the keyboard can still move across it. monthchange fires when '
        + 'the visible month changes, which is where a server-backed calendar loads its events.',
      render: ({ cleanup, log }) => {
        const picker = new DatePicker(null, {
          value: new Date(2026, 6, 17, 9, 30),
          min: new Date(2026, 6, 10),
          max: new Date(2026, 7, 12),
          showWeekNumbers: true
        });
        picker.on('change', ({ detail }) => log(`change \u2192 ${detail.date?.toDateString() ?? 'null'}`));
        picker.on('monthchange', ({ detail }) => log(`monthchange \u2192 ${detail.year}-${pad(detail.month + 1)}`));
        cleanup(() => picker.destroy());
        return picker.el;
      }
    },
    {
      title: 'Month picker',
      blurb: 'The same keyboard model over a year of months \u2014 for a period selector, where a day '
        + 'would be more precision than the question has.',
      render: ({ cleanup, log }) => {
        const picker = new MonthPicker(null, {
          value: new Date(2026, 6, 1),
          min: new Date(2026, 2, 1),
          max: new Date(2027, 8, 1)
        });
        picker.on('change', ({ detail }) => log(`change \u2192 ${detail.date?.toDateString() ?? 'null'}`));
        cleanup(() => picker.destroy());
        return picker.el;
      }
    },
    {
      title: 'Time picker',
      blurb: 'Arrow keys step each spinbutton and typing two digits advances focus. The clock '
        + 'button opens a dial: pick an hour on the outer ring (1\u201312) or the inner one (13\u201323, 00) '
        + 'and it moves on to the minutes. Pass clock: false to leave the spinbuttons on their own.',
      render: ({ cleanup, log }) => {
        const picker = new TimePicker(null, { value: { h: 14, m: 35, s: 20 }, seconds: true, step: 5 });
        picker.on('change', ({ detail }) =>
          log(`change \u2192 ${pad(detail.time.h)}:${pad(detail.time.m)}:${pad(detail.time.s)}`));
        cleanup(() => picker.destroy());
        return picker.el;
      }
    }
  ]
};
