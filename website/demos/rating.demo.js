import { Rating, h } from '../../src/index.js';

export default {
  title: 'Rating',
  group: 'Inputs',
  blurb: 'A star rating built as a radio group: one tab stop, arrow-key selection, optional half '
    + 'steps, and a read-only display mode.',

  examples: [
    {
      title: 'Whole and half steps',
      blurb: 'Clicking the current value clears it, because clearable defaults to true; Delete and '
        + 'Backspace do the same from the keyboard. allowHalf splits every symbol in two.',
      render: ({ cleanup, log }) => {
        const overall = new Rating(null, { value: 3, label: 'Overall satisfaction', showValue: true });
        const service = new Rating(null, { value: 3.5, allowHalf: true, showValue: true, label: 'Service quality' });
        overall.on('change', ({ detail }) => log(`satisfaction → ${detail.value || 'cleared'}`));
        service.on('change', ({ detail }) => log(`service → ${detail.value}`));
        cleanup(() => [overall, service].forEach((rating) => rating.destroy()));
        return [
          h('div', { class: 'demo-field' }, h('span', {}, 'Whole steps'), overall.toElement()),
          h('div', { class: 'demo-field' }, h('span', {}, 'Half steps'), service.toElement())
        ];
      }
    },
    {
      title: 'Named steps',
      blurb: 'labels names each position, so the control announces “High” rather than “4 of 5”. '
        + 'The hover event reports the value under the pointer before it is committed.',
      render: ({ cleanup, log }) => {
        const priority = new Rating(null, {
          value: 4,
          label: 'Priority',
          labels: ['Very low', 'Low', 'Normal', 'High', 'Critical']
        });
        priority.on('change', ({ detail }) => log(`priority → ${detail.value}`));
        priority.on('hover', ({ detail }) => detail.value !== null && log(`preview → ${detail.value}`));
        cleanup(() => priority.destroy());
        return priority.toElement();
      }
    },
    {
      title: 'Display variants',
      blurb: 'A read-only rating with a count is the shape a product page needs. icon, max, and '
        + 'size cover the rest: hearts out of three, ten small steps, or an inert control.',
      render: ({ cleanup }) => {
        const average = new Rating(null, {
          value: 4.5, allowHalf: true, readonly: true, showValue: true, count: 128,
          label: 'Average customer rating'
        });
        const hearts = new Rating(null, { value: 2, icon: 'heart', max: 3, size: 'lg', label: 'Favourite' });
        const score = new Rating(null, { value: 7, max: 10, size: 'sm', label: 'Score out of ten', showValue: true });
        const disabled = new Rating(null, { value: 2, disabled: true, label: 'Locked rating' });
        const ratings = [average, hearts, score, disabled];
        cleanup(() => ratings.forEach((rating) => rating.destroy()));
        return [
          h('div', { class: 'demo-field' }, h('span', {}, 'Read-only with a count'), average.toElement()),
          h('div', { class: 'demo-field' }, h('span', {}, 'Hearts, three of them'), hearts.toElement()),
          h('div', { class: 'demo-field' }, h('span', {}, 'Ten small steps'), score.toElement()),
          h('div', { class: 'demo-field' }, h('span', {}, 'Disabled'), disabled.toElement())
        ];
      }
    },
    {
      title: 'Programmatic control',
      render: ({ cleanup }) => {
        const rating = new Rating(null, { value: 3, label: 'Overall satisfaction', showValue: true });
        cleanup(() => rating.destroy());
        return [
          rating.toElement(),
          h('button', { type: 'button', onclick: () => rating.set(5) }, 'set(5)'),
          h('button', { type: 'button', onclick: () => rating.clear() }, 'clear()'),
          h('button', { type: 'button', onclick: () => rating.focus() }, 'focus()')
        ];
      }
    }
  ]
};
