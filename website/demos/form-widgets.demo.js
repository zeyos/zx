import { Form, h } from '../../src/index.js';

export default {
  title: 'Form widgets',
  group: 'Forms',
  api: ['Form'],
  blurb: 'The field types backed by a whole Zx component rather than a native input \u2014 what turns '
    + 'a Form into a real record editor.',

  examples: [
    {
      title: 'Component-backed field types',
      blurb: 'zxselect, checklist, date, month, datetime, time, valuelist, multivalueeditor, '
        + 'upload, and toggle. props is passed straight to the component behind the field, so a '
        + 'field is configured exactly as the component would be on its own \u2014 and the value the '
        + 'form reports is the component\u2019s own value type, not a string.',
      width: '640px',
      render: ({ cleanup, log }) => {
        const form = new Form(null, {
          fieldsets: [{
            title: 'Component-backed fields',
            columns: 2,
            fields: {
              status: {
                type: 'zxselect', label: 'Status', value: 'open',
                props: {
                  items: [
                    { ID: 'open', name: 'Open' },
                    { ID: 'review', name: 'In review' },
                    { ID: 'done', name: 'Done' }
                  ],
                  filter: 'local',
                  clearable: true
                }
              },
              permissions: {
                type: 'checklist', label: 'Permissions', value: ['read'],
                props: {
                  height: 160,
                  items: [
                    { ID: 'read', name: 'Read' },
                    { ID: 'write', name: 'Write' },
                    { ID: 'approve', name: 'Approve' }
                  ]
                }
              },
              dueDate: { type: 'date', label: 'Due date', value: new Date(2026, 6, 19), props: { clearable: true } },
              billingMonth: { type: 'month', label: 'Billing month', value: new Date(2026, 6, 1) },
              appointment: { type: 'datetime', label: 'Appointment', value: new Date(2026, 6, 19, 9, 30) },
              effort: {
                type: 'time', label: 'Effort', value: 90,
                description: 'A numeric duration in the configured unit.',
                props: { unit: 'minutes', signed: true }
              },
              tags: {
                type: 'valuelist', label: 'Tags', value: ['forms', 'widgets'],
                props: { placeholder: 'Type a tag and press Enter' }
              },
              reviewers: {
                type: 'multivalueeditor', label: 'Reviewers', value: ['Ada', 'Margaret'],
                props: { addLabel: 'Add reviewer' }
              },
              attachment: {
                type: 'upload', label: 'Attachment', value: null,
                description: 'Upload values stay null \u2014 the server owns the persisted value.',
                props: { autoUpload: false, preview: true }
              }
            }
          }],
          onchange: ({ detail }) => log(`change ${detail.id} = ${JSON.stringify(detail.value)}`)
        });
        cleanup(() => form.destroy());
        return form.toElement();
      }
    },
    {
      title: 'Round-tripping the values',
      blurb: 'getValues() and setValues() carry Dates, arrays, and numbers as themselves, so a '
        + 'record loaded from the API and written back keeps its types. setDisabled() on a field '
        + 'reaches the component behind it \u2014 the toggle here drives every other widget.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const form = new Form(null, {
          fieldsets: [{
            title: 'Record',
            columns: 2,
            fields: {
              status: {
                type: 'zxselect', label: 'Status', value: 'open',
                props: { items: [{ ID: 'open', name: 'Open' }, { ID: 'done', name: 'Done' }], clearable: true }
              },
              dueDate: { type: 'date', label: 'Due date', value: new Date(2026, 6, 19) },
              tags: { type: 'valuelist', label: 'Tags', value: ['forms', 'widgets'] },
              disableAll: {
                type: 'toggle', label: 'Disable all widgets', value: false,
                props: { label: 'Disabled' }
              }
            }
          }]
        });

        const setDisabled = (disabled) => {
          for (const id of ['status', 'dueDate', 'tags']) form.getField(id)?.setDisabled(disabled);
        };
        form.on('change', ({ detail }) => {
          if (detail.id === 'disableAll') setDisabled(Boolean(detail.value));
          log(`change ${detail.id} = ${JSON.stringify(detail.value)}`);
        });
        form.getField('status')?.setHighlight('A highlight on a widget field.', 'warning');

        cleanup(() => form.destroy());
        return [
          form.toElement(),
          h('div', { class: 'demo-row' },
            h('button', { type: 'button', onclick: () => log(JSON.stringify(form.getValues())) }, 'getValues()'),
            h('button', {
              type: 'button',
              onclick: () => {
                form.setValues({
                  status: 'done',
                  dueDate: new Date(2026, 9, 20),
                  tags: ['adapter', 'round-trip'],
                  disableAll: false
                }, { silent: true });
                setDisabled(false);
                log(`setValues() round-trip \u2192 ${JSON.stringify(form.getValues())}`);
              }
            }, 'setValues(\u2026, {silent: true})'),
            h('button', { type: 'button', onclick: () => form.clearHighlights() }, 'clearHighlights()'))
        ];
      }
    }
  ]
};
