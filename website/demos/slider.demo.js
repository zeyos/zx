import { Form, Slider, h } from '../../src/index.js';

export default {
  title: 'Slider',
  group: 'Inputs',
  blurb: 'A bounded numeric value you set by dragging. Built on a native range input, so the whole '
    + 'keyboard map — arrows, Page Up/Down, Home, End — comes for free and so does the announcement.',

  examples: [
    {
      title: 'Value, unit, and steps',
      blurb: 'change fires when the value is committed — the pointer released, or a key pressed. '
        + 'input fires continuously while dragging, which is what a live preview wants. step '
        + 'defines the grid; the value snaps to it relative to min, so 5…95 by 10 gives 5, 15, 25.',
      render: ({ cleanup, log }) => {
        const discount = new Slider(null, { label: 'Discount', value: 12, unit: '%' });
        const rating = new Slider(null, {
          label: 'Weighting', value: 5, min: 5, max: 95, step: 10, showBounds: true
        });
        discount.on('change', ({ detail }) => log(`discount → ${detail.value}%`));
        rating.on('input', ({ detail }) => log(`weighting (dragging) → ${detail.value}`));

        const sliders = [discount, rating];
        cleanup(() => sliders.forEach((slider) => slider.destroy()));
        return h('div', { class: 'demo-stack', style: 'inline-size: 320px' },
          ...sliders.map((slider) => slider.toElement()));
      }
    },
    {
      title: 'Marks and a number box',
      blurb: 'marks label positions under the track — pass numbers, or {value, label} to name '
        + 'them. showInput adds a number box for entering a value precisely instead of aiming at '
        + 'it, and the two stay in step. formatValue owns the readout.',
      render: ({ cleanup }) => {
        const risk = new Slider(null, {
          label: 'Risk tolerance', value: 50, step: 25,
          marks: [
            { value: 0, label: 'None' }, { value: 25, label: 'Low' },
            { value: 50, label: 'Medium' }, { value: 75, label: 'High' },
            { value: 100, label: 'Full' }
          ]
        });
        const budget = new Slider(null, {
          label: 'Budget', value: 2500, min: 0, max: 10000, step: 250, showInput: true,
          formatValue: (value) => `${value.toLocaleString('en-GB')} €`
        });
        const sliders = [risk, budget];
        cleanup(() => sliders.forEach((slider) => slider.destroy()));
        return h('div', { class: 'demo-stack', style: 'inline-size: 360px' },
          ...sliders.map((slider) => slider.toElement()));
      }
    },
    {
      title: 'Fine steps, disabled, read-only',
      blurb: 'A fractional step snaps without floating-point drift: 0.1 gives 0.3, not '
        + '0.30000000000000004. read-only keeps the value focusable and announced but refuses '
        + 'every edit, pointer and keyboard alike — disabled removes it from the tab order.',
      render: ({ cleanup }) => {
        const rate = new Slider(null, {
          label: 'Interest rate', value: 3.5, min: 0, max: 10, step: 0.1, unit: ' %', size: 'sm'
        });
        const locked = new Slider(null, { label: 'Agreed rate', value: 7, unit: ' %', readonly: true });
        const off = new Slider(null, { label: 'Unavailable', value: 30, disabled: true });
        const sliders = [rate, locked, off];
        cleanup(() => sliders.forEach((slider) => slider.destroy()));
        return h('div', { class: 'demo-stack', style: 'inline-size: 320px' },
          ...sliders.map((slider) => slider.toElement()));
      }
    },
    {
      title: 'As a form field',
      blurb: 'Registered as the slider field type, so a Form declares one like any other field. '
        + 'props are handed to the Slider itself; the Field owns the label, so the control keeps '
        + 'its own only for assistive technology.',
      render: ({ cleanup, log }) => {
        const form = new Form(null, {
          fieldsets: [{
            title: 'Campaign budget',
            fields: {
              name: { type: 'text', label: 'Campaign', value: 'Autumn promotion' },
              share: {
                type: 'slider', label: 'Budget share', value: 40,
                props: { unit: '%', step: 5, showBounds: true }
              }
            }
          }],
          actions: [{ label: 'Save', type: 'submit', kind: 'primary' }],
          onsubmit: ({ detail }) => log(`submit ${JSON.stringify(detail.values)}`)
        });
        cleanup(() => form.destroy());
        return h('div', { style: 'inline-size: 360px' }, form.toElement());
      }
    }
  ]
};
