import { Toolbar, h } from '../../src/index.js';

export default {
  title: 'Toolbar',
  group: 'Layout',
  blurb: 'One tab stop, arrow-key navigation, and an overflow menu that swallows what no longer fits.',

  examples: [
    {
      title: 'A record action bar',
      blurb: 'Drag the handle in the bottom-right corner of the frame. As the row runs out of '
        + 'room the trailing items are hidden and mirrored into the overflow menu — choosing one '
        + 'there activates the original control, so a collapsed item behaves exactly like a '
        + 'visible one. Tab reaches the toolbar once; Arrow Left and Right move between controls, '
        + 'Home and End jump to the ends.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const toolbar = new Toolbar(null, {
          label: 'Record actions',
          items: [
            { name: 'new', label: 'New', icon: 'plus', kind: 'primary' },
            { name: 'edit', label: 'Edit', icon: 'gear' },
            { name: 'delete', label: 'Delete', icon: 'trash', kind: 'danger' },
            '-',
            { name: 'list', label: 'List', icon: 'list', kind: 'ghost', active: true },
            { name: 'cards', label: 'Cards', icon: 'square', kind: 'ghost', active: false },
            '-',
            { name: 'filter', label: 'Filter', icon: 'filter' },
            { name: 'refresh', label: 'Refresh', icon: 'reload' },
            { name: 'export', label: 'Export', icon: 'upload' },
            { name: 'print', label: 'Print', icon: 'file' },
            { name: 'settings', label: 'Settings', icon: 'settings' }
          ],
          onaction: ({ detail }) => {
            if (detail.name === 'list' || detail.name === 'cards') {
              toolbar.setActive('list', detail.name === 'list').setActive('cards', detail.name === 'cards');
            }
            log(`action: ${detail.name}`);
          }
        });
        cleanup(() => toolbar.destroy());
        return h('div', { class: 'demo-resizable' }, toolbar.toElement());
      }
    },
    {
      title: 'Alignment',
      blurb: 'align distributes the row: start (the default), end, and between. These set '
        + 'overflow: false, so they keep every item at any width.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const toolbars = ['start', 'end', 'between'].map((align) => new Toolbar(null, {
          label: `Aligned ${align}`,
          align,
          overflow: false,
          items: [
            { name: 'back', label: 'Back', icon: 'chevron-left', kind: 'ghost' },
            { name: 'save', label: 'Save', icon: 'check', kind: 'primary' },
            '-',
            { name: 'duplicate', label: 'Duplicate', icon: 'code' }
          ]
        }));
        cleanup(() => toolbars.forEach((toolbar) => toolbar.destroy()));
        return toolbars.map((toolbar, index) => h('div', { class: 'demo-field' },
          h('span', {}, ['start', 'end', 'between'][index]),
          h('div', { class: 'demo-card' }, toolbar.toElement())));
      }
    },
    {
      title: 'Dense rows and element items',
      blurb: 'dense: true tightens the gaps and drops the buttons to their small size. Any element '
        + 'can be an item — the link here is plain markup — and data-name makes it reachable '
        + 'through getItem().',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const help = h('a', {
          href: '#components/toolbar',
          'data-name': 'help',
          class: 'zx-btn',
          'data-kind': 'ghost',
          'data-size': 'sm',
          style: { textDecoration: 'none' }
        }, 'Help');

        const toolbar = new Toolbar(null, {
          label: 'Dense toolbar',
          dense: true,
          items: [
            { name: 'cut', label: 'Cut', icon: 'x', kind: 'ghost' },
            { name: 'copy', label: 'Copy', icon: 'code', kind: 'ghost' },
            { name: 'paste', label: 'Paste', icon: 'file', kind: 'ghost', disabled: true },
            '-',
            { name: 'pin', label: 'Pin', icon: 'star', kind: 'ghost', active: false },
            help
          ],
          onaction: ({ detail }) => {
            if (detail.name === 'pin') {
              toolbar.setActive('pin', toolbar.getItem('pin').getAttribute('aria-pressed') !== 'true');
            }
            log(`action: ${detail.name}`);
          }
        });
        cleanup(() => toolbar.destroy());
        return [
          toolbar.toElement(),
          h('div', { class: 'demo-row' },
            h('button', { type: 'button', onclick: () => toolbar.disable('copy') }, 'disable("copy")'),
            h('button', { type: 'button', onclick: () => toolbar.enable('paste') }, 'enable("paste")'))
        ];
      }
    }
  ]
};
