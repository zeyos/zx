import {
  AccountMenu, ActivityList, AppSidebar, Avatar, Breadcrumb, ContextMenu, Datebox, Dialog, Dropdown,
  FilterPanel, InlineLoading, KanbanView, Launcher, MenuButton, Search, Select, TagPicker, badge,
  button, copyToClipboard, emptyState, formatDate, formatRelativeTime, h, icon
} from '../../src/index.js';
import {
  DATE, adaptiveShell, disposer, iconButton, kbd, later, layoutContext, modShortcut, modifierLabel, navSearch,
  paneHeader, panelBlock, renderScope, sectionLabel, shortcuts, toaster, unavailable, workspaceHeader
} from './kit.js';
import { ME, NOW, PEOPLE, TODAY, person } from './fixtures.js';

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
  projects: { crumbs: ['Projects'], test: () => true, group: 'project' },
  'view-due': { crumbs: ['Views', 'Due this week'], test: (issue) => isDueWithin(issue, 7), group: 'assignee' },
  'view-customer': { crumbs: ['Views', 'Customer issues'], test: (issue) => issue.labels.includes('customer') },
  ...Object.fromEntries(TEAMS.flatMap((team) => [
    [`${team.id}-issues`, { crumbs: [team.name, 'Issues'], test: (issue) => issue.team === team.id }],
    [`${team.id}-cycle`, { crumbs: [team.name, 'Cycle 41'], test: (issue) => issue.team === team.id && issue.cycle === 41 }],
    [`${team.id}-projects`, { crumbs: [team.name, 'Projects'], test: (issue) => issue.team === team.id, group: 'project' }]
  ]))
};

/** The view tabs above the list. */
const TABS = [
  { id: 'all', label: 'All issues', test: () => true },
  { id: 'active', label: 'Active', test: (issue) => ['in-progress', 'todo'].includes(issue.status) },
  { id: 'backlog', label: 'Backlog', test: (issue) => issue.status === 'backlog' }
];

const GROUPINGS = [
  { id: 'status', label: 'Status' }, { id: 'assignee', label: 'Assignee' },
  { id: 'priority', label: 'Priority' }, { id: 'project', label: 'Project' },
  { id: 'none', label: 'No grouping' }
];

const ORDERINGS = [
  { id: 'priority', label: 'Priority' }, { id: 'due', label: 'Due date' }, { id: 'created', label: 'Created' }
];

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
  return h('span', { class: 'tracker__nobody', title: 'Unassigned' }, icon('user', { size: 12 }));
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
 * move the choice, as the APG radio group pattern has it. An option with an icon shows only the
 * icon and carries its label as accessible name and tooltip; `counts` adds a number after each label.
 * @param {{label: string, options: Array<{id: string, label: string, icon?: string}>,
 *   counts?: boolean, onchange: (id: string) => void, signal: AbortSignal}} config
 * @returns {{element: HTMLElement, set: (id: string) => void, setCount: (id: string, count: number) => void}}
 */
function segmented({ label, options, counts = false, onchange, signal }) {
  const buttons = options.map((option) => h('button', {
    type: 'button', class: 'segmented__item', role: 'radio', dataset: { id: option.id },
    'aria-label': option.icon ? option.label : null, title: option.icon ? option.label : null,
    onclick: () => onchange(option.id)
  }, option.icon ? icon(option.icon) : option.label, counts ? h('span', { class: 'segmented__count' }) : null));
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
  blurb: 'Issues grouped by status or on a board, each with sub-issues, activity, and properties '
    + 'edited in place.',
  components: [
    'KanbanView', 'ContextMenu', 'FilterPanel', 'Search', 'Select', 'TagPicker', 'ActivityList',
    'Launcher', 'Breadcrumb', 'Datebox', 'Dialog', 'MenuButton', 'Dropdown', 'InlineLoading',
    'Avatar', 'Badge', 'Message'
  ],

  /**
   * Mounts the tracker: navigation, the grouped list or the board, the open issue, and the
   * properties of the issue in focus.
   * @param {HTMLElement} container Gallery stage.
   * @param {import('./kit.js').LayoutContext} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    // Narrow, the navigation becomes a drawer, and so do the properties: below 1180px the open
    // issue keeps the whole width and its properties wait behind a button (or S, P, A, L).
    const root = h('div', { class: 'tracker shell' });
    const shell = adaptiveShell(root, context, { asideLabel: 'Show properties' });

    // A private, mutable copy of the data, so every mount starts from the same state.
    const issues = ISSUES.map((issue) => ({
      ...issue, key: `${issue.team}-${issue.n}`, labels: [...issue.labels],
      due: issue.due ?? null, cycle: issue.cycle ?? null, estimate: issue.estimate ?? null,
      parent: issue.parent ?? null, inbox: Boolean(issue.inbox)
    }));
    const descriptions = new Map(Object.entries(DESCRIPTIONS));
    const activity = new Map(issues.map((issue) => [issue.key, [
      { actor: issue.by, at: issue.created, change: 'created the issue' },
      ...(HISTORY[issue.key] ?? [])
    ]]));
    const state = {
      scope: 'ENG-issues', tab: 'all', group: 'status', order: 'priority', query: '',
      filters: /** @type {Record<string, unknown[]>} */ ({}), view: 'list', mode: 'list',
      current: 'ENG-142', selected: new Set(), collapsed: new Set(), subscribed: true, searching: false
    };
    /** Where the focus goes back to once a property picked from the keyboard closes its menu. */
    let returnFocus = /** @type {false|'list'|'issue'} */ (false);
    // Whether the properties drawer was opened for one key-picked property, and closes after it.
    let closeAside = false;

    // The list, the open issue, and the aside are redrawn as a whole; the avatars drawn into each
    // belong to that rendering and are released by the next one.
    const listParts = renderScope(context);
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

    // Three AppSidebars — personal, workspace, and teams — each under its own section label.
    const navGroups = [
      [{ id: 'inbox', label: 'Inbox', icon: 'inbox' }, { id: 'mine', label: 'My issues', icon: 'circle-user' }],
      [{ id: 'projects', label: 'Projects', icon: 'cube' }, {
        id: 'views', label: 'Views', icon: 'layer-group', children: [
          { id: 'view-due', label: 'Due this week' }, { id: 'view-customer', label: 'Customer issues' }
        ]
      }],
      TEAMS.map((team) => ({
        id: team.id, label: team.name, icon: team.icon, children: [
          { id: `${team.id}-issues`, label: 'Issues' }, { id: `${team.id}-cycle`, label: 'Cycles' },
          { id: `${team.id}-projects`, label: 'Projects' }
        ]
      }))
    ].map((items, index) => keep(new AppSidebar(null, {
      items: withInvoke(items),
      label: ['Personal', 'Workspace', 'Your teams'][index],
      active: state.scope,
      expanded: index === 2 ? ['ENG'] : [],
      collapsible: false
    })));
    updateInboxBadge();

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
      const unread = issues.filter((issue) => issue.inbox).length;
      const items = navGroups[0].getItems();
      items[0] = { ...items[0], badge: unread || undefined };
      navGroups[0].setItems(withInvoke(items.map(({ invoke, ...item }) => item)));
    }

    const account = keep(new AccountMenu(null, {
      account: { name: person(ME).name, secondary: person(ME).role, status: 'online' },
      items: [{ label: 'Preferences', value: 'prefs', icon: 'gear' }, '-', { label: 'Sign out', value: 'out' }],
      placement: 'top-start',
      onselect: ({ detail }) => notify(unavailable(detail.value === 'out' ? 'Signing out' : 'Preferences'), 'info')
    }));

    const nav = h('div', { class: 'shell__nav' },
      workspaceHeader(),
      h('div', { class: 'nav-action' },
        button({
          label: 'New issue', icon: 'pen-to-square', kind: 'primary',
          shortcut: { label: 'C', keys: 'C' }, onclick: () => openCreate()
        }),
        navSearch({ label: 'Search issues', onclick: () => openLauncher() })),
      h('div', { class: 'shell__body' },
        navGroups[0].toElement(),
        sectionLabel('Workspace'), navGroups[1].toElement(),
        sectionLabel('Your teams'), navGroups[2].toElement()),
      h('div', { class: 'shell__footer' }, account.toElement()));

    // ------------------------------------------------------------------- main pane --

    const crumbs = keep(new Breadcrumb(null, {
      items: [],
      onselect: ({ detail }) => (detail.name === 'list' ? backToList() : setScope(detail.name))
    }));

    // Which issues the list shows, beside the trail: All, Active, Backlog, each with its count.
    const tabs = segmented({
      label: 'View', options: TABS, counts: true, signal: context.signal,
      onchange: (id) => { state.tab = id; renderList(); }
    });
    // How it shows them, at the far end of the header: as a list or as a board.
    const layoutSwitch = segmented({
      label: 'Layout', signal: context.signal, onchange: (view) => showView(view),
      options: [{ id: 'list', label: 'List', icon: 'list-ul' }, { id: 'board', label: 'Board', icon: 'table-columns' }]
    });
    layoutSwitch.set(state.view);

    const display = keep(new MenuButton(null, {
      label: 'Display', icon: 'sliders', kind: 'ghost', placement: 'bottom-end',
      onselect: ({ detail }) => {
        const [axis, value] = String(detail.value).split(':');
        state[axis] = value;
        display.setItems(displayItems());
        renderList();
        listBody.scrollTop = 0;
      }
    }));
    display.setItems(displayItems());

    /** @returns {Array<Record<string, any>|string>} The grouping and ordering radio items. */
    function displayItems() {
      return [
        { type: 'heading', label: 'Grouping' },
        ...GROUPINGS.map((entry) => ({
          label: entry.label, value: `group:${entry.id}`, role: 'menuitemradio', checked: state.group === entry.id
        })),
        '-',
        { type: 'heading', label: 'Ordering' },
        ...ORDERINGS.map((entry) => ({
          label: entry.label, value: `order:${entry.id}`, role: 'menuitemradio', checked: state.order === entry.id
        }))
      ];
    }

    const more = keep(new MenuButton(iconButton('ellipsis', 'More actions'), {
      kind: 'ghost', placement: 'bottom-end',
      items: [
        { label: 'Copy issue ID', value: 'copy', icon: 'copy' },
        '-',
        { label: 'Delete issue…', value: 'delete', icon: 'trash', danger: true }
      ],
      onselect: ({ detail }) => (detail.value === 'copy' ? copyKey(state.current) : deleteIssue(state.current))
    }));

    const filterPanel = keep(new FilterPanel(null, {
      fields: {
        assignee: {
          type: 'select', label: 'Assignee',
          options: [{ value: 'none', label: 'Unassigned' }, ...PEOPLE.map((p) => ({ value: p.id, label: p.name }))]
        },
        priority: { type: 'select', label: 'Priority', options: PRIORITIES.map((label, value) => ({ value, label })).reverse() },
        labels: { type: 'select', label: 'Label', options: LABELS },
        project: { type: 'select', label: 'Project', options: PROJECTS }
      },
      mode: 'live',
      onapply: ({ detail }) => { state.filters = detail.value; renderList(); }
    }));

    const filterButton = button({ label: 'Filter', icon: 'filter', kind: 'ghost' });
    keep(new Dropdown(filterButton, {
      content: h('div', { class: 'tracker__filters' }, filterPanel.toElement()), placement: 'bottom-end'
    }));

    // The text filter waits behind an icon (or /) and opens as a bar under the header.
    const search = keep(new Search(null, {
      placeholder: 'Find by title or ID', debounce: 150,
      oninput: ({ detail }) => { state.query = detail.value; renderList(); }
    }));
    const searchButton = iconButton('magnifying-glass', 'Find in this list', () => openSearch(),
      { shortcut: { label: '/', keys: '/' } });
    searchButton.setAttribute('aria-expanded', 'false');
    const searchBar = h('div', { class: 'shell__toolbar', hidden: true }, search.toElement());

    const listActions = h('div', { class: 'tracker__actions' },
      searchButton, filterButton, display.toElement(), layoutSwitch.element);
    // On a phone the More menu's "Copy issue ID" stands in for the link button.
    const copyButton = iconButton('link', 'Copy issue ID', () => copyKey(state.current));
    copyButton.dataset.narrow = 'hide';
    const issueActions = h('div', { class: 'tracker__actions', hidden: true },
      iconButton('angle-up', 'Previous issue', () => move(-1), { shortcut: { label: 'K', keys: 'K' } }),
      iconButton('angle-down', 'Next issue', () => move(1), { shortcut: { label: 'J', keys: 'J' } }),
      copyButton, more.toElement(), shell.asideToggle());

    const listBody = h('div', { class: 'shell__body tracker__list' });
    const boardHost = h('div', { class: 'shell__body shell__body--board', hidden: true });
    const issueBody = h('div', {
      class: 'shell__body shell__body--padded', tabindex: '-1', 'aria-label': 'Issue', hidden: true
    });
    const bulk = h('div', { class: 'bulk-bar', role: 'region', 'aria-label': 'Selection', hidden: true });
    // The tab counts show how many issues there are; this line says it to a screen reader when a
    // search or a filter changes the number.
    const resultCount = h('p', { class: 'visually-hidden', role: 'status' });

    const header = paneHeader({
      className: 'tracker__header', leading: [shell.navToggle(), crumbs.toElement()], actions: [listActions, issueActions]
    });
    // The view tabs follow the trail as a header item of their own, so a narrow pane can give them
    // a row of their own beneath it.
    header.querySelector('.shell__header-leading').after(tabs.element);
    const main = h('section', { class: 'shell__main tracker__main', 'aria-label': 'Issues' },
      header, searchBar, listBody, boardHost, issueBody, bulk, resultCount);

    const board = keep(new KanbanView(null, {
      fields: [{ id: 'title', label: 'Title' }],
      recordId: 'key',
      columnBy: 'status',
      columns: BOARD_ORDER.map((id) => ({ id, label: byId(STATUSES, id).name })),
      collapsedColumns: ['canceled'],
      titleField: 'title',
      identifier: 'key',
      priority: (issue) => priorityGlyph(issue.priority),
      assignees: (issue) => person(issue.assignee)?.name ?? null,
      fieldControls: false,
      allowAdd: true,
      contextMenu: true,
      label: 'Issues by status',
      renderCard: ({ record: issue }) => h('div', { class: 'tracker__card', dataset: { key: issue.key } },
        h('p', { class: 'tracker__card-title' }, issue.title),
        h('div', { class: 'tracker__card-meta' }, issue.labels.map(labelChip),
          issue.due ? dueChip(issue) : null)),
      renderColumnHeader: ({ column, count }) => h('span', { class: 'tracker__column-head' },
        statusGlyph(column.id), h('span', {}, column.label), h('span', { class: 'tracker__group-count' }, count)),
      onrecordclick: ({ detail }) => openIssue(String(detail.id)),
      onrecordadd: ({ detail }) => openCreate({ status: detail.columnId }),
      onrecordmove: ({ detail }) => detail.ids.forEach((key) => {
        update(find(String(key)), { status: detail.to.column }, { board: true });
      })
    }));
    boardHost.append(board.toElement());

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

    root.append(nav, main, aside);
    const notify = toaster(context, root);

    // --------------------------------------------------------------------- the list --

    /** @returns {typeof issues} The issues in scope, filtered and ordered. */
    function visibleIssues() {
      const scope = SCOPES[state.scope];
      const tab = TABS.find((entry) => entry.id === state.tab);
      const needle = state.query.trim().toLowerCase();
      const { assignee = [], priority = [], labels = [], project = [] } = state.filters;
      return issues.filter((issue) => scope.test(issue) && tab.test(issue)
        && (!needle || `${issue.key} ${issue.title}`.toLowerCase().includes(needle))
        && (!assignee.length || assignee.includes(issue.assignee ?? 'none'))
        && (!priority.length || priority.includes(issue.priority))
        && (!labels.length || labels.some((label) => issue.labels.includes(label)))
        && (!project.length || project.includes(issue.project)))
        .sort(compare);
    }

    /** @param {(typeof issues)[number]} a @param {(typeof issues)[number]} b @returns {number} */
    function compare(a, b) {
      if (state.order === 'due') return (a.due ?? '9999').localeCompare(b.due ?? '9999') || b.priority - a.priority;
      if (state.order === 'created') return b.created.localeCompare(a.created);
      return b.priority - a.priority || b.created.localeCompare(a.created);
    }

    /**
     * Splits issues into the groups of the current grouping, in that grouping's order.
     * @param {typeof issues} list
     * @returns {{id: string, name: string, glyph: Node|null, preset: Record<string, unknown>, items: typeof issues}[]}
     */
    function groupIssues(list) {
      const make = (id, name, glyph, preset, test) => ({ id, name, glyph, preset, items: list.filter(test) });
      const groups = {
        status: () => STATUSES.map((s) => make(s.ID, s.name, statusGlyph(s.ID), { status: s.ID }, (i) => i.status === s.ID)),
        assignee: () => [
          ...PEOPLE.map((p) => make(p.id, p.name, face(p.id, listParts), { assignee: p.id }, (i) => i.assignee === p.id)),
          make('none', 'Unassigned', unassignedGlyph(), { assignee: null }, (i) => !i.assignee)
        ],
        priority: () => PRIORITIES.map((name, level) => make(String(level), name, priorityGlyph(level),
          { priority: level }, (i) => i.priority === level)).reverse(),
        project: () => [
          ...PROJECTS.map((p) => make(p.ID, p.name, icon('cube'), { project: p.ID }, (i) => i.project === p.ID)),
          make('none', 'No project', icon('cube'), { project: null }, (i) => !i.project)
        ],
        none: () => [make('all', 'All issues', null, {}, () => true)]
      };
      return groups[state.group]().filter((group) => group.items.length > 0);
    }

    /**
     * Updates what describes the list without rebuilding it: the tabs and their counts, the result
     * count, the filter count, and the breadcrumb.
     * @param {typeof issues} list The visible issues.
     * @returns {number} How many filter values are active.
     */
    function renderCounts(list) {
      tabs.set(state.tab);
      for (const tab of TABS) {
        tabs.setCount(tab.id, issues.filter((issue) => SCOPES[state.scope].test(issue) && tab.test(issue)).length);
      }
      resultCount.textContent = `${list.length} issue${list.length === 1 ? '' : 's'}`;
      const active = Object.values(state.filters).reduce((sum, values) => sum + (values?.length ?? 0), 0);
      setFilterCount(active);
      const trail = SCOPES[state.scope].crumbs;
      const home = TEAMS.find((team) => team.name === trail[0]);
      crumbs.setItems([
        ...(trail.length > 1 ? [{ name: home ? `${home.id}-issues` : 'view-due', label: trail[0] }] : []),
        { name: 'list', label: trail.at(-1) },
        ...(state.mode === 'issue' ? [{ name: 'issue', label: state.current }] : [])
      ]);
      return active;
    }

    /** Re-renders whichever collection view is showing, plus the counts around it. @returns {void} */
    function renderList() {
      listParts.reset();
      const list = visibleIssues();
      const active = renderCounts(list);
      if (state.mode === 'list' && !list.some((issue) => issue.key === state.current)) {
        state.current = list[0]?.key ?? state.current;
      }

      listBody.hidden = state.mode !== 'list' || state.view !== 'list';
      boardHost.hidden = state.mode !== 'list' || state.view !== 'board';
      if (state.view === 'board') board.setData(list);
      const groups = groupIssues(list);
      listBody.replaceChildren(...(groups.length ? groups.map(renderGroup) : [emptyState({
        icon: 'list-check', title: 'No issues here',
        description: state.query || active ? 'Nothing matches the search and filters.' : 'Create an issue to get started.',
        actions: [state.query || active
          ? { label: 'Clear filters', onclick: clearFilters }
          : { label: 'New issue', icon: 'plus', onclick: () => openCreate() }]
      })]));
      // Keep one row in the tab order even when the issue in focus sits in a collapsed group.
      const rows = listBody.querySelectorAll('.tracker__row');
      if (rows.length && ![...rows].some((row) => row.tabIndex === 0)) rows[0].tabIndex = 0;
      renderBulk();
      renderAside();
    }

    /**
     * One group: a sticky heading that collapses it, and a listbox of its rows.
     * @param {ReturnType<typeof groupIssues>[number]} group
     * @returns {HTMLElement}
     */
    function renderGroup(group) {
      const collapsed = state.collapsed.has(`${state.group}:${group.id}`);
      const heading = state.group === 'none' ? null : h('div', { class: 'tracker__group-head' },
        h('button', {
          type: 'button', class: 'tracker__group-toggle', 'aria-expanded': String(!collapsed),
          onclick: () => {
            state.collapsed[collapsed ? 'delete' : 'add'](`${state.group}:${group.id}`);
            renderList();
          }
        }, icon(collapsed ? 'chevron-right' : 'chevron-down', { size: 12 }), group.glyph,
        h('span', { class: 'tracker__group-name' }, group.name),
        h('span', { class: 'tracker__group-count' }, group.items.length)),
        iconButton('plus', `New issue in ${group.name}`, () => openCreate(group.preset)));
      return h('section', { class: 'tracker__group', 'aria-label': group.name }, heading, collapsed ? null
        : h('div', { role: 'listbox', 'aria-label': group.name, 'aria-multiselectable': 'true', class: 'tracker__rows' },
          group.items.map((issue) => issueRow(issue, listParts))));
    }

    /**
     * One dense issue row: priority, key, status, title with sub-issue count and labels, due
     * date, assignee, and when it was filed.
     * @param {(typeof issues)[number]} issue
     * @param {ReturnType<typeof renderScope>} scope The rendering the row belongs to.
     * @param {boolean} [brief=false] Leave out the labels and dates, as in the sub-issue list.
     * @returns {HTMLElement}
     */
    function issueRow(issue, scope, brief = false) {
      const children = issues.filter((child) => child.parent === issue.key);
      return h('div', {
        class: 'list-row tracker__row', role: 'option', tabindex: issue.key === state.current ? '0' : '-1',
        'aria-selected': String(state.selected.has(issue.key)),
        'aria-current': issue.key === state.current ? 'true' : null,
        'aria-label': `${issue.key} ${issue.title}, ${byId(STATUSES, issue.status).name}, `
          + `${PRIORITIES[issue.priority]} priority, ${person(issue.assignee)?.name ?? 'unassigned'}`,
        dataset: { key: issue.key, brief: brief ? 'true' : null },
        onclick: () => openIssue(issue.key)
      },
      state.selected.has(issue.key)
        ? h('span', { class: 'tracker__check', 'aria-hidden': 'true' }, icon('square-check', { size: 14 }))
        : priorityGlyph(issue.priority),
      h('span', { class: 'tracker__key' }, issue.key),
      statusGlyph(issue.status),
      h('span', { class: 'tracker__title' },
        h('span', { class: 'tracker__title-text' }, issue.title),
        children.length ? h('span', { class: 'tracker__subcount meta' }, icon('sitemap', { size: 11 }),
          `${children.filter((child) => child.status === 'done').length}/${children.length}`) : null,
        brief ? null : h('span', { class: 'tracker__labels' }, issue.labels.map(labelChip)),
        brief || !issue.due ? null : dueChip(issue)),
      issue.assignee ? face(issue.assignee, scope) : unassignedGlyph(),
      brief ? null : h('span', { class: 'tracker__date meta' }, shortDate(issue.created)));
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

    /** Clears the search and every filter, which applies at once. @returns {void} */
    function clearFilters() {
      search.set('', { silent: true });
      state.query = '';
      filterPanel.clear();
    }

    /**
     * Shows how many filter values are active on the Filter button, and in its accessible name.
     * @param {number} active
     * @returns {void}
     */
    function setFilterCount(active) {
      filterButton.querySelector('.zx-badge')?.remove();
      if (!active) {
        filterButton.removeAttribute('aria-label');
        return;
      }
      const count = badge({ label: String(active), size: 'sm' });
      count.setAttribute('aria-hidden', 'true');
      filterButton.append(count);
      filterButton.setAttribute('aria-label', `Filter (${active} active)`);
    }

    /** Opens the bar with the text filter under the header. @returns {void} */
    function openSearch() {
      state.searching = true;
      if (state.mode === 'issue') backToList();
      else showMode();
      search.focus();
    }

    /** Closes the text filter, drops its query, and returns to the list. @returns {void} */
    function closeSearch() {
      state.searching = false;
      search.set('', { silent: true });
      state.query = '';
      showMode();
      focusRow();
    }

    /** Shows or hides the bar for the issues selected with X. @returns {void} */
    function renderBulk() {
      const count = state.selected.size;
      bulk.hidden = count === 0 || state.mode !== 'list';
      bulk.replaceChildren(h('span', { class: 'bulk-bar__count' }, `${count} selected`),
        bulkStatus.toElement(), bulkAssignee.toElement(),
        iconButton('xmark', 'Clear selection', () => { state.selected.clear(); renderList(); }));
    }

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

    /** @param {Record<string, unknown>} changes @returns {void} */
    function bulkUpdate(changes) {
      const keys = [...state.selected];
      keys.forEach((key) => update(find(key), changes, { quiet: true }));
      state.selected.clear();
      renderList();
      notify(`Updated ${keys.length} issue${keys.length === 1 ? '' : 's'}.`);
    }

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
              children.map((child) => issueRow(child, issueParts, true)))
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
      aside.hidden = !issue || (state.mode === 'list' && state.view === 'board');
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
     * @param {{board?: boolean, quiet?: boolean}} [how] `board` when the board already moved the
     *   card itself; `quiet` when the caller re-renders once for a batch.
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
      if (how.board) {
        // The board has already moved the card; only what describes the list needs refreshing.
        renderCounts(visibleIssues());
        renderAside();
      } else renderList();
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
      state.selected.delete(key);
      state.current = visibleIssues()[0]?.key ?? '';
      backToList();
      later(context, focusRow, 0);
      notify(`${key} deleted.`);
    }

    // ------------------------------------------------------------ moving around --

    /** @param {string} scope Navigation scope id. @returns {void} */
    function setScope(scope) {
      // A scope chosen in the navigation drawer or the palette takes the focus on to its list.
      const fromDrawer = root.dataset.navOpen === 'true';
      navGroups.forEach((group) => group.setActive(scope));
      state.scope = scope;
      state.group = SCOPES[scope].group ?? 'status';
      display.setItems(displayItems());
      state.mode = 'list';
      state.selected.clear();
      state.current = visibleIssues()[0]?.key ?? '';
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
     * Switches between the grouped list and the board, leaving an open issue for it.
     * @param {'list'|'board'} view
     * @returns {void}
     */
    function showView(view) {
      state.view = view;
      state.mode = 'list';
      layoutSwitch.set(view);
      showMode();
      focusRow();
    }

    /** Shows the list, the board, or the issue, and the header actions that belong to it. @returns {void} */
    function showMode() {
      const issue = state.mode === 'issue';
      issueBody.hidden = !issue;
      tabs.element.hidden = issue;
      listActions.hidden = issue;
      issueActions.hidden = !issue;
      searchBar.hidden = issue || !state.searching;
      searchButton.setAttribute('aria-expanded', String(state.searching));
      renderList();
      if (issue) renderIssue();
    }

    /**
     * Moves the focus to the next or previous issue; in the open issue, opens it.
     * @param {number} delta
     * @returns {void}
     */
    function move(delta) {
      if (state.mode === 'list' && state.view === 'board') return;
      const keys = [...listBody.querySelectorAll('.tracker__row')].map((row) => row.dataset.key);
      const next = keys[Math.max(0, Math.min(keys.length - 1, keys.indexOf(state.current) + delta))];
      if (!next) return;
      if (state.mode === 'issue') return openIssue(next);
      state.current = next;
      for (const row of listBody.querySelectorAll('.tracker__row')) {
        row.tabIndex = row.dataset.key === next ? 0 : -1;
        if (row.dataset.key === next) row.setAttribute('aria-current', 'true');
        else row.removeAttribute('aria-current');
      }
      renderAside();
      focusRow();
    }

    /**
     * Puts keyboard focus on the row — or, on the board, the card — of the issue in focus, and on
     * the layout itself when the issue is not on screen, so the keys keep reaching it.
     * @returns {void}
     */
    function focusRow() {
      if (context.preview) return;
      const target = state.view === 'board'
        ? boardHost.querySelector(`.tracker__card[data-key="${state.current}"]`)?.closest('[tabindex]')
        : listBody.querySelector(`.tracker__row[data-key="${state.current}"]`);
      (target ?? root).focus();
      target?.scrollIntoView({ block: 'nearest' });
    }

    /** Adds or removes the issue in focus from the selection. @returns {void} */
    function toggleSelect() {
      if (state.mode !== 'list' || !state.current) return;
      state.selected[state.selected.has(state.current) ? 'delete' : 'add'](state.current);
      renderList();
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

    listBody.addEventListener('keydown', (event) => {
      const keys = { ArrowDown: 1, ArrowUp: -1, Home: -Infinity, End: Infinity };
      if (event.key in keys && event.target.closest('.tracker__row')) {
        event.preventDefault();
        move(keys[event.key]);
      } else if (event.key === 'Enter' && event.target.classList.contains('tracker__row')) {
        event.preventDefault();
        openIssue(event.target.dataset.key);
      } else if (event.key === ' ' && event.target.classList.contains('tracker__row')) {
        event.preventDefault();
        toggleSelect();
      }
    }, { signal: context.signal });
    listBody.addEventListener('focusin', (event) => {
      const key = event.target.dataset?.key;
      if (key && key !== state.current) {
        state.current = key;
        move(0);
      }
    }, { signal: context.signal });
    shortcuts(comment, { 'Mod+Enter': postComment }, context);

    keep(new ContextMenu(listBody, {
      selector: '.tracker__row',
      items: (row) => [
        { label: 'Open', value: 'open', icon: 'arrow-up-right-from-square', shortcut: '↵' },
        '-',
        { label: 'Status…', value: 'status', icon: 'circle-half-stroke', shortcut: 'S' },
        { label: 'Priority…', value: 'priority', icon: 'signal', shortcut: 'P' },
        { label: 'Assignee…', value: 'assignee', icon: 'user', shortcut: 'A' },
        { label: 'Labels…', value: 'labels', icon: 'tag', shortcut: 'L' },
        {
          label: state.selected.has(row.dataset.key) ? 'Deselect' : 'Select', value: 'select',
          icon: 'square-check', shortcut: 'X'
        },
        '-',
        { label: 'Copy issue ID', value: 'copy', icon: 'copy' },
        { label: 'Delete…', value: 'delete', icon: 'trash', danger: true }
      ],
      onselect: ({ detail }) => {
        const key = detail.context.dataset.key;
        state.current = key;
        move(0);
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
      issues.push(issue);
      activity.set(issue.key, [{ actor: ME, at: NOW, change: 'created the issue' }]);
      const text = createText.value.trim();
      if (text) descriptions.set(issue.key, text.split(/\n\s*\n/));
      createDialog.close();
      notify(`${issue.key} created.`);
      if (issue.parent) return openIssue(issue.parent);
      state.current = issue.key;
      renderList();
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
      const commands = [
        { id: 'new', label: 'New issue', icon: 'pen-to-square', invoke: () => openCreate() },
        {
          id: 'view', label: state.view === 'list' ? 'Show as board' : 'Show as list', icon: 'table-columns',
          invoke: () => showView(state.view === 'list' ? 'board' : 'list')
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

    shortcuts(root, {
      j: () => move(1), k: () => move(-1), x: toggleSelect, c: () => openCreate(),
      s: () => editProperty('status'), p: () => editProperty('priority'),
      a: () => editProperty('assignee'), l: () => editProperty('labels'),
      Escape: () => {
        if (state.mode === 'issue') backToList();
        else if (state.selected.size) {
          state.selected.clear();
          renderList();
          focusRow();
        } else if (state.searching) closeSearch();
        else return false;
      },
      '/': openSearch, 'Mod+k': openLauncher
    }, context);
    // In the text filter, Escape closes it and the down arrow moves on to the list.
    search.toElement().addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      if (event.key === 'Escape') closeSearch();
      else focusRow();
    }, { signal: context.signal });

    container.append(root);
    showMode();
  }
};
