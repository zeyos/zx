import {
  AccountMenu, ActivityList, AppSidebar, Avatar, Breadcrumb, Datebox, Dialog, Finder, InlineLoading,
  MenuButton, NumberField, Rating, Select, Tabbox, Table, TagPicker, badge, button, formatCurrency,
  formatDate, formatFileSize, formatPercent, formatRelativeTime, h, statTile
} from '../../src/index.js';
import {
  DATE, adaptiveShell, disposer, iconButton, layoutContext, later, panelBlock, paneHeader, propList, renderScope,
  sectionLabel, shortcuts, toaster, unavailable, workspaceHeader
} from './kit.js';
import { ME, NOW, PEOPLE, company, person } from './fixtures.js';

/** The stages an opportunity moves through. Shaped for `Select.status()`. */
const STAGES = [
  { ID: 'discovery', name: 'Discovery', indicator: 'dotted', tone: 'neutral' },
  { ID: 'proposal', name: 'Proposal', indicator: 'ring', tone: 'info' },
  { ID: 'negotiation', name: 'Negotiation', indicator: 'progress', tone: 'warning' },
  { ID: 'won', name: 'Won', indicator: 'done', tone: 'success' },
  { ID: 'lost', name: 'Lost', indicator: 'canceled', tone: 'muted' }
];

/** The tags an opportunity can carry. */
const TAGS = [
  { ID: 'strategic', name: 'Strategic' }, { ID: 'logistics', name: 'Logistics' },
  { ID: 'multi-site', name: 'Multi-site' }, { ID: 'renewal', name: 'Renewal' },
  { ID: 'enterprise', name: 'Enterprise' }
];

/** The record this page shows. Dates are local calendar days. */
const OPPORTUNITY = {
  ID: 'OPP-26041', name: 'Warehouse rollout', company: 'bruckner', owner: 'tobias', stage: 'negotiation',
  probability: 60, close: '2026-11-02', created: '2026-07-19', confidence: 4, tags: ['strategic', 'logistics', 'multi-site']
};

/** What is being sold. Prices are net, in euros. */
const POSITIONS = [
  { ID: 1, article: 'Platform licence, enterprise', quantity: 25, unit: 'Seat', price: 480 },
  { ID: 2, article: 'Implementation package', quantity: 1, unit: 'Flat', price: 14800 },
  { ID: 3, article: 'On-site training day', quantity: 4, unit: 'Day', price: 1450 },
  { ID: 4, article: 'Priority support, annual', quantity: 1, unit: 'Year', price: 9600 }
];

/** The VAT rate on every position. */
const VAT = 0.19;

/** Files attached to the opportunity, in folders. Sizes are in bytes. */
const DOCUMENTS = [
  {
    ID: 'quotes', name: 'Quotes',
    children: [
      { ID: 'qt-26014', name: 'QT-26014.pdf', size: 131072, by: 'ines', added: '2026-10-07' },
      { ID: 'qt-26009', name: 'QT-26009.pdf', size: 121856, by: 'tobias', added: '2026-08-21' }
    ]
  },
  {
    ID: 'technical', name: 'Technical',
    children: [
      { ID: 'spec', name: 'Specification.md', size: 38912, by: 'piet', added: '2026-08-02' },
      { ID: 'plan', name: 'Migration plan.xlsx', size: 75776, by: 'ines', added: '2026-09-28' }
    ]
  },
  { ID: 'nda', name: 'NDA, signed.pdf', size: 65536, by: 'tobias', added: '2026-07-24' }
];

/** What happened on the record, newest first. */
const HISTORY = [
  { actor: 'tobias', at: '2026-10-08T09:12', title: 'moved the opportunity to Negotiation' },
  { actor: 'ines', at: '2026-10-07T15:00', title: 'sent quote QT-26014 to Felix Bruckner' },
  { actor: 'piet', at: '2026-10-02T11:00', title: 'scheduled the technical review for 13 October' },
  { actor: 'ines', at: '2026-09-28T10:40', title: 'attached Migration plan.xlsx' },
  { actor: 'tobias', at: '2026-07-19T09:00', title: 'created the opportunity from an inbound enquiry' }
];

/** @param {number} value Euros. @returns {string} */
function money(value) {
  return formatCurrency(value, 'EUR', { decimals: 0 });
}

/** @param {string} iso Local date. @returns {Date} Noon that day, so no time zone moves it. */
function noon(iso) {
  return new Date(`${iso}T12:00:00`);
}

/** @param {typeof POSITIONS} positions @returns {number} The net total of every position. */
function netTotal(positions) {
  return positions.reduce((sum, row) => sum + row.quantity * row.price, 0);
}

export default {
  title: 'Record page',
  category: 'Pattern',
  blurb: 'One opportunity on its own page: a summary header, tabs for positions, files, and history, and editable details.',
  components: ['Tabbox', 'Finder', 'Rating', 'Select', 'TagPicker', 'Datebox', 'NumberField', 'StatTile', 'Table', 'ActivityList', 'Breadcrumb', 'InlineLoading'],

  /**
   * Mounts the opportunity page: navigation, the record with its tabs, and its details.
   * @param {HTMLElement} container Gallery stage.
   * @param {import('./kit.js').LayoutContext} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const record = { ...OPPORTUNITY, tags: [...OPPORTUNITY.tags] };
    const documents = structuredClone(DOCUMENTS);
    const history = HISTORY.map((entry) => ({ ...entry }));
    const client = company(record.company);
    // The header's avatars and the Finder are redrawn; their components go with each rendering.
    const headParts = renderScope(context);
    const docParts = renderScope(context);
    // Narrow, the navigation and then the details column become drawers opened from the header.
    const root = h('div', { class: 'record shell' });
    const shell = adaptiveShell(root, context, { asideLabel: 'Opportunity details' });
    const notify = toaster(context, root);

    // ----------------------------------------------------------------- navigation --

    const destinations = keep(new AppSidebar(null, {
      label: 'Sales',
      collapsible: false,
      active: 'opportunities',
      items: [
        { id: 'overview', label: 'Overview', icon: 'gauge', invoke: () => notify(unavailable('The overview'), 'info') },
        { id: 'opportunities', label: 'Opportunities', icon: 'handshake', badge: 7 },
        { id: 'quotes', label: 'Quotes', icon: 'file-lines', invoke: () => notify(unavailable('Quotes'), 'info') },
        { id: 'customers', label: 'Customers', icon: 'building', invoke: () => notify(unavailable('Customers'), 'info') }
      ]
    }));
    const recent = keep(new AppSidebar(null, {
      label: 'Recently viewed',
      collapsible: false,
      items: [
        { id: 'plant', label: 'Plant rollout, phase 2', icon: 'handshake' },
        { id: 'portal', label: 'Patient portal integration', icon: 'handshake' },
        { id: 'fleet', label: 'Fleet tracking pilot', icon: 'handshake' }
      ].map((item) => ({ ...item, invoke: () => notify(unavailable('Other opportunities'), 'info') }))
    }));
    const account = keep(new AccountMenu(null, {
      account: { name: person(ME).name, secondary: person(ME).role, status: 'online' },
      items: [{ label: 'Preferences', value: 'prefs', icon: 'gear' }, '-', { label: 'Sign out', value: 'out' }],
      placement: 'top-start',
      onselect: ({ detail }) => notify(unavailable(detail.value === 'out' ? 'Signing out' : 'Preferences'), 'info')
    }));
    const nav = h('div', { class: 'shell__nav' },
      workspaceHeader(),
      h('div', { class: 'shell__body' }, destinations.toElement(), sectionLabel('Recently viewed'), recent.toElement()),
      h('div', { class: 'shell__footer' }, account.toElement()));

    // --------------------------------------------------------------------- header --

    const crumbs = keep(new Breadcrumb(null, {
      items: [{ name: 'list', label: 'Opportunities' }, { name: 'record', label: record.ID }],
      onselect: ({ detail }) => { if (detail.name === 'list') notify(unavailable('The opportunity list'), 'info'); }
    }));
    const wonButton = button({ label: 'Mark as won', icon: 'flag-checkered', shortcut: { label: 'W', keys: 'W' }, onclick: () => markWon() });
    const quoteButton = button({ label: 'Create quote', icon: 'file-invoice', kind: 'primary', shortcut: { label: 'Q', keys: 'Q' }, onclick: () => createQuote() });
    // On a phone both keep only their icons; their names stay the words.
    wonButton.dataset.narrow = 'icon';
    quoteButton.dataset.narrow = 'icon';
    const more = keep(new MenuButton(iconButton('ellipsis', 'More actions'), {
      kind: 'ghost',
      placement: 'bottom-end',
      items: [
        { label: 'Copy link', value: 'copy', icon: 'link' },
        { label: 'Duplicate', value: 'duplicate', icon: 'copy' },
        '-',
        { label: 'Mark as lost', value: 'lost', icon: 'circle-xmark', danger: true }
      ],
      onselect: ({ detail }) => {
        if (detail.value === 'copy') notify('Link copied.', 'info');
        else if (detail.value === 'duplicate') notify(unavailable('Duplicating'), 'info');
        else markLost();
      }
    }));

    // ------------------------------------------------------------------ the record --

    const head = h('div', { class: 'record__head' });
    const tiles = {
      amount: keep(statTile({ label: 'Amount', format: money })),
      weighted: keep(statTile({ label: 'Weighted', format: money })),
      close: keep(statTile({ label: 'Expected close', format: null }))
    };

    const positions = keep(new Table(null, {
      variant: 'plain',
      columns: [
        { id: 'article', label: 'Article', width: '2.4fr' },
        { id: 'quantity', label: 'Quantity', align: 'end', width: '0.8fr', type: 'number' },
        { id: 'unit', label: 'Unit', width: '0.7fr' },
        { id: 'price', label: 'Unit price', align: 'end', width: '1fr', render: (row) => money(row.price) },
        {
          id: 'total', label: 'Total', align: 'end', width: '1fr', render: (row) => money(row.quantity * row.price)
        }
      ],
      data: POSITIONS,
      rowId: 'ID',
      stickyHeader: false,
      responsive: 'sm'
    }));
    const net = netTotal(POSITIONS);
    const totals = h('dl', { class: 'record__totals' },
      h('dt', {}, 'Net'), h('dd', { class: 'num' }, money(net)),
      h('dt', {}, `VAT ${formatPercent(VAT)}`), h('dd', { class: 'num' }, money(net * VAT)),
      h('dt', { class: 'record__grand' }, 'Total'), h('dd', { class: 'num record__grand' }, money(net * (1 + VAT))));

    const documentsHost = h('div', { class: 'record__documents' });
    const activity = keep(new ActivityList(null, { label: 'History', emptyText: 'Nothing has happened here yet.' }));

    const tabs = keep(new Tabbox(null, {
      variant: 'line',
      label: 'Opportunity sections',
      tabs: [
        { name: 'positions', title: 'Positions', content: h('div', { class: 'record__tab' }, positions.toElement(), totals) },
        { name: 'documents', title: 'Documents', content: h('div', { class: 'record__tab' }, documentsHost) },
        { name: 'activity', title: 'Activity', content: h('div', { class: 'record__tab' }, activity.toElement()) }
      ]
    }));
    tabs.setBadge('positions', String(POSITIONS.length));

    // --------------------------------------------------------------- details aside --

    const saving = keep(new InlineLoading(null, { status: 'inactive', size: 'sm' }));
    const stagePick = keep(Select.status(null, {
      items: STAGES, value: record.stage, label: 'Stage',
      onchange: ({ detail }) => save({ stage: detail.value }, `moved the opportunity to ${stageOf(detail.value).name}`)
    }));
    const ownerAvatars = new Map();
    const ownerPick = keep(new Select(null, {
      items: PEOPLE, valueKey: 'id', labelKey: 'name', value: record.owner, label: 'Owner', filter: 'local',
      renderValueAdornment: (member) => {
        if (!ownerAvatars.has(member.id)) ownerAvatars.set(member.id, keep(new Avatar(null, { name: member.name, size: 'sm' })));
        return ownerAvatars.get(member.id).toElement();
      },
      onchange: ({ detail }) => save({ owner: detail.value }, `handed the opportunity to ${person(detail.value)?.name}`)
    }));
    const closePick = keep(new Datebox(null, {
      value: noon(record.close), clearable: false,
      onchange: ({ detail }) => { if (detail.date) save({ close: formatDate(detail.date, '%Y-%m-%d') }); }
    }));
    const probabilityPick = keep(new NumberField(null, {
      value: record.probability, min: 0, max: 100, step: 5, unit: '%', label: 'Probability',
      onchange: ({ detail }) => save({ probability: detail.value ?? 0 })
    }));
    const confidencePick = keep(new Rating(null, {
      value: record.confidence, label: 'Win confidence', size: 'sm',
      labels: ['Very low', 'Low', 'Even', 'Likely', 'Committed'],
      onchange: ({ detail }) => save({ confidence: detail.value })
    }));
    const tagPick = keep(new TagPicker(null, {
      items: TAGS, values: record.tags, allowCreate: true, placeholder: 'Add a tag',
      onchange: ({ detail }) => save({ tags: [...detail.values] })
    }));
    const contactAvatar = keep(new Avatar(null, { name: client.contact, size: 'sm' }));

    const aside = h('aside', { class: 'shell__aside shell__aside--wide', 'aria-label': 'Opportunity details' },
      paneHeader({ title: 'Details', actions: saving.toElement() }),
      h('div', { class: 'shell__body' },
        panelBlock('Opportunity', propList([
          ['Stage', stagePick.toElement()],
          ['Owner', ownerPick.toElement()],
          ['Expected close', closePick.toElement()],
          ['Probability', probabilityPick.toElement()],
          ['Confidence', confidencePick.toElement()],
          ['Tags', tagPick.toElement()]
        ])),
        panelBlock('Customer', propList([
          ['Company', h('button', {
            type: 'button', class: 'link-button', onclick: () => notify(unavailable('Customer records'), 'info')
          }, client.name)],
          ['Contact', h('span', { class: 'person' }, contactAvatar.toElement(), h('span', { class: 'person__name' }, client.contact))],
          ['Email', h('span', { class: 'record__email' }, client.email)],
          ['Location', `${client.city}, ${client.country}`]
        ]))));

    const main = h('section', { class: 'shell__main', 'aria-label': 'Opportunity' },
      paneHeader({
        leading: [shell.navToggle(), crumbs.toElement()],
        actions: [wonButton, quoteButton, more.toElement(), shell.asideToggle()]
      }),
      h('div', { class: 'shell__body shell__body--padded record__body' },
        h('div', { class: 'record__page' },
          head,
          h('div', { class: 'record__tiles' }, Object.values(tiles).map((tile) => tile.toElement())),
          tabs.toElement())));

    root.append(nav, main, aside);

    shortcuts(root, {
      w: () => markWon(),
      q: () => createQuote(),
      1: () => tabs.openTab('positions'),
      2: () => tabs.openTab('documents'),
      3: () => tabs.openTab('activity')
    }, context);

    renderSummary();
    renderDocuments([]);
    renderHistory();
    container.append(root);

    // ------------------------------------------------------------------ rendering --

    /** @param {string} id @returns {(typeof STAGES)[number]} */
    function stageOf(id) {
      return STAGES.find((stage) => stage.ID === id) ?? STAGES[0];
    }

    /** Redraws everything that shows the record's attributes: its header and figures. @returns {void} */
    function renderSummary() {
      headParts.reset();
      const stage = stageOf(record.stage);
      const owner = person(record.owner);
      head.replaceChildren(
        headParts.own(new Avatar(null, { name: client.name.replace(/\b(GmbH|AG)\b/g, ''), shape: 'rounded', size: 'lg' })).toElement(),
        h('div', { class: 'record__title' },
          h('h2', { class: 'record-title' }, record.name),
          h('p', { class: 'record__meta' },
            badge({ label: stage.name, kind: stage.tone === 'muted' ? 'neutral' : stage.tone, dot: true, size: 'sm' }),
            h('span', {}, client.name),
            h('span', { class: 'mono' }, record.ID),
            owner ? h('span', { class: 'person' },
              headParts.own(new Avatar(null, { name: owner.name, size: 'sm' })).toElement(),
              h('span', { class: 'person__name' }, owner.name)) : null,
            h('span', {}, `Created ${formatDate(noon(record.created), DATE.year)}`))));
      const close = noon(record.close);
      tiles.amount.update({ value: net, caption: `${POSITIONS.length} positions, net` });
      tiles.weighted.update({ value: (net * record.probability) / 100, caption: `at ${formatPercent(record.probability / 100)} probability` });
      tiles.close.update({ value: formatDate(close, DATE.year), caption: formatRelativeTime(close, { now: NOW }) });
      wonButton.disabled = ['won', 'lost'].includes(record.stage);
    }

    /**
     * Draws the document browser, opened at a path.
     * @param {string[]} path Node ids from the root down.
     * @returns {void}
     */
    function renderDocuments(path) {
      docParts.reset();
      const finder = docParts.own(new Finder(null, {
        items: documents,
        path,
        rootLabel: 'Documents',
        height: '18rem',
        preview: (node) => h('div', { class: 'record__file' },
          h('strong', {}, node.name),
          h('span', { class: 'meta' }, `${formatFileSize(node.size)} · added by ${person(node.by)?.name} on ${formatDate(noon(node.added), DATE.short)}`),
          button({ label: 'Download', icon: 'download', size: 'sm', onclick: () => notify(unavailable('Downloading'), 'info') }))
      }));
      documentsHost.replaceChildren(finder.toElement());
      const files = documents.flatMap((node) => node.children ?? [node]).length;
      tabs.setBadge('documents', String(files));
    }

    /** Fills the history tab from the record's log. @returns {void} */
    function renderHistory() {
      activity.setItems(history.map((entry, index) => {
        const actor = person(entry.actor)?.name ?? '';
        const at = new Date(entry.at);
        return { id: index, actor, avatar: { name: actor, size: 'sm' }, title: entry.title, timestamp: at, timeLabel: formatRelativeTime(at, { now: NOW }) };
      }));
      tabs.setBadge('activity', String(history.length));
    }

    /** @param {string} title What the signed-in user just did. @returns {void} */
    function log(title) {
      history.unshift({ actor: ME, at: formatDate(NOW, '%Y-%m-%dT%H:%M'), title });
      renderHistory();
    }

    // -------------------------------------------------------------------- actions --

    /**
     * Stores an edit from the details column, redraws the summary, and confirms it in place.
     * @param {Partial<typeof OPPORTUNITY>} changes
     * @param {string} [entry] The history line the change writes, if any.
     * @returns {void}
     */
    function save(changes, entry) {
      Object.assign(record, changes);
      renderSummary();
      if (entry) log(entry);
      if (context.preview) return;
      saving.set('active', 'Saving…');
      later(context, () => saving.set('success', 'Saved'), 500);
    }

    /** Closes the opportunity as won, with a way back. @returns {void} */
    function markWon() {
      if (['won', 'lost'].includes(record.stage)) return;
      const previous = { stage: record.stage, probability: record.probability };
      record.probability = 100;
      stagePick.set('won', { silent: true });
      probabilityPick.set(100, { silent: true });
      save({ stage: 'won' }, 'marked the opportunity as won');
      notify(h('span', { class: 'toast-action' }, `${record.name} won.`,
        h('button', {
          type: 'button', class: 'link-button',
          onclick: () => {
            stagePick.set(previous.stage, { silent: true });
            probabilityPick.set(previous.probability, { silent: true });
            save(previous, `moved the opportunity back to ${stageOf(previous.stage).name}`);
          }
        }, 'Undo')));
    }

    /** Creates the next quote from the positions and files it under Quotes. @returns {void} */
    function createQuote() {
      const quotes = documents.find((node) => node.ID === 'quotes');
      const number = `QT-${26014 + quotes.children.length - 1}`;
      const id = number.toLowerCase();
      quotes.children.unshift({ ID: id, name: `${number}.pdf`, size: 128000, by: ME, added: formatDate(NOW, '%Y-%m-%d') });
      renderDocuments(['quotes', id]);
      log(`created quote ${number}`);
      tabs.openTab('documents');
      notify(`Quote ${number} created from ${POSITIONS.length} positions.`);
    }

    /** Closes the opportunity as lost once confirmed. @returns {Promise<void>} */
    async function markLost() {
      if (record.stage === 'lost') return;
      const confirmed = await Dialog.confirm({
        title: `Mark ${record.name} as lost?`,
        message: 'It leaves the open pipeline and its forecast drops to nothing.',
        okLabel: 'Mark as lost',
        danger: true
      });
      if (!confirmed) return;
      record.probability = 0;
      stagePick.set('lost', { silent: true });
      probabilityPick.set(0, { silent: true });
      save({ stage: 'lost' }, 'marked the opportunity as lost');
      notify(`${record.name} marked as lost.`, 'info');
    }
  }
};
