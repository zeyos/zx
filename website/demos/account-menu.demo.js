import { AccountMenu, h } from '../../src/index.js';

const ACTIONS = [
  { label: 'Account settings', icon: 'gear', value: 'settings' },
  { label: 'Language', icon: 'book', value: 'language' },
  '-',
  { label: 'About ZeyOS', icon: 'info', value: 'about' },
  { label: 'Sign out', icon: 'lock', value: 'logout', danger: true }
];

export default {
  title: 'AccountMenu',
  group: 'Identity',
  blurb: 'A single accessible Avatar trigger and grouped account-action popup; identity, permissions, preferences, and sign-out stay application-owned.',
  examples: [
    {
      title: 'Expanded identity trigger',
      blurb: 'The popup repeats identity and emits action values. Zx does not decide which actions a user may see or execute.',
      width: '360px',
      render: ({ cleanup, log }) => {
        const menu = new AccountMenu(null, {
          account: { name: 'Ada Lovelace', secondary: 'ada@example.test', status: 'online', statusLabel: 'Online' },
          items: ACTIONS,
          placement: 'bottom-start',
          onselect: ({ detail }) => log(`select ${detail.value}`)
        });
        cleanup(() => menu.destroy());
        return menu.toElement();
      }
    },
    {
      title: 'Compact account trigger',
      blurb: 'The visual trigger is avatar-only, while its programmatic name still identifies the account menu and user.',
      render: ({ cleanup }) => {
        const menu = new AccountMenu(null, {
          compact: true,
          account: { name: 'Grace Hopper', secondary: 'grace@example.test' },
          items: ACTIONS,
          placement: 'right-end'
        });
        cleanup(() => menu.destroy());
        return h('div', { style: 'padding: var(--zx-space-6)' }, menu.toElement());
      }
    }
  ]
};
