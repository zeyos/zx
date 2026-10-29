import {
  ActivityList, Avatar, Breadcrumb, CardView, ContextMenu, Datebox, Dialog, InlineLoading, KanbanView,
  Launcher, MenuButton, Select, TagPicker, badge, button, copyToClipboard, formatDate, formatRelativeTime,
  h, icon
} from '../../src/index.js';
import {
  DATE, adaptiveShell, disposer, iconButton, kbd, later, layoutContext, modShortcut, modifierLabel,
  paneHeader, panelBlock, renderScope, shortcuts, suiteNav, toaster, unavailable
} from './kit.js';
import { ME, NOW, PEOPLE, TODAY, person } from './fixtures.js';
import { axisChoices, columnHeader, createOverview } from './overview.js';

/** The teams that own issues; the key prefixes every issue number. */
const TEAMS = [
  { id: 'ENG', name: 'Engineering', icon: 'code' },
  { id: 'DES', name: 'Design', icon: 'pen' }
];

/** Workflow states in list order. `indicator` and `tone` are what `Select.status()` draws. */
const STATUSES = [
  { ID: 'in-progress', name: 'In progress', indicator: 'progress', tone: 'warning' },
  { ID: 'todo', name: 'Todo', indicator: 'ring', tone: 'neutral' },
  { ID: 'backlog', name: 'Backlog', indicator: 'dotted', tone: 'muted' },
  { ID: 'done', name: 'Done', indicator: 'done', tone: 'success' },
  { ID: 'canceled', name: 'Canceled', indicator: 'canceled', tone: 'muted' }
];

/** The same states left to right, the order work flows across the board. */
const BOARD_ORDER = ['backlog', 'todo', 'in-progress', 'done', 'canceled'];

/** Priority levels, 0 (lowest) to 4; only the top one, urgent, is drawn in colour. */
const PRIORITIES = ['Lowest', 'Low', 'Medium', 'High', 'Urgent'];
const URGENT = PRIORITIES.length - 1;

/** Story-point estimates, the scale the team plans with. */
const ESTIMATES = [1, 2, 3, 5, 8, 13, 21];

/** Labels are categories, so they take a tone from the categorical palette, never a status colour. */
const LABELS = [
  { ID: 'bug', name: 'Bug', tone: 'red' },
  { ID: 'feature', name: 'Feature', tone: 'violet' },
  { ID: 'improvement', name: 'Improvement', tone: 'blue' },
  { ID: 'performance', name: 'Performance', tone: 'amber' },
  { ID: 'customer', name: 'Customer', tone: 'teal' },
  { ID: 'docs', name: 'Docs', tone: 'slate' }
];

const PROJECTS = [
  { ID: 'reporting', name: 'Reporting API v2' },
  { ID: 'portal', name: 'Customer portal' },
  { ID: 'warehouse', name: 'Warehouse rollout' },
  { ID: 'billing', name: 'Billing migration' },
  { ID: 'system', name: 'Design system refresh' }
];

/** Two-week cycles, first and last day. */
const CYCLES = [
  { ID: 40, name: 'Cycle 40', start: '2026-09-14', end: '2026-09-27' },
  { ID: 41, name: 'Cycle 41', start: '2026-09-28', end: '2026-10-11' },
  { ID: 42, name: 'Cycle 42', start: '2026-10-12', end: '2026-10-25' }
];

/**
 * The issues. `n` is the number within the team, `by` who filed it, `inbox` whether the signed-in
 * user has an unread notification about it, and `parent` links a sub-issue to its issue.
 */
const ISSUES = [
  { team: 'ENG', n: 142, title: 'Pagination skips rows when the cursor lands on a deleted record', status: 'in-progress', priority: 4, assignee: 'camille', labels: ['bug', 'customer'], project: 'reporting', cycle: 41, estimate: 3, due: '2026-10-09', by: 'owen', created: '2026-09-30T10:12', inbox: true },
  { team: 'ENG', n: 147, title: 'Raise the export rate limit for scheduled jobs', status: 'in-progress', priority: 3, assignee: 'piet', labels: ['performance', 'customer'], project: 'reporting', cycle: 41, estimate: 5, due: '2026-10-14', by: 'owen', created: '2026-10-02T15:40' },
  { team: 'ENG', n: 139, title: 'Move depot scanners to the new dispatch API', status: 'in-progress', priority: 3, assignee: 'jonas', labels: ['feature'], project: 'warehouse', cycle: 41, estimate: 8, due: '2026-10-16', by: 'ines', created: '2026-09-22T09:00' },
  { team: 'ENG', n: 150, title: 'Rotate signing keys for the customer portal', status: 'in-progress', priority: 2, assignee: 'jonas', labels: ['improvement'], project: 'portal', cycle: 41, estimate: 2, by: 'jonas', created: '2026-10-05T11:30' },
  { team: 'ENG', n: 152, title: 'Backfill exports affected by skipped rows', status: 'todo', priority: 3, assignee: 'owen', labels: ['customer'], project: 'reporting', cycle: 41, estimate: 3, due: '2026-10-12', by: 'piet', created: '2026-10-08T09:20', parent: 'ENG-142', inbox: true },
  { team: 'ENG', n: 145, title: 'Sign off the depot migration checklist', status: 'todo', priority: 3, assignee: 'ines', labels: ['docs'], project: 'warehouse', cycle: 41, estimate: 1, due: '2026-10-09', by: 'jonas', created: '2026-10-03T08:45', inbox: true },
  { team: 'ENG', n: 144, title: 'Show invoice status in the customer portal', status: 'todo', priority: 2, assignee: 'piet', labels: ['feature'], project: 'portal', cycle: 42, estimate: 5, by: 'nadine', created: '2026-10-01T13:05' },
  { team: 'ENG', n: 148, title: 'Single sign-on for the partner workspace', status: 'todo', priority: 3, assignee: null, labels: ['feature', 'customer'], project: 'portal', cycle: 42, estimate: 8, due: '2026-10-30', by: 'tobias', created: '2026-10-04T16:20' },
  { team: 'ENG', n: 153, title: 'Alert when a depot stays offline for ten minutes', status: 'todo', priority: 2, assignee: 'jonas', labels: ['improvement'], project: 'warehouse', cycle: 41, estimate: 2, by: 'lea', created: '2026-10-07T07:50' },
  { team: 'ENG', n: 141, title: 'Flaky timeout in the nightly import job', status: 'backlog', priority: 2, assignee: 'owen', labels: ['bug', 'performance'], project: 'reporting', by: 'owen', created: '2026-09-25T22:10' },
  { team: 'ENG', n: 140, title: 'Search across invoice line items', status: 'backlog', priority: 2, assignee: null, labels: ['feature'], project: 'billing', by: 'ruth', created: '2026-09-24T10:00' },
  { team: 'ENG', n: 138, title: 'Archive audit logs older than two years', status: 'backlog', priority: 1, assignee: 'piet', labels: ['improvement'], project: 'billing', by: 'ruth', created: '2026-09-18T14:15' },
  { team: 'ENG', n: 136, title: 'Decommission the legacy dispatch tool', status: 'backlog', priority: 1, assignee: 'jonas', labels: ['improvement'], project: 'warehouse', by: 'ines', created: '2026-09-15T09:30' },
  { team: 'ENG', n: 133, title: 'Bulk edit for price lists', status: 'backlog', priority: 1, assignee: null, labels: ['feature', 'customer'], project: 'billing', by: 'nadine', created: '2026-09-11T11:45' },
  { team: 'ENG', n: 131, title: 'Print delivery notes without the dark page background', status: 'backlog', priority: 0, assignee: null, labels: ['bug'], project: 'warehouse', by: 'lea', created: '2026-09-08T08:10' },
  { team: 'ENG', n: 151, title: 'Regression test for cursor pagination', status: 'done', priority: 2, assignee: 'camille', labels: ['bug'], project: 'reporting', cycle: 41, estimate: 1, by: 'camille', created: '2026-10-07T16:30', parent: 'ENG-142' },
  { team: 'ENG', n: 143, title: 'VAT rounding is off by a cent on credit notes', status: 'done', priority: 3, assignee: 'camille', labels: ['bug', 'customer'], project: 'billing', cycle: 41, estimate: 2, by: 'ruth', created: '2026-09-29T10:40' },
  { team: 'ENG', n: 146, title: 'Customer-facing changelog for October', status: 'done', priority: 1, assignee: 'tobias', labels: ['docs'], project: 'portal', cycle: 41, estimate: 1, by: 'tobias', created: '2026-10-01T09:00' },
  { team: 'ENG', n: 137, title: 'Paginate the depot list on mobile', status: 'done', priority: 1, assignee: 'piet', labels: ['bug'], project: 'warehouse', cycle: 40, estimate: 2, by: 'lea', created: '2026-09-16T12:20' },
  { team: 'ENG', n: 135, title: 'Upgrade the database driver to the current LTS', status: 'done', priority: 2, assignee: 'camille', labels: ['improvement', 'performance'], project: 'reporting', cycle: 40, estimate: 3, by: 'camille', created: '2026-09-14T09:10' },
  { team: 'ENG', n: 134, title: 'Replace the charting library', status: 'canceled', priority: 0, assignee: 'piet', labels: ['improvement'], project: 'reporting', by: 'piet', created: '2026-09-10T15:00' },
  { team: 'ENG', n: 132, title: 'Native app for depot drivers', status: 'canceled', priority: 1, assignee: null, labels: ['feature'], project: 'warehouse', by: 'tobias', created: '2026-09-09T10:30' },
  { team: 'DES', n: 41, title: 'Redesign the invoice status badges', status: 'in-progress', priority: 2, assignee: 'marta', labels: ['improvement'], project: 'system', cycle: 41, estimate: 3, due: '2026-10-10', by: 'marta', created: '2026-09-28T10:00' },
  { team: 'DES', n: 45, title: 'Scanner screen readable at arm’s length', status: 'todo', priority: 3, assignee: 'marta', labels: ['customer'], project: 'warehouse', cycle: 41, estimate: 2, due: '2026-10-13', by: 'lea', created: '2026-10-06T08:15', inbox: true },
  { team: 'DES', n: 44, title: 'Empty states for the customer portal', status: 'todo', priority: 2, assignee: 'marta', labels: ['feature'], project: 'portal', cycle: 42, estimate: 3, by: 'nadine', created: '2026-10-02T14:00' },
  { team: 'DES', n: 42, title: 'Motion guidelines for overlays', status: 'backlog', priority: 1, assignee: null, labels: ['docs'], project: 'system', by: 'marta', created: '2026-09-21T11:00' },
  { team: 'DES', n: 38, title: 'Audit focus rings in dark mode', status: 'backlog', priority: 2, assignee: null, labels: ['improvement'], project: 'system', by: 'camille', created: '2026-09-12T09:40' },
  { team: 'DES', n: 39, title: 'Icon set for delivery states', status: 'done', priority: 1, assignee: 'marta', labels: ['feature'], project: 'system', cycle: 40, estimate: 2, by: 'marta', created: '2026-09-15T13:30' }
];

/** Descriptions, one paragraph per entry; issues without one show an empty-description hint. */
const DESCRIPTIONS = {
  'ENG-142': [
    'Kestrel reported missing rows in Tuesday’s nightly export. Every page boundary that lands on a soft-deleted record drops the first row of the next page.',
    'The cursor compares against the deleted row’s sort key, so the next query starts one row too late. The fix reads the key from the last row returned instead.',
    'Acceptance: the export of Kestrel’s dataset matches a full table scan, and the regression test covers deletions on both sides of a boundary.'
  ],
  'ENG-147': [
    'Scheduled exports share the interactive rate limit and start failing at about 40 requests per minute. Jobs run at night, so they can safely use a separate, higher ceiling.',
    'Proposal: a per-tenant limit for scheduled jobs, configurable by support, defaulting to 200 requests per minute.'
  ],
  'ENG-139': ['The depot scanners still post to the legacy dispatch endpoint. Move them to the new API depot by depot, starting with Munich, and keep the old route until the last depot is migrated.'],
  'ENG-145': ['Go through the migration checklist with each depot lead and sign it off before procurement orders the new scanners.'],
  'ENG-152': ['List every export that ran between 22 September and the fix, regenerate them, and let the affected customers know through their account managers.'],
  'DES-41': ['The status badges on invoices rely on colour alone. Add a shape per status and check the contrast of every pair in both themes.']
};

/** Comments and property changes that happened before the layout opened. */
const HISTORY = {
  'ENG-142': [
    { actor: 'owen', at: '2026-09-30T10:20', comment: 'Reproduced with Kestrel’s dataset: page 14 ends on a deleted invoice and page 15 starts one row late.' },
    { actor: 'camille', at: '2026-10-06T09:05', change: 'changed status from Todo to In progress' },
    { actor: 'camille', at: '2026-10-06T09:06', change: 'set priority to Urgent' },
    { actor: 'camille', at: '2026-10-07T16:40', comment: 'Root cause found — the cursor reads the deleted row’s key. The fix is in review and ENG-151 adds the regression test.' },
    { actor: 'piet', at: '2026-10-08T09:20', comment: 'Once this lands we should backfill the affected exports. Opened ENG-152 for that.' }
  ],
  'ENG-147': [
    { actor: 'piet', at: '2026-10-06T11:00', change: 'changed status from Todo to In progress' },
    { actor: 'owen', at: '2026-10-07T10:15', comment: 'Kestrel’s export failed again last night at 02:14. They would like an estimate.' }
  ]
};

/** Navigation scopes: what each destination lists, how its title reads, and its grouping. */
const SCOPES = {
  inbox: { crumbs: ['Inbox'], test: (issue) => issue.inbox },
  mine: { crumbs: ['My issues'], test: (issue) => issue.assignee === ME },
  'all-projects': { crumbs: ['Projects'], test: () => true, group: 'project' },
  'view-due': { crumbs: ['Views', 'Due this week'], test: (issue) => isDueWithin(issue, 7), group: 'assignee' },
  'view-customer': { crumbs: ['Views', 'Customer issues'], test: (issue) => issue.labels.includes('customer') },
  ...Object.fromEntries(TEAMS.flatMap((team) => [
    [`${team.id}-issues`, { crumbs: [team.name, 'Issues'], test: (issue) => issue.team === team.id }],
    [`${team.id}-cycle`, { crumbs: [team.name, 'Cycle 41'], test: (issue) => issue.team === team.id && issue.cycle === 41 }],
    [`${team.id}-projects`, { crumbs: [team.name, 'Projects'], test: (issue) => issue.team === team.id, group: 'project' }]
  ]))
};

/** The fixed tabs above the overview: which part of the scope it lists, each with its count. */
const TABS = [
  { id: 'all', label: 'All issues', test: () => true },
  { id: 'active', label: 'Active', test: (issue) => ['in-progress', 'todo'].includes(issue.status) },
  { id: 'backlog', label: 'Backlog', test: (issue) => issue.status === 'backlog' }
];

/**
 * The fields of an issue, in the order a row shows them. Priority, ID, and status lead the row
 * before the title (`view.card.slot`); the rest follow it. The renderers are added in `mount`,
 * where they can own the avatars they draw. Priority, due date, and created are what the Sort
 * tool offers, as the former Ordering menu did.
 */
const FIELDS = [
  { id: 'priority', label: 'Priority', type: 'select', sortable: true, view: { card: { slot: 'title-prefix' } } },
  { id: 'key', label: 'ID', type: 'text', groupable: false, view: { card: { slot: 'title-prefix' } } },
  {
    id: 'status', label: 'Status', type: 'status',
    sortValue: (issue) => STATUSES.findIndex((status) => status.ID === issue.status), view: { card: { slot: 'title-prefix' } }
  },
  { id: 'title', label: 'Title', type: 'text', locked: true, groupable: false },
  { id: 'project', label: 'Project', type: 'select' },
  { id: 'labels', label: 'Labels', type: 'tags' },
  // Issues without a due date sort after every dated one.
  { id: 'due', label: 'Due date', type: 'date', sortable: true, sortValue: (issue) => issue.due ?? '9999-12-31' },
  { id: 'assignee', label: 'Assignee', type: 'entity' },
  { id: 'created', label: 'Created', type: 'datetime', sortable: true }
];

/** What each shape shows at first; View settings changes it per shape. */
const VISIBLE = {
  list: ['priority', 'key', 'status', 'labels', 'due', 'assignee', 'created'],
  board: ['priority', 'key', 'labels', 'due', 'assignee']
};

/**
 * What the issues group by, in each grouping's order — also the board's columns and swim lanes.
 * Status groups the list in workflow order, most active first; the board lays its columns out in
 * `BOARD_ORDER` instead (see `createBoard`). Priority groups urgent first. An issue without an
 * assignee or a project falls in the axis's `other` bucket, which the filter offers too.
 * @type {Record<string, import('./overview.js').OverviewGroupAxis>}
 */
const AXES = {
  status: { label: 'Status', buckets: STATUSES.map((status) => ({ id: status.ID, label: status.name })) },
  assignee: {
    label: 'Assignee', buckets: PEOPLE.map((p) => ({ id: p.id, label: p.name })),
    other: { id: 'none', label: 'Unassigned' }
  },
  priority: { label: 'Priority', buckets: PRIORITIES.map((label, level) => ({ id: level, label })).reverse() },
  project: {
    label: 'Project', buckets: PROJECTS.map((project) => ({ id: project.ID, label: project.name })),
    other: { id: 'none', label: 'No project' }
  }
};

/**
 * What the filter chips and the Filters drawer can test; the grouped fields offer exactly the
 * buckets their groups show.
 * @type {import('./overview.js').OverviewFilterField[]}
 */
const FILTER_FIELDS = [
  {
    id: 'status', label: 'Status', type: 'enum', icon: 'circle-half-stroke', operators: ['anyOf', 'noneOf', 'eq', 'neq'],
    choices: axisChoices(AXES.status)
  },
  {
    id: 'assignee', label: 'Assignee', type: 'enum', icon: 'user', operators: ['anyOf', 'noneOf', 'eq', 'neq'],
    choices: axisChoices(AXES.assignee).map((choice) => ({ ...choice, short: choice.label.split(' ')[0] }))
  },
  {
    id: 'priority', label: 'Priority', type: 'enum', icon: 'signal', operators: ['anyOf', 'noneOf', 'eq', 'neq'],
    choices: axisChoices(AXES.priority)
  },
  {
    id: 'labels', label: 'Labels', type: 'tags', icon: 'tags', operators: ['containsAny', 'containsAll', 'containsNone', 'isEmpty'],
    choices: LABELS.map((label) => ({ value: label.ID, label: label.name }))
  },
  {
    id: 'project', label: 'Project', type: 'enum', icon: 'cube', operators: ['anyOf', 'noneOf', 'eq', 'neq'],
    choices: axisChoices(AXES.project)
  }
];

/**
 * A group, column, or lane id — as a board reports it, text — written back as the issue property
 * it stands for.
 * @param {string} field Grouping field.
 * @param {string|number|null} id Bucket id.
 * @returns {unknown}
 */
function fromBucket(field, id) {
  if (field === 'priority') return Number(id);
  if (field === 'assignee' || field === 'project') return id == null || id === 'none' || id === '' ? null : String(id);
  return String(id);
}

/**
 * The bucket an issue falls in on a grouping, as text: its group's stable id.
 * @param {string} field Grouping field.
 * @param {Record<string, any>} issue
 * @returns {string}
 */
function bucketKey(field, issue) {
  const value = issue[field];
  return value == null ? 'none' : String(value);
}

/**
 * Finds an entry of one of the lookup lists above by its `ID`.
 * @template {{ID: unknown}} T
 * @param {T[]} list
 * @param {unknown} id
 * @returns {T|undefined}
 */
function byId(list, id) {
  return list.find((entry) => entry.ID === id);
}

/**
 * @param {string} iso An ISO date, with or without a time.
 * @returns {Date} The moment, read as local time.
 */
function toDate(iso) {
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
}

/**
 * @param {string} iso
 * @returns {string} A short calendar date such as "9 Oct".
 */
function shortDate(iso) {
  return formatDate(toDate(iso), DATE.short);
}

/**
 * @param {{start: string, end: string}} cycle
 * @returns {string} The cycle's first and last day, such as "28 Sep – 11 Oct".
 */
function cycleDates(cycle) {
  return `${shortDate(cycle.start)} – ${shortDate(cycle.end)}`;
}

/**
 * @param {{due?: string|null}} issue
 * @param {number} days
 * @returns {boolean} Whether the issue is due between today and `days` from now.
 */
function isDueWithin(issue, days) {
  if (!issue.due) return false;
  const delta = (toDate(issue.due).getTime() - toDate(TODAY).getTime()) / 86_400_000;
  return delta >= 0 && delta <= days;
}

/**
 * The workflow-state glyph, drawn the same way `Select.status()` draws it.
 * @param {string} id Status id.
 * @returns {HTMLElement}
 */
function statusGlyph(id) {
  const status = byId(STATUSES, id) ?? STATUSES[0];
  return h('span', {
    class: 'tracker__status', 'aria-hidden': 'true',
    dataset: { indicator: status.indicator, tone: status.tone }
  }, status.indicator === 'done' ? icon('check', { size: 8 })
    : status.indicator === 'canceled' ? icon('x', { size: 7 }) : null);
}

/**
 * The priority glyph: four grey bars, one more filled per level, and a red square with an
 * exclamation mark for urgent — the one level that should catch the eye in a long list.
 * @param {number} level 0–4.
 * @returns {HTMLElement}
 */
function priorityGlyph(level) {
  return h('span', { class: 'tracker__priority', 'aria-hidden': 'true', dataset: { level } },
    level === URGENT ? null : [0, 1, 2, 3].map((bar) => h('span', { dataset: { filled: String(bar <= level) } })));
}

/** @returns {HTMLElement} The dashed circle that stands where an assignee's avatar would be. */
function unassignedGlyph() {
  return h('span', { class: 'tracker__nobody', title: 'Unassigned', 'aria-hidden': 'true' }, icon('user', { size: 12 }));
}

/**
 * Text for screen readers only, beside a glyph that says the same thing to the eye.
 * @param {string} text
 * @returns {HTMLElement}
 */
function hidden(text) {
  return h('span', { class: 'visually-hidden' }, text);
}

/**
 * A label as a badge in its categorical tone.
 * @param {string} id Label id.
 * @returns {HTMLElement}
 */
function labelChip(id) {
  const label = byId(LABELS, id);
  return badge({ label: label?.name ?? id, tone: label?.tone ?? 'slate' });
}

/**
 * A priority picker: the Select preset's glyphs, every issue has a priority, and urgent comes
 * first — the order the list groups by and the filter lists.
 * @param {import('../../src/components/select/select.js').SelectOptions} options
 * @returns {Select}
 */
function priorityPicker(options) {
  const select = Select.priority(null, {
    clearable: false, msg: { 'priority.highest': PRIORITIES[URGENT] }, ...options
  });
  return select.setItems(PRIORITIES.map((name, level) => ({ ID: level, name, level })).reverse());
}

/**
 * TagPicker options for labels: every option is drawn as the chip it becomes, and a picked label
 * takes its tone from the item, as the chip does.
 * @returns {import('../../src/components/tag-picker/tag-picker.js').TagPickerOptions}
 */
function labelPicker() {
  return {
    items: LABELS,
    renderItem: (label) => labelChip(label.ID)
  };
}

/**
 * A segmented control: a radio group whose checked option is its one tab stop and whose arrow keys
 * move the choice, as the APG radio group pattern has it; `counts` adds a number after each label.
 * @param {{label: string, options: Array<{id: string, label: string}>,
 *   counts?: boolean, onchange: (id: string) => void, signal: AbortSignal}} config
 * @returns {{element: HTMLElement, set: (id: string) => void, setCount: (id: string, count: number) => void}}
 */
function segmented({ label, options, counts = false, onchange, signal }) {
  const buttons = options.map((option) => h('button', {
    type: 'button', class: 'segmented__item', role: 'radio', dataset: { id: option.id },
    onclick: () => onchange(option.id)
  }, option.label, counts ? h('span', { class: 'segmented__count' }) : null));
  const element = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label }, buttons);
  element.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const checked = buttons.findIndex((item) => item.getAttribute('aria-checked') === 'true');
    const next = buttons[(checked + step + buttons.length) % buttons.length];
    onchange(next.dataset.id);
    next.focus();
  }, { signal });
  return {
    element,
    set(id) {
      for (const item of buttons) {
        item.setAttribute('aria-checked', String(item.dataset.id === id));
        item.tabIndex = item.dataset.id === id ? 0 : -1;
      }
    },
    setCount(id, count) {
      const item = buttons.find((entry) => entry.dataset.id === id);
      if (item) item.querySelector('.segmented__count').textContent = String(count);
    }
  };
}

export default {
  title: 'Issue tracker',
  category: 'Product',
  blurb: 'Issues grouped by status or on a board, filtered with editable chips, each with sub-issues, '
    + 'activity, and properties edited in place.',
  components: [
    'ListToolbar', 'CardView', 'KanbanView', 'Pagination', 'Filter', 'ViewSettings', 'SortControl', 'Sheet',
    'ContextMenu', 'Select', 'TagPicker', 'ActivityList', 'Launcher', 'Breadcrumb', 'Datebox', 'Dialog',
    'MenuButton', 'Dropdown', 'InlineLoading', 'Avatar', 'Badge', 'Message', 'AppSidebar', 'ModuleBar', 'AccountMenu'
  ],

  /**
   * Mounts the tracker: navigation, the kit's overview of the issues — toolbar, filter chips, the
   * grouped list or the board, and the pager — under fixed tabs, the open issue, and the
   * properties of the issue in focus.
   * @param {HTMLElement} container Gallery stage.
   * @param {import('./kit.js').LayoutContext} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);

    // A private, mutable copy of the data, so every mount starts from the same state.
    const issues = ISSUES.map((issue) => ({
      ...issue, key: `${issue.team}-${issue.n}`, labels: [...issue.labels],
      due: issue.due ?? null, cycle: issue.cycle ?? null, estimate: issue.estimate ?? null,
      parent: issue.parent ?? null, inbox: Boolean(issue.inbox)
    })).sort((a, b) => b.created.localeCompare(a.created));
    // Newest first, so issues of one priority — the default sort — list the newest on top; a new
    // issue joins at the front.
    const descriptions = new Map(Object.entries(DESCRIPTIONS));
    const activity = new Map(issues.map((issue) => [issue.key, [
      { actor: issue.by, at: issue.created, change: 'created the issue' },
      ...(HISTORY[issue.key] ?? [])
    ]]));
    // The search, the filters, the grouping, the sort, and the shape are the overview's state.
    const state = { scope: 'ENG-issues', tab: 'all', mode: 'list', current: 'ENG-142', subscribed: true };
    /** Where the focus goes back to once a property picked from the keyboard closes its menu. */
    let returnFocus = /** @type {false|'list'|'issue'} */ (false);
    // Whether the properties drawer was opened for one key-picked property, and closes after it.
    let closeAside = false;

    // The list's rows, the open issue, and the aside are redrawn as a whole; the avatars drawn into
    // each belong to that rendering and are released by the next one.
    const rowParts = renderScope(context);
    // The list's collapsed groups, by id ("status:done"), across redraws and regroupings.
    const collapsedGroups = new Set();
    const issueParts = renderScope(context);
    const asideParts = renderScope(context);

    /**
     * An Avatar for a staff member, owned by the rendering it is drawn into.
     * @param {string|null} id Person id.
     * @param {ReturnType<typeof renderScope>} scope
     * @returns {HTMLElement}
     */
    function face(id, scope) {
      return scope.own(new Avatar(null, { name: person(id)?.name ?? '', size: 'sm' })).toElement();
    }

    /**
     * The Select options for picking a person: searchable, clearable, an Avatar beside each name.
     * A Select redraws its options as the query changes, so each picker keeps one Avatar per
     * person for its options and one for its value, and moves them into the new rendering.
     * @returns {import('../../src/components/select/select.js').SelectOptions}
     */
    function personPicker() {
      const avatars = new Map();
      const avatar = (place, id) => {
        const key = `${place}:${id}`;
        if (!avatars.has(key)) avatars.set(key, keep(new Avatar(null, { name: person(id)?.name ?? '', size: 'sm' })));
        return avatars.get(key).toElement();
      };
      return {
        items: PEOPLE, valueKey: 'id', labelKey: 'name', clearable: true, filter: 'local',
        renderItem: (p) => h('span', { class: 'tracker__option' }, avatar('option', p.id), p.name),
        renderValueAdornment: (p) => avatar('value', p.id)
      };
    }

    /** @param {string} key @returns {(typeof issues)[number]|undefined} */
    const find = (key) => issues.find((issue) => issue.key === key);

    // ------------------------------------------------------------------ navigation --

    // The suite's navigation, with the tracker's menu in the Projects module: the personal
    // destinations, then the workspace's and the teams' under their own sections.
    const nav = suiteNav(context, {
      module: 'projects',
      menu: menuItems(),
      active: state.scope,
      expanded: ['ENG'],
      header: button({
        label: 'New issue', icon: 'pen-to-square', kind: 'primary',
        shortcut: { label: 'C', keys: 'C' }, onclick: () => openCreate()
      }),
      onsearch: () => openLauncher(),
      account: {
        items: [{ label: 'Preferences', value: 'prefs', icon: 'gear' }, '-', { label: 'Sign out', value: 'out' }],
        onselect: ({ detail }) => notify(unavailable(detail.value === 'out' ? 'Signing out' : 'Preferences'), 'info')
      }
    });
    // Narrow, the navigation becomes a drawer, and so do the properties: below 1180px the open
    // issue keeps the whole width and its properties wait behind a button (or S, P, A, L).
    const root = h('div', { class: 'tracker shell' }, nav.column);
    const shell = adaptiveShell(root, context, { asideLabel: 'Show properties' });

    /** @returns {Array<Record<string, any>>} The tracker's menu, with the unread count on Inbox. */
    function menuItems() {
      const unread = issues.filter((issue) => issue.inbox).length;
      return withInvoke([
        { id: 'inbox', label: 'Inbox', icon: 'inbox', badge: unread || undefined },
        { id: 'mine', label: 'My issues', icon: 'circle-user' },
        { section: true, label: 'Workspace', children: [
          { id: 'all-projects', label: 'Projects', icon: 'cube' },
          { id: 'views', label: 'Views', icon: 'layer-group', children: [
            { id: 'view-due', label: 'Due this week' }, { id: 'view-customer', label: 'Customer issues' }
          ] }
        ] },
        { section: true, label: 'Your teams', children: TEAMS.map((team) => ({
          id: team.id, label: team.name, icon: team.icon, children: [
            { id: `${team.id}-issues`, label: 'Issues' }, { id: `${team.id}-cycle`, label: 'Cycles' },
            { id: `${team.id}-projects`, label: 'Projects' }
          ]
        })) }
      ]);
    }

    /**
     * Gives every leaf destination an `invoke` that switches the list to its scope.
     * @param {Array<Record<string, any>>} items
     * @returns {Array<Record<string, any>>}
     */
    function withInvoke(items) {
      return items.map((item) => item.children?.length
        ? { ...item, children: withInvoke(item.children) }
        : { ...item, invoke: () => setScope(item.id) });
    }

    /** Shows the number of unread notifications on Inbox. @returns {void} */
    function updateInboxBadge() {
      nav.setBadge('inbox', issues.filter((issue) => issue.inbox).length || null);
    }

    // ------------------------------------------------------------------- main pane --

    const crumbs = keep(new Breadcrumb(null, {
      items: [],
      onselect: ({ detail }) => (detail.name === 'list' ? backToList() : setScope(detail.name))
    }));

    // Which part of the scope the overview lists, beside the trail: All, Active, Backlog, each
    // with its count, which ignores the search and the filters.
    const tabs = segmented({
      label: 'Which issues', options: TABS, counts: true, signal: context.signal,
      onchange: (id) => { state.tab = id; overview.setBaseFilter(inScope); renderCounts(); }
    });

    const more = keep(new MenuButton(iconButton('ellipsis', 'More actions'), {
      kind: 'ghost', placement: 'bottom-end',
      items: [
        { label: 'Copy issue ID', value: 'copy', icon: 'copy' },
        '-',
        { label: 'Delete issue…', value: 'delete', icon: 'trash', danger: true }
      ],
      onselect: ({ detail }) => (detail.value === 'copy' ? copyKey(state.current) : deleteIssue(state.current))
    }));

    // On a phone the More menu's "Copy issue ID" stands in for the link button.
    const copyButton = iconButton('link', 'Copy issue ID', () => copyKey(state.current));
    copyButton.dataset.narrow = 'hide';
    const issueActions = h('div', { class: 'tracker__actions', hidden: true },
      iconButton('angle-up', 'Previous issue', () => move(-1), { shortcut: { label: 'K', keys: 'K' } }),
      iconButton('angle-down', 'Next issue', () => move(1), { shortcut: { label: 'J', keys: 'J' } }),
      copyButton, more.toElement(), shell.asideToggle());

    const issueBody = h('div', {
      class: 'shell__body shell__body--padded', tabindex: '-1', 'aria-label': 'Issue', hidden: true
    });

    const header = paneHeader({
      className: 'tracker__header', leading: [shell.navToggle(), crumbs.toElement()], actions: [issueActions]
    });
    // The trail names the page; the heading is there for the outline, above the list's groups.
    header.prepend(h('h2', { class: 'visually-hidden' }, 'Issues'));
    // The tabs follow the trail as a header item of their own, so a narrow pane can give them a
    // row of their own beneath it.
    header.querySelector('.shell__header-leading').after(tabs.element);

    // The tracker's own keys, bound before the overview's so that they come first: Escape leaves
    // an open issue or drops the selection before the overview closes a drawer with it, and / in
    // an open issue returns to the list's search.
    shortcuts(root, {
      // J and K are the list's down and up arrows; in an open issue they open the next and the
      // previous one.
      j: () => rowKey('ArrowDown'), k: () => rowKey('ArrowUp'), x: toggleSelect,
      // On a group's heading, C creates the issue in that group.
      c: () => openCreate(focusedGroupPreset()),
      s: () => editProperty('status'), p: () => editProperty('priority'),
      a: () => editProperty('assignee'), l: () => editProperty('labels'),
      Escape: () => {
        if (state.mode === 'issue') return backToList();
        if (root.hasAttribute('data-overview-drawer') || !overview.getSelection().length) return false;
        overview.clearSelection();
        focusRow();
      },
      '/': () => {
        if (state.mode !== 'issue') return false;
        backToList();
        overview.toolbar.focusSearch();
      },
      'Mod+k': () => openLauncher()
    }, context);

    /** How each field is drawn in a list row. */
    const renderers = {
      priority: (issue) => h('span', { class: 'tracker__cell' }, priorityGlyph(issue.priority), hidden(PRIORITIES[issue.priority])),
      key: (issue) => h('span', { class: 'tracker__key' }, issue.key),
      status: (issue) => h('span', { class: 'tracker__cell' }, statusGlyph(issue.status), hidden(byId(STATUSES, issue.status)?.name ?? '')),
      // The title carries the issue's key, so the layout finds the row of an issue.
      title: (issue) => {
        const children = issues.filter((child) => child.parent === issue.key);
        const done = children.filter((child) => child.status === 'done').length;
        return h('span', { class: 'tracker__title', dataset: { key: issue.key } },
          h('span', { class: 'tracker__title-text' }, issue.title),
          children.length ? h('span', { class: 'tracker__subcount meta' },
            h('span', { 'aria-hidden': 'true' }, icon('sitemap', { size: 11 }), `${done}/${children.length}`),
            hidden(`, ${done} of ${children.length} sub-issues done`)) : null);
      },
      project: (issue) => (issue.project
        ? h('span', { class: 'tracker__project meta' }, icon('cube', { size: 12 }), byId(PROJECTS, issue.project)?.name ?? '')
        : hidden('None')),
      labels: (issue) => (issue.labels.length ? h('span', { class: 'tracker__labels' }, issue.labels.map(labelChip)) : hidden('None')),
      due: (issue) => (issue.due ? dueChip(issue) : hidden('None')),
      assignee: (issue) => (issue.assignee ? face(issue.assignee, rowParts)
        : h('span', { class: 'tracker__cell' }, unassignedGlyph(), hidden('Unassigned'))),
      created: (issue) => h('span', { class: 'tracker__date meta' }, shortDate(issue.created))
    };

    const overview = createOverview(context, {
      root,
      label: 'Issue controls',
      fields: FIELDS.map((field) => ({ ...field, render: renderers[field.id] })),
      visible: VISIBLE,
      titleField: 'title',
      filterFields: FILTER_FIELDS,
      // Moving a card on the board writes, and logs, through the tracker's own update.
      groups: Object.fromEntries(Object.entries(AXES).map(([field, axis]) => [field, {
        ...axis, set: (issue, bucket) => update(issue, { [field]: fromBucket(field, bucket) }, { quiet: true })
      }])),
      group: SCOPES[state.scope].group ?? 'status',
      // On the board, status is the columns: grouping by it shows the plain status board, and the
      // grouping returns on the way back to the list.
      boardCollision: 'drop',
      records: issues,
      baseFilter: inScope,
      recordId: 'key',
      views: ['list', 'board'],
      view: 'list',
      sort: { id: 'priority', dir: 'desc' },
      pageSize: 50,
      pageSizes: [25, 50, 100],
      search: {
        placeholder: 'Find issues…',
        label: 'Issues',
        text: (issue) => `${issue.key} ${issue.title}`
      },
      countText: (count) => `${count} issue${count === 1 ? '' : 's'}`,
      empty: {
        filtered: { title: 'No issues match' },
        none: {
          icon: 'list-check', title: 'No issues here', description: 'Create an issue to get started.',
          actions: [{ label: 'New issue', onclick: () => openCreate() }]
        }
      },
      shortcuts: true,
      createView
    });

    const selectedCount = h('span', { class: 'bulk-bar__count' });
    const bulkStatus = keep(new MenuButton(null, {
      label: 'Status', icon: 'circle-half-stroke', kind: 'ghost', placement: 'top-start',
      items: STATUSES.map((s) => ({ label: s.name, value: s.ID })),
      onselect: ({ detail }) => bulkUpdate({ status: detail.value })
    }));
    const bulkAssignee = keep(new MenuButton(null, {
      label: 'Assignee', icon: 'user', kind: 'ghost', placement: 'top-start',
      items: [...PEOPLE.map((p) => ({ label: p.name, value: p.id })), '-', { label: 'Unassigned', value: '' }],
      onselect: ({ detail }) => bulkUpdate({ assignee: detail.value || null })
    }));
    const bulk = h('div', { class: 'bulk-bar tracker__bulk', role: 'region', 'aria-label': 'Bulk actions', hidden: true },
      selectedCount, bulkStatus.toElement(), bulkAssignee.toElement(),
      iconButton('xmark', 'Clear selection', () => overview.clearSelection()));
    overview.element.append(bulk);

    const main = h('section', { class: 'shell__main tracker__main', 'aria-label': 'Issues' },
      header, overview.element, issueBody);

    // ------------------------------------------------------------- properties aside --

    const saving = keep(new InlineLoading(null, { status: 'inactive', size: 'sm' }));
    const statusPick = keep(Select.status(null, {
      items: STATUSES, label: 'Status', onchange: ({ detail }) => edit({ status: detail.value })
    }));
    const priorityPick = keep(priorityPicker({
      label: 'Priority', onchange: ({ detail }) => edit({ priority: detail.value })
    }));
    const assigneePick = keep(new Select(null, {
      ...personPicker(), label: 'Assignee', placeholder: 'Unassigned',
      onchange: ({ detail }) => edit({ assignee: detail.value ?? null })
    }));
    const estimatePick = keep(new Select(null, {
      items: ESTIMATES.map((points) => ({ ID: points, name: `${points} point${points === 1 ? '' : 's'}` })),
      label: 'Estimate', placeholder: 'Estimate', clearable: true,
      renderValueAdornment: () => icon('gauge'),
      onchange: ({ detail }) => edit({ estimate: detail.value ?? null })
    }));
    const duePick = keep(new Datebox(null, {
      placeholder: 'Due date', clearable: true,
      onchange: ({ detail }) => edit({ due: detail.date ? formatDate(detail.date, '%Y-%m-%d') : null })
    }));
    const labelPick = keep(new TagPicker(null, {
      ...labelPicker(), placeholder: 'Add label', onchange: ({ detail }) => edit({ labels: detail.values })
    }));
    const projectPick = keep(new Select(null, {
      items: PROJECTS, label: 'Project', placeholder: 'No project', clearable: true,
      renderValueAdornment: () => icon('cube'),
      onchange: ({ detail }) => edit({ project: detail.value ?? null })
    }));
    const cyclePick = keep(new Select(null, {
      items: CYCLES, label: 'Cycle', placeholder: 'No cycle', clearable: true,
      renderItem: (cycle) => h('span', { class: 'tracker__option' }, cycle.name, h('span', { class: 'meta' }, cycleDates(cycle))),
      renderValueAdornment: () => icon('arrows-rotate'),
      onchange: ({ detail }) => edit({ cycle: detail.value ?? null })
    }));
    const pickers = { status: statusPick, priority: priorityPick, assignee: assigneePick, labels: labelPick };

    // The aside reads as text: every property is a quiet field that shows its frame only when
    // pointed at, led by the glyph of its value — the status ring, the priority bars, the
    // assignee's face — under the heading of its group.
    const asideTitle = h('span', { class: 'tracker__aside-key' });
    const asideHeading = h('p', { class: 'record-title record-title--sm' });
    const asideMeta = h('p', { class: 'tracker__aside-meta meta' });
    const recent = keep(new ActivityList(null, { label: 'Recent activity' }));
    const recentBlock = panelBlock('Recent activity', recent.toElement());
    const aside = h('aside', { class: 'shell__aside shell__aside--wide', 'aria-label': 'Issue properties' },
      paneHeader({
        title: asideTitle,
        actions: [saving.toElement(), iconButton('expand', 'Open issue', () => {
          shell.toggleAside(false);
          openIssue(state.current);
        })]
      }),
      h('div', { class: 'shell__body tracker__props', 'data-zx-fields': 'quiet' },
        h('div', { class: 'tracker__aside-head' }, asideHeading, asideMeta),
        panelBlock('Properties', h('div', { class: 'tracker__fields' },
          statusPick.toElement(), priorityPick.toElement(), assigneePick.toElement(), estimatePick.toElement(),
          // A Datebox has no adornment slot, so its row carries the icon beside it.
          h('div', { class: 'tracker__field' }, icon('calendar-regular'), duePick.toElement()))),
        panelBlock('Labels', h('div', { class: 'tracker__fields' }, labelPick.toElement())),
        panelBlock('Project', h('div', { class: 'tracker__fields' }, projectPick.toElement(), cyclePick.toElement())),
        recentBlock));

    root.append(main, aside);
    const notify = toaster(context, root);

    // --------------------------------------------------------------------- the list --

    /**
     * The overview's base filter: whether an issue is in the scope of the navigation and the tab.
     * @param {(typeof issues)[number]} issue
     * @returns {boolean}
     */
    function inScope(issue) {
      return SCOPES[state.scope].test(issue) && TABS.find((entry) => entry.id === state.tab).test(issue);
    }

    /**
     * Re-reads the issues after they changed — an issue may leave the scope or the tab — and
     * updates the tabs and the trail.
     * @returns {void}
     */
    function syncList() {
      overview.refresh();
      renderCounts();
    }

    /**
     * Updates what describes the list: the tabs and their counts, and the breadcrumb.
     * @returns {void}
     */
    function renderCounts() {
      tabs.set(state.tab);
      for (const tab of TABS) {
        tabs.setCount(tab.id, issues.filter((issue) => SCOPES[state.scope].test(issue) && tab.test(issue)).length);
      }
      const trail = SCOPES[state.scope].crumbs;
      const home = TEAMS.find((team) => team.name === trail[0]);
      crumbs.setItems([
        ...(trail.length > 1 ? [{ name: home ? `${home.id}-issues` : 'view-due', label: trail[0] }] : []),
        { name: 'list', label: trail.at(-1) },
        ...(state.mode === 'issue' ? [{ name: 'issue', label: state.current }] : [])
      ]);
    }

    /**
     * After the overview drew a page: the issue in focus stays one the list shows, its row is
     * marked, and the aside follows it.
     * @returns {void}
     */
    function afterRender() {
      if (state.mode === 'list') {
        const shown = overview.getFiltered();
        if (!shown.some((issue) => issue.key === state.current)) state.current = shown[0]?.key ?? state.current;
      }
      markCurrent();
      renderAside();
    }

    /**
     * Draws one presentation of the issues for the overview: the list as rows, or the board.
     * @param {string} shape
     * @param {import('./overview.js').OverviewViewContext} view
     * @returns {CardView|KanbanView}
     */
    function createView(shape, view) {
      if (shape === 'board' && view.board) return createBoard(view);
      // One row per issue: a CardView whose cards the stylesheet lays out as the tracker's dense
      // rows — one Tab stop, the arrow keys between rows — under collapsible group headings. The
      // groups take ids of their own ("status:todo"), so a collapsed group stays collapsed as its
      // count changes.
      const field = view.state.group;
      return new CardView(null, {
        ...view.options,
        selectable: 'multi',
        keyboard: 'roving',
        titleField: 'title',
        groupBy: field ? (issue) => `${field}:${bucketKey(field, issue)}` : null,
        collapsibleGroups: true,
        collapsedGroups: [...collapsedGroups],
        renderGroupHeading: ({ id, count }) => groupHeading(id, count, view),
        ongroupcollapse: ({ detail }) => collapsedGroups[detail.collapsed ? 'add' : 'delete'](detail.id),
        minCardWidth: '100%',
        label: 'Issue list'
      });
    }

    /**
     * A group heading's content, inside its collapse toggle: the glyph of its value, its name, and
     * how many issues it holds ("4", or "2 of 9" where the group runs on to another page).
     * @param {string} id Group id, `<field>:<bucket>`.
     * @param {number} count Issues of the group on this page.
     * @param {import('./overview.js').OverviewViewContext} view
     * @returns {HTMLElement}
     */
    function groupHeading(id, count, view) {
      const [field, bucket] = id.split(':');
      const axis = AXES[field];
      const label = [...axis.buckets, axis.other].find((entry) => entry && String(entry.id) === bucket)?.label ?? bucket;
      const total = view.records().filter((issue) => bucketKey(field, issue) === bucket).length;
      return h('span', { class: 'tracker__group', dataset: { group: id } },
        bucketGlyph(field, bucket), h('span', { class: 'tracker__group-name' }, label),
        h('span', { class: 'tracker__group-count' }, count === total ? String(total) : `${count} of ${total}`));
    }

    /**
     * Gives each group heading its "New issue in <group>" button, beside the collapse toggle —
     * not inside it, where a button may not go. The heading rows are redrawn with the list, so
     * this runs whenever the list changes and skips the rows that have one.
     * @returns {void}
     */
    function decorateGroups() {
      for (const header of overview.body.querySelectorAll('.zx-card-view__group-header:not(:has(.tracker__group-add))')) {
        const group = header.querySelector('.tracker__group[data-group]');
        if (!group) continue;
        const name = group.querySelector('.tracker__group-name')?.textContent ?? '';
        const add = iconButton('plus', `New issue in ${name}`, () => openCreate(groupPreset(group.dataset.group)));
        add.classList.add('tracker__group-add');
        add.setAttribute('aria-keyshortcuts', 'C');
        // A control inside a grid row is a pointer target; from the keyboard, C on the heading.
        add.tabIndex = -1;
        header.append(h('div', { class: 'tracker__group-actions', role: 'gridcell' }, add));
      }
    }

    /** @param {string} id Group id. @returns {Record<string, unknown>} What a new issue in it starts with. */
    function groupPreset(id) {
      const [field, bucket] = id.split(':');
      return { [field]: fromBucket(field, bucket) };
    }

    /** @returns {Record<string, unknown>} The preset of the group whose heading has the focus, if any. */
    function focusedGroupPreset() {
      const group = document.activeElement?.closest?.('.zx-card-view__group-header')?.querySelector('.tracker__group[data-group]');
      return group && overview.body.contains(group) ? groupPreset(/** @type {HTMLElement} */ (group).dataset.group) : {};
    }

    /**
     * The board: columns and lanes from the overview — status columns in the order work flows,
     * swim lanes by the grouping — with the tracker's cards and column heads. A card moved goes
     * through the overview, which writes it with the axes' `set` (the tracker's update, logged);
     * adding in a column opens the create dialog for it.
     * @param {import('./overview.js').OverviewViewContext} view
     * @returns {KanbanView}
     */
    function createBoard(view) {
      const { columnBy, swimlaneBy, columnAxis } = view.board;
      /** @type {KanbanView|null} */
      let board = null;
      // The card head honours View settings too: a field hidden there leaves the cards.
      const shown = (id) => !(board?.getHiddenFields() ?? view.options.hiddenFields).includes(id);
      const columns = columnBy === 'status'
        ? BOARD_ORDER.map((id) => view.board.options.columns.find((column) => column.id === id))
        : view.board.options.columns;
      // Lanes nobody's issues are in start collapsed, out of the way.
      const used = new Set(swimlaneBy ? view.api.getRecords().map((issue) => String(view.board.bucketOf(issue, swimlaneBy))) : []);
      const preset = (field, id) => (field && id != null ? { [field]: fromBucket(field, id) } : {});
      board = new KanbanView(null, {
        ...view.options,
        ...view.board.options,
        columns,
        collapsedColumns: columnBy === 'status' ? ['canceled'] : [],
        collapsedSwimlanes: swimlaneBy
          ? axisChoices(AXES[swimlaneBy]).map((lane) => String(lane.value)).filter((id) => !used.has(id)) : [],
        titleField: 'title',
        identifier: (issue) => (shown('key') ? issue.key : null),
        priority: (issue) => (shown('priority') ? priorityGlyph(issue.priority) : null),
        assignees: (issue) => (shown('assignee') ? person(issue.assignee)?.name ?? null : null),
        allowAdd: true,
        contextMenu: true,
        label: `Issues by ${columnAxis.label.toLowerCase()}`,
        renderCard: ({ record: issue }) => h('div', { class: 'tracker__card', dataset: { key: issue.key } },
          h('p', { class: 'tracker__card-title' }, issue.title),
          h('div', { class: 'tracker__card-meta' }, shown('labels') ? issue.labels.map(labelChip) : null,
            shown('due') && issue.due ? dueChip(issue) : null)),
        renderColumnHeader: ({ column, swimlane, count }) => {
          const head = columnHeader({ label: column.label, count, lane: swimlane?.label ?? null });
          head.prepend(bucketGlyph(columnBy, column.id));
          return head;
        },
        renderSwimlaneHeader: ({ swimlane, count }) => h('span', { class: 'tracker__lane-head' },
          bucketGlyph(swimlaneBy, swimlane.id), h('span', {}, swimlane.label),
          h('span', { class: 'overview__count' }, String(count))),
        onrecordadd: ({ detail }) => openCreate({
          ...preset(columnBy, detail.columnId), ...preset(swimlaneBy, detail.laneId)
        })
      });
      return board;
    }

    /**
     * The glyph of a column or lane: the status ring, the priority bars, the assignee's face, or
     * the project's cube. Decorative: the name follows it.
     * @param {string} field Grouping field.
     * @param {string} id Bucket id.
     * @returns {HTMLElement}
     */
    function bucketGlyph(field, id) {
      if (field === 'status') return statusGlyph(id);
      if (field === 'priority') return priorityGlyph(Number(id));
      if (field === 'assignee') {
        return id === 'none' ? unassignedGlyph() : h('span', { class: 'tracker__cell', 'aria-hidden': 'true' }, face(id, rowParts));
      }
      return h('span', { class: 'tracker__cell', 'aria-hidden': 'true' }, icon('cube', { size: 12 }));
    }

    /**
     * One dense row of a sub-issue on the open issue: priority, key, status, title with its own
     * sub-issue count, and assignee.
     * @param {(typeof issues)[number]} issue
     * @param {ReturnType<typeof renderScope>} scope The rendering the row belongs to.
     * @returns {HTMLElement}
     */
    function issueRow(issue, scope) {
      const children = issues.filter((child) => child.parent === issue.key);
      return h('div', {
        class: 'list-row tracker__row', role: 'option', tabindex: '-1', 'aria-selected': 'false',
        'aria-label': `${issue.key} ${issue.title}, ${byId(STATUSES, issue.status).name}, `
          + `${PRIORITIES[issue.priority]} priority, ${person(issue.assignee)?.name ?? 'unassigned'}`,
        dataset: { key: issue.key },
        onclick: () => openIssue(issue.key)
      },
      priorityGlyph(issue.priority),
      h('span', { class: 'tracker__key' }, issue.key),
      statusGlyph(issue.status),
      h('span', { class: 'tracker__title' },
        h('span', { class: 'tracker__title-text' }, issue.title),
        children.length ? h('span', { class: 'tracker__subcount meta' }, icon('sitemap', { size: 11 }),
          `${children.filter((child) => child.status === 'done').length}/${children.length}`) : null),
      issue.assignee ? face(issue.assignee, scope) : unassignedGlyph());
    }

    /**
     * The due date of an issue, in the danger tone once it has passed on an open issue.
     * @param {(typeof issues)[number]} issue
     * @returns {HTMLElement}
     */
    function dueChip(issue) {
      const overdue = issue.due < TODAY && !['done', 'canceled'].includes(issue.status);
      return h('span', { class: 'tracker__due', dataset: { overdue: overdue ? 'true' : null } },
        icon('calendar-regular', { size: 11 }), shortDate(issue.due));
    }

    /** @param {string[]} keys Selected issues. @returns {void} Shows the bulk bar while issues are selected. */
    function syncBulk(keys) {
      bulk.hidden = keys.length === 0;
      selectedCount.textContent = `${keys.length} selected`;
    }

    /** @param {Record<string, unknown>} changes @returns {void} */
    function bulkUpdate(changes) {
      const keys = overview.getSelection();
      keys.forEach((key) => update(find(key), changes, { quiet: true }));
      overview.clearSelection();
      syncList();
      notify(`Updated ${keys.length} issue${keys.length === 1 ? '' : 's'}.`);
    }

    overview.on('render', () => rowParts.reset());
    overview.on('rendered', () => afterRender());
    overview.on('selectionchange', ({ detail }) => syncBulk(detail.ids));
    overview.on('recordclick', ({ detail }) => openIssue(detail.record.key));
    // The axes' `set` has written and logged the move; what describes the list follows it.
    overview.on('recordmove', () => {
      renderCounts();
      if (state.mode === 'issue') renderIssue();
      showSaved();
    });
    overview.on('viewchange', () => {
      if (state.mode !== 'issue') return;
      state.mode = 'list';
      showMode();
    });
    // The list redraws its group headings as it changes; each gets its "New issue in" button back.
    const headings = new MutationObserver(() => decorateGroups());
    headings.observe(overview.body, { childList: true, subtree: true });
    context.cleanup(() => headings.disconnect());

    // ---------------------------------------------------------------- the open issue --

    const activityList = keep(new ActivityList(null, { label: 'Activity', emptyText: 'No activity yet.' }));
    const comment = h('textarea', {
      class: 'tracker__comment', rows: 3, placeholder: 'Leave a comment…', 'aria-label': 'Comment',
      'aria-keyshortcuts': modShortcut('Enter').keys
    });
    const subscribe = button({ label: 'Subscribed', icon: 'bell', kind: 'ghost', size: 'sm', onclick: toggleSubscribe });
    subscribe.setAttribute('aria-pressed', String(state.subscribed));

    /**
     * Turns one stored activity entry into what ActivityList renders.
     * @param {{actor: string, at: string|Date, change?: string, comment?: string}} entry
     * @param {number} index
     * @returns {Record<string, unknown>}
     */
    function toActivity(entry, index) {
      const at = entry.at instanceof Date ? entry.at : toDate(entry.at);
      return {
        id: index, kind: entry.comment ? 'comment' : 'change', actor: person(entry.actor)?.name ?? entry.actor,
        avatar: { name: person(entry.actor)?.name ?? entry.actor, size: 'sm' },
        title: entry.comment ? 'commented' : entry.change, content: entry.comment ?? null,
        timestamp: at, timeLabel: formatRelativeTime(at, { now: NOW })
      };
    }

    /** Renders the issue in focus into the main pane. @returns {void} */
    function renderIssue() {
      issueParts.reset();
      const issue = find(state.current);
      if (!issue) return;
      const team = TEAMS.find((entry) => entry.id === issue.team);
      const children = issues.filter((child) => child.parent === issue.key);
      const parent = issue.parent ? find(issue.parent) : null;
      activityList.setItems(activity.get(issue.key).map(toActivity), { silent: true });
      issueBody.replaceChildren(h('article', { class: 'tracker__issue' },
        h('p', { class: 'tracker__eyebrow meta' }, icon(team.icon, { size: 12 }), team.name,
          parent ? [' · Sub-issue of ', h('button', {
            type: 'button', class: 'link-button', onclick: () => openIssue(parent.key)
          }, `${parent.key} ${parent.title}`)] : null),
        h('h2', { class: 'record-title' }, issue.title),
        h('div', { class: 'tracker__description' }, descriptions.get(issue.key)?.map((text) => h('p', {}, text))
          ?? h('p', { class: 'meta' }, 'No description yet.')),
        h('section', { class: 'tracker__section', 'aria-label': 'Sub-issues' },
          h('header', { class: 'tracker__section-head' },
            h('h3', { class: 'tracker__section-title' }, 'Sub-issues'),
            children.length ? h('span', { class: 'meta' },
              `${children.filter((child) => child.status === 'done').length} of ${children.length} done`) : null,
            h('span', { class: 'shell__spacer' }),
            button({
              label: 'Add sub-issue', icon: 'plus', kind: 'ghost', size: 'sm',
              onclick: () => openCreate({ parent: issue.key, project: issue.project, cycle: issue.cycle })
            })),
          children.length
            ? h('div', { class: 'tracker__subissues', role: 'listbox', 'aria-label': 'Sub-issues' },
              children.map((child) => issueRow(child, issueParts)))
            : h('p', { class: 'meta' }, 'Break the work down by adding sub-issues.')),
        // Not a named region: the ActivityList inside is already the "Activity" region.
        h('section', { class: 'tracker__section' },
          h('header', { class: 'tracker__section-head' },
            h('h3', { class: 'tracker__section-title' }, 'Activity'), h('span', { class: 'shell__spacer' }), subscribe),
          activityList.toElement(),
          h('form', { class: 'surface tracker__composer', onsubmit: (event) => { event.preventDefault(); postComment(); } },
            comment,
            h('div', { class: 'tracker__composer-foot' }, h('span', { class: 'meta' }, kbd(modifierLabel(), '↵'), ' to send'),
              h('span', { class: 'shell__spacer' }),
              // "New issue" is this screen's one solid button; sending a comment is a plain one.
              button({ label: 'Comment', size: 'sm', onclick: postComment }))))));
    }

    /** Appends the composer's text to the activity of the open issue. @returns {void} */
    function postComment() {
      const text = comment.value.trim();
      if (!text) return comment.focus();
      log(find(state.current), { comment: text });
      comment.value = '';
    }

    /** @returns {void} */
    function toggleSubscribe() {
      state.subscribed = !state.subscribed;
      subscribe.querySelector('.zx-btn__label').textContent = state.subscribed ? 'Subscribed' : 'Subscribe';
      subscribe.setAttribute('aria-pressed', String(state.subscribed));
      notify(state.subscribed ? `You will be notified about ${state.current}.`
        : `Notifications for ${state.current} are off.`, 'info');
    }

    /** Fills the properties aside from the issue in focus, without emitting changes. @returns {void} */
    function renderAside() {
      asideParts.reset();
      const issue = find(state.current);
      aside.hidden = !issue || (state.mode === 'list' && overview.getState().view === 'board');
      if (aside.hidden) shell.toggleAside(false);
      if (!issue) return;
      asideTitle.replaceChildren(statusGlyph(issue.status), issue.key);
      asideHeading.textContent = issue.title;
      // The open issue shows its whole history in the main pane; the list shows the latest here.
      asideHeading.hidden = state.mode === 'issue';
      recentBlock.hidden = state.mode === 'issue';
      recent.setItems(activity.get(issue.key).map(toActivity).slice(-3).reverse(), { silent: true });
      statusPick.set(issue.status, { silent: true });
      priorityPick.set(issue.priority, { silent: true });
      assigneePick.set(issue.assignee, { silent: true });
      labelPick.setValues(issue.labels, { silent: true });
      projectPick.set(issue.project, { silent: true });
      cyclePick.set(issue.cycle, { silent: true });
      estimatePick.set(issue.estimate, { silent: true });
      duePick.set(issue.due ? toDate(issue.due) : null, { silent: true });
      asideMeta.replaceChildren(face(issue.by, asideParts),
        `Filed by ${person(issue.by)?.name ?? 'someone'} on ${formatDate(toDate(issue.created), DATE.long)}`);
    }

    // -------------------------------------------------------------- changing issues --

    /**
     * Applies a change made in the aside to the issue in focus.
     * @param {Record<string, unknown>} changes
     * @returns {void}
     */
    function edit(changes) {
      update(find(state.current), changes);
    }

    /**
     * Writes changes to an issue, records each one in its activity, and re-renders: a new status
     * moves the row to its new group at once.
     * @param {(typeof issues)[number]|undefined} issue
     * @param {Record<string, any>} changes
     * @param {{quiet?: boolean}} [how] `quiet` when the caller re-renders once for a batch.
     * @returns {void}
     */
    function update(issue, changes, how = {}) {
      if (!issue) return;
      for (const [field, value] of Object.entries(changes)) {
        const before = issue[field];
        if (JSON.stringify(before) === JSON.stringify(value)) continue;
        issue[field] = value;
        log(issue, { change: describe(field, before, value) }, true);
      }
      if (how.quiet) return;
      // The scope or the tab may no longer hold it, so the overview is handed them again.
      syncList();
      if (state.mode === 'issue') renderIssue();
      showSaved();
    }

    /**
     * The activity line for one property change.
     * @param {string} field
     * @param {any} before
     * @param {any} after
     * @returns {string}
     */
    function describe(field, before, after) {
      const name = (list, id) => byId(list, id)?.name;
      switch (field) {
        case 'status': return `changed status from ${name(STATUSES, before)} to ${name(STATUSES, after)}`;
        case 'priority': return `set priority to ${PRIORITIES[after]}`;
        case 'assignee': return after ? `assigned the issue to ${person(after).name}` : 'removed the assignee';
        case 'labels': {
          const added = after.filter((id) => !before.includes(id)).map((id) => name(LABELS, id));
          const removed = before.filter((id) => !after.includes(id)).map((id) => name(LABELS, id));
          return [added.length && `added ${added.join(', ')}`, removed.length && `removed ${removed.join(', ')}`]
            .filter(Boolean).join(' and ');
        }
        case 'project': return after ? `moved the issue to ${name(PROJECTS, after)}` : 'removed the project';
        case 'cycle': return after ? `added the issue to ${name(CYCLES, after)}` : 'removed the issue from its cycle';
        case 'estimate': return after == null ? 'removed the estimate' : `set the estimate to ${after} points`;
        default: return after ? `set the due date to ${shortDate(after)}` : 'removed the due date';
      }
    }

    /**
     * Adds an entry, by the signed-in user, to an issue's activity.
     * @param {(typeof issues)[number]} issue
     * @param {{change?: string, comment?: string}} entry
     * @param {boolean} [quiet=false] Skip appending to the visible list; the caller re-renders.
     * @returns {void}
     */
    function log(issue, entry, quiet = false) {
      const entries = activity.get(issue.key);
      entries.push({ actor: ME, at: NOW, ...entry });
      if (!quiet && state.mode === 'issue' && issue.key === state.current) {
        activityList.appendItems([toActivity(entries.at(-1), entries.length - 1)]);
      }
    }

    let cancelSaved = [];

    /** Runs the aside's "Saving… → Saved" indicator. @returns {void} */
    function showSaved() {
      cancelSaved.forEach((cancel) => cancel());
      saving.set('active', 'Saving…');
      cancelSaved = [
        later(context, () => saving.set('success', 'Saved'), 350),
        later(context, () => saving.set('inactive', ''), 2200)
      ];
    }

    /** @param {string} key @returns {Promise<void>} */
    async function copyKey(key) {
      await copyToClipboard(key);
      notify(`Copied ${key} to the clipboard.`);
    }

    /** @param {string} key @returns {Promise<void>} */
    async function deleteIssue(key) {
      const ok = await Dialog.confirm({
        title: `Delete ${key}?`, danger: true, okLabel: 'Delete issue',
        message: 'The issue, its comments, and its history are removed for everyone. Sub-issues are kept.'
      });
      if (!ok) return;
      const index = issues.findIndex((issue) => issue.key === key);
      issues.splice(index, 1);
      issues.forEach((issue) => { if (issue.parent === key) issue.parent = null; });
      // The list picks the first issue it shows as the one in focus.
      state.current = '';
      backToList();
      later(context, focusRow, 0);
      notify(`${key} deleted.`);
    }

    // ------------------------------------------------------------ moving around --

    /** @param {string} scope Navigation scope id. @returns {void} */
    function setScope(scope) {
      // A scope chosen in the navigation drawer or the palette takes the focus on to its list.
      const fromDrawer = root.dataset.navOpen === 'true';
      nav.setActive(scope);
      state.scope = scope;
      state.mode = 'list';
      state.current = '';
      overview.clearSelection();
      overview.setBaseFilter(inScope);
      overview.setState({ group: SCOPES[scope].group ?? 'status' });
      showMode();
      if (fromDrawer) shell.closeNav();
      if (fromDrawer || !root.contains(document.activeElement)) focusRow();
    }

    /** @param {string} key @returns {void} */
    function openIssue(key) {
      const issue = find(key);
      if (!issue) return;
      state.current = key;
      state.mode = 'issue';
      if (issue.inbox) {
        issue.inbox = false;
        updateInboxBadge();
      }
      showMode();
      issueBody.scrollTop = 0;
      // The row that was clicked is gone with the list, so the focus moves into the issue.
      if (!context.preview && !aside.contains(document.activeElement)) {
        issueBody.focus({ preventScroll: true });
      }
    }

    /** Returns from the open issue to the list, with focus on its row. @returns {void} */
    function backToList() {
      state.mode = 'list';
      showMode();
      focusRow();
    }

    /**
     * Switches between the list and the board, as the palette does, leaving an open issue for it.
     * @param {'list'|'board'} view
     * @returns {void}
     */
    function showView(view) {
      if (state.mode === 'issue') {
        state.mode = 'list';
        showMode();
      }
      overview.setView(view);
      focusRow();
    }

    /** Shows the overview or the issue, and the header items that belong to it. @returns {void} */
    function showMode() {
      const issue = state.mode === 'issue';
      issueBody.hidden = !issue;
      overview.element.hidden = issue;
      tabs.element.hidden = issue;
      issueActions.hidden = !issue;
      syncList();
      if (issue) renderIssue();
    }

    /** @returns {HTMLElement[]} The list's rows on the current page, in order. */
    function rows() {
      return [...overview.body.querySelectorAll('.zx-card-view .zx-record-card')];
    }

    /** @param {Element} row @returns {string|null} The key of the issue a row shows. */
    function keyOf(row) {
      return row.querySelector('.tracker__title[data-key]')?.getAttribute('data-key') ?? null;
    }

    /** Marks the row of the issue in focus as current. @returns {void} */
    function markCurrent() {
      for (const row of rows()) {
        if (keyOf(row) === state.current) row.setAttribute('aria-current', 'true');
        else row.removeAttribute('aria-current');
      }
    }

    /** @param {string} key @returns {void} Makes an issue the one in focus, without moving the focus. */
    function setCurrent(key) {
      state.current = key;
      markCurrent();
      renderAside();
    }

    /**
     * J and K: in the list, the down and up arrows of its grid, from the row in focus (or, with
     * the focus elsewhere, the issue in focus); in the open issue, the next and previous issue.
     * @param {'ArrowDown'|'ArrowUp'} key
     * @returns {void}
     */
    function rowKey(key) {
      if (state.mode === 'issue') return move(key === 'ArrowDown' ? 1 : -1);
      if (overview.getState().view === 'board') return;
      const item = document.activeElement?.closest?.('[data-card-item]');
      if (!item || !overview.body.contains(item)) return focusRow();
      item.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    }

    /**
     * Opens the next or previous issue of the list from the open issue (J, K, and the header's
     * arrows); in the list, moves the focus to that row.
     * @param {number} delta
     * @returns {void}
     */
    function move(delta) {
      if (state.mode === 'list' && overview.getState().view === 'board') return;
      const keys = rows().map(keyOf).filter(Boolean);
      const next = keys[Math.max(0, Math.min(keys.length - 1, keys.indexOf(state.current) + delta))];
      if (!next) return;
      if (state.mode === 'issue') return openIssue(next);
      setCurrent(next);
      focusRow();
    }

    /**
     * Puts keyboard focus on the row — or, on the board, the card — of the issue in focus, and on
     * the layout itself when the issue is not on screen, so the keys keep reaching it.
     * @returns {void}
     */
    function focusRow() {
      if (context.preview) return;
      const board = overview.getState().view === 'board';
      const target = board
        ? overview.body.querySelector(`.tracker__card[data-key="${state.current}"]`)?.closest('[tabindex]')
        : rows().find((row) => keyOf(row) === state.current);
      (target ?? root).focus();
      target?.scrollIntoView({ block: 'nearest' });
    }

    /** Adds or removes the issue in focus from the list's selection. @returns {void} */
    function toggleSelect() {
      if (state.mode !== 'list' || !state.current || overview.getState().view === 'board') return;
      overview.getView().toggleSelection(state.current);
      focusRow();
    }

    /**
     * Opens one property's control in the aside, as the S, P, A, and L keys do. The board has no
     * aside, so there the issue opens first; below the width where the aside shows beside the list,
     * it slides in as a drawer for the one property and leaves again once it is picked.
     * @param {'status'|'priority'|'assignee'|'labels'} field
     * @returns {void}
     */
    function editProperty(field) {
      if (!state.current) return;
      // Wide, an open overview drawer takes the aside's place; the property needs the aside.
      overview.closeDrawers();
      if (aside.hidden) openIssue(state.current);
      closeAside = !aside.checkVisibility();
      if (closeAside) shell.toggleAside(true);
      returnFocus = state.mode === 'issue' ? 'issue' : 'list';
      pickers[field].focus();
      pickers[field].open();
    }

    // A property picked from the keyboard hands the focus back to the list or the issue once its
    // menu closes, and a drawer opened for it closes first.
    Object.values(pickers).forEach((pick) => pick.on('close', () => {
      if (closeAside) {
        closeAside = false;
        later(context, () => shell.toggleAside(false), 0);
      }
      const back = returnFocus;
      if (!back) return;
      returnFocus = false;
      later(context, () => (back === 'issue' ? issueBody.focus({ preventScroll: true }) : focusRow()), 0);
    }));

    // The list's grid moves the focus between rows itself; the row in focus is the issue in focus.
    overview.body.addEventListener('focusin', (event) => {
      const row = event.target instanceof Element ? event.target.closest('.zx-card-view .zx-record-card') : null;
      const key = row ? keyOf(row) : null;
      if (key && key !== state.current) setCurrent(key);
    }, { signal: context.signal });
    // In the search field, the down arrow moves on to the list.
    overview.toolbar.toElement().addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown' || !(event.target instanceof HTMLInputElement)) return;
      event.preventDefault();
      focusRow();
    }, { signal: context.signal });
    shortcuts(comment, { 'Mod+Enter': postComment }, context);

    keep(new ContextMenu(overview.body, {
      selector: '.zx-card-view .zx-record-card',
      items: (row) => [
        { label: 'Open', value: 'open', icon: 'arrow-up-right-from-square', shortcut: '↵' },
        '-',
        { label: 'Status…', value: 'status', icon: 'circle-half-stroke', shortcut: 'S' },
        { label: 'Priority…', value: 'priority', icon: 'signal', shortcut: 'P' },
        { label: 'Assignee…', value: 'assignee', icon: 'user', shortcut: 'A' },
        { label: 'Labels…', value: 'labels', icon: 'tag', shortcut: 'L' },
        {
          label: overview.getSelection().includes(keyOf(row)) ? 'Deselect' : 'Select', value: 'select',
          icon: 'square-check', shortcut: 'X'
        },
        '-',
        { label: 'Copy issue ID', value: 'copy', icon: 'copy' },
        { label: 'Delete…', value: 'delete', icon: 'trash', danger: true }
      ],
      onselect: ({ detail }) => {
        const key = keyOf(detail.context);
        if (!key) return;
        setCurrent(key);
        const actions = {
          open: () => openIssue(key), select: toggleSelect,
          copy: () => copyKey(key), delete: () => deleteIssue(key)
        };
        (actions[detail.value] ?? (() => editProperty(detail.value)))();
      }
    }));

    // -------------------------------------------------------------- creating issues --

    const createTitle = h('input', {
      class: 'tracker__create-title', placeholder: 'Issue title', 'aria-label': 'Title', autocomplete: 'off',
      autofocus: true
    });
    const createText = h('textarea', {
      class: 'tracker__create-text', rows: 4, placeholder: 'Add a description…', 'aria-label': 'Description'
    });
    const createTeam = keep(new Select(null, {
      items: TEAMS, valueKey: 'id', labelKey: 'name', label: 'Team', value: 'ENG',
      renderValueAdornment: (team) => icon(team.icon, { size: 12 })
    }));
    const createPicks = {
      status: keep(Select.status(null, { items: STATUSES, label: 'Status', value: 'todo' })),
      priority: keep(priorityPicker({ label: 'Priority', value: 2 })),
      assignee: keep(new Select(null, { ...personPicker(), label: 'Assignee', placeholder: 'Assignee' })),
      labels: keep(new TagPicker(null, { ...labelPicker(), placeholder: 'Labels' })),
      due: keep(new Datebox(null, { placeholder: 'Due date', clearable: true }))
    };
    let createPreset = {};

    const createDialog = keep(new Dialog(null, {
      title: 'New issue', size: 'md',
      content: h('div', { class: 'tracker__create' },
        h('div', { class: 'tracker__create-team' }, createTeam.toElement()),
        createTitle, createText,
        h('div', { class: 'tracker__create-props', role: 'group', 'aria-label': 'Properties' },
          Object.values(createPicks).map((pick) => pick.toElement()))),
      buttons: [
        { label: 'Cancel', action: 'cancel' },
        {
          label: 'Create issue', kind: 'primary', action: () => submitCreate(),
          shortcut: modShortcut('Enter', '↵')
        }
      ]
    }));
    shortcuts(createDialog.toElement(), { 'Mod+Enter': submitCreate }, context);

    /**
     * Opens the create dialog, pre-filled from a group, a column, or a parent issue.
     * @param {Record<string, any>} [preset]
     * @returns {void}
     */
    function openCreate(preset = {}) {
      createPreset = preset;
      const team = preset.parent ? find(preset.parent).team
        : TEAMS.find((entry) => entry.name === SCOPES[state.scope].crumbs[0])?.id ?? 'ENG';
      createTeam.set(team, { silent: true });
      createTitle.value = '';
      createText.value = '';
      createTitle.removeAttribute('aria-invalid');
      createPicks.status.set(preset.status ?? 'todo', { silent: true });
      createPicks.priority.set(preset.priority ?? 2, { silent: true });
      createPicks.assignee.set(preset.assignee ?? null, { silent: true });
      createPicks.labels.setValues([], { silent: true });
      createPicks.due.set(null, { silent: true });
      createDialog.setTitle(preset.parent ? `New sub-issue of ${preset.parent}` : 'New issue');
      createDialog.open();
    }

    /** Validates the dialog, adds the issue, and shows it in the list. @returns {void} */
    function submitCreate() {
      const title = createTitle.value.trim();
      if (!title) {
        createTitle.setAttribute('aria-invalid', 'true');
        createTitle.focus();
        return;
      }
      const team = String(createTeam.value);
      const n = Math.max(...issues.filter((issue) => issue.team === team).map((issue) => issue.n), 0) + 1;
      const due = createPicks.due.get();
      const issue = {
        team, n, key: `${team}-${n}`, title,
        status: createPicks.status.value, priority: createPicks.priority.value,
        assignee: createPicks.assignee.value ?? null, labels: createPicks.labels.getValues(),
        project: createPreset.project ?? null, cycle: createPreset.cycle ?? null, estimate: null,
        due: due ? formatDate(due, '%Y-%m-%d') : null, by: ME, created: formatDate(NOW, '%Y-%m-%dT%H:%M'),
        parent: createPreset.parent ?? null, inbox: false
      };
      issues.unshift(issue);
      activity.set(issue.key, [{ actor: ME, at: NOW, change: 'created the issue' }]);
      const text = createText.value.trim();
      if (text) descriptions.set(issue.key, text.split(/\n\s*\n/));
      createDialog.close();
      notify(`${issue.key} created.`);
      if (issue.parent) return openIssue(issue.parent);
      state.current = issue.key;
      syncList();
      // After the dialog has handed focus back, so the new row keeps it.
      later(context, focusRow, 0);
    }

    // ------------------------------------------------------------- commands and keys --

    const launcher = context.preview ? null : keep(new Launcher(null, {
      shortcut: false, placeholder: 'Type a command or search issues…', label: 'Commands'
    }));

    /** Opens the command palette with commands, in this order, above every issue. @returns {void} */
    function openLauncher() {
      if (!launcher) return;
      const board = overview.getState().view === 'board';
      const commands = [
        { id: 'new', label: 'New issue', icon: 'pen-to-square', invoke: () => openCreate() },
        {
          id: 'view', label: board ? 'Show as list' : 'Show as board', icon: 'table-columns',
          invoke: () => showView(board ? 'list' : 'board')
        },
        { id: 'inbox', label: 'Go to Inbox', icon: 'inbox', invoke: () => setScope('inbox') },
        { id: 'mine', label: 'Go to My issues', icon: 'circle-user', invoke: () => setScope('mine') }
      ];
      // A command runs once the palette has closed and handed the focus back, so whatever it
      // focuses keeps it.
      const afterClose = (fn) => () => later(context, fn, 0);
      launcher.setItems([
        ...commands.map((command, index) => ({
          ...command, invoke: afterClose(command.invoke), group: 'Commands', groupOrder: 0, itemOrder: index
        })),
        ...issues.map((issue) => ({
          id: issue.key, label: issue.title, description: `${issue.key} · ${byId(STATUSES, issue.status).name}`,
          keywords: [issue.key], group: 'Issues', groupOrder: 1, icon: 'list-check', invoke: afterClose(() => openIssue(issue.key))
        }))
      ]);
      launcher.setQuery('');
      launcher.open();
    }

    container.append(root);
    showMode();
  }
};
