import {
  Form, Groupbox, Message, NavigationBar, Panel, Select, Toggle, button, h
} from '../../src/index.js';

const GROUPS = [
  { ID: 12, name: 'Sales' },
  { ID: 13, name: 'Service' },
  { ID: 14, name: 'Finance' },
  { ID: 15, name: 'Management' }
];

const SECTIONS = [
  { name: 'profile', title: 'Profile' },
  { name: 'notifications', title: 'Notifications' },
  { name: 'sharing', title: 'Sharing' },
  { name: 'api', title: 'API access' }
];

const NOTIFICATIONS = [
  { id: 'assigned', label: 'A record is assigned to me', on: true },
  { id: 'mention', label: 'Someone mentions me in a note', on: true },
  { id: 'overdue', label: 'An invoice becomes overdue', on: true },
  { id: 'digest', label: 'Weekly summary of my open items', on: false },
  { id: 'product', label: 'Product announcements', on: false }
];

export default {
  title: 'Settings workspace',
  group: 'Applications',
  blurb: 'A preferences screen: a navigation bar selects the section, and each section is a stack '
    + 'of grouped controls with its own save action.',

  /**
   * Mounts a settings screen driven by NavigationBar, Groupbox, Form, Toggle, and Select.permission().
   * @param {HTMLElement} container Documentation stage.
   * @returns {void}
   */
  mount(container) {
    const body = h('div', { class: 'settings-body' });

    const navigation = new NavigationBar(null, {
      title: 'Settings',
      items: SECTIONS,
      active: 'profile',
      actions: [
        { label: 'Help', icon: 'info', onclick: () => Message.info('Opening the settings guide.') }
      ],
      onchange: (event) => showSection(event.detail.name)
    });

    const panel = new Panel(null, {
      title: 'Preferences',
      content: body,
      collapsible: false,
      footer: 'Changes apply to your user account only.'
    });

    container.append(h('div', { class: 'layout-frame' },
      h('div', { class: 'layout-stack', style: { padding: 'var(--zx-space-4)' } },
        navigation.toElement(),
        panel.toElement())));

    showSection('profile');

    /**
     * Swaps the section body.
     * @param {string} name Section name from `SECTIONS`.
     * @returns {void}
     */
    function showSection(name) {
      panel.setTitle(SECTIONS.find((section) => section.name === name).title);
      body.replaceChildren(...({
        profile: profileSection,
        notifications: notificationsSection,
        sharing: sharingSection,
        api: apiSection
      }[name]()));
    }

    /** @returns {Node[]} */
    function profileSection() {
      const form = new Form(null, {
        fieldsets: [
          {
            title: 'Personal details',
            columns: 2,
            fields: {
              name: { type: 'text', label: 'Display name', value: 'Nadine Roth', required: true },
              email: { type: 'text', label: 'E-mail', value: 'nadine.roth@example.com', required: true },
              phone: { type: 'text', label: 'Phone', value: '+43 512 990 12' },
              role: { type: 'text', label: 'Job title', value: 'Account manager' }
            }
          },
          {
            title: 'Regional',
            columns: 2,
            fields: {
              // A Field of type `select` takes a `{value: label}` map.
              language: {
                type: 'select',
                label: 'Language',
                value: 'en',
                options: { en: 'English', de: 'Deutsch', fr: 'Français' }
              },
              dateFormat: {
                type: 'select',
                label: 'Date format',
                value: 'iso',
                options: { iso: '2026-08-14', eu: '14.08.2026', us: '08/14/2026' }
              },
              startPage: {
                type: 'select',
                label: 'Start page',
                value: 'overview',
                options: { overview: 'Overview', inbox: 'Inbox', tasks: 'My tasks' }
              },
              compact: { type: 'toggle', label: 'Compact density', value: false }
            }
          }
        ],
        actions: [
          { label: 'Save profile', kind: 'primary', icon: 'check', onClick: () => form.submit() },
          { label: 'Reset', kind: 'ghost', onClick: () => form.reset() }
        ],
        onsubmit: (event) => Message.success(`Profile saved for ${event.detail.values.name}.`)
      });
      return [form.toElement()];
    }

    /** @returns {Node[]} */
    function notificationsSection() {
      const state = new Map(NOTIFICATIONS.map((entry) => [entry.id, entry.on]));
      const toggles = NOTIFICATIONS.map((entry) => new Toggle(null, {
        label: entry.label,
        checked: entry.on,
        onchange: (event) => state.set(entry.id, event.detail.checked)
      }));

      const emailGroup = new Groupbox(null, { title: 'E-mail notifications', open: true });
      emailGroup.setContent(h('div', { class: 'layout-stack' },
        toggles.map((toggle) => toggle.toElement())));

      const quietGroup = new Groupbox(null, { title: 'Quiet hours', open: false });
      quietGroup.setContent(h('div', { class: 'layout-stack' },
        h('p', { class: 'layout-hint' },
          'Notifications are held back during these hours and delivered afterwards.'),
        h('div', { class: 'layout-toolbar' },
          h('label', {}, 'From ', h('input', { type: 'time', value: '19:00' })),
          h('label', {}, 'To ', h('input', { type: 'time', value: '07:30' })))
      ));

      return [
        emailGroup.toElement(),
        quietGroup.toElement(),
        h('div', { class: 'layout-toolbar' },
          button({
            label: 'Save notifications',
            kind: 'primary',
            icon: 'check',
            onclick: () => {
              const active = [...state.values()].filter(Boolean).length;
              Message.success(`${active} of ${state.size} notifications enabled.`);
            }
          }))
      ];
    }

    /** @returns {Node[]} */
    function sharingSection() {
      const permission = Select.permission(null, {
        value: 13,
        groups: GROUPS,
        onchange: (event) => {
          const value = event.detail.value;
          const label = value === false ? 'Private'
            : value === true ? 'Everyone'
              : GROUPS.find((group) => group.ID === value)?.name;
          note.textContent = `New records default to: ${label}.`;
        }
      });
      const note = h('p', { class: 'layout-hint' }, 'New records default to: Service.');

      const group = new Groupbox(null, { title: 'Default record visibility', open: true });
      group.setContent(h('div', { class: 'layout-stack' },
        h('p', { class: 'layout-hint' },
          'Applies to every record you create. Individual records can still be shared separately.'),
        permission.toElement(),
        note));

      return [group.toElement()];
    }

    /** @returns {Node[]} */
    function apiSection() {
      const token = h('code', {}, 'zx_live_••••••••••••••••••••7f31');
      const group = new Groupbox(null, { title: 'Personal access token', open: true });
      group.setContent(h('div', { class: 'layout-stack' },
        h('p', { class: 'layout-hint' },
          'Used for @zeyos/client requests made on your behalf. Rotating invalidates the old token '
          + 'immediately.'),
        h('div', { class: 'layout-toolbar' },
          token,
          h('span', { class: 'layout-toolbar__spacer' }),
          button({
            label: 'Rotate token',
            kind: 'danger',
            icon: 'reload',
            onclick: () => Message.warning('Rotating would invalidate every existing integration.')
          }))
      ));

      const scopes = new Groupbox(null, { title: 'Scopes', open: true });
      scopes.setContent(h('ul', { class: 'activity-list' },
        ['transactions:read', 'transactions:write', 'accounts:read', 'schema:read']
          .map((scope) => h('li', {},
            h('span', { class: 'activity-dot', 'aria-hidden': 'true' }),
            h('code', {}, scope),
            h('span', { class: 'activity-time' }, 'granted')))
      ));

      return [group.toElement(), scopes.toElement()];
    }
  }
};
