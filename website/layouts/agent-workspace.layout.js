/*
 * Agent workspace — a team of AI agents working through Fieldstone's tasks, and the person who
 * directs them. The navigation column holds the workspace's sections and the agent roster with
 * live presence; the main pane is a row of editor tabs (Home, a task, a chat, a file) above a
 * bottom panel (terminal, output, problems); the inspector groups the agents by state beside the
 * open run's figures; a status bar runs along the foot.
 *
 * Presence moves: an agent's avatar breathes while it is idle, bobs while it works, sways while it
 * thinks, and tilts and blinks when it needs you — every avatar driven by one animation loop that
 * pauses while the page is hidden or the avatar is off screen, and stops under reduced motion.
 * Presence is never told by motion alone: it is always a dot and a word as well.
 */
import {
  AccountMenu, AppSidebar, Avatar, Launcher, ProgressBar, Tabbox, Table, button, formatNumber, h, icon,
  spinner, statusIcon, watchMotion
} from '../../src/index.js';
import {
  SHELL_BREAKPOINTS, adaptiveShell, disposer, iconButton, iconTile, kbd, later, layoutContext, modShortcut,
  modifierLabel, navSearch, paneHeader, panelBlock, propList, renderScope, sectionLabel, shortcutSheet, shortcuts,
  toaster, unavailable, workspaceHeader
} from './kit.js';
import { ME, NOW, person } from './fixtures.js';

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
 * @property {number} [from] When a running event's clock counts from, once a pause has moved it.
 * @property {string} [file] A file the event wrote or read, by id.
 * @property {string[]} [detail] What the row shows when it is expanded.
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
      { at: '09:40:00', actor: 'orbit', kind: 'note', action: 'Paused for the release freeze', args: 'until 14:00',
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
    ['p', 'Best regards, Ines Bauer, Fieldstone']
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

/** Earlier messages with the agents; an agent without any greets you instead. */
const CHATS = {
  fathom: [
    { from: 'me', at: '10:05', text: 'Kestrel says Tuesday’s export skipped rows. Can you find out why?' },
    { from: 'fathom', at: '10:06', text: 'On it. I’ll reproduce it with their dataset first.', tools: ['query_export · 3.4s'] },
    { from: 'fathom', at: '10:19', text: 'Found it: the cursor keeps the key of deleted rows, so the next page starts one row late. My notes are in research.md, and Kiln has the fix.', tools: ['search_code · 1.2s', 'read_file · 0.4s'], file: 'research' }
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

/** Longest frame step the presence loop advances by: after a stall the avatars resume, not jump. */
const MAX_FRAME_MS = 50;

/** The tool each task's next step calls once you approve it. */
const FOLLOW_UP_CALLS = {
  'fix-exports': 'deploy',
  'kestrel-reply': 'send_reply',
  reconcile: 'post_entries'
};

/** The order the editor tabs keep, whichever are open. */
const TAB_ORDER = ['home', 'task', 'chat', 'file'];

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

/** @param {number} ms @returns {string} A call's duration: "400 ms", "3.4s". */
function callTime(ms) {
  return ms < 1000 ? `${ms} ms` : `${formatNumber(ms / 1000, { decimals: 1 })}s`;
}

/** @param {string} text @returns {string} A request turned into a task title. */
function titleFrom(text) {
  const clean = text.replace(/\s+/g, ' ').trim().replace(/[.?!]+$/, '');
  const title = clean.charAt(0).toLocaleUpperCase() + clean.slice(1);
  return title.length > 72 ? `${title.slice(0, 71).trimEnd()}…` : title;
}

/** @param {string} key @returns {number} A stable offset in seconds, so avatars never move in step. */
function phaseOf(key) {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return (hash / 997) * 4;
}

/**
 * Where an avatar in a presence state wants to be at time `t`: a vertical offset in pixels, a
 * rotation in degrees, a scale, and — for an agent that needs you — the depth of a blink.
 * @param {string|undefined} presence
 * @param {number} t Seconds.
 * @returns {{y: number, r: number, s: number, w: number, blink: number}}
 */
function presencePose(presence, t) {
  const cycle = (period) => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / period);
  if (presence === 'idle') return { y: 0, r: 0, s: 1 + 0.035 * cycle(4.8), w: 0, blink: 0 };
  if (presence === 'thinking') return { y: 0, r: 4 * Math.sin((2 * Math.PI * t) / 3.4), s: 1, w: 0, blink: 0 };
  if (presence === 'working') return { y: -1.6 * cycle(1.1), r: 0, s: 1, w: 0, blink: 0 };
  if (presence === 'needs-you') {
    const beat = t % 3.6;
    const blink = beat < 0.18 ? Math.sin((Math.PI * beat) / 0.18) : 0;
    return { y: 0, r: -8 + Math.sin((2 * Math.PI * t) / 2.6), s: 1, w: 1, blink: 0.28 * blink };
  }
  return { y: 0, r: 0, s: 1, w: 0, blink: 0 };
}

/**
 * The one animation loop every presence avatar in a layout shares. An avatar joins with `track()`
 * (a `.agents__presence` element carrying `data-presence` and `data-presence-key`) and leaves when
 * it is taken out of the document. The loop moves only avatars on screen, eases between states,
 * clamps its frame step, sleeps while the page is hidden or nothing is moving, and stops — with
 * every avatar back at rest — under reduced motion, the system's or the layout's own. It animates
 * `transform` only, and never runs in a thumbnail.
 * @param {HTMLElement} root The layout root, where `data-zx-motion` is set.
 * @param {import('./kit.js').LayoutContext} context
 * @returns {{track: (element: HTMLElement) => void}}
 */
function presenceLoop(root, context) {
  if (context.preview) return { track: () => {} };
  /** @type {Map<HTMLElement, number>} Each tracked avatar and its phase. */
  const tracked = new Map();
  /** @type {Map<string, {y: number, r: number, s: number, w: number}>} Poses by key, so a redrawn avatar continues. */
  const poses = new Map();
  /** @type {Set<Element>} */
  const visible = new Set();
  let frame = 0;
  let last = 0;
  let time = 0;
  let reduced = true;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
    }
    start();
  });
  const runnable = () => !reduced && !document.hidden && visible.size > 0 && !context.signal.aborted;

  function start() {
    if (frame || !runnable()) return;
    last = performance.now();
    frame = requestAnimationFrame(step);
  }

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  /** @param {number} now */
  function step(now) {
    frame = 0;
    const dt = Math.min(Math.max(now - last, 0), MAX_FRAME_MS) / 1000;
    last = now;
    time += dt;
    const ease = 1 - Math.exp(-dt * 8);
    let moving = false;
    for (const [element, phase] of tracked) {
      if (!element.isConnected) {
        tracked.delete(element);
        visible.delete(element);
        observer.unobserve(element);
        continue;
      }
      if (!visible.has(element)) continue;
      const key = element.dataset.presenceKey ?? '';
      const target = presencePose(element.dataset.presence, time + phase);
      const pose = poses.get(key) ?? { y: 0, r: 0, s: 1, w: 0 };
      pose.y += (target.y - pose.y) * ease;
      pose.r += (target.r - pose.r) * ease;
      pose.s += (target.s - pose.s) * ease;
      pose.w += (target.w - pose.w) * ease;
      poses.set(key, pose);
      const still = target.y === 0 && target.r === 0 && target.s === 1 && target.w === 0;
      const settled = Math.abs(pose.y) < 0.01 && Math.abs(pose.r) < 0.01 && Math.abs(pose.s - 1) < 0.0005 && pose.w < 0.01;
      if (still && settled) {
        element.style.removeProperty('transform');
        continue;
      }
      moving = true;
      const squash = 1 - pose.w * target.blink;
      element.style.transform = `translateY(${pose.y.toFixed(2)}px) rotate(${pose.r.toFixed(2)}deg) `
        + `scale(${pose.s.toFixed(4)}, ${(pose.s * squash).toFixed(4)})`;
    }
    if (moving) start();
  }

  watchMotion(root, (value) => {
    reduced = value;
    if (!reduced) return start();
    stop();
    for (const element of tracked.keys()) element.style.removeProperty('transform');
    poses.clear();
  }, { signal: context.signal, immediate: true });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()), { signal: context.signal });
  context.cleanup(() => {
    stop();
    observer.disconnect();
    tracked.clear();
  });

  return {
    track(element) {
      if (!tracked.has(element)) {
        tracked.set(element, phaseOf(element.dataset.presenceKey ?? ''));
        observer.observe(element);
      }
      start();
    }
  };
}

export default {
  title: 'Agent workspace',
  category: 'AI',
  blurb: 'A team of AI agents working through tasks: a roster with live presence, plans and execution logs, approvals as they arrive, a command palette, and a terminal.',
  components: [
    'Tabbox', 'Launcher', 'Avatar', 'Table', 'AppSidebar', 'AccountMenu', 'ProgressBar', 'Message', 'Dialog', 'statusIcon'
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
    // Narrow, the inspector and then the navigation become drawers; Mod+B, Mod+I, and Mod+J show
    // and hide the columns and the bottom panel at any width.
    const shell = adaptiveShell(root, context, {
      asideLabel: 'Show agents and run', panelLabel: 'Toggle bottom panel', keys: true
    });
    const motion = presenceLoop(root, context);
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
    /** @type {Map<string, {from: string, at: string, text: string, tools?: string[], file?: string, task?: string}[]>} */
    const chats = new Map(Object.entries(structuredClone(CHATS)));
    const terminal = TERMINAL.map(([kind, text]) => ({ kind, text }));
    const output = [
      { at: '10:25:20', actor: 'kiln', text: 'run_tests filter="cursor"  6 passed' },
      { at: '10:26:10', actor: 'warden', text: 'review_diff branch="fix/cursor-pagination"  1 note' },
      { at: '10:27:02', actor: 'warden', text: 'run_tests suite="export" all=true  started' }
    ];
    const state = {
      tab: 'home', task: 'fix-exports', chat: 'fathom', file: 'research', model: 'ridge-pro',
      now: NOW.getHours() * 3600 + NOW.getMinutes() * 60 + NOW.getSeconds(),
      nextRun: 483, nextNumber: 215, typing: /** @type {string|null} */ (null),
      open: new Set(TAB_ORDER), expanded: /** @type {Set<string>} */ (new Set()),
      /** @type {{element: HTMLElement, from: number, task: AgentTask|null}[]} Clocks that tick. */
      timers: [],
      /** @type {Map<string, () => void>} What a paused run does once it resumes. */
      pending: new Map()
    };

    // Components drawn for one rendering of a region are released when it is drawn again.
    const rosterParts = renderScope(context);
    const asideParts = renderScope(context);
    const homeParts = renderScope(context);
    const taskParts = renderScope(context);
    const chatParts = renderScope(context);

    /* ------------------------------------------------------------ navigation column -- */

    const sections = keep(new AppSidebar(null, {
      label: 'Sections', collapsible: false,
      items: [
        { id: 'home', label: 'Home', icon: 'house', invoke: () => openHome() },
        { id: 'projects', label: 'Projects', icon: 'folder-regular', invoke: () => notify(unavailable('Projects'), 'info') },
        { id: 'tasks', label: 'Tasks', icon: 'list-check', invoke: () => openTasks() },
        { id: 'workflows', label: 'Workflows', icon: 'diagram-project', invoke: () => openPalette('workflows') }
      ]
    }));
    const resources = keep(new AppSidebar(null, {
      label: 'Resources', collapsible: false,
      items: [
        { id: 'files', label: 'Files', icon: 'file-lines', invoke: () => openPalette('files') },
        { id: 'conversations', label: 'Conversations', icon: 'comments', invoke: () => openChat(state.chat) },
        { id: 'runs', label: 'Runs', icon: 'timeline', invoke: () => openTask(state.task) },
        { id: 'activity', label: 'Activity', icon: 'bolt', invoke: () => openActivity() }
      ]
    }));
    const rosterCount = h('span', { class: 'agents__count' });
    const roster = h('ul', { class: 'agents__roster', role: 'list', 'aria-label': 'Agents' });
    const showHelp = shortcutSheet(context, SHORTCUTS, { onclose: () => refocus() });
    const account = keep(new AccountMenu(null, {
      account: { name: me.name, secondary: me.role, status: 'online', statusLabel: 'Online' },
      placement: 'top-start',
      items: [
        { label: 'Keyboard shortcuts', icon: 'keyboard', adornment: kbd('?'), onselect: () => showHelp() },
        { label: 'Workspace settings', icon: 'gear', onselect: () => notify(unavailable('Workspace settings'), 'info') }
      ]
    }));
    const nav = h('div', { class: 'shell__nav' },
      workspaceHeader({
        actions: iconButton('pen-to-square', 'New task', () => newTask(), { shortcut: { label: 'N', keys: 'N' } })
      }),
      h('div', { class: 'nav-action' }, navSearch({ label: 'Search or run…', onclick: () => openPalette() })),
      h('div', { class: 'shell__body' },
        sections.toElement(),
        sectionLabel('Resources'),
        resources.toElement(),
        sectionLabel('Agents', rosterCount),
        roster),
      h('div', { class: 'shell__footer' }, account.toElement()));

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

    const asideBody = h('div', { class: 'shell__body' });
    const aside = h('aside', { class: 'shell__aside', 'aria-label': 'Agents and run' },
      paneHeader({ title: 'Agents' }),
      asideBody);

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
      }, h('span', { class: 'agents__dot', 'data-presence': 'working', 'aria-hidden': 'true' }), workingLabel),
      h('span', { class: 'shell__spacer' }),
      motionButton,
      h('span', { class: 'shell__status-item', 'data-narrow': 'hide' }, icon('coins'), tokensLabel));

    const live = h('div', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });
    root.append(nav, main, aside, live, statusbar);

    /* ------------------------------------------------------------------- Home view -- */

    const greeting = h('h2', { class: 'record-title agents__greeting' }, `Good morning, ${me.name.split(' ')[0]}`);
    const summary = h('p', { class: 'agents__summary' });
    const composerInput = /** @type {HTMLTextAreaElement} */ (h('textarea', {
      class: 'agents__composer-input', rows: 3, 'aria-label': 'Describe a task',
      placeholder: 'Describe a task for your agents…',
      'aria-keyshortcuts': modShortcut('Enter').keys,
      oninput: () => renderRoute()
    }));
    const route = h('span', { class: 'agents__route', 'aria-live': 'polite' });
    const composer = h('form', {
      class: 'agents__composer', 'aria-label': 'New task',
      onsubmit: (event) => {
        event.preventDefault();
        startTask();
      }
    },
    composerInput,
    h('div', { class: 'agents__composer-bar' },
      route,
      h('span', { class: 'shell__spacer' }),
      iconButton('paperclip', 'Attach files', () => notify(unavailable('Attachments'), 'info')),
      button({ label: 'Start task', icon: 'paper-plane', kind: 'primary', size: 'sm', shortcut: modShortcut('Enter', '↵'), onclick: () => startTask() })));
    const chips = h('div', { class: 'agents__chips', role: 'group', 'aria-label': 'Suggestions' },
      SUGGESTIONS.map((suggestion) => h('button', {
        type: 'button', class: 'agents__chip',
        onclick: () => {
          composerInput.value = suggestion.text;
          renderRoute();
          if (!preview) composerInput.focus();
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
      composer,
      chips,
      h('section', { class: 'agents__section' },
        h('div', { class: 'agents__section-head' }, tasksHeading, tasksMeta),
        taskTable.toElement()),
      h('section', { class: 'agents__section' },
        h('div', { class: 'agents__section-head' }, activityHeading),
        activityList));

    /* -------------------------------------------------------------------- chat view -- */

    const chatHead = h('div', { class: 'agents__chat-head' });
    const thread = h('ol', { class: 'agents__thread', role: 'list' });
    const chatInput = /** @type {HTMLTextAreaElement} */ (h('textarea', {
      class: 'agents__chat-input', rows: 1, 'aria-keyshortcuts': 'Enter'
    }));
    const chatComposer = h('form', {
      class: 'agents__chat-composer',
      onsubmit: (event) => {
        event.preventDefault();
        sendChat();
      }
    }, chatInput, iconButton('paper-plane', 'Send', () => sendChat(), { shortcut: { label: '↵', keys: 'Enter' } }));
    chatView.append(chatHead, thread, h('div', { class: 'agents__chat-dock' }, chatComposer));

    /* --------------------------------------------------------------------- overlays -- */

    /** @type {Launcher|null} */
    let palette = null;
    if (!preview) {
      palette = keep(new Launcher(null, {
        shortcut: false, label: 'Commands', scope: root, placeholder: 'Type a command or search',
        onclose: () => refocus()
      }));
    }
    account.on('close', () => refocus());

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
    shortcuts(composerInput, { 'Mod+Enter': () => startTask() }, context);
    // In the chat, Enter sends and Shift+Enter starts a new line.
    chatInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      sendChat();
    });

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
     * to its successor (the element with the same `data-key`), or to the region's heading.
     * @param {HTMLElement} region
     * @param {() => void} draw
     * @returns {void}
     */
    function redraw(region, draw) {
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && region.contains(active);
      const key = inside ? active.closest('[data-key]')?.getAttribute('data-key') : null;
      draw();
      if (!inside || active.isConnected || preview) return;
      const next = key ? region.querySelector(`[data-key="${CSS.escape(key)}"]`) : null;
      if (next instanceof HTMLElement) next.focus({ preventScroll: true });
      else focusHeadingIn(region);
    }

    /**
     * An agent's avatar that moves with its presence. The wrapper carries the motion; the avatar
     * itself is decorative, so the presence is always said in words beside it.
     * @param {(typeof agents)[number]} agent
     * @param {string} where Where it is drawn, so a redrawn avatar continues its motion.
     * @param {{own: <T extends {destroy: () => void}>(component: T) => T}} scope
     * @param {'sm'|'md'|'lg'} [size]
     * @returns {HTMLElement}
     */
    function presenceAvatar(agent, where, scope, size = 'sm') {
      const element = h('span', {
        class: 'agents__presence', 'aria-hidden': 'true',
        dataset: { presence: presenceOf(agent).state, presenceKey: `${where}:${agent.id}` }
      }, scope.own(agentAvatar(agent, size)).toElement());
      motion.track(element);
      return element;
    }

    /** @param {(typeof agents)[number]} agent @param {'sm'|'md'|'lg'} size @returns {Avatar} */
    function agentAvatar(agent, size) {
      return new Avatar(null, { name: agent.name, initials: agent.initial, tone: agent.tone, shape: 'rounded', size });
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

    /** @param {keyof typeof PRESENCE} presence @returns {HTMLElement} A presence dot and its word. */
    function presenceLabel(presence) {
      return h('span', { class: 'agents__state', dataset: { presence } },
        h('span', { class: 'agents__dot', 'data-presence': presence, 'aria-hidden': 'true' }),
        PRESENCE[presence]);
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
        rosterParts.reset();
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
          presenceAvatar(agent, 'roster', rosterParts, 'md'),
          h('span', { class: 'agents__agent-name' }, agent.name),
          presenceLabel(presence.state),
          h('span', { class: 'agents__agent-role' }, agent.role)));
        }));
      });
    }

    /** The inspector: agents by state, then the open run's figures. @returns {void} */
    function renderInspector() {
      redraw(asideBody, () => {
        asideParts.reset();
        const ranked = agents.map((agent) => ({ agent, presence: presenceOf(agent) }));
        const order = Object.keys(PRESENCE);
        ranked.sort((a, b) => order.indexOf(a.presence.state) - order.indexOf(b.presence.state));
        const groups = [
          ['Active', ranked.filter((entry) => !['idle', 'offline'].includes(entry.presence.state))],
          ['Idle', ranked.filter((entry) => entry.presence.state === 'idle')],
          ['Offline', ranked.filter((entry) => entry.presence.state === 'offline')]
        ];
        const task = currentTask();
        const progress = asideParts.own(new ProgressBar(null, {
          value: Math.min(taskTokens(task), 60_000), max: 60_000, label: 'Token budget used', hideLabel: true, showValue: false, size: 'sm'
        }));
        asideBody.replaceChildren(
          ...groups.filter(([, list]) => list.length).map(([label, list]) => h('section', { class: 'agents__group' },
            h('h3', { class: 'list-group agents__group-title' }, label, h('span', { class: 'list-group__count' }, String(list.length))),
            h('ul', { class: 'agents__members', role: 'list' }, list.map(({ agent, presence }) => memberRow(agent, presence))))),
          panelBlock(`Run #${task.run}`, propList([
            ['Task', h('button', { type: 'button', class: 'link-button agents__run-task', 'data-key': 'run-task', onclick: () => openTask(task.id) }, task.title)],
            ['Status', statusText(taskStatus(task))],
            ['Started', clock(task.started, false)],
            ['Elapsed', task.finished !== undefined
              ? h('span', { class: 'agents__num' }, duration(elapsed(task)))
              : ticking(task.started + (task.pausedFor ?? 0), task)],
            ['Tokens', h('div', { class: 'agents__budget' },
              h('span', { class: 'agents__num' }, `${tokenCount(taskTokens(task))} of 60k`), progress.toElement())],
            ['Model', MODELS.find((model) => model.id === state.model)?.label]
          ])));
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
        presenceAvatar(agent, 'aside', asideParts, 'md'),
        h('div', { class: 'agents__member-main' },
          h('div', { class: 'agents__member-top' },
            h('button', {
              type: 'button', class: 'agents__member-name', 'data-key': `member:${agent.id}`,
              title: `Chat with ${agent.name}`, onclick: () => openChat(agent.id)
            }, agent.name),
            presenceLabel(presence.state),
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
        taskView.replaceChildren(
          h('div', { class: 'agents__task-head' },
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
            h('div', { class: 'agents__task-actions' }, pause, chat)),
          h('section', { class: 'agents__section' },
            h('div', { class: 'agents__section-head' },
              h('h3', { class: 'agents__section-title' }, 'Plan'),
              h('span', { class: 'agents__section-meta' }, `${done} of ${task.plan.length} done`)),
            h('ol', { class: 'agents__plan', role: 'list' }, task.plan.map((step, index) => planStep(task, step, index)))),
          h('section', { class: 'agents__section' },
            h('div', { class: 'agents__section-head' },
              h('h3', { class: 'agents__section-title' }, 'Execution log'),
              h('span', { class: 'agents__section-meta' }, `${task.log.length} events · ${tokenCount(taskTokens(task))} tokens`)),
            h('ol', { class: 'agents__log', role: 'list' }, task.log.map((event, index) => logEntry(task, event, index)))));
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

    /**
     * One event in the execution log: a button row that expands to the detail. A hand-off draws
     * both agents joined by a dotted line.
     * @param {AgentTask} task
     * @param {LogEvent} event
     * @param {number} index
     * @returns {HTMLElement}
     */
    function logEntry(task, event, index) {
      const key = `${task.id}:${index}`;
      const open = state.expanded.has(key);
      const who = event.kind === 'handoff' && event.to
        ? h('span', { class: 'agents__handoff' },
          avatarOf(event.actor, taskParts), h('span', { class: 'agents__handoff-line' }), avatarOf(event.to, taskParts))
        : avatarOf(event.actor, taskParts);
      const code = event.call ? `${event.call}(${event.args ?? ''})` : null;
      const metrics = event.running
        ? h('span', { class: 'agents__running' },
          task.paused ? null : spinner({ size: 'sm' }),
          h('span', {}, task.paused ? 'Paused' : 'Running'), ' · ', ticking(event.from ?? event.at, task))
        : [event.ms !== undefined ? callTime(event.ms) : null, event.tokens ? `${tokenCount(event.tokens)} tokens` : null]
          .filter(Boolean).join(' · ');
      const detail = h('div', { class: 'agents__event-detail', hidden: !open },
        h('div', { class: 'agents__event-output' }, (event.detail ?? []).map((line) => h('p', {}, line))),
        h('p', { class: 'agents__event-meta' },
          `${nameOf(event.actor)}${event.to ? ` to ${nameOf(event.to)}` : ''} · ${clock(event.at)}`,
          code ? ` · ${MODELS.find((model) => model.id === state.model)?.label}` : ''),
        event.file ? h('button', {
          type: 'button', class: 'link-button agents__event-file', 'data-key': `event-file:${key}`,
          onclick: () => openFile(event.file ?? '')
        }, `Open ${FILES.find((file) => file.id === event.file)?.name}`) : null);
      const row = h('button', {
        type: 'button', class: 'agents__event-row', 'aria-expanded': String(open), 'data-key': `event:${key}`,
        onclick: () => {
          const next = !state.expanded.has(key);
          if (next) state.expanded.add(key);
          else state.expanded.delete(key);
          row.setAttribute('aria-expanded', String(next));
          detail.hidden = !next;
        }
      },
      h('time', { class: 'agents__event-time', dateTime: clock(event.at) }, clock(event.at)),
      h('span', { class: 'agents__event-who' }, who,
        h('span', { class: 'agents__event-actor' }, nameOf(event.actor))),
      h('span', { class: 'agents__event-action' }, event.action),
      h('span', { class: code ? 'agents__event-args agents__event-args--code' : 'agents__event-args' }, code ?? event.args ?? ''),
      h('span', { class: 'agents__event-metrics' }, metrics),
      h('span', { class: 'agents__event-chevron', 'aria-hidden': 'true' }, icon('chevron-down', { size: 14 })));
      return h('li', { class: 'agents__event', dataset: { kind: event.kind, running: event.running ? 'true' : null } }, row, detail);
    }

    /** The chat with one agent. @returns {void} */
    function renderChat() {
      const agent = agentById(state.chat);
      if (state.open.has('chat')) tabs.setTitle('chat', agent.name);
      chatInput.placeholder = `Message ${agent.name}`;
      chatInput.setAttribute('aria-label', `Message ${agent.name}`);
      chatComposer.setAttribute('aria-label', `Message ${agent.name}`);
      redraw(chatView, () => {
        chatParts.reset();
        const presence = presenceOf(agent);
        chatHead.replaceChildren(
          presenceAvatar(agent, 'chat', chatParts, 'lg'),
          h('div', { class: 'agents__chat-who' },
            h('h2', { class: 'agents__chat-name' }, agent.name),
            h('p', { class: 'agents__chat-meta' }, presenceLabel(presence.state), h('span', {}, `${agent.role} · ${presence.doing}`))));
        const messages = conversation(agent);
        thread.replaceChildren(...messages.map((message, index) => h('li', {
          class: 'agents__message', dataset: { from: message.from === 'me' ? 'me' : 'agent' }
        },
        avatarOf(message.from, chatParts),
        h('div', { class: 'agents__message-body' },
          h('p', { class: 'agents__message-head' },
            h('span', { class: 'agents__strong' }, message.from === 'me' ? me.name : agentById(message.from).name),
            h('time', { class: 'agents__message-time' }, message.at)),
          message.tools ? h('p', { class: 'agents__message-tools' }, message.tools.map((tool) => h('span', { class: 'agents__tool' }, icon('wrench', { size: 12 }), tool))) : null,
          h('p', { class: 'agents__message-text' }, message.text),
          message.file || message.task ? h('p', { class: 'agents__message-links' },
            message.file ? h('button', {
              type: 'button', class: 'agents__file-chip', 'data-key': `chat-file:${index}`, onclick: () => openFile(message.file ?? '')
            }, icon('file-lines', { size: 14 }), FILES.find((file) => file.id === message.file)?.name) : null,
            message.task ? h('button', {
              type: 'button', class: 'agents__file-chip', 'data-key': `chat-task:${index}`, onclick: () => openTask(message.task ?? '')
            }, icon('list-check', { size: 14 }), 'Open the task') : null) : null))),
        ...(state.typing === agent.id ? [h('li', { class: 'agents__message agents__typing', dataset: { from: 'agent' } },
          avatarOf(agent.id, chatParts),
          h('p', { class: 'agents__typing-text' }, `${agent.name} is writing`, h('span', { class: 'agents__typing-dots', 'aria-hidden': 'true' }, h('span'), h('span'), h('span'))))] : []));
      });
    }

    /**
     * The messages with an agent; an agent you have not written to yet greets you first.
     * @param {(typeof agents)[number]} agent
     * @returns {{from: string, at: string, text: string, tools?: string[], file?: string, task?: string}[]}
     */
    function conversation(agent) {
      if (!chats.has(agent.id)) {
        chats.set(agent.id, [{
          from: agent.id, at: clock(state.now, false),
          text: agent.offline ? `I’m offline for now (${agent.away?.toLocaleLowerCase()}). Your messages will wait for me.`
            : `Hello ${me.name.split(' ')[0]}. I’m ${agent.name}, on ${agent.role.toLocaleLowerCase()}. ${presenceOf(agent).doing}.`
        }]);
      }
      return chats.get(agent.id) ?? [];
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
      const text = composerInput.value.trim();
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
      sections.setActive({ home: 'home', task: 'tasks' }[state.tab] ?? null);
      resources.setActive({ chat: 'conversations', file: 'files' }[state.tab] ?? null);
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
      if (changed) state.expanded.clear();
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
      composerInput.focus();
      composerInput.scrollIntoView({ block: 'nearest' });
    }

    /** G A: the roster, opening the navigation wherever it is hidden. @returns {void} */
    function goToRoster() {
      if (root.clientWidth <= SHELL_BREAKPOINTS.nav) shell.openNav();
      else if (root.dataset.navCollapsed === 'true') shell.collapse('nav', false);
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
     * Unblocks the step a task is stuck on.
     * @param {string} id Task id.
     * @returns {void}
     */
    function resolve(id) {
      const task = taskById(id);
      const step = task?.plan.find((entry) => entry.status === 'blocked');
      if (!task || !step) return;
      step.status = 'in-progress';
      step.since = state.now;
      log(task, { actor: 'me', kind: 'decision', action: 'Granted read access to the freight ledger', args: 'role: "ledger-reader"' });
      const running = task.log.findLast((event) => event.actor === step.agent && event.kind === 'block');
      log(task, { actor: step.agent, kind: 'tool', action: 'Matching against the ledger', call: 'match_ledger', args: running?.args ?? 'invoices: 240', running: true });
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
        action: { label: 'Resolve', onclick: () => resolve(task.id) },
        timeout: 12000
      });
    }

    /** A toast for a decision an agent waits on. @param {AgentTask} task @returns {void} */
    function requestApproval(task) {
      const step = task.plan.find((entry) => entry.status === 'waiting');
      if (!step?.approval) return;
      const from = agentById(step.approval.from);
      notify(`${from.name}: ${step.approval.ask}`, 'info', {
        leading: keep(agentAvatar(from, 'sm')).toElement(),
        action: { label: 'Approve', onclick: () => approve(task.id) },
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
        for (const event of task.log) if (event.running) event.from = (event.from ?? event.at) + state.now - (task.pausedAt ?? state.now);
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
        log(task, { actor: 'me', kind: 'decision', action: 'Paused the run' });
      }
      announce(task.paused ? `${task.title} is paused.` : `${task.title} is running again.`);
      refresh();
    }

    /** Starts a task from the composer, routed to the agent that fits. @returns {void} */
    function startTask() {
      const text = composerInput.value.trim();
      if (!text) {
        notify('Describe the task first.', 'warning');
        if (!preview) composerInput.focus();
        return;
      }
      const agent = agentById(routeFor(text) ?? 'orbit');
      createTask(titleFrom(text), agent, 'Inbox');
      composerInput.value = '';
      renderRoute();
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
     * @returns {AgentTask}
     */
    function createTask(title, agent, project) {
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
      log(task, { actor: 'orbit', kind: 'tool', action: 'Planned the task', call: 'plan', args: 'steps: 3', ms: 1800, tokens: 940, detail: ['Three steps: the work, then a review.'] });
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

    /** Sends a message to the agent the chat is with. @returns {void} */
    function sendChat() {
      const text = chatInput.value.trim();
      if (!text) return;
      const agent = agentById(state.chat);
      const messages = conversation(agent);
      messages.push({ from: 'me', at: clock(state.now, false), text });
      chatInput.value = '';
      const presence = presenceOf(agent);
      if (agent.offline) {
        renderChat();
        return;
      }
      state.typing = agent.id;
      renderChat();
      thread.lastElementChild?.scrollIntoView({ block: 'nearest' });
      if (preview) return;
      later(context, () => {
        if (state.typing === agent.id) state.typing = null;
        messages.push({
          from: agent.id, at: clock(state.now, false),
          text: presence.task ? `Noted. I’ll take that into “${presence.task.title}”.` : 'Noted. Send me a task whenever you’re ready.'
        });
        if (state.chat === agent.id) {
          renderChat();
          thread.lastElementChild?.scrollIntoView({ block: 'nearest' });
          announce(`${agent.name} replied.`);
        }
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
