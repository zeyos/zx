import { Datebox, DateTimeBox, h } from '../../src/index.js';

export default {
  title: 'Datebox',
  group: 'Inputs',
  api: ['Datebox', 'DateTimeBox'],
  blurb: 'A text date field: it parses what the reader types against a strftime-style format, and '
    + 'keeps unparseable text on screen instead of silently discarding it.',

  examples: [
    {
      title: 'Formats',
      blurb: 'format is a strftime pattern, defaulting to %d.%m.%Y. DateTimeBox is the same '
        + 'component with the time appended, so one field covers both cases.',
      render: ({ cleanup, log }) => {
        const standard = new Datebox(null, { value: new Date(2026, 6, 17) });
        const datetime = DateTimeBox(null, { value: new Date(2026, 6, 17, 14, 35) });
        const us = new Datebox(null, { value: '07/17/2026', format: '%m/%d/%Y' });
        for (const [name, box] of Object.entries({ default: standard, datetime, us })) {
          box.on('change', ({ detail }) => log(`${name} change \u2192 ${detail.date?.toISOString() ?? 'null'}`));
        }
        cleanup(() => [standard, datetime, us].forEach((box) => box.destroy()));
        return [
          h('label', { class: 'demo-field' }, h('span', {}, '%d.%m.%Y'), standard.el),
          h('label', { class: 'demo-field' }, h('span', {}, '%d.%m.%Y %H:%M'), datetime.el),
          h('label', { class: 'demo-field' }, h('span', {}, '%m/%d/%Y'), us.el)
        ];
      }
    },
    {
      title: 'Invalid input',
      blurb: 'Type an impossible date \u2014 31.02.2026 \u2014 then blur or press Enter. The field emits '
        + 'invalid and leaves the text editable, because throwing away what someone typed is the '
        + 'one thing a date field must not do.',
      width: '240px',
      render: ({ cleanup, log }) => {
        const box = new Datebox(null, { placeholder: 'Try 31.02.2026' });
        box.on('invalid', ({ detail }) => log(`invalid: kept \u201c${detail.text}\u201d for correction`));
        cleanup(() => box.destroy());
        return box.el;
      }
    },
    {
      title: 'Unix seconds',
      blurb: 'The value accepts a Date, a formatted string, or Unix seconds, and get("seconds") '
        + 'reads it back in the form the ZeyOS API stores. clearable adds the button that empties '
        + 'the field to null.',
      layout: 'stack',
      width: '300px',
      render: ({ cleanup, log }) => {
        const box = new Datebox(null, { value: 1784296800, clearable: true });
        box.on('change', () => log(`get('seconds') = ${box.get('seconds')}`));
        cleanup(() => box.destroy());
        return [
          box.el,
          h('div', { class: 'demo-row' },
            h('button', { type: 'button', onclick: () => log(`get('seconds') = ${box.get('seconds')}`) },
              "get('seconds')"),
            h('button', { type: 'button', onclick: () => box.set(1798761600) }, 'set(1798761600)'))
        ];
      }
    }
  ]
};
