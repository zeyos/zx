import {
  Avatar, Breadcrumb, CardView, Checklist, Dialog, Dropdown, Filter, KanbanView, ListToolbar, MenuButton,
  NumberField, Pagination, Select, SortControl, TableView, avatarInitials, avatarTone, badge, button,
  downloadBlob, emptyState, filterOperators, formatCurrency, formatDate, formatNumber, formatRelativeTime, h,
  icon, toCsv
} from '../../src/index.js';
import {
  DATE, adaptiveShell, disposer, dot, iconButton, layoutContext, later, paneHeader, renderScope,
  shortcutSheet, shortcuts, suiteNav, toaster, unavailable
} from './kit.js';
import { COMPANIES, ME, NOW, TODAY, person } from './fixtures.js';

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

/** Which fields each presentation shows at first; the Fields menu changes it per presentation. */
const VISIBLE = {
  table: ['name', 'company', 'stage', 'value', 'owner', 'close'],
  list: ['stage', 'value', 'owner', 'close'],
  cards: ['stage', 'value', 'owner', 'close', 'tags'],
  gallery: ['stage', 'owner'],
  board: ['value', 'close']
};

/**
 * What the filter bar can filter on, in the shape the `Filter` expression editor takes, so the
 * chips and the advanced editor share one vocabulary. Operators are the core `filterOperators` ids.
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
  { id: 'value', label: 'Value', type: 'money', icon: 'coins', operators: ['gte', 'lte', 'gt', 'lt', 'between'] },
  { id: 'probability', label: 'Probability', type: 'number', icon: 'percent', operators: ['gte', 'lte', 'between'] },
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

/**
 * How a chip reads each operator. Symbols keep a chip short; the words beside them are what a
 * screen reader hears, and what the editor's operator menu offers.
 */
const OPERATOR_TEXT = {
  eq: ['is'], neq: ['is not'], anyOf: ['is any of'], noneOf: ['is none of'],
  gte: ['≥', 'is at least'], lte: ['≤', 'is at most'], gt: ['>', 'is more than'], lt: ['<', 'is less than'],
  between: ['between', 'is between'], before: ['before', 'is before'], after: ['after', 'is after'],
  onOrBefore: ['on or before', 'is on or before'], onOrAfter: ['on or after', 'is on or after'], on: ['on', 'is on'],
  contains: ['contains'], notContains: ['does not contain'], startsWith: ['starts with'],
  containsAny: ['has any of'], containsAll: ['has all of'], containsNone: ['has none of'], isEmpty: ['is empty']
};

/** The five presentations, in switch order: the keys 1 to 5 choose them. */
const SHAPES = ['table', 'list', 'cards', 'gallery', 'board'];

/** The keyboard reference `?` opens. */
const SHORTCUTS = [
  ['Views', [['Table', '1'], ['List', '2'], ['Cards', '3'], ['Gallery', '4'], ['Board', '5']]],
  ['Filters', [['Add a filter', 'F'], ['Search', '/']]],
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

/** @param {string} id @returns {(typeof FILTER_FIELDS)[number]} */
function filterField(id) {
  return FILTER_FIELDS.find((field) => field.id === id) ?? FILTER_FIELDS[0];
}

/** @param {string} id Operator id. @returns {'none'|'single'|'pair'|'many'} */
function arityOf(id) {
  return filterOperators.find((operator) => operator.id === id)?.arity ?? 'single';
}

/** @param {string} id Stage id. @returns {(typeof STAGES)[number]} */
function stageOf(id) {
  return STAGES.find((stage) => stage.id === id) ?? STAGES[0];
}

/**
 * The value a fresh condition starts with for an operator's arity, carried over from the previous
 * value where it still fits — switching "is" to "is any of" keeps the stage chosen.
 * @param {string} operator
 * @param {unknown} [previous]
 * @returns {unknown}
 */
function valueFor(operator, previous = null) {
  const arity = arityOf(operator);
  const first = Array.isArray(previous) ? previous[0] ?? null : previous;
  if (arity === 'none') return null;
  if (arity === 'many') return Array.isArray(previous) ? previous : first == null || first === '' ? [] : [first];
  if (arity === 'pair') return Array.isArray(previous) && previous.length === 2 ? previous : [first, null];
  return first;
}

/** @param {{operator: string, value: unknown}} condition @returns {boolean} Whether it can be applied. */
function isComplete({ operator, value }) {
  const arity = arityOf(operator);
  const present = (entry) => entry !== null && entry !== undefined && entry !== '';
  if (arity === 'none') return true;
  if (arity === 'many') return Array.isArray(value) && value.length > 0;
  if (arity === 'pair') return Array.isArray(value) && value.length === 2 && value.every(present);
  return present(value);
}

/**
 * Whether one record satisfies one condition. The local stand-in for the query a server would run:
 * dates are ISO strings, so they compare as text.
 * @param {Record<string, any>} record
 * @param {{field: string, operator: string, value: any}} condition
 * @returns {boolean}
 */
function conditionMatches(record, { field, operator, value }) {
  const actual = record[field];
  const text = (entry) => String(entry ?? '').toLowerCase();
  switch (operator) {
    case 'eq': return typeof actual === 'string' && field === 'company' ? text(actual) === text(value) : actual === value;
    case 'neq': return actual !== value;
    case 'anyOf': return Array.isArray(value) && value.includes(actual);
    case 'noneOf': return !Array.isArray(value) || !value.includes(actual);
    case 'contains': return text(actual).includes(text(value));
    case 'notContains': return !text(actual).includes(text(value));
    case 'startsWith': return text(actual).startsWith(text(value));
    case 'gt': return actual > value;
    case 'gte': return actual >= value;
    case 'lt': return actual < value;
    case 'lte': return actual <= value;
    case 'between': return Array.isArray(value) && actual >= value[0] && actual <= value[1];
    case 'on': return actual === value;
    case 'before': return actual < value;
    case 'after': return actual > value;
    case 'onOrBefore': return actual <= value;
    case 'onOrAfter': return actual >= value;
    case 'containsAny': return Array.isArray(value) && value.some((entry) => actual.includes(entry));
    case 'containsAll': return Array.isArray(value) && value.every((entry) => actual.includes(entry));
    case 'containsNone': return !Array.isArray(value) || !value.some((entry) => actual.includes(entry));
    case 'isEmpty': return Array.isArray(actual) ? actual.length === 0 : actual == null || actual === '';
    case 'isNotEmpty': return Array.isArray(actual) ? actual.length > 0 : actual != null && actual !== '';
    default: return true;
  }
}

/**
 * Whether a record satisfies a filter node: a condition, or a group of nodes joined by its logic.
 * The chips are one group; the advanced editor's expression may nest.
 * @param {Record<string, any>} record
 * @param {{kind?: string, logic?: 'and'|'or', children?: any[], field?: string, operator?: string, value?: any}} node
 * @returns {boolean}
 */
function nodeMatches(record, node) {
  if (node.kind !== 'group') return conditionMatches(record, /** @type {any} */ (node));
  if (!node.children?.length) return true;
  return node.logic === 'or'
    ? node.children.some((child) => nodeMatches(record, child))
    : node.children.every((child) => nodeMatches(record, child));
}

/** @param {any} node @returns {number} The conditions in a filter expression. */
function conditionCount(node) {
  return node.kind === 'group' ? node.children.reduce((sum, child) => sum + conditionCount(child), 0) : 1;
}

/**
 * A value as a chip prints it: a choice's label, an amount, a percentage, a date, quoted text.
 * @param {(typeof FILTER_FIELDS)[number]} field
 * @param {unknown} value
 * @param {{short?: boolean}} [options]
 * @returns {string}
 */
function formatValue(field, value, { short = false } = {}) {
  if (value == null || value === '') return '…';
  if (field.choices) {
    const choice = field.choices.find((entry) => entry.value === value);
    return (short ? choice?.short : null) ?? choice?.label ?? String(value);
  }
  if (field.type === 'money') return formatNumber(Number(value));
  if (field.type === 'number') return `${value}%`;
  if (field.type === 'date') return day(String(value));
  return `“${value}”`;
}

/**
 * @param {{field: string, operator: string, value: any}} condition
 * @returns {string} The value part of a chip: "Proposal", "50,000", "Nadine, Tobias".
 */
function describeValue({ field, operator, value }) {
  const definition = filterField(field);
  const arity = arityOf(operator);
  if (arity === 'none') return '';
  if (arity === 'pair') return `${formatValue(definition, value?.[0])} – ${formatValue(definition, value?.[1])}`;
  if (arity === 'many') {
    const labels = (Array.isArray(value) ? value : []).map((entry) => formatValue(definition, entry, { short: true }));
    if (labels.length === 0) return '…';
    return labels.length > 2 ? `${labels.slice(0, 2).join(', ')} +${labels.length - 2}` : labels.join(', ');
  }
  return formatValue(definition, value);
}

/** @param {{field: string, operator: string, value: any}} condition @returns {string} "Stage is Proposal". */
function describeCondition(condition) {
  const [, words = OPERATOR_TEXT[condition.operator]?.[0] ?? condition.operator] = OPERATOR_TEXT[condition.operator] ?? [];
  return [filterField(condition.field).label, words, describeValue(condition)].filter(Boolean).join(' ');
}

export default {
  title: 'Record collection',
  category: 'Pattern',
  blurb: 'One record type five ways — table, list, cards, gallery, and board — under one toolbar, with filters as editable chips.',
  components: [
    'ListToolbar', 'TableView', 'CardView', 'KanbanView', 'Pagination', 'Filter', 'Dropdown', 'MenuButton',
    'Select', 'Checklist', 'NumberField', 'SortControl', 'Breadcrumb', 'Dialog', 'Avatar', 'Message',
    'AppSidebar', 'ModuleBar', 'AccountMenu', 'WorkspaceSwitcher'
  ],

  /**
   * Mounts the opportunities collection: navigation, the toolbar, the filter chips, one of five
   * presentations, and the pager.
   * @param {HTMLElement} container Gallery stage.
   * @param {import('./kit.js').LayoutContext} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    let records = createOpportunities();
    // Components drawn for one presentation, its rows (redrawn on every refresh), one chip editor,
    // one value control, and one dialog.
    const viewParts = renderScope(context);
    const rowParts = renderScope(context);
    const editorParts = renderScope(context);
    const valueParts = renderScope(context);
    const dialogParts = renderScope(context);

    /**
     * Everything that decides what the collection shows. `filters.conditions` is the chip model —
     * a plain `[{field, operator, value}]` joined by `filters.logic` — and `filters.advanced`, when
     * set, a nested expression from the advanced editor that replaces the chips.
     */
    const state = {
      shape: 'table',
      query: '',
      sort: { id: 'value', dir: 'desc' },
      group: 'none',
      page: 1,
      pageSize: 25,
      filtersOpen: false,
      filters: {
        logic: /** @type {'and'|'or'} */ ('and'),
        conditions: [{ field: 'stage', operator: 'neq', value: 'lost' }],
        advanced: /** @type {any} */ (null)
      }
    };
    /** @type {{field: string, operator: string, value: any}|null} A chip being added, not yet applied. */
    let draft = null;
    /**
     * The open chip editor. `condition` is the model entry it edits — found again by identity when
     * it applies, since chips can be added or removed while it is open — or null for a new chip.
     * @type {{anchor: HTMLElement, dropdown: Dropdown, condition: Record<string, any>|null, committed: boolean}|null}
     */
    let editing = null;
    /** @type {Map<string, string>} The heading of each card group on the current page. */
    let groupTitles = new Map();
    /** @type {Record<string, any>} Field order and visibility per presentation, kept across switches. */
    const fieldStates = {};
    /** @type {Record<string, any>[]} The filtered and sorted records, before paging. */
    let filtered = [];
    /** @type {TableView|CardView|KanbanView|null} */
    let view = null;
    /** The presentation `view` was built for. */
    let viewShape = state.shape;

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
      state.filters.advanced = null;
      state.filters.logic = preset?.logic ?? 'and';
      state.filters.conditions = preset ? structuredClone(preset.conditions)
        : id === 'attention' ? [
          { field: 'stage', operator: 'noneOf', value: ['won', 'lost'] },
          { field: 'close', operator: 'before', value: TODAY }
        ] : [];
      if (id === 'recent') state.sort = { id: 'updated', dir: 'desc' };
      nav.setActive(id === 'all' ? 'opportunities' : preset ? `view:${id}` : id);
      if (preset) {
        state.group = preset.group;
        syncGroup();
        if (preset.shape !== state.shape) toolbar.setView(preset.shape);
        else mountView();
      }
      sorter.setValue(state.sort, { silent: true });
      applyFilters();
    }

    /**
     * The Stage section: one stage becomes the stage chip, replacing any other stage condition;
     * "All stages" removes it.
     * @param {string|null} stage
     * @returns {void}
     */
    function applyStage(stage) {
      state.filters.advanced = null;
      state.filters.conditions = state.filters.conditions.filter((condition) => condition.field !== 'stage');
      if (stage) state.filters.conditions.unshift({ field: 'stage', operator: 'eq', value: stage });
      nav.setActive(stage ? `stage:${stage}` : 'stage:any');
      applyFilters();
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
        iconButton('arrows-rotate', 'Refresh', () => { refresh(); notify('Opportunities are up to date.', 'info'); }),
        iconButton('download', 'Export as CSV', () => exportCsv()),
        more.toElement()
      ]
    });
    // The breadcrumb names the page; the heading is there for the outline and for focus.
    header.prepend(h('h2', { class: 'visually-hidden', tabindex: '-1' }, 'Opportunities'));

    /* ----------------------------------------------------------------- toolbar -- */

    const toolbar = keep(new ListToolbar(null, {
      label: 'Opportunity controls',
      search: { placeholder: 'Search opportunities…', debounce: 150 },
      tools: [
        { id: 'filter', icon: 'filter', label: 'Filter', pressed: false },
        { id: 'sort', icon: 'arrow-down-wide-short', label: 'Sort' },
        { id: 'group', icon: 'layer-group', label: 'Group' }
      ],
      views: SHAPES,
      view: state.shape,
      onsearch: ({ detail }) => { state.query = detail.value; refresh({ resetPage: true }); },
      onaction: ({ detail }) => { if (detail.id === 'filter') toggleFilters(); },
      onviewchange: ({ detail }) => { state.shape = detail.view; mountView(); }
    }));
    const sortFields = FIELDS.filter((field) => field.sortable).map(({ id, label }) => ({ id, label }));
    const sorter = keep(new SortControl(null, {
      fields: sortFields,
      value: state.sort,
      onchange: ({ detail }) => { state.sort = detail.value; refresh({ resetPage: true }); syncViewSort(); }
    }));
    keep(new Dropdown(toolbar.getTool('sort'), {
      content: h('div', { class: 'collection__menu' }, sorter.toElement()), placement: 'bottom-end'
    }));
    const grouping = keep(new Select(null, {
      label: 'Group by',
      items: [{ ID: 'none', name: 'No grouping' }, { ID: 'stage', name: 'Stage' }, { ID: 'owner', name: 'Owner' }],
      value: state.group,
      onchange: ({ detail }) => {
        state.group = String(detail.value ?? 'none');
        state.page = 1;
        groupMenu.close();
        toolbar.getTool('group')?.focus();
        syncGroup();
        mountView();
      }
    }));
    const groupMenu = keep(new Dropdown(toolbar.getTool('group'), {
      content: h('div', { class: 'collection__menu' },
        h('span', { class: 'collection__menu-label', ariaHidden: 'true' }, 'Group by'), grouping.toElement()),
      placement: 'bottom-end'
    }));

    /** Mirrors the grouping in the Group tool's badge and menu. @returns {void} */
    function syncGroup() {
      toolbar.setBadge('group', state.group === 'none' ? null : state.group === 'stage' ? 'Stage' : 'Owner');
      grouping.set(state.group, { silent: true });
    }

    /* --------------------------------------------------------------- filter bar -- */

    const conjunction = h('div', { class: 'collection__match' },
      h('span', { class: 'collection__match-label' }, 'Match'),
      h('div', { class: 'segmented', role: 'radiogroup', ariaLabel: 'Match conditions', onkeydown: matchKeys },
        ['and', 'or'].map((logic) => h('button', {
          type: 'button', class: 'segmented__item', role: 'radio', dataset: { logic },
          onclick: () => setLogic(logic)
        }, logic === 'and' ? 'all' : 'any'))));
    const chipList = h('ul', { class: 'collection__chips', ariaLabel: 'Active filters' });
    const addMenu = keep(new MenuButton(null, {
      label: 'Add filter',
      icon: 'plus',
      kind: 'ghost',
      items: addItems(),
      onselect: ({ detail }) => {
        // The menu hands focus back to its button as it closes; the editor opens after that.
        if (detail.value === 'advanced') later(context, () => openAdvanced(), 0);
        else later(context, () => startDraft(String(detail.value)), 0);
      }
    }));
    const addButton = /** @type {HTMLButtonElement} */ (addMenu.getTrigger());
    addButton.classList.add('collection__add');
    addButton.setAttribute('aria-keyshortcuts', 'F');
    const clearButton = button({ label: 'Clear all', kind: 'ghost', size: 'sm', onclick: () => clearFilters() });
    clearButton.classList.add('collection__clear');
    const filterBar = h('div', { class: 'collection__filters', role: 'group', ariaLabel: 'Filters' },
      conjunction, chipList, addMenu.toElement(), clearButton);

    /** @returns {Record<string, any>[]} The add menu: every field, then the advanced editor. */
    function addItems() {
      if (state.filters.advanced) return [{ label: 'Edit advanced filter…', value: 'advanced', icon: 'sliders' }];
      return [
        ...FILTER_FIELDS.map((field) => ({ label: field.label, value: field.id, icon: field.icon })),
        '-',
        { label: 'Advanced…', value: 'advanced', icon: 'sliders' }
      ];
    }

    /** Draws the chips, the conjunction, and the bar's visibility from the model. @returns {void} */
    function renderChips() {
      // The chips are about to change under an open editor: it closes rather than edit a stale chip.
      editing?.dropdown.close();
      const { conditions, advanced, logic } = state.filters;
      const active = advanced ? 1 : conditions.length;
      const chips = advanced
        ? [advancedChip(advanced)]
        : conditions.map((condition, index) => chip(condition, index));
      if (draft) chips.push(chip(draft, null));
      chipList.replaceChildren(...chips);
      conjunction.hidden = Boolean(advanced) || conditions.length + (draft ? 1 : 0) < 2;
      for (const radio of conjunction.querySelectorAll('[role="radio"]')) {
        const checked = radio.getAttribute('data-logic') === logic;
        radio.setAttribute('aria-checked', String(checked));
        radio.setAttribute('tabindex', checked ? '0' : '-1');
      }
      clearButton.hidden = active === 0;
      filterBar.hidden = active === 0 && !state.filtersOpen && !draft;
      toolbar.setBadge('filter', active || null);
      toolbar.setPressed('filter', !filterBar.hidden);
      addMenu.setItems(addItems());
    }

    /**
     * One condition as a chip: the field, the operator, and the value as one button that opens its
     * editor, and a remove button beside it.
     * @param {{field: string, operator: string, value: any}} condition
     * @param {number|null} index Its place in the model; null for the chip being added.
     * @returns {HTMLLIElement}
     */
    function chip(condition, index) {
      const field = filterField(condition.field);
      const [symbol, words = symbol] = OPERATOR_TEXT[condition.operator] ?? [condition.operator];
      const value = describeValue(condition);
      const main = h('button', {
        type: 'button', class: 'collection__chip-main', ariaHaspopup: 'dialog', ariaExpanded: 'false',
        dataset: { index: index === null ? 'draft' : String(index) },
        onclick: (event) => toggleEditor(/** @type {HTMLElement} */ (event.currentTarget), index)
      },
      icon(field.icon, { size: 13 }),
      h('span', { class: 'collection__chip-field' }, field.label),
      h('span', { class: 'collection__chip-operator' }, symbol === words ? words
        : [h('span', { ariaHidden: 'true' }, symbol), h('span', { class: 'visually-hidden' }, words)]),
      value ? h('span', { class: 'collection__chip-value' }, value) : null);
      return /** @type {HTMLLIElement} */ (h('li', { class: 'collection__chip', dataset: { draft: index === null ? 'true' : null } },
        main,
        index === null ? null : h('button', {
          type: 'button', class: 'collection__chip-remove', ariaLabel: `Remove filter: ${describeCondition(condition)}`,
          title: 'Remove filter', onclick: () => removeCondition(index)
        }, icon('xmark', { size: 12 }))));
    }

    /** @param {any} ast @returns {HTMLLIElement} The chip that stands for a nested expression. */
    function advancedChip(ast) {
      const count = conditionCount(ast.root);
      return /** @type {HTMLLIElement} */ (h('li', { class: 'collection__chip' },
        h('button', {
          type: 'button', class: 'collection__chip-main', ariaHaspopup: 'dialog', ariaExpanded: 'false', onclick: () => openAdvanced()
        },
          icon('sliders', { size: 13 }),
          h('span', { class: 'collection__chip-field' }, 'Advanced filter'),
          h('span', { class: 'collection__chip-value' }, `${count} ${count === 1 ? 'condition' : 'conditions'}`)),
        h('button', {
          type: 'button', class: 'collection__chip-remove', ariaLabel: 'Remove the advanced filter', title: 'Remove filter',
          onclick: () => { state.filters.advanced = null; applyFilters(); focusAdd(); }
        }, icon('xmark', { size: 12 }))));
    }

    /** Shows the bar, or hides it when nothing is filtered; F and the Filter tool. @returns {void} */
    function toggleFilters() {
      const active = state.filters.advanced || state.filters.conditions.length > 0;
      if (filterBar.hidden || active) {
        state.filtersOpen = true;
        renderChips();
        focusAdd();
      } else {
        state.filtersOpen = false;
        renderChips();
      }
    }

    /** Opens the bar and puts the focus on "Add filter". @returns {void} */
    function openFilters() {
      state.filtersOpen = true;
      renderChips();
      focusAdd();
    }

    /** @returns {void} */
    function focusAdd() {
      if (!context.preview) addButton.focus();
    }

    /** @param {'and'|'or'} logic @returns {void} */
    function setLogic(logic) {
      state.filters.logic = logic;
      applyFilters();
      /** @type {HTMLElement|null} */ (conjunction.querySelector(`[data-logic="${logic}"]`))?.focus();
    }

    /** @param {KeyboardEvent} event @returns {void} The arrow keys move between all and any. */
    function matchKeys(event) {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      setLogic(state.filters.logic === 'and' ? 'or' : 'and');
    }

    /** @param {number} index @returns {void} Removes a chip; the focus moves to its neighbour. */
    function removeCondition(index) {
      state.filters.conditions.splice(index, 1);
      // The bar stays open, so the focus has "Add filter" to go to when the last chip goes.
      state.filtersOpen = true;
      nav.setActive(state.filters.conditions.length ? null : 'opportunities');
      applyFilters();
      const next = chipList.querySelectorAll('.collection__chip-main')[Math.min(index, state.filters.conditions.length - 1)];
      if (next instanceof HTMLElement && !context.preview) next.focus();
      else focusAdd();
    }

    /** Removes every condition; the bar stays open on "Add filter". @returns {void} */
    function clearFilters() {
      state.filters.conditions = [];
      state.filters.advanced = null;
      state.filtersOpen = true;
      state.query = '';
      toolbar.setSearch('', { silent: true });
      nav.setActive('opportunities');
      applyFilters();
      focusAdd();
    }

    /** Redraws the chips and re-reads the records from the first page. @returns {void} */
    function applyFilters() {
      renderChips();
      refresh({ resetPage: true });
    }

    /* ------------------------------------------------------------- chip editor -- */

    /** @param {string} fieldId @returns {void} Adds a chip for a field and opens its editor. */
    function startDraft(fieldId) {
      const field = filterField(fieldId);
      const operator = field.defaultOperator ?? field.operators[0];
      editing?.dropdown.close();
      draft = { field: field.id, operator, value: valueFor(operator) };
      state.filtersOpen = true;
      renderChips();
      const anchor = chipList.querySelector('[data-index="draft"]');
      if (anchor instanceof HTMLElement) openEditor(anchor, null);
    }

    /**
     * Opens a chip's editor, or closes it when it is already open on that chip.
     * @param {HTMLElement} anchor
     * @param {number|null} index
     * @returns {void}
     */
    function toggleEditor(anchor, index) {
      if (editing?.anchor === anchor && editing.dropdown.isOpen()) editing.dropdown.close();
      else openEditor(anchor, index);
    }

    /**
     * The editor of one condition, anchored to its chip: the operator, a value control that suits
     * the field and the operator, and Apply and Remove.
     * @param {HTMLElement} anchor The chip's button.
     * @param {number|null} index The condition's place in the model; null for the chip being added.
     * @returns {void}
     */
    function openEditor(anchor, index) {
      if (context.preview) return;
      editing?.dropdown.close();
      editorParts.reset();
      valueParts.reset();
      const source = index === null ? draft : state.filters.conditions[index];
      if (!source) return;
      const target = index === null ? null : source;
      const field = filterField(source.field);
      let operator = source.operator;
      let value = structuredClone(source.value);
      const valueHost = h('div', { class: 'collection__editor-value' });
      const error = h('p', { class: 'collection__editor-error', role: 'alert', hidden: true });
      const operatorSelect = editorParts.own(new Select(null, {
        label: `${field.label} condition`,
        items: field.operators.map((id) => ({ ID: id, name: OPERATOR_TEXT[id]?.[1] ?? OPERATOR_TEXT[id]?.[0] ?? id })),
        value: operator,
        onchange: ({ detail }) => {
          operator = String(detail.value ?? field.operators[0]);
          value = valueFor(operator, value);
          drawValue();
        }
      }));
      const form = h('form', {
        class: 'collection__editor',
        onsubmit: (event) => { event.preventDefault(); commit(); },
        // Tabbing out of the editor closes it; a click outside already does.
        onfocusout: (event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && !dropdown.getPanel().contains(next)) dropdown.close();
        }
      },
      h('p', { class: 'collection__editor-title' }, icon(field.icon, { size: 14 }), field.label),
      operatorSelect.toElement(),
      valueHost,
      error,
      h('div', { class: 'collection__editor-actions' },
        button({ label: index === null ? 'Cancel' : 'Remove', kind: 'ghost', size: 'sm', onclick: () => {
          dropdown.close();
          const at = target ? state.filters.conditions.indexOf(target) : -1;
          if (at >= 0) removeCondition(at);
        } }),
        h('span', { class: 'shell__spacer' }),
        submitButton('Apply')));
      const dropdown = editorParts.own(new Dropdown(anchor, {
        content: form,
        openOn: 'manual',
        placement: 'bottom-start',
        onclose: () => afterEditorClose()
      }));
      const panel = dropdown.getPanel();
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', `Filter by ${field.label.toLowerCase()}`);
      editing = { anchor, dropdown, condition: target, committed: false };
      drawValue();
      dropdown.open();
      queueMicrotask(() => operatorSelect.focus());

      /** Replaces the value control with one for the current operator. @returns {void} */
      function drawValue() {
        valueParts.reset();
        error.hidden = true;
        valueHost.replaceChildren(...valueControls(field, operator, value, (next) => { value = next; }));
      }

      /** Applies the condition when it is complete; says what is missing otherwise. @returns {void} */
      function commit() {
        const next = { field: field.id, operator, value: arityOf(operator) === 'none' ? null : value };
        if (!isComplete(next)) {
          error.textContent = arityOf(operator) === 'pair' ? 'Enter both values.' : 'Choose a value.';
          error.hidden = false;
          return;
        }
        if (editing) editing.committed = true;
        // The condition is found by identity: chips added or removed meanwhile do not shift it.
        const conditions = state.filters.conditions;
        let position = target ? conditions.indexOf(target) : -1;
        if (position >= 0) conditions[position] = next;
        else position = conditions.push(next) - 1;
        if (index === null) draft = null;
        dropdown.close();
        applyFilters();
        const applied = chipList.querySelector(`[data-index="${position}"]`);
        if (applied instanceof HTMLElement) applied.focus();
      }
    }

    /** Drops an unapplied new chip when its editor closes, and keeps the focus in the bar. @returns {void} */
    function afterEditorClose() {
      const closing = editing;
      editing = null;
      if (!closing || closing.committed || closing.condition !== null) return;
      draft = null;
      renderChips();
      // Escape restores the focus to the anchor, which is gone; "Add filter" takes it instead.
      queueMicrotask(() => {
        const active = document.activeElement;
        if (!active || active === document.body || !active.isConnected || closing.dropdown.getPanel().contains(active)) focusAdd();
      });
    }

    /**
     * The controls that edit a condition's value: none, one, or a pair, each suited to the field —
     * a text field, a choice, a list of checkboxes, a number, or a date.
     * @param {(typeof FILTER_FIELDS)[number]} field
     * @param {string} operator
     * @param {any} value
     * @param {(next: any) => void} set
     * @returns {Node[]}
     */
    function valueControls(field, operator, value, set) {
      const arity = arityOf(operator);
      if (arity === 'none') return [h('p', { class: 'collection__editor-note' }, 'No value needed.')];
      if (arity === 'many') {
        const checklist = valueParts.own(new Checklist(null, {
          items: field.choices.map((choice) => ({ ID: choice.value, name: choice.label, on: value.includes(choice.value) })),
          search: field.choices.length > 8,
          height: 220,
          hideLabel: true,
          msg: { 'checklist.label': field.label },
          onchange: ({ detail }) => set([...detail.values])
        }));
        return [checklist.toElement()];
      }
      if (arity === 'pair') {
        const pair = Array.isArray(value) ? [...value] : [null, null];
        const end = (position) => single(field, pair[position], (next) => { pair[position] = next; set([...pair]); },
          position === 0 ? `${field.label} from` : `${field.label} to`);
        return [h('div', { class: 'collection__editor-pair' }, end(0), h('span', { class: 'meta' }, 'and'), end(1))];
      }
      return [single(field, value, set, `${field.label} value`)];
    }

    /**
     * One value control.
     * @param {(typeof FILTER_FIELDS)[number]} field
     * @param {any} value
     * @param {(next: any) => void} set
     * @param {string} label Accessible name.
     * @returns {Node}
     */
    function single(field, value, set, label) {
      if (field.choices) {
        return valueParts.own(new Select(null, {
          label, placeholder: 'Choose…', items: field.choices.map((choice) => ({ ID: choice.value, name: choice.label })),
          value, onchange: ({ detail }) => set(detail.value ?? null)
        })).toElement();
      }
      if (field.type === 'money' || field.type === 'number') {
        const money = field.type === 'money';
        return valueParts.own(new NumberField(null, {
          label, value, min: 0, max: money ? null : 100, step: money ? 1000 : 5, unit: money ? '€' : '%', group: money,
          onchange: ({ detail }) => set(detail.value), oninput: ({ detail }) => set(detail.value)
        })).toElement();
      }
      return h('input', {
        type: field.type === 'date' ? 'date' : 'text', class: 'collection__editor-input', value: value ?? '',
        ariaLabel: label, placeholder: field.type === 'date' ? null : 'Type a value',
        oninput: (event) => set(/** @type {HTMLInputElement} */ (event.target).value || null)
      });
    }

    /* ---------------------------------------------------------- advanced filter -- */

    /**
     * Opens the expression editor with the current filter. On apply, an expression the chips can
     * show — one level of complete conditions — becomes chips again; anything nested becomes one
     * "Advanced filter" chip.
     * @returns {void}
     */
    function openAdvanced() {
      if (context.preview) return;
      dialogParts.reset();
      const { advanced, conditions, logic } = state.filters;
      const value = advanced ?? {
        version: 1,
        root: {
          kind: 'group', id: 'filter-root', logic,
          children: conditions.map((condition, index) => ({ kind: 'condition', id: `condition-${index}`, ...structuredClone(condition) }))
        }
      };
      const editor = dialogParts.own(new Filter(null, {
        fields: FILTER_FIELDS.map(({ id, label, type, operators, defaultOperator, choices }) => ({ id, label, type, operators, defaultOperator, choices })),
        value,
        layout: 'compact',
        maxDepth: 2,
        showApply: false,
        showRootActions: false,
        onapply: ({ detail }) => {
          const root = /** @type {any} */ (detail.value).root;
          const flat = root.children.every((child) => child.kind === 'condition' && isComplete(child));
          state.filters.advanced = flat ? null : detail.value;
          if (flat) {
            state.filters.logic = root.logic;
            state.filters.conditions = root.children.map(({ field, operator, value: entry }) => ({ field, operator, value: entry }));
          }
          dialog.close();
          nav.setActive(null);
          applyFilters();
          focusAdd();
        }
      }));
      const dialog = dialogParts.own(new Dialog(null, {
        title: 'Advanced filter',
        size: 'lg',
        content: h('div', { class: 'collection__advanced' },
          h('p', { class: 'meta' }, 'Group conditions to combine “all” and “any”. A filter without groups shows as chips again.'),
          editor.toElement()),
        buttons: [{ label: 'Cancel', action: 'cancel' }, { label: 'Apply filter', kind: 'primary', action: () => editor.apply() }]
      }));
      dialog.on('close', () => later(context, () => dialogParts.reset(), 0));
      dialog.open();
    }

    /* -------------------------------------------------------------------- body -- */

    const body = h('div', { class: 'shell__body collection__body', tabindex: '-1' });
    const pager = keep(new Pagination(null, {
      pageSize: state.pageSize,
      pageSizes: [25, 50, 100],
      total: 0,
      onchange: ({ detail }) => {
        state.page = detail.page;
        state.pageSize = detail.pageSize;
        refresh();
        if (!context.preview) body.scrollTop = 0;
      }
    }));
    const footer = h('div', { class: 'shell__footer collection__footer' }, pager.toElement());

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
      iconButton('xmark', 'Clear selection', () => view?.clearSelection()));

    main.append(header, h('div', { class: 'collection__frame' },
      h('div', { class: 'collection__toolbar' }, toolbar.toElement()),
      filterBar, body, footer, bulk));

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
    const fields = FIELDS.map((field) => ({ ...field, render: renderers[field.id], sortValue: sortValues[field.id] }));

    /**
     * Builds the presentation the switch shows and feeds it the current slice. Field order and
     * visibility are kept per presentation, so switching back finds them as they were left.
     * @returns {void}
     */
    function mountView() {
      if (view && !(view instanceof KanbanView)) fieldStates[viewShape] = view.getViewState();
      editing?.dropdown.close();
      viewParts.reset();
      viewShape = state.shape;
      view = viewParts.own(createView(state.shape));
      const kept = fieldStates[state.shape];
      if (kept && !(view instanceof KanbanView)) view.setViewState({ fieldOrder: kept.fieldOrder, hiddenFields: kept.hiddenFields }, { silent: true });
      body.dataset.shape = state.shape;
      body.replaceChildren(view.toElement());
      footer.hidden = state.shape === 'board';
      refresh();
    }

    /**
     * @param {string} shape
     * @returns {TableView|CardView|KanbanView}
     */
    function createView(shape) {
      const hiddenFields = FIELDS.map((field) => field.id).filter((id) => !VISIBLE[shape].includes(id));
      const empty = () => emptyState({
        icon: 'filter', size: 'sm', title: 'No opportunities match',
        description: 'Change the search or the filters to see more.',
        actions: [{ label: 'Clear filters', onclick: () => clearFilters() }]
      });
      const shared = {
        fields, data: [], recordId: 'ID', sort: state.sort, sortMode: /** @type {const} */ ('server'), hiddenFields,
        emptyText: empty,
        onsortchange: ({ detail }) => {
          if (!detail.id) return;
          state.sort = { id: detail.id, dir: detail.dir ?? 'asc' };
          sorter.setValue(state.sort, { silent: true });
          refresh({ resetPage: true });
        },
        onselectionchange: () => syncBulk(),
        onrecordclick: ({ detail }) => openRecord(detail.record)
      };
      const fieldControls = { label: 'Fields', target: toolbar.getToolsElement() };
      if (shape === 'table') {
        return new TableView(null, {
          ...shared,
          selectable: 'multi',
          fieldControls,
          table: {
            variant: 'plain',
            stickyHeader: true,
            responsive: 'sm',
            zebra: false,
            rowKind: 'kind',
            rowKinds: { group: { span: true, class: 'collection__group-row', render: (row) => groupHeading(row) } }
          }
        });
      }
      if (shape === 'board') {
        return new KanbanView(null, {
          ...shared,
          sortMode: 'local',
          fieldControls: false,
          columnBy: 'stage',
          columns: STAGES.map(({ id, label }) => ({ id, label })),
          swimlaneBy: state.group === 'owner' ? 'owner' : null,
          swimlanes: state.group === 'owner' ? OWNERS.map((id) => ({ id, label: person(id).name })) : null,
          titleField: 'name',
          subtitleField: 'company',
          assignees: (record) => person(record.owner).name,
          moveMode: 'external',
          label: 'Opportunities by stage',
          // Each column, in each owner's lane when grouped, says what it holds and what it is worth.
          renderColumnHeader: ({ column, swimlane, count }) => h('span', { class: 'collection__column-head' },
            dot(stageOf(column.id).dot),
            h('span', { class: 'collection__column-label' }, column.label),
            h('span', { class: 'collection__count' }, String(count)),
            h('span', { class: 'collection__column-total' }, money(filtered
              .filter((record) => record.stage === column.id && (!swimlane || record.owner === swimlane.id))
              .reduce((sum, record) => sum + record.value, 0)))),
          onrecordmove: ({ detail }) => {
            for (const id of detail.ids) {
              const record = records.find((entry) => entry.ID === id);
              if (!record) continue;
              record.stage = detail.to.column;
              if (detail.to.lane && state.group === 'owner') record.owner = detail.to.lane;
            }
            updateCounts();
            refresh();
          }
        });
      }
      // The records arrive sorted by group, so the groups follow in that order and only the groups
      // on the page appear. Each heading says how many of the group's records the page holds.
      const groupBy = state.group === 'none' ? null : (record) => groupTitles.get(groupOf(record)?.id) ?? '';
      return new CardView(null, {
        ...shared,
        selectable: shape === 'gallery' ? false : 'multi',
        fieldControls,
        titleField: 'name',
        // Plain text: the list leads with the company's tile and the gallery's cover carries it.
        subtitleField: (record) => record.company,
        groupBy,
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

    /** @param {Record<string, any>} row A group row. @returns {HTMLElement} Its label and count. */
    function groupHeading(row) {
      return h('span', { class: 'collection__group' },
        row.tone ? dot(row.tone) : null,
        h('span', { class: 'collection__group-label' }, row.label),
        h('span', { class: 'collection__count' }, row.count));
    }

    /**
     * Re-reads the records: filter, search, sort, then the page the pager points at. The board gets
     * every match; the table gets a heading row before each group.
     * @param {{resetPage?: boolean}} [options]
     * @returns {void}
     */
    function refresh({ resetPage = false } = {}) {
      const needle = state.query.trim().toLowerCase();
      const { conditions, advanced, logic } = state.filters;
      const expression = advanced ? advanced.root : { kind: 'group', logic, children: conditions };
      filtered = records.filter((record) => nodeMatches(record, expression) && (!needle || [
        record.name, record.company, person(record.owner).name, stageOf(record.stage).label,
        ...record.tags.map((id) => TAGS.find((tag) => tag.id === id)?.label)
      ].join(' ').toLowerCase().includes(needle)));
      filtered = sortRecords(filtered);
      if (resetPage) state.page = 1;
      pager.setState({ total: filtered.length, pageSize: state.pageSize, page: state.page }, { silent: true });
      const { page, offset } = pager.getState();
      state.page = page;
      const slice = state.shape === 'board' ? filtered : filtered.slice(offset, offset + state.pageSize);
      if (!view) return;
      groupTitles = new Map(groups().map((group) => [group.id, `${group.label} · ${groupCount(group, slice)}`]));
      rowParts.reset();
      view.setData(state.shape === 'table' ? withGroupRows(slice) : slice);
      syncViewSort();
      syncBulk();
    }

    /**
     * @param {Record<string, any>[]} rows
     * @returns {Record<string, any>[]} The rows sorted by the current sort; ties keep their order.
     */
    function sortRecords(rows) {
      const { id, dir } = state.sort;
      const read = sortValues[id] ?? ((record) => record[id]);
      const factor = dir === 'desc' ? -1 : 1;
      // Grouped, the group order comes first, so a page cuts through the groups in order rather
      // than scattering each group over every page. The board groups by its own columns.
      const list = groups();
      const rank = (record) => (list.length && state.shape !== 'board' ? list.findIndex((group) => group.match(record)) : 0);
      return rows.map((record, index) => ({ record, index })).sort((a, b) => {
        const left = read(a.record);
        const right = read(b.record);
        const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
        return rank(a.record) - rank(b.record) || order * factor || a.index - b.index;
      }).map(({ record }) => record);
    }

    /**
     * @returns {Array<{id: string, label: string, tone: string|null, match: (record: Record<string, any>) => boolean}>}
     *   The groups of the current grouping, in order; none while ungrouped.
     */
    function groups() {
      if (state.group === 'stage') {
        return STAGES.map((stage) => ({ id: stage.id, label: stage.label, tone: stage.dot, match: (record) => record.stage === stage.id }));
      }
      if (state.group === 'owner') {
        return OWNERS.map((id) => ({ id, label: person(id).name, tone: null, match: (record) => record.owner === id }));
      }
      return [];
    }

    /** @param {Record<string, any>} record @returns {ReturnType<typeof groups>[number]|undefined} Its group. */
    function groupOf(record) {
      return groups().find((group) => group.match(record));
    }

    /**
     * How many of a group's records a page shows: "16", or "4 of 16" where the group runs on to
     * another page. The total counts every filtered record, not just the page.
     * @param {ReturnType<typeof groups>[number]} group
     * @param {Record<string, any>[]} slice
     * @returns {string}
     */
    function groupCount(group, slice) {
      const shown = slice.filter(group.match).length;
      const total = filtered.filter(group.match).length;
      return shown === total ? String(total) : `${shown} of ${total}`;
    }

    /**
     * The table's rows for one page: grouped, a heading row before each group.
     * @param {Record<string, any>[]} slice
     * @returns {Record<string, any>[]}
     */
    function withGroupRows(slice) {
      if (state.group === 'none') return slice;
      return groups().flatMap((group) => {
        const members = slice.filter(group.match);
        return members.length ? [{
          ID: `group:${group.id}`, kind: 'group', label: group.label, tone: group.tone, count: groupCount(group, slice)
        }, ...members] : [];
      });
    }

    /** Points the table header's sort indicator at the current sort. @returns {void} */
    function syncViewSort() {
      // A grouped table has no header sort (its headings would scatter); the Sort menu still sorts.
      const grouped = view instanceof TableView && state.group !== 'none';
      if (view && !grouped && !(view instanceof KanbanView)) view.setSort(state.sort.id, state.sort.dir, { silent: true });
    }

    /** @returns {string[]} The selected records' ids, group headings left out. */
    function selection() {
      if (!view || view instanceof KanbanView) return [];
      return view.getSelectionIds().map(String).filter((id) => !id.startsWith('group:'));
    }

    /** Shows the bulk bar while records are selected. @returns {void} */
    function syncBulk() {
      const ids = selection();
      bulk.hidden = ids.length === 0;
      selectedCount.textContent = `${ids.length} selected`;
    }

    /**
     * @param {Record<string, any>} changes
     * @param {string} verb How the toast says it: "assigned to Nadine Roth".
     * @returns {void}
     */
    function updateSelection(changes, verb) {
      const ids = selection();
      for (const record of records) if (ids.includes(record.ID)) Object.assign(record, changes);
      view?.clearSelection();
      updateCounts();
      refresh();
      notify(`${ids.length} ${ids.length === 1 ? 'opportunity' : 'opportunities'} ${verb}.`);
    }

    /** Deletes the selected records once confirmed. @returns {Promise<void>} */
    async function deleteSelection() {
      const ids = selection();
      const noun = ids.length === 1 ? 'opportunity' : 'opportunities';
      const confirmed = await Dialog.confirm({
        title: `Delete ${ids.length} ${noun}?`, message: 'They move to Deleted, where they stay for 30 days.',
        okLabel: 'Delete', danger: true
      });
      if (!confirmed || context.signal.aborted) return;
      records = records.filter((record) => !ids.includes(record.ID));
      view?.clearSelection();
      updateCounts();
      refresh();
      notify(`${ids.length} ${noun} deleted.`);
    }

    /** @param {Record<string, any>} record @returns {void} */
    function openRecord(record) {
      if (!record || record.kind === 'group') return;
      notify(unavailable(`Opening ${record.name} for ${record.company}`), 'info');
    }

    /**
     * @param {string} label
     * @returns {HTMLButtonElement} A primary button that submits the form it is in.
     */
    function submitButton(label) {
      const element = button({ label, kind: 'primary', size: 'sm' });
      element.type = 'submit';
      return element;
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
      downloadBlob('opportunities.csv', toCsv(filtered, columns), { type: 'text/csv' });
    }

    /* ---------------------------------------------------------------- keyboard -- */

    shortcuts(root, {
      f: () => openFilters(),
      '/': () => toolbar.focusSearch(),
      n: () => newOpportunity(),
      '?': () => openShortcuts(),
      ...Object.fromEntries(SHAPES.map((shape, index) => [String(index + 1), () => toolbar.setView(shape)]))
    }, context);

    syncGroup();
    renderChips();
    mountView();
    container.append(root);
  }
};
