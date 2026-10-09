import {
  AccountMenu, AppSidebar, Avatar, Dialog, Form, InlineLoading, MenuButton, Search, badge, button,
  emptyState, formatCurrency, formatNumber, formatRelativeTime, h, icon, uid
} from '../../src/index.js';
import {
  adaptiveShell, disposer, iconButton, layoutContext, later, modShortcut, paneHeader, renderScope, sectionLabel,
  shortcuts, toaster, unavailable, workspaceHeader
} from './kit.js';
import { COMPANIES, ME, NOW, PEOPLE, person } from './fixtures.js';

/** Where an account stands, in the order the list groups them. Shaped for `Select.status()`. */
const STAGES = [
  { ID: 'customer', name: 'Customer', group: 'Customers', tone: 'success', indicator: 'done' },
  { ID: 'prospect', name: 'Prospect', group: 'Prospects', tone: 'info', indicator: 'progress' },
  { ID: 'lead', name: 'Lead', group: 'Leads', tone: 'neutral', indicator: 'dotted' }
];

/** What sales knows about each company beyond its address, keyed by company id. */
const ACCOUNTS = {
  alpine: { stage: 'customer', owner: 'tobias', volume: 184000, phone: '+43 512 990 120', renewal: '2027-03-31', updated: '2026-10-07T15:20', notes: 'Renewal due in March. Wants the extended SLA bundled into the new term.' },
  danube: { stage: 'customer', owner: 'tobias', volume: 96000, phone: '+43 1 718 2044', renewal: '2027-01-31', updated: '2026-10-05T11:00', notes: 'Quarterly business review every January. Route optimisation went live in September.' },
  helios: { stage: 'customer', owner: 'nadine', volume: 142000, phone: '+33 4 78 55 21 90', renewal: '2026-12-31', updated: '2026-10-01T10:30', notes: 'Grid monitoring renewed for two years. IT asks for single sign-on next.' },
  bruckner: { stage: 'customer', owner: 'tobias', volume: 78000, phone: '+49 89 448 9012', renewal: '2027-06-30', updated: '2026-10-08T09:12', notes: 'Migrating the last three depots off the legacy dispatch tool this quarter.' },
  kestrel: { stage: 'prospect', owner: 'owen', volume: null, phone: '+44 161 902 3100', renewal: null, updated: '2026-10-06T09:40', notes: 'Trial workspace hits the scheduled-job limit during the nightly export.' },
  meridian: { stage: 'prospect', owner: 'piet', volume: null, phone: '+41 44 508 6600', renewal: null, updated: '2026-10-02T13:30', notes: 'Patient portal integration in evaluation. Needs a data processing agreement.' },
  northstar: { stage: 'lead', owner: 'nadine', volume: null, phone: '+31 10 240 8800', renewal: null, updated: '2026-09-21T14:10', notes: 'Met at the logistics fair. Interested in fleet tracking.' },
  atelier: { stage: 'lead', owner: 'ines', volume: null, phone: '+49 40 3017 220', renewal: null, updated: '2026-09-29T16:00', notes: 'Asked for pricing for twelve seats.' }
};

/** The stage filter above the list. */
const FILTERS = [
  { id: 'all', label: 'All' },
  ...STAGES.map((stage) => ({ id: stage.ID, label: stage.group }))
];

/**
 * The detail form: three sections of one record. Field keys are the record's property names.
 * @returns {Array<{title: string, columns: 1|2, fields: Record<string, Record<string, any>>}>}
 */
function fieldsets() {
  return [
    {
      title: 'Company',
      columns: 2,
      fields: {
        name: { type: 'text', label: 'Name', required: true },
        domain: { type: 'text', label: 'Domain', placeholder: 'company.example' },
        stage: { type: 'zxselect', label: 'Stage', props: { preset: 'status', items: STAGES } },
        owner: {
          type: 'zxselect', label: 'Account owner',
          props: { items: PEOPLE, valueKey: 'id', labelKey: 'name', filter: 'local' }
        }
      }
    },
    {
      title: 'Primary contact',
      columns: 2,
      fields: {
        contact: { type: 'text', label: 'Name', required: true },
        email: { type: 'text', label: 'Email' },
        phone: { type: 'text', label: 'Phone' },
        city: { type: 'text', label: 'City' }
      }
    },
    {
      title: 'Account',
      columns: 2,
      fields: {
        volume: { type: 'number', label: 'Annual volume', props: { min: 0, step: 1000, unit: '€', group: true } },
        renewal: { type: 'date', label: 'Renewal', props: { placeholder: 'None' } },
        notes: { type: 'textarea', label: 'Notes', props: { rows: 3 } }
      }
    }
  ];
}

/** @param {number} value Euros. @returns {string} Whole euros. */
function money(value) {
  return formatCurrency(value, 'EUR', { decimals: 0 });
}

/**
 * Copies the fixtures into the records one mounted screen edits, so a second mount starts clean.
 * @returns {Record<string, any>[]}
 */
function createRecords() {
  return COMPANIES.map(({ id, name, domain, contact, email, city, country }) => {
    const account = ACCOUNTS[id];
    return {
      ID: id, name, domain, contact, email, city, country, ...account,
      renewal: account.renewal ? new Date(`${account.renewal}T12:00:00`) : null,
      updated: new Date(account.updated)
    };
  });
}

export default {
  title: 'Master–detail',
  category: 'Pattern',
  blurb: 'A filterable list of customers beside the one being edited, with save, revert, and unsaved-change checks.',
  components: ['Form', 'Search', 'Select', 'NumberField', 'Datebox', 'InlineLoading', 'Dialog', 'MenuButton', 'Avatar', 'Message'],

  /**
   * Mounts the customers screen: navigation, the filtered list, and the open record's form.
   * @param {HTMLElement} container Gallery stage.
   * @param {import('./kit.js').LayoutContext} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const records = createRecords();
    const state = { current: records[0].ID, filter: 'all', query: '', dirty: false };
    // The avatars drawn into the list and into the record header belong to that rendering.
    const listParts = renderScope(context);
    const headParts = renderScope(context);
    // Narrow, the navigation becomes a drawer, and a phone shows the list or the record, never both.
    const root = h('div', { class: 'master-detail shell' });
    const shell = adaptiveShell(root, context);

    // ----------------------------------------------------------------- navigation --

    /**
     * A destination this example does not build: the navigation drawer closes, handing the focus
     * back to what opened it, and a toast says so.
     * @param {string} label
     * @returns {() => void}
     */
    const elsewhere = (label) => () => {
      shell.closeNav();
      notify(unavailable(label), 'info');
    };

    const destinations = keep(new AppSidebar(null, {
      label: 'Sales',
      collapsible: false,
      active: 'customers',
      items: [
        { id: 'customers', label: 'Customers', icon: 'building', badge: records.length },
        { id: 'contacts', label: 'Contacts', icon: 'users', invoke: elsewhere('Contacts') },
        { id: 'deals', label: 'Opportunities', icon: 'handshake', invoke: elsewhere('Opportunities') },
        { id: 'quotes', label: 'Quotes', icon: 'file-lines', invoke: elsewhere('Quotes') },
        { id: 'invoices', label: 'Invoices', icon: 'file-invoice', invoke: elsewhere('Invoices') }
      ]
    }));
    const views = keep(new AppSidebar(null, {
      label: 'Views',
      collapsible: false,
      items: [
        { id: 'mine', label: 'My accounts', icon: 'circle-user', invoke: elsewhere('Saved views') },
        { id: 'renewals', label: 'Renewals this quarter', icon: 'calendar-days', invoke: elsewhere('Saved views') }
      ]
    }));
    const account = keep(new AccountMenu(null, {
      account: { name: person(ME).name, secondary: person(ME).role, status: 'online' },
      items: [{ label: 'Preferences', value: 'prefs', icon: 'gear' }, '-', { label: 'Sign out', value: 'out' }],
      placement: 'top-start',
      onselect: ({ detail }) => notify(unavailable(detail.value === 'out' ? 'Signing out' : 'Preferences'), 'info')
    }));

    const nav = h('div', { class: 'shell__nav' },
      workspaceHeader(),
      h('div', { class: 'shell__body' }, destinations.toElement(), sectionLabel('Views'), views.toElement()),
      h('div', { class: 'shell__footer' }, account.toElement()));

    // ----------------------------------------------------------------- list column --

    const search = keep(new Search(null, {
      placeholder: 'Search customers',
      debounce: 120,
      oninput: ({ detail }) => { state.query = detail.value; renderList(); },
      onclear: () => { state.query = ''; renderList(); }
    }));

    // The stage filter is one radio group: Tab reaches the checked stage, the arrow keys change it.
    const filterButtons = FILTERS.map((entry) => h('button', {
      type: 'button', class: 'segmented__item', role: 'radio', tabindex: '-1',
      dataset: { filter: entry.id }, onclick: () => setFilter(entry.id)
    }, entry.label));
    const filters = h('div', { class: 'segmented master-detail__filters', role: 'radiogroup', 'aria-label': 'Stage' }, filterButtons);
    filters.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const index = (FILTERS.findIndex((entry) => entry.id === state.filter) + step + FILTERS.length) % FILTERS.length;
      setFilter(FILTERS[index].id);
      filterButtons[index].focus();
    }, { signal: context.signal });

    const listBody = h('div', { class: 'shell__body master-detail__list' });
    const listStatus = h('p', { class: 'visually-hidden', role: 'status' });
    const list = h('section', { class: 'shell__list', 'aria-label': 'Customer list' },
      paneHeader({
        leading: shell.navToggle(),
        title: 'Customers',
        actions: iconButton('plus', 'New customer', () => createRecord(), { shortcut: { label: 'N', keys: 'N' } })
      }),
      h('div', { class: 'shell__toolbar master-detail__toolbar' }, search.toElement(), filters),
      listBody, listStatus);

    // ----------------------------------------------------------------- record pane --

    const saving = keep(new InlineLoading(null, { status: 'inactive', size: 'sm' }));
    const unsaved = h('span', { class: 'meta master-detail__unsaved', hidden: true }, 'Unsaved changes');
    const revertButton = button({ label: 'Revert', disabled: true, onclick: () => revert() });
    const saveButton = button({ label: 'Save', kind: 'primary', shortcut: modShortcut('s'), onclick: () => save() });
    const more = keep(new MenuButton(iconButton('ellipsis', 'More actions'), {
      kind: 'ghost',
      placement: 'bottom-end',
      items: [
        { label: 'Copy link', value: 'copy', icon: 'link' },
        '-',
        { label: 'Delete customer', value: 'delete', icon: 'trash-can', danger: true }
      ],
      onselect: ({ detail }) => (detail.value === 'copy' ? notify('Link copied.', 'info') : remove())
    }));
    const position = h('span', { class: 'meta master-detail__position' });
    // The way back to the list on a phone. The layout's own, so the focus returns to the open
    // customer's row, which J and K have redrawn since the record was opened.
    const back = iconButton('arrow-left', 'Back to customers', () => showList(), { shortcut: { label: 'Esc', keys: 'Escape' } });
    back.classList.add('shell__back');

    const form = keep(new Form(null, {
      fieldsets: fieldsets(),
      onchange: () => setDirty(differs()),
      onsubmit: ({ detail }) => commit(detail.values)
    }));
    // Typing marks the record dirty before a text field commits its value on blur. A Select's own
    // search box is not an edit.
    form.toElement().addEventListener('input', (event) => {
      if (event.target instanceof Element && !event.target.closest('.zx-select')) setDirty(differs());
    }, { signal: context.signal });

    const recordHead = h('div', { class: 'master-detail__head' });
    const recordBody = h('div', { class: 'master-detail__record' },
      recordHead, h('div', { class: 'form-sheet form-sections master-detail__form' }, form.toElement()));
    const empty = emptyState({
      icon: 'building',
      title: 'No customer selected',
      description: 'Pick a customer from the list to see and edit the account.'
    });
    const detailBody = h('div', { class: 'shell__body shell__body--padded', tabindex: '-1', 'aria-label': 'Customer' });

    const main = h('section', { class: 'shell__main', 'aria-label': 'Customer record' },
      paneHeader({
        leading: [
          shell.navToggle(),
          back,
          iconButton('angle-up', 'Previous customer', () => step(-1), { shortcut: { label: 'K', keys: 'K' } }),
          iconButton('angle-down', 'Next customer', () => step(1), { shortcut: { label: 'J', keys: 'J' } }),
          position
        ],
        actions: [unsaved, saving.toElement(), revertButton, saveButton, more.toElement()]
      }),
      detailBody);

    root.append(nav, list, main);
    const notify = toaster(context, root);

    shortcuts(root, {
      j: () => step(1),
      k: () => step(-1),
      n: () => createRecord(),
      '/': () => {
        shell.show('list', { focus: false });
        search.focus();
      },
      'Mod+s': () => save(),
      // On a phone the record steps back to the list; anywhere else Escape is not ours.
      Escape: () => (shell.single() && shell.pane() === 'main' ? showList() : false)
    }, context);

    renderList();
    showRecord();
    container.append(root);

    // ------------------------------------------------------------------- the list --

    /**
     * @returns {Record<string, any>[]} The records the stage filter and the search let through, in
     *   the order the list shows them — grouped by stage — so J and K move to the row below.
     */
    function visible() {
      const needle = state.query.trim().toLowerCase();
      const rank = (record) => STAGES.findIndex((stage) => stage.ID === record.stage);
      return records.filter((record) => (state.filter === 'all' || record.stage === state.filter)
        && (!needle || [record.name, record.contact, record.city, record.domain].join(' ').toLowerCase().includes(needle)))
        .sort((a, b) => rank(a) - rank(b));
    }

    /** @param {string} id Filter id. @returns {void} */
    function setFilter(id) {
      state.filter = id;
      renderList();
    }

    /** Redraws the list, grouped by stage, and marks the open record. @returns {void} */
    function renderList() {
      listParts.reset();
      const rows = visible();
      for (const item of filterButtons) {
        const checked = item.dataset.filter === state.filter;
        item.setAttribute('aria-checked', String(checked));
        item.tabIndex = checked ? 0 : -1;
      }
      // Redrawing replaces the rows; focus that was on one follows the open row.
      const hadFocus = listBody.contains(document.activeElement);
      listBody.replaceChildren(...(rows.length ? STAGES.flatMap((stage) => {
        const group = rows.filter((record) => record.stage === stage.ID);
        if (group.length === 0) return [];
        return [
          h('div', { class: 'list-group' }, stage.group, h('span', { class: 'list-group__count' }, String(group.length))),
          ...group.map(listRow)
        ];
      }) : [emptyState({
        icon: 'filter', size: 'sm', title: 'No customers match',
        description: 'Try another stage or a different search.',
        actions: [{ label: 'Show all customers', onclick: () => clearFilters() }]
      })]));
      listStatus.textContent = `${formatNumber(rows.length)} of ${formatNumber(records.length)} customers`;
      updatePosition();
      if (hadFocus) listBody.querySelector('[aria-current="true"]')?.focus();
    }

    /**
     * One customer in the list: its mark, name, volume, and primary contact.
     * @param {Record<string, any>} record
     * @returns {HTMLElement}
     */
    function listRow(record) {
      const mark = listParts.own(new Avatar(null, { name: record.name || '?', shape: 'rounded', size: 'sm' }));
      return h('button', {
        type: 'button', class: 'list-row master-detail__row',
        'aria-current': record.ID === state.current ? 'true' : null,
        dataset: { id: record.ID },
        onclick: () => open(record.ID)
      },
      mark.toElement(),
      h('span', { class: 'list-row__top' },
        h('span', { class: 'list-row__title' }, record.name || 'New customer'),
        h('span', { class: 'list-row__meta' }, record.volume ? money(record.volume) : '—')),
      h('span', { class: 'list-row__snippet' }, [record.contact, record.city].filter(Boolean).join(' · ') || 'No contact yet'));
    }

    /** Clears the search and the stage filter. @returns {void} */
    function clearFilters() {
      state.query = '';
      search.set('', { silent: true });
      setFilter('all');
    }

    /** Shows "3 of 8" beside the record's previous and next buttons. @returns {void} */
    function updatePosition() {
      const rows = visible();
      const index = rows.findIndex((record) => record.ID === state.current);
      position.textContent = index === -1 ? '' : `${index + 1} of ${rows.length}`;
    }

    // ----------------------------------------------------------------- the record --

    /** @returns {Record<string, any>|undefined} The open record. */
    function current() {
      return records.find((record) => record.ID === state.current);
    }

    /**
     * Opens a record, asking first when the open one has unsaved edits.
     * @param {string|null} id
     * @returns {Promise<void>}
     */
    async function select(id) {
      if (id === state.current) return;
      if (state.dirty) {
        const discard = await Dialog.confirm({
          title: 'Discard unsaved changes?',
          message: `Your edits to ${current()?.name || 'this customer'} have not been saved.`,
          okLabel: 'Discard changes',
          danger: true
        });
        if (!discard) return;
      }
      // A new customer that was never saved goes when it is left.
      const leaving = current();
      if (leaving?.draft) records.splice(records.indexOf(leaving), 1);
      state.current = id;
      setDirty(false);
      saving.set('inactive', '');
      renderList();
      showRecord();
    }

    /**
     * Opens a record from its row — by pointer or Enter — and, where only one pane fits, shows it.
     * @param {string} id
     * @returns {Promise<void>}
     */
    async function open(id) {
      await select(id);
      if (state.current === id) shell.show('main');
    }

    /** Where only one pane fits, returns from the record to the list, onto its row. @returns {void} */
    function showList() {
      shell.show('list', { focus: false });
      const row = listBody.querySelector('[aria-current="true"]');
      if (row instanceof HTMLElement) row.focus();
      else search.focus();
    }

    /** @param {1|-1} direction @returns {void} Opens the next or previous record in the list. */
    function step(direction) {
      const rows = visible();
      if (rows.length === 0) return;
      const index = rows.findIndex((record) => record.ID === state.current);
      const next = rows[Math.min(rows.length - 1, Math.max(0, index + direction))];
      select(next.ID);
      if (!context.preview) listBody.querySelector(`[data-id="${next.ID}"]`)?.scrollIntoView({ block: 'nearest' });
    }

    /** Fills the record pane with the open record, or an empty state. @returns {void} */
    function showRecord() {
      const record = current();
      saveButton.disabled = !record;
      if (!record) {
        headParts.reset();
        detailBody.replaceChildren(empty);
        return;
      }
      form.clearHighlights();
      form.setValues(record, { silent: true });
      renderHead(record);
      // Re-inserting the record body would drop the focus from inside it.
      if (recordBody.parentNode !== detailBody) detailBody.replaceChildren(recordBody);
      detailBody.scrollTop = 0;
    }

    /** @param {Record<string, any>} record @returns {void} The record's name, address, and stage. */
    function renderHead(record) {
      // The heading a phone focuses when the record opens keeps the focus when J or K redraws it.
      const hadFocus = recordHead.contains(document.activeElement);
      headParts.reset();
      const stage = STAGES.find((entry) => entry.ID === record.stage) ?? STAGES[2];
      const owner = person(record.owner);
      recordHead.replaceChildren(
        headParts.own(new Avatar(null, { name: record.name || '?', shape: 'rounded', size: 'lg' })).toElement(),
        h('div', { class: 'master-detail__title' },
          h('h2', { class: 'record-title' }, record.name || 'New customer'),
          h('p', { class: 'master-detail__meta' },
            badge({ label: stage.name, kind: stage.tone, dot: true, size: 'sm' }),
            record.domain ? h('span', {}, icon('globe', { size: 12 }), record.domain) : null,
            record.city ? h('span', {}, icon('location-dot', { size: 12 }), [record.city, record.country].filter(Boolean).join(', ')) : null,
            owner ? h('span', { class: 'person' },
              headParts.own(new Avatar(null, { name: owner.name, size: 'sm' })).toElement(),
              h('span', { class: 'person__name' }, owner.name)) : null,
            h('span', {}, `Updated ${formatRelativeTime(record.updated, { now: NOW })}`))));
      if (!hadFocus) return;
      const heading = /** @type {HTMLElement} */ (recordHead.querySelector('h2'));
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }

    /** @returns {boolean} Whether the form holds values the open record does not. */
    function differs() {
      const record = current();
      const plain = (value) => (value instanceof Date ? value.getTime() : String(value ?? ''));
      return Boolean(record) && Object.entries(form.getValues()).some(([key, value]) => plain(value) !== plain(record[key]));
    }

    /** @param {boolean} dirty @returns {void} Shows whether the form holds unsaved edits. */
    function setDirty(dirty) {
      state.dirty = dirty;
      unsaved.hidden = !dirty;
      revertButton.disabled = !dirty;
      if (dirty) saving.set('inactive', '');
    }

    /** Validates the form; a valid submit commits through `commit()`. @returns {void} */
    function save() {
      if (!current()) return;
      if (!state.dirty) {
        notify('No changes to save.', 'info');
        return;
      }
      if (!form.submit()) saving.set('error', 'Fix the highlighted fields');
    }

    /**
     * Writes the form's values into the record and redraws what shows them.
     * @param {Record<string, any>} values
     * @returns {void}
     */
    function commit(values) {
      const record = current();
      Object.assign(record, values, { updated: new Date(NOW), draft: false });
      setDirty(false);
      countCustomers();
      renderList();
      renderHead(record);
      if (context.preview) return;
      saving.set('active', 'Saving…');
      later(context, () => {
        saving.set('success', 'Saved');
        notify(`${record.name} saved.`);
      }, 500);
    }

    /** Puts the open record's stored values back into the form. @returns {void} */
    function revert() {
      form.clearHighlights();
      form.setValues(current(), { silent: true });
      setDirty(false);
      notify('Changes reverted.', 'info');
    }

    /**
     * Starts a new lead and opens it. It stays a draft — gone again when left — until it is saved.
     * @returns {Promise<void>}
     */
    async function createRecord() {
      if (!current()?.draft) {
        const record = {
          ID: uid('customer'), name: '', domain: '', contact: '', email: '', phone: '', city: '', country: '',
          stage: 'lead', owner: ME, volume: null, renewal: null, notes: '', updated: new Date(NOW), draft: true
        };
        records.unshift(record);
        clearFilters();
        await select(record.ID);
        if (state.current !== record.ID) {
          records.splice(records.indexOf(record), 1);
          renderList();
          return;
        }
      }
      if (context.preview) return;
      shell.show('main', { focus: false });
      form.getField('name')?.focus();
    }

    /** Shows how many customers there are on their navigation item. @returns {void} */
    function countCustomers() {
      const count = records.filter((record) => !record.draft).length;
      destinations.setItems(destinations.getItems().map((item) => (item.id === 'customers' ? { ...item, badge: count } : item)));
    }

    /** Deletes the open record once confirmed and opens its neighbour. @returns {Promise<void>} */
    async function remove() {
      const record = current();
      if (!record) return;
      const confirmed = await Dialog.confirm({
        title: `Delete ${record.name || 'this customer'}?`,
        message: 'Its contacts, notes, and history go with it. This cannot be undone.',
        okLabel: 'Delete customer',
        danger: true
      });
      if (!confirmed) return;
      const rows = visible();
      const neighbour = rows[rows.indexOf(record) + 1] ?? rows[rows.indexOf(record) - 1] ?? null;
      records.splice(records.indexOf(record), 1);
      countCustomers();
      state.current = neighbour?.ID ?? null;
      setDirty(false);
      renderList();
      showRecord();
      // With nothing left to show, a phone goes back to the list.
      if (!neighbour && shell.single()) showList();
      notify(`${record.name || 'Customer'} deleted.`);
    }
  }
};
