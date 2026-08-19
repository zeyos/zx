import { DateRangeBox, DateRangePicker, Form, h } from '../../src/index.js';

/** @param {Date|null|undefined} date @returns {string} */
function stamp(date) {
  return date ? date.toISOString().slice(0, 10) : 'null';
}

export default {
  title: 'Date range',
  group: 'Inputs',
  blurb: 'Two calendars driven as one roving-focus grid: the first click opens a range, hovering '
    + 'or arrowing previews where it would end, and the second click closes it.',

  examples: [
    {
      title: 'Inline picker with presets',
      blurb: 'Arrow keys move a day, PageUp/PageDown a month, Shift+PageUp/PageDown a year, '
        + 'Home/End jump to the ends of the week, Enter or Space selects, and Escape abandons a '
        + 'half-picked range. Both months share one tab stop, so arrowing right off 31 August '
        + 'continues on 1 September. Narrow the window to watch the container query drop the '
        + 'second month.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const picker = new DateRangePicker(null, {
          start: new Date(2026, 7, 1),
          end: new Date(2026, 7, 14),
          presets: true,
          showWeekNumbers: true
        });
        picker.on('select', ({ detail }) => log(`select ${stamp(detail.start)} \u2192 ${stamp(detail.end)}`));
        picker.on('change', ({ detail }) => log(`change ${stamp(detail.start)} \u2192 ${stamp(detail.end)}`));
        cleanup(() => picker.destroy());
        return [
          picker.el,
          h('div', { class: 'demo-row' },
            h('button', {
              type: 'button',
              onclick: () => picker.set({ start: new Date(2026, 7, 5), end: new Date(2026, 7, 20) })
            }, 'set({start, end})'),
            h('button', { type: 'button', onclick: () => picker.clear() }, 'clear()'),
            h('button', {
              type: 'button',
              onclick: () => {
                const range = picker.get();
                log(`get() ${stamp(range.start)} \u2192 ${stamp(range.end)}`);
              }
            }, 'get()'))
        ];
      }
    },
    {
      title: 'DateRangeBox in a form row',
      blurb: 'The same picker behind a typed text field with an anchored popover. Type '
        + '\u201c01.08.2026 \u2013 14.08.2026\u201d, or open the calendar with the button or ArrowDown. '
        + 'Unparseable text keeps the field editable and marks it invalid.',
      width: '420px',
      render: ({ cleanup, log }) => {
        const box = new DateRangeBox(null, {
          start: new Date(2026, 7, 3),
          end: new Date(2026, 7, 9),
          presets: true
        });
        box.on('change', ({ detail }) => log(`change ${stamp(detail.start)} \u2192 ${stamp(detail.end)}`));
        box.on('invalid', ({ detail }) => log(`invalid: kept \u201c${detail.text}\u201d for correction`));
        cleanup(() => box.destroy());
        return box.el;
      }
    },
    {
      title: 'Bounds and night limits',
      blurb: 'Bounded to 10 August \u2013 12 September, with a stay of 3 to 21 nights. Once a start is '
        + 'picked, days that would break the limits become unselectable too \u2014 and clicking before '
        + 'the start restarts the range there rather than refusing the click.',
      render: ({ cleanup, log }) => {
        const picker = new DateRangePicker(null, {
          months: 2,
          min: new Date(2026, 7, 10),
          max: new Date(2026, 8, 12),
          minNights: 3,
          maxNights: 21
        });
        picker.on('change', ({ detail }) => log(`change ${stamp(detail.start)} \u2192 ${stamp(detail.end)}`));
        cleanup(() => picker.destroy());
        return picker.el;
      }
    },
    {
      title: 'As a Form field type',
      blurb: 'daterange is registered as a field type, so a reporting period is one entry in a '
        + 'fieldset and its value is a {start, end} pair in the submitted values.',
      width: '520px',
      render: ({ cleanup, log }) => {
        const form = new Form(null, {
          fieldsets: [{
            title: 'Reporting period',
            columns: 1,
            fields: {
              period: {
                type: 'daterange',
                label: 'Period',
                description: 'The value is a {start, end} pair.',
                value: { start: new Date(2026, 0, 1), end: new Date(2026, 2, 31) },
                props: { presets: true, clearable: true }
              }
            }
          }],
          actions: [{ label: 'Run report', type: 'submit', kind: 'primary' }],
          onsubmit: ({ detail }) => {
            const period = detail.values.period ?? {};
            log(`submit ${stamp(period.start)} \u2192 ${stamp(period.end)}`);
          }
        });
        cleanup(() => form.destroy());
        return form.toElement();
      }
    }
  ]
};
