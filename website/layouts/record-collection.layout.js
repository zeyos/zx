import {
  Avatar, Breadcrumb, CardView, Dialog, KanbanView, MenuButton, TableView, avatarInitials, avatarTone, badge, button,
  downloadBlob, formatCurrency, formatDate, formatNumber, formatRelativeTime, h, toCsv
} from '../../src/index.js';
import {
  DATE, adaptiveShell, disposer, dot, iconButton, layoutContext, paneHeader, renderScope,
  shortcutSheet, shortcuts, suiteNav, toaster, unavailable
} from './kit.js';
import { COMPANIES, ME, NOW, TODAY, person } from './fixtures.js';
import { columnHeader, createOverview } from './overview.js';

/**
 * The workspaces this user belongs to, for the switcher at the head of the module strip. ACME is
 * the one that is open; the other two are the tenants of the same application a consultant also
 * works in, so switching is a change of company, not of module.
 */
const WORKSPACES = [
  { id: 'acme', label: 'ACME', secondary: 'Business plan · 48 members', tone: 'green' },
  { id: 'bruckner', label: 'Bruckner Logistik', secondary: 'Member', tone: 'blue' },
  { id: 'studio', label: 'Personal studio', secondary: 'Free plan', icon: 'heart', tone: 'violet' }
];

/** Workspace-level actions, listed after the workspaces in the switcher's menu. */
const WORKSPACE_ACTIONS = [
  { label: 'Create workspace', icon: 'plus', value: 'create' },
  { label: 'Workspace settings', icon: 'gear', value: 'settings' }
];

/** The stages an opportunity moves through, in pipeline order, with the status each is drawn in. */
const STAGES = [
  { id: 'discovery', label: 'Discovery', kind: 'neutral', dot: 'neutral' },
  { id: 'proposal', label: 'Proposal', kind: 'info', dot: 'info' },
  { id: 'negotiation', label: 'Negotiation', kind: 'warning', dot: 'warning' },
  { id: 'won', label: 'Won', kind: 'success', dot: 'success' },
  { id: 'lost', label: 'Lost', kind: 'danger', dot: 'danger' }
];

/** The members of staff who own opportunities, as ids into the shared `PEOPLE`. */
const OWNERS = ['tobias', 'nadine', 'piet', 'ines', 'owen', 'camille'];

/** Labels an opportunity can carry. The tone tells them apart; it says nothing about the deal. */
const TAGS = [
  { id: 'renewal', label: 'Renewal', tone: 'teal' },
  { id: 'upsell', label: 'Upsell', tone: 'violet' },
  { id: 'new-logo', label: 'New logo', tone: 'blue' },
  { id: 'partner', label: 'Partner', tone: 'amber' },
  { id: 'pilot', label: 'Pilot', tone: 'orange' },
  { id: 'public', label: 'Public sector', tone: 'slate' }
];

/** The accounts opportunities are raised against: the shared customers, then the long tail. */
const ACCOUNTS = [
  ...COMPANIES.map((entry) => entry.name),
  'Lumen Optics', 'Harbor & Finch', 'Ostara Bio', 'Pinecrest Hotels', 'Quarry Lane Studios',
  'Tessellate Labs', 'Vireo Mobility', 'Wexford Mutual', 'Corvid Security', 'Saltmarsh Foods'
];

/** What ACME sells, as the opening of an opportunity's name. */
const OFFERINGS = [
  'Plant rollout', 'Extended SLA', 'Analytics workspace', 'Fleet tracking pilot', 'Warehouse rollout',
  'Support renewal', 'Data platform', 'Integration package', 'Training programme', 'Seat expansion',
  'Security review', 'Migration project', 'Field service app', 'Reporting add-on'
];

/**
 * Generates the opportunities one mounted collection edits. A seeded generator, so every mount —
 * the thumbnail, the popup, a reload — shows the same 78 records.
 * @param {number} [count=78]
 * @returns {Array<{ID: string, name: string, company: string, stage: string, value: number,
 *   probability: number, owner: string, close: string, tags: string[], updated: string}>}
 */
function createOpportunities(count = 78) {
  let seed = 20261008;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const between = (min, max) => min + Math.floor(random() * (max - min + 1));
  const pick = (list) => list[Math.floor(random() * list.length)];
  const noon = new Date(`${TODAY}T12:00:00`).getTime();
  const day = (offset) => formatDate(new Date(noon + offset * 86_400_000), '%Y-%m-%d');
  const weights = { discovery: 22, proposal: 20, negotiation: 14, won: 12, lost: 10 };
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const stageOf = () => {
    let roll = random() * total;
    return STAGES.find((stage) => (roll -= weights[stage.id]) < 0)?.id ?? 'discovery';
  };
  const probability = { discovery: [1, 3], proposal: [3, 6], negotiation: [6, 9], won: [10, 10], lost: [0, 0] };
  return Array.from({ length: count }, (_, index) => {
    const stage = stageOf();
    const closed = stage === 'won' || stage === 'lost';
    const tags = TAGS.filter(() => random() < 0.22).slice(0, 2).map((tag) => tag.id);
    return {
      ID: `OP-${1101 + index}`,
      name: pick(OFFERINGS),
      company: pick(ACCOUNTS),
      stage,
      value: between(8, 360) * 500,
      probability: between(...probability[stage]) * 10,
      owner: pick(OWNERS),
      close: closed ? day(-between(3, 80)) : day(between(-20, 150)),
      tags,
      updated: formatDate(new Date(NOW.getTime() - between(5, 30 * 24 * 60) * 60_000), '%Y-%m-%dT%H:%M')
    };
  });
}

/**
 * The fields every presentation shares, in their default order. The views add how each one is
 * drawn (see `renderers` in `mount`); a table width and an alignment travel with the field.
 */
const FIELDS = [
  { id: 'name', label: 'Opportunity', sortable: true, view: { table: { width: '220px', popin: false } } },
  { id: 'company', label: 'Company', sortable: true, view: { table: { width: '190px' } } },
  { id: 'stage', label: 'Stage', sortable: true, view: { table: { width: '128px' } } },
  { id: 'value', label: 'Value', sortable: true, align: 'end', view: { table: { width: '112px' } } },
  { id: 'probability', label: 'Probability', sortable: true, align: 'end', view: { table: { width: '104px' } } },
  { id: 'owner', label: 'Owner', sortable: true, view: { table: { width: '160px' } } },
  { id: 'close', label: 'Close date', sortable: true, view: { table: { width: '120px' } } },
  { id: 'tags', label: 'Tags', view: { table: { width: '168px' } } },
  { id: 'updated', label: 'Updated', sortable: true, view: { table: { width: '120px' } } }
];

/** Which fields each presentation shows at first; View settings changes it per presentation. */
const VISIBLE = {
  table: ['name', 'company', 'stage', 'value', 'owner', 'close'],
  list: ['stage', 'value', 'owner', 'close'],
  cards: ['stage', 'value', 'owner', 'close', 'tags'],
  gallery: ['stage', 'owner'],
  board: ['value', 'close']
};

/**
 * What View settings knows about each field beyond the views' own descriptor: its type in the
 * ViewSettings vocabulary — the glyph and the type name a row shows — and whether it may group.
 * The opportunity's name is the record's title, so it is locked: always shown, always first. The
 * company is text, which would otherwise be offered for grouping; this collection does not.
 */
const FIELD_SETTINGS = {
  name: { type: 'text', locked: true, groupable: false },
  company: { type: 'text', groupable: false },
  stage: { type: 'status' },
  value: { type: 'money' },
  probability: { type: 'number' },
  owner: { type: 'entity' },
  close: { type: 'date' },
  tags: { type: 'tags' },
  updated: { type: 'datetime' }
};

/**
 * The fields the records can be grouped by, and laid out by on the board — as columns or as swim
 * lanes: each one's buckets in order, with the status dot a stage is drawn with.
 * @type {Record<string, import('./overview.js').OverviewGroupAxis>}
 */
const AXES = {
  stage: { label: 'Stage', buckets: STAGES.map(({ id, label, dot: tone }) => ({ id, label, tone })) },
  owner: { label: 'Owner', buckets: OWNERS.map((id) => ({ id, label: person(id).name, tone: null })) }
};

/**
 * What the filter bar can filter on, in the shape the `Filter` expression editor takes, so the
 * chips and the filter drawer share one vocabulary. Operators are the core `filterOperators` ids;
 * the icon is the field's glyph on its chip and in the drawer's field picker. A percentage prints
 * as one, and the two numbers say how their chip editor steps.
 * @type {import('./overview.js').OverviewFilterField[]}
 */
const FILTER_FIELDS = [
  {
    id: 'stage', label: 'Stage', type: 'enum', icon: 'circle-dot', operators: ['eq', 'neq', 'anyOf', 'noneOf'],
    choices: STAGES.map((stage) => ({ value: stage.id, label: stage.label }))
  },
  {
    id: 'owner', label: 'Owner', type: 'enum', icon: 'user', operators: ['anyOf', 'noneOf', 'eq', 'neq'],
    defaultOperator: 'anyOf',
    choices: OWNERS.map((id) => ({ value: id, label: person(id).name, short: person(id).name.split(' ')[0] }))
  },
  {
    id: 'value', label: 'Value', type: 'money', icon: 'coins', operators: ['gte', 'lte', 'gt', 'lt', 'between'],
    input: { unit: '€', min: 0, step: 1000, group: true }
  },
  {
    id: 'probability', label: 'Probability', type: 'number', icon: 'percent', operators: ['gte', 'lte', 'between'],
    format: (value) => `${value}%`, input: { unit: '%', min: 0, max: 100, step: 5 }
  },
  {
    id: 'close', label: 'Close date', type: 'date', icon: 'calendar',
    operators: ['before', 'after', 'onOrBefore', 'onOrAfter', 'on', 'between']
  },
  { id: 'company', label: 'Company', type: 'text', icon: 'building', operators: ['contains', 'notContains', 'eq', 'startsWith'] },
  {
    id: 'tags', label: 'Tags', type: 'tags', icon: 'tags', operators: ['containsAny', 'containsAll', 'containsNone', 'isEmpty'],
    choices: TAGS.map((tag) => ({ value: tag.id, label: tag.label }))
  }
];

/** The five presentations, in switch order: the keys 1 to 5 choose them. */
const SHAPES = ['table', 'list', 'cards', 'gallery', 'board'];

/** The keyboard reference `?` opens. */
const SHORTCUTS = [
  ['Views', [['Table', '1'], ['List', '2'], ['Cards', '3'], ['Gallery', '4'], ['Board', '5'], ['View settings', 'V']]],
  ['Filters', [['Open the filters', 'F'], ['Add a filter chip', 'Shift+F'], ['Close the filters', 'Escape'], ['Search', '/']]],
  ['General', [['New opportunity', 'N'], ['Navigation', 'Mod+B'], ['Keyboard shortcuts', '?']]]
];

/** @param {number} value Euros. @returns {string} Whole euros. */
function money(value) {
  return formatCurrency(value, 'EUR', { decimals: 0 });
}

/** @param {string} iso Local date. @returns {string} "30 Nov 2026". */
function day(iso) {
  return formatDate(new Date(`${iso.slice(0, 10)}T12:00:00`), DATE.year);
}

/** @param {string} id Stage id. @returns {(typeof STAGES)[number]} */
function stageOf(id) {
  return STAGES.find((stage) => stage.id === id) ?? STAGES[0];
}

export default {
  title: 'Record collection',
  category: 'Pattern',
  blurb: 'One record type five ways — table, list, cards, gallery, and board — under one toolbar, with filters as editable chips and a filter drawer.',
  components: [
    'ListToolbar', 'TableView', 'CardView', 'KanbanView', 'Pagination', 'Filter', 'ViewSettings', 'Sheet', 'Dropdown', 'MenuButton',
    'Select', 'Checklist', 'NumberField', 'SortControl', 'Breadcrumb', 'Dialog', 'Avatar', 'Message',
    'AppSidebar', 'ModuleBar', 'AccountMenu', 'WorkspaceSwitcher'
  ],

  /**
   * Mounts the opportunities collection: navigation, the header, and the kit's overview — the
   * toolbar, the filter chips, one of five presentations, and the pager — with this screen's own
   * cells, card previews, board column heads, and bulk bar.
   * @param {HTMLElement} container Gallery stage.
   * @param {import('./kit.js').LayoutContext} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    let records = createOpportunities();
    // Components the cell renderers make (avatars), redrawn with every page.
    const rowParts = renderScope(context);

    /* -------------------------------------------------------------- navigation -- */

    const attention = (record) => !['won', 'lost'].includes(record.stage) && record.close < TODAY;
    const saved = {
      pipeline: { shape: 'board', group: 'none', logic: 'and', conditions: [{ field: 'stage', operator: 'neq', value: 'lost' }] },
      closing: {
        shape: 'table', group: 'none', logic: 'and', conditions: [
          { field: 'stage', operator: 'anyOf', value: ['discovery', 'proposal', 'negotiation'] },
          { field: 'close', operator: 'between', value: ['2026-10-01', '2026-10-31'] }
        ]
      },
      mine: { shape: 'cards', group: 'stage', logic: 'and', conditions: [{ field: 'owner', operator: 'anyOf', value: [ME] }] }
    };
    const nav = suiteNav(context, {
      module: 'crm',
      active: 'opportunities',
      header: button({
        label: 'New opportunity', icon: 'plus', kind: 'primary', shortcut: { label: 'N', keys: 'N' },
        onclick: () => newOpportunity()
      }),
      menu: menuItems(),
      workspace: { workspaces: WORKSPACES, active: 'acme', items: WORKSPACE_ACTIONS }
    });

    const main = h('section', { class: 'shell__main collection__main', ariaLabel: 'Opportunities' });
    const root = h('div', { class: 'collection shell' }, nav.column, main);
    // Narrow, the navigation becomes a drawer opened from the header.
    const shell = adaptiveShell(root, context, { keys: true });
    const notify = toaster(context, root);
    const openShortcuts = shortcutSheet(context, SHORTCUTS);

    /** @returns {Record<string, any>[]} The module menu: destinations, saved views, and stages. */
    function menuItems() {
      const count = (match) => records.filter(match).length;
      return [
        { id: 'opportunities', label: 'All opportunities', icon: 'handshake', badge: records.length, invoke: () => applyPreset('all') },
        { id: 'attention', label: 'Needs attention', icon: 'triangle-exclamation', badge: count(attention) || undefined, invoke: () => applyPreset('attention') },
        { id: 'recent', label: 'Recently viewed', icon: 'clock-regular', invoke: () => applyPreset('recent') },
        { id: 'deleted', label: 'Deleted', icon: 'trash-can', invoke: () => notify(unavailable('The deleted opportunities'), 'info') },
        { section: true, label: 'Saved views', children: [
          { id: 'view:pipeline', label: 'Pipeline board', icon: 'columns', badge: 'Shared', invoke: () => applyPreset('pipeline') },
          { id: 'view:closing', label: 'This month', icon: 'table', badge: 'Shared', invoke: () => applyPreset('closing') },
          { id: 'view:mine', label: 'My pipeline', icon: 'table-cells-large', badge: 'Personal', invoke: () => applyPreset('mine') }
        ] },
        { section: true, label: 'Stage', children: [
          { id: 'stage:any', label: 'All stages', icon: 'circle-half-stroke', invoke: () => applyStage(null) },
          ...STAGES.map((stage) => ({
            id: `stage:${stage.id}`, label: stage.label, icon: () => dot(stage.dot),
            badge: count((record) => record.stage === stage.id), invoke: () => applyStage(stage.id)
          }))
        ] }
      ];
    }

    /** Recounts the menu's badges after records moved, changed owner, or were deleted. @returns {void} */
    function updateCounts() {
      nav.setBadge('opportunities', records.length);
      nav.setBadge('attention', records.filter(attention).length || null);
      for (const stage of STAGES) nav.setBadge(`stage:${stage.id}`, records.filter((record) => record.stage === stage.id).length);
    }

    /**
     * Applies a destination or saved view: its filters, its presentation, and its grouping.
     * @param {'all'|'attention'|'recent'|keyof typeof saved} id
     * @returns {void}
     */
    function applyPreset(id) {
      const preset = saved[id];
      const conditions = preset ? structuredClone(preset.conditions)
        : id === 'attention' ? [
          { field: 'stage', operator: 'noneOf', value: ['won', 'lost'] },
          { field: 'close', operator: 'before', value: TODAY }
        ] : [];
      nav.setActive(id === 'all' ? 'opportunities' : preset ? `view:${id}` : id);
      overview.setState({
        filters: { logic: preset?.logic ?? 'and', conditions, advanced: null },
        ...(id === 'recent' ? { sort: { id: 'updated', dir: 'desc' } } : {}),
        ...(preset ? { view: preset.shape, group: preset.group === 'none' ? null : preset.group } : {})
      });
    }

    /**
     * The Stage section: one stage becomes the stage chip, replacing any other stage condition;
     * "All stages" removes it.
     * @param {string|null} stage
     * @returns {void}
     */
    function applyStage(stage) {
      const { filters } = overview.getState();
      const conditions = filters.conditions.filter((condition) => condition.field !== 'stage');
      if (stage) conditions.unshift({ field: 'stage', operator: 'eq', value: stage });
      nav.setActive(stage ? `stage:${stage}` : 'stage:any');
      overview.setFilters({ logic: filters.logic, conditions, advanced: null });
    }

    /* ------------------------------------------------------------------ header -- */

    const crumbs = keep(new Breadcrumb(null, {
      items: [{ name: 'crm', label: 'CRM' }, { name: 'opportunities', label: 'Opportunities' }],
      onselect: ({ detail }) => {
        if (detail.name === 'crm' && context.open) context.open('crm');
      }
    }));
    const more = keep(new MenuButton(iconButton('ellipsis', 'More actions'), {
      kind: 'ghost',
      placement: 'bottom-end',
      items: [
        { label: 'Keyboard shortcuts', value: 'keys', icon: 'keyboard' },
        { label: 'Import opportunities', value: 'import', icon: 'cloud-arrow-up' },
        { label: 'Collection settings', value: 'settings', icon: 'gear' }
      ],
      onselect: ({ detail }) => {
        if (detail.value === 'keys') openShortcuts();
        else notify(unavailable(detail.item.label), 'info');
      }
    }));
    const header = paneHeader({
      size: 'page',
      leading: [shell.navToggle(), crumbs.toElement()],
      actions: [
        iconButton('arrows-rotate', 'Refresh', () => { overview.refresh(); notify('Opportunities are up to date.', 'info'); }),
        iconButton('download', 'Export as CSV', () => exportCsv()),
        more.toElement()
      ]
    });
    // The breadcrumb names the page; the heading is there for the outline and for focus.
    header.prepend(h('h2', { class: 'visually-hidden', tabindex: '-1' }, 'Opportunities'));

    /* ---------------------------------------------------------------- overview -- */

    /** How each field is drawn, shared by every presentation. */
    const renderers = {
      name: (record) => h('span', { class: 'collection__name' }, record.name),
      company: (record) => h('span', { class: 'collection__company' },
        h('span', { class: 'collection__mark', ariaHidden: 'true', dataset: { tone: avatarTone(record.company) } }, avatarInitials(record.company)),
        h('span', { class: 'collection__company-name' }, record.company)),
      stage: (record) => badge({ label: stageOf(record.stage).label, kind: stageOf(record.stage).kind, dot: true, size: 'sm' }),
      // The amount, and under it in the table a thin bar for the probability of winning it. The
      // bar is decoration: the Probability field says the number.
      value: (record) => {
        const fill = h('span', { class: 'collection__odds-fill' });
        fill.style.inlineSize = `${record.probability}%`;
        return h('span', { class: 'collection__value' },
          h('span', { class: 'collection__amount' }, money(record.value)),
          h('span', { class: 'collection__odds', ariaHidden: 'true', title: `${record.probability}% probability` }, fill));
      },
      probability: (record) => `${record.probability}%`,
      owner: (record) => h('span', { class: 'person collection__owner' },
        rowParts.own(new Avatar(null, { name: person(record.owner).name, size: 20 })).toElement(),
        h('span', { class: 'person__name' }, person(record.owner).name)),
      close: (record) => h('span', { class: 'collection__date' }, day(record.close)),
      tags: (record) => (record.tags.length
        ? h('span', { class: 'collection__tags' }, record.tags.map((id) => {
          const tag = TAGS.find((entry) => entry.id === id);
          return badge({ label: tag.label, tone: tag.tone, size: 'sm' });
        }))
        : h('span', { class: 'meta' }, '—')),
      updated: (record) => formatRelativeTime(new Date(record.updated), { now: NOW })
    };
    const sortValues = {
      stage: (record) => STAGES.findIndex((stage) => stage.id === record.stage),
      owner: (record) => person(record.owner).name
    };

    const overview = createOverview(context, {
      root,
      label: 'Opportunity controls',
      fields: FIELDS.map((field) => ({
        ...field, ...FIELD_SETTINGS[field.id], render: renderers[field.id], sortValue: sortValues[field.id]
      })),
      visible: VISIBLE,
      titleField: 'name',
      filterFields: FILTER_FIELDS,
      defaultFilters: { logic: 'and', conditions: [{ field: 'stage', operator: 'neq', value: 'lost' }], advanced: null },
      groups: AXES,
      records,
      views: SHAPES,
      view: 'table',
      sort: { id: 'value', dir: 'desc' },
      pageSize: 25,
      pageSizes: [25, 50, 100],
      search: {
        placeholder: 'Search opportunities…',
        label: 'Opportunities',
        text: (record) => [
          record.name, record.company, person(record.owner).name, stageOf(record.stage).label,
          ...record.tags.map((id) => TAGS.find((tag) => tag.id === id)?.label)
        ].join(' ')
      },
      countText: (count) => `${formatNumber(count)} ${count === 1 ? 'opportunity' : 'opportunities'}`,
      empty: {
        filtered: { title: 'No opportunities match' },
        none: { title: 'No opportunities yet', description: 'New opportunities show up here.' }
      },
      shortcuts: true,
      createView
    });

    overview.on('render', () => rowParts.reset());
    overview.on('selectionchange', ({ detail }) => syncBulk(detail.ids));
    overview.on('recordclick', ({ detail }) => openRecord(detail.record));
    overview.on('recordmove', () => updateCounts());
    // A chip removed, the drawer, or Clear all can leave the list unfiltered: the menu says so.
    overview.on('filterschange', ({ detail }) => {
      if (detail.reason === 'clear') nav.setActive('opportunities');
      else if (detail.reason === 'remove' || detail.reason === 'drawer') {
        nav.setActive(detail.filters.advanced || detail.filters.conditions.length ? null : 'opportunities');
      }
    });

    /**
     * Draws one presentation of the opportunities: the overview supplies the shared options, the
     * group rows and headings, and the board's axes; this adds the table's settings, the cards'
     * previews, and the board's column heads.
     * @param {string} shape
     * @param {import('./overview.js').OverviewViewContext} view
     * @returns {TableView|CardView|KanbanView}
     */
    function createView(shape, view) {
      if (shape === 'table') {
        return new TableView(null, {
          ...view.options,
          selectable: 'multi',
          table: {
            ...view.table,
            label: 'Opportunities',
            variant: 'plain',
            stickyHeader: true,
            responsive: 'sm',
            zebra: false
          }
        });
      }
      if (shape === 'board' && view.board) {
        const { columnBy, swimlaneBy, columnAxis } = view.board;
        return new KanbanView(null, {
          ...view.options,
          ...view.board.options,
          sortMode: 'local',
          titleField: 'name',
          subtitleField: 'company',
          assignees: (record) => person(record.owner).name,
          label: `Opportunities by ${columnAxis.label.toLowerCase()}`,
          // Each column, in each lane when there are lanes, says what it holds and what it is worth.
          renderColumnHeader: ({ column, swimlane, count }) => columnHeader({
            label: column.label,
            tone: columnAxis.buckets.find((bucket) => bucket.id === column.id)?.tone ?? null,
            lane: swimlane?.label ?? null,
            count,
            total: money(view.records()
              .filter((record) => record[columnBy] === column.id && (!swimlane || !swimlaneBy || record[swimlaneBy] === swimlane.id))
              .reduce((sum, record) => sum + record.value, 0))
          })
        });
      }
      return new CardView(null, {
        ...view.options,
        selectable: shape === 'gallery' ? false : 'multi',
        titleField: 'name',
        // Plain text: the list leads with the company's tile and the gallery's cover carries it.
        subtitleField: (record) => record.company,
        groupBy: view.groupBy,
        preview: shape === 'gallery' ? (record) => cover(record) : shape === 'list' ? (record) => tile(record) : undefined,
        minCardWidth: shape === 'list' ? '100%' : shape === 'gallery' ? '13rem' : '16rem',
        variant: 'outlined',
        label: `Opportunities as ${shape}`
      });
    }

    /**
     * A gallery card's picture: a wash of the company's tone with its initials, quiet, in the top
     * corner — the card's subtitle names the company — and the amount as a pill in the bottom one.
     * @param {Record<string, any>} record
     * @returns {HTMLElement}
     */
    function cover(record) {
      return h('div', { class: 'collection__cover', dataset: { tone: avatarTone(record.company) } },
        h('span', { class: 'collection__cover-mark', ariaHidden: 'true' }, avatarInitials(record.company)),
        h('span', { class: 'collection__cover-pill' }, h('span', { class: 'visually-hidden' }, 'Value '), money(record.value)));
    }

    /**
     * A list row's leading tile: the company's initials on its tone, avatar-sized. Decorative.
     * @param {Record<string, any>} record
     * @returns {HTMLElement}
     */
    function tile(record) {
      return h('span', { class: 'collection__tile', ariaHidden: 'true', dataset: { tone: avatarTone(record.company) } },
        avatarInitials(record.company));
    }

    /* ---------------------------------------------------------------- bulk bar -- */

    const selectedCount = h('span', { class: 'bulk-bar__count' });
    const bulk = h('div', { class: 'bulk-bar collection__bulk', role: 'region', ariaLabel: 'Bulk actions', hidden: true },
      selectedCount,
      keep(new MenuButton(null, {
        label: 'Assign', icon: 'circle-user', kind: 'ghost', placement: 'top-start',
        items: OWNERS.map((id) => ({ label: person(id).name, value: id })),
        onselect: ({ detail }) => updateSelection({ owner: String(detail.value) }, `assigned to ${person(String(detail.value)).name}`)
      })).toElement(),
      keep(new MenuButton(null, {
        label: 'Change stage', icon: 'circle-half-stroke', kind: 'ghost', placement: 'top-start',
        items: STAGES.map((stage) => ({ label: stage.label, value: stage.id })),
        onselect: ({ detail }) => updateSelection({ stage: String(detail.value) }, `moved to ${stageOf(String(detail.value)).label}`)
      })).toElement(),
      button({ label: 'Delete', icon: 'trash-can', kind: 'ghost', onclick: () => deleteSelection() }),
      iconButton('xmark', 'Clear selection', () => overview.clearSelection()));
    overview.element.append(bulk);
    main.append(header, overview.element);
    syncBulk(overview.getSelection());

    /** @param {string[]} ids Selected record ids. @returns {void} Shows the bulk bar while records are selected. */
    function syncBulk(ids) {
      bulk.hidden = ids.length === 0;
      selectedCount.textContent = `${ids.length} selected`;
    }

    /**
     * @param {Record<string, any>} changes
     * @param {string} verb How the toast says it: "assigned to Nadine Roth".
     * @returns {void}
     */
    function updateSelection(changes, verb) {
      const ids = overview.getSelection();
      for (const record of records) if (ids.includes(record.ID)) Object.assign(record, changes);
      overview.clearSelection();
      updateCounts();
      overview.refresh();
      notify(`${ids.length} ${ids.length === 1 ? 'opportunity' : 'opportunities'} ${verb}.`);
    }

    /** Deletes the selected records once confirmed. @returns {Promise<void>} */
    async function deleteSelection() {
      const ids = overview.getSelection();
      const noun = ids.length === 1 ? 'opportunity' : 'opportunities';
      const confirmed = await Dialog.confirm({
        title: `Delete ${ids.length} ${noun}?`, message: 'They move to Deleted, where they stay for 30 days.',
        okLabel: 'Delete', danger: true
      });
      if (!confirmed || context.signal.aborted) return;
      records = records.filter((record) => !ids.includes(record.ID));
      overview.clearSelection();
      updateCounts();
      overview.setData(records);
      notify(`${ids.length} ${noun} deleted.`);
    }

    /** @param {Record<string, any>} record @returns {void} */
    function openRecord(record) {
      notify(unavailable(`Opening ${record.name} for ${record.company}`), 'info');
    }

    /** @returns {void} */
    function newOpportunity() {
      notify(unavailable('Creating an opportunity'), 'info');
    }

    /** Downloads what the collection shows, every page, as CSV. @returns {void} */
    function exportCsv() {
      const columns = FIELDS.map(({ id, label }) => ({
        id, label,
        value: (record) => (id === 'owner' ? person(record.owner).name
          : id === 'stage' ? stageOf(record.stage).label
            : id === 'tags' ? record.tags.map((tag) => TAGS.find((entry) => entry.id === tag)?.label ?? tag).join(', ')
              : String(record[id]))
      }));
      downloadBlob('opportunities.csv', toCsv(overview.getFiltered(), columns), { type: 'text/csv' });
    }

    /* ---------------------------------------------------------------- keyboard -- */

    // The overview binds the shapes, F, Shift+F, V, /, and Escape; the screen adds its own.
    shortcuts(root, {
      n: () => newOpportunity(),
      '?': () => openShortcuts()
    }, context);

    container.append(root);
  }
};
