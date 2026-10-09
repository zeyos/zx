import { Dialog, MenuButton, h } from '../../src/index.js';

// Rows of a list that open one shared menu from the keyboard.
function invoiceNumbers() {
  return ['INV-1041', 'INV-1042', 'INV-1043'];
}

export default {
  title: 'Menu button',
  group: 'Overlays',
  blurb: 'A trigger and its menu, following the APG menu button pattern: typeahead, wrapping '
    + 'arrows, and focus returned to the trigger on close.',

  examples: [
    {
      title: 'An action menu',
      blurb: 'The shared action model supports headings, native links, descriptions, badges, '
        + 'shortcuts, checked items, separators, disabled actions, and destructive emphasis.',
      render: ({ cleanup, log }) => {
        const menu = new MenuButton(null, {
          label: 'Record actions',
          icon: 'dots',
          items: [
            { type: 'heading', label: 'Record' },
            {
              label: 'View record', icon: 'eye', value: 'view',
              description: 'Open the full record workspace', shortcut: 'Enter'
            },
            { label: 'Reload data', icon: 'reload', value: 'reload', badge: 2 },
            { label: 'Pinned', value: 'pinned', role: 'menuitemcheckbox', checked: true },
            '-',
            { label: 'Open documentation', icon: 'link', href: '#menu-button' },
            { label: 'Export unavailable', icon: 'upload', value: 'export', disabled: true },
            '-',
            { label: 'Delete record', icon: 'trash', value: 'delete', danger: true }
          ]
        });
        menu.on('open', () => log('open'));
        menu.on('close', () => log('close'));
        menu.on('select', ({ detail }) => log(`select: ${detail.value} (${detail.item.label})`));
        cleanup(() => menu.destroy());
        return menu.toElement();
      }
    },
    {
      title: 'Keyboard',
      blurb: 'Focus the trigger, then: Arrow Down, Enter, or Space opens at the first item and '
        + 'Arrow Up opens at the last. Inside the menu, arrows wrap, Home and End jump to the '
        + 'ends, letters jump by typeahead, Enter or Space activates and returns focus to the '
        + 'trigger, Escape closes and returns focus to the trigger, and Tab closes.',
      render: ({ cleanup, log }) => {
        const menu = new MenuButton(null, {
          label: 'Try the keyboard',
          items: [
            { label: 'Approve', icon: 'check', value: 'approve' },
            { label: 'Assign', icon: 'gear', value: 'assign' },
            { label: 'Archive', icon: 'folder', value: 'archive' },
            { label: 'Audit trail', icon: 'list', value: 'audit' }
          ]
        });
        menu.on('select', ({ detail }) => log(`select: ${detail.value}`));
        cleanup(() => menu.destroy());
        return menu.toElement();
      }
    },
    {
      title: 'Where focus goes after a choice',
      blurb: 'Choosing an item puts focus back on the trigger before the item runs, so the '
        + 'confirmation that Delete opens returns there when it closes. focusFirst({ returnFocus }) '
        + 'sends it elsewhere for one opening: Tab to a row and press M to open the same menu for '
        + 'it — after a choice or Escape, focus is back on the row.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const menu = new MenuButton(null, {
          label: 'Invoice actions',
          items: [
            { label: 'Send reminder', value: 'remind' },
            { label: 'Mark as paid', value: 'paid' },
            '-',
            {
              label: 'Delete…', value: 'delete', danger: true,
              onselect: async () => log(`confirmed: ${await Dialog.confirm({
                title: 'Delete invoice?', message: 'The invoice moves to the bin.', okLabel: 'Delete', danger: true
              })}`)
            }
          ]
        });
        menu.on('select', ({ detail }) => {
          log(`${detail.value}; focus is on ${document.activeElement?.textContent}`);
        });
        const rows = invoiceNumbers().map((number) => {
          const row = h('button', {
            type: 'button',
            onkeydown: (event) => {
              if (event.key !== 'm' && event.key !== 'M') return;
              event.preventDefault();
              menu.focusFirst({ returnFocus: row });
            }
          }, number);
          return row;
        });
        cleanup(() => menu.destroy());
        return [menu.toElement(), h('div', { class: 'demo-row' }, ...rows)];
      }
    }
  ]
};
