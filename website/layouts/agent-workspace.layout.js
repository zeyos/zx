/*
 * Agent workspace — a team of AI agents working through ACME's tasks, and the person who
 * directs them. The navigation column holds the workspace's sections and the agent roster with
 * live presence; the main pane is a row of editor tabs (Home, a task, a chat, a file) above a
 * bottom panel (terminal, output, problems); the inspector groups the agents by state beside the
 * open run's figures; a status bar runs along the foot.
 *
 * Presence moves: each agent's Avatar carries its `activity`, and with `animate` it breathes while
 * the agent is idle, bobs while it works, sways while it thinks, and leans and blinks when it needs
 * you — every avatar on the page in the library's one shared animation loop, which moves only what
 * is on screen, sleeps while the page is hidden, and rests under reduced motion (the system's, or
 * the status bar's Motion setting). Presence is never told by motion alone: the avatar's dot and a
 * word beside it say it too.
 *
 * The run is drawn by the agent components: RunTrace for the execution log, RunStatus for the
 * open run's figures, and an AgentThread over a Composer for each chat.
 */
import {
  AgentThread, Avatar, Composer, Launcher, ProgressBar, RunStatus, RunTrace, Tabbox, Table, button,
  formatNumber, h, icon, statusIcon
} from '../../src/index.js';
import {
  SHELL_BREAKPOINTS, adaptiveShell, disposer, dot, iconButton, iconTile, kbd, later, layoutContext,
  modShortcut, modifierLabel, paneHeader, panelBlock, renderScope, sectionLabel, shortcutSheet, shortcuts,
  suiteNav, toaster, unavailable
} from './kit.js';
import { ME, NOW, TODAY, person } from './fixtures.js';

/**
 * The agents. Each has a categorical tone and an initial for its avatar; `away` says why an agent
 * that is switched off is not working.
 * @type {{id: string, name: string, role: string, tone: import('../../src/components/avatar/avatar.js').AvatarTone,
 *   initial: string, offline?: boolean, away?: string}[]}
 */
const AGENTS = [
  { id: 'orbit', name: 'Orbit', role: 'Orchestrator', tone: 'violet', initial: 'O' },
  { id: 'fathom', name: 'Fathom', role: 'Research', tone: 'teal', initial: 'F' },
  { id: 'kiln', name: 'Kiln', role: 'Engineering', tone: 'orange', initial: 'K' },
  { id: 'warden', name: 'Warden', role: 'Review and QA', tone: 'amber', initial: 'W' },
  { id: 'ledger', name: 'Ledger', role: 'Finance', tone: 'green', initial: 'L' },
  { id: 'relay', name: 'Relay', role: 'Support', tone: 'blue', initial: 'R' },
  { id: 'quill', name: 'Quill', role: 'Writing', tone: 'pink', initial: 'Q', offline: true, away: 'Off for the release freeze until 14:00' }
];

/** Presence states, in the order the inspector ranks them. */
const PRESENCE = {
  'needs-you': 'Needs you',
  blocked: 'Blocked',
  working: 'Working',
  thinking: 'Thinking',
  idle: 'Idle',
  offline: 'Offline'
};

/** How a plan step's status is drawn: the status `statusIcon()` draws, its tone, and its words. */
const STEP = {
  done: { label: 'Done', status: 'done', tone: 'success' },
  'in-progress': { label: 'In progress', status: 'in-progress', tone: undefined },
  todo: { label: 'To do', status: 'todo', tone: undefined },
  waiting: { label: 'Needs you', status: 'waiting', tone: 'warning' },
  blocked: { label: 'Blocked', status: 'waiting', tone: 'danger' },
  paused: { label: 'Paused', status: 'in-progress', tone: 'muted' }
};

/**
 * @typedef {Object} PlanStep
 * @property {string} text What the step does.
 * @property {string} agent Who does it: an agent id, or `me` for the signed-in person.
 * @property {'done'|'in-progress'|'todo'|'waiting'|'blocked'} status
 * @property {number} [secs] How long a finished step took.
 * @property {string|number} [since] When the current state began, `HH:MM:SS` in the fixtures.
 * @property {string} [doing] How the agent's presence describes the step while it works on it.
 * @property {'thinking'} [mode] A step the agent is reasoning through rather than acting on.
 * @property {string} [blocker] Why the step stopped, while it is blocked.
 * @property {{from: string, label: string, ask: string, waiting: string, done: string}} [approval]
 *   A step that is the signed-in person's decision: who asked, the button, the question, what the
 *   asking agent's presence says meanwhile, and what the log records once it is approved.
 */
/**
 * @typedef {Object} LogEvent
 * @property {string|number} at When, `HH:MM:SS` in the fixtures.
 * @property {string} actor Agent id, or `me`.
 * @property {'tool'|'handoff'|'note'|'request'|'decision'|'block'} kind
 * @property {string} action What happened, in words.
 * @property {string} [call] The tool that was called.
 * @property {string} [args] Its arguments, or the note handed over.
 * @property {string} [to] The agent a hand-off went to.
 * @property {number} [ms] How long the call took.
 * @property {number} [tokens] Tokens it used.
 * @property {boolean} [running] Still under way.
 * @property {string} [file] A file the event wrote or read, by id.
 * @property {string[]} [detail] What the row shows when it is expanded.
 * @property {boolean} [pause] The event that paused the run.
 * @property {number} [retryOf] The index of the event this one repeats, once a block is resolved.
 */
/**
 * @typedef {Object} AgentTask
 * @property {string} id
 * @property {number} number
 * @property {string} title
 * @property {string} project
 * @property {string} lead The orchestrating agent.
 * @property {string} owner The agent the task belongs to.
 * @property {number} run
 * @property {string} branch
 * @property {string|number} started
 * @property {string|number} [finished]
 * @property {boolean} [paused]
 * @property {string|number} [pausedAt]
 * @property {number} [pausedFor] Seconds spent paused before the current pause.
 * @property {string} [pauseReason]
 * @property {PlanStep[]} plan
 * @property {LogEvent[]} log Oldest first.
 */

/** @type {AgentTask[]} */
const TASKS = [
  {
    id: 'fix-exports', number: 214, title: 'Fix skipped rows in nightly exports', project: 'Reporting API v2',
    lead: 'orbit', owner: 'kiln', run: 482, branch: 'fix/cursor-pagination', started: '10:11:48',
    plan: [
      { text: 'Reproduce with Kestrel’s dataset', agent: 'fathom', status: 'done', secs: 130 },
      { text: 'Trace the root cause', agent: 'fathom', status: 'done', secs: 272 },
      { text: 'Write the fix and a regression test', agent: 'kiln', status: 'done', secs: 365 },
      { text: 'Run the export suite', agent: 'warden', status: 'in-progress', since: '10:27:02', doing: 'Running the export suite' },
      { text: 'Approve deploy to staging', agent: 'me', status: 'todo', approval: {
        from: 'warden', label: 'Approve deploy', ask: 'The export suite passed. Deploy the fix to staging?',
        waiting: 'Waiting for your deploy approval', done: 'Approved deploy to staging'
      } },
      { text: 'Deploy and backfill affected exports', agent: 'kiln', status: 'todo', doing: 'Deploying and backfilling exports' },
      { text: 'Tell the affected customers', agent: 'relay', status: 'todo', doing: 'Writing to the affected customers' }
    ],
    log: [
      { at: '10:11:52', actor: 'orbit', kind: 'tool', action: 'Planned the task', call: 'plan', args: 'steps: 7', ms: 2100, tokens: 1820,
        detail: ['Seven steps: reproduce, trace, fix, test, approve, deploy and backfill, tell customers.', 'Research goes to Fathom, the fix to Kiln, the review to Warden.'] },
      { at: '10:11:55', actor: 'orbit', kind: 'handoff', to: 'fathom', action: 'Handed off to Fathom', args: '“Reproduce with Kestrel’s dataset”',
        detail: ['Kestrel reported missing rows in the export of 6 October. Start from their dataset.'] },
      { at: '10:12:31', actor: 'fathom', kind: 'tool', action: 'Queried the export', call: 'query_export', args: 'tenant: "kestrel", day: "2026-10-06"', ms: 3400, tokens: 912,
        detail: ['13,184 rows expected, 13,153 exported.', 'Pages 14, 15, and 22 start one row late.'] },
      { at: '10:14:41', actor: 'fathom', kind: 'tool', action: 'Searched the code', call: 'search_code', args: 'query: "cursor", path: "api/reporting"', ms: 1200, tokens: 2410,
        detail: ['4 matches in 2 files: cursor.ts (3), export.ts (1).'] },
      { at: '10:16:02', actor: 'fathom', kind: 'tool', action: 'Read a file', call: 'read_file', args: 'path: "api/reporting/cursor.ts", lines: "41-88"', ms: 400, tokens: 3120,
        detail: ['The cursor stores the key of the last row read, deleted rows included.'], file: 'cursor' },
      { at: '10:19:13', actor: 'fathom', kind: 'tool', action: 'Wrote the findings', call: 'write_file', args: 'path: "notes/research.md"', ms: 300, tokens: 1240,
        detail: ['Root cause, reproduction, and a proposed fix.'], file: 'research' },
      { at: '10:19:15', actor: 'fathom', kind: 'handoff', to: 'kiln', action: 'Handed off to Kiln', args: '“Root cause in research.md”',
        detail: ['Read the key from the last row returned, not the last row read. Test deletions on both sides of a page boundary.'] },
      { at: '10:21:40', actor: 'kiln', kind: 'tool', action: 'Edited a file', call: 'edit_file', args: 'path: "api/reporting/cursor.ts", +12 -4', ms: 600, tokens: 4230,
        detail: ['readPage() now keeps the key of the last visible row.'], file: 'cursor' },
      { at: '10:24:02', actor: 'kiln', kind: 'tool', action: 'Wrote a test', call: 'write_file', args: 'path: "api/reporting/cursor.test.ts", +38', ms: 400, tokens: 2780,
        detail: ['Three cases: a deleted row before, on, and after a page boundary.'], file: 'cursor-test' },
      { at: '10:25:20', actor: 'kiln', kind: 'tool', action: 'Ran the tests', call: 'run_tests', args: 'filter: "cursor"', ms: 8200, tokens: 610,
        detail: ['6 passed, 0 failed.'] },
      { at: '10:25:24', actor: 'kiln', kind: 'handoff', to: 'warden', action: 'Handed off to Warden', args: '“Fix ready for review”',
        detail: ['Branch fix/cursor-pagination. Please run the full export suite before anything ships.'] },
      { at: '10:26:10', actor: 'warden', kind: 'tool', action: 'Reviewed the change', call: 'review_diff', args: 'branch: "fix/cursor-pagination"', ms: 4800, tokens: 5640,
        detail: ['No blocking findings. One unused import in cursor.ts.'] },
      { at: '10:27:02', actor: 'warden', kind: 'tool', action: 'Running the export suite', call: 'run_tests', args: 'suite: "export", all: true', running: true,
        detail: ['Checking 214 exports across 12 tenants.'] }
    ]
  },
  {
    id: 'kestrel-reply', number: 213, title: 'Reply to Kestrel about the missing rows', project: 'Support',
    lead: 'orbit', owner: 'relay', run: 481, branch: 'main', started: '10:14:10',
    plan: [
      { text: 'Read the ticket and the incident notes', agent: 'relay', status: 'done', secs: 48 },
      { text: 'Draft a reply', agent: 'relay', status: 'done', secs: 125 },
      { text: 'Approve the reply', agent: 'me', status: 'waiting', since: '10:21:30', approval: {
        from: 'relay', label: 'Approve reply', ask: 'The reply to Kestrel is drafted. Send it?',
        waiting: 'Waiting for you to review the reply to Kestrel', done: 'Approved the reply to Kestrel'
      } },
      { text: 'Send the reply', agent: 'relay', status: 'todo', doing: 'Sending the reply to Kestrel' },
      { text: 'Close the ticket', agent: 'relay', status: 'todo', doing: 'Closing the ticket' }
    ],
    log: [
      { at: '10:14:10', actor: 'orbit', kind: 'handoff', to: 'relay', action: 'Handed off to Relay', args: '“Kestrel asks why rows were missing”',
        detail: ['Ticket SUP-3381 from Priya Natarajan. Wait for Fathom’s findings before answering.'] },
      { at: '10:14:22', actor: 'relay', kind: 'tool', action: 'Read the ticket', call: 'read_ticket', args: 'id: "SUP-3381"', ms: 600, tokens: 1080,
        detail: ['Priya asks why 31 rows were missing from Tuesday’s export, and whether data was exposed.'] },
      { at: '10:19:40', actor: 'relay', kind: 'tool', action: 'Read the findings', call: 'read_file', args: 'path: "notes/research.md"', ms: 300, tokens: 2040,
        detail: ['Rows were left out, not exposed.'], file: 'research' },
      { at: '10:21:25', actor: 'relay', kind: 'tool', action: 'Drafted a reply', call: 'draft_reply', args: 'to: "priya@kestrel.example"', ms: 6100, tokens: 3420,
        detail: ['Explains the cause, confirms nothing was exposed, and promises corrected files.'], file: 'reply' },
      { at: '10:21:30', actor: 'relay', kind: 'request', action: 'Asked you to review the reply', args: 'support/kestrel-reply.md',
        detail: ['Nothing goes to a customer without your approval.'], file: 'reply' }
    ]
  },
  {
    id: 'reconcile', number: 212, title: 'Reconcile September freight invoices', project: 'Finance',
    lead: 'orbit', owner: 'ledger', run: 480, branch: 'main', started: '09:58:30',
    plan: [
      { text: 'Collect September freight invoices', agent: 'ledger', status: 'done', secs: 72 },
      { text: 'Match invoices to the freight ledger', agent: 'ledger', status: 'in-progress', since: '10:02:10', doing: 'Matching 240 freight invoices' },
      { text: 'Flag mismatches for review', agent: 'ledger', status: 'todo', doing: 'Flagging mismatches' },
      { text: 'Approve the adjustments', agent: 'me', status: 'todo', approval: {
        from: 'ledger', label: 'Approve adjustments', ask: 'Three adjustments are ready. Post them?',
        waiting: 'Waiting for you to approve three adjustments', done: 'Approved the adjustments'
      } },
      { text: 'Post to accounting', agent: 'ledger', status: 'todo', doing: 'Posting to accounting' }
    ],
    log: [
      { at: '09:58:30', actor: 'orbit', kind: 'handoff', to: 'ledger', action: 'Handed off to Ledger', args: '“Reconcile September freight”',
        detail: ['Bruckner Logistik invoices for September against the freight ledger.'] },
      { at: '09:58:41', actor: 'ledger', kind: 'tool', action: 'Fetched the invoices', call: 'fetch_invoices', args: 'supplier: "bruckner", month: "2026-09"', ms: 2200, tokens: 1430,
        detail: ['240 invoices, €184,320.50 in total.'] },
      { at: '10:02:10', actor: 'ledger', kind: 'tool', action: 'Matching against the ledger', call: 'match_ledger', args: 'invoices: 240', running: true,
        detail: ['212 of 240 matched so far.'] }
    ]
  },
  {
    id: 'vendors', number: 211, title: 'Compare depot scanner vendors', project: 'Warehouse rollout',
    lead: 'orbit', owner: 'fathom', run: 479, branch: 'main', started: '10:02:00',
    plan: [
      { text: 'List vendors that meet the brief', agent: 'fathom', status: 'done', secs: 200 },
      { text: 'Compare price, battery life, and support', agent: 'fathom', status: 'in-progress', mode: 'thinking', since: '10:20:40', doing: 'Comparing depot scanner vendors' },
      { text: 'Write the recommendation', agent: 'quill', status: 'todo', doing: 'Writing the recommendation' }
    ],
    log: [
      { at: '10:02:00', actor: 'orbit', kind: 'handoff', to: 'fathom', action: 'Handed off to Fathom', args: '“Scanners under €400 for six depots”',
        detail: ['Rugged, a full shift on one charge, repairs within a week.'] },
      { at: '10:05:20', actor: 'fathom', kind: 'tool', action: 'Searched the web', call: 'web_search', args: 'query: "rugged barcode scanner depot"', ms: 2800, tokens: 3900,
        detail: ['18 results; 5 vendors meet the brief.'] },
      { at: '10:20:40', actor: 'fathom', kind: 'note', action: 'Comparing five vendors', args: 'price, battery, support', running: true,
        detail: ['Weighing a cheaper scanner against a longer warranty.'] }
    ]
  },
  {
    id: 'release-notes', number: 210, title: 'Draft the 4.2 release notes', project: 'Customer portal',
    lead: 'orbit', owner: 'quill', run: 478, branch: 'release/4.2', started: '09:30:00',
    paused: true, pausedAt: '09:40:00', pauseReason: 'Release freeze until 14:00',
    plan: [
      { text: 'Collect merged changes', agent: 'quill', status: 'done', secs: 100 },
      { text: 'Group the changes by area', agent: 'quill', status: 'done', secs: 125 },
      { text: 'Write the notes', agent: 'quill', status: 'in-progress', since: '09:34:00', doing: 'Writing the 4.2 release notes' },
      { text: 'Check tone and accuracy', agent: 'warden', status: 'todo', doing: 'Checking the release notes' }
    ],
    log: [
      { at: '09:30:00', actor: 'orbit', kind: 'handoff', to: 'quill', action: 'Handed off to Quill', args: '“Release notes for 4.2”',
        detail: ['Customer-facing, grouped by area, no internal ticket numbers.'] },
      { at: '09:31:40', actor: 'quill', kind: 'tool', action: 'Listed merged changes', call: 'list_changes', args: 'since: "4.1.0"', ms: 1900, tokens: 2600,
        detail: ['42 changes in 3 areas.'] },
      { at: '09:40:00', actor: 'orbit', kind: 'note', action: 'Paused for the release freeze', args: 'until 14:00', pause: true,
        detail: ['Nothing changes on release/4.2 until the freeze lifts.'] }
    ]
  },
  {
    id: 'audit-summary', number: 209, title: 'Summarise the ISO audit agenda', project: 'Operations',
    lead: 'orbit', owner: 'fathom', run: 476, branch: 'main', started: '08:40:00', finished: '08:52:30',
    plan: [
      { text: 'Read the audit agenda', agent: 'fathom', status: 'done', secs: 95 },
      { text: 'Write a one-page summary', agent: 'quill', status: 'done', secs: 310 }
    ],
    log: [
      { at: '08:40:05', actor: 'fathom', kind: 'tool', action: 'Read the agenda', call: 'read_file', args: 'path: "audit/agenda.pdf"', ms: 1500, tokens: 4100,
        detail: ['Two days: access control and suppliers, then incidents and backups.'] },
      { at: '08:52:30', actor: 'quill', kind: 'tool', action: 'Wrote the summary', call: 'write_file', args: 'path: "audit/summary.md"', ms: 900, tokens: 2300,
        detail: ['One page, with a named contact for each block.'] }
    ]
  },
  {
    id: 'ops-report', number: 208, title: 'Weekly operations report', project: 'Operations',
    lead: 'orbit', owner: 'quill', run: 475, branch: 'main', started: '08:00:00', finished: '08:21:10',
    plan: [
      { text: 'Collect the week’s numbers', agent: 'ledger', status: 'done', secs: 240 },
      { text: 'Write the report', agent: 'quill', status: 'done', secs: 520 },
      { text: 'Check the figures', agent: 'warden', status: 'done', secs: 150 }
    ],
    log: [
      { at: '08:04:00', actor: 'ledger', kind: 'tool', action: 'Collected the numbers', call: 'query_metrics', args: 'week: 41', ms: 3100, tokens: 1900,
        detail: ['On-time delivery 97%, 1,284 orders shipped.'] },
      { at: '08:18:40', actor: 'quill', kind: 'tool', action: 'Wrote the report', call: 'write_file', args: 'path: "reports/week-41.md"', ms: 1100, tokens: 3600,
        detail: ['Two pages, highlights first.'] },
      { at: '08:21:10', actor: 'warden', kind: 'tool', action: 'Checked the figures', call: 'verify_figures', args: 'report: "week-41"', ms: 2400, tokens: 1500,
        detail: ['Every figure matches its source.'] }
    ]
  }
];

/** What happened lately, newest first, for Home. */
const ACTIVITY = [
  { at: '10:27:02', actor: 'warden', text: 'started the export suite on fix/cursor-pagination' },
  { at: '10:25:24', actor: 'kiln', text: 'handed the fix for skipped rows to Warden' },
  { at: '10:21:30', actor: 'relay', text: 'asked you to review a reply to Kestrel' },
  { at: '10:20:40', actor: 'fathom', text: 'started comparing depot scanner vendors' },
  { at: '10:19:13', actor: 'fathom', text: 'wrote research.md' },
  { at: '10:18:05', actor: 'ledger', text: 'matched 212 of 240 freight invoices' },
  { at: '09:40:00', actor: 'quill', text: 'went offline for the release freeze' }
];

/** Requests Home suggests, one click from the composer. */
const SUGGESTIONS = [
  { icon: 'magnifying-glass', text: 'Find out why the Bruckner invoices don’t match' },
  { icon: 'pen', text: 'Draft a status update for Kestrel' },
  { icon: 'bug', text: 'Fix the flaky timeout in the nightly import' },
  { icon: 'chart-line', text: 'Summarise this week’s support tickets' }
];

/** How the orchestrator routes a request: the words that send it to each agent. */
const ROUTES = [
  { agent: 'fathom', words: ['research', 'compare', 'find', 'why', 'investigate', 'vendor', 'analys', 'analyz'] },
  { agent: 'kiln', words: ['fix', 'bug', 'code', 'deploy', 'build', 'refactor', 'api', 'page', 'timeout'] },
  { agent: 'warden', words: ['review', 'test', 'check', 'audit', 'security', 'verify'] },
  { agent: 'ledger', words: ['invoice', 'reconcile', 'payment', 'freight', 'budget', 'ledger', 'accrual', 'cost'] },
  { agent: 'relay', words: ['reply', 'customer', 'ticket', 'support', 'answer', 'email'] },
  { agent: 'quill', words: ['write', 'draft', 'notes', 'summar', 'report', 'update', 'changelog'] }
];

/** Workflows the palette can start, and the agent each one goes to. */
const WORKFLOWS = [
  { id: 'export-check', label: 'Nightly export check', agent: 'warden', description: 'Compare last night’s exports with a full scan' },
  { id: 'month-end', label: 'Month-end close', agent: 'ledger', description: 'Reconcile, accrue, and post September' },
  { id: 'ticket-triage', label: 'Triage new support tickets', agent: 'relay', description: 'Label, prioritise, and draft first replies' },
  { id: 'vendor-brief', label: 'Vendor research brief', agent: 'fathom', description: 'Shortlist suppliers against a brief' },
  { id: 'release-notes', label: 'Release notes from merged changes', agent: 'quill', description: 'Group merged changes into customer notes' }
];

/** The models the agents can run on. */
const MODELS = [
  { id: 'ridge-pro', label: 'Ridge 3 Pro', description: 'Plans and reviews well; the default' },
  { id: 'ridge-swift', label: 'Ridge 3 Swift', description: 'Fast, for routine tool calls' },
  { id: 'ridge-mini', label: 'Ridge 3 Mini', description: 'The cheapest, for summaries' },
  { id: 'ridge-long', label: 'Ridge 3 Long', description: 'Reads a whole repository at once' }
];

/**
 * The workspace's files. A document is a list of blocks — `['title'|'h'|'p', text]`, `['ul', items]`,
 * `['code', lines]`; code is a list of lines.
 * @type {{id: string, name: string, path: string, by: string, edited: string, kind: 'doc'|'code',
 *   blocks?: Array<[string, string|string[]]>, lines?: string[]}[]}
 */
const FILES = [
  { id: 'research', name: 'research.md', path: 'notes/research.md', by: 'fathom', edited: '10:19', kind: 'doc', blocks: [
    ['title', 'Skipped rows in nightly exports'],
    ['p', 'Kestrel’s export of 6 October left out 31 rows. Every one sat right after a page boundary that fell on a soft-deleted invoice.'],
    ['h', 'Reproduction'],
    ['ul', [
      'Dataset: Kestrel, 6 October, 13,184 invoices, pages of 500.',
      'Pages 14, 15, and 22 start one row late.',
      'Reproduces locally with two deleted rows on one boundary.'
    ]],
    ['h', 'Root cause'],
    ['p', 'The cursor stores the key of the last row it read, deleted rows included. The next page starts after that key and skips the first visible row.'],
    ['code', [
      'const after = rows.at(-1).key;                // before: deleted rows count',
      'const after = visible.at(-1)?.key ?? cursor;  // after: only rows returned'
    ]],
    ['h', 'Proposed fix'],
    ['p', 'Read the key from the last row returned, and test deletions on both sides of a boundary. Backfill every export from 22 September onwards.']
  ] },
  { id: 'reply', name: 'kestrel-reply.md', path: 'support/kestrel-reply.md', by: 'relay', edited: '10:21', kind: 'doc', blocks: [
    ['title', 'Re: Missing rows in Tuesday’s export'],
    ['p', 'Hello Priya,'],
    ['p', 'thank you for flagging this. Tuesday’s export skipped one row wherever a page ended on a deleted invoice — 31 rows in all. Nothing was exposed; the rows were simply left out of the file.'],
    ['p', 'The fix is being tested now. Once it is live we will regenerate every export since 22 September and send you the corrected files.'],
    ['p', 'Best regards, Ines Bauer, ACME']
  ] },
  { id: 'cursor', name: 'cursor.ts', path: 'api/reporting/cursor.ts', by: 'kiln', edited: '10:21', kind: 'code', lines: [
    'import { encode } from \'./codec\';',
    'import type { Page, Row } from \'./types\';',
    'import { deletedAt } from \'./filters\';',
    '',
    'export interface Cursor {',
    '  after: string | null;',
    '  size: number;',
    '}',
    '',
    '/** Reads one page after the cursor, leaving out deleted rows. */',
    'export async function readPage(cursor: Cursor, fetch: Fetch): Promise<Page> {',
    '  const rows = await fetch(cursor.after, cursor.size);',
    '  const visible = rows.filter((row) => row.deletedAt === null);',
    '  // The next page starts after the last row returned, not the',
    '  // last row read: a deleted row has no place in the cursor.',
    '  const after = visible.at(-1)?.key ?? cursor.after;',
    '  const done = rows.length < cursor.size;',
    '  return { rows: visible, next: done ? null : encode({ after, size: cursor.size }) };',
    '}'
  ] },
  { id: 'cursor-test', name: 'cursor.test.ts', path: 'api/reporting/cursor.test.ts', by: 'kiln', edited: '10:24', kind: 'code', lines: [
    'import { readPage } from \'./cursor\';',
    'import { pageOf, rows } from \'./fixtures\';',
    '',
    'test(\'a deleted row on a boundary skips nothing\', async () => {',
    '  const data = rows(1000, { deleted: [499, 500] });',
    '  const first = await readPage({ after: null, size: 500 }, pageOf(data));',
    '  const second = await readPage(first.next, pageOf(data));',
    '  expect(second.rows[0].key).toBe(data[501].key);',
    '});',
    '',
    'test(\'deletions on both sides of a boundary\', async () => {',
    '  const data = rows(1000, { deleted: [498, 501] });',
    '  const pages = await readAll(data, 500);',
    '  expect(pages.flat()).toHaveLength(998);',
    '});'
  ] },
  { id: 'page', name: 'page.tsx', path: 'portal/exports/page.tsx', by: 'kiln', edited: 'Yesterday', kind: 'code', lines: [
    'import { ExportList } from \'./export-list\';',
    'import { useExports } from \'./use-exports\';',
    '',
    'export default function ExportsPage() {',
    '  const { exports, loading } = useExports({ days: 30 });',
    '  return (',
    '    <main>',
    '      <h1>Exports</h1>',
    '      <p>Every nightly export from the last 30 days.</p>',
    '      <ExportList items={exports} loading={loading} />',
    '    </main>',
    '  );',
    '}'
  ] }
];

/**
 * Earlier messages with the agents; an agent without any greets you instead. `tools` are the calls
 * an agent made before it wrote, `file` a file it attached, and `task` the task it points to.
 * @type {Record<string, {from: string, at: string, text: string, tools?: {label: string, tool: string, ms: number}[],
 *   file?: string, task?: string}[]>}
 */
const CHATS = {
  fathom: [
    { from: 'me', at: '10:05', text: 'Kestrel says Tuesday’s export skipped rows. Can you find out why?' },
    { from: 'fathom', at: '10:06', text: 'On it. I’ll reproduce it with their dataset first.',
      tools: [{ label: 'Queried the export', tool: 'query_export', ms: 3400 }] },
    { from: 'fathom', at: '10:19', text: 'Found it: the cursor keeps the key of deleted rows, so the next page starts one row late. My notes are in research.md, and Kiln has the fix.',
      tools: [{ label: 'Searched the code', tool: 'search_code', ms: 1200 }, { label: 'Read a file', tool: 'read_file', ms: 400 }], file: 'research' }
  ],
  relay: [
    { from: 'relay', at: '10:21', text: 'I drafted a reply to Priya at Kestrel: what went wrong, that nothing was exposed, and that corrected files will follow. Could you review it before it goes out?', file: 'reply', task: 'kestrel-reply' }
  ]
};

/** The terminal of the open run. */
const TERMINAL = [
  ['command', 'npm test -- cursor'],
  ['out', 'PASS  api/reporting/cursor.test.ts'],
  ['out', '  ✓ a deleted row on a boundary skips nothing (12 ms)'],
  ['out', '  ✓ deletions on both sides of a boundary (11 ms)'],
  ['out', 'Tests: 6 passed, 6 total, 8.2 s'],
  ['command', 'npm run test:exports -- --all'],
  ['out', 'Checking 214 exports across 12 tenants…'],
  ['out', '  ✓ alpine     18 of 18'],
  ['out', '  ✓ danube     22 of 22'],
  ['out', '  ✓ kestrel    31 of 31'],
  ['out', '  … 9 tenants to go']
];

/** Problems the agents' tools reported. */
const PROBLEMS = [
  { severity: 'warning', text: 'Two export checks ran longer than 5 seconds', where: 'export suite', file: null },
  { severity: 'info', text: 'Unused import “deletedAt”', where: 'cursor.ts:3', file: 'cursor' }
];

/** The keyboard reference. */
const SHORTCUTS = [
  ['General', [['Command palette', 'Mod+K'], ['New task', 'N'], ['Keyboard shortcuts', '?']]],
  ['Go to', [['Home', 'G H'], ['Open task', 'G T'], ['Agent roster', 'G A']]],
  ['Panels', [['Navigation', 'Mod+B'], ['Inspector', 'Mod+I'], ['Bottom panel', 'Mod+J']]],
  ['Work', [['Pause or resume the open run', 'P'], ['Start the task you described', 'Mod+↵'], ['Close the current tab', 'Delete']]]
];

/** The tool each task's next step calls once you approve it. */
const FOLLOW_UP_CALLS = {
  'fix-exports': 'deploy',
  'kestrel-reply': 'send_reply',
  reconcile: 'post_entries'
};

/** The order the editor tabs keep, whichever are open. */
const TAB_ORDER = ['home', 'task', 'chat', 'file'];

/**
 * The kind of trace step each tool is, for its glyph; any other call is a plain `call`. A request
 * for your approval is an `ask` and your answer a `decision`, which the log does not count as calls.
 */
const TOOL_KINDS = {
  query_export: 'query', query_metrics: 'query', fetch_invoices: 'query', match_ledger: 'query',
  search_code: 'search', web_search: 'search',
  read_file: 'read', read_ticket: 'read', list_changes: 'read',
  write_file: 'write', edit_file: 'write', draft_reply: 'write',
  run_tests: 'run', deploy: 'run', verify_figures: 'run'
};

/** How a task's state, read from its plan, is told as a run state. */
const RUN_STATE = {
  done: 'done', blocked: 'blocked', waiting: 'waiting', paused: 'paused', 'in-progress': 'running', todo: 'queued'
};

/** The workspace's words for the run states, which its plan and task list use too. */
const RUN_WORDS = {
  'agent.status.running': 'In progress',
  'agent.status.waiting': 'Needs you',
  'agent.status.queued': 'To do'
};

/** The tokens one run may use. */
const TOKEN_BUDGET = 60_000;

/**
 * Where in its presence cycle an agent's avatar moves, per place it is drawn: the roster, the
 * inspector, and the chat move one agent half and a quarter of a cycle apart.
 */
const PHASE = { roster: 0, inspector: 0.5, chat: 0.25 };

/** @param {string|number} value `HH:MM` or `HH:MM:SS`, or seconds already. @returns {number} Seconds since midnight. */
function seconds(value) {
  if (typeof value === 'number') return value;
  const [hours, minutes, secs = 0] = value.split(':').map(Number);
  return hours * 3600 + minutes * 60 + secs;
}

/** @param {number} value Seconds since midnight. @param {boolean} [withSeconds] @returns {string} */
function clock(value, withSeconds = true) {
  const pad = (number) => String(Math.floor(number)).padStart(2, '0');
  const time = `${pad(value / 3600)}:${pad((value % 3600) / 60)}`;
  return withSeconds ? `${time}:${pad(value % 60)}` : time;
}

/** @param {number} secs @returns {string} A span of time: "42s", "3m 40s", "1h 05m". */
function duration(secs) {
  const total = Math.max(0, Math.round(secs));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m ${String(total % 60).padStart(2, '0')}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/** @param {number} count @returns {string} A token count: "912", "41.2k". */
function tokenCount(count) {
  return count >= 1000 ? `${formatNumber(count / 1000, { decimals: 1 })}k` : formatNumber(count);
}

/** @param {string} text @returns {string} A request turned into a task title. */
function titleFrom(text) {
  const clean = text.replace(/\s+/g, ' ').trim().replace(/[.?!]+$/, '');
  const title = clean.charAt(0).toLocaleUpperCase() + clean.slice(1);
  return title.length > 72 ? `${title.slice(0, 71).trimEnd()}…` : title;
}

/** @param {number} secs Seconds since midnight. @returns {string} A local ISO date-time on the workspace's day. */
function isoAt(secs) {
  return `${TODAY}T${clock(secs)}`;
}

/**
 * @param {string} text Text an agent says.
 * @returns {string} The text with the answer grammar's markers made literal, so it shows as written.
 */
function literal(text) {
  return String(text).replace(/[\\*`[]/g, (char) => `\\${char}`);
}

/** @param {LogEvent} event @returns {string} The trace step kind an event is drawn as. */
function traceKind(event) {
  if (event.kind === 'handoff') return 'handoff';
  if (event.kind === 'note') return 'think';
  if (event.kind === 'request') return 'ask';
  if (event.kind === 'decision') return 'decision';
  return TOOL_KINDS[event.call ?? ''] ?? 'call';
}

/**
 * @param {string} agent An agent id.
 * @param {keyof typeof PHASE} place Where its avatar is drawn.
 * @returns {number} The avatar's phase: agents spread over the cycle, each place offset from the others.
 */
function phaseOf(agent, place) {
  const index = Math.max(0, AGENTS.findIndex((entry) => entry.id === agent));
  return (index / AGENTS.length + PHASE[place]) % 1;
}

export default {
  title: 'Agent workspace',
  category: 'AI',
  blurb: 'A team of AI agents working through tasks: a roster with live presence, plans and execution logs, approvals as they arrive, a command palette, and a terminal.',
  components: [
    'Tabbox', 'Launcher', 'Avatar', 'AgentThread', 'Composer', 'RunTrace', 'RunStatus', 'Table', 'AppSidebar',
    'ModuleBar', 'AccountMenu', 'ProgressBar', 'Message', 'Dialog', 'statusIcon'
  ],

  /**
   * Mounts the workspace: navigation and roster, the editor tabs over a bottom panel, the
   * inspector, and the status bar.
   * @param {HTMLElement} container Gallery stage.
   * @param {import('./kit.js').LayoutContext} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const { preview } = context;
    const root = h('div', { class: 'agents shell' });
    const statusbar = h('div', { class: 'shell__statusbar agents__statusbar', role: 'group', 'aria-label': 'Status' });
    const notify = toaster(context, root);
    const me = person(ME) ?? { name: 'Ines Bauer', role: 'Head of Operations' };

    // Mutable copies: the run moves on, so the fixtures stay untouched.
    const agents = structuredClone(AGENTS);
    const tasks = structuredClone(TASKS).map((task) => ({
      ...task,
      started: seconds(task.started),
      finished: task.finished === undefined ? undefined : seconds(task.finished),
      pausedAt: task.pausedAt === undefined ? undefined : seconds(task.pausedAt),
      pausedFor: 0,
      plan: task.plan.map((step) => ({ ...step, since: step.since === undefined ? undefined : seconds(step.since) })),
      log: task.log.map((event) => ({ ...event, at: seconds(event.at) }))
    }));
    const activity = ACTIVITY.map((entry) => ({ ...entry, at: seconds(entry.at) }));
    const terminal = TERMINAL.map(([kind, text]) => ({ kind, text }));
    const output = [
      { at: '10:25:20', actor: 'kiln', text: 'run_tests filter="cursor"  6 passed' },
      { at: '10:26:10', actor: 'warden', text: 'review_diff branch="fix/cursor-pagination"  1 note' },
      { at: '10:27:02', actor: 'warden', text: 'run_tests suite="export" all=true  started' }
    ];
    // Who the agent components name: the agents, and the signed-in person.
    const authors = Object.fromEntries([
      ['me', { name: me.name, kind: 'person' }],
      ...agents.map((agent) => [agent.id, { name: agent.name, kind: 'agent', initials: agent.initial, tone: agent.tone }])
    ]);
    const state = {
      tab: 'home', task: 'fix-exports', chat: 'fathom', file: 'research', model: 'ridge-pro',
      now: NOW.getHours() * 3600 + NOW.getMinutes() * 60 + NOW.getSeconds(),
      nextRun: 483, nextNumber: 215, sent: 0,
      open: new Set(TAB_ORDER),
      /** @type {{element: HTMLElement, from: number, task: AgentTask|null}[]} Clocks that tick. */
      timers: [],
      /** @type {Map<string, () => void>} What a paused run does once it resumes. */
      pending: new Map()
    };

    // Components drawn for one rendering of a region are released when it is drawn again.
    const homeParts = renderScope(context);
    const taskParts = renderScope(context);
    // The agent components' clock: the workspace's fixed day, moving on with its own clock.
    const now = () => new Date(isoAt(state.now));
    // Presence avatars live as long as the workspace, so a redraw moves them without a jolt.
    /** @type {Map<string, Avatar>} */
    const rosterAvatars = new Map();
    /** @type {Map<string, Avatar>} */
    const asideAvatars = new Map();

    /* ------------------------------------------------------------ navigation column -- */

    // The workspace's menu ids carry a prefix: the suite's module ids (Home, Projects, Workflows)
    // share the navigation with them.
    const rosterCount = h('span', { class: 'agents__count' });
    const roster = h('ul', { class: 'agents__roster', role: 'list', 'aria-label': 'Agents' });
    const showHelp = shortcutSheet(context, SHORTCUTS, { onclose: () => refocus() });
    // The suite's navigation: the workspace's sections and resources, then the agent roster.
    const nav = suiteNav(context, {
      module: 'assistant',
      menu: [
        { id: 'agents:home', label: 'Home', icon: 'house', invoke: () => openHome() },
        { id: 'agents:projects', label: 'Projects', icon: 'folder-regular', invoke: () => notify(unavailable('Projects'), 'info') },
        { id: 'agents:tasks', label: 'Tasks', icon: 'list-check', invoke: () => openTasks() },
        { id: 'agents:workflows', label: 'Workflows', icon: 'diagram-project', invoke: () => openPalette('workflows') },
        { section: true, label: 'Resources', children: [
          { id: 'agents:files', label: 'Files', icon: 'file-lines', invoke: () => openPalette('files') },
          { id: 'agents:conversations', label: 'Conversations', icon: 'comments', invoke: () => openChat(state.chat) },
          { id: 'agents:runs', label: 'Runs', icon: 'timeline', invoke: () => openTask(state.task) },
          { id: 'agents:activity', label: 'Activity', icon: 'bolt', invoke: () => openActivity() }
        ] }
      ],
      header: button({ label: 'New task', icon: 'pen-to-square', shortcut: { label: 'N', keys: 'N' }, onclick: () => newTask() }),
      content: h('div', { class: 'agents__agents' }, sectionLabel('Agents', rosterCount), roster),
      onsearch: () => openPalette(),
      account: {
        items: [
          { label: 'Keyboard shortcuts', icon: 'keyboard', adornment: kbd('?'), onselect: () => showHelp() },
          { label: 'Workspace settings', icon: 'gear', onselect: () => notify(unavailable('Workspace settings'), 'info') }
        ],
        onselect: null,
        onclose: () => refocus()
      }
    });
    root.append(nav.column);
    // Narrow, the inspector and then the navigation become drawers; Mod+B, Mod+I, and Mod+J show
    // and hide the columns and the bottom panel at any width.
    const shell = adaptiveShell(root, context, {
      asideLabel: 'Show agents and run', panelLabel: 'Toggle bottom panel', keys: true
    });

    /* ------------------------------------------------------------------ main column -- */

    const homeView = h('div', { class: 'agents__view agents__home' });
    const taskView = h('div', { class: 'agents__view agents__task' });
    const chatView = h('div', { class: 'agents__view agents__chat' });
    const fileView = h('div', { class: 'agents__view agents__file' });
    /** @type {Record<string, {view: HTMLElement, icon: string, title: () => string}>} */
    const VIEWS = {
      home: { view: homeView, icon: 'house', title: () => 'Home' },
      task: { view: taskView, icon: 'list-check', title: () => currentTask().title },
      chat: { view: chatView, icon: 'comments', title: () => agentById(state.chat).name },
      file: { view: fileView, icon: 'file-lines', title: () => currentFile().name }
    };
    const tabs = keep(new Tabbox(null, {
      variant: 'divided', label: 'Open views',
      tabs: TAB_ORDER.map((name) => tabDefinition(name)),
      onchange: (event) => {
        state.tab = event.detail.name;
        syncNav();
      },
      onclose: (event) => {
        state.open.delete(event.detail.name);
        state.tab = tabs.getActive() ?? 'home';
        syncNav();
      }
    }));
    tabs.toElement().classList.add('agents__tabs');
    const panelButton = shell.panelToggle();
    panelButton.title = `Toggle bottom panel (${modShortcut('j').label})`;
    panelButton.setAttribute('aria-keyshortcuts', modShortcut('j').keys);
    const editor = h('div', { class: 'agents__editor' },
      h('div', { class: 'agents__lead' }, shell.navToggle()),
      tabs.toElement(),
      h('div', { class: 'agents__tab-actions' }, panelButton, shell.asideToggle()));

    // The bottom panel: the run's terminal, the agents' raw output, and the problems their tools
    // reported. Below 640px it takes the whole pane while it is open.
    const terminalView = h('pre', { class: 'agents__terminal' });
    const outputView = h('ol', { class: 'agents__output', role: 'list' });
    const problemsView = h('ul', { class: 'agents__problems', role: 'list' });
    const panelTabs = keep(new Tabbox(null, {
      variant: 'line', label: 'Bottom panel views',
      tabs: [
        { name: 'terminal', title: 'Terminal', icon: 'terminal', content: terminalView },
        { name: 'output', title: 'Output', content: outputView },
        { name: 'problems', title: 'Problems', content: problemsView }
      ]
    }));
    panelTabs.toElement().classList.add('agents__panel-tabs');
    const panel = h('section', {
      class: 'shell__panel agents__panel', 'aria-label': 'Terminal, output, and problems',
      // Open wherever there is room for it beside the work; a phone opens it on demand.
      hidden: container.clientWidth < 1024
    },
    panelTabs.toElement(),
    h('div', { class: 'agents__panel-actions' },
      iconButton('xmark', 'Close bottom panel', () => shell.togglePanel(false), { shortcut: modShortcut('j') })));
    const main = h('section', { class: 'shell__main agents__main', 'aria-label': 'Editor' }, editor, panel);

    /* ------------------------------------------------------------ inspector column -- */

    // The agents by state, then the open run: its figures, and the tokens it has used of its budget.
    const groupsView = h('div', { class: 'agents__groups' });
    const runStatus = keep(new RunStatus(null, { ticking: !preview, now, msg: RUN_WORDS }));
    const runBlock = panelBlock('', runStatus.toElement());
    runBlock.classList.add('agents__run');
    // A thumbnail is a still: the run's progress bar does not shine in it.
    if (preview) runBlock.dataset.zxMotion = 'reduced';
    const runTitle = /** @type {HTMLElement} */ (runBlock.firstElementChild);
    const aside = h('aside', { class: 'shell__aside', 'aria-label': 'Agents and run' },
      paneHeader({ title: 'Agents' }),
      h('div', { class: 'shell__body' }, groupsView, runBlock));

    /* ------------------------------------------------------------------ status bar -- */

    const branchLabel = h('span');
    const runLabel = h('span');
    const workingLabel = h('span');
    const tokensLabel = h('span');
    const motionLabel = h('span');
    const motionGlyph = h('span', { class: 'agents__motion-glyph' });
    const motionButton = h('button', {
      type: 'button', class: 'shell__status-item agents__motion', onclick: () => toggleMotion()
    }, motionGlyph, motionLabel);
    statusbar.append(
      h('span', { class: 'shell__status-item', 'data-narrow': 'hide', title: 'Branch' },
        icon('code-branch'), branchLabel),
      h('button', { type: 'button', class: 'shell__status-item', onclick: () => openTask(state.task) }, icon('timeline'), runLabel),
      h('button', {
        type: 'button', class: 'shell__status-item', 'data-narrow': 'hide', title: 'Show agents',
        onclick: () => shell.toggleInspector()
      }, dot('success'), workingLabel),
      h('span', { class: 'shell__spacer' }),
      motionButton,
      h('span', { class: 'shell__status-item', 'data-narrow': 'hide' }, icon('coins'), tokensLabel));

    const live = h('div', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });
    root.append(main, aside, live, statusbar);

    /* ------------------------------------------------------------------- Home view -- */

    const greeting = h('h2', { class: 'record-title agents__greeting' }, `Good morning, ${me.name.split(' ')[0]}`);
    const summary = h('p', { class: 'agents__summary' });
    // Mod+Enter starts the task: a request is often a few lines long.
    const composer = keep(new Composer(null, {
      label: 'Describe a task', placeholder: 'Describe a task for your agents…', submitKey: 'mod+enter',
      attachments: true, sendLabel: 'Start task', minRows: 3,
      oninput: () => renderRoute(),
      onsend: (event) => startTask(event.detail.text, event.detail.files)
    }));
    const route = h('p', { class: 'agents__route', 'aria-live': 'polite' });
    const chips = h('div', { class: 'agents__chips', role: 'group', 'aria-label': 'Suggestions' },
      SUGGESTIONS.map((suggestion) => h('button', {
        type: 'button', class: 'agents__chip',
        onclick: () => {
          composer.setValue(suggestion.text);
          renderRoute();
          if (!preview) composer.focus();
        }
      }, icon(suggestion.icon), suggestion.text)));
    const tasksMeta = h('span', { class: 'agents__section-meta' });
    const taskTable = keep(new Table(null, {
      variant: 'plain',
      columns: [
        { id: 'title', label: 'Task', width: '2.6fr', render: (row) => taskCell(row) },
        { id: 'owner', label: 'Owner', width: '1.2fr', render: (row) => personCell(row.owner, homeParts) },
        { id: 'status', label: 'Status', width: '1.2fr', render: (row) => statusText(taskStatus(row)) },
        { id: 'steps', label: 'Steps', width: '1fr', render: (row) => stepsCell(row) },
        { id: 'updated', label: 'Updated', width: '0.8fr', align: 'end', render: (row) => h('span', { class: 'agents__num' }, clock(updatedAt(row), false)) }
      ],
      data: [], rowId: 'id', stickyHeader: false, zebra: false, responsive: 'sm',
      onrowclick: (event) => openTask(String(event.detail.row.id))
    }));
    const activityList = h('ol', { class: 'agents__activity', role: 'list' });
    const tasksHeading = h('h3', { class: 'agents__section-title' }, 'Tasks');
    const activityHeading = h('h3', { class: 'agents__section-title' }, 'Recent activity');
    homeView.append(
      h('div', { class: 'agents__home-head' }, greeting, summary),
      composer.toElement(),
      route,
      chips,
      h('section', { class: 'agents__section' },
        h('div', { class: 'agents__section-head' }, tasksHeading, tasksMeta),
        taskTable.toElement()),
      h('section', { class: 'agents__section' },
        h('div', { class: 'agents__section-head' }, activityHeading),
        activityList));

    /* -------------------------------------------------------------------- task view -- */

    // The head and the plan are redrawn as the run moves; the execution log is one RunTrace that
    // keeps its open steps from one redraw to the next.
    const taskHead = h('div', { class: 'agents__task-head' });
    const planMeta = h('span', { class: 'agents__section-meta' });
    const planList = h('ol', { class: 'agents__plan', role: 'list' });
    const logMeta = h('span', { class: 'agents__section-meta' });
    // Who acted, when, and the tokens it took read under each step; the running step counts its
    // time, and a file an event wrote or read is a link under it. Like the plan, the log calls the
    // reader "You".
    const trace = keep(new RunTrace(null, {
      open: true, authors: { ...authors, me: { ...authors.me, name: nameOf('me') } }, msg: RUN_WORDS,
      ticking: !preview, now, onopen: (event) => openFile(String(event.detail.ref.id))
    }));
    taskView.append(
      taskHead,
      h('section', { class: 'agents__section' },
        h('div', { class: 'agents__section-head' }, h('h3', { class: 'agents__section-title' }, 'Plan'), planMeta),
        planList),
      h('section', { class: 'agents__section' },
        h('div', { class: 'agents__section-head' }, h('h3', { class: 'agents__section-title' }, 'Execution log'), logMeta),
        trace.toElement()));

    /* -------------------------------------------------------------------- chat view -- */

    // One conversation per agent, each an AgentThread over its own Composer, so a draft and a
    // reply still being written stay with the agent they are for.
    const chatAvatar = keep(agentAvatar(agentById(state.chat), 'lg', {
      activity: 'idle', animate: !preview, phase: phaseOf(state.chat, 'chat')
    }));
    const chatName = h('h2', { class: 'agents__chat-name' });
    const chatMeta = h('p', { class: 'agents__chat-meta' });
    const threadHost = h('div', { class: 'agents__thread' });
    const dock = h('div', { class: 'agents__chat-dock' });
    chatView.append(
      h('div', { class: 'agents__chat-head' },
        h('span', { class: 'agents__avatar' }, chatAvatar.toElement()),
        h('div', { class: 'agents__chat-who' }, chatName, chatMeta)),
      threadHost,
      dock);
    /** @type {Map<string, {thread: AgentThread, composer: Composer}>} */
    const chats = new Map();

    /* --------------------------------------------------------------------- overlays -- */

    /** @type {Launcher|null} */
    let palette = null;
    if (!preview) {
      palette = keep(new Launcher(null, {
        shortcut: false, label: 'Commands', scope: root, placeholder: 'Type a command or search',
        onclose: () => refocus()
      }));
    }

    /* --------------------------------------------------------------------- keyboard -- */

    shortcuts(root, {
      'Mod+k': () => openPalette(),
      n: () => newTask(),
      '?': () => showHelp(),
      'g h': () => openHome(),
      'g t': () => openTask(state.task),
      'g a': () => goToRoster(),
      p: () => {
        if (state.tab !== 'task') return false;
        togglePause(state.task);
      }
    }, context);

    container.append(root);
    render();

    if (!preview) {
      // The world keeps moving while you look: a clock for the running steps, the export suite
      // finishing and asking for approval, and a blocker a little later.
      const clockTimer = setInterval(() => tick(), 1000);
      context.cleanup(() => clearInterval(clockTimer));
      later(context, () => finishSuite(), 4000);
      later(context, () => blockLedger(), 11000);
      // The keys work from the start, but nothing has been pressed yet: no focus ring at rest.
      focusActiveTab({ focusVisible: false });
    }

    /* ------------------------------------------------------------------- queries -- */

    /** @param {string} id @returns {(typeof agents)[number]} */
    function agentById(id) {
      return agents.find((agent) => agent.id === id) ?? agents[0];
    }

    /** @param {string} id @returns {AgentTask|undefined} */
    function taskById(id) {
      return tasks.find((task) => task.id === id);
    }

    /** @returns {AgentTask} */
    function currentTask() {
      return taskById(state.task) ?? tasks[0];
    }

    /** @returns {(typeof FILES)[number]} */
    function currentFile() {
      return FILES.find((file) => file.id === state.file) ?? FILES[0];
    }

    /**
     * What an agent is doing now, read from the plans: an approval it asked for outranks a step
     * that is blocked, which outranks work in progress; with none of those it is idle, and an
     * agent that is switched off is offline whatever its plans say.
     * @param {(typeof agents)[number]} agent
     * @returns {{state: keyof typeof PRESENCE, doing: string, since: number|null, task: AgentTask|null}}
     */
    function presenceOf(agent) {
      if (agent.offline) return { state: 'offline', doing: agent.away ?? 'Switched off', since: null, task: null };
      const found = (test) => {
        for (const task of tasks) {
          const step = task.plan.find((entry) => test(entry, task));
          if (step) return { task, step };
        }
        return null;
      };
      const asked = found((step) => step.status === 'waiting' && step.approval?.from === agent.id);
      if (asked) return { state: 'needs-you', doing: asked.step.approval.waiting, since: asked.step.since ?? null, task: asked.task };
      const blocked = found((step) => step.status === 'blocked' && step.agent === agent.id);
      if (blocked) return { state: 'blocked', doing: blocked.step.blocker ?? blocked.step.text, since: blocked.step.since ?? null, task: blocked.task };
      const working = found((step, task) => step.status === 'in-progress' && step.agent === agent.id && !task.paused);
      if (working) {
        return {
          state: working.step.mode === 'thinking' ? 'thinking' : 'working',
          doing: working.step.doing ?? working.step.text, since: working.step.since ?? null, task: working.task
        };
      }
      if (agent.id === 'orbit') {
        const running = tasks.filter((task) => taskStatus(task) !== 'done' && !task.paused).length;
        if (running) return { state: 'working', doing: `Coordinating ${running} runs`, since: null, task: null };
      }
      const next = found((step, task) => step.status === 'todo' && step.agent === agent.id && taskStatus(task) !== 'done');
      return { state: 'idle', doing: next ? `Next: ${next.step.text}` : 'Ready for a task', since: null, task: next?.task ?? null };
    }

    /**
     * A task's state, read from its plan.
     * @param {AgentTask} task
     * @returns {'done'|'blocked'|'waiting'|'paused'|'in-progress'|'todo'}
     */
    function taskStatus(task) {
      if (task.plan.every((step) => step.status === 'done')) return 'done';
      if (task.plan.some((step) => step.status === 'blocked')) return 'blocked';
      if (task.plan.some((step) => step.status === 'waiting')) return 'waiting';
      if (task.paused) return 'paused';
      if (task.plan.some((step) => step.status === 'in-progress')) return 'in-progress';
      return 'todo';
    }

    /** @param {AgentTask} task @returns {number} Seconds since the run started, not counting pauses. */
    function elapsed(task) {
      const end = task.finished ?? (task.paused ? task.pausedAt ?? state.now : state.now);
      return end - task.started - (task.pausedFor ?? 0);
    }

    /**
     * @param {AgentTask} task
     * @returns {number} Seconds its agents have worked: the time it has run, less the time it
     * waited for you to approve a step or unblock one.
     */
    function worked(task) {
      const end = task.finished ?? (task.paused ? task.pausedAt ?? state.now : state.now);
      const answered = task.plan.reduce((sum, step) => sum + (step.approval && step.status === 'done' ? step.secs ?? 0 : 0), 0);
      const open = task.plan.find((step) => (step.status === 'waiting' || step.status === 'blocked') && step.since !== undefined);
      return Math.max(0, elapsed(task) - answered - (open ? end - (open.since ?? end) : 0));
    }

    /** @param {AgentTask} task @returns {number} */
    function taskTokens(task) {
      return task.log.reduce((sum, event) => sum + (event.tokens ?? 0), 0);
    }

    /** @param {AgentTask} task @returns {number} When its log last moved. */
    function updatedAt(task) {
      return task.log.at(-1)?.at ?? task.started;
    }

    /** @param {string} text @returns {string|null} The agent a request is for, or null to let the orchestrator plan it. */
    function routeFor(text) {
      const words = text.toLocaleLowerCase();
      let best = null;
      let score = 0;
      for (const entry of ROUTES) {
        const hits = entry.words.filter((word) => words.includes(word)).length;
        if (hits > score) {
          best = entry.agent;
          score = hits;
        }
      }
      return best;
    }

    /**
     * A task's execution log as trace steps: who acted, when it started, the tokens it took, and
     * the file it wrote or read. A tool call opens to its arguments and what came back; a call
     * that stopped the run is blocked until you resolve it, and failed once a retry repeats it.
     * @param {AgentTask} task
     * @returns {import('../../src/internal/agent-model.js').TraceStep[]}
     */
    function traceSteps(task) {
      const waiting = task.plan.some((step) => step.status === 'waiting');
      const blocked = task.plan.some((step) => step.status === 'blocked');
      const lastRequest = task.log.findLastIndex((event) => event.kind === 'request');
      const lastBlock = task.log.findLastIndex((event) => event.kind === 'block');
      const lastPause = task.log.findLastIndex((event) => event.pause);
      return task.log.map((event, index) => {
        let status = 'done';
        if (event.running) status = task.paused ? 'paused' : 'running';
        else if (event.kind === 'block') status = blocked && index === lastBlock ? 'blocked' : 'failed';
        else if (event.kind === 'request' && waiting && index === lastRequest) status = 'waiting';
        else if (event.pause && task.paused && index === lastPause) status = 'paused';
        const lines = (event.detail ?? []).join('\n') || undefined;
        const file = FILES.find((entry) => entry.id === event.file);
        const step = {
          id: `${task.id}:${index}`, kind: traceKind(event), label: event.action, status,
          actor: event.actor, at: isoAt(event.at), tokens: event.tokens,
          retryOf: event.retryOf === undefined ? undefined : `${task.id}:${event.retryOf}`,
          doing: event.running ? event.action : undefined,
          refs: file ? [{ id: file.id, label: file.name, icon: file.kind === 'code' ? 'code' : 'file-lines', entity: 'file' }] : undefined
        };
        if (event.kind === 'handoff') return { ...step, label: event.args ?? event.action, to: event.to, detail: lines };
        if (event.call || event.kind === 'block') {
          return { ...step, tool: event.call, args: event.args, ms: event.ms, ...(event.kind === 'block' ? { error: lines } : { result: lines }) };
        }
        return { ...step, count: event.args, detail: lines };
      });
    }

    /* ------------------------------------------------------------------ rendering -- */

    /** Redraws every region from the state. @returns {void} */
    function render() {
      renderRoster();
      renderInspector();
      renderStatus();
      renderHome();
      renderTask();
      renderChat();
      renderFile();
      renderPanel();
      renderRoute();
      syncNav();
    }

    /** Redraws what the run's progress changes: presence, figures, Home, the task, and the chat. @returns {void} */
    function refresh() {
      renderRoster();
      renderInspector();
      renderStatus();
      renderHome();
      if (state.open.has('task')) renderTask();
      if (state.open.has('chat')) renderChat();
      renderPanel();
    }

    /**
     * Redraws a region without losing the keyboard: focus on a control the redraw replaced moves
     * to its successor (the element with the same `data-key`), or to the region's heading. Focus a
     * component kept inside the region stays where it is.
     * @param {HTMLElement} region
     * @param {() => void} draw
     * @returns {void}
     */
    function redraw(region, draw) {
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && region.contains(active);
      const key = inside ? active.closest('[data-key]')?.getAttribute('data-key') : null;
      draw();
      if (!inside || preview) return;
      const now = document.activeElement;
      if (now && now !== document.body && region.contains(now)) return;
      const next = key ? region.querySelector(`[data-key="${CSS.escape(key)}"]`) : null;
      if (next instanceof HTMLElement) next.focus({ preventScroll: true });
      else focusHeadingIn(region);
    }

    /**
     * An agent's avatar: its initial on its tone, and whatever else the place it is drawn in needs.
     * @param {(typeof agents)[number]} agent
     * @param {'sm'|'md'|'lg'} size
     * @param {Partial<import('../../src/components/avatar/avatar.js').AvatarOptions>} [extra]
     * @returns {Avatar}
     */
    function agentAvatar(agent, size, extra = {}) {
      return new Avatar(null, { name: agent.name, initials: agent.initial, tone: agent.tone, shape: 'rounded', size, ...extra });
    }

    /**
     * An agent's avatar that shows and moves with its presence. Each place keeps one per agent for
     * the life of the workspace, so a redraw only changes its activity, and moves it at its own
     * phase, so the roster and the inspector never move one agent in step. The avatar is
     * decorative: the presence is said in words beside it.
     * @param {Map<string, Avatar>} cache The place's avatars.
     * @param {keyof typeof PHASE} place
     * @param {(typeof agents)[number]} agent
     * @param {keyof typeof PRESENCE} presence
     * @returns {HTMLElement}
     */
    function presenceAvatar(cache, place, agent, presence) {
      let avatar = cache.get(agent.id);
      if (!avatar) {
        avatar = keep(agentAvatar(agent, 'md', { activity: presence, animate: !preview, phase: phaseOf(agent.id, place) }));
        cache.set(agent.id, avatar);
      } else if (avatar.getActivity() !== presence) {
        avatar.setActivity(presence);
      }
      return h('span', { class: 'agents__avatar' }, avatar.toElement());
    }

    /**
     * Whoever did something — an agent, or the signed-in person — as a still avatar.
     * @param {string} id Agent id, or `me`.
     * @param {{own: <T extends {destroy: () => void}>(component: T) => T}} scope
     * @returns {HTMLElement}
     */
    function avatarOf(id, scope) {
      if (id === 'me') return scope.own(new Avatar(null, { name: me.name, size: 'sm' })).toElement();
      return scope.own(agentAvatar(agentById(id), 'sm')).toElement();
    }

    /** @param {string} id Agent id, or `me`. @returns {string} */
    function nameOf(id) {
      return id === 'me' ? 'You' : agentById(id).name;
    }

    /**
     * An avatar beside a name.
     * @param {string} id Agent id, or `me`.
     * @param {{own: <T extends {destroy: () => void}>(component: T) => T}} scope
     * @returns {HTMLElement}
     */
    function personCell(id, scope) {
      return h('span', { class: 'person agents__person' }, avatarOf(id, scope), h('span', { class: 'person__name' }, nameOf(id)));
    }

    /**
     * An agent's mark for places that redraw on every keystroke (the palette, the composer's
     * route): initials on the agent's tone, without a component behind it.
     * @param {(typeof agents)[number]} agent
     * @returns {HTMLElement}
     */
    function agentMark(agent) {
      return h('span', { class: 'agents__mark', 'aria-hidden': 'true', dataset: { tone: agent.tone } }, agent.initial);
    }

    /** @param {keyof typeof PRESENCE} presence @returns {HTMLElement} The presence's word, beside the avatar's dot. */
    function presenceWord(presence) {
      return h('span', { class: 'agents__state', dataset: { presence } }, PRESENCE[presence]);
    }

    /** @param {string} status A step or task status. @returns {HTMLElement} Its glyph and its words. */
    function statusText(status) {
      const info = STEP[status] ?? STEP.todo;
      return h('span', { class: 'agents__status', dataset: { status } },
        statusIcon(/** @type {any} */ (info.status), { tone: /** @type {any} */ (info.tone) }), info.label);
    }

    /**
     * A clock that counts up from `from` while its run goes on.
     * @param {number} from
     * @param {AgentTask|null} task Stops while this run is paused.
     * @returns {HTMLElement}
     */
    function ticking(from, task) {
      const element = h('span', { class: 'agents__num' });
      const timer = { element, from, task };
      state.timers.push(timer);
      paint(timer);
      return element;
    }

    /** @param {{element: HTMLElement, from: number, task: AgentTask|null}} timer @returns {void} */
    function paint({ element, from, task }) {
      const end = task?.paused ? task.pausedAt ?? state.now : state.now;
      element.textContent = duration(end - from);
    }

    /** The roster in the navigation column. @returns {void} */
    function renderRoster() {
      redraw(roster, () => {
        rosterCount.textContent = formatNumber(agents.length);
        roster.replaceChildren(...agents.map((agent) => {
          const presence = presenceOf(agent);
          const current = state.tab === 'chat' && state.chat === agent.id;
          return h('li', {}, h('button', {
            type: 'button', class: 'list-row agents__agent', 'data-key': `roster:${agent.id}`,
            'aria-current': current ? 'true' : null,
            'aria-label': `${agent.name}, ${PRESENCE[presence.state]}, ${agent.role}`,
            title: presence.doing,
            onclick: () => openChat(agent.id)
          },
          presenceAvatar(rosterAvatars, 'roster', agent, presence.state),
          h('span', { class: 'agents__agent-name' }, agent.name),
          presenceWord(presence.state),
          h('span', { class: 'agents__agent-role' }, agent.role)));
        }));
      });
    }

    /** The inspector: agents by state, then the open run's figures. @returns {void} */
    function renderInspector() {
      redraw(groupsView, () => {
        const ranked = agents.map((agent) => ({ agent, presence: presenceOf(agent) }));
        const order = Object.keys(PRESENCE);
        ranked.sort((a, b) => order.indexOf(a.presence.state) - order.indexOf(b.presence.state));
        const groups = [
          ['Active', ranked.filter((entry) => !['idle', 'offline'].includes(entry.presence.state))],
          ['Idle', ranked.filter((entry) => entry.presence.state === 'idle')],
          ['Offline', ranked.filter((entry) => entry.presence.state === 'offline')]
        ];
        groupsView.replaceChildren(...groups.filter(([, list]) => list.length).map(([label, list]) => h('section', { class: 'agents__group' },
          h('h3', { class: 'list-group agents__group-title' }, label, h('span', { class: 'list-group__count' }, String(list.length))),
          h('ul', { class: 'agents__members', role: 'list' }, list.map(({ agent, presence }) => memberRow(agent, presence))))));
      });
      renderRun();
    }

    /**
     * The open run's figures: its state, its steps, when it started and how long its agents have
     * worked, the model, and the tokens it has used of its budget.
     * @returns {void}
     */
    function renderRun() {
      const task = currentTask();
      const waiting = task.plan.find((step) => step.status === 'waiting' || step.status === 'blocked');
      runTitle.textContent = `Run #${task.run}`;
      runStatus.update({
        state: RUN_STATE[taskStatus(task)],
        summary: task.title,
        steps: { done: task.plan.filter((step) => step.status === 'done').length, total: task.plan.length },
        started: isoAt(task.started),
        finished: task.finished === undefined ? null : isoAt(task.finished),
        waitingSince: waiting?.since === undefined ? null : isoAt(waiting.since),
        workMs: worked(task) * 1000,
        tokens: taskTokens(task),
        tokenBudget: TOKEN_BUDGET,
        model: MODELS.find((model) => model.id === state.model)?.label ?? null,
        actions: [{ label: 'Open task', icon: 'list-check', onclick: () => openTask(task.id) }]
      });
    }

    /**
     * One agent in the inspector: who, its state, what it is doing, for how long, and — when it
     * waits on you — the way to answer.
     * @param {(typeof agents)[number]} agent
     * @param {ReturnType<typeof presenceOf>} presence
     * @returns {HTMLElement}
     */
    function memberRow(agent, presence) {
      const action = presence.state === 'needs-you' && presence.task
        ? button({ label: 'Review', size: 'sm', onclick: () => openTask(presence.task.id) })
        : presence.state === 'blocked' && presence.task
          ? button({ label: 'Resolve', size: 'sm', onclick: () => resolve(presence.task.id) })
          : null;
      action?.setAttribute('aria-label', `${action.textContent} ${agent.name}’s request`);
      if (action) action.dataset.key = `member-action:${agent.id}`;
      return h('li', { class: 'agents__member', dataset: { presence: presence.state } },
        presenceAvatar(asideAvatars, 'inspector', agent, presence.state),
        h('div', { class: 'agents__member-main' },
          h('div', { class: 'agents__member-top' },
            h('button', {
              type: 'button', class: 'agents__member-name', 'data-key': `member:${agent.id}`,
              title: `Chat with ${agent.name}`, onclick: () => openChat(agent.id)
            }, agent.name),
            presenceWord(presence.state),
            presence.since !== null ? h('span', { class: 'agents__member-time' }, ticking(presence.since, presence.task)) : null),
          h('p', { class: 'agents__member-doing' }, presence.doing),
          action));
    }

    /** The status bar's figures and the motion setting. @returns {void} */
    function renderStatus() {
      branchLabel.textContent = currentTask().branch;
      runLabel.textContent = `Run #${currentTask().run}`;
      const working = agents.filter((agent) => ['working', 'thinking'].includes(presenceOf(agent).state)).length;
      workingLabel.textContent = `${working} ${working === 1 ? 'agent' : 'agents'} working`;
      tokensLabel.textContent = `${tokenCount(tasks.reduce((sum, task) => sum + taskTokens(task), 0))} tokens today`;
      const reduced = root.dataset.zxMotion === 'reduced';
      motionLabel.textContent = `Motion: ${reduced ? 'Reduced' : 'System'}`;
      motionGlyph.replaceChildren(icon(reduced ? 'circle-pause' : 'circle-play'));
      motionButton.title = reduced ? 'Follow the system’s motion setting' : 'Reduce motion in this workspace';
    }

    /** Home: the summary line, the task table, and the activity. @returns {void} */
    function renderHome() {
      const states = agents.map((agent) => presenceOf(agent).state);
      const count = (name) => states.filter((value) => value === name).length;
      const working = count('working') + count('thinking');
      const needs = count('needs-you');
      const blocked = count('blocked');
      summary.replaceChildren(
        `${working} ${working === 1 ? 'agent is' : 'agents are'} working`,
        needs ? ` · ${needs} ${needs === 1 ? 'needs' : 'need'} you` : '',
        blocked ? ` · ${blocked} blocked` : '');
      const open = tasks.filter((task) => taskStatus(task) !== 'done').length;
      tasksMeta.textContent = `${formatNumber(open)} open · ${formatNumber(tasks.length - open)} done today`;
      redraw(taskTable.toElement(), () => {
        homeParts.reset();
        taskTable.setData(tasks);
      });
      activityList.replaceChildren(...activity.slice(0, 7).map((entry) => h('li', { class: 'agents__activity-item' },
        avatarOf(entry.actor, homeParts),
        h('p', { class: 'agents__activity-text' }, h('span', { class: 'agents__activity-actor' }, nameOf(entry.actor)), ` ${entry.text}`),
        h('time', { class: 'agents__activity-time', dateTime: clock(entry.at) }, clock(entry.at, false)))));
    }

    /** @param {AgentTask} task @returns {HTMLElement} The task column: its title as a link, and its project. */
    function taskCell(task) {
      return h('span', { class: 'agents__task-cell' },
        h('button', {
          type: 'button', class: 'agents__task-link', 'data-key': `task:${task.id}`,
          onclick: (event) => {
            event.stopPropagation();
            openTask(task.id);
          }
        }, task.title),
        h('span', { class: 'agents__task-project' }, `${task.project} · #${task.number}`));
    }

    /** @param {AgentTask} task @returns {HTMLElement} Steps done of all, with a small bar. */
    function stepsCell(task) {
      const done = task.plan.filter((step) => step.status === 'done').length;
      return h('span', { class: 'agents__steps' },
        h('span', { class: 'agents__num' }, `${done} of ${task.plan.length}`),
        h('span', { class: 'agents__steps-bar', 'aria-hidden': 'true' },
          h('span', { class: 'agents__steps-fill', style: { inlineSize: `${Math.round((done / task.plan.length) * 100)}%` } })));
    }

    /** The open task: its head, its plan, and its execution log. @returns {void} */
    function renderTask() {
      const task = currentTask();
      if (state.open.has('task')) tabs.setTitle('task', task.title);
      redraw(taskView, () => {
        taskParts.reset();
        const done = task.plan.filter((step) => step.status === 'done').length;
        const status = taskStatus(task);
        const lead = agentById(task.lead);
        const progress = taskParts.own(new ProgressBar(null, {
          value: done, max: task.plan.length, label: 'Plan progress', hideLabel: true, showValue: false, size: 'sm',
          status: status === 'done' ? 'success' : 'active'
        }));
        const pause = status === 'done' ? null : button({
          label: task.paused ? 'Resume' : 'Pause', icon: task.paused ? 'play' : 'pause', size: 'sm',
          shortcut: { label: 'P', keys: 'P' }, onclick: () => togglePause(task.id)
        });
        if (pause) pause.dataset.key = 'pause';
        const owner = agentById(task.owner);
        const chat = button({ label: `Chat with ${owner.name}`, icon: 'comments', kind: 'ghost', size: 'sm', onclick: () => openChat(owner.id) });
        chat.dataset.key = 'chat';
        chat.setAttribute('data-narrow', 'icon');
        taskHead.replaceChildren(
          h('p', { class: 'agents__eyebrow' }, `${task.project} · Task ${task.number}`),
          h('div', { class: 'agents__title-row' },
            h('h2', { class: 'record-title agents__task-title' }, task.title),
            statusText(status)),
          h('p', { class: 'agents__orchestrator' },
            avatarOf(lead.id, taskParts),
            h('span', {}, 'Orchestrated by ', h('span', { class: 'agents__strong' }, lead.name),
              ` · run #${task.run} · started ${clock(task.started, false)}`,
              task.paused && task.pauseReason ? ` · ${task.pauseReason}` : '')),
          h('div', { class: 'agents__progress' },
            progress.toElement(),
            h('span', { class: 'agents__progress-text' }, `${done} of ${task.plan.length} steps`)),
          h('div', { class: 'agents__task-actions' }, pause, chat));
        planMeta.textContent = `${done} of ${task.plan.length} done`;
        planList.replaceChildren(...task.plan.map((step, index) => planStep(task, step, index)));
        logMeta.textContent = `${task.log.length} events · ${tokenCount(taskTokens(task))} tokens`;
        trace.setSteps(traceSteps(task));
      });
    }

    /**
     * One step of a plan: its state, what it is, who does it, how long it took, and — when it is
     * your decision or it is stuck — the button that moves it on.
     * @param {AgentTask} task
     * @param {PlanStep} step
     * @param {number} index
     * @returns {HTMLElement}
     */
    function planStep(task, step, index) {
      const shown = step.status === 'in-progress' && task.paused ? 'paused' : step.status;
      const info = STEP[shown];
      let action = null;
      if (step.status === 'waiting' && step.approval) {
        action = button({ label: step.approval.label, kind: 'primary', size: 'sm', onclick: () => approve(task.id) });
      } else if (step.status === 'blocked') {
        action = button({ label: 'Resolve', size: 'sm', onclick: () => resolve(task.id) });
      }
      const time = step.secs !== undefined ? h('span', { class: 'agents__num' }, duration(step.secs))
        : step.status === 'in-progress' && step.since !== undefined ? ticking(step.since, task)
          : h('span', { class: 'agents__none' }, '—');
      return h('li', { class: 'agents__step', tabindex: '-1', 'data-key': `step:${index}`, dataset: { status: shown } },
        h('span', { class: 'agents__step-glyph', title: info.label },
          statusIcon(/** @type {any} */ (info.status), { tone: /** @type {any} */ (info.tone), label: info.label })),
        h('span', { class: 'agents__step-text' },
          step.text,
          step.status === 'blocked' && step.blocker ? h('span', { class: 'agents__step-note' }, step.blocker) : null,
          step.status === 'waiting' && step.approval ? h('span', { class: 'agents__step-note' }, `${nameOf(step.approval.from)} asks: ${step.approval.ask}`) : null,
          action),
        h('span', { class: 'agents__step-owner' }, personCell(step.agent, taskParts)),
        h('span', { class: 'agents__step-time' }, time));
    }

    /** The chat with one agent: its presence, the conversation, and the composer. @returns {void} */
    function renderChat() {
      const agent = agentById(state.chat);
      if (state.open.has('chat')) tabs.setTitle('chat', agent.name);
      const presence = presenceOf(agent);
      chatAvatar.set({ name: agent.name, initials: agent.initial, tone: agent.tone, activity: presence.state, phase: phaseOf(agent.id, 'chat') });
      chatName.textContent = agent.name;
      chatMeta.replaceChildren(presenceWord(presence.state), h('span', {}, `${agent.role} · ${presence.doing}`));
      const chat = chatFor(agent);
      if (threadHost.firstElementChild !== chat.thread.toElement()) {
        threadHost.replaceChildren(chat.thread.toElement());
        dock.replaceChildren(chat.composer.toElement());
      }
    }

    /**
     * The conversation with an agent and its composer, made the first time the chat opens. An
     * agent you have not written to yet greets you first.
     * @param {(typeof agents)[number]} agent
     * @returns {{thread: AgentThread, composer: Composer}}
     */
    function chatFor(agent) {
      const existing = chats.get(agent.id);
      if (existing) return existing;
      const messages = CHATS[agent.id] ?? [{
        from: agent.id, at: clock(state.now, false),
        text: agent.offline ? `I’m offline for now (${agent.away?.toLocaleLowerCase()}). Your messages will wait for me.`
          : `Hello ${me.name.split(' ')[0]}. I’m ${agent.name}, on ${agent.role.toLocaleLowerCase()}. ${presenceOf(agent).doing}.`
      }];
      const thread = keep(new AgentThread(null, {
        items: messages.flatMap((message, index) => messageItems(message, `${agent.id}-${index}`)),
        authors, label: `Conversation with ${agent.name}`, answerActions: [], now,
        formatTime: (at) => at.slice(11, 16),
        onartifact: (event) => openFile(event.detail.id),
        // A link under a message opens what it names in its tab.
        onopen: (event) => {
          const { ref } = event.detail;
          if (ref.entity === 'task') openTask(String(ref.id));
          else openFile(String(ref.id));
        }
      }));
      const composer = keep(new Composer(null, {
        label: `Message ${agent.name}`, placeholder: `Message ${agent.name}`,
        onsend: (event) => sendChat(agent, event.detail.text)
      }));
      const chat = { thread, composer };
      chats.set(agent.id, chat);
      return chat;
    }

    /**
     * A message as thread items: the person's own as it was written; an agent's as the calls it
     * made, then its answer with any file it attached and a link to the task it points to.
     * @param {(typeof CHATS)[string][number]} message
     * @param {string} id
     * @returns {import('../../src/internal/agent-model.js').ThreadItem[]}
     */
    function messageItems(message, id) {
      const at = `${TODAY}T${message.at}`;
      if (message.from === 'me') return [{ id, type: 'user', author: 'me', at, text: message.text }];
      const items = [];
      if (message.tools) {
        items.push({ id: `${id}-work`, type: 'trace', author: message.from, at, steps: message.tools.map((tool, index) => ({
          id: `${id}-call-${index}`, kind: TOOL_KINDS[tool.tool] ?? 'call', label: tool.label, count: tool.tool, tool: tool.tool, ms: tool.ms
        })) });
      }
      const file = message.file ? FILES.find((entry) => entry.id === message.file) : null;
      items.push({
        id, type: 'answer', author: message.from, at, blocks: [
          { type: 'p', text: literal(message.text) },
          ...(file ? [{ type: 'artifact', id: file.id, title: file.name, kind: file.kind === 'code' ? 'code' : 'document' }] : [])
        ],
        refs: message.task ? [{ id: message.task, label: 'Open the task', icon: 'list-check', entity: 'task' }] : undefined
      });
      return items;
    }

    /** The open file: a rendered document, or numbered source. @returns {void} */
    function renderFile() {
      const file = currentFile();
      if (state.open.has('file')) tabs.setTitle('file', file.name);
      const by = agentById(file.by);
      const body = file.kind === 'doc'
        ? h('article', { class: 'agents__doc' }, (file.blocks ?? []).map(([kind, content]) => {
          if (kind === 'title') return h('h3', { class: 'agents__doc-title' }, content);
          if (kind === 'h') return h('h4', { class: 'agents__doc-heading' }, content);
          if (kind === 'ul') return h('ul', { class: 'agents__doc-list' }, /** @type {string[]} */ (content).map((item) => h('li', {}, item)));
          if (kind === 'code') return h('pre', { class: 'agents__doc-code' }, h('code', {}, /** @type {string[]} */ (content).join('\n')));
          return h('p', { class: 'agents__doc-para' }, content);
        }))
        : h('pre', { class: 'agents__code', 'aria-label': `${file.name}, ${file.lines?.length ?? 0} lines` },
          h('code', {}, (file.lines ?? []).map((line) => h('span', { class: 'agents__line' }, line || ' '))));
      redraw(fileView, () => fileView.replaceChildren(
        h('div', { class: 'agents__file-head' },
          iconTile(file.kind === 'doc' ? 'file-lines' : 'code', file.kind === 'doc' ? 'blue' : 'violet'),
          h('div', { class: 'agents__file-who' },
            h('h2', { class: 'agents__file-name' }, file.name),
            h('p', { class: 'agents__file-meta' }, `${file.path} · edited by ${by.name}${/^\d/.test(file.edited) ? ' at ' : ' '}${file.edited.toLocaleLowerCase()}`))),
        body));
    }

    /** The bottom panel's three views. @returns {void} */
    function renderPanel() {
      terminalView.replaceChildren(...terminal.map((line) => h('span', { class: 'agents__term-line', dataset: { kind: line.kind } },
        line.kind === 'command' ? h('span', { class: 'agents__term-prompt', 'aria-hidden': 'true' }, '$ ') : null, line.text)));
      outputView.replaceChildren(...output.map((line) => h('li', { class: 'agents__output-line' },
        h('span', { class: 'agents__output-time' }, line.at),
        h('span', { class: 'agents__output-actor' }, nameOf(line.actor)),
        h('span', { class: 'agents__output-text' }, line.text))));
      problemsView.replaceChildren(...PROBLEMS.map((problem) => h('li', { class: 'agents__problem', dataset: { severity: problem.severity } },
        icon(problem.severity === 'warning' ? 'triangle-exclamation' : 'circle-info', { label: problem.severity === 'warning' ? 'Warning' : 'Note' }),
        h('span', { class: 'agents__problem-text' }, problem.text),
        problem.file
          ? h('button', { type: 'button', class: 'link-button agents__problem-where', onclick: () => openFile(problem.file ?? '') }, problem.where)
          : h('span', { class: 'agents__problem-where' }, problem.where))));
      panelTabs.setBadge('problems', String(PROBLEMS.length));
    }

    /** Where the composer's request will go, as you type it. @returns {void} */
    function renderRoute() {
      const text = composer.getValue().trim();
      const target = text ? routeFor(text) : null;
      const orbit = agentById('orbit');
      if (!text) {
        route.replaceChildren(agentMark(orbit), h('span', {}, `${orbit.name} routes it to the right agent`));
        return;
      }
      if (!target) {
        route.replaceChildren(agentMark(orbit), h('span', {}, `${orbit.name} will plan it`));
        return;
      }
      const agent = agentById(target);
      const presence = presenceOf(agent);
      route.replaceChildren(agentMark(agent), h('span', {},
        'Routes to ', h('span', { class: 'agents__strong' }, agent.name), ` · ${agent.role}`,
        presence.state === 'offline' ? ' · offline, it will wait' : ''));
    }

    /** Marks where you are in the navigation and the roster. @returns {void} */
    function syncNav() {
      nav.setActive({ home: 'agents:home', task: 'agents:tasks', chat: 'agents:conversations', file: 'agents:files' }[state.tab] ?? null);
      for (const row of roster.querySelectorAll('.agents__agent')) {
        const current = state.tab === 'chat' && row.getAttribute('data-key') === `roster:${state.chat}`;
        if (current) row.setAttribute('aria-current', 'true');
        else row.removeAttribute('aria-current');
      }
    }

    /* ------------------------------------------------------------------ navigation -- */

    /** @param {string} name @returns {import('../../src/components/tabbox/tabbox.js').TabDefinition} */
    function tabDefinition(name) {
      const entry = VIEWS[name];
      return { name, title: entry.title(), icon: entry.icon, closable: name !== 'home', content: entry.view };
    }

    /**
     * Shows an editor tab, reopening it in its place if it was closed, and takes the focus to its
     * heading so a screen reader says where it went.
     * @param {string} name
     * @param {{focus?: boolean}} [options]
     * @returns {void}
     */
    function show(name, { focus = true } = {}) {
      if (!state.open.has(name)) {
        const index = TAB_ORDER.filter((other) => other !== name && state.open.has(other) && TAB_ORDER.indexOf(other) < TAB_ORDER.indexOf(name)).length;
        tabs.addTab(tabDefinition(name), { index });
        state.open.add(name);
      }
      tabs.openTab(name);
      state.tab = name;
      syncNav();
      // A narrow tab row scrolls: the tab just opened comes into view.
      tabs.toElement().querySelector('[role="tab"][aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (focus && !preview) focusHeadingIn(VIEWS[name].view);
    }

    /** @returns {void} */
    function openHome() {
      show('home');
    }

    /** The Tasks section: Home's task table. @returns {void} */
    function openTasks() {
      show('home', { focus: false });
      focusHeadingIn(tasksHeading.parentElement);
    }

    /** The Activity section: Home's recent activity. @returns {void} */
    function openActivity() {
      show('home', { focus: false });
      focusHeadingIn(activityHeading.parentElement);
    }

    /** @param {string} id @returns {void} */
    function openTask(id) {
      if (!taskById(id)) return;
      const changed = state.task !== id;
      state.task = id;
      renderTask();
      renderInspector();
      renderStatus();
      show('task');
      if (changed) VIEWS.task.view.parentElement?.scrollTo({ top: 0 });
    }

    /** @param {string} id @returns {void} */
    function openChat(id) {
      state.chat = id;
      renderChat();
      show('chat', { focus: false });
      renderRoster();
      syncNav();
      if (!preview) focusHeadingIn(chatView);
    }

    /** @param {string} id @returns {void} */
    function openFile(id) {
      if (!FILES.some((file) => file.id === id)) return;
      state.file = id;
      renderFile();
      show('file');
      VIEWS.file.view.parentElement?.scrollTo({ top: 0 });
    }

    /** N: Home's composer, ready to type. @returns {void} */
    function newTask() {
      show('home', { focus: false });
      if (preview) return;
      composer.focus();
      composer.toElement().scrollIntoView({ block: 'nearest' });
    }

    /**
     * G A: the roster, opening the navigation wherever it is hidden — the drawer narrow, the
     * minimized sidebar expanded wide — on this module's panel.
     * @returns {void}
     */
    function goToRoster() {
      if (root.clientWidth <= SHELL_BREAKPOINTS.nav) shell.openNav();
      else if (nav.sidebar.isCollapsed()) nav.sidebar.expand();
      nav.sidebar.setModule('assistant');
      const row = roster.querySelector('[aria-current="true"]') ?? roster.querySelector('button');
      if (row instanceof HTMLElement) row.focus();
    }

    /** @param {HTMLElement|null} region @returns {void} Focuses the region's first heading. */
    function focusHeadingIn(region) {
      if (preview || !region) return;
      const heading = region.querySelector('h2, h3');
      if (!(heading instanceof HTMLElement)) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: false });
    }

    /** @param {FocusOptions} [options] @returns {void} */
    function focusActiveTab(options) {
      const tab = tabs.toElement().querySelector('[role="tab"][aria-selected="true"]');
      if (tab instanceof HTMLElement) tab.focus(options);
    }

    /**
     * Shortcuts listen on the layout's root, so focus must not be left on the page body when an
     * overlay closes over a control that has gone or is hidden. Puts it back on the active tab.
     * @returns {void}
     */
    function refocus() {
      later(context, () => {
        const active = document.activeElement;
        if (!active || active === document.body || !active.checkVisibility()) focusActiveTab();
      }, 0);
    }

    /** Mod+K, and the navigation's Workflows and Files: the palette, optionally on one of its pages. @param {string} [page] @returns {void} */
    function openPalette(page) {
      if (!palette) return;
      palette.setItems(paletteItems());
      palette.setQuery('');
      palette.open(page ? { page } : {});
    }

    /** @returns {import('../../src/components/launcher/launcher.js').LauncherItem[]} */
    function paletteItems() {
      const model = MODELS.find((entry) => entry.id === state.model);
      const mod = modifierLabel();
      const suggest = (order, item) => ({ group: 'Suggestions', groupOrder: 0, itemOrder: order, ...item });
      const go = (order, item) => ({ group: 'Navigate', groupOrder: 1, itemOrder: order, ...item });
      return [
        suggest(0, { id: 'new-task', label: 'New task', description: 'Describe it, and Orbit routes it', icon: 'pen-to-square', shortcut: ['N'], keys: 'N', invoke: () => newTask() }),
        suggest(1, {
          id: 'agents', label: 'Agents', description: 'Open a chat with an agent', icon: 'robot', placeholder: 'Search agents',
          items: agents.map((agent, index) => {
            const presence = presenceOf(agent);
            return {
              id: `agent-${agent.id}`, label: agent.name, description: `${agent.role} · ${presence.doing}`, hint: PRESENCE[presence.state],
              icon: () => agentMark(agent), keywords: [agent.role, presence.doing], itemOrder: index, invoke: () => openChat(agent.id)
            };
          })
        }),
        suggest(2, {
          id: 'workflows', label: 'Workflows', description: 'Run a workflow', icon: 'diagram-project', placeholder: 'Search workflows',
          items: WORKFLOWS.map((workflow, index) => ({
            id: `workflow-${workflow.id}`, label: workflow.label, description: workflow.description, hint: agentById(workflow.agent).name,
            icon: 'play', keywords: [agentById(workflow.agent).name], itemOrder: index, invoke: () => runWorkflow(workflow)
          }))
        }),
        suggest(3, {
          id: 'files', label: 'Files', description: 'Search files', icon: 'file-lines', placeholder: 'Search files', order: 'rank',
          items: () => FILES.map((file, index) => ({
            id: `file-${file.id}`, label: file.name, description: file.path, hint: `${agentById(file.by).name}, ${file.edited}`,
            icon: file.kind === 'doc' ? 'file-lines' : 'code', keywords: [file.path], itemOrder: index, invoke: () => openFile(file.id)
          }))
        }),
        suggest(4, {
          id: 'models', label: 'Models', description: 'Switch the model the agents run on', icon: 'brain', hint: model?.label,
          placeholder: 'Search models',
          items: MODELS.map((entry, index) => ({
            id: `model-${entry.id}`, label: entry.label, description: entry.description, icon: 'brain', itemOrder: index,
            current: entry.id === state.model, hint: entry.id === state.model ? 'Current' : undefined,
            invoke: () => switchModel(entry.id)
          }))
        }),
        go(0, { id: 'go-home', label: 'Home', icon: 'house', shortcut: ['G', 'H'], invoke: () => openHome() }),
        go(1, { id: 'go-task', label: 'Open task', description: currentTask().title, icon: 'list-check', shortcut: ['G', 'T'], invoke: () => openTask(state.task) }),
        go(2, { id: 'go-roster', label: 'Agent roster', icon: 'users', shortcut: ['G', 'A'], invoke: () => goToRoster() }),
        go(3, { id: 'toggle-panel', label: 'Toggle bottom panel', icon: 'panel-bottom', shortcut: [mod, 'J'], keys: modShortcut('j').keys, invoke: () => shell.togglePanel() }),
        go(4, { id: 'toggle-inspector', label: 'Toggle inspector', icon: 'panel-right', shortcut: [mod, 'I'], keys: modShortcut('i').keys, invoke: () => shell.toggleInspector() }),
        go(5, { id: 'help', label: 'Keyboard shortcuts', icon: 'keyboard', shortcut: ['?'], invoke: () => showHelp() })
      ];
    }

    /* ---------------------------------------------------------------------- work -- */

    /**
     * Adds an event to a task's log, and a line to the agents' output.
     * @param {AgentTask} task
     * @param {Omit<LogEvent, 'at'>} event
     * @returns {LogEvent}
     */
    function log(task, event) {
      const entry = { at: state.now, ...event };
      task.log.push(entry);
      if (event.call) output.push({ at: clock(state.now), actor: event.actor, text: `${event.call} ${event.args ?? ''}`.trim() });
      return entry;
    }

    /** @param {string} actor @param {string} text @returns {void} */
    function remember(actor, text) {
      activity.unshift({ at: state.now, actor, text });
    }

    /** @param {string} text @returns {void} Says a change out loud to a screen reader. */
    function announce(text) {
      live.textContent = '';
      later(context, () => { live.textContent = text; }, 50);
    }

    /**
     * Starts the next step of a plan once the one before it is done: its agent picks it up, or —
     * when it is your decision — the agent that asked waits on you.
     * @param {AgentTask} task
     * @returns {PlanStep|undefined} The step now under way.
     */
    function advance(task) {
      const next = task.plan.find((step) => step.status === 'todo');
      if (!next) {
        task.finished = state.now;
        return undefined;
      }
      next.since = state.now;
      next.status = next.approval ? 'waiting' : 'in-progress';
      return next;
    }

    /**
     * Approves the step a task waits on, and lets the next one start.
     * @param {string} id Task id.
     * @returns {void}
     */
    function approve(id) {
      const task = taskById(id);
      const step = task?.plan.find((entry) => entry.status === 'waiting');
      if (!task || !step?.approval) return;
      step.status = 'done';
      step.secs = state.now - (step.since ?? state.now);
      log(task, { actor: 'me', kind: 'decision', action: step.approval.done, args: `asked by ${nameOf(step.approval.from)}` });
      const next = advance(task);
      if (next) {
        log(task, { actor: step.approval.from, kind: 'handoff', to: next.agent, action: `Handed off to ${nameOf(next.agent)}`, args: `“${next.text}”` });
        if (next.agent !== 'me') log(task, { actor: next.agent, kind: 'tool', action: next.doing ?? next.text, call: FOLLOW_UP_CALLS[task.id] ?? 'run_step', args: `step: ${task.plan.indexOf(next) + 1}`, running: true });
      }
      remember('me', `approved “${step.text.toLocaleLowerCase()}” on ${task.title}`);
      announce(`Approved. ${next ? `${nameOf(next.agent)} is on “${next.text}”.` : 'The task is done.'}`);
      refresh();
      // Approved from a toast, the focus left with it.
      refocus();
      schedule(task, () => finishStep(task), 6000);
    }

    /**
     * Unblocks the step a task is stuck on: the call that stopped is made again.
     * @param {string} id Task id.
     * @returns {void}
     */
    function resolve(id) {
      const task = taskById(id);
      const step = task?.plan.find((entry) => entry.status === 'blocked');
      if (!task || !step) return;
      step.status = 'in-progress';
      step.since = state.now;
      const stopped = task.log.findLastIndex((event) => event.actor === step.agent && event.kind === 'block');
      const call = task.log.findLast((event) => event.call === 'match_ledger');
      log(task, { actor: 'me', kind: 'decision', action: 'Granted read access to the freight ledger', args: 'role: "ledger-reader"' });
      log(task, {
        actor: step.agent, kind: 'tool', action: 'Matching against the ledger', call: 'match_ledger', args: call?.args ?? 'invoices: 240',
        running: true, retryOf: stopped < 0 ? undefined : stopped
      });
      remember('me', `gave ${nameOf(step.agent)} read access to the freight ledger`);
      announce(`${nameOf(step.agent)} is working again.`);
      refresh();
      refocus();
      schedule(task, () => finishStep(task), 6000);
    }

    /**
     * Finishes the step under way in a task and starts the next one — the work the agents do
     * between your decisions.
     * @param {AgentTask} task
     * @returns {void}
     */
    function finishStep(task) {
      const step = task.plan.find((entry) => entry.status === 'in-progress');
      if (!step) return;
      step.status = 'done';
      step.secs = state.now - (step.since ?? state.now);
      const running = task.log.findLast((event) => event.running);
      if (running) {
        running.running = false;
        running.ms = (state.now - running.at) * 1000;
        running.tokens = 1800;
        running.detail = [...(running.detail ?? []), 'Finished.'];
      }
      const next = advance(task);
      if (next?.approval) {
        log(task, { actor: next.approval.from, kind: 'request', action: 'Asked for your approval', args: `“${next.text}”` });
        remember(next.approval.from, `asked you to approve “${next.text.toLocaleLowerCase()}”`);
      } else if (next) {
        log(task, { actor: step.agent, kind: 'handoff', to: next.agent, action: `Handed off to ${nameOf(next.agent)}`, args: `“${next.text}”` });
        log(task, { actor: next.agent, kind: 'note', action: next.doing ?? next.text, running: true });
        remember(step.agent, `finished “${step.text.toLocaleLowerCase()}” and handed over to ${nameOf(next.agent)}`);
      } else {
        remember(step.agent, `finished “${task.title}”`);
      }
      refresh();
      if (next?.approval) requestApproval(task);
      else if (next) schedule(task, () => finishStep(task), 7000);
    }

    /**
     * Runs `fn` after a delay — or, if the task is paused by then, once it resumes.
     * @param {AgentTask} task
     * @param {() => void} fn
     * @param {number} ms
     * @returns {void}
     */
    function schedule(task, fn, ms) {
      if (preview) return;
      later(context, () => {
        if (task.paused) state.pending.set(task.id, fn);
        else fn();
      }, ms);
    }

    /** The export suite passes, and Warden asks to deploy. @returns {void} */
    function finishSuite() {
      const task = taskById('fix-exports');
      if (!task || task.plan[3].status !== 'in-progress') return;
      if (task.paused) {
        state.pending.set(task.id, () => finishSuite());
        return;
      }
      terminal.pop();
      terminal.push(
        { kind: 'out', text: '  ✓ 9 more tenants, 143 of 143' },
        { kind: 'out', text: 'Exports: 214 passed, 0 failed, 3m 02s' });
      const step = task.plan[3];
      step.status = 'done';
      step.secs = state.now - (step.since ?? state.now);
      const running = task.log.findLast((event) => event.running);
      if (running) {
        running.running = false;
        running.ms = (state.now - running.at) * 1000;
        running.tokens = 1240;
        running.detail = ['214 exports checked across 12 tenants: 214 passed, 0 failed.', 'Every page boundary now matches a full table scan.'];
      }
      output.push({ at: clock(state.now), actor: 'warden', text: 'run_tests suite="export"  214 passed' });
      const ask = advance(task);
      log(task, { actor: 'warden', kind: 'request', action: 'Asked you to approve the deploy', args: '214 passed, 0 failed' });
      remember('warden', 'passed the export suite and asked to deploy to staging');
      refresh();
      if (ask?.approval) requestApproval(task);
    }

    /** Ledger loses access to the ledger it reads. @returns {void} */
    function blockLedger() {
      const task = taskById('reconcile');
      const step = task?.plan.find((entry) => entry.status === 'in-progress');
      if (!task || !step || task.paused) return;
      step.status = 'blocked';
      step.since = state.now;
      step.blocker = 'No read access to the freight ledger';
      const running = task.log.findLast((event) => event.running);
      if (running) {
        running.running = false;
        running.ms = (state.now - running.at) * 1000;
        running.tokens = 2650;
      }
      log(task, {
        actor: 'ledger', kind: 'block', action: 'Stopped: no read access to the freight ledger', args: 'account: "freight-2026"',
        detail: ['403 Forbidden: the agents’ service account has no read role on “freight-2026”.', '212 of 240 invoices are matched; 28 remain.']
      });
      remember('ledger', 'is blocked: it needs read access to the freight ledger');
      refresh();
      const ledger = agentById('ledger');
      notify(`${ledger.name} is blocked: it needs read access to the freight ledger.`, 'warning', {
        leading: keep(agentAvatar(ledger, 'sm')).toElement(),
        action: { label: 'Resolve', onclick: () => answerFromToast(() => resolve(task.id)) },
        timeout: 12000
      });
    }

    /**
     * Answers a toast's request. The toast closes with the focus it holds, so the focus goes back
     * to the open tab first, where the workspace's keys keep working.
     * @param {() => void} answer
     * @returns {void}
     */
    function answerFromToast(answer) {
      focusActiveTab();
      answer();
    }

    /** A toast for a decision an agent waits on. @param {AgentTask} task @returns {void} */
    function requestApproval(task) {
      const step = task.plan.find((entry) => entry.status === 'waiting');
      if (!step?.approval) return;
      const from = agentById(step.approval.from);
      notify(`${from.name}: ${step.approval.ask}`, 'info', {
        leading: keep(agentAvatar(from, 'sm')).toElement(),
        action: { label: 'Approve', onclick: () => answerFromToast(() => approve(task.id)) },
        timeout: 12000
      });
    }

    /**
     * Pauses a run — its agents stop where they are — or resumes it.
     * @param {string} id Task id.
     * @returns {void}
     */
    function togglePause(id) {
      const task = taskById(id);
      if (!task || taskStatus(task) === 'done') return;
      if (task.paused) {
        task.pausedFor = (task.pausedFor ?? 0) + state.now - (task.pausedAt ?? state.now);
        for (const step of task.plan) if (step.status === 'in-progress' && step.since !== undefined) step.since += state.now - (task.pausedAt ?? state.now);
        task.paused = false;
        task.pausedAt = undefined;
        task.pauseReason = undefined;
        log(task, { actor: 'me', kind: 'decision', action: 'Resumed the run' });
        const pending = state.pending.get(task.id);
        state.pending.delete(task.id);
        if (pending) later(context, pending, 1500);
      } else {
        task.paused = true;
        task.pausedAt = state.now;
        log(task, { actor: 'me', kind: 'decision', action: 'Paused the run', pause: true });
      }
      announce(task.paused ? `${task.title} is paused.` : `${task.title} is running again.`);
      refresh();
    }

    /**
     * Starts a task from the composer, routed to the agent that fits.
     * @param {string} text The request.
     * @param {File[]} files What was attached to it.
     * @returns {void}
     */
    function startTask(text, files) {
      const agent = agentById(routeFor(text) ?? 'orbit');
      createTask(titleFrom(text), agent, 'Inbox', files.map((file) => file.name));
      // The composer empties once the send is through; the route follows it.
      queueMicrotask(() => renderRoute());
      const offline = presenceOf(agent).state === 'offline';
      notify(offline ? `${agent.name} is offline, so the task waits for it.` : `Orbit routed it to ${agent.name}.`, offline ? 'info' : 'success', {
        leading: keep(agentAvatar(agent, 'sm')).toElement()
      });
    }

    /**
     * Adds a task, planned by the orchestrator and handed to an agent.
     * @param {string} title
     * @param {(typeof agents)[number]} agent
     * @param {string} project
     * @param {string[]} [files] Names of the files the request came with.
     * @returns {AgentTask}
     */
    function createTask(title, agent, project, files = []) {
      const task = /** @type {AgentTask} */ ({
        id: `task-${state.nextNumber}`, number: state.nextNumber, title, project, lead: 'orbit', owner: agent.id,
        run: state.nextRun, branch: 'main', started: state.now, pausedFor: 0,
        plan: [
          { text: 'Plan the task', agent: 'orbit', status: 'done', secs: 4 },
          { text: title, agent: agent.id, status: agent.offline ? 'todo' : 'in-progress', since: agent.offline ? undefined : state.now, doing: title },
          { text: 'Review the result', agent: 'warden', status: 'todo', doing: `Reviewing “${title}”` }
        ],
        log: []
      });
      state.nextNumber += 1;
      state.nextRun += 1;
      log(task, {
        actor: 'orbit', kind: 'tool', action: 'Planned the task', call: 'plan', args: 'steps: 3', ms: 1800, tokens: 940,
        detail: ['Three steps: the work, then a review.', ...(files.length ? [`Attached: ${files.join(', ')}`] : [])]
      });
      log(task, { actor: 'orbit', kind: 'handoff', to: agent.id, action: `Handed off to ${agent.name}`, args: `“${title}”` });
      if (!agent.offline) log(task, { actor: agent.id, kind: 'note', action: title, running: true });
      tasks.unshift(task);
      remember('orbit', `routed “${title}” to ${agent.name}`);
      refresh();
      if (!agent.offline) schedule(task, () => finishStep(task), 9000);
      return task;
    }

    /** @param {(typeof WORKFLOWS)[number]} workflow @returns {void} Starts a workflow as a task. */
    function runWorkflow(workflow) {
      const agent = agentById(workflow.agent);
      createTask(workflow.label, agent, 'Workflows');
      const offline = presenceOf(agent).state === 'offline';
      notify(offline ? `${workflow.label} is queued: ${agent.name} is offline.` : `${workflow.label} started. ${agent.name} is on it.`, offline ? 'info' : 'success', {
        leading: keep(agentAvatar(agent, 'sm')).toElement()
      });
    }

    /** @param {string} id @returns {void} */
    function switchModel(id) {
      state.model = id;
      renderInspector();
      notify(`The agents now run on ${MODELS.find((model) => model.id === id)?.label}.`);
    }

    /**
     * Sends a message to an agent. One that is online writes back — the thread says it is writing
     * until its answer arrives; one that is offline finds the message when it returns.
     * @param {(typeof agents)[number]} agent
     * @param {string} text
     * @returns {void}
     */
    function sendChat(agent, text) {
      const { thread } = chatFor(agent);
      const at = isoAt(state.now);
      thread.upsert({ id: `sent-${state.sent++}`, type: 'user', author: 'me', at, text });
      if (agent.offline || preview) return;
      const presence = presenceOf(agent);
      const reply = literal(presence.task ? `Noted. I’ll take that into “${presence.task.title}”.` : 'Noted. Send me a task whenever you’re ready.');
      const id = `sent-${state.sent++}`;
      thread.upsert({ id, type: 'answer', author: agent.id, at, blocks: [], streaming: true });
      later(context, () => {
        thread.appendText(id, reply);
        thread.patch(id, { streaming: false });
      }, 1400);
    }

    /** The status bar's Motion setting: follow the system, or reduce motion here. @returns {void} */
    function toggleMotion() {
      if (root.dataset.zxMotion === 'reduced') delete root.dataset.zxMotion;
      else root.dataset.zxMotion = 'reduced';
      renderStatus();
      announce(root.dataset.zxMotion === 'reduced' ? 'Motion reduced in this workspace.' : 'Motion follows the system setting.');
    }

    /** One second passes. @returns {void} */
    function tick() {
      state.now += 1;
      state.timers = state.timers.filter((timer) => timer.element.isConnected);
      for (const timer of state.timers) paint(timer);
    }
  }
};
