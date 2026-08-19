import { Timebox, h } from '../../src/index.js';

export default {
  title: 'Timebox',
  group: 'Inputs',
  blurb: 'A duration field. The value is a plain number in the unit you name; the display is the '
    + 'h:mm the reader expects.',

  examples: [
    {
      title: 'Units',
      blurb: 'unit decides what the number means \u2014 95 minutes shows as 1:35. With seconds: true '
        + 'the field gains a seconds part and durations past 24 hours keep counting up rather '
        + 'than wrapping, because this measures elapsed time, not a clock.',
      render: ({ cleanup, log }) => {
        const minutes = new Timebox(null, { value: 95, unit: 'minutes' });
        const seconds = new Timebox(null, { value: 90061, unit: 'seconds', seconds: true });
        minutes.on('change', ({ detail }) => log(`minutes \u2192 ${detail.value}`));
        seconds.on('change', ({ detail }) => log(`seconds \u2192 ${detail.value}`));
        cleanup(() => [minutes, seconds].forEach((box) => box.destroy()));
        return [
          h('label', { class: 'demo-field' }, h('span', {}, "unit: 'minutes'"), minutes.el),
          h('label', { class: 'demo-field' }, h('span', {}, "unit: 'seconds', seconds: true"), seconds.el)
        ];
      }
    },
    {
      title: 'Signed durations',
      blurb: 'signed: true allows a negative value, for a flexitime balance or a correction '
        + 'against a booked total.',
      width: '240px',
      render: ({ cleanup, log }) => {
        const box = new Timebox(null, { value: -90, unit: 'minutes', signed: true });
        box.on('change', ({ detail }) => log(`change \u2192 ${detail.value} minutes`));
        cleanup(() => box.destroy());
        return box.el;
      }
    }
  ]
};
