import { Checklist, h } from '../../src/index.js';

/** @returns {Array<{ID: number, name: string, on?: boolean}>} */
function departments() {
  return [
    { ID: 10, name: 'Administration', on: true },
    { ID: 20, name: 'Customer Service' },
    { ID: 30, name: 'Finance' },
    { ID: 40, name: 'Operations' },
    { ID: 50, name: 'Product Development' },
    { ID: 60, name: 'Sales' },
    { ID: 70, name: 'Warehouse' }
  ];
}

export default {
  title: 'Checklist',
  group: 'Inputs',
  blurb: 'A searchable list of checkboxes for picking several records at once, with a static or '
    + 'an asynchronously loaded set of items.',

  examples: [
    {
      title: 'Static searchable list',
      blurb: 'items marked on start checked. The search box filters in place, and checkAll() and '
        + 'uncheckAll() act on everything, not only on what the filter currently shows.',
      layout: 'stack',
      width: '420px',
      render: ({ cleanup, log }) => {
        const checklist = new Checklist(null, {
          items: departments(),
          onchange: ({ detail }) => log(`change values=[${detail.values.join(', ') || 'none'}]`)
        });
        cleanup(() => checklist.destroy());
        return [
          h('div', { class: 'demo-row' },
            h('button', { type: 'button', onclick: () => checklist.checkAll() }, 'checkAll()'),
            h('button', { type: 'button', onclick: () => checklist.uncheckAll() }, 'uncheckAll()')),
          checklist.toElement()
        ];
      }
    },
    {
      title: 'Asynchronous load',
      blurb: 'A load function makes the list fetch its own items, showing a busy state while the '
        + 'promise is open and emitting loaded when it settles. reload() runs it again — the hook '
        + 'for "the groups changed elsewhere".',
      layout: 'stack',
      width: '420px',
      render: ({ cleanup, log }) => {
        const checklist = new Checklist(null, {
          items: [],
          load: async () => {
            await new Promise((resolve) => setTimeout(resolve, 450));
            return departments().map((item, index) => ({ ...item, on: index === 1 }));
          },
          onloaded: ({ detail }) => log(`loaded ${detail.items.length} groups`),
          onchange: ({ detail }) => log(`change values=[${detail.values.join(', ') || 'none'}]`)
        });
        cleanup(() => checklist.destroy());
        return [
          h('button', { type: 'button', onclick: () => checklist.reload() }, 'reload()'),
          checklist.toElement()
        ];
      }
    }
  ]
};
