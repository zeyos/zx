import { MenuButton } from '../../src/index.js';

export default {
  title: 'Menu button',
  group: 'Overlays',
  blurb: 'A trigger and its menu, following the APG menu button pattern: typeahead, wrapping '
    + 'arrows, and focus returned to the trigger on close.',

  examples: [
    {
      title: 'An action menu',
      blurb: 'Items take a label, an icon, and a value. A "-" string draws a separator, disabled '
        + 'keeps an item visible but inert, and danger marks the destructive one.',
      render: ({ cleanup, log }) => {
        const menu = new MenuButton(null, {
          label: 'Record actions',
          icon: 'dots',
          items: [
            { label: 'View record', icon: 'eye', value: 'view' },
            { label: 'Reload data', icon: 'reload', value: 'reload' },
            '-',
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
        + 'ends, letters jump by typeahead, Enter or Space activates, and Escape or Tab closes and '
        + 'returns focus to the trigger.',
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
    }
  ]
};
