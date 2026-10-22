import {
  Avatar, CopyInput, Dialog, Form, InlineLoading, Select, TimePicker, Toggle,
  button, formatDate, formatRelativeTime, h, uid
} from '../../src/index.js';
import {
  DATE, adaptiveShell, disposer, later, layoutContext, modShortcut, paneHeader, renderScope, shortcuts,
  suiteNav, toaster, unavailable, unavailablePane
} from './kit.js';
import { ME, NOW, person } from './fixtures.js';

/** The settings' sections: the signed-in user's own, then the workspace's. */
const NAVIGATION = {
  personal: [
    { id: 'profile', label: 'Profile', icon: 'user' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'sharing', label: 'Sharing', icon: 'share-nodes' },
    { id: 'api', label: 'API access', icon: 'key' }
  ],
  workspace: [
    { id: 'general', label: 'General', icon: 'building' },
    { id: 'members', label: 'Members', icon: 'users' },
    // Not `billing`: the navigation also holds the suite's Billing module under that id.
    { id: 'workspace-billing', label: 'Billing', icon: 'credit-card' }
  ]
};

/** E-mail notifications and whether each one is on. */
const NOTIFICATIONS = [
  { id: 'assigned', label: 'Assigned to me', text: 'A record or a task is assigned to you.', on: true },
  { id: 'mentions', label: 'Mentions', text: 'Someone mentions you in a note or a comment.', on: true },
  { id: 'overdue', label: 'Overdue invoices', text: 'An invoice you own passes its due date.', on: true },
  { id: 'digest', label: 'Weekly summary', text: 'Your open items, every Monday morning.', on: false },
  { id: 'product', label: 'Product news', text: 'New features and planned maintenance.', on: false }
];

/** The teams a record can be shared with. */
const GROUPS = [
  { ID: 12, name: 'Sales' },
  { ID: 13, name: 'Support' },
  { ID: 14, name: 'Finance' },
  { ID: 15, name: 'Operations' },
  { ID: 16, name: 'Engineering' }
];

/** What the personal access token may do. */
const SCOPES = [
  { id: 'records-read', label: 'Read records', text: 'Contacts, companies, and their activity.', on: true },
  { id: 'records-write', label: 'Write records', text: 'Create and change contacts and companies.', on: true },
  { id: 'invoices-read', label: 'Read invoices', text: 'Invoices, credit notes, and payments.', on: true },
  { id: 'webhooks', label: 'Manage webhooks', text: 'Subscribe integrations to changes.', on: false }
];

/** The token in use when the settings open: only its last characters are ever shown again. */
const TOKEN = { last: '7f31', created: new Date(2026, 2, 12), used: new Date(2026, 9, 8, 8, 12) };

/** The profile's fields, by fieldset. */
const PROFILE = {
  details: {
    name: { type: 'text', label: 'Display name', required: true },
    email: { type: 'text', label: 'E-mail', required: true },
    phone: { type: 'text', label: 'Phone' },
    role: { type: 'text', label: 'Job title' }
  },
  region: {
    language: { type: 'select', label: 'Language', options: { en: 'English', de: 'Deutsch', fr: 'Français' } },
    dateFormat: {
      type: 'select', label: 'Date format',
      options: { eu: '08.10.2026', iso: '2026-10-08', long: '8 October 2026' }
    },
    startPage: {
      type: 'select', label: 'Start page',
      options: { dashboard: 'Dashboard', inbox: 'Inbox', tasks: 'My tasks' }
    },
    weekStart: { type: 'select', label: 'Weeks start on', options: { 1: 'Monday', 0: 'Sunday' } }
  }
};

/**
 * A titled group of settings: a heading and a sentence on one side, its controls on the other.
 * @param {string} title
 * @param {string} text
 * @param {...(Node|null)} content
 * @returns {HTMLElement}
 */
function settingsGroup(title, text, ...content) {
  return h('section', { class: 'settings__group', 'aria-label': title },
    h('div', { class: 'settings__group-head' }, h('h3', { class: 'settings__group-title' }, title), h('p', { class: 'meta' }, text)),
    h('div', { class: 'form-sections settings__group-body' }, content));
}

/**
 * One setting: its name and what it does, and the switch that changes it. The switch is named and
 * described by the text beside it.
 * @param {string} prefix Unique per mount, for the ids that tie the text to the switch.
 * @param {{id: string, label: string, text: string}} entry
 * @param {Toggle} toggle
 * @returns {HTMLElement}
 */
function settingsRow(prefix, entry, toggle) {
  const id = `${prefix}-${entry.id}`;
  toggle.el.setAttribute('aria-labelledby', `${id}-label`);
  toggle.el.setAttribute('aria-describedby', `${id}-text`);
  return h('div', { class: 'settings__row' },
    h('span', { class: 'settings__row-text' },
      h('span', { class: 'settings__row-label', id: `${id}-label` }, entry.label),
      h('span', { class: 'meta', id: `${id}-text` }, entry.text)),
    toggle.toElement());
}

export default {
  title: 'Settings workspace',
  category: 'Pattern',
  blurb: 'Personal settings in sections — profile, notifications, sharing, an API token — saved together.',
  components: [
    'Toggle', 'Form', 'Select', 'TimePicker', 'CopyInput', 'Avatar', 'InlineLoading', 'Dialog', 'AppSidebar',
    'ModuleBar', 'AccountMenu'
  ],

  /**
   * Mounts the settings: the sections in the navigation column and the open section's groups,
   * with one save for everything changed.
   * @param {HTMLElement} container Gallery stage.
   * @param {Partial<import('./kit.js').LayoutContext>} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const prefix = uid('settings');
    const me = person(ME);
    const state = { section: 'profile', dirty: new Set(), photo: /** @type {string|null} */ (null), token: { ...TOKEN } };
    // The copy box exists only while a new token is on show.
    const tokenParts = renderScope(context);
    let cancelSave = () => {};

    // ---------------------------------------------------------------- navigation column
    const entry = (item) => ({ ...item, invoke: () => open(item.id) });
    // The suite's navigation: the settings' sections as Settings' own menu, beside every other
    // module of the suite. The account menu's Profile opens the Profile section.
    const nav = suiteNav(context, {
      module: 'settings',
      menu: [
        { section: true, label: 'Personal', children: NAVIGATION.personal.map(entry) },
        { section: true, label: 'Workspace', children: NAVIGATION.workspace.map(entry) }
      ],
      active: state.section,
      account: {
        items: [
          { label: 'Profile', value: 'profile', icon: 'user' },
          '-',
          { label: 'Sign out', value: 'sign-out', icon: 'power-off' }
        ],
        onselect: (event) => (event.detail.item.value === 'profile'
          ? open('profile')
          : notify(unavailable(event.detail.item.label), 'info'))
      }
    });

    const root = h('div', { class: 'settings shell' }, nav.column);
    // Narrow, the sections become a drawer opened from the page header.
    const shell = adaptiveShell(root, context, { navLabel: 'Open settings sections' });
    const notify = toaster(context, root);

    // ------------------------------------------------------------------- header
    const title = h('span');
    const saveState = keep(new InlineLoading(null, { status: 'inactive', size: 'sm', description: '' }));
    const discardButton = button({ label: 'Discard', disabled: true, onclick: discard });
    const saveButton = button({ label: 'Save changes', kind: 'primary', disabled: true, shortcut: modShortcut('s'), onclick: save });
    const actions = h('div', { class: 'settings__actions' }, saveState.toElement(), discardButton, saveButton);

    // ------------------------------------------------------------------ profile
    const profile = keep(new Form(null, {
      fieldsets: [
        { title: 'Personal details', columns: 2, fields: PROFILE.details },
        { title: 'Language and region', columns: 2, fields: PROFILE.region }
      ],
      onchange: () => changed('profile')
    }));
    const avatar = keep(new Avatar(null, { name: me.name, size: 'lg', label: me.name }));
    const photoInput = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: () => setPhoto(photoInput.files?.[0]) });
    const removePhoto = button({ label: 'Remove', kind: 'ghost', size: 'sm', disabled: true, onclick: () => setPhoto(null) });
    const profileSection = h('div', { class: 'settings__section' },
      settingsGroup('Photo', 'Shown beside your name everywhere in ACME.',
        h('div', { class: 'settings__photo' }, avatar.toElement(),
          button({ label: 'Upload photo', size: 'sm', icon: 'upload', onclick: () => photoInput.click() }),
          removePhoto, photoInput)),
      settingsGroup('Account', 'How colleagues see and reach you, and how dates and pages appear to you.',
        h('div', { class: 'form-sheet' }, profile.toElement())));

    // ------------------------------------------------------------ notifications
    const toggle = (entry, section) => keep(new Toggle(null, { checked: entry.on, onchange: () => changed(section) }));
    const notifications = NOTIFICATIONS.map((entry) => ({ entry, toggle: toggle(entry, 'notifications') }));
    const quietHours = { id: 'quiet', label: 'Pause at night', text: 'Hold notifications back and deliver them in the morning.', on: true };
    const quiet = keep(new Toggle(null, {
      checked: true,
      onchange: (event) => {
        quietTimes.hidden = !event.detail.checked;
        changed('notifications');
      }
    }));
    const time = (label, value) => keep(new TimePicker(null, {
      value, clock: false, step: 15, msg: { 'timePicker.label': label }, onchange: () => changed('notifications')
    }));
    const quietFrom = time('Pause from', { h: 19, m: 0 });
    const quietTo = time('Pause until', { h: 7, m: 30 });
    const quietTimes = h('div', { class: 'settings__times' },
      h('span', { class: 'meta' }, 'From'), quietFrom.toElement(),
      h('span', { class: 'meta' }, 'until'), quietTo.toElement());
    const notificationsSection = h('div', { class: 'settings__section' },
      settingsGroup('E-mail', `Sent to ${me.email}.`,
        notifications.map(({ entry, toggle: control }) => settingsRow(prefix, entry, control))),
      settingsGroup('Quiet hours', 'Nothing is lost: what arrives at night waits for you.',
        settingsRow(prefix, quietHours, quiet), quietTimes));

    // ------------------------------------------------------------------ sharing
    const visibilityNote = h('p', { class: 'meta', 'aria-live': 'polite' });
    const visibility = keep(Select.permission(null, {
      label: 'Default visibility',
      value: 15,
      groups: GROUPS,
      onchange: (event) => {
        describeVisibility(event.detail.value);
        changed('sharing');
      }
    }));
    const calendar = { id: 'calendar', label: 'Share my calendar', text: 'Your team sees when you are busy.', on: true };
    const details = { id: 'calendar-details', label: 'Show event details', text: 'Titles and places, not only the busy times.', on: false };
    const sharingToggles = [calendar, details].map((entry) => ({ entry, toggle: toggle(entry, 'sharing') }));
    const sharingSection = h('div', { class: 'settings__section' },
      settingsGroup('New records', 'Who can see what you create. Every record can still be shared on its own.',
        h('div', { class: 'settings__field' }, visibility.toElement(), visibilityNote)),
      settingsGroup('Calendar', 'What your colleagues see when they plan a meeting with you.',
        sharingToggles.map(({ entry, toggle: control }) => settingsRow(prefix, entry, control))));

    // ---------------------------------------------------------------------- api
    const tokenSlot = h('div', { class: 'settings__token' });
    const scopes = SCOPES.map((entry) => ({ entry, toggle: toggle(entry, 'api') }));
    const apiSection = h('div', { class: 'settings__section' },
      settingsGroup('Personal access token', 'Scripts and integrations use it to call the API as you. Treat it like a password.',
        tokenSlot),
      settingsGroup('Scopes', 'What the token may do. Narrow scopes limit the damage a leaked token can do.',
        scopes.map(({ entry, toggle: control }) => settingsRow(prefix, entry, control))));

    // ---------------------------------------------------------------- the pane
    const sections = { profile: profileSection, notifications: notificationsSection, sharing: sharingSection, api: apiSection };
    const elsewhere = h('div', { class: 'settings__elsewhere' });
    const header = paneHeader({ title, size: 'page', leading: shell.navToggle(), actions });
    const heading = /** @type {HTMLElement} */ (header.querySelector('.shell__title'));
    heading.tabIndex = -1;
    const main = h('section', { class: 'shell__main', 'aria-label': 'Settings' },
      header,
      h('div', { class: 'shell__body shell__body--padded' },
        h('div', { class: 'settings__page' }, Object.values(sections), elsewhere)));

    root.append(main);
    container.append(root);

    // What every section looked like when it was last saved, so Discard can put it back.
    const saved = { profile: null, notifications: null, sharing: null, api: null };
    profile.setValues({
      name: me.name, email: me.email, phone: '+49 30 5557 1402', role: me.role,
      language: 'en', dateFormat: 'long', startPage: 'dashboard', weekStart: '1'
    }, { silent: true });
    for (const name of Object.keys(saved)) saved[name] = read(name);

    shortcuts(root, { 'Mod+s': save }, context);
    describeVisibility(visibility.value);
    renderToken();
    show(state.section);
    context.cleanup(() => {
      for (const url of new Set([state.photo, saved.profile?.photo])) if (url) URL.revokeObjectURL(url);
    });

    // ---------------------------------------------------------------- functions

    /**
     * Opens a section chosen in the navigation. Chosen from the drawer, the drawer closes and the
     * section's title takes the focus, so the keyboard and a screen reader land on the new page.
     * @param {string} id
     * @returns {void}
     */
    function open(id) {
      show(id);
      if (root.dataset.navOpen !== 'true') return;
      shell.closeNav();
      heading.focus({ preventScroll: true });
    }

    /**
     * Opens a section; the workspace's sections are not built here.
     * @param {string} id
     * @returns {void}
     */
    function show(id) {
      state.section = id;
      nav.setActive(id);
      const item = [...NAVIGATION.personal, ...NAVIGATION.workspace].find((entry) => entry.id === id);
      title.textContent = item.label;
      for (const [name, element] of Object.entries(sections)) element.hidden = name !== id;
      const built = id in sections;
      actions.hidden = !built;
      elsewhere.hidden = built;
      elsewhere.replaceChildren(...(built ? [] : [unavailablePane(item.label, { label: 'Back to your profile', onclick: () => show('profile') })]));
    }

    /**
     * Reads a section's current values.
     * @param {string} name
     * @returns {Record<string, any>}
     */
    function read(name) {
      const switches = (list) => Object.fromEntries(list.map(({ entry, toggle: control }) => [entry.id, control.get()]));
      if (name === 'profile') return { form: profile.getValues(), photo: state.photo };
      if (name === 'notifications') {
        return { ...switches(notifications), quiet: quiet.get(), from: quietFrom.get(), to: quietTo.get() };
      }
      if (name === 'sharing') return { ...switches(sharingToggles), visibility: visibility.value };
      return switches(scopes);
    }

    /**
     * Puts a section back the way it was last saved.
     * @param {string} name
     * @param {Record<string, any>} values
     * @returns {void}
     */
    function restore(name, values) {
      const switches = (list) => list.forEach(({ entry, toggle: control }) => control.set(values[entry.id], { silent: true }));
      if (name === 'profile') {
        profile.setValues(values.form, { silent: true });
        profile.clearHighlights();
        setPhoto(values.photo, { silent: true });
      } else if (name === 'notifications') {
        switches(notifications);
        quiet.set(values.quiet, { silent: true });
        quietTimes.hidden = !values.quiet;
        quietFrom.set(values.from, { silent: true });
        quietTo.set(values.to, { silent: true });
      } else if (name === 'sharing') {
        switches(sharingToggles);
        visibility.set(values.visibility, { silent: true });
        describeVisibility(values.visibility);
      } else {
        switches(scopes);
      }
    }

    /**
     * Notes that a section has unsaved changes.
     * @param {string} name
     * @returns {void}
     */
    function changed(name) {
      state.dirty.add(name);
      cancelSave();
      saveState.set('inactive', 'Unsaved changes');
      saveButton.disabled = false;
      discardButton.disabled = false;
    }

    /** Saves every changed section (a simulated round trip). @returns {void} */
    function save() {
      if (state.dirty.size === 0) return;
      if (state.dirty.has('profile') && !profile.submit()) {
        show('profile');
        notify('Complete the highlighted fields to save.', 'warning');
        return;
      }
      const replaced = saved.profile.photo;
      for (const name of state.dirty) saved[name] = read(name);
      if (replaced && replaced !== saved.profile.photo) URL.revokeObjectURL(replaced);
      state.dirty.clear();
      saveButton.disabled = true;
      discardButton.disabled = true;
      saveState.set('active', 'Saving…');
      cancelSave();
      cancelSave = later(context, () => saveState.set('success', 'All changes saved'), 600);
    }

    /** Puts every changed section back the way it was last saved. @returns {void} */
    function discard() {
      for (const name of state.dirty) restore(name, saved[name]);
      state.dirty.clear();
      saveButton.disabled = true;
      discardButton.disabled = true;
      saveState.set('inactive', '');
      notify('Changes discarded.', 'info');
    }

    /**
     * Shows a new profile photo, or the initials again.
     * @param {File|string|null|undefined} source A picked file, a kept image URL, or nothing.
     * @param {{silent?: boolean}} [options]
     * @returns {void}
     */
    function setPhoto(source, { silent = false } = {}) {
      const previous = state.photo;
      const next = source instanceof File ? URL.createObjectURL(source) : source ?? null;
      // An image URL lives until neither the screen nor the saved profile shows it.
      if (previous && previous !== next && previous !== saved.profile?.photo) URL.revokeObjectURL(previous);
      state.photo = next;
      avatar.set({ src: next });
      removePhoto.disabled = !next;
      photoInput.value = '';
      if (!silent) changed('profile');
    }

    /**
     * Says in words who will see new records.
     * @param {boolean|number|null} value Private, public, or a team.
     * @returns {void}
     */
    function describeVisibility(value) {
      visibilityNote.textContent = value === false ? 'Only you see new records until you share them.'
        : value === true ? 'Everyone in ACME sees new records.'
          : `The ${GROUPS.find((group) => group.ID === value)?.name ?? 'chosen'} team sees new records.`;
    }

    /**
     * Shows the token: masked, or once, right after it was created, in full and ready to copy.
     * @param {string} [fresh] A token just created.
     * @returns {void}
     */
    function renderToken(fresh) {
      tokenParts.reset();
      const rotate = button({ label: 'Rotate token', icon: 'reload', size: 'sm', onclick: confirmRotate });
      if (fresh) {
        const copy = tokenParts.own(new CopyInput(null, { value: fresh, label: 'New token', hideLabel: true, buttonTitle: 'Copy token' }));
        tokenSlot.replaceChildren(copy.toElement(),
          h('p', { class: 'meta' }, 'Copy it now: it is shown only once.'), h('div', {}, rotate));
        // The button that asked for the new token is gone; the token itself takes the focus.
        copy.focus();
        return;
      }
      tokenSlot.replaceChildren(
        h('div', { class: 'settings__token-line' },
          h('span', { class: 'mono' }, `fs_pat_••••••••••••${state.token.last}`),
          rotate),
        h('p', { class: 'meta' }, state.token.used
          ? `Created ${formatDate(state.token.created, DATE.year)} · last used ${formatRelativeTime(state.token.used, { now: NOW })}`
          : `Created ${formatDate(state.token.created, DATE.year)} · not used yet`));
    }

    /** Asks before replacing the token, which cuts off every integration still using it. @returns {Promise<void>} */
    async function confirmRotate() {
      const confirmed = await Dialog.confirm({
        title: 'Rotate the access token?',
        message: 'The current token stops working at once. Every script and integration that uses it needs the new one.',
        okLabel: 'Rotate token',
        danger: true
      });
      if (!confirmed || context.signal.aborted) return;
      const secret = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
      state.token = { last: secret.slice(-4), created: NOW, used: null };
      renderToken(`fs_pat_${secret}`);
      notify('Token rotated. The old one no longer works.');
    }
  }
};
