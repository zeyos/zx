import { Form, h } from '../../src/index.js';

/**
 * A custom field adapter: any control becomes a Form field by answering these five calls.
 * @returns {import('../../src/components/field/field.js').FieldAdapter}
 */
function rangeAdapter(_field, options) {
  const input = h('input', { type: 'range', ...(options.props ?? {}) });
  return {
    el: input,
    get: () => Number(input.value),
    set: (value) => { input.value = String(value ?? 0); },
    focus: () => input.focus(),
    setDisabled: (disabled) => { input.disabled = disabled; }
  };
}

/** The record an inspector edits, keyed by field. */
const ISSUE = {
  status: 'review',
  estimate: 5,
  due: new Date(2026, 10, 12),
  logged: 210,
  labels: ['frontend', 'a11y']
};

export default {
  title: 'Form system',
  group: 'Forms',
  api: ['Form', 'Fieldset', 'Field'],
  apiImport: "import { Field, Fieldset, Form } from '@zeyos/zx';",
  blurb: 'Fieldsets of typed fields with one values object in and out \u2014 the schema-shaped way to '
    + 'build a record editor.',

  examples: [
    {
      title: 'Field types',
      blurb: 'Every built-in adapter in one fieldset. A select takes a {value: label} map rather '
        + 'than an array of objects, int and float parse grouped and comma-decimal input back to '
        + 'numbers, and columns: 2 collapses to one column through a container query \u2014 narrow the '
        + 'window to watch it.',
      width: '640px',
      render: ({ cleanup, log }) => {
        const form = new Form(null, {
          fieldsets: [{
            title: 'Contact details',
            columns: 2,
            fields: {
              name: {
                type: 'text', label: 'Name', description: 'Full display name',
                required: true, placeholder: 'Ada Lovelace'
              },
              password: { type: 'password', label: 'Portal password', value: 'analytical-engine' },
              notes: {
                type: 'textarea', label: 'Notes',
                value: 'Prefers written correspondence.', props: { rows: 3 }
              },
              active: { type: 'checkbox', label: 'Active contact', value: true },
              visits: { type: 'int', label: 'Visits', value: '12', required: true },
              revenue: {
                type: 'float', label: 'Annual revenue', value: '1.234,56',
                description: 'Decimal comma and grouped values are accepted.'
              },
              country: {
                type: 'select', label: 'Country', value: 'AT',
                options: { AT: 'Austria', DE: 'Germany', CH: 'Switzerland' }
              },
              contactMethod: {
                type: 'optionlist', label: 'Preferred contact', value: 'email',
                options: { email: 'Email', phone: 'Phone', post: 'Post' }
              }
            }
          }],
          actions: [
            { label: 'Reset', type: 'reset' },
            { label: 'Save contact', type: 'submit', kind: 'primary' }
          ],
          onchange: ({ detail }) => log(`change ${detail.id}: ${JSON.stringify(detail.value)}`),
          onsubmit: ({ detail }) => log(`submit ${JSON.stringify(detail.values)}`),
          oninvalid: ({ detail }) => log(`invalid ${JSON.stringify(detail.errors)}`)
        });
        cleanup(() => form.destroy());
        return form.toElement();
      }
    },
    {
      title: 'Quiet fields in an inspector',
      blurb: 'Inside an element with data-zx-fields="quiet" a property panel reads as values, not '
        + 'as a wall of boxes: native inputs and the composite controls — Select, NumberField, '
        + 'Datebox, DateRangeBox, Timebox, TagPicker — show no border, fill, chevron or stepper '
        + 'until you hover one, and their full field chrome and focus ring once it has focus. '
        + 'Labels are quieter than the values they name, in every form.',
      width: '600px',
      render: ({ cleanup, log }) => {
        const form = new Form(null, {
          fieldsets: [{
            title: 'Properties',
            fields: {
              status: {
                type: 'zxselect', label: 'Status', value: ISSUE.status, layout: 'inline',
                props: {
                  items: [
                    { ID: 'todo', name: 'To do' },
                    { ID: 'review', name: 'In review' },
                    { ID: 'done', name: 'Done' }
                  ],
                  filter: 'local'
                }
              },
              estimate: { type: 'number', label: 'Estimate', value: ISSUE.estimate, layout: 'inline', props: { unit: 'pt' } },
              due: { type: 'date', label: 'Due date', value: ISSUE.due, layout: 'inline' },
              logged: { type: 'time', label: 'Time logged', value: ISSUE.logged, layout: 'inline', props: { unit: 'minutes' } },
              labels: {
                type: 'tagpicker', label: 'Labels', value: ISSUE.labels, layout: 'inline',
                props: {
                  items: [
                    { ID: 'frontend', name: 'frontend' },
                    { ID: 'backend', name: 'backend' },
                    { ID: 'a11y', name: 'a11y' }
                  ]
                }
              },
              summary: { type: 'text', label: 'Summary', value: 'Quiet property panels', layout: 'inline' }
            }
          }],
          onchange: ({ detail }) => log(`change ${detail.id}: ${JSON.stringify(detail.value)}`)
        });
        cleanup(() => form.destroy());
        return h('div', { dataset: { zxFields: 'quiet' }, style: { inlineSize: '100%' } }, form.toElement());
      }
    },
    {
      title: 'Hidden, static, and custom fields',
      blurb: 'hidden carries a value through a submit without drawing anything, html renders '
        + 'display-only text (as text \u2014 never as markup), and custom takes an adapter, which is '
        + 'the extension point: any control that can answer el, get, set, focus, and setDisabled '
        + 'is a field.',
      width: '640px',
      render: ({ cleanup, log }) => {
        const form = new Form(null, {
          fieldsets: [{
            title: 'System data',
            columns: 2,
            fields: {
              recordId: { type: 'hidden', value: 'contact-1042' },
              summary: {
                type: 'html', label: 'Record status',
                value: 'This static field is display-only and safely rendered as text.'
              },
              priority: {
                type: 'custom', label: 'Priority', value: 60,
                adapter: rangeAdapter, props: { min: 0, max: 100, step: 10 }
              }
            }
          }],
          actions: [{ label: 'Submit', type: 'submit', kind: 'primary' }],
          onsubmit: ({ detail }) => log(`submit ${JSON.stringify(detail.values)}`)
        });
        cleanup(() => form.destroy());
        return form.toElement();
      }
    },
    {
      title: 'Driving the form',
      blurb: 'getValues() and setValues() move the whole record at once, which is what makes a '
        + 'Form bindable to an API response. setHighlights() marks fields after a server-side '
        + 'validation, separately from the required checks the form runs itself. Field keys are '
        + 'names, not element ids: the ids are generated per form, and idPrefix makes them '
        + 'predictable — contact-name, contact-visits — when something has to address them.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const form = new Form(null, {
          idPrefix: 'contact',
          fieldsets: [{
            title: 'Contact',
            columns: 2,
            fields: {
              name: { type: 'text', label: 'Name', value: 'Ada Lovelace' },
              visits: { type: 'int', label: 'Visits', value: 12 },
              revenue: { type: 'float', label: 'Annual revenue', value: 1234.56 }
            }
          }]
        });
        cleanup(() => form.destroy());
        return [
          form.toElement(),
          h('div', { class: 'demo-row' },
            h('button', {
              type: 'button',
              onclick: () => form.setValues({ name: 'Grace Hopper', visits: 7, revenue: 9876.5 })
            }, 'setValues(\u2026)'),
            h('button', {
              type: 'button',
              onclick: () => log(JSON.stringify(form.getValues()))
            }, 'getValues()'),
            h('button', { type: 'button', onclick: () => form.reset() }, 'reset()'),
            h('button', {
              type: 'button',
              onclick: () => log(`#${form.getField('name').controlId}`)
            }, "getField('name').controlId"),
            h('button', {
              type: 'button',
              onclick: () => form.setHighlights({
                name: 'Example danger highlight.',
                revenue: 'Review this amount.'
              })
            }, 'setHighlights(\u2026)'),
            h('button', { type: 'button', onclick: () => form.clearHighlights() }, 'clearHighlights()'))
        ];
      }
    }
  ]
};
