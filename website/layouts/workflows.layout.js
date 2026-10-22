import {
  ActivityList, Avatar, Chart, ChartJsAdapter, ContextMenu, Dialog, Field,
  InlineLoading, MenuButton, ProgressBar, Stepper, Table, Tabbox, Toggle, badge, button, emptyState,
  formatCurrency, formatDate, formatNumber, formatPercent, formatRelativeTime, h, icon, statTile
} from '../../src/index.js';
import {
  DATE, adaptiveShell, allowsMotion, chartOptions, chartPalette, chartScales, disposer, iconButton, iconTile,
  kbd, later, layoutContext, loadChartJs, modShortcut, paneHeader, panelBlock, propList, renderScope,
  shortcuts, suiteNav, toaster, unavailable, unavailablePane, watchTheme
} from './kit.js';
import { ME, NOW, PEOPLE, person } from './fixtures.js';

/**
 * The kinds of step a workflow is built from. `people` steps are worked on by someone and get an
 * assignee, a due time, and reminders. `group` sorts the add-step menu; `fresh` names a new step.
 * `tone` is the kind's categorical colour — its icon tile and its label, wherever the kind appears.
 */
const STEP_TYPES = {
  trigger: { label: 'Trigger', icon: 'clock', tone: 'blue', group: null },
  checkin: { label: 'Check-in', icon: 'comments', tone: 'amber', group: 'People', people: true,
    hint: 'Ask people for a short update', fresh: 'Ask for an update' },
  task: { label: 'Task', icon: 'clipboard-list', tone: 'green', group: 'People', people: true,
    hint: 'Assign work with a due time', fresh: 'New task' },
  approval: { label: 'Approval', icon: 'circle-check', tone: 'orange', group: 'People', people: true,
    hint: 'Wait for a sign-off before going on', fresh: 'Approve the result' },
  gather: { label: 'Gather data', icon: 'database', tone: 'teal', group: 'Automation',
    hint: 'Pull figures from connected tools', fresh: 'Pull the latest figures' },
  assistant: { label: 'Assistant', icon: 'wand-magic-sparkles', tone: 'pink', group: 'Automation',
    hint: 'Draft or summarise with the assistant', fresh: 'Summarise the results' },
  notify: { label: 'Notify', icon: 'paper-plane', tone: 'slate', group: 'Automation',
    hint: 'Send a message or post to a channel', fresh: 'Send an update' },
  followup: { label: 'Follow-up', icon: 'flag', tone: 'slate', group: 'Automation',
    hint: 'Track decisions until they are done', fresh: 'Track decisions' },
  condition: { label: 'Condition', icon: 'code-branch', tone: 'violet', group: 'Logic',
    hint: 'Branch on a rule', fresh: 'Check a rule' }
};

/** How many faces a step card shows before it counts the rest. */
const FACES = 3;

/**
 * The layout's width, in pixels, down to which the step settings stay beside the flow. Narrower, the
 * flow keeps the room and the settings open as a drawer when a step is opened.
 */
const PINNED_WIDTH = 1024;

/** What can take the focus inside the inspector, to put it back after the inspector is redrawn. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), '
  + 'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** What starts a workflow: a schedule, an event in a connected tool, or a person. */
const TRIGGERS = [
  { ID: 'weekly', name: 'Every Monday at 09:00', icon: 'clock', next: '2026-10-12T09:00' },
  { ID: 'weekday', name: 'Every weekday at 08:30', icon: 'clock', next: '2026-10-09T08:30' },
  { ID: 'monthly', name: 'First working day of the month at 08:00', icon: 'calendar-days', next: '2026-11-02T08:00' },
  { ID: 'quarterly', name: 'Three weeks before each quarter', icon: 'calendar-days', next: '2026-12-11T09:00' },
  { ID: 'deal-won', name: 'When a deal is marked won in the CRM', icon: 'bolt', next: null },
  { ID: 'manual', name: 'Only when started by hand', icon: 'play', next: null }
];

/** The connected tools that automated steps read from, and the channels notify steps post to. */
const SOURCES = [
  { ID: 'crm', name: 'CRM', icon: 'handshake' },
  { ID: 'billing', name: 'Billing', icon: 'file-invoice' },
  { ID: 'support', name: 'Support desk', icon: 'inbox' },
  { ID: 'projects', name: 'Project tracker', icon: 'list-check' },
  { ID: 'bank', name: 'Bank feed', icon: 'building' }
];
const CHANNELS = ['leadership', 'finance', 'customer-success', 'all-staff']
  .map((name) => ({ ID: name, name: `#${name}`, icon: 'hashtag' }));

/** The figures a condition compares, and when a step runs at all. */
const METRICS = [
  { ID: 'revenue', name: 'Revenue against plan', unit: 'percent' },
  { ID: 'variance', name: 'Unreconciled variance', unit: 'currency' },
  { ID: 'contract', name: 'Contract value', unit: 'currency' }
];
const WHEN = [
  { ID: 'always', name: 'On every run' },
  { ID: 'risk', name: 'Only when a risk was flagged' },
  { ID: 'late', name: 'Only when the run is late' }
];

/**
 * The workspace's workflows. Steps run top to bottom; a condition holds one list of steps per
 * branch. `due` and `avg` are hours — the time a person is given, and what the step has taken on
 * average lately. `target` is how long a whole run should take; `edited` who changed it last, and when.
 */
const WORKFLOWS = [
  {
    id: 'wbr', name: 'Weekly business review', icon: 'chart-line', owner: 'ines', active: true,
    trigger: 'weekly', target: 24, edited: { by: 'ines', at: '2026-10-06T16:20' },
    steps: [
      { id: 'wbr-start', type: 'trigger' },
      { id: 'wbr-figures', type: 'gather', name: 'Pull pipeline, revenue and support figures',
        sources: ['crm', 'billing', 'support'], avg: 0.1 },
      { id: 'wbr-updates', type: 'checkin', name: 'Collect updates from team leads',
        people: ['tobias', 'nadine', 'camille', 'jonas'], due: 4, avg: 3.5, onlyMissing: true, remind: true },
      { id: 'wbr-draft', type: 'assistant', name: 'Draft the review briefing', sources: ['crm', 'billing'], review: true,
        avg: 0.1, instructions: 'Summarise what moved, what is at risk and what needs a decision. Link every figure '
          + 'to its source and keep it to one page.' },
      { id: 'wbr-revenue', type: 'condition', name: 'Revenue below plan?', rule: { metric: 'revenue', op: 'below', value: -5 },
        branches: [
          { label: 'Yes', steps: [{ id: 'wbr-forecast', type: 'approval', name: 'Finance reviews the forecast',
            people: ['ruth'], due: 24, avg: 58, remind: true, escalate: true }] },
          { label: 'No', steps: [] }
        ] },
      { id: 'wbr-approve', type: 'approval', name: 'Approve the briefing', people: ['ines'], due: 24, avg: 7, remind: true },
      { id: 'wbr-share', type: 'notify', name: 'Share the briefing with the leadership team', channels: ['leadership'],
        avg: 0 },
      { id: 'wbr-follow', type: 'followup', name: 'Track decisions for two weeks', days: 14, avg: 0 }
    ],
    suggestion: {
      move: 'wbr-revenue', before: 'wbr-updates', title: 'Start the finance review earlier',
      text: 'Finance reviews waited 2.4 days on average and held up four of the last seven briefings. '
        + 'Check revenue as soon as the figures arrive, so Ruth can start on Monday morning.'
    }
  },
  {
    id: 'close', name: 'Month-end close', icon: 'calculator', owner: 'ruth', active: true,
    trigger: 'monthly', target: 120, edited: { by: 'ruth', at: '2026-09-29T11:05' },
    steps: [
      { id: 'close-start', type: 'trigger' },
      { id: 'close-export', type: 'gather', name: 'Export open invoices and bank transactions',
        sources: ['billing', 'bank'], avg: 0.2 },
      { id: 'close-reconcile', type: 'task', name: 'Reconcile the bank accounts', people: ['ruth'], due: 48, avg: 30, remind: true },
      { id: 'close-accrue', type: 'task', name: 'Accrue unbilled services', people: ['tobias'], due: 48, avg: 20, remind: true },
      { id: 'close-variance', type: 'condition', name: 'Variance above threshold?',
        rule: { metric: 'variance', op: 'above', value: 5000 },
        branches: [
          { label: 'Yes', steps: [{ id: 'close-signoff', type: 'approval', name: 'Sign off the variance',
            people: ['ines'], due: 48, avg: 26, escalate: true }] },
          { label: 'No', steps: [] }
        ] },
      { id: 'close-report', type: 'assistant', name: 'Draft the month-end report', sources: ['billing', 'bank'], review: true,
        avg: 0.2, instructions: 'Compare revenue, costs and cash with last month and the plan. Explain every change above '
          + '€5,000 in one sentence.' },
      { id: 'close-approve', type: 'approval', name: 'Approve the close', people: ['ruth'], due: 24, avg: 9 },
      { id: 'close-send', type: 'notify', name: 'Send the report to the management team', channels: ['finance'], avg: 0 }
    ]
  },
  {
    id: 'onboarding', name: 'Customer onboarding', icon: 'handshake', owner: 'nadine', active: true,
    trigger: 'deal-won', target: 720, edited: { by: 'piet', at: '2026-09-15T14:40' },
    steps: [
      { id: 'onb-start', type: 'trigger' },
      { id: 'onb-welcome', type: 'notify', name: 'Welcome the customer’s main contact', channels: ['customer-success'],
        avg: 0 },
      { id: 'onb-kickoff', type: 'task', name: 'Hold the kick-off call', people: ['nadine'], due: 72, avg: 60, remind: true },
      { id: 'onb-workspace', type: 'task', name: 'Provision the customer workspace', people: ['piet'], due: 120, avg: 80 },
      { id: 'onb-size', type: 'condition', name: 'Large contract?', rule: { metric: 'contract', op: 'above', value: 50000 },
        branches: [
          { label: 'Yes', steps: [{ id: 'onb-architecture', type: 'task', name: 'Review the architecture',
            people: ['piet', 'jonas'], due: 120, avg: 96 }] },
          { label: 'No', steps: [{ id: 'onb-guide', type: 'notify', name: 'Send the setup guide',
            channels: ['customer-success'], avg: 0 }] }
        ] },
      { id: 'onb-health', type: 'checkin', name: '30-day health check-in', people: ['nadine'], due: 720, avg: 690,
        remind: true },
      { id: 'onb-summary', type: 'assistant', name: 'Summarise onboarding for the account team', sources: ['crm', 'support'],
        avg: 0.1, instructions: 'List what was set up, the questions still open and the customer’s goals for the next '
          + 'quarter.' }
    ]
  },
  {
    id: 'planning', name: 'Quarterly planning', icon: 'bullseye', owner: 'ines', active: false,
    trigger: 'quarterly', target: 336, edited: { by: 'ines', at: '2026-09-10T08:45' },
    steps: [
      { id: 'plan-start', type: 'trigger' },
      { id: 'plan-review', type: 'assistant', name: 'Review last quarter’s goals', sources: ['projects', 'crm'], avg: 1,
        instructions: 'Score every goal from last quarter, mark the ones that slipped and suggest what to carry over.' },
      { id: 'plan-proposals', type: 'checkin', name: 'Teams propose their goals',
        people: ['tobias', 'camille', 'jonas', 'lea'], due: 120, avg: 110, remind: true },
      { id: 'plan-workshop', type: 'task', name: 'Run the planning workshop', people: ['ines'], due: 168, avg: 100 },
      { id: 'plan-approve', type: 'approval', name: 'Leadership approves the plan', people: ['ines'], due: 72, avg: 40 },
      { id: 'plan-publish', type: 'notify', name: 'Publish the plan to all staff', channels: ['all-staff'], avg: 0 }
    ]
  }
];

/**
 * Recent runs per workflow, newest first. `branch` is the branch its conditions took, `done` how
 * many steps an unfinished run got through, and `hours` how long a finished one took.
 */
const RUNS = {
  wbr: [
    { id: 42, label: 'Week 41', started: '2026-10-05T09:00', status: 'running', branch: 0, done: 6,
      waitingSince: '2026-10-07T09:40' },
    { id: 41, label: 'Week 40', started: '2026-09-28T09:00', status: 'completed', branch: 0, hours: 62 },
    { id: 40, label: 'Week 39', started: '2026-09-21T09:00', status: 'completed', branch: 1, hours: 19 },
    { id: 39, label: 'Week 38', started: '2026-09-14T09:00', status: 'completed', branch: 0, hours: 71 },
    { id: 38, label: 'Week 37', started: '2026-09-07T09:00', status: 'completed', branch: 1, hours: 22 },
    { id: 37, label: 'Week 36', started: '2026-08-31T09:00', status: 'failed', branch: 1, done: 1,
      error: 'The CRM connection had expired.' },
    { id: 36, label: 'Week 35', started: '2026-08-24T09:00', status: 'completed', branch: 0, hours: 55 },
    { id: 35, label: 'Week 34', started: '2026-08-17T09:00', status: 'completed', branch: 0, hours: 49 }
  ],
  close: [
    { id: 12, label: 'October 2026', started: '2026-10-01T08:00', status: 'running', branch: 0, done: 5,
      waitingSince: '2026-10-06T15:00' },
    { id: 11, label: 'September 2026', started: '2026-09-01T08:00', status: 'completed', branch: 1, hours: 98 },
    { id: 10, label: 'August 2026', started: '2026-08-03T08:00', status: 'completed', branch: 0, hours: 146 },
    { id: 9, label: 'July 2026', started: '2026-07-01T08:00', status: 'completed', branch: 1, hours: 104 },
    { id: 8, label: 'June 2026', started: '2026-06-01T08:00', status: 'completed', branch: 0, hours: 131 },
    { id: 7, label: 'May 2026', started: '2026-05-04T08:00', status: 'completed', branch: 1, hours: 92 }
  ],
  onboarding: [
    { id: 18, label: 'Kestrel Analytics', started: '2026-09-28T14:20', status: 'running', branch: 0, done: 2,
      waitingSince: '2026-09-28T14:21' },
    { id: 17, label: 'Helios Energie', started: '2026-08-31T10:05', status: 'completed', branch: 1, hours: 610 },
    { id: 16, label: 'Bruckner Logistik', started: '2026-07-20T16:40', status: 'completed', branch: 0, hours: 790 },
    { id: 15, label: 'Atelier West', started: '2026-07-02T11:15', status: 'cancelled', branch: 1, done: 3 },
    { id: 14, label: 'Meridian Health', started: '2026-05-18T09:30', status: 'completed', branch: 0, hours: 655 }
  ],
  planning: [
    { id: 4, label: 'Q4 2026', started: '2026-09-10T09:00', status: 'completed', branch: 0, hours: 290 },
    { id: 3, label: 'Q3 2026', started: '2026-06-10T09:00', status: 'completed', branch: 0, hours: 380 },
    { id: 2, label: 'Q2 2026', started: '2026-03-11T09:00', status: 'completed', branch: 0, hours: 305 }
  ]
};

/** Run statuses as badges, the overdue badge, and what the run transcript says a finished step did. */
const RUN_STATUS = {
  running: { label: 'Running', kind: 'info' },
  completed: { label: 'Completed', kind: 'success' },
  failed: { label: 'Failed', kind: 'danger' },
  cancelled: { label: 'Cancelled', kind: 'neutral' }
};
const OVERDUE = { label: 'Overdue', kind: 'danger', size: 'sm' };
const STEP_DONE = {
  trigger: 'started the run', gather: 'gathered the figures', assistant: 'wrote the draft',
  notify: 'sent the update', followup: 'started tracking decisions', checkin: 'collected the updates',
  task: 'finished the task', approval: 'approved', condition: 'checked the rule'
};

/**
 * Finds a step anywhere in a workflow, branches included.
 * @param {object[]} steps @param {string} id @param {boolean} [inBranch]
 * @returns {{list: object[], index: number, step: object, inBranch: boolean}|null}
 */
function locate(steps, id, inBranch = false) {
  for (const [index, step] of steps.entries()) {
    if (step.id === id) return { list: steps, index, step, inBranch };
    for (const branch of step.branches ?? []) {
      const found = locate(branch.steps, id, true);
      if (found) return found;
    }
  }
  return null;
}

/**
 * The steps one run walks through: all of them in order, and of a condition only the branch taken.
 * Without a branch index, both branches are included — every step in display order.
 * @param {object[]} steps @param {number} [branch] @returns {object[]}
 */
function flatten(steps, branch) {
  return steps.flatMap((step) => [step, ...(step.branches ?? [])
    .filter((_, index) => branch === undefined || index === branch)
    .flatMap((lane) => flatten(lane.steps, branch))]);
}

/** A length of time in minutes, hours, or days. @param {number} hours @returns {string} */
function formatDuration(hours) {
  if (hours < 1) return `${formatNumber(Math.max(1, Math.round(hours * 60)))} min`;
  if (hours < 24) return `${formatNumber(hours, { maxDecimals: 1 })} h`;
  const days = Math.round(hours / 2.4) / 10;
  return `${formatNumber(days, { maxDecimals: 1 })} ${days === 1 ? 'day' : 'days'}`;
}

/** @param {Date|string} date @param {number} hours @returns {Date} A new date, hours later. */
function addHours(date, hours) {
  return new Date(new Date(date).getTime() + hours * 3_600_000);
}

/** @param {Date|string} date @returns {string} "Mon 5 Oct, 09:00" */
function when(date) {
  return formatDate(new Date(date), DATE.dateTime);
}

/** A condition's rule as a sentence. @param {{metric: string, op: string, value: number}} rule @returns {string} */
function ruleText(rule) {
  const metric = METRICS.find((entry) => entry.ID === rule.metric) ?? METRICS[0];
  const value = metric.unit === 'currency'
    ? formatCurrency(rule.value, 'EUR', { decimals: 0 }) : formatPercent(rule.value / 100);
  return `${metric.name} is ${rule.op} ${value}`;
}

/**
 * A step's display name; a trigger is named after its schedule.
 * @param {object} step @param {object} workflow @returns {string}
 */
function stepName(step, workflow) {
  return step.type === 'trigger' ? TRIGGERS.find((entry) => entry.ID === workflow.trigger).name : step.name;
}

/**
 * The step a running run waits on, when it is due, and whether that has passed.
 * @param {object} run @returns {{step: object, due: Date|null, overdue: boolean}|null}
 */
function waitingOn(run) {
  const step = run.status === 'running' ? run.steps[run.done] : null;
  if (!step) return null;
  const due = step.due ? addHours(run.waitingSince, step.due) : null;
  return { step, due, overdue: Boolean(due && due < NOW) };
}

/**
 * Rebuilds a run's history as activity entries, spreading its time over the finished steps in
 * proportion to how long each usually takes.
 * @param {object} workflow @param {object} run @returns {object[]} ActivityList items.
 */
function transcript(workflow, run) {
  const steps = run.steps.slice(0, run.status === 'completed' ? run.steps.length : run.done);
  const weights = steps.map((step) => Math.max(step.avg ?? 0, 0.05));
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const span = run.status === 'completed' ? run.hours
    : run.status === 'running' ? (new Date(run.waitingSince) - new Date(run.started)) / 3_600_000 : total;
  let elapsed = 0;
  const items = steps.map((step, index) => {
    elapsed += step.type === 'trigger' ? 0 : weights[index];
    const branch = step.branches ? ` — ${step.branches[run.branch].label}` : '';
    const at = addHours(run.started, span * (elapsed / total));
    return entry(`${index}`, step.people?.[0], STEP_DONE[step.type], `${stepName(step, workflow)}${branch}`, at);
  });
  const waiting = waitingOn(run);
  const since = new Date(run.waitingSince);
  if (waiting) items.push(entry('wait', waiting.step.people?.[0], 'has been asked to act', waiting.step.name, since));
  if (run.status === 'failed') {
    items.push(entry('error', null, 'stopped with an error', run.error, addHours(run.started, 0.1)));
  }
  if (run.status === 'cancelled') {
    const at = addHours(run.started, 200);
    items.push(entry('cancel', workflow.owner, 'cancelled the run', 'The customer paused the project.', at));
  }
  return items;
}

/**
 * One transcript entry; automated steps are attributed to the workflow itself.
 * @param {string} id @param {string|null|undefined} who Person id. @param {string} title
 * @param {string} content @param {Date} at @returns {object}
 */
function entry(id, who, title, content, at) {
  const name = person(who ?? '')?.name;
  return {
    id, title, content, actor: name ?? 'Workflow',
    avatar: name ? { name } : { initials: 'W', shape: 'rounded' },
    timestamp: at.toISOString(), timeLabel: formatDate(at, DATE.time), day: formatDate(at, DATE.day)
  };
}

export default {
  title: 'Workflows',
  category: 'Operations',
  blurb: 'A team’s recurring processes as step-by-step flows: built, run, and measured, with an assistant that drafts.',
  components: [
    'Stepper', 'MenuButton', 'ActivityList', 'ContextMenu', 'Tabbox', 'Toggle', 'Field', 'Select',
    'TagPicker', 'NumberField', 'Table', 'ProgressBar', 'StatTile', 'Chart', 'InlineLoading', 'Dialog',
    'Avatar', 'Message', 'AppSidebar', 'ModuleBar', 'AccountMenu'
  ],

  /**
   * Mounts the workflow builder: navigation, the selected workflow's builder, runs, and insights,
   * and an inspector for the selected step or run.
   * @param {HTMLElement} container Gallery stage.
   * @param {import('./kit.js').LayoutContext} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const { preview } = context;
    const workflows = structuredClone(WORKFLOWS);
    const runs = structuredClone(RUNS);
    // A run keeps the steps it started with, so editing a workflow never rewrites its history.
    for (const workflow of workflows) {
      for (const run of runs[workflow.id]) run.steps = flatten(workflow.steps, run.branch);
    }
    const state = { view: 'workflow', workflow: workflows[0], tab: 'builder', step: 'wbr-updates', run: 42, roomy: true };
    const remembered = new Map();
    const addMenus = new Map();
    let nextId = 1;
    let cancelSave = () => {};
    let chartVersion = 0;
    const [builderScope, tabScope, asideScope, pageScope] = [1, 2, 3, 4].map(() => renderScope(context));

    /* ------------------------------------------------------------ navigation */

    // The suite's navigation, with this layout's menu in the Workflows module: the fixed
    // destinations, then the workflows themselves, with a button that adds one.
    const newWorkflow = iconButton('plus', 'New workflow', () => createWorkflow());
    const nav = suiteNav(context, {
      module: 'workflows',
      menu: menuItems(),
      active: state.workflow.id,
      account: {
        // Each item names what it would open, for the note that says it is not part of this example.
        items: [
          { label: 'Profile', value: 'Your profile', icon: 'user' },
          { label: 'Notification settings', value: 'Notification settings', icon: 'bell' },
          '-',
          { label: 'Sign out', value: 'Signing out', icon: 'power-off' }
        ],
        onselect: ({ detail }) => notify(unavailable(String(detail.value)), 'info')
      }
    });
    const root = h('div', { class: 'flow shell' }, nav.column);
    // Narrow, the navigation and the inspector become drawers; opening a step or a run opens the
    // inspector's.
    const shell = adaptiveShell(root, context, { asideLabel: 'Show step settings' });

    /* ------------------------------------------------------------------ main */

    const title = h('span');
    // On a phone the switch keeps its track, Run now its icon; their words stay in their names.
    const activeToggle = keep(new Toggle(null, {
      label: 'Active', onchange: (event) => setActive(event.detail.checked)
    }));
    activeToggle.el.classList.add('flow__active');
    const more = keep(new MenuButton(iconButton('ellipsis', 'More workflow actions'), {
      kind: 'ghost', placement: 'bottom-end',
      items: [
        { label: 'Test run', icon: 'play', description: 'Walk every step without sending anything', onselect: () => testRun() },
        '-',
        { label: 'Delete workflow', icon: 'trash-can', danger: true, onselect: () => deleteWorkflow() }
      ]
    }));
    const saved = keep(new InlineLoading(null, { status: 'success', description: 'All changes saved', size: 'sm' }));
    const summary = h('div', { class: 'flow__summary' });
    const builderPanel = h('div', { class: 'shell__body flow__canvas' });
    const runsPanel = h('div', { class: 'shell__body shell__body--padded flow__stack' });
    const insightsPanel = h('div', { class: 'shell__body shell__body--padded flow__stack' });
    const tabs = keep(new Tabbox(null, {
      variant: 'line',
      label: 'Workflow views',
      tabs: [
        { name: 'builder', title: 'Builder', icon: 'diagram-project', content: builderPanel },
        { name: 'runs', title: 'Runs', icon: 'clock-regular', content: runsPanel },
        { name: 'insights', title: 'Insights', icon: 'chart-simple', content: insightsPanel }
      ],
      onchange: (event) => {
        state.tab = event.detail.name;
        renderTab();
        // Switched by its number key from inside the panel it hides, the focus moves to the new tab
        // (once the tab box has switched: `change` comes first, so it can be vetoed).
        queueMicrotask(() => {
          const active = document.activeElement;
          const lost = active === document.body
            || (active instanceof HTMLElement && root.contains(active) && active.offsetParent === null);
          if (!preview && lost) /** @type {HTMLElement|null} */ (tabs.el.querySelector('[role="tab"][aria-selected="true"]'))?.focus();
        });
      }
    }));
    tabs.toElement().classList.add('shell__tabs');
    const runTable = keep(new Table(null, {
      rowId: 'id',
      selectable: 'single',
      stickyHeader: false,
      // The history sits inside a surface, which is already its frame.
      variant: 'plain',
      columns: [
        { id: 'label', label: 'Run', width: '1.5fr', render: (run) => h('span', { class: 'flow__run' },
          h('span', { class: 'flow__run-label' }, run.label), h('span', { class: 'meta num' }, `#${run.id}`)) },
        { id: 'started', label: 'Started', width: '1.2fr', render: (run) => when(run.started) },
        { id: 'duration', label: 'Duration', width: '1fr', align: 'end', render: (run) => runDuration(run) },
        { id: 'ontime', label: 'On time', width: '1fr', render: (run) => onTimeBadge(run) },
        { id: 'status', label: 'Status', width: '0.9fr', render: (run) => statusBadge(run) }
      ],
      // Narrower than its five columns need, each run becomes a card; opening one there opens its
      // details in the inspector drawer.
      responsive: 'md',
      onrowclick: (event) => {
        state.run = event.detail.id;
        renderAside();
        revealAside();
      }
    }));

    const runShortcut = modShortcut('Enter', '↵');
    const runButton = button({ label: 'Run now', icon: 'play', kind: 'primary', shortcut: runShortcut, onclick: () => runNow() });
    runButton.dataset.narrow = 'icon';
    const asideButton = shell.asideToggle();
    // The workflow's name is the page title; its schedule, owner, and next run sit beneath it as a
    // subtitle, and the tab row closes the header.
    const workflowView = h('div', { class: 'flow__view' },
      paneHeader({ title, size: 'page', className: 'flow__header', leading: shell.navToggle(), actions: [
        activeToggle.toElement(),
        runButton,
        more.toElement(),
        asideButton
      ] }),
      summary,
      tabs.toElement());
    const pageTitle = h('span');
    const pageBody = h('div', { class: 'shell__body shell__body--padded flow__page' });
    const pageView = h('div', { class: 'flow__view', hidden: true },
      paneHeader({ title: pageTitle, size: 'page', leading: shell.navToggle() }), pageBody);
    const aside = h('aside', { class: 'shell__aside', 'aria-label': 'Inspector' });
    root.append(h('main', { class: 'shell__main' }, workflowView, pageView), aside);
    const notify = toaster(context, root);
    // Wide, the step settings stay beside the flow; narrower, they wait in a drawer.
    if (!preview) {
      const observer = new ResizeObserver(([entry]) => {
        const roomy = entry.contentRect.width > PINNED_WIDTH;
        if (roomy === state.roomy) return;
        state.roomy = roomy;
        if (roomy && state.tab === 'builder') shell.toggleAside(false);
        pinAside();
      });
      observer.observe(root);
      context.cleanup(() => observer.disconnect());
    }

    builderPanel.addEventListener('keydown', onBuilderKey, { signal: context.signal });
    keep(new ContextMenu(builderPanel, { selector: '.flow__step', items: (card) => stepActions(card.dataset.id) }));
    // A handler that returns false declines its key, so it is left to whatever else listens for it.
    const onWorkflow = () => state.view === 'workflow';
    const inBuilder = () => onWorkflow() && state.tab === 'builder';
    shortcuts(root, {
      j: () => inBuilder() && moveFocus(1),
      k: () => inBuilder() && moveFocus(-1),
      a: () => inBuilder() && addMenus.get(state.step)?.focusFirst(),
      1: () => onWorkflow() && tabs.openTab('builder'),
      2: () => onWorkflow() && tabs.openTab('runs'),
      3: () => onWorkflow() && tabs.openTab('insights'),
      'Mod+Enter': () => onWorkflow() && runNow()
    }, context);

    // A canvas does not follow CSS, so the chart is drawn again when the theme changes.
    watchTheme(context, () => {
      if (state.view === 'workflow' && state.tab === 'insights') renderInsights();
    });

    container.append(root);
    openWorkflow(state.workflow.id);

    /* ---------------------------------------------------------------- shared */

    /**
     * An Avatar for a staff member, owned by the region it is drawn into.
     * @param {string|null} id Person id. @param {ReturnType<typeof renderScope>} scope
     * @param {'sm'|'md'|number} [size] A preset, or pixels for a face set into a line of text.
     * @returns {HTMLElement}
     */
    function avatar(id, scope, size = 'sm') {
      return scope.own(new Avatar(null, { name: person(id ?? '')?.name ?? 'Unassigned', size })).toElement();
    }

    /** @returns {object[]} The menu: the fixed destinations, then the workflows under their section. */
    function menuItems() {
      return [
        ...mainItems(),
        { section: true, label: 'Workflows', actions: newWorkflow, children: workflowItems() }
      ];
    }

    /**
     * The fixed destinations above the workflow list. Their ids stay clear of the suite's modules
     * (Home, Settings), which share the navigation with them.
     * @returns {object[]}
     */
    function mainItems() {
      const count = myTasks().length || undefined;
      return [
        ['home', 'Home', 'house'], ['tasks', 'My tasks', 'square-check', count], ['checkins', 'Check-ins', 'comments'],
        ['insights', 'Insights', 'chart-simple'], ['settings', 'Settings', 'gear']
      ].map(([page, label, glyph, badge]) => ({
        id: pageId(page), label, icon: glyph, badge, invoke: () => fromNav(() => openPage(page))
      }));
    }

    /** @param {string} page @returns {string} A fixed destination's id in the navigation. */
    function pageId(page) {
      return `page:${page}`;
    }

    /** @returns {object[]} One navigation item per workflow. */
    function workflowItems() {
      return workflows.map((workflow) => ({
        id: workflow.id, label: workflow.name, icon: workflow.icon, invoke: () => fromNav(() => openWorkflow(workflow.id))
      }));
    }

    /** @returns {object[]} Steps that running runs wait on and that are assigned to the signed-in user. */
    function myTasks() {
      return workflows.flatMap((workflow) => runs[workflow.id]
        .map((run) => ({ workflow, run, ...waitingOn(run) }))
        .filter((task) => task.step?.people?.includes(ME)));
    }

    /** Re-reads the navigation after workflows or tasks change. @returns {void} */
    function refreshNav() {
      nav.setMenu(menuItems());
    }

    /** @param {object} workflow @returns {string} When the workflow runs next. */
    function nextRunText(workflow) {
      const next = TRIGGERS.find((entry) => entry.ID === workflow.trigger).next;
      if (!workflow.active) return 'No runs scheduled';
      if (!next) return workflow.trigger === 'manual' ? 'Runs when started by hand' : 'Runs on every won deal';
      return `Next run ${when(next)}`;
    }

    /* ------------------------------------------------------------- workflow */

    /** Shows one workflow in the main pane. @param {string} id @returns {void} */
    function openWorkflow(id) {
      const hadFocus = root.contains(document.activeElement);
      if (state.view === 'workflow') remembered.set(state.workflow.id, state.step);
      state.workflow = workflows.find((workflow) => workflow.id === id) ?? workflows[0];
      state.view = 'workflow';
      state.step = remembered.get(state.workflow.id) ?? state.workflow.steps[0].id;
      state.run = runs[state.workflow.id][0]?.id ?? null;
      nav.setActive(state.workflow.id);
      workflowView.hidden = false;
      pageView.hidden = true;
      title.textContent = state.workflow.name;
      activeToggle.set(state.workflow.active, { silent: true });
      renderTab();
      if (hadFocus) settleFocus();
    }

    /** Draws the line under the header, the active tab, and the inspector. @returns {void} */
    function renderTab() {
      const workflow = state.workflow;
      const trigger = TRIGGERS.find((entry) => entry.ID === workflow.trigger);
      pageScope.reset();
      summary.replaceChildren(
        h('span', { class: 'flow__fact' }, trigger.name),
        h('span', { class: 'flow__fact' }, avatar(workflow.owner, pageScope, 20), `Owned by ${person(workflow.owner).name}`),
        h('span', { class: 'flow__fact' }, nextRunText(workflow)),
        h('span', { class: 'shell__spacer' }),
        saved.toElement());
      const running = runs[workflow.id].filter((run) => run.status === 'running').length;
      tabs.setBadge('runs', running ? String(running) : null);
      if (state.tab === 'builder') renderBuilder();
      else if (state.tab === 'runs') renderRuns();
      else renderInsights();
      renderAside();
    }

    /** Turns the schedule on or off. @param {boolean} active @returns {void} */
    function setActive(active) {
      const workflow = state.workflow;
      workflow.active = active;
      renderTab();
      notify(active ? `${workflow.name} is active. ${nextRunText(workflow)}.` : `${workflow.name} is paused.`);
    }

    /** Starts a run by hand and shows it on the Runs tab. @returns {void} */
    function runNow() {
      const list = runs[state.workflow.id];
      const run = {
        id: Math.max(0, ...list.map((entry) => entry.id)) + 1, label: 'Started by hand', started: NOW.toISOString(),
        status: 'running', branch: 0, done: 0, steps: flatten(state.workflow.steps, 0)
      };
      list.unshift(run);
      state.run = run.id;
      advance(run);
      if (state.tab === 'runs') renderTab();
      else tabs.openTab('runs');
      notify(`Run #${run.id} of ${state.workflow.name} started.`);
    }

    /** Walks the flow without side effects and reports the result. @returns {void} */
    function testRun() {
      const count = flatten(state.workflow.steps).length;
      notify(`Test run passed: ${count} steps checked, nothing was sent.`);
    }

    /** @returns {Promise<void>} Deletes the workflow and its history after confirmation. */
    async function deleteWorkflow() {
      const confirmed = await Dialog.confirm({
        title: 'Delete this workflow?', danger: true, okLabel: 'Delete workflow',
        message: `${state.workflow.name} and its run history will be deleted. This cannot be undone.`
      });
      if (!confirmed) return;
      workflows.splice(workflows.indexOf(state.workflow), 1);
      refreshNav();
      if (workflows.length) openWorkflow(workflows[0].id);
      else openPage('home');
      notify('Workflow deleted.');
    }

    /** @returns {Promise<void>} Names and creates a paused workflow that holds only its trigger. */
    async function createWorkflow() {
      // From the navigation drawer, the drawer closes first, so the dialog hands the focus back to
      // something still on screen.
      shell.closeNav();
      const name = await Dialog.prompt({ title: 'New workflow', message: 'Name', value: 'Untitled workflow' });
      if (!name?.trim()) return;
      const workflow = {
        id: `workflow-${nextId++}`, name: name.trim(), icon: 'diagram-project', owner: ME, active: false,
        trigger: 'manual', target: 72, edited: { by: ME, at: NOW.toISOString() },
        steps: [{ id: `step-${nextId++}`, type: 'trigger' }]
      };
      workflows.push(workflow);
      runs[workflow.id] = [];
      refreshNav();
      state.tab = 'builder';
      tabs.openTab('builder');
      openWorkflow(workflow.id);
    }

    /* --------------------------------------------------------------- builder */

    /** Draws the flow: step cards, connectors with add buttons, and conditions' branches. @returns {void} */
    function renderBuilder() {
      const refocus = !preview && builderPanel.contains(document.activeElement);
      builderScope.reset();
      addMenus.clear();
      const workflow = state.workflow;
      builderPanel.replaceChildren(h('div', { class: 'flow__column' },
        workflow.suggestion ? suggestionCard(workflow) : null,
        h('ol', { class: 'flow__steps', 'aria-label': `Steps of ${workflow.name}` },
          workflow.steps.map((step, index) => stepItem(step, workflow.steps, index, false))),
        h('p', { class: 'flow__end' }, icon('flag-checkered'), 'End of workflow'),
        h('p', { class: 'flow__keys meta' },
          h('span', {}, kbd('↑'), kbd('↓'), 'Move between steps'),
          h('span', {}, kbd('Alt', '↑'), 'Reorder'),
          h('span', {}, kbd('A'), 'Add after'),
          h('span', {}, kbd('Del'), 'Delete'))));
      if (refocus) currentCard()?.focus();
    }

    /** @returns {HTMLElement|null} The card of the selected step. */
    function currentCard() {
      return builderPanel.querySelector(`.flow__step[data-id="${CSS.escape(state.step)}"]`);
    }

    /**
     * The assistant's proposal, docked above the flow in the assistant's tone so it never reads as
     * a step: what it suggests, what it is based on, and Apply or Dismiss.
     * @param {object} workflow @returns {HTMLElement}
     */
    function suggestionCard(workflow) {
      const basis = runs[workflow.id].filter((run) => run.status !== 'running').length;
      const dismiss = () => {
        workflow.suggestion = null;
        renderBuilder();
        notify('Suggestion dismissed.', 'info');
      };
      return h('section', { class: 'flow__suggestion', 'aria-label': 'Assistant suggestion' },
        h('div', { class: 'flow__suggestion-body' },
          h('p', { class: 'flow__suggestion-kicker' },
            icon(STEP_TYPES.assistant.icon), 'Suggestion',
            h('span', { class: 'flow__suggestion-basis' }, `Based on ${basis} runs`)),
          h('h3', { class: 'flow__suggestion-title' }, workflow.suggestion.title),
          h('p', { class: 'flow__suggestion-text' }, workflow.suggestion.text)),
        h('div', { class: 'flow__actions' },
          button({ label: 'Apply', icon: 'check', size: 'sm', onclick: () => applySuggestion(workflow) }),
          button({ label: 'Dismiss', size: 'sm', kind: 'ghost', onclick: dismiss })));
    }

    /**
     * One step: its card, a condition's two lanes, and the connector to the next step.
     * @param {object} step @param {object[]} list The list it belongs to. @param {number} index
     * @param {boolean} inBranch Whether that list is a branch; conditions do not nest.
     * @returns {HTMLElement}
     */
    function stepItem(step, list, index, inBranch) {
      const lanes = step.branches?.map((lane) => h('div', { class: 'flow__lane' },
        h('span', { class: 'flow__lane-label' }, lane.label),
        connector(lane.steps, 0, true, `Add a step to the ${lane.label} branch`, `${step.id}:${lane.label}`),
        lane.steps.length ? h('ol', { class: 'flow__steps', 'aria-label': `${lane.label} branch of ${step.name}` },
          lane.steps.map((child, childIndex) => stepItem(child, lane.steps, childIndex, true))) : null));
      return h('li', { class: 'flow__item' },
        stepCard(step),
        lanes ? h('div', { class: 'flow__branches' }, lanes) : null,
        connector(list, index + 1, inBranch, `Add a step after ${stepName(step, state.workflow)}`, step.id));
    }

    /**
     * A step card: its kind in the kind's tone, its name, who or what it involves, and a warning
     * when it usually overruns. @param {object} step @returns {HTMLButtonElement}
     */
    function stepCard(step) {
      const type = STEP_TYPES[step.type];
      const slow = step.due && step.avg > step.due
        ? badge({ label: `Usually ${formatDuration(step.avg)}`, kind: 'warning', size: 'sm', icon: 'hourglass-half' }) : null;
      return h('button', {
        type: 'button', class: 'flow__step', dataset: { id: step.id, tone: type.tone },
        'aria-current': step.id === state.step ? 'true' : null,
        onclick: () => {
          selectStep(step.id);
          revealAside();
        }
      },
      iconTile(type.icon, type.tone, { size: 'lg' }),
      h('span', { class: 'flow__step-body' },
        h('span', { class: 'flow__step-kind' }, type.label),
        h('span', { class: 'flow__step-name' }, stepName(step, state.workflow)),
        h('span', { class: 'flow__step-meta' }, ...stepMeta(step), slow)));
    }

    /** The details line of a card, by step type. @param {object} step @returns {(Node|string)[]} */
    function stepMeta(step) {
      const names = (ids, catalogue) => ids.map((id) => catalogue.find((entry) => entry.ID === id)?.name ?? id).join(', ');
      if (step.type === 'trigger') return [nextRunText(state.workflow)];
      if (step.type === 'condition') return [`If ${ruleText(step.rule).replace(/^\w/, (first) => first.toLowerCase())}`];
      if (step.type === 'notify') return [`To ${names(step.channels, CHANNELS) || 'nobody yet'}`];
      if (step.type === 'followup') return [`Checks progress for ${step.days} days`];
      if (!STEP_TYPES[step.type].people) return [`From ${names(step.sources, SOURCES) || 'no source yet'}`];
      const people = step.people;
      const who = people.length === 1 ? person(people[0]).name : `${people.length || 'No'} people`;
      // The count follows in words, so the "+1" is only for the eye.
      const more = people.length > FACES
        ? h('span', { class: 'flow__more', 'aria-hidden': 'true' }, `+${people.length - FACES}`) : null;
      return [
        h('span', { class: 'avatar-stack' }, people.slice(0, FACES).map((id) => avatar(id, builderScope, 20)), more),
        `${who}, due within ${formatDuration(step.due)}`
      ];
    }

    /**
     * The line between two steps and the add button on it, which opens the step-type menu. The
     * button shows when the line is pointed at or focused; it is always in the tab order.
     * @param {object[]} list Where a new step goes. @param {number} index At which position.
     * @param {boolean} inBranch @param {string} label The button's accessible name.
     * @param {string} key Lets `A` open the menu below the selected step.
     * @returns {HTMLElement}
     */
    function connector(list, index, inBranch, label, key) {
      const groups = inBranch ? ['People', 'Automation'] : ['People', 'Automation', 'Logic'];
      const add = h('button', { type: 'button', class: 'flow__add', 'aria-label': label, title: label },
        icon('plus', { size: 12 }));
      const menu = builderScope.own(new MenuButton(add, {
        kind: 'ghost', placement: 'bottom',
        items: groups.flatMap((group) => [{ type: 'heading', label: group }, ...Object.entries(STEP_TYPES)
          .filter(([, type]) => type.group === group)
          .map(([value, type]) => ({ label: type.label, icon: type.icon, description: type.hint, value }))]),
        onselect: (event) => insertStep(list, index, event.detail.value)
      }));
      addMenus.set(key, menu);
      return h('div', { class: 'flow__connector' }, menu.getTrigger());
    }

    /** Marks a step's card and shows its settings. @param {string} id @returns {void} */
    function selectStep(id) {
      state.step = id;
      for (const card of builderPanel.querySelectorAll('.flow__step')) {
        if (card.dataset.id === id) card.setAttribute('aria-current', 'true');
        else card.removeAttribute('aria-current');
      }
      renderAside();
    }

    /** Selects and focuses the card `delta` places from the selected one. @param {number} delta @returns {void} */
    function moveFocus(delta) {
      const cards = [...builderPanel.querySelectorAll('.flow__step')];
      const target = cards[Math.max(0, Math.min(cards.length - 1, cards.indexOf(currentCard()) + delta))];
      selectStep(target.dataset.id);
      target.focus();
    }

    /**
     * Arrows and Home/End walk the cards, Alt+arrows reorder, Delete removes. Enter and Space
     * are the card buttons' own.
     * @param {KeyboardEvent} event @returns {void}
     */
    function onBuilderKey(event) {
      const card = event.target instanceof Element ? event.target.closest('.flow__step') : null;
      if (!card) return;
      const cards = [...builderPanel.querySelectorAll('.flow__step')];
      const index = cards.indexOf(card);
      const target = cards[{ ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: cards.length - 1 }[event.key]];
      const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
      if (event.altKey && vertical) moveStep(card.dataset.id, event.key === 'ArrowUp' ? -1 : 1);
      else if (event.key === 'Delete' || event.key === 'Backspace') deleteStep(card.dataset.id);
      else if (target && !event.altKey) {
        selectStep(target.dataset.id);
        target.focus();
      } else return;
      event.preventDefault();
    }

    /** A step's actions, shared by the inspector menu and the cards' context menu. @param {string} id */
    function stepActions(id) {
      const found = locate(state.workflow.steps, id);
      if (!found || found.step.type === 'trigger') return [];
      const first = found.index <= (found.inBranch ? 0 : 1);
      const last = found.index >= found.list.length - 1;
      return [
        { label: 'Move up', icon: 'arrow-up', shortcut: 'Alt+↑', disabled: first, onselect: () => moveStep(id, -1) },
        { label: 'Move down', icon: 'arrow-down', shortcut: 'Alt+↓', disabled: last, onselect: () => moveStep(id, 1) },
        '-',
        { label: 'Delete step', icon: 'trash-can', shortcut: 'Del', danger: true, onselect: () => deleteStep(id) }
      ];
    }

    /**
     * Adds a step of a type at a position and selects it.
     * @param {object[]} list @param {number} index @param {string} type
     * @returns {void}
     */
    function insertStep(list, index, type) {
      const meta = STEP_TYPES[type];
      const step = { id: `step-${nextId++}`, type, name: meta.fresh, avg: 0 };
      if (meta.people) Object.assign(step, { people: [state.workflow.owner], due: 24, remind: true });
      if (type === 'gather' || type === 'assistant') Object.assign(step, { sources: ['crm'], instructions: '' });
      if (type === 'notify') step.channels = ['leadership'];
      if (type === 'followup') step.days = 14;
      if (type === 'condition') {
        step.rule = { metric: 'revenue', op: 'below', value: -5 };
        step.branches = [{ label: 'Yes', steps: [] }, { label: 'No', steps: [] }];
      }
      list.splice(index, 0, step);
      state.step = step.id;
      changed();
      if (!preview) currentCard()?.focus();
    }

    /** Moves a step one place within its list; the trigger stays first. @param {string} id @param {number} delta */
    function moveStep(id, delta) {
      const found = locate(state.workflow.steps, id);
      const target = found ? found.index + delta : -1;
      if (!found || target < (found.inBranch ? 0 : 1) || target >= found.list.length) return;
      found.list.splice(target, 0, ...found.list.splice(found.index, 1));
      state.step = id;
      changed();
    }

    /** @param {string} id @returns {Promise<void>} Deletes a step after confirmation and selects its neighbour. */
    async function deleteStep(id) {
      const found = locate(state.workflow.steps, id);
      if (!found || found.step.type === 'trigger') return;
      const nested = flatten([found.step]).length - 1;
      const confirmed = await Dialog.confirm({
        title: 'Delete this step?', danger: true, okLabel: 'Delete step',
        message: `“${found.step.name}” will be removed from ${state.workflow.name}`
          + (nested ? `, with the ${nested} ${nested === 1 ? 'step' : 'steps'} in its branches.` : '.')
          + ' Runs that already started keep it.'
      });
      if (!confirmed) return;
      found.list.splice(found.index, 1);
      state.step = (found.list[found.index] ?? found.list[found.index - 1] ?? state.workflow.steps[0]).id;
      changed();
      if (!preview) currentCard()?.focus();
      notify('Step deleted.');
    }

    /** Applies the suggestion: moves the condition before the step it names. @param {object} workflow */
    function applySuggestion(workflow) {
      const { move, before } = workflow.suggestion;
      const moving = locate(workflow.steps, move);
      moving.list.splice(moving.index, 1);
      workflow.steps.splice(locate(workflow.steps, before).index, 0, moving.step);
      workflow.suggestion = null;
      state.step = move;
      changed();
      notify('Moved the revenue check before the team check-in. The next run uses the new order.');
    }

    /** Redraws after an edit to the flow and saves it. @returns {void} */
    function changed() {
      renderBuilder();
      renderAside();
      save();
    }

    /**
     * Records the edit and shows "Saving…" and then "All changes saved", as an autosaving editor
     * does. @returns {void}
     */
    function save() {
      state.workflow.edited = { by: ME, at: NOW.toISOString() };
      if (preview) return;
      cancelSave();
      saved.set('active', 'Saving…');
      cancelSave = later(context, () => saved.set('success', 'All changes saved'), 700);
    }

    /* ------------------------------------------------------------- inspector */

    /** Shows the selected step's settings, or the selected run on the Runs tab. @returns {void} */
    function renderAside() {
      // A redrawn inspector puts the focus back where it was, so editing a field never drops it.
      const focusables = () => [...aside.querySelectorAll(FOCUSABLE)];
      const active = document.activeElement;
      const focused = aside.contains(active) ? focusables().findIndex((el) => el === active || el.contains(active)) : -1;
      asideScope.reset();
      aside.hidden = state.view !== 'workflow' || state.tab === 'insights';
      if (aside.hidden) shell.toggleAside(false);
      pinAside();
      const label = state.tab === 'runs' ? 'Show run details' : 'Show step settings';
      asideButton.setAttribute('aria-label', label);
      asideButton.title = label;
      if (aside.hidden) aside.replaceChildren();
      else if (state.tab === 'runs') renderRunAside();
      else renderStepAside();
      if (focused >= 0 && !aside.contains(document.activeElement)) {
        const list = focusables();
        /** @type {HTMLElement|undefined} */ (list[Math.min(focused, list.length - 1)])?.focus({ preventScroll: true });
      }
    }

    /**
     * The step settings are how a flow is edited, so they stay beside it down to `PINNED_WIDTH`;
     * a run's details, like any inspector, give way at the shell's own width.
     * @returns {void}
     */
    function pinAside() {
      aside.toggleAttribute('data-pinned', state.tab === 'builder' && state.roomy);
    }

    /** Opens the inspector drawer for what was just opened, when the inspector has given way. @returns {void} */
    function revealAside() {
      if (preview || aside.hidden || aside.offsetParent !== null) return;
      shell.toggleAside(true);
    }

    /**
     * Runs a choice made in the navigation; made in the drawer, the drawer closes and the new
     * screen's title takes the focus.
     * @param {() => void} go
     * @returns {void}
     */
    function fromNav(go) {
      const drawer = root.dataset.navOpen === 'true';
      go();
      if (!drawer) return;
      shell.closeNav();
      focusTitle();
    }

    /**
     * After the main pane changed under the focus — a card or a button that is gone or hidden — the
     * new screen's title takes it, so it never falls back to the page.
     * @returns {void}
     */
    function settleFocus() {
      const active = document.activeElement;
      if (preview || (active instanceof HTMLElement && root.contains(active) && active.offsetParent !== null)) return;
      focusTitle();
    }

    /** @returns {void} */
    function focusTitle() {
      const heading = (workflowView.hidden ? pageView : workflowView).querySelector('.shell__title');
      if (!(heading instanceof HTMLElement)) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }

    /** The inspector for the selected step. @returns {void} */
    function renderStepAside() {
      const workflow = state.workflow;
      const { step } = locate(workflow.steps, state.step) ?? { step: workflow.steps[0] };
      const type = STEP_TYPES[step.type];
      const menu = step.type === 'trigger' ? null : asideScope.own(new MenuButton(iconButton('ellipsis', 'Step actions'), {
        kind: 'ghost', placement: 'bottom-end', items: stepActions(step.id)
      }));
      const flat = flatten(workflow.steps);
      const set = (key) => (value) => { step[key] = value; };
      aside.replaceChildren(
        paneHeader({ title: type.label, leading: iconTile(type.icon, type.tone), actions: menu?.toElement() }),
        h('div', { class: 'shell__body' },
          panelBlock('Step', step.type === 'trigger' ? triggerFields(workflow) : stepFields(step)),
          step.type === 'condition' ? panelBlock('Rule', ruleFields(step)) : null,
          ['trigger', 'condition'].includes(step.type) ? null : panelBlock('Conditions',
            field('zxselect', 'Run this step', step.when ?? 'always', { items: WHEN }, (value) => {
              step.when = value;
              save();
            })),
          step.type === 'assistant' ? panelBlock('Assistant',
            field('textarea', 'Instructions', step.instructions, { rows: 5 }, (value) => {
              step.instructions = value;
              save();
            }),
            toggle('Ask the owner to review before sharing', step.review, set('review'))) : null,
          type.people ? panelBlock('Notifications',
            toggle('Remind a day before it is due', step.remind, set('remind')),
            toggle('Escalate to the owner when overdue', step.escalate, set('escalate'))) : null,
          panelBlock('History', propList([
            ['Position', `Step ${flat.indexOf(step) + 1} of ${flat.length}`],
            ['Usually takes', step.type === 'trigger' ? '—' : formatDuration(step.avg || 0.02)],
            ['Last edited', `${person(workflow.edited.by).name}, ${formatRelativeTime(workflow.edited.at, { now: NOW })}`]
          ]))));
    }

    /**
     * A labelled inspector field, owned by the inspector.
     * @param {string} type Field type: `text`, `textarea`, `zxselect`, `tagpicker`, `number`.
     * @param {string} label @param {unknown} value @param {Record<string, unknown>} props Control options.
     * @param {(value: any) => void} onchange
     * @returns {HTMLElement}
     */
    function field(type, label, value, props, onchange) {
      const options = { type, label, value, props, onchange: (event) => onchange(event.detail.value) };
      return asideScope.own(new Field(null, options)).toElement();
    }

    /**
     * A switch for one setting; every change is saved.
     * @param {string} label @param {boolean} [checked] @param {(on: boolean) => void} onchange
     * @returns {HTMLElement}
     */
    function toggle(label, checked, onchange) {
      return asideScope.own(new Toggle(null, {
        label, checked: Boolean(checked), onchange: (event) => { onchange(event.detail.checked); save(); }
      })).toElement();
    }

    /** What starts the workflow. @param {object} workflow @returns {Node[]} */
    function triggerFields(workflow) {
      const owner = h('span', { class: 'person' }, avatar(workflow.owner, asideScope),
        h('span', { class: 'person__name' }, person(workflow.owner).name));
      return [
        field('zxselect', 'Starts', workflow.trigger, { items: TRIGGERS }, (value) => {
          workflow.trigger = value;
          renderTab();
          save();
        }),
        propList([['Time zone', 'Europe/Berlin'], ['Owner', owner]])
      ];
    }

    /** Name, people, due time, and what the step reads or posts to. @param {object} step @returns {Node[]} */
    function stepFields(step) {
      const people = PEOPLE.map((entry) => ({ ID: entry.id, name: entry.name }));
      const name = asideScope.own(new Field(null, { type: 'text', label: 'Name', value: step.name, onchange: save }));
      name.getInput().addEventListener('input', (event) => {
        step.name = event.target.value;
        currentCard()?.querySelector('.flow__step-name')?.replaceChildren(step.name);
      });
      const unit = step.due % 24 === 0 ? 'days' : 'hours';
      const amount = unit === 'days' ? step.due / 24 : step.due;
      const setDue = (value, per) => {
        step.due = Math.max(1, Number(value) || 1) * (per === 'days' ? 24 : 1);
        changed();
      };
      const setList = (key) => (values) => {
        step[key] = values;
        changed();
      };
      return [
        name.toElement(),
        step.type === 'checkin'
          ? field('tagpicker', 'People', step.people, { items: people, placeholder: 'Add people' }, setList('people')) : null,
        ['task', 'approval'].includes(step.type) ? field('zxselect', 'Assignee', step.people[0], {
          items: people, renderValueAdornment: (item) => avatar(item.ID, asideScope)
        }, (value) => setList('people')([value])) : null,
        STEP_TYPES[step.type].people ? h('div', { class: 'flow__pair' },
          field('number', 'Due within', amount, { min: 1, max: 720 }, (value) => setDue(value, unit)),
          field('zxselect', 'Unit', unit, { items: [{ ID: 'hours', name: 'Hours' }, { ID: 'days', name: 'Days' }] },
            (per) => setDue(amount, per))) : null,
        step.type === 'checkin' ? toggle('Only ask people whose numbers did not sync', step.onlyMissing, (on) => {
          step.onlyMissing = on;
        }) : null,
        ['gather', 'assistant'].includes(step.type)
          ? field('tagpicker', 'Read from', step.sources, { items: SOURCES, placeholder: 'Add a source' }, setList('sources'))
          : null,
        step.type === 'notify'
          ? field('tagpicker', 'Post to', step.channels, { items: CHANNELS, placeholder: 'Add a channel' }, setList('channels'))
          : null,
        step.type === 'followup' ? field('number', 'Track for', step.days, { min: 1, max: 90, unit: 'days' }, (value) => {
          step.days = Number(value) || 1;
          changed();
        }) : null
      ];
    }

    /** A condition's rule: which figure, which way, and the threshold. @param {object} step @returns {Node[]} */
    function ruleFields(step) {
      const currency = (metric) => METRICS.find((entry) => entry.ID === metric)?.unit === 'currency';
      const update = (key) => (value) => {
        step.rule[key] = value;
        changed();
      };
      return [
        field('zxselect', 'Figure', step.rule.metric, { items: METRICS }, (metric) => {
          step.rule = currency(metric) ? { metric, op: 'above', value: 5000 } : { metric, op: 'below', value: -5 };
          changed();
        }),
        h('div', { class: 'flow__pair' },
          field('zxselect', 'Is', step.rule.op, { items: [{ ID: 'below', name: 'Below' }, { ID: 'above', name: 'Above' }] },
            update('op')),
          field('number', 'Threshold', step.rule.value, currency(step.rule.metric)
            ? { min: 0, step: 500, group: true, unit: '€' } : { min: -100, max: 100, unit: '%' }, update('value'))),
        h('p', { class: 'meta' }, 'Runs that match take the Yes branch; all others take No.')
      ];
    }

    /* ------------------------------------------------------------------ runs */

    /** Draws the Runs tab: the run in progress and the history. @returns {void} */
    function renderRuns() {
      tabScope.reset();
      const list = runs[state.workflow.id];
      const current = list.find((run) => run.status === 'running');
      runTable.setData(list);
      runTable.setSelection(state.run == null ? [] : [state.run]);
      runsPanel.replaceChildren(
        current ? currentRun(current) : null,
        h('section', { class: 'surface' },
          h('h3', { class: 'surface__title' }, 'Run history', h('span', { class: 'surface__meta num' }, String(list.length))),
          list.length ? runTable.toElement() : emptyState({ icon: 'clock-regular', title: 'No runs yet',
            description: 'Runs appear here once the workflow has started.', size: 'sm' })));
    }

    /** The run in progress: who it waits on and how far it got. @param {object} run @returns {HTMLElement} */
    function currentRun(run) {
      const waiting = waitingOn(run);
      const who = person(waiting.step.people[0]) ?? { id: null, name: 'Nobody yet', role: 'Assign someone in the builder' };
      const total = run.steps.length;
      const stepper = tabScope.own(new Stepper(null, {
        orientation: 'vertical', clickable: false, showNumbers: false, active: `s${run.done}`,
        steps: run.steps.map((step, index) => ({ name: `s${index}`, title: stepName(step, state.workflow) }))
      }));
      for (let index = 0; index < run.done; index += 1) stepper.complete(`s${index}`);
      const progress = tabScope.own(new ProgressBar(null, {
        value: run.done, max: total, size: 'sm', label: `${run.done} of ${total} steps done`
      }));
      const done = waiting.step.type === 'approval' ? 'Approve' : 'Mark done';
      return h('section', { class: 'surface' },
        h('h3', { class: 'surface__title' }, `${run.label} is in progress`,
          badge(waiting.overdue ? OVERDUE : { label: 'On track', kind: 'success', size: 'sm' })),
        progress.toElement(),
        h('div', { class: 'flow__current' },
          h('div', { class: 'flow__waiting' },
            h('h4', { class: 'panel-block__title' }, 'Waiting on'),
            h('div', { class: 'person' }, avatar(who.id, tabScope, 'md'),
              h('span', {}, h('span', { class: 'flow__name' }, who.name), h('span', { class: 'meta flow__block' }, who.role))),
            h('p', { class: 'flow__waiting-step' }, waiting.step.name),
            propList([['Asked', when(run.waitingSince)], ['Due', waiting.due ? when(waiting.due) : '—']]),
            h('div', { class: 'flow__actions' },
              button({ label: 'Send reminder', icon: 'bell', size: 'sm',
                onclick: () => notify(`Reminder sent to ${who.name}.`) }),
              who.id === ME ? button({ label: done, size: 'sm', onclick: () => complete(run) }) : null)),
          stepper.toElement()));
    }

    /** Moves a run on to the next step a person works on, or finishes it. @param {object} run @returns {void} */
    function advance(run) {
      run.done += 1;
      run.waitingSince = NOW.toISOString();
      while (run.done < run.steps.length && !STEP_TYPES[run.steps[run.done].type].people) run.done += 1;
      if (run.done < run.steps.length) return;
      run.status = 'completed';
      run.hours = (NOW - new Date(run.started)) / 3_600_000;
    }

    /** Completes the signed-in user's step of a run and redraws what shows it. @param {object} run @returns {void} */
    function complete(run) {
      const step = run.steps[run.done];
      advance(run);
      refreshNav();
      if (state.view === 'workflow') renderTab();
      else openPage(state.view);
      notify(`${step.name}: done. The run moves on.`);
    }

    /** The inspector for the selected run: facts and a step-by-step transcript. @returns {void} */
    function renderRunAside() {
      const run = runs[state.workflow.id].find((entry) => entry.id === state.run);
      // A run's details hold no control, so the scrolling body takes the focus — from the keyboard,
      // and when the inspector opens as a drawer.
      if (!run) {
        aside.replaceChildren(paneHeader({ title: 'Run' }), h('div', { class: 'shell__body', tabindex: '0' }, emptyState({
          icon: 'clock-regular', title: 'No run selected', description: 'Select a run to see what happened.', size: 'sm'
        })));
        return;
      }
      const activity = asideScope.own(new ActivityList(null, {
        items: transcript(state.workflow, run), groupBy: 'day', label: `What happened in ${run.label}`
      }));
      const finished = run.status === 'completed' ? run.steps.length : run.done;
      aside.replaceChildren(
        paneHeader({ title: `${run.label} · #${run.id}`, actions: statusBadge(run) }),
        h('div', { class: 'shell__body', tabindex: '0' },
          panelBlock('Details', propList([
            ['Started', when(run.started)],
            ['Duration', runDuration(run)],
            ['On time', onTimeBadge(run)],
            ['Steps', `${finished} of ${run.steps.length} done`]])),
          panelBlock('Activity', activity.toElement())));
    }

    /** @param {object} run @returns {string} How long a run took, or has taken so far. */
    function runDuration(run) {
      if (run.status === 'completed') return formatDuration(run.hours);
      return run.status === 'running' ? `${formatDuration((NOW - new Date(run.started)) / 3_600_000)} so far` : '—';
    }

    /** @param {object} run @returns {HTMLElement|string} Whether a run met the workflow's target time. */
    function onTimeBadge(run) {
      const target = state.workflow.target;
      if (run.status === 'running') {
        return badge(waitingOn(run)?.overdue ? OVERDUE : { label: 'On track', size: 'sm' });
      }
      if (run.status !== 'completed') return '—';
      return badge(run.hours <= target ? { label: 'On time', kind: 'success', size: 'sm' }
        : { label: `${formatDuration(run.hours - target)} late`, kind: 'warning', size: 'sm' });
    }

    /** @param {object} run @returns {HTMLElement} The run's status as a badge. */
    function statusBadge(run) {
      return badge({ ...RUN_STATUS[run.status], size: 'sm', dot: true });
    }

    /* -------------------------------------------------------------- insights */

    /** Draws the Insights tab: rates, cycle time per run, and where the time goes. @returns {void} */
    function renderInsights() {
      tabScope.reset();
      const workflow = state.workflow;
      const completed = runs[workflow.id].filter((run) => run.status === 'completed');
      const history = completed.slice().reverse();
      const late = completed.filter((run) => run.hours > workflow.target).length;
      const onTime = completed.length ? 1 - late / completed.length : 0;
      const cycle = completed.reduce((sum, run) => sum + run.hours, 0) / (completed.length || 1);
      const overdue = runs[workflow.id].filter((run) => waitingOn(run)?.overdue).length;
      // `kind` says what a number means — good, a concern, a problem — and the template colours the
      // number by it, so the row reads before its labels do.
      const tiles = [
        { label: 'On-time rate', value: onTime, format: 'percent', kind: onTime < 0.7 ? 'warning' : 'success',
          caption: `${completed.length - late} of ${completed.length} runs` },
        { label: 'Cycle time', value: cycle, format: formatDuration, kind: cycle > workflow.target ? 'warning' : 'neutral',
          caption: `Average of ${completed.length} runs`, trend: history.map((run) => run.hours) },
        { label: 'Overdue steps', value: overdue, kind: overdue ? 'danger' : 'neutral',
          caption: overdue ? 'Waiting past their due time' : 'Nothing is late' },
        { label: 'Target per run', value: workflow.target, format: formatDuration, caption: 'From start to finish' }
      ].map((options) => tabScope.own(statTile(options)).toElement());
      const slowest = flatten(workflow.steps, 0).filter((step) => step.avg > 0).sort((a, b) => b.avg - a.avg).slice(0, 6);
      const bar = (step) => h('li', { class: 'flow__bar' },
        h('span', { class: 'flow__bar-label' }, step.name),
        h('span', { class: 'flow__bar-track', 'aria-hidden': 'true' }, h('span', {
          class: 'flow__bar-fill', 'data-slow': step.avg > step.due ? 'true' : null,
          style: { inlineSize: `${(step.avg / slowest[0].avg) * 100}%` }
        })),
        h('span', { class: 'flow__bar-value num' }, formatDuration(step.avg)));
      const chartHost = h('div', {}, h('p', { class: 'meta' }, 'Loading chart…'));
      // The key uses the chart's own series colours: the first for runs on time, the second for late ones.
      const swatch = (series) => h('span', { class: 'flow__swatch', 'data-series': series, 'aria-hidden': 'true' });
      const legend = h('p', { class: 'flow__legend meta' },
        h('span', {}, swatch('1'), 'On time'),
        h('span', {}, swatch('2'), 'Late'),
        h('span', {}, h('span', { class: 'flow__legend-target', 'aria-hidden': 'true' }), 'Target'));
      insightsPanel.replaceChildren(
        h('div', { class: 'flow__tiles' }, tiles),
        h('section', { class: 'surface' }, h('h3', { class: 'surface__title' }, 'Cycle time per run'), legend, chartHost),
        h('section', { class: 'surface' }, h('h3', { class: 'surface__title' }, 'Where the time goes'),
          h('ol', { class: 'flow__bars' }, slowest.map(bar))));
      if (!preview) drawChart(workflow, history, chartHost);
    }

    /**
     * Loads Chart.js once and draws cycle time per run against the target, in the colours of the
     * current theme.
     * @param {object} workflow @param {object[]} history Completed runs, oldest first.
     * @param {HTMLElement} host
     * @returns {void}
     */
    function drawChart(workflow, history, host) {
      const version = ++chartVersion;
      loadChartJs().then((engine) => {
        if (version !== chartVersion || context.signal.aborted) return;
        const palette = chartPalette(root);
        const [onTime, late] = palette.series;
        const scales = chartScales(palette, { unit: 'Days' });
        const chart = tabScope.own(new Chart(null, {
          adapter: new ChartJsAdapter(engine),
          label: `Cycle time per run of ${workflow.name}, in days`,
          description: 'Bars above the dashed target line were late.',
          aspectRatio: '16 / 5',
          data: {
            labels: history.map((run) => run.label),
            datasets: [{
              label: 'Cycle time (days)', data: history.map((run) => Number((run.hours / 24).toFixed(1))),
              backgroundColor: history.map((run) => (run.hours > workflow.target ? late : onTime)),
              maxBarThickness: 40
            }, {
              type: 'line', label: 'Target (days)', data: history.map(() => workflow.target / 24),
              borderColor: palette.muted, borderDash: [4, 4]
            }]
          },
          chartOptions: {
            ...chartOptions(palette, allowsMotion(context)),
            scales: { ...scales, y: { ...scales.y, beginAtZero: true } }
          }
        }));
        host.replaceChildren(chart.toElement());
      }).catch(() => host.replaceChildren(h('p', { class: 'meta' }, 'The chart could not be loaded.')));
    }

    /* ----------------------------------------------------------------- pages */

    /** Shows one of the fixed destinations instead of a workflow. @param {string} page @returns {void} */
    function openPage(page) {
      const hadFocus = root.contains(document.activeElement);
      if (state.view === 'workflow') remembered.set(state.workflow.id, state.step);
      state.view = page;
      nav.setActive(pageId(page));
      workflowView.hidden = true;
      pageView.hidden = false;
      renderAside();
      pageScope.reset();
      pageTitle.textContent = mainItems().find((item) => item.id === pageId(page)).label;
      const openInsights = () => {
        state.tab = 'insights';
        tabs.openTab('insights');
        openWorkflow('wbr');
      };
      const pages = {
        home: () => [
          h('h2', { class: 'record-title record-title--sm flow__greeting' }, `Good morning, ${person(ME).name.split(' ')[0]}`),
          h('section', { class: 'flow__section' }, h('h3', { class: 'flow__section-title' }, 'Waiting on you'), taskList()),
          h('section', { class: 'flow__section' }, h('h3', { class: 'flow__section-title' }, 'Workflows'),
            h('div', { class: 'flow__cards' }, workflows.map(workflowCard)))
        ],
        tasks: () => [taskList()],
        checkins: () => [taskList('checkin')],
        insights: () => [emptyState({ icon: 'chart-simple', title: 'Insights live with each workflow',
          description: 'Open a workflow and choose Insights to see its on-time rate and where its runs wait.',
          actions: [{ label: 'Open the weekly business review', onclick: openInsights }] })],
        settings: () => [unavailablePane('Settings', { label: 'Back to Home', onclick: () => openPage('home') })]
      };
      pageBody.replaceChildren(...pages[page]());
      if (hadFocus) settleFocus();
    }

    /**
     * The steps waiting on the signed-in user, each with its action.
     * @param {string} [type] Only steps of this type, such as `checkin`.
     * @returns {HTMLElement}
     */
    function taskList(type) {
      const tasks = myTasks().filter((task) => !type || task.step.type === type);
      if (!tasks.length) {
        return emptyState(type === 'checkin'
          ? { icon: 'comments', title: 'No check-ins waiting on you', size: 'sm',
            description: 'Check-ins you are asked to answer appear here while a run waits for your update.' }
          : { icon: 'square-check', title: 'Nothing is waiting on you', size: 'sm',
            description: 'Steps assigned to you appear here while a run waits for them.' });
      }
      const openRun = (task) => {
        state.tab = 'runs';
        tabs.openTab('runs');
        openWorkflow(task.workflow.id);
        state.run = task.run.id;
        renderTab();
        revealAside();
      };
      return h('ul', { class: 'flow__tasks' }, tasks.map((task) => h('li', { class: 'surface flow__task' },
        iconTile(STEP_TYPES[task.step.type].icon, STEP_TYPES[task.step.type].tone, { size: 'lg' }),
        h('span', { class: 'flow__task-body' },
          h('span', { class: 'flow__name' }, task.step.name),
          h('span', { class: 'meta' }, `${task.workflow.name} · ${task.run.label} · due ${when(task.due)}`)),
        badge(task.overdue ? OVERDUE : { label: 'Due soon', kind: 'warning', size: 'sm' }),
        h('span', { class: 'flow__actions' },
          button({ label: 'Open run', size: 'sm', kind: 'ghost', onclick: () => openRun(task) }),
          button({ label: task.step.type === 'approval' ? 'Approve' : 'Mark done', size: 'sm',
            onclick: () => complete(task.run) })))));
    }

    /** A workflow on the home page: state, next run, owner, last run. @param {object} workflow @returns {HTMLElement} */
    function workflowCard(workflow) {
      const last = runs[workflow.id][0];
      const status = workflow.active ? { label: 'Active', kind: 'success' } : { label: 'Paused' };
      return h('button', { type: 'button', class: 'surface flow__card', onclick: () => openWorkflow(workflow.id) },
        h('span', { class: 'flow__card-top' },
          iconTile(workflow.icon),
          h('span', { class: 'flow__card-name' }, workflow.name)),
        h('span', { class: 'flow__card-row meta' }, badge({ ...status, size: 'sm', dot: true }), nextRunText(workflow)),
        h('span', { class: 'flow__card-row meta' },
          avatar(workflow.owner, pageScope),
          last ? `Last run ${last.label}` : 'No runs yet',
          last ? statusBadge(last) : null));
    }
  }
};
