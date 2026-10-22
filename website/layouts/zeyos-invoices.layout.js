import {
  AccountMenu, AppSidebar, DataFilter, Dialog, button, formatNumber, h, icon
} from '../../src/index.js';
import {
  buildZeyosAppSidebarConfig, calendarDayToUnixSeconds, dataFilterStateToFilters, zeyosForm, zeyosTable
} from '../../src/zeyos/index.js';
// The dedicated ZeyOS client library (npm: @zeyos/client), bundled for the zero-build site.
import { createZeyosClient } from '../vendor/zeyos-client.esm.js';
import { installMockZeyosApi } from '../mock-zeyos-api.js';
import {
  accountChoices, adaptiveShell, disposer, iconButton, layoutContext, panelBlock, paneHeader, propList, renderScope,
  shortcuts, suiteStrip, toaster, unavailable
} from './kit.js';
import { ME, NOW, person } from './fixtures.js';

const TABLE_FIELDS = ['transactionnum', 'account', 'date', 'duedate', 'netamount', 'status'];
const FORM_FIELDS = [...TABLE_FIELDS, 'currency'];
const FIELD_LABELS = {
  transactionnum: 'Invoice number',
  account: 'Customer',
  date: 'Issue date',
  duedate: 'Due date',
  netamount: 'Net amount',
  status: 'Status',
  currency: 'Currency'
};
const STATUS_OPTIONS = [
  { value: 0, label: 'Draft' },
  { value: 1, label: 'Booked' },
  { value: 16, label: 'Invoiced' },
  { value: 20, label: 'Paid' },
  { value: 21, label: 'Overpaid' }
];

/**
 * The ZeyOS shell state the navigation is built from: the modules this user may open, and the menus
 * of the modules that have one, keyed by module identifier. The screen is the invoice list.
 */
const ZEYOS_SHELL = {
  modules: ['billing', 'accounts', 'contacts', 'tickets', 'tasks', 'notes', 'calendar', 'messages', 'projects'],
  menus: {
    billing: [
      { id: 'invoices', label: 'Invoices', icon: 'file-invoice' },
      { id: 'quotes', label: 'Quotes', icon: 'file-lines' },
      { id: 'credit-notes', label: 'Credit notes', icon: 'receipt' },
      { id: 'payments', label: 'Payments', icon: 'credit-card' }
    ],
    accounts: [{ id: 'accounts:list', label: 'Accounts', icon: 'building' }],
    contacts: [{ id: 'contacts:list', label: 'Contacts', icon: 'users' }]
  },
  activeIdentifier: 'billing',
  active: 'invoices'
};

/**
 * The glyph each module's tile draws. The ZeyOS icon kit is a web font this offline example does
 * not load, so every module takes the closest outline from the bundled and the layouts' icon set.
 */
const MODULE_ICONS = {
  billing: 'file-invoice',
  accounts: 'building',
  contacts: 'users',
  tickets: 'clipboard-list',
  tasks: 'list-check',
  notes: 'file-lines',
  calendar: 'calendar-days',
  messages: 'message',
  projects: 'diagram-project'
};

export default {
  title: 'ZeyOS invoices',
  category: 'Pattern',
  blurb: 'Invoices listed, filtered, sorted, and edited through a table and a form generated from the ZeyOS schema, beside the ZeyOS module navigation.',
  components: ['Table', 'DataFilter', 'Form', 'Dialog', 'AppSidebar', 'ModuleBar', 'AccountMenu'],

  /**
   * Mounts the invoice list driven by the ZeyOS OpenAPI client: the generated table under its
   * server-side filters, the generated editor in a dialog, and an inspector that shows what the
   * binding last asked the server for.
   * @param {HTMLElement} container Gallery stage.
   * @param {Partial<import('./kit.js').LayoutContext>} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const me = person(ME);

    // ---------------------------------------------------------------- navigation column
    // The ZeyOS navigation, built by the binding from the shell state: the module strip in the
    // ZeyOS identity colours beside Billing's menu. Only the invoices are part of this example;
    // every other entry and module says so.
    const unavailableEntry = (label) => () => notify(unavailable(label), 'info');
    const account = keep(new AccountMenu(null, {
      account: { name: me.name, secondary: me.role, status: me.status },
      placement: 'top-start',
      items: [
        { label: 'Preferences', value: 'preferences', icon: 'gear' },
        '-',
        { label: 'Sign out', value: 'sign-out', icon: 'power-off' }
      ],
      onselect: (event) => notify(unavailable(event.detail.item.label), 'info')
    }));
    const sidebar = keep(new AppSidebar(null, buildZeyosAppSidebarConfig({
      ...ZEYOS_SHELL,
      menus: Object.fromEntries(Object.entries(ZEYOS_SHELL.menus).map(([module, entries]) => [module,
        entries.map((entry) => (entry.id === 'invoices' ? entry : { ...entry, invoke: unavailableEntry(entry.label) }))])),
      // A module without a menu is a destination of its own: the host says what choosing it does.
      resolveApplication: (app) => ({ invoke: unavailableEntry(Array.isArray(app) ? String(app[1]) : 'This module') }),
      renderApplicationIcon: (app, normalized) => icon(MODULE_ICONS[normalized.module] ?? 'cube')
    }, {
      railHeader: suiteStrip(),
      railFooter: account,
      // The layout and the theme are chosen in the account menu.
      presentationSwitch: false,
      // The name and role while the modules are named, the avatar alone on the icon strip.
      onpresentationchange: ({ detail }) => account.setCompact(detail.presentation !== 'expanded')
    })));
    accountChoices(context, sidebar, account, [
      { label: 'Preferences', value: 'preferences', icon: 'gear' },
      '-',
      { label: 'Sign out', value: 'sign-out', icon: 'power-off' }
    ]);
    const nav = h('div', { class: 'shell__nav', dataset: { nav: 'modules' } }, sidebar.toElement());
    const root = h('div', { class: 'zinvoices shell' }, nav);
    // Narrow, the data source and then the navigation become drawers.
    const shell = adaptiveShell(root, context, { asideLabel: 'Show data source' });
    const notify = toaster(context, root);
    // The open editor: its generated form and its dialog, destroyed together when it closes.
    const editorScope = renderScope(context);

    // No backend or credentials are needed here: the mock answers the OpenAPI endpoints with
    // Unix-second timestamps and real server-side query handling. Point `platform` at a live
    // instance and drop this call to run the same code against ZeyOS.
    installMockZeyosApi();

    // The binding receives an existing client; it never imports or bundles @zeyos/client itself.
    // (@zeyos/client instances are frozen, so the generators normalize list responses with their
    // own built-in fallback rather than attaching anything to the client.)
    const client = createZeyosClient({
      platform: 'https://cloud.zeyos.com/demo/',
      auth: { mode: 'session', session: { enabled: true, credentials: 'include' } }
    });

    let activeDialog = null;
    let activeSearch = '';
    let activeFilters = {};
    let activeSort = { id: 'date', dir: 'desc' };

    // ----------------------------------------------------------------- the list
    const sourceStatus = h('span', { class: 'zinvoices__status', 'aria-live': 'polite' }, 'Waiting for zx-zeyos.');

    const list = keep(zeyosTable(client, 'transactions', {
      fields: TABLE_FIELDS,
      labels: FIELD_LABELS,
      pageSize: 25,
      sort: activeSort,
      selectable: 'multi',
      // The pane is the frame; the mock stores UTC midnights. On a phone each invoice is a card.
      variant: 'plain',
      timeZone: 'UTC',
      responsive: 'sm',
      onRowClick: (row) => openEditor(row.ID, row.transactionnum)
    }));

    const loadMore = button({ label: 'Load more', onclick: () => loadNextPage() });
    loadMore.hidden = true;
    const tableWrap = h('div', { class: 'shell__body zinvoices__table', 'aria-busy': 'true' },
      list.table.toElement(),
      h('div', { class: 'zinvoices__more' }, loadMore));

    const filter = keep(new DataFilter(null, {
      data: [],
      clearLabel: 'Clear filters',
      filters: [
        {
          type: 'text',
          id: 'search',
          label: 'Find invoice',
          fields: ['transactionnum', 'account_label'],
          placeholder: 'Customer or invoice number'
        },
        {
          type: 'select',
          id: 'status',
          label: 'Status',
          field: 'status',
          emptyLabel: 'All statuses',
          options: STATUS_OPTIONS
        }
      ],
      onfilter: (event) => {
        activeSearch = String(event.detail.state.search ?? '');
        activeFilters = dataFilterStateToFilters(
          { status: event.detail.state.status },
          [{ id: 'status', field: 'status' }]
        );
        void loadInvoices('filters');
      }
    }));

    const newKey = { label: 'N', keys: 'N' };
    const newButton = button({ label: 'New invoice', icon: 'plus', kind: 'primary', shortcut: newKey, onclick: () => openEditor(null) });
    newButton.dataset.narrow = 'icon';
    const main = h('section', { class: 'shell__main', 'aria-label': 'Invoices' },
      paneHeader({
        leading: shell.navToggle(),
        title: 'Invoices',
        size: 'page',
        actions: [
          sourceStatus,
          iconButton('reload', 'Refresh', () => loadInvoices('refresh'), { shortcut: { label: 'R', keys: 'R' } }),
          newButton,
          shell.asideToggle()
        ]
      }),
      h('div', { class: 'shell__toolbar zinvoices__filters' }, filter.toElement()),
      tableWrap);

    // ------------------------------------------------------------- the inspector
    const request = h('div');
    const aside = h('aside', { class: 'shell__aside', 'aria-label': 'Data source' },
      paneHeader({ title: 'Data source' }),
      h('div', { class: 'shell__body' },
        panelBlock('Connection', propList([
          ['Client', h('span', { class: 'mono' }, '@zeyos/client')],
          ['Platform', h('span', { class: 'mono' }, 'cloud.zeyos.com/demo')],
          ['Resource', h('span', { class: 'mono' }, 'transactions')],
          ['Binding', h('span', { class: 'mono' }, 'zx-zeyos')]
        ])),
        panelBlock('Last request', request),
        panelBlock('How it works',
          h('p', { class: 'meta zinvoices__note' },
            'The table and the editor are generated from the real ZeyOS ',
            h('span', { class: 'mono' }, 'transactions'), ' and ', h('span', { class: 'mono' }, 'accounts'),
            ' schemas the injected client exposes. Typed metadata picks the date, amount, enum, and entity widgets.'),
          h('p', { class: 'meta zinvoices__note' },
            'Queries use ', h('span', { class: 'mono' }, 'filters'),
            ', Unix-second timestamps, and server-side sorting and paging: the table never sorts locally.'))));

    root.append(main, aside);
    container.append(root);

    list.table.on('datachange', () => {
      loadMore.hidden = !list.hasMore;
      const shown = list.table.getData().length;
      sourceStatus.textContent = list.count == null
        ? `${formatNumber(shown)} invoices`
        : `${formatNumber(shown)} of ${formatNumber(list.count)}`;
      renderRequest();
    });
    list.table.on('sort', (event) => {
      activeSort = event.detail?.id == null ? null : { id: String(event.detail.id), dir: event.detail.dir === 'desc' ? 'desc' : 'asc' };
      sourceStatus.textContent = 'Sorting on the server…';
      renderRequest();
    });

    shortcuts(root, {
      n: () => openEditor(null),
      r: () => loadInvoices('refresh'),
      '/': () => filter.el.querySelector('input')?.focus()
    }, context);

    renderRequest();
    void loadInvoices('initial');

    /**
     * Reloads the first page for the active search and filters.
     * @param {string} reason Why the reload was triggered; shown in the status line.
     * @returns {Promise<void>}
     */
    async function loadInvoices(reason) {
      tableWrap.setAttribute('aria-busy', 'true');
      list.table.setLoading(true);
      sourceStatus.textContent = reason === 'filters' ? 'Applying server filters…' : 'Loading…';
      try {
        await list.load({ search: activeSearch, filters: activeFilters, page: 0 });
      } catch (error) {
        sourceStatus.textContent = 'Could not load transactions: ' + error.message;
      } finally {
        tableWrap.setAttribute('aria-busy', 'false');
        list.table.setLoading(false);
      }
    }

    /** Appends the next server page. @returns {Promise<void>} */
    async function loadNextPage() {
      loadMore.disabled = true;
      list.table.setLoading(true);
      try {
        await list.loadMore();
      } catch (error) {
        notify('Could not load more transactions: ' + error.message, 'error');
      } finally {
        loadMore.disabled = false;
        list.table.setLoading(false);
      }
    }

    /** Shows the query the binding sent last: sort, filters, search, and how far it paged. @returns {void} */
    function renderRequest() {
      const filters = Object.entries(activeFilters);
      const shown = list.table.getData().length;
      request.replaceChildren(propList([
        ['Sort', activeSort ? `${activeSort.id}, ${activeSort.dir === 'desc' ? 'descending' : 'ascending'}` : 'None'],
        ['Filters', filters.length
          ? h('span', { class: 'mono' }, filters.map(([field, value]) => `${field} = ${JSON.stringify(value)}`).join(', '))
          : 'None'],
        ['Search', activeSearch || null],
        ['Rows', list.count == null ? null : `${formatNumber(shown ? 1 : 0)}–${formatNumber(shown)} of ${formatNumber(list.count)}`]
      ]));
    }

    /**
     * Opens the generated editor for an existing or a new invoice.
     * @param {number|null} id Transaction ID, or null to create one.
     * @param {string} [number] The invoice number, for the dialog's title.
     * @returns {void}
     */
    function openEditor(id, number) {
      if (context.preview || activeDialog?.isOpen()) return;
      const isEdit = id != null;
      editorScope.reset();
      const editor = editorScope.own(zeyosForm(client, 'transactions', {
        fields: FORM_FIELDS,
        labels: FIELD_LABELS,
        columns: 2,
        timeZone: 'UTC',
        ...(isEdit ? { id } : { value: newInvoiceValue() }),
        onSaved: async (record) => {
          sourceStatus.textContent = 'Saved ' + record.transactionnum + '.';
          await loadInvoices('saved');
        }
      }));
      const dialog = editorScope.own(new Dialog(null, {
        title: isEdit ? `Invoice ${number ?? ''}`.trim() : 'New invoice',
        size: 'lg',
        scope: root,
        content: h('div', { class: 'form-sheet zinvoices__editor' }, editor.form.toElement()),
        buttons: [
          { label: 'Cancel', action: 'cancel' },
          {
            label: 'Save invoice',
            kind: 'primary',
            autofocus: true,
            action: () => saveEditor(dialog, editor)
          }
        ]
      }));
      activeDialog = dialog;
      dialog.once('close', () => {
        editorScope.reset();
        if (activeDialog === dialog) activeDialog = null;
      });
      dialog.open();
      setDialogSaving(dialog, true);
      editor.ready.then(() => {
        if (dialog.isOpen()) setDialogSaving(dialog, false);
      }).catch((error) => {
        if (!dialog.isOpen()) return;
        sourceStatus.textContent = 'Could not load the invoice: ' + error.message;
        dialog.setButtons([{ label: 'Close', action: 'close', autofocus: true }]);
        setDialogSaving(dialog, false);
      });
    }

    /**
     * @param {Dialog} dialog Open dialog.
     * @param {{save: () => Promise<unknown>}} editor Generated form binding.
     * @returns {Promise<void>}
     */
    async function saveEditor(dialog, editor) {
      setDialogSaving(dialog, true);
      try {
        const saved = await editor.save();
        if (saved && dialog.isOpen()) dialog.close(saved);
      } catch (error) {
        sourceStatus.textContent = 'Could not save the invoice: ' + error.message;
      } finally {
        if (dialog.isOpen()) setDialogSaving(dialog, false);
      }
    }

    /**
     * Marks the editor busy while the binding loads or saves: the dialog is `aria-busy` and its
     * buttons are disabled meanwhile.
     * @param {Dialog} dialog
     * @param {boolean} saving
     * @returns {void}
     */
    function setDialogSaving(dialog, saving) {
      const controls = [...dialog.el.querySelectorAll('[data-dialog-button]')];
      dialog.el.setAttribute('aria-busy', String(saving));
      for (const control of controls) control.disabled = saving;
    }

    /** @returns {Record<string, unknown>} */
    function newInvoiceValue() {
      const today = calendarDayToUnixSeconds(NOW, 'UTC');
      return {
        transactionnum: '',
        account: null,
        date: today,
        duedate: today + 30 * 86_400,
        netamount: null,
        status: 0,
        currency: 'EUR'
      };
    }
  }
};
