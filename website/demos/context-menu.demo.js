import { ContextMenu, Table, h } from '../../src/index.js';

export default {
  title: 'Context menu',
  group: 'Overlays',
  blurb: 'Right-click menu for a region or a row. Reachable from the keyboard too: the Menu key '
    + 'and Shift+F10 open it at whatever has focus, and closing gives focus back.',

  examples: [
    {
      title: 'A menu for a region',
      blurb: 'Attaches to an existing element and never changes it — the menu itself lives in the '
        + 'top layer. Right-click inside the panel, or focus it and press the Menu key. Escape '
        + 'and Tab close it; typing jumps to an item by its first letters.',
      render: ({ cleanup, log }) => {
        const panel = h('div', {
          class: 'demo-card',
          tabIndex: 0,
          style: 'min-block-size: 120px; display: grid; place-items: center'
        }, 'Right-click here — or focus and press the Menu key');

        const menu = new ContextMenu(panel, {
          items: [
            { label: 'Open', icon: 'folder-open', value: 'open' },
            { label: 'Duplicate', icon: 'copy', value: 'duplicate' },
            '-',
            { label: 'Export as CSV', icon: 'upload', value: 'export' },
            { label: 'Archived', value: 'archive', disabled: true },
            '-',
            { label: 'Delete', icon: 'trash', value: 'delete', danger: true }
          ],
          onselect: ({ detail }) => log(`selected ${detail.value}`)
        });
        cleanup(() => menu.destroy());
        return panel;
      }
    },
    {
      title: 'One menu, per-row items',
      blurb: 'selector delegates to matching descendants, so a table needs one instance and not '
        + 'one per row: the row that was clicked arrives with the selection as context. Passing a '
        + 'function to items builds the menu for that row — here a posted invoice cannot be '
        + 'edited, and returning an empty array would leave the platform menu alone.',
      render: ({ cleanup, log }) => {
        const table = new Table(null, {
          columns: [
            { id: 'number', label: 'Invoice' },
            { id: 'customer', label: 'Customer' },
            { id: 'status', label: 'Status' }
          ],
          data: [
            { ID: 1, number: 'INV-1042', customer: 'Nordwind GmbH', status: 'Draft' },
            { ID: 2, number: 'INV-1043', customer: 'Halbe Systeme', status: 'Posted' },
            { ID: 3, number: 'INV-1044', customer: 'Kestrel Ltd', status: 'Draft' }
          ]
        });

        const menu = new ContextMenu(table.toElement(), {
          selector: 'tbody tr',
          items: (row) => {
            const posted = row?.textContent?.includes('Posted');
            return [
              { label: 'Open invoice', icon: 'folder-open', value: 'open' },
              { label: 'Edit', icon: 'list', value: 'edit', disabled: posted },
              '-',
              { label: posted ? 'Cancel invoice' : 'Delete draft', icon: 'trash', value: 'remove', danger: true }
            ];
          },
          onselect: ({ detail }) => {
            const number = detail.context?.querySelector('td')?.textContent ?? '?';
            log(`${detail.value} on ${number}`);
          }
        });

        cleanup(() => {
          menu.destroy();
          table.destroy();
        });
        return table.toElement();
      }
    }
  ]
};
