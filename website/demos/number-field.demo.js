import { NumberField, h } from '../../src/index.js';

export default {
  title: 'Number field',
  group: 'Inputs',
  blurb: 'A spinbutton with step buttons: bounded ranges, fractional steps, units, and wrapping.',

  examples: [
    {
      title: 'A bounded quantity',
      blurb: 'min and max clamp both typing and stepping. The step buttons are pointer '
        + 'affordances only — they stay out of the tab order, because the input itself is the '
        + 'spinbutton.',
      width: '220px',
      render: ({ cleanup, log }) => {
        const quantity = new NumberField(null, {
          value: 1,
          min: 1,
          max: 999,
          onchange: ({ detail }) => log(`quantity → ${detail.value}`)
        });
        cleanup(() => quantity.destroy());
        return quantity.toElement();
      }
    },
    {
      title: 'Fractional steps and units',
      blurb: 'step accepts fractions, unit prints a suffix inside the field, and group: true adds '
        + 'the locale’s thousands separators while the field is not being edited.',
      render: ({ cleanup }) => {
        const price = new NumberField(null, { value: 1249.9, min: 0, step: 0.01, group: true, unit: '€' });
        const discount = new NumberField(null, { value: 5, min: 0, max: 100, step: 2.5, unit: '%' });
        cleanup(() => [price, discount].forEach((numberField) => numberField.destroy()));
        return [
          h('label', { class: 'demo-field' }, h('span', {}, 'Price'), price.toElement()),
          h('label', { class: 'demo-field' }, h('span', {}, 'Discount'), discount.toElement())
        ];
      }
    },
    {
      title: 'Empty, wrapping, and inert',
      blurb: 'A field that starts empty steps to its minimum first. A wrapping field jumps from '
        + 'its maximum back to its minimum, which is what hour and minute pickers want.',
      render: ({ cleanup }) => {
        const budget = new NumberField(null, { value: null, min: 10, max: 500, step: 10, placeholder: 'Optional' });
        const hour = new NumberField(null, { value: 9, min: 0, max: 23, wrap: true });
        const disabled = new NumberField(null, { value: 42, disabled: true });
        const readonly = new NumberField(null, { value: 7, readonly: true });
        const fields = [budget, hour, disabled, readonly];
        cleanup(() => fields.forEach((numberField) => numberField.destroy()));
        return [
          h('label', { class: 'demo-field' }, h('span', {}, 'Budget — starts empty'), budget.toElement()),
          h('label', { class: 'demo-field' }, h('span', {}, 'Hour — wraps 0–23'), hour.toElement()),
          h('label', { class: 'demo-field' }, h('span', {}, 'Disabled'), disabled.toElement()),
          h('label', { class: 'demo-field' }, h('span', {}, 'Read-only'), readonly.toElement())
        ];
      }
    },
    {
      title: 'Programmatic control',
      blurb: 'stepUp() moves by whole steps, set(null) empties the field, and setRange() moves the '
        + 'bounds under a value that is already there.',
      render: ({ cleanup, log }) => {
        const field = new NumberField(null, { value: 4, min: 0, max: 999 });
        field.on('change', ({ detail }) => log(`change → ${detail.value ?? 'empty'}`));
        cleanup(() => field.destroy());
        return [
          h('div', { style: { inlineSize: '160px' } }, field.toElement()),
          h('button', { type: 'button', onclick: () => field.stepUp(5) }, 'stepUp(5)'),
          h('button', { type: 'button', onclick: () => field.set(null) }, 'set(null)'),
          h('button', { type: 'button', onclick: () => field.setRange(0, 100) }, 'setRange(0, 100)')
        ];
      }
    }
  ]
};
