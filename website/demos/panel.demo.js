import { MasterPanel, Panel, h } from '../../src/index.js';

export default {
  title: 'Panel',
  group: 'Layout',
  api: ['Panel', 'MasterPanel'],
  blurb: 'A raised surface with a title, an optional collapse control, header actions, and a '
    + 'footer — plus MasterPanel, its full-height variant.',

  examples: [
    {
      title: 'Collapsible and fixed',
      blurb: 'A panel collapses by default; collapsible: false keeps it permanently open, which '
        + 'is what a status card wants. open: false starts it closed.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const panels = [
          new Panel(null, {
            title: 'Account summary',
            content: h('p', { style: { margin: '0' } }, 'This raised surface starts open.')
          }),
          new Panel(null, {
            title: 'Optional details',
            content: h('p', { style: { margin: '0' } }, 'This panel starts collapsed.'),
            open: false
          }),
          new Panel(null, {
            title: 'System status',
            content: h('p', { style: { margin: '0' } }, 'All background jobs are healthy.'),
            collapsible: false
          })
        ];
        for (const panel of panels) {
          panel.on('open', () => log(`${panel.refs.title.textContent}: open`));
          panel.on('close', () => log(`${panel.refs.title.textContent}: close`));
        }
        cleanup(() => panels.forEach((panel) => panel.destroy()));
        return panels.map((panel) => panel.toElement());
      }
    },
    {
      title: 'Header actions and a footer',
      blurb: 'buttons sit at the trailing edge of the header, beside the collapse control rather '
        + 'than inside it — clicking one never collapses the panel. footer takes free content and '
        + 'footerButtons the actions that close out the panel.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const panel = new Panel(null, {
          title: 'Attachments',
          content: h('p', { style: { margin: '0' } },
            'Only the title area toggles the panel; the header actions are ordinary buttons.'),
          buttons: [
            { icon: 'reload', size: 'sm', kind: 'ghost', title: 'Refresh', onclick: () => log('refresh') },
            { label: 'Upload', icon: 'upload', size: 'sm', onclick: () => log('upload') }
          ],
          footer: h('small', {}, '3 files · 1.2 MB'),
          footerButtons: [
            { label: 'Download all', size: 'sm', onclick: () => log('download all') }
          ]
        });
        const approval = new Panel(null, {
          title: 'Approval',
          content: h('p', { style: { margin: '0' } }, 'Review the record before continuing.'),
          footer: h('small', {}, 'Last reviewed a few moments ago'),
          footerButtons: [
            { label: 'Reject', kind: 'danger', size: 'sm', onclick: () => log('rejected') },
            { label: 'Approve', kind: 'primary', size: 'sm', onclick: () => log('approved') }
          ]
        });
        cleanup(() => [panel, approval].forEach((item) => item.destroy()));
        return [panel.toElement(), approval.toElement()];
      }
    },
    {
      title: 'Programmatic control',
      blurb: 'setFooter() and setButtons() replace the chrome on a live panel, so a panel can '
        + 'change what it offers as the record it shows changes state.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const panel = new Panel(null, {
          title: 'Attachments',
          content: h('p', { style: { margin: '0' } }, 'Panel body.'),
          buttons: [{ label: 'Upload', icon: 'upload', size: 'sm', onclick: () => log('upload') }],
          footer: h('small', {}, '3 files · 1.2 MB')
        });
        cleanup(() => panel.destroy());
        return [
          panel.toElement(),
          h('div', { class: 'demo-row' },
            h('button', { type: 'button', onclick: () => panel.toggle() }, 'toggle()'),
            h('button', {
              type: 'button',
              onclick: () => panel.setFooter('Footer replaced through setFooter()')
            }, 'setFooter(…)'),
            h('button', {
              type: 'button',
              onclick: () => panel.setButtons([
                { label: 'Done', kind: 'primary', size: 'sm', onclick: () => log('done') }
              ])
            }, 'setButtons([…])'))
        ];
      }
    },
    {
      title: 'MasterPanel',
      blurb: 'The full-height variant: header and footer stay fixed while the body scrolls, and '
        + 'module names the ZeyOS module whose accent colour the panel takes.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const panels = ['projects', 'billing', 'calendar'].map((module) => new MasterPanel(null, {
          title: module[0].toUpperCase() + module.slice(1),
          module,
          content: h('div', {}, Array.from({ length: 12 }, (_, index) =>
            h('p', {}, `Record ${index + 1}: scroll this body while watching the bars.`))),
          buttons: [{ label: 'Add', kind: 'primary', size: 'sm', onclick: () => log(`${module}: add`) }],
          footer: `${module}: 12 records`
        }));
        cleanup(() => panels.forEach((panel) => panel.destroy()));
        return h('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--zx-space-4)'
          }
        }, panels.map((panel) => h('div', { style: { minInlineSize: '0', blockSize: '340px' } }, panel)));
      }
    }
  ]
};
