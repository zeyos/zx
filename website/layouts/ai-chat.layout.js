import {
  ContextMenu, CopyInput, Dialog, FileList, InlineLoading, Launcher,
  MenuButton, NumberField, ProgressBar, Select, Slider, Toggle, Tooltip, appIcon, badge, button,
  copyButton, downloadBlob, emptyState, formatDate, formatFileSize, formatNumber, formatPercent, h,
  icon, prefersReducedMotion, rovingTabindex, spinner, stack, uid, watchMotion
} from '../../src/index.js';
import {
  DATE, SHELL_BREAKPOINTS, adaptiveShell, disposer, iconButton, iconTile, later, layoutContext, listTime,
  paneHeader, renderScope, shortcutSheet, shortcuts, suiteNav, toaster
} from './kit.js';
import { ME, NOW, ORGANISATION, person } from './fixtures.js';

/**
 * An assistant answer is a small document model, not HTML. Model output is untrusted text, so it is
 * rendered block by block with `h()` and never reaches `innerHTML`. Inside a text run, `**bold**`
 * and `` `code` `` are the only markup. An `artifact` block is a card that opens a document or a
 * piece of code the assistant wrote in the inspector.
 * @typedef {{type: 'p'|'quote', text: string}
 *   | {type: 'heading', level: 2|3, text: string}
 *   | {type: 'list', ordered: boolean, items: string[]}
 *   | {type: 'code', language: string, code: string}
 *   | {type: 'table', columns: string[], rows: string[][], align?: Array<'start'|'end'>}
 *   | {type: 'artifact', id: string, title: string}} Block
 * @typedef {{name: string, size: number, mime: string}} Attachment
 * One thing the assistant did before it answered: what it was (`label`, and `doing` while it runs),
 * a muted detail, how long it took, and for a web search how many sources it looked at.
 * @typedef {'search'|'read'|'query'|'write'|'run'} StepKind
 * @typedef {{kind: StepKind, label: string, doing: string, detail?: string, ms: number,
 *   sources?: number, target?: string, stopped?: boolean}} Step
 * A source an answer drew on: a web page, or a file the chat knows.
 * @typedef {{title: string, site: string, url: string, snippet: string, file?: boolean}} Source
 * What the assistant will do for one answer: its steps, the answer, and the sources it cites.
 * @typedef {{blocks: Block[], steps?: Step[], sources?: Source[]}} Plan
 * One version of an answer; regenerating keeps the earlier ones.
 * @typedef {{blocks: Block[], steps: Step[], sources: Source[], at: string, model?: string,
 *   agent?: string, rating: 'up'|'down'|null, stopped: boolean}} AnswerVersion
 * A message's `at` and a chat's `updated` are local date-times (`2026-10-08T09:41`); the screen
 * derives every time, weekday, and day heading from them.
 * @typedef {{id?: string, role: 'user'|'assistant', at: string, text?: string,
 *   files?: Attachment[], blocks?: Block[], model?: string, agent?: string,
 *   rating?: 'up'|'down'|null, stopped?: boolean, steps?: Step[], sources?: Source[],
 *   versions?: AnswerVersion[], version?: number, retry?: Plan}} ChatMessage
 * @typedef {{id: string, name: string, size: number, mime: string, tokens: number}} KnowledgeFile
 * @typedef {{system: string, temperature: number, maxTokens: number,
 *   tools: Record<string, boolean>, files: KnowledgeFile[]}} ChatSettings
 * A chat started from a point in another one: the chat it came from and how many of its messages
 * it took along.
 * @typedef {{id: string, title: string, after: number}} BranchOrigin
 * @typedef {{id: string, title: string, folder: string|null, model: string, updated: string,
 *   pinned?: boolean, archived?: boolean, settings: Partial<ChatSettings>, reply?: Plan,
 *   branchOf?: BranchOrigin, messages: ChatMessage[]}} Chat
 * A document or a piece of code the assistant wrote, kept with every version it went through. A
 * code version is source text; a document version is blocks.
 * @typedef {{at: string, note: string, content: string|Block[]}} ArtifactVersion
 * @typedef {{id: string, chat: string, title: string, kind: 'code'|'document', language?: string,
 *   versions: ArtifactVersion[]}} Artifact
 * An agent of the workspace, called into a chat with `@handle` — its `id`.
 * @typedef {{id: string, name: string, description: string, icon: string,
 *   tone: 'blue'|'teal'|'violet'|'amber'|'pink'}} Agent
 */

/** @param {string} text @returns {Block} A paragraph. */
function p(text) { return { type: 'p', text }; }
/**
 * @param {string} text @param {2|3} [level] A section (`##`) or a subsection (`###`).
 * @returns {Block} A heading inside an answer.
 */
function heading(text, level = 2) { return { type: 'heading', level, text }; }
/** @param {string} text Paragraphs separated by a blank line. @returns {Block} A quoted draft. */
function quote(text) { return { type: 'quote', text }; }
/** @param {string[]} items @param {boolean} [ordered] @returns {Block} A bulleted or numbered list. */
function list(items, ordered = false) { return { type: 'list', ordered, items }; }
/** @param {string} language @param {string} source @returns {Block} A code block with a copy button. */
function code(language, source) { return { type: 'code', language, code: source }; }
/**
 * @param {string[]} columns @param {string[][]} rows @param {Array<'start'|'end'>} [align]
 * @returns {Block} A table; `align` right-aligns numeric columns.
 */
function table(columns, rows, align) { return { type: 'table', columns, rows, align }; }
/** @param {string} id @param {string} title @returns {Block} A card that opens an artifact. */
function artifact(id, title) { return { type: 'artifact', id, title }; }

/**
 * @param {StepKind} kind @param {string} label @param {string} doing @param {string} detail
 * @param {number} ms @param {Partial<Step>} [extra]
 * @returns {Step}
 */
function step(kind, label, doing, detail, ms, extra = {}) { return { kind, label, doing, detail, ms, ...extra }; }
/** @param {string} query @param {number} sources @param {number} ms @returns {Step} A web search. */
function searched(query, sources, ms) {
  return step('search', 'Searched the web', 'Searching the web', `“${query}”`, ms, { sources });
}
/** @param {string} name @param {string} detail @param {number} ms @returns {Step} A file read. */
function readFile(name, detail, ms) { return step('read', `Read ${name}`, `Reading ${name}`, detail, ms); }
/** @param {string} detail @param {number} ms @returns {Step} A query against data. */
function queried(detail, ms) { return step('query', 'Ran a query', 'Running a query', detail, ms); }
/**
 * @param {string} label @param {string} doing @param {string} detail @param {number} ms
 * @returns {Step} A draft written or revised.
 */
function wrote(label, doing, detail, ms) { return step('write', label, doing, detail, ms); }
/** @param {string} what @param {string} detail @param {number} ms @returns {Step} Code or tests run. */
function ran(what, detail, ms) { return step('run', `Ran ${what}`, `Running ${what}`, detail, ms, { target: what }); }

/** The glyph each kind of step is drawn with. */
const STEP_ICONS = { search: 'globe', read: 'file-lines', query: 'database', write: 'pen-to-square', run: 'terminal' };

/** The models the workspace can talk to. Every name is fictional. */
const MODELS = [
  { ID: 'halden-3', name: 'Halden 3', description: 'Balanced for everyday work', icon: 'wand-magic-sparkles', context: 200_000 },
  { ID: 'halden-3-swift', name: 'Halden 3 Swift', description: 'Fastest answers', icon: 'bolt', context: 128_000 },
  { ID: 'halden-3-deep', name: 'Halden 3 Deep', description: 'Reasons step by step first', icon: 'lightbulb', context: 200_000 },
  { ID: 'ferro-8b', name: 'Ferro 8B', description: 'Runs on ACME servers', icon: 'server', context: 32_000 }
];

/**
 * The workspace's agents, offered when the composer's text starts a word with "@".
 * @type {Agent[]}
 */
const AGENTS = [
  { id: 'research', name: 'Research', description: 'Searches the web and the chat’s files', icon: 'globe', tone: 'blue' },
  { id: 'analyst', name: 'Analyst', description: 'Queries warehouse and finance data', icon: 'chart-column', tone: 'teal' },
  { id: 'engineer', name: 'Engineer', description: 'Writes code and runs it in a sandbox', icon: 'code', tone: 'violet' },
  { id: 'writer', name: 'Writer', description: 'Drafts replies, notes, and documents', icon: 'pen', tone: 'amber' },
  { id: 'support', name: 'Support', description: 'Knows every customer ticket', icon: 'comments', tone: 'pink' }
];

/**
 * What each agent does before it answers, given the topic of the question.
 * @type {Record<string, (topic: string) => Step[]>}
 */
const AGENT_WORK = {
  research: (topic) => [searched(topic, 9, 2300), readFile('the knowledge files', 'Three passages', 700)],
  analyst: () => [queried('Warehouse costs by site, last two quarters', 1600), ran('a variance check', 'Two sites moved more than 5%', 900)],
  engineer: () => [wrote('Wrote a script', 'Writing a script', 'v1 · 24 lines', 1300), ran('the script', 'Finished in 0.4s', 1800)],
  writer: () => [readFile('house-style.md', 'Tone and sign-off', 500), wrote('Drafted a reply', 'Drafting a reply', '180 words', 1400)],
  support: () => [readFile('the ticket history', '14 tickets in the last 90 days', 900)]
};

/**
 * Answers an agent gives in its own words; the others answer with the generic first pass.
 * @type {Record<string, Block[]>}
 */
const AGENT_REPLIES = {
  analyst: [
    p('**Munich** grew fastest: its warehouse costs rose 17.5% on Q2, to €139,700.'),
    table(['Site', 'Q3', 'Change on Q2'], [
      ['Munich', '€139,700', '+17.5%'],
      ['Rotterdam', '€48,600', '+8.7%'],
      ['Berlin', '€131,200', '+2.2%'],
      ['Hamburg', '€93,100', '−1.3%']
    ], ['start', 'end', 'end']),
    p('Most of Munich’s increase is the second shift for the Bruckner Logistik contract. Rotterdam is the other site outside ±5%, after the new handling rate in July.')
  ]
};

/** Folders a chat can be filed under. */
const FOLDERS = [
  { id: 'customers', label: 'Customer accounts' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'finance', label: 'Finance' }
];

/** Tools the assistant may call, switched per chat. */
const TOOLS = [
  { id: 'web', label: 'Web search', description: 'Look things up on the public web', icon: 'globe' },
  { id: 'code', label: 'Code execution', description: 'Run Python in a sandbox', icon: 'terminal' }
];

/** Saved prompts, offered by the composer's Prompts menu and by typing "/". */
const PROMPTS = [
  { value: 'summary', label: 'Summarise for a manager', description: 'Five bullets with owners and dates', text: 'Summarise the following for a manager in five bullets, with owners and due dates:\n\n' },
  { value: 'reply', label: 'Draft a customer reply', description: 'Friendly, short, one next step', text: 'Draft a short, friendly reply to this customer with one clear next step:\n\n' },
  { value: 'sql', label: 'Explain this query', description: 'What it does and how to speed it up', text: 'Explain what this SQL query does and how to make it faster:\n\n' },
  { value: 'actions', label: 'Turn notes into actions', description: 'Decisions, owners, open questions', text: 'Turn these meeting notes into decisions, action items with owners, and open questions:\n\n' }
];

/** Conversation starters on an empty chat. */
const SUGGESTIONS = [
  { title: 'Summarise escalations', text: 'Summarise this week’s customer escalations for the Monday operations review.' },
  { title: 'Draft a reply', text: 'Draft a friendly reply to Meridian Health asking to move our call to Tuesday.' },
  { title: 'Explain a concept', text: 'Explain what a LEFT JOIN does, with a short example.' },
  { title: 'Ask the analyst', text: '@analyst Which warehouse site’s costs grew fastest this quarter?' }
];

/** Settings a new chat starts with. */
const DEFAULT_SETTINGS = {
  system: 'You are ACME’s assistant. Answer concisely in British English, and say so when you are unsure.',
  temperature: 0.7,
  maxTokens: 4096,
  tools: { web: true, code: false },
  files: []
};

/**
 * Pages and files the answers cite. Every site is fictional.
 * @type {Record<string, Source>}
 */
const SOURCES = {
  'status-429': {
    title: '429 Too Many Requests', site: 'http-reference.example', url: 'https://http-reference.example/status/429',
    snippet: 'The server turned the request away because the client sent too many in a short time. Nothing was processed, so the request is safe to repeat later.'
  },
  'retry-after': {
    title: 'Retry-After', site: 'http-reference.example', url: 'https://http-reference.example/headers/retry-after',
    snippet: 'Tells a client how long to wait before trying again, as a number of seconds or a date. Servers send it with 429 and 503 responses.'
  },
  jitter: {
    title: 'Backoff with jitter', site: 'systems-notes.example', url: 'https://systems-notes.example/backoff-with-jitter',
    snippet: 'A random spread on each wait stops a fleet of clients from retrying in lockstep and arriving at the server all at once.'
  },
  'acme-limits': {
    title: 'Rate limits and quotas', site: 'docs.acme.example', url: 'https://docs.acme.example/api/rate-limits',
    snippet: 'Limits apply per API key and are shared by every integration that uses it. Each response reports what is left in X-RateLimit-Remaining.'
  },
  'limits-pdf': {
    title: 'api-rate-limits.pdf', site: 'Knowledge file', url: 'https://chat.acme.example/files/api-rate-limits.pdf',
    snippet: 'Team: 300 requests a minute per key, burst 50. Below Business, scheduled jobs share the key’s budget.', file: true
  },
  'export-log': {
    title: 'kestrel-export-log.csv', site: 'Knowledge file', url: 'https://chat.acme.example/files/kestrel-export-log.csv',
    snippet: '412 responses with status 429 between 02:00 and 02:14 on 7 October, and none outside the backup window.', file: true
  },
  'alpine-contract': {
    title: 'alpine-works-contract-2025.pdf', site: 'Knowledge file', url: 'https://chat.acme.example/files/alpine-works-contract-2025.pdf',
    snippet: 'Section 7: the extended SLA lists at €3,400 a year; customers on a multi-year agreement receive 15% off.', file: true
  },
  'q3-costs': {
    title: 'q3-warehouse-costs.csv', site: 'Knowledge file', url: 'https://chat.acme.example/files/q3-warehouse-costs.csv',
    snippet: 'Cost lines for Berlin, Munich, Hamburg, and Rotterdam, April to September, by category.', file: true
  },
  findings: {
    title: 'findings.md', site: 'Attached by Camille Fournier', url: 'https://chat.acme.example/files/findings.md',
    snippet: 'The cursor was capped at a 10,000-row offset, so the next page started again from the first row. Fixed in 4.12.1.', file: true
  },
  'one-pager': {
    title: 'Writing a one-pager people read', site: 'writing-desk.example', url: 'https://writing-desk.example/one-pagers',
    snippet: 'Lead with the decision you need, then the context. One page gets read before the meeting; three get skimmed during it.'
  },
  'short-updates': {
    title: 'Short updates that get answered', site: 'team-practices.example', url: 'https://team-practices.example/short-updates',
    snippet: 'Name the audience, say what changed, and end on one clear next step.'
  }
};

/** @param {...string} ids @returns {Source[]} The sources with those ids, for an answer to cite. */
function cite(...ids) { return ids.map((id) => SOURCES[id]); }

/** The first draft of the retry helper, before the tests caught the missing 503. */
const RETRY_V1 = [
  'async function fetchWithRetry(url, options = {}, attempts = 5) {',
  '  for (let attempt = 0; attempt < attempts; attempt += 1) {',
  '    const response = await fetch(url, options);',
  '    if (response.status !== 429) return response;',
  '',
  '    const retryAfter = Number(response.headers.get(\'Retry-After\'));',
  '    const delay = retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 500;',
  '    await new Promise((resolve) => setTimeout(resolve, delay));',
  '  }',
  '  throw new Error(`Gave up on ${url} after ${attempts} attempts`);',
  '}'
].join('\n');

/** The helper as the answer delivered it. */
const RETRY_V2 = [
  'async function fetchWithRetry(url, options = {}, attempts = 5) {',
  '  for (let attempt = 0; attempt < attempts; attempt += 1) {',
  '    const response = await fetch(url, options);',
  '    // Only "too many requests" and "unavailable" are worth another try.',
  '    if (response.status !== 429 && response.status !== 503) return response;',
  '',
  '    const retryAfter = Number(response.headers.get(\'Retry-After\'));',
  '    const backoff = Math.min(30_000, 2 ** attempt * 500);',
  '    const delay = retryAfter > 0 ? retryAfter * 1000 : backoff + Math.random() * 250;',
  '    await new Promise((resolve) => setTimeout(resolve, delay));',
  '  }',
  '  throw new Error(`Gave up on ${url} after ${attempts} attempts`);',
  '}'
].join('\n');

/**
 * What the assistant wrote in the chats, each with its versions.
 * @type {Artifact[]}
 */
const ARTIFACTS = [
  {
    id: 'retry-helper', chat: 'export-limits', title: 'retry-helper.js', kind: 'code', language: 'javascript',
    versions: [
      { at: '2026-10-08T09:40', note: 'First draft', content: RETRY_V1 },
      { at: '2026-10-08T09:41', note: 'Retries 503 too, with jitter', content: RETRY_V2 }
    ]
  },
  {
    id: 'alpine-reply', chat: 'alpine-renewal', title: 'Renewal reply to Alpine Works', kind: 'document',
    versions: [
      {
        at: '2026-10-08T08:14', note: 'First draft',
        content: [
          p('Hi Hannah,'),
          p('Thank you for your note. We can keep your current rate of €18,400 a year for another twelve months.'),
          p('We are not able to include the extended SLA at no cost. It is available as a separate tier at €3,400 a year.'),
          p('Best regards,\nNadine')
        ]
      },
      {
        at: '2026-10-08T08:15', note: 'The SLA as an offer, at 15% off',
        content: [
          p('Hi Hannah,'),
          p('Thank you for the update on the renewal. We are happy to hold your current rate of €18,400 a year for another twelve months.'),
          p('The extended SLA is a separate tier. As a multi-year customer you would get it at €2,900 a year instead of €3,400 — I have attached the details so you can compare it with your current cover.'),
          p('Best regards,\nNadine')
        ]
      }
    ]
  }
];

/** The answer streamed into a chat that has no scripted follow-up of its own. */
const GENERIC_REPLY = [
  p('Happy to help. Here is a first pass — tell me what to change and I will tighten it:'),
  list([
    '**Goal** — what this should achieve, in one sentence.',
    '**Audience** — who reads it and what they already know.',
    '**Next step** — the one thing you want them to do afterwards.'
  ]),
  table(['Format', 'Effort', 'Best for'], [
    ['Short note', '10 min', 'Internal updates'],
    ['One-pager', '1 hour', 'Decisions'],
    ['Workshop', 'Half a day', 'Open questions']
  ]),
  p('Paste the details and I will draft the full version.')
];

/** The signed-in user's chat history. */
const CHATS = [
  {
    id: 'export-limits', title: 'Nightly export hits the rate limit', folder: 'engineering',
    model: 'halden-3', updated: '2026-10-08T09:41',
    settings: {
      system: 'You are an integration engineer at ACME. Prefer short answers with working code, and cite the API reference in the knowledge files.',
      temperature: 0.3,
      tools: { web: true, code: true },
      files: [
        { id: 'api-limits', name: 'api-rate-limits.pdf', size: 1_248_000, mime: 'application/pdf', tokens: 18_400 },
        { id: 'export-log', name: 'kestrel-export-log.csv', size: 312_400, mime: 'text/csv', tokens: 6_200 }
      ]
    },
    messages: [
      { role: 'user', at: '2026-10-08T09:12', text: 'Kestrel’s nightly export keeps failing with 429 errors around 02:00. Owen says they page through 40,000 records. What is going on?' },
      {
        role: 'assistant', at: '2026-10-08T09:12', rating: 'up',
        steps: [
          readFile('api-rate-limits.pdf', 'Rate limits and error codes, pages 4–5', 700),
          queried('kestrel-export-log.csv — 429 responses per minute, 01:50 to 02:20', 1400),
          searched('429 too many requests retry-after', 8, 1900)
        ],
        sources: cite('limits-pdf', 'export-log', 'status-429', 'acme-limits'),
        blocks: [
          p('The export is running into the **per-key rate limit**, not a server fault. A 429 means the API refused the request before doing any work, so nothing is lost — the job just stops early.'),
          p('Three things make 02:00 the worst moment for Kestrel:'),
          list([
            'Their job requests pages of `100` records, so 40,000 records take 400 calls in a few minutes.',
            'Their plan allows **300 requests per minute**, shared with every other integration on the same key.',
            'Our nightly backup also runs at 02:00 and slows responses, so their client retries at once and burns more quota.'
          ]),
          p('The quickest fix is on their side: honour the `Retry-After` header and back off. Raising their ceiling for scheduled jobs is the second lever.')
        ]
      },
      { role: 'user', at: '2026-10-08T09:38', text: 'Can you write a retry helper they can drop in, and show the limits per plan so Owen can quote them?' },
      {
        role: 'assistant', at: '2026-10-08T09:41',
        steps: [
          searched('retry-after backoff with jitter', 12, 2100),
          readFile('api-rate-limits.pdf', 'Plans and limits, page 7', 600),
          wrote('Wrote retry-helper.js', 'Writing retry-helper.js', 'v1 · 11 lines', 1400),
          ran('the tests', '5 passed, 1 failed: a 503 was not retried', 3200),
          wrote('Revised retry-helper.js', 'Revising retry-helper.js', 'v2 · retries 503 too, with jitter', 900),
          ran('the tests', '6 passed', 3100)
        ],
        sources: cite('retry-after', 'jitter', 'limits-pdf', 'acme-limits'),
        blocks: [
          p('Here is a small helper they can drop in. It retries only on 429 and 503, waits for `Retry-After` when the API sends it, and otherwise backs off exponentially with a little jitter. My first draft missed the 503 case; the tests caught it, so this is the second version:'),
          artifact('retry-helper', 'retry-helper.js'),
          p('And the limits Owen can quote. Scheduled jobs get a budget of their own from Business upwards, so moving Kestrel up a tier would also solve this:'),
          table(['Plan', 'Requests / min', 'Scheduled jobs', 'Burst'], [
            ['Starter', '120', 'Shared', '20'],
            ['Team', '300', 'Shared', '50'],
            ['Business', '600', '1,200 / min', '100'],
            ['Enterprise', '2,000', '5,000 / min', '400']
          ], ['start', 'end', 'end', 'end']),
          p('Kestrel is on **Team** today. With pages of `500` and the helper above, the export needs about 80 calls — well inside the limit even while the backup runs.')
        ],
        // What "Regenerate" writes in its place: the same facts, said more briefly.
        retry: {
          steps: [
            readFile('api-rate-limits.pdf', 'Plans and limits, page 7', 500),
            ran('the tests', '6 passed', 2900)
          ],
          sources: cite('limits-pdf', 'retry-after'),
          blocks: [
            p('A shorter take. The helper is unchanged — it retries on 429 and 503, honours `Retry-After`, and passes all six tests:'),
            artifact('retry-helper', 'retry-helper.js'),
            p('The limits per plan, for Owen:'),
            list([
              '**Starter** — 120 requests a minute, burst 20.',
              '**Team** — 300 a minute, burst 50. Kestrel is here today.',
              '**Business** — 600 a minute, plus 1,200 a minute for scheduled jobs.',
              '**Enterprise** — 2,000 a minute, plus 5,000 a minute for scheduled jobs.'
            ]),
            p('Moving Kestrel to **Business** gives their export a budget of its own.')
          ]
        }
      }
    ],
    reply: {
      steps: [
        queried('kestrel-export-log.csv — calls per minute while the backup runs', 1200),
        readFile('api-rate-limits.pdf', 'Scheduled-job budgets, page 8', 500)
      ],
      sources: cite('export-log', 'limits-pdf'),
      blocks: [
        p('Here is how I would sequence it, smallest change first:'),
        list([
          '**Today** — Owen sends Kestrel the helper and asks them to raise the page size to `500`.',
          '**This week** — move our backup from 02:00 to 04:30 so it no longer overlaps their export.',
          '**At renewal** — offer the Business tier; its scheduled-job budget removes the problem for good.'
        ], true),
        p('To check the change from their network, time one page at 02:00:'),
        code('bash', [
          'curl -s -o /dev/null -w "%{http_code} %{time_total}s\\n" \\',
          '  -H "Authorization: Bearer $ACME_TOKEN" \\',
          '  "https://api.acme.example/v2/records?limit=500"'
        ].join('\n')),
        p('A `200` in under a second means the fix worked.')
      ]
    }
  },
  {
    id: 'alpine-renewal', title: 'Renewal terms for Alpine Works', folder: 'customers',
    model: 'halden-3', updated: '2026-10-08T08:15',
    settings: {
      tools: { web: false, code: false },
      files: [{ id: 'alpine-contract', name: 'alpine-works-contract-2025.pdf', size: 842_000, mime: 'application/pdf', tokens: 9_800 }]
    },
    messages: [
      { role: 'user', at: '2026-10-08T08:11', text: 'Hannah Egger at Alpine Works wants to keep this year’s rate for another twelve months and get the extended SLA bundled in. Draft a reply: yes to the rate, no to a free SLA.' },
      {
        role: 'assistant', at: '2026-10-08T08:15',
        steps: [
          readFile('alpine-works-contract-2025.pdf', 'Renewal terms and the extended SLA, section 7', 900),
          wrote('Drafted the reply', 'Drafting the reply', 'v1 · a plain yes and no', 1600),
          wrote('Revised the reply', 'Revising the reply', 'v2 · the SLA as an offer, at 15% off', 1200)
        ],
        sources: cite('alpine-contract'),
        blocks: [
          p('Here is a draft that keeps the door open on the SLA without giving it away:'),
          artifact('alpine-reply', 'Renewal reply to Alpine Works'),
          p('What I changed from your notes:'),
          list([
            'Led with the yes, so the SLA reads as an offer rather than a refusal.',
            'Quoted the SLA with the **15% multi-year discount** instead of the list price.',
            'Signed it from Nadine, since she owns the account.'
          ])
        ]
      }
    ]
  },
  {
    id: 'q3-warehouse', title: 'Q3 warehouse cost summary', folder: 'finance',
    model: 'halden-3-deep', updated: '2026-10-07T16:20',
    settings: {
      temperature: 0.2,
      tools: { web: false, code: true },
      files: [{ id: 'q3-costs', name: 'q3-warehouse-costs.csv', size: 48_213, mime: 'text/csv', tokens: 5_400 }]
    },
    messages: [
      { role: 'user', at: '2026-10-07T16:12', text: 'Summarise Q3 warehouse costs by site and tell me what moved.', files: [{ name: 'q3-warehouse-costs.csv', size: 48_213, mime: 'text/csv' }] },
      {
        role: 'assistant', at: '2026-10-07T16:20',
        steps: [
          readFile('q3-warehouse-costs.csv', '1,284 cost lines across four sites', 800),
          queried('Cost by site, Q2 against Q3', 1600),
          queried('Munich by cost type, July to September', 1100)
        ],
        sources: cite('q3-costs'),
        blocks: [
          p('Q3 warehouse costs came to **€412,600**, up 6.8% on Q2. Almost all of the increase is in Munich.'),
          table(['Site', 'Q2', 'Q3', 'Change'], [
            ['Berlin', '€128,400', '€131,200', '+2.2%'],
            ['Munich', '€118,900', '€139,700', '+17.5%'],
            ['Hamburg', '€94,300', '€93,100', '−1.3%'],
            ['Rotterdam', '€44,700', '€48,600', '+8.7%']
          ], ['start', 'end', 'end', 'end']),
          p('What moved:'),
          list([
            'Munich added a second shift in August for the Bruckner Logistik contract; overtime alone was €14,200.',
            'Rotterdam’s handling rate rose on 1 July under the new Northstar Freight terms.',
            'Hamburg is flat — the new racking paid for itself in fewer picking errors.'
          ]),
          p('If you like, I can split Munich by cost type so Ruth can check the overtime before the month-end close.')
        ]
      }
    ]
  },
  {
    id: 'office-move', title: 'Make the office move note friendlier', folder: null,
    model: 'halden-3-swift', updated: '2026-10-07T11:02', settings: {},
    messages: [
      { role: 'user', at: '2026-10-07T11:01', text: 'Make this friendlier: “The Berlin office moves to Lindenstraße 14 on 2 November. Desks must be cleared by 30 October. Late items will be discarded.”' },
      {
        role: 'assistant', at: '2026-10-07T11:02', blocks: [
          p('Here is a warmer version that keeps both dates:'),
          quote('We are moving! From 2 November, the Berlin office is at Lindenstraße 14.\n\nPlease clear your desk by Friday 30 October — anything left after that cannot come with us, so take a last look in the drawers. Boxes are waiting by the kitchen.'),
          p('I dropped “discarded”: it reads as a threat, and the line about boxes tells people what to do instead.')
        ]
      }
    ]
  },
  {
    id: 'northstar-onboarding', title: 'Onboarding plan for Northstar Freight', folder: 'customers',
    model: 'halden-3', updated: '2026-10-05T14:30', settings: {},
    messages: [
      { role: 'user', at: '2026-10-05T14:26', text: 'Daan de Vries at Northstar Freight signs on Friday. Give me a four-week onboarding plan.' },
      {
        role: 'assistant', at: '2026-10-05T14:30', blocks: [
          p('A four-week plan that gets Northstar’s dispatchers live before their peak season:'),
          list([
            '**Week 1** — kick-off with Daan, export from their current system, accounts for twelve dispatchers.',
            '**Week 2** — import and check two years of shipment history; Nadine runs the admin training.',
            '**Week 3** — pilot at the Rotterdam depot with live orders and a daily fifteen-minute check-in.',
            '**Week 4** — every depot live, the old system read-only, handover to support.'
          ], true),
          p('Shall I turn this into tasks for Nadine and Piet?')
        ]
      }
    ]
  },
  {
    id: 'pagination-postmortem', title: 'Postmortem: reporting API pagination', folder: 'engineering',
    model: 'halden-3-deep', updated: '2026-10-02T10:10', pinned: true, settings: { temperature: 0.2 },
    messages: [
      { role: 'user', at: '2026-10-02T10:04', text: 'Turn Camille’s notes into a short postmortem: the reporting API reset its cursor after 10,000 rows, two customers got duplicate rows, fixed in 4.12.1.' },
      {
        role: 'assistant', at: '2026-10-02T10:10',
        steps: [
          readFile('findings.md', 'Camille’s incident notes', 600),
          queried('Reporting API logs — duplicate rows by customer, 24 to 30 September', 1700)
        ],
        sources: cite('findings'),
        blocks: [
          heading('Summary'),
          p('Between 24 and 30 September the reporting API returned duplicate rows to clients that paged past 10,000 results. Two customers were affected; no data was lost or changed.'),
          heading('Root cause'),
          p('The cursor encoded a row offset capped at 10,000, so the next page silently started again from the beginning.'),
          heading('Follow-ups'),
          list([
            'The cursor now encodes the last row’s ID — shipped in 4.12.1.',
            'A contract test for result sets above 50,000 rows — Camille, 16 October.',
            'Email Kestrel Analytics and Danube Systems with the fix and a re-export script — Owen, today.'
          ])
        ]
      }
    ]
  },
  {
    id: 'overdue-sql', title: 'SQL for overdue invoices by customer', folder: 'finance',
    model: 'ferro-8b', updated: '2026-09-28T15:45', settings: { temperature: 0.1 },
    messages: [
      { role: 'user', at: '2026-09-28T15:44', text: 'SQL for invoices more than 30 days overdue, grouped by customer, largest balance first.' },
      {
        role: 'assistant', at: '2026-09-28T15:45', blocks: [
          p('This assumes the usual `invoices` and `customers` tables; the date arithmetic is PostgreSQL:'),
          code('sql', [
            'SELECT c.name AS customer,',
            '       COUNT(*) AS invoices,',
            '       SUM(i.amount_due) AS overdue',
            'FROM invoices AS i',
            'JOIN customers AS c ON c.id = i.customer_id',
            'WHERE i.status = \'open\'',
            '  AND i.due_date < CURRENT_DATE - INTERVAL \'30 days\'',
            'GROUP BY c.name',
            'ORDER BY overdue DESC;'
          ].join('\n')),
          p('Add `HAVING SUM(i.amount_due) > 1000` if Ruth only wants the balances worth a phone call.')
        ]
      }
    ]
  },
  {
    id: 'ops-review', title: 'Weekly operations review agenda', folder: null,
    model: 'halden-3', updated: '2026-09-14T08:05', pinned: true, settings: {},
    messages: [
      { role: 'user', at: '2026-09-14T08:04', text: 'Agenda template for the Monday operations review, 45 minutes.' },
      {
        role: 'assistant', at: '2026-09-14T08:05', blocks: [
          p('A 45-minute agenda that leaves time for decisions:'),
          table(['Item', 'Owner', 'Minutes'], [
            ['Last week’s numbers', 'Ruth', '10'],
            ['Customer escalations', 'Nadine', '10'],
            ['Warehouse and delivery', 'Lea', '10'],
            ['Infrastructure and incidents', 'Jonas', '10'],
            ['Decisions and owners', 'Ines', '5']
          ], ['start', 'start', 'end']),
          p('Send the numbers round on Friday, so the first ten minutes are questions rather than reading.')
        ]
      }
    ]
  },
  {
    id: 'lyon-visit', title: 'Day trip to Helios Energie in Lyon', folder: 'customers',
    model: 'halden-3-swift', updated: '2026-08-28T17:20', archived: true, settings: {},
    messages: [
      { role: 'user', at: '2026-08-28T17:19', text: 'Plan a one-day visit to Helios Energie in Lyon for Tobias and me.' },
      {
        role: 'assistant', at: '2026-08-28T17:20', blocks: [
          p('A day that fits in one return flight:'),
          list([
            '**08:05** — flight from Berlin, landing at 09:55.',
            '**11:00** — site tour with Élise Martin.',
            '**13:00** — lunch and the pricing review.',
            '**17:40** — flight back, home by 19:35.'
          ])
        ]
      }
    ]
  }
];

/** How a streamed answer appears: characters per tick, tick length, and the pause before it. */
const STREAM = { step: 6, tick: 28, think: 650 };

/** The chat whose artifact the screen opens with, wherever the inspector fits beside the thread. */
const FIRST_ARTIFACT = 'retry-helper';

export default {
  title: 'AI chat',
  category: 'Communication',
  blurb: 'Chat with an assistant that shows its work: tool steps, cited sources, artifacts with versions, agent mentions, and per-chat model settings.',
  components: [
    'Slider', 'FileList', 'CopyInput', 'Launcher', 'Select', 'InlineLoading', 'ContextMenu',
    'MenuButton', 'NumberField', 'Toggle', 'ProgressBar', 'AppIcon', 'Tooltip', 'Dialog', 'Message',
    'AppSidebar', 'ModuleBar', 'AccountMenu'
  ],

  /**
   * Mounts the chat application: history, thread, composer, and an inspector that holds either the
   * assistant settings or an artifact.
   * @param {HTMLElement} container Gallery stage.
   * @param {Partial<import('./kit.js').LayoutContext>} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const { preview } = context;
    const me = /** @type {NonNullable<ReturnType<typeof person>>} */ (person(ME));

    /** @type {Chat[]} */
    const chats = structuredClone(CHATS);
    for (const chat of chats) {
      chat.settings = { ...structuredClone(DEFAULT_SETTINGS), ...chat.settings };
      for (const message of chat.messages) message.id = uid('message');
    }
    /** @type {Artifact[]} */
    const artifacts = structuredClone(ARTIFACTS);
    const state = {
      chatId: 'export-limits',
      view: 'all',
      stick: true,
      minutes: 0,
      /** @type {Attachment[]} */ attachments: [],
      /**
       * The answer being written: its plan, how far it has got — the step running, then the
       * characters shown — and the timer of its next step.
       * @type {{chat: Chat, message: ChatMessage, plan: Plan, phase: 'steps'|'answer', step: number,
       *   shown: number, timer: number, view: HTMLElement, work: HTMLElement|null,
       *   content: HTMLElement}|null}
       */
      run: null,
      /** @type {Set<string>} Answers whose steps are expanded. */
      openWork: new Set(),
      /** @type {{id: string, version: number}|null} The artifact in the inspector. */
      artifact: null,
      /** @type {HTMLElement|null} The card that opened it, where the focus returns. */
      artifactOpener: null,
      /**
       * The open "@" suggestion list: where the mention starts in the text, the agents that match,
       * and the highlighted one.
       * @type {{start: number, end: number, matches: Agent[], index: number}|null}
       */
      mention: null
    };
    context.cleanup(() => clearTimeout(state.run?.timer));
    /** @type {Launcher|null} */ let launcher = null;
    /** @type {{dialog: Dialog, link: CopyInput, text: HTMLElement}|null} */ let sharing = null;
    /**
     * Each rendered answer owns its source cards, which live outside the thread until it is redrawn.
     * @type {Map<string, ReturnType<typeof renderScope>>}
     */
    const owners = new Map();

    // ------------------------------------------------------------ navigation column --

    const history = h('div', { class: 'chat__history', role: 'region', 'aria-label': 'Chat history' });
    const roving = rovingTabindex(history, '.chat__row');
    context.cleanup(() => roving.destroy());
    // The suite's navigation: the chat views, then the history of the one chosen. Send is this
    // screen's one solid accent, so starting a chat is an ordinary button.
    const nav = suiteNav(context, {
      module: 'assistant',
      menu: navItems(),
      active: state.view,
      header: button({
        label: 'New chat', icon: 'plus', shortcut: { label: 'C', keys: 'C' }, onclick: () => newChat()
      }),
      content: history,
      onsearch: () => openSearch(),
      account: {
        account: { name: me.name, secondary: me.role, status: me.status },
        items: [
          { label: 'Assistant settings', icon: 'sliders', value: 'settings' },
          { label: 'Keyboard shortcuts', icon: 'keyboard', value: 'shortcuts' }
        ],
        onselect: ({ detail }) => {
          leaveNav();
          if (detail.value === 'settings') toggleSettings(true);
          else openShortcuts();
        }
      }
    });
    const root = h('div', { class: 'chat shell' }, nav.column);
    // Narrow, the navigation — with the chat history — becomes a drawer, and so does the inspector
    // once it no longer fits beside the conversation.
    // The shell closes the inspector drawer by itself — on Escape, the scrim, or the navigation
    // drawer opening, after which the panel stays closed; or because the shell has grown wide enough
    // to show it as a column again, which it then is.
    const shell = adaptiveShell(root, context, {
      ondrawer: (name, open) => {
        if (name !== 'aside' || open || aside.hidden) return;
        if (asDrawer()) closeInspectorQuietly();
        else syncInspector();
      }
    });

    // ------------------------------------------------------------------ main pane --

    const titleSlot = h('div', { class: 'chat__title-block' });
    const modelSelect = keep(Select.entity(null, {
      items: MODELS,
      label: 'Model',
      renderIcon: (model) => icon(String(model.icon)),
      value: current().model,
      onchange: ({ detail }) => {
        if (detail.value == null) return;
        current().model = String(detail.value);
        refreshComposer();
        renderUsage();
      }
    }));
    const more = keep(new MenuButton(iconButton('ellipsis', 'More chat actions'), {
      kind: 'ghost',
      placement: 'bottom-end',
      onselect: ({ detail }) => chatAction(String(detail.value), current())
    }));

    const share = iconButton('share-nodes', 'Share chat', () => openShare());
    // The inspector is opened when it is asked for; the screen starts with the latest artifact in
    // it where there is room for both, and the conversation alone where there is not.
    const asideId = uid('chat-inspector');
    const settingsButton = iconButton('gear', 'Assistant settings', () => toggleSettings());
    // On a phone the composer's Parameters button opens the same panel, so the header lets this go.
    settingsButton.dataset.narrow = 'hide';
    const column = h('div', { class: 'chat__column' });
    const thread = h('div', {
      class: 'shell__body chat__thread', role: 'region', 'aria-label': 'Conversation', tabindex: '0',
      onscroll: () => {
        state.stick = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 48;
        jump.hidden = state.stick;
      }
    }, column);
    const jump = button({
      label: 'Jump to latest', icon: 'arrow-down', size: 'sm',
      onclick: () => {
        state.stick = true;
        followOutput();
        input.focus();
      }
    });
    jump.classList.add('chat__jump');
    jump.hidden = true;

    // The "@" suggestions: a listbox the text area controls as a combobox (APG), so the focus
    // stays in the text while the arrow keys move through the agents.
    const mentionList = h('div', {
      class: 'chat__mentions', role: 'listbox', id: uid('chat-agents'), 'aria-label': 'Agents', hidden: true
    });
    const input = h('textarea', {
      class: 'chat__input', rows: 1, 'aria-label': 'Message', 'aria-keyshortcuts': '/',
      role: 'combobox', 'aria-autocomplete': 'list', 'aria-haspopup': 'listbox', 'aria-expanded': 'false',
      'aria-controls': mentionList.id,
      oninput: () => {
        autosize();
        refreshComposer();
        updateMention();
        if (!state.run) status.set('inactive', '');
      },
      onkeydown: onComposerKey,
      onkeyup: (/** @type {KeyboardEvent} */ event) => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) updateMention();
      },
      onclick: () => updateMention(),
      onblur: () => closeMention()
    });
    const fileInput = h('input', {
      type: 'file', multiple: true, hidden: true, tabindex: '-1',
      onchange: () => {
        for (const file of fileInput.files ?? []) {
          state.attachments.push({ name: file.name, size: file.size, mime: file.type });
        }
        fileInput.value = '';
        renderAttachments();
        refreshComposer();
        input.focus();
      }
    });
    const attachments = h('div', { class: 'chat__chips', hidden: true });
    const prompts = keep(new MenuButton(iconButton('book-open', 'Saved prompts'), {
      kind: 'ghost',
      placement: 'top-start',
      items: [
        { type: 'heading', label: 'Saved prompts' },
        ...PROMPTS.map(({ value, label, description }) => ({ value, label, description }))
      ],
      onselect: ({ detail }) => usePrompt(String(detail.value))
    }));
    const mentionButton = iconButton('at', 'Mention an agent', () => startMention());
    const parameters = iconButton('sliders', 'Parameters', () => toggleSettings());
    const asideToggles = [settingsButton, parameters];
    for (const toggle of asideToggles) {
      toggle.classList.add('chat__aside-toggle');
      toggle.setAttribute('aria-controls', asideId);
      toggle.setAttribute('aria-expanded', 'false');
    }
    const status = keep(new InlineLoading(null, { status: 'inactive', size: 'sm' }));
    // Send and Stop share one place: Send while the assistant waits, Stop while it writes.
    const sendButton = iconButton('arrow-up', 'Send', () => send(), { shortcut: { label: '↵', keys: 'Enter' } });
    sendButton.classList.add('chat__send');
    const stopButton = iconButton('stop', 'Stop', () => stop(), { shortcut: { label: 'Esc', keys: 'Escape' } });
    stopButton.classList.add('chat__send', 'chat__stop');
    stopButton.hidden = true;
    const modelNote = h('p', { class: 'chat__note' });

    const main = h('section', { class: 'shell__main chat__main', 'aria-label': 'Chat' },
      paneHeader({
        leading: [shell.navToggle(), titleSlot],
        actions: [
          status.toElement(),
          h('div', { class: 'chat__model', 'data-zx-fields': 'quiet' }, modelSelect.toElement()),
          share,
          settingsButton,
          more.toElement()
        ]
      }),
      h('div', { class: 'chat__stage' }, thread, jump),
      h('div', { class: 'chat__dock' },
        h('div', { class: 'chat__composer' },
          mentionList,
          attachments,
          input,
          h('div', { class: 'chat__bar' },
            iconButton('paperclip', 'Attach files', () => fileInput.click()),
            prompts.toElement(),
            mentionButton,
            parameters,
            h('span', { class: 'shell__spacer' }),
            sendButton,
            stopButton),
          fileInput),
        modelNote));

    // ---------------------------------------------------------------- inspector --

    const system = h('textarea', {
      class: 'chat__system', rows: 5, id: uid('chat-system'),
      oninput: () => {
        current().settings.system = system.value;
        renderUsage();
      }
    });
    const temperature = keep(new Slider(null, {
      label: 'Temperature', min: 0, max: 2, step: 0.1,
      marks: [{ value: 0, label: 'Precise' }, { value: 1, label: 'Balanced' }, { value: 2, label: 'Creative' }],
      formatValue: (value) => formatNumber(value, { decimals: 1 }),
      onchange: ({ detail }) => { current().settings.temperature = detail.value; }
    }));
    const maxTokens = keep(new NumberField(null, {
      min: 256, max: 16_384, step: 256, largeStep: 1024, group: true, unit: 'tokens', label: 'Maximum answer length',
      onchange: ({ detail }) => { current().settings.maxTokens = detail.value ?? DEFAULT_SETTINGS.maxTokens; }
    }));
    const toggles = TOOLS.map((tool) => {
      const toggle = keep(new Toggle(null, {
        onchange: ({ detail }) => { current().settings.tools[tool.id] = detail.checked; }
      }));
      toggle.el.setAttribute('aria-label', tool.label);
      return { tool, toggle };
    });
    const knowledge = keep(new FileList(null, {
      label: 'Knowledge files',
      emptyText: 'No files yet. Add documents the assistant should read.',
      onaction: (event) => {
        event.preventDefault();
        const settings = current().settings;
        settings.files = settings.files.filter((file) => file.id !== event.detail.fileId);
        knowledge.removeItem(event.detail.fileId);
        renderUsage();
      },
      onactivate: (event) => event.preventDefault()
    }));
    const knowledgeInput = h('input', {
      type: 'file', multiple: true, hidden: true, tabindex: '-1',
      onchange: () => {
        for (const file of knowledgeInput.files ?? []) addKnowledge(file);
        knowledgeInput.value = '';
      }
    });
    const usage = keep(new ProgressBar(null, {
      label: 'Context used', size: 'sm',
      formatValue: (value, max) => formatPercent(max ? value / max : 0, { decimals: 1 })
    }));

    // The inspector comes and goes when the user says so: a column beside the conversation while
    // there is room for both, a drawer from the end once there is not (see `setInspector()`). It
    // holds one of two views — the assistant settings, or an artifact.
    const hideSettings = iconButton('xmark', 'Hide assistant settings', () => toggleSettings(false));
    const settingsView = h('div', { class: 'chat__view', dataset: { view: 'settings' } },
      paneHeader({
        title: 'Assistant',
        actions: [
          iconButton('rotate-left', 'Reset to defaults', () => resetSettings()),
          hideSettings
        ]
      }),
      h('div', { class: 'shell__body' },
        h('section', { class: 'panel-block' },
          h('label', { class: 'panel-block__title', for: system.id }, 'Instructions'),
          system,
          h('p', { class: 'meta chat__help' }, 'Applies to every answer in this chat.')),
        h('section', { class: 'panel-block' },
          h('h3', { class: 'panel-block__title' }, 'Parameters'),
          temperature.toElement(),
          // Not a <label>: the field's first labelable part is its decrement button, so the
          // spinbutton is named by the component's own `label` instead.
          h('div', { class: 'chat__field' },
            h('span', { class: 'chat__field-label', 'aria-hidden': 'true' }, 'Maximum answer length'),
            maxTokens.toElement())),
        h('section', { class: 'panel-block' },
          h('h3', { class: 'panel-block__title' }, 'Tools'),
          toggles.map(({ tool, toggle }) => h('div', { class: 'chat__tool' },
            h('span', { class: 'chat__tool-icon' }, icon(tool.icon)),
            h('span', { class: 'chat__tool-copy' },
              h('span', { class: 'chat__tool-name' }, tool.label),
              h('span', { class: 'chat__tool-text' }, tool.description)),
            toggle.toElement()))),
        h('section', { class: 'panel-block' },
          h('div', { class: 'chat__block-head' },
            h('h3', { class: 'panel-block__title' }, 'Knowledge'),
            button({ label: 'Add files', icon: 'plus', size: 'sm', onclick: () => knowledgeInput.click() })),
          knowledge.toElement(),
          knowledgeInput),
        h('section', { class: 'panel-block' }, usage.toElement())));

    // An artifact: what it is, its versions, Copy and Download, and its content on the canvas.
    const artifactGlyph = h('span', { class: 'chat__artifact-glyph' });
    const artifactName = h('span');
    const artifactVersions = h('div', { class: 'chat__version-switch' });
    const artifactNote = h('span', { class: 'chat__version-note' });
    const artifactBody = h('div', {
      class: 'shell__body chat__artifact-body', role: 'region', tabindex: '0', 'aria-label': 'Artifact'
    });
    const artifactHeader = paneHeader({
      leading: artifactGlyph,
      title: artifactName,
      actions: [
        copyButton({ text: () => artifactSource(), title: 'Copy artifact' }),
        iconButton('download', 'Download artifact', () => downloadArtifact()),
        iconButton('xmark', 'Close artifact', () => setInspector(null))
      ]
    });
    const artifactView = h('div', { class: 'chat__view', dataset: { view: 'artifact' }, hidden: true },
      artifactHeader,
      h('div', { class: 'shell__toolbar chat__versions' }, artifactVersions, artifactNote),
      artifactBody);
    /** @type {{id: string, element: HTMLElement, set: (value: string) => void}|null} */
    let versionSwitch = null;

    const aside = h('aside', {
      class: 'shell__aside chat__aside', id: asideId, 'aria-label': 'Assistant settings', hidden: true,
      dataset: { view: 'settings' },
      // Wide, the inspector is a column, and Escape inside it closes it — narrow, the shell's
      // drawer handles Escape first.
      onkeydown: (/** @type {KeyboardEvent} */ event) => {
        if (event.key !== 'Escape' || event.defaultPrevented || asDrawer()) return;
        const target = event.target;
        if (target instanceof Element
          && target.closest('[aria-expanded="true"], [role="listbox"], [role="menu"], [role="dialog"]')) return;
        event.preventDefault();
        setInspector(null);
      }
    }, settingsView, artifactView);

    root.append(main, aside);
    const notify = toaster(context, root);
    const openShortcuts = shortcutSheet(context, [
      ['Conversation', [
        ['Send', '↵'], ['New line', 'Shift+↵'], ['Stop the answer', 'Esc'], ['Mention an agent', '@'],
        ['Saved prompts, in an empty composer', '/'], ['Edit your last message, in an empty composer', '↑']
      ]],
      ['Agent suggestions', [
        ['Next agent', '↓'], ['Previous agent', '↑'], ['Choose the agent', '↵'], ['Close the list', 'Esc']
      ]],
      ['Navigate', [
        ['New chat', 'C'], ['Search chats', 'Mod+K'], ['Focus the composer', '/'], ['Keyboard shortcuts', '?']
      ]]
    ]);

    // -------------------------------------------------------------------- wiring --

    if (!preview) {
      // An inspector column open when the shell narrows gives way like any inspector: it closes.
      const widthWatch = new ResizeObserver(() => {
        if (!aside.hidden && asDrawer() && root.dataset.asideOpen !== 'true') closeInspectorQuietly();
      });
      widthWatch.observe(root);
      context.cleanup(() => widthWatch.disconnect());

      // Choosing a view in the navigation — all chats, a folder, the archive — changes the history
      // beneath it, so the drawer stays open for the choice of a chat.
      nav.sidebar.toElement().dataset.drawerStay = '';

      // A streaming answer is motion: asked for less of it mid-answer, the rest appears at once.
      watchMotion(root, (reduced) => {
        if (reduced && state.run) finishRun();
      }, { signal: context.signal });
    }

    // Right-click, Shift+F10, or a row's own "…" button: one menu for every chat in the history.
    const rowMenu = preview ? null : keep(new ContextMenu(history, {
      selector: '.chat__row',
      items: (row) => chatMenu(chats.find((chat) => chat.id === row.dataset.chat) ?? current()),
      onselect: ({ detail }) => chatAction(String(detail.value),
        chats.find((chat) => chat.id === detail.context.dataset.chat) ?? current())
    }));

    shortcuts(root, {
      'Mod+k': () => openSearch(),
      c: () => newChat(),
      '/': () => input.focus(),
      '?': () => openShortcuts(),
      // Esc stops a running answer; with nothing running it is left to whatever holds the layout.
      Escape: () => (state.run ? stop() : false)
    }, context);

    openChat(state.chatId);
    container.append(root);
    // Where the inspector fits beside the conversation, the screen opens with the code the latest
    // answer wrote; on a narrower screen its card in the answer opens it.
    if (preview || !asDrawer()) openArtifact(FIRST_ARTIFACT, { focus: false });
    followOutput();

    // ---------------------------------------------------------------- chat state --

    /** @returns {Chat} The open chat. */
    function current() {
      return /** @type {Chat} */ (chats.find((chat) => chat.id === state.chatId));
    }

    /** @param {string} id @returns {(typeof MODELS)[number]} */
    function modelById(id) {
      return MODELS.find((model) => model.ID === id) ?? MODELS[0];
    }

    /** @param {string|undefined} id @returns {Agent|undefined} */
    function agentById(id) {
      return AGENTS.find((agent) => agent.id === id);
    }

    /** @param {string} id @returns {Artifact|undefined} */
    function artifactById(id) {
      return artifacts.find((item) => item.id === id);
    }

    /** @returns {Chat[]} Chats with at least one message — drafts stay out of the history. */
    function started() {
      return chats.filter((chat) => chat.messages.length > 0);
    }

    /** @returns {string} The next minute on the layout's world clock, which starts at `NOW`. */
    function clock() {
      const now = new Date(NOW.getTime() + state.minutes * 60_000);
      state.minutes += 1;
      return stamp(now);
    }

    /**
     * Opens a chat: title, model, thread, settings, and the history selection all follow it. An
     * artifact the chat never mentions leaves the inspector.
     * @param {string} id
     * @returns {void}
     */
    function openChat(id) {
      if (state.run && state.run.chat.id !== id) finishRun();
      for (let index = chats.length - 1; index >= 0; index -= 1) {
        if (chats[index].messages.length === 0 && chats[index].id !== id) chats.splice(index, 1);
      }
      state.chatId = id;
      state.attachments = [];
      closeMention();
      const chat = current();
      if (chat.archived && state.view !== 'archive') showView('archive');
      modelSelect.set(chat.model, { silent: true });
      more.setItems(chatMenu(chat));
      if (state.artifact && !aside.hidden && aside.dataset.view === 'artifact' && !mentions(chat, state.artifact.id)) {
        setInspector(null, { focus: false });
      }
      renderTitle();
      renderThread();
      renderAttachments();
      renderHistory();
      renderSettings();
      refreshComposer();
      status.set('inactive', '');
      state.stick = true;
      followOutput();
    }

    /**
     * @param {Chat} chat @param {string} artifactId
     * @returns {boolean} Whether an answer in the chat carries the artifact's card.
     */
    function mentions(chat, artifactId) {
      return chat.messages.some((message) => message.blocks?.some((block) => block.type === 'artifact' && block.id === artifactId));
    }

    /** Starts an empty chat in the current folder and focuses the composer. @returns {void} */
    function newChat() {
      leaveNav();
      const draft = chats.find((chat) => chat.messages.length === 0);
      if (!draft) {
        chats.unshift({
          id: uid('chat'),
          title: 'New chat',
          folder: FOLDERS.some((folder) => folder.id === state.view) ? state.view : null,
          model: current().model,
          updated: stamp(NOW),
          settings: structuredClone(DEFAULT_SETTINGS),
          messages: []
        });
      }
      openChat((draft ?? chats[0]).id);
      input.focus();
    }

    /**
     * Sends the composer's text (or a suggestion) and streams the answer. A message that mentions an
     * agent is answered by that agent.
     * @param {string} [text]
     * @returns {void}
     */
    function send(text = input.value) {
      const chat = current();
      const value = text.trim();
      if (state.run || (!value && state.attachments.length === 0)) return;
      closeMention();
      const at = clock();
      const files = state.attachments;
      chat.messages.push({ id: uid('message'), role: 'user', at, text: value, files });
      if (chat.messages.length === 1) {
        chat.title = value.length > 48 ? `${value.slice(0, 46).trimEnd()}…` : value || files[0].name;
      }
      chat.updated = at;
      state.attachments = [];
      input.value = '';
      autosize();
      renderAttachments();
      renderTitle();
      renderThread();
      state.stick = true;
      followOutput();
      syncNavCounts();
      renderUsage();
      const { plan, agent } = planFor(chat, value);
      stream(chat, plan, { agent });
    }

    /**
     * What answering a message involves: the agent it mentions, if any, and that agent's work — or
     * the chat's scripted follow-up, or a first pass shaped by the chat's tools and files.
     * @param {Chat} chat
     * @param {string} text
     * @returns {{plan: Plan, agent: Agent|undefined}}
     */
    function planFor(chat, text) {
      const agent = mentionedAgent(text);
      if (agent) {
        const steps = AGENT_WORK[agent.id](topicOf(text));
        const sources = steps.some((entry) => entry.kind === 'search') ? cite('one-pager', 'short-updates') : [];
        return { agent, plan: { blocks: AGENT_REPLIES[agent.id] ?? GENERIC_REPLY, steps, sources } };
      }
      if (chat.reply) return { agent, plan: chat.reply };
      /** @type {Step[]} */
      const steps = [];
      /** @type {Source[]} */
      const sources = [];
      if (chat.settings.tools.web) {
        steps.push(searched(topicOf(text), 6, 1800));
        sources.push(...cite('one-pager', 'short-updates'));
      }
      const file = chat.settings.files[0];
      if (file) {
        steps.push(readFile(file.name, `${formatNumber(file.tokens)} tokens`, 600));
        sources.push(knowledgeSource(file));
      }
      if (chat.settings.tools.code) steps.push(ran('a quick check', 'The figures add up', 1400));
      return { agent, plan: { blocks: GENERIC_REPLY, steps, sources } };
    }

    /**
     * Writes an answer: first its steps, one at a time, then the text a few characters at a time.
     * Under reduced motion the whole answer appears at once. The run owns its timer, so Stop,
     * switching chats, and unmounting all cancel the next step. Given a `message`, the answer is
     * written into it as a new version.
     * @param {Chat} chat
     * @param {Plan} plan
     * @param {{message?: ChatMessage, agent?: Agent}} [options]
     * @returns {void}
     */
    function stream(chat, plan, { message, agent } = {}) {
      const fresh = { at: clock(), model: chat.model, agent: agent?.id, blocks: [], steps: [], sources: [], rating: null, stopped: false };
      if (message) Object.assign(message, fresh);
      else {
        message = { id: uid('message'), role: 'assistant', ...fresh };
        chat.messages.push(message);
      }
      const steps = plan.steps ?? [];
      if (preview || prefersReducedMotion(root)) {
        complete(message, plan);
        if (message.versions) message.versions[message.version ?? 0] = snapshot(message);
        renderThread();
        followOutput();
        renderHistory();
        renderUsage();
        status.set('success', 'Answer ready');
        return;
      }
      state.openWork.add(String(message.id));
      const run = {
        chat, message, plan, phase: /** @type {'steps'|'answer'} */ (steps.length ? 'steps' : 'answer'),
        step: 0, shown: 0, timer: 0,
        view: /** @type {HTMLElement} */ (/** @type {unknown} */ (null)), work: null,
        content: /** @type {HTMLElement} */ (/** @type {unknown} */ (null))
      };
      run.view = assistantMessage(chat, message, run);
      const existing = messageNode(String(message.id));
      if (existing) existing.replaceWith(run.view);
      else column.append(run.view);
      run.work = run.view.querySelector('.chat__work');
      run.content = /** @type {HTMLElement} */ (run.view.querySelector('.chat__content'));
      state.run = run;
      setBusy(true);
      renderHistory();
      followOutput();
      const author = agent?.name ?? modelById(chat.model).name;
      const total = blocksLength(plan.blocks);
      const tick = () => {
        if (state.run !== run) return;
        if (run.phase === 'steps') {
          run.step += 1;
          if (run.step >= steps.length) run.phase = 'answer';
          refreshWork(run);
          if (run.phase === 'steps') {
            status.set('active', `${steps[run.step].doing}…`);
            run.timer = window.setTimeout(tick, stepDelay(steps[run.step]));
          } else {
            status.set('active', `${author} is writing…`);
            run.content.replaceChildren(typing(author));
            run.timer = window.setTimeout(tick, STREAM.think);
          }
          followOutput();
          return;
        }
        run.shown = Math.min(total, run.shown + STREAM.step);
        run.content.replaceChildren(...renderBlocks(sliceBlocks(plan.blocks, run.shown), artifactCard));
        followOutput();
        if (run.shown >= total) finishRun();
        else run.timer = window.setTimeout(tick, STREAM.tick);
      };
      status.set('active', steps.length ? `${steps[0].doing}…` : `${author} is writing…`);
      run.timer = window.setTimeout(tick, steps.length ? stepDelay(steps[0]) : STREAM.think);
    }

    /**
     * Puts the whole plan into the message at once.
     * @param {ChatMessage} message @param {Plan} plan
     * @returns {void}
     */
    function complete(message, plan) {
      message.blocks = plan.blocks;
      message.steps = plan.steps ?? [];
      message.sources = plan.sources ?? [];
    }

    /**
     * Redraws the running answer's steps, keeping the focus on their toggle if it was there.
     * @param {NonNullable<typeof state.run>} run
     * @returns {void}
     */
    function refreshWork(run) {
      const next = workView(run.message, run);
      const hadFocus = Boolean(run.work?.contains(document.activeElement));
      if (run.work && next) run.work.replaceWith(next);
      else if (next) run.view.querySelector('.chat__byline')?.after(next);
      run.work = next;
      if (hadFocus) next?.querySelector('button')?.focus();
    }

    /**
     * Ends the running answer — completed, or stopped where it was. Its steps fold away into their
     * one-line summary.
     * @param {{stopped?: boolean}} [options]
     * @returns {void}
     */
    function finishRun({ stopped = false } = {}) {
      const run = state.run;
      if (!run) return;
      clearTimeout(run.timer);
      state.run = null;
      const { message, plan } = run;
      const steps = plan.steps ?? [];
      if (stopped) {
        message.steps = run.phase === 'steps'
          ? [...steps.slice(0, run.step), { ...steps[run.step], stopped: true }]
          : steps;
        message.blocks = sliceBlocks(plan.blocks, run.shown);
        message.sources = run.phase === 'steps' ? [] : plan.sources ?? [];
      } else complete(message, plan);
      message.stopped = stopped;
      if (message.versions) message.versions[message.version ?? 0] = snapshot(message);
      state.openWork.delete(String(message.id));
      setBusy(false);
      status.set(stopped ? 'inactive' : 'success', stopped ? 'Stopped' : 'Answer ready');
      if (run.chat === current()) {
        renderThread();
        followOutput();
        renderUsage();
      }
      renderHistory();
    }

    /** Stops the running answer, keeping what was written so far. @returns {void} */
    function stop() {
      if (state.run) finishRun({ stopped: true });
    }

    /** Keeps the newest output in view unless the reader has scrolled up. @returns {void} */
    function followOutput() {
      if (state.stick) thread.scrollTop = thread.scrollHeight;
      jump.hidden = state.stick;
    }

    // ----------------------------------------------------------------- rendering --

    /** @returns {void} */
    function renderTitle() {
      const chat = current();
      titleSlot.replaceChildren(h('h2', { class: 'shell__title' }, chat.title));
      share.disabled = chat.messages.length === 0;
      if (chat.messages.length) {
        // Rename is also in the chat's menu, which is where a phone, with no pointer to hover, finds it.
        const rename = iconButton('pen', 'Rename chat', () => startRename());
        rename.dataset.narrow = 'hide';
        titleSlot.append(rename);
      }
    }

    /** Puts the focus on the open chat's title. @returns {void} */
    function focusTitle() {
      const title = titleSlot.querySelector('h2');
      if (!(title instanceof HTMLElement)) return;
      title.tabIndex = -1;
      title.focus();
    }

    /**
     * Closes the navigation drawer, if it is open, before a choice made in it moves the focus: the
     * other columns are inert while it is open, so nothing in them could take the focus.
     * @returns {boolean} Whether it was open.
     */
    function leaveNav() {
      if (root.dataset.navOpen !== 'true') return false;
      shell.closeNav();
      return true;
    }

    /** Replaces the title with a text field; Enter or leaving the field saves, Esc cancels. @returns {void} */
    function startRename() {
      const chat = current();
      const field = h('input', {
        class: 'chat__title-input', value: chat.title, maxlength: 80, 'aria-label': 'Chat title'
      });
      let done = false;
      const commit = (/** @type {boolean} */ save) => {
        if (done) return;
        done = true;
        if (save && field.value.trim()) chat.title = field.value.trim();
        renderTitle();
        renderHistory();
        // Back to the pencil, or on a phone, where it is not shown, to the menu that renamed.
        const pencil = titleSlot.querySelector('button');
        (pencil?.checkVisibility() ? pencil : more.toElement()).focus();
      };
      field.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== 'Escape') return;
        event.preventDefault(); // the key must not go on to press the button focused next
        event.stopPropagation();
        commit(event.key === 'Enter');
      });
      field.addEventListener('blur', () => commit(true));
      titleSlot.replaceChildren(field);
      field.focus();
      field.select();
    }

    /** @returns {void} */
    function renderThread() {
      const chat = current();
      for (const owner of owners.values()) owner.reset();
      if (chat.messages.length === 0) {
        column.replaceChildren(welcome(chat));
        return;
      }
      const branchAt = chat.branchOf ? chat.branchOf.after - 1 : -1;
      column.replaceChildren(...chat.messages.flatMap((message, index) => {
        const day = formatDate(new Date(message.at), DATE.day);
        const previous = chat.messages[index - 1];
        return [
          !previous || formatDate(new Date(previous.at), DATE.day) !== day ? h('p', { class: 'chat__day' }, day) : null,
          message.role === 'user' ? userMessage(message) : assistantMessage(chat, message),
          index === branchAt ? branchNote(chat) : null
        ].filter((node) => node !== null);
      }));
    }

    /**
     * Where a branch left the chat it came from, with the way back to it.
     * @param {Chat} chat
     * @returns {HTMLElement}
     */
    function branchNote(chat) {
      const origin = /** @type {BranchOrigin} */ (chat.branchOf);
      const source = chats.find((entry) => entry.id === origin.id);
      return h('p', { class: 'chat__day chat__branch-note' },
        icon('code-branch', { size: 14 }),
        h('span', {}, 'Branched from ',
          source ? h('button', {
            type: 'button', class: 'link-button',
            onclick: () => {
              openChat(source.id);
              focusTitle();
            }
          }, source.title) : origin.title));
    }

    /**
     * The empty state of a new chat: a greeting and a few conversation starters.
     * @param {Chat} chat
     * @returns {HTMLElement}
     */
    function welcome(chat) {
      const model = modelById(chat.model);
      return h('div', { class: 'chat__welcome' },
        appIcon({ icon: model.icon, size: 48, shape: 'circle' }),
        h('h3', { class: 'chat__welcome-title' }, `What can I help with, ${me.name.split(' ')[0]}?`),
        h('p', { class: 'meta' }, `${model.name} · ${model.description}`),
        h('div', { class: 'chat__suggestions' }, SUGGESTIONS.map((suggestion) => h('button', {
          type: 'button', class: 'chat__suggestion', onclick: () => send(suggestion.text)
        },
        h('span', { class: 'chat__suggestion-title' }, suggestion.title),
        h('span', { class: 'chat__suggestion-text' }, suggestion.text)))));
    }

    /**
     * A message from the signed-in user: a bubble, attached files, edit and copy.
     * @param {ChatMessage} message
     * @returns {HTMLElement}
     */
    function userMessage(message) {
      const files = message.files ?? [];
      const time = timeOf(message);
      return h('article', {
        class: 'chat__message', dataset: { role: 'user', id: message.id }, 'aria-label': `You, ${time}`
      },
        h('div', { class: 'chat__bubble' },
          files.length ? h('div', { class: 'chat__chips' }, files.map((file) => fileChip(file))) : null,
          message.text ? h('p', { class: 'chat__bubble-text' }, withMentions(message.text)) : null),
        h('div', { class: 'chat__actions' },
          h('span', { class: 'chat__time' }, time),
          iconButton('pen', 'Edit message', () => editMessage(message)),
          copyButton({ text: message.text ?? '', title: 'Copy message' })));
    }

    /**
     * A message's text with each `@agent` it mentions drawn in that agent's tone.
     * @param {string} text
     * @returns {Array<Node|string>}
     */
    function withMentions(text) {
      return text.split(/((?<=^|\s)@[a-z][\w-]*)/i).filter(Boolean).map((part) => {
        const agent = part.startsWith('@') ? agentById(part.slice(1).toLowerCase()) : undefined;
        return agent ? h('span', { class: 'chat__mention', dataset: { tone: agent.tone } }, part) : part;
      });
    }

    /**
     * An answer: who wrote it, the steps it took, its content and sources, and copy / regenerate /
     * branch / rating actions. While it is being written (`run`) it shows its progress instead.
     * @param {Chat} chat
     * @param {ChatMessage} message
     * @param {NonNullable<typeof state.run>|null} [run]
     * @returns {HTMLElement}
     */
    function assistantMessage(chat, message, run = null) {
      const model = modelById(message.model ?? chat.model);
      const agent = agentById(message.agent);
      const latest = chat.messages.at(-1) === message;
      const blocks = message.blocks ?? [];
      const time = timeOf(message);
      const author = agent?.name ?? model.name;
      const owner = ownerFor(String(message.id));
      owner.reset();
      /** @type {Array<Node|string>} */
      let content;
      if (run) content = run.phase === 'steps' ? [] : [typing(author)];
      else if (blocks.length) content = renderBlocks(blocks, artifactCard);
      else content = [h('p', { class: 'chat__p meta' }, 'You stopped this answer before it began.')];
      return h('article', {
        class: 'chat__message',
        dataset: {
          role: 'assistant', id: message.id, streaming: run ? 'true' : null, latest: latest ? 'true' : null
        },
        'aria-label': `${author}, ${time}`,
        'aria-busy': run ? 'true' : null
      },
      h('div', { class: 'chat__byline' },
        agent ? iconTile(agent.icon, agent.tone) : appIcon({ icon: model.icon, size: 24, shape: 'circle' }),
        h('span', { class: 'chat__author' }, author),
        agent ? h('span', { class: 'chat__via' }, `via ${model.name}`) : null,
        h('span', { class: 'chat__time' }, time),
        message.stopped ? badge({ label: 'Stopped', kind: 'warning', size: 'sm' }) : null),
      workView(message, run),
      h('div', { class: 'chat__content' }, content),
      run ? null : sourcesView(message, owner),
      run ? null : h('div', { class: 'chat__actions' },
        (message.versions?.length ?? 0) > 1 ? versionPager(chat, message) : null,
        copyButton({ text: () => blocksToMarkdown(blocks), title: 'Copy answer' }),
        latest ? iconButton('rotate-right', 'Regenerate answer', () => regenerate()) : null,
        iconButton('code-branch', 'Branch into a new chat', () => branchFrom(message)),
        ...rateButtons(message)));
    }

    /**
     * The steps an answer took: a one-line summary that opens into a timeline — each step with its
     * glyph, a muted detail, and how long it took. While the answer is written the timeline is open
     * and the running step turns.
     * @param {ChatMessage} message
     * @param {NonNullable<typeof state.run>|null} run
     * @returns {HTMLElement|null}
     */
    function workView(message, run) {
      const planned = run ? run.plan.steps ?? [] : message.steps ?? [];
      const steps = run && run.phase === 'steps' ? planned.slice(0, run.step + 1) : planned;
      if (!steps.length) return null;
      const running = run && run.phase === 'steps' ? run.step : -1;
      const id = String(message.id);
      const open = state.openWork.has(id);
      const done = steps.filter((entry, index) => index !== running && !entry.stopped);
      const time = seconds(done.reduce((sum, entry) => sum + entry.ms, 0));
      const listId = uid('chat-steps');
      const stepList = h('ol', { class: 'chat__steps', id: listId, 'aria-label': 'Steps', hidden: !open },
        steps.map((entry, index) => stepRow(entry, index === running)));
      const toggle = h('button', {
        type: 'button', class: 'chat__work-toggle', 'aria-expanded': String(open), 'aria-controls': listId,
        onclick: () => {
          const expand = toggle.getAttribute('aria-expanded') !== 'true';
          toggle.setAttribute('aria-expanded', String(expand));
          stepList.hidden = !expand;
          if (expand) state.openWork.add(id);
          else state.openWork.delete(id);
        }
      },
      icon('chevron-right', { size: 14, class: 'chat__work-chevron' }),
      running >= 0 ? h('span', { class: 'chat__work-summary' }, 'Working…') : h('span', { class: 'chat__work-summary' }, workSummary(steps)),
      done.length ? h('span', { class: 'chat__work-time' }, time) : null);
      return h('div', { class: 'chat__work', dataset: { state: running >= 0 ? 'running' : 'done' } }, toggle, stepList);
    }

    /**
     * One step in the timeline.
     * @param {Step} entry
     * @param {boolean} running
     * @returns {HTMLLIElement}
     */
    function stepRow(entry, running) {
      const detail = [entry.detail, entry.sources ? `${entry.sources} sources` : null].filter(Boolean).join(' · ');
      return h('li', {
        class: 'chat__step', dataset: { kind: entry.kind, state: running ? 'running' : entry.stopped ? 'stopped' : 'done' }
      },
      h('span', { class: 'chat__step-icon', 'aria-hidden': 'true' },
        running ? spinner({ size: 'sm', kind: 'current' }) : icon(STEP_ICONS[entry.kind], { size: 14 })),
      h('span', { class: 'chat__step-text' },
        h('span', { class: 'chat__step-label' }, running ? `${entry.doing}…` : entry.label),
        detail ? h('span', { class: 'chat__step-detail' }, detail) : null),
      h('span', { class: 'chat__step-time' }, running ? '' : entry.stopped ? 'Stopped' : seconds(entry.ms)));
    }

    /**
     * The sources an answer cites, as chips; pointing at one or focusing it shows a card with its
     * title, site, and the passage used.
     * @param {ChatMessage} message
     * @param {ReturnType<typeof renderScope>} owner Destroys the cards when the answer is redrawn.
     * @returns {HTMLElement|null}
     */
    function sourcesView(message, owner) {
      const sources = message.sources ?? [];
      if (!sources.length) return null;
      const labelId = uid('chat-sources');
      return h('div', { class: 'chat__sources' },
        h('span', { class: 'chat__sources-label', id: labelId }, 'Sources'),
        h('ul', { class: 'chat__source-list', 'aria-labelledby': labelId }, sources.map((source) => {
          const link = h('a', {
            class: 'chat__source', href: source.url, target: '_blank', rel: 'noopener noreferrer'
          },
          icon(source.file ? 'file-lines' : 'globe', { size: 14 }),
          h('span', { class: 'chat__source-name' }, source.file ? source.title : source.site));
          owner.own(new Tooltip(link, {
            content: () => sourceCard(source), placement: 'top-start', maxWidth: 320
          }));
          return h('li', {}, link);
        })));
    }

    /**
     * The card for a source chip.
     * @param {Source} source
     * @returns {HTMLElement}
     */
    function sourceCard(source) {
      return h('span', { class: 'chat__source-card' },
        h('span', { class: 'chat__source-title' }, source.title),
        h('span', { class: 'chat__source-site' },
          icon(source.file ? 'file-lines' : 'globe', { size: 12 }), source.site),
        h('span', { class: 'chat__source-snippet' }, source.snippet));
    }

    /**
     * The card an answer shows for an artifact it wrote; it opens the artifact in the inspector.
     * @param {Extract<Block, {type: 'artifact'}>} block
     * @returns {HTMLElement}
     */
    function artifactCard(block) {
      const item = artifactById(block.id);
      if (!item) return h('p', { class: 'chat__p meta' }, block.title);
      const showing = inspectorShown() && aside.dataset.view === 'artifact' && state.artifact?.id === item.id;
      const versions = item.versions.length;
      return h('button', {
        type: 'button', class: 'chat__artifact-card', dataset: { artifact: item.id },
        'aria-controls': asideId, 'aria-expanded': String(showing),
        onclick: (/** @type {MouseEvent} */ event) => toggleArtifact(item.id, /** @type {HTMLElement} */ (event.currentTarget))
      },
      iconTile(item.kind === 'code' ? 'code' : 'file-lines', item.kind === 'code' ? 'violet' : 'amber', { size: 'lg' }),
      h('span', { class: 'chat__artifact-copy' },
        h('span', { class: 'chat__artifact-name' }, item.title),
        h('span', { class: 'chat__artifact-meta' },
          `${item.kind === 'code' ? 'Code' : 'Document'} · ${versions} ${versions === 1 ? 'version' : 'versions'}`)),
      icon('chevron-right', { size: 14, class: 'chat__artifact-chevron' }));
    }

    /**
     * ‹ 2 / 2 › — the versions of a regenerated answer.
     * @param {Chat} chat
     * @param {ChatMessage} message
     * @returns {HTMLElement}
     */
    function versionPager(chat, message) {
      const total = message.versions?.length ?? 1;
      const index = message.version ?? 0;
      const previous = iconButton('chevron-left', 'Previous version', () => showVersion(chat, message, index - 1, -1));
      const next = iconButton('chevron-right', 'Next version', () => showVersion(chat, message, index + 1, 1));
      previous.disabled = index === 0;
      next.disabled = index === total - 1;
      return h('span', { class: 'chat__pager', role: 'group', 'aria-label': 'Answer versions' },
        previous,
        h('span', { class: 'chat__pager-count' },
          h('span', { class: 'visually-hidden' }, 'Version '), String(index + 1),
          h('span', { 'aria-hidden': 'true' }, ' / '),
          h('span', { class: 'visually-hidden' }, ' of '), String(total)),
        next);
    }

    /**
     * Shows another version of an answer in its place, keeping the focus on the pager.
     * @param {Chat} chat
     * @param {ChatMessage} message
     * @param {number} index
     * @param {-1|1} direction
     * @returns {void}
     */
    function showVersion(chat, message, index, direction) {
      const versions = message.versions;
      if (!versions?.[index] || state.run) return;
      versions[message.version ?? 0] = snapshot(message);
      Object.assign(message, versions[index]);
      message.version = index;
      const view = assistantMessage(chat, message);
      messageNode(String(message.id))?.replaceWith(view);
      const [previous, next] = /** @type {HTMLButtonElement[]} */ ([...view.querySelectorAll('.chat__pager .zx-icon-btn')]);
      const preferred = direction < 0 ? previous : next;
      (preferred && !preferred.disabled ? preferred : direction < 0 ? next : previous)?.focus();
      renderHistory();
      renderUsage();
    }

    /**
     * Thumbs up and down as one pair of toggle buttons.
     * @param {ChatMessage} message
     * @returns {HTMLButtonElement[]}
     */
    function rateButtons(message) {
      const buttons = /** @type {const} */ (['up', 'down']).map((direction) => {
        const rate = iconButton(`thumbs-${direction}`, direction === 'up' ? 'Good answer' : 'Poor answer', () => {
          message.rating = message.rating === direction ? null : direction;
          sync();
          if (message.rating) notify('Thanks — your feedback helps tune the assistant.');
        });
        rate.classList.add('icon-toggle', 'chat__rate');
        rate.dataset.direction = direction;
        return rate;
      });
      // A rating that is on shows the solid thumb (`.icon-toggle`), so it reads without colour.
      const sync = () => buttons.forEach((rate) => {
        rate.setAttribute('aria-pressed', String(message.rating === rate.dataset.direction));
      });
      sync();
      return buttons;
    }

    /**
     * Writes a fresh version of the latest answer beside the one there; ‹ › switches between them.
     * @returns {void}
     */
    function regenerate() {
      const chat = current();
      const message = chat.messages.at(-1);
      if (state.run || message?.role !== 'assistant') return;
      const asked = chat.messages.findLast((entry) => entry.role === 'user')?.text ?? '';
      const { plan, agent } = planFor(chat, asked);
      if (message.versions) message.versions[message.version ?? 0] = snapshot(message);
      else message.versions = [snapshot(message)];
      message.version = message.versions.length;
      message.versions.push(snapshot(message));
      stream(chat, message.retry ?? plan, { message, agent: agentById(message.agent) ?? agent });
      // The button that asked has gone with the old answer: Stop, or the new answer's pager.
      if (document.activeElement && document.activeElement !== document.body && root.contains(document.activeElement)) return;
      if (state.run) stopButton.focus();
      else messageNode(String(message.id))?.querySelector('.chat__pager .zx-icon-btn')?.focus();
    }

    /**
     * Starts a new chat from this point: every message up to and including this answer, with a
     * note where the branch left the original, which stays as it was.
     * @param {ChatMessage} message
     * @returns {void}
     */
    function branchFrom(message) {
      const chat = current();
      const index = chat.messages.indexOf(message);
      if (index < 0) return;
      const messages = structuredClone(chat.messages.slice(0, index + 1));
      for (const entry of messages) entry.id = uid('message');
      /** @type {Chat} */
      const branch = {
        id: uid('chat'), title: chat.title, folder: chat.folder, model: chat.model, updated: clock(),
        settings: structuredClone(chat.settings), messages,
        branchOf: { id: chat.id, title: chat.title, after: messages.length }
      };
      chats.unshift(branch);
      openChat(branch.id);
      syncNavCounts();
      input.focus();
      notify('Branched into a new chat. The original stays as it was.', 'success', {
        action: {
          label: 'Back to original',
          onclick: () => {
            if (!chats.includes(chat)) return;
            openChat(chat.id);
            focusTitle();
          }
        }
      });
    }

    /**
     * Turns a sent message back into a field. Saving drops everything after it and asks again.
     * @param {ChatMessage} message
     * @returns {void}
     */
    function editMessage(message) {
      stop();
      const chat = current();
      const view = messageNode(String(message.id));
      if (!view) return;
      const field = h('textarea', {
        class: 'chat__edit', rows: 3, 'aria-label': 'Edit message', value: message.text ?? ''
      });
      const save = () => {
        if (!field.value.trim()) return;
        message.text = field.value.trim();
        chat.messages.splice(chat.messages.indexOf(message) + 1);
        renderThread();
        const { plan, agent } = planFor(chat, message.text);
        stream(chat, plan, { agent });
      };
      field.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          save();
        } else if (event.key === 'Escape') {
          event.stopPropagation();
          renderThread();
          input.focus();
        }
      });
      view.replaceChildren(h('div', { class: 'chat__editor' }, field,
        h('div', { class: 'chat__editor-bar' },
          button({ label: 'Cancel', kind: 'ghost', size: 'sm', onclick: () => renderThread() }),
          button({ label: 'Save and send', size: 'sm', onclick: save }))));
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    }

    /** Lists the chats in the current view: pinned first, then by day. @returns {void} */
    function renderHistory() {
      const inView = started().filter((chat) => (state.view === 'archive' ? chat.archived
        : !chat.archived && (state.view === 'all' || chat.folder === state.view)));
      const groups = [{ label: 'Pinned', chats: inView.filter((chat) => chat.pinned) }];
      for (const chat of inView.filter((entry) => !entry.pinned).sort((a, b) => b.updated.localeCompare(a.updated))) {
        const label = dayBucket(chat.updated);
        const group = groups.find((entry) => entry.label === label);
        if (group) group.chats.push(chat);
        else groups.push({ label, chats: [chat] });
      }
      const folder = FOLDERS.find((entry) => entry.id === state.view);
      history.setAttribute('aria-label', state.view === 'archive' ? 'Archived chats'
        : folder ? `Chats in ${folder.label}` : 'Chat history');
      const focusedId = history.contains(document.activeElement)
        ? /** @type {HTMLElement} */ (document.activeElement).dataset.chat : null;
      history.replaceChildren(...groups.filter((group) => group.chats.length).map((group) => h('div', {},
        h('h3', { class: 'list-group chat__group-title' }, group.label),
        h('ul', { class: 'chat__rows' }, group.chats.map((chat) => historyEntry(chat))))));
      if (!history.childElementCount) {
        const archive = state.view === 'archive';
        history.append(emptyState({
          icon: archive ? 'box-archive' : 'comments', size: 'sm',
          title: archive ? 'Nothing archived' : 'No chats here yet',
          description: archive ? 'Archived chats stay searchable.' : 'Start a new chat or file one here from its menu.'
        }));
      }
      const rows = /** @type {HTMLElement[]} */ ([...history.querySelectorAll('.chat__row')]);
      const tabStop = rows.find((row) => row.getAttribute('aria-current')) ?? rows[0];
      rows.forEach((row) => { row.tabIndex = row === tabStop ? 0 : -1; });
      rows.find((row) => row.dataset.chat === focusedId)?.focus();
    }

    /**
     * One chat in the history: the row that opens it, and — on hover — a button for its menu. The
     * button is not a tab stop; from the keyboard, Shift+F10 on the row opens the same menu.
     * @param {Chat} chat
     * @returns {HTMLLIElement}
     */
    function historyEntry(chat) {
      const row = chatRow(chat);
      return h('li', { class: 'chat__entry' }, row, rowMenu ? h('button', {
        type: 'button', class: 'zx-icon-btn chat__row-menu', tabindex: '-1',
        'aria-label': `Actions for ${chat.title}`, title: 'Chat actions',
        onclick: (/** @type {MouseEvent} */ event) => {
          const box = /** @type {HTMLElement} */ (event.currentTarget).getBoundingClientRect();
          row.focus(); // where the focus returns when the menu closes
          rowMenu.openAt(box.left, box.bottom, row);
        }
      }, icon('ellipsis')) : null);
    }

    /**
     * The row that opens a chat: its title, when it last changed, and how it ends. A branch carries
     * the branch glyph before its title.
     * @param {Chat} chat
     * @returns {HTMLButtonElement}
     */
    function chatRow(chat) {
      const last = chat.messages.findLast((message) => message.text || message.blocks?.length);
      const writing = state.run?.chat === chat;
      return h('button', {
        type: 'button', class: 'list-row chat__row', dataset: { chat: chat.id },
        'aria-current': chat.id === state.chatId ? 'true' : null,
        onclick: () => {
          const fromDrawer = leaveNav();
          openChat(chat.id);
          // From the drawer the history goes away: the focus moves to the chat's title, which a
          // screen reader then reads out.
          if (fromDrawer) focusTitle();
        }
      },
      h('span', { class: 'list-row__top' },
        h('span', { class: 'list-row__title' },
          chat.branchOf ? [
            h('span', { class: 'chat__branch-glyph', 'aria-hidden': 'true' }, icon('code-branch', { size: 13 })),
            h('span', { class: 'visually-hidden' }, 'Branch: ')
          ] : null,
          chat.title),
        writing ? h('span', { class: 'list-row__meta chat__writing' }, 'Writing…')
          : h('span', { class: 'list-row__meta' }, listTime(chat.updated))),
      h('span', { class: 'list-row__snippet' }, last?.text
        ?? blocksToText((last?.blocks ?? []).filter((block) => block.type === 'p').slice(0, 1))));
    }

    /** @returns {void} */
    function renderAttachments() {
      attachments.hidden = state.attachments.length === 0;
      attachments.replaceChildren(...state.attachments.map((file, index) => fileChip(file, () => {
        state.attachments.splice(index, 1);
        renderAttachments();
        refreshComposer();
        input.focus();
      })));
    }

    /** Loads the open chat's settings into the inspector. @returns {void} */
    function renderSettings() {
      const settings = current().settings;
      system.value = settings.system;
      temperature.set(settings.temperature, { silent: true });
      maxTokens.set(settings.maxTokens, { silent: true });
      for (const { tool, toggle } of toggles) toggle.set(Boolean(settings.tools[tool.id]), { silent: true });
      knowledge.setItems(settings.files.map(knowledgeItem), { silent: true });
      renderUsage();
    }

    /** Estimates how much of the model's context window the chat fills. @returns {void} */
    function renderUsage() {
      const chat = current();
      const text = chat.messages.map((message) => message.text ?? blocksToText(message.blocks ?? [])).join(' ');
      const used = Math.round((text.length + chat.settings.system.length) / 4)
        + chat.settings.files.reduce((sum, file) => sum + file.tokens, 0);
      const window = modelById(chat.model).context;
      usage.setMax(window);
      usage.set(Math.min(used, window), { silent: true });
      usage.setHelperText(`${formatNumber(used)} of ${formatNumber(window)} tokens`);
    }

    /**
     * @param {KnowledgeFile} file
     * @returns {Record<string, unknown>} A FileList item with a remove action.
     */
    function knowledgeItem(file) {
      return {
        id: file.id, name: file.name, size: file.size, mime: file.mime, identitySize: 'sm',
        // A table, like the composer's chips, rather than the generic glyph FileItem has for CSV.
        ...(/csv|sheet|excel/.test(file.mime) ? { icon: 'table' } : {}),
        metadata: [{ label: 'Tokens', value: `${formatNumber(file.tokens)} tokens`, showLabel: false }],
        actions: [{ id: 'remove', icon: 'trash', title: `Remove ${file.name}` }]
      };
    }

    /**
     * Adds an uploaded document to the chat's knowledge, indexing it briefly first.
     * @param {File} file
     * @returns {void}
     */
    function addKnowledge(file) {
      const settings = current().settings;
      const entry = {
        id: uid('file'), name: file.name, size: file.size, mime: file.type, tokens: Math.round(file.size / 5)
      };
      settings.files.push(entry);
      knowledge.addItem({
        ...knowledgeItem(entry), status: 'processing', statusLabel: 'Indexing…', indeterminate: true
      });
      later(context, () => {
        if (!knowledge.getItem(entry.id)) return;
        knowledge.updateItem(entry.id, { status: 'ready', statusLabel: '', indeterminate: false });
        renderUsage();
      }, 900);
    }

    /** @returns {void} */
    function resetSettings() {
      const chat = current();
      chat.settings = { ...structuredClone(DEFAULT_SETTINGS), files: chat.settings.files };
      renderSettings();
      notify('Assistant settings reset to the defaults.');
    }

    /** Updates the placeholder, the model note, and whether Send is available. @returns {void} */
    function refreshComposer() {
      const model = modelById(current().model);
      input.placeholder = `Message ${model.name} — / for prompts, @ for agents`;
      modelNote.textContent = `${model.name} can make mistakes. Check figures before you share them.`;
      sendButton.disabled = !input.value.trim() && state.attachments.length === 0;
    }

    /** Grows the composer with its text, up to the height its stylesheet allows. @returns {void} */
    function autosize() {
      input.style.blockSize = 'auto';
      input.style.blockSize = `${input.scrollHeight}px`;
    }

    /**
     * Swaps Send for Stop while an answer is being written, keeping the focus on the swapped button.
     * @param {boolean} busy
     * @returns {void}
     */
    function setBusy(busy) {
      const refocus = document.activeElement === (busy ? sendButton : stopButton);
      sendButton.hidden = busy;
      stopButton.hidden = !busy;
      if (refocus) (busy ? stopButton : input).focus();
      refreshComposer();
    }

    // ------------------------------------------------------------------ mentions --

    /**
     * Opens, filters, or closes the agent suggestions from the word the caret is in: a word that
     * starts with "@" lists the agents whose handle or name matches what follows it.
     * @returns {void}
     */
    function updateMention() {
      const caret = input.selectionStart;
      if (caret !== input.selectionEnd) return closeMention();
      const match = /(?:^|\s)@([\w-]*)$/.exec(input.value.slice(0, caret));
      if (!match) return closeMention();
      const query = match[1].toLowerCase();
      const matches = AGENTS.filter((agent) => agent.id.startsWith(query) || agent.name.toLowerCase().includes(query));
      if (!matches.length) return closeMention();
      const highlighted = state.mention?.matches[state.mention.index];
      const index = Math.max(0, highlighted ? matches.indexOf(highlighted) : 0);
      state.mention = { start: caret - match[1].length - 1, end: caret, matches, index };
      mentionList.replaceChildren(...matches.map((agent, position) => h('div', {
        class: 'chat__mention-option', role: 'option', id: `${mentionList.id}-${agent.id}`,
        'aria-selected': 'false', dataset: { agent: agent.id },
        // The text keeps the focus; a click picks without blurring it.
        onmousedown: (/** @type {MouseEvent} */ event) => event.preventDefault(),
        onclick: () => pickMention(agent),
        onpointermove: () => highlightMention(position)
      },
      iconTile(agent.icon, agent.tone),
      h('span', { class: 'chat__mention-copy' },
        h('span', { class: 'chat__mention-name' }, agent.name,
          h('span', { class: 'chat__mention-handle' }, `@${agent.id}`)),
        h('span', { class: 'chat__mention-text' }, agent.description)))));
      mentionList.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      highlightMention(index);
    }

    /** @param {number} index The agent to highlight. @returns {void} */
    function highlightMention(index) {
      if (!state.mention) return;
      state.mention.index = index;
      const options = /** @type {HTMLElement[]} */ ([...mentionList.children]);
      options.forEach((option, position) => option.setAttribute('aria-selected', String(position === index)));
      input.setAttribute('aria-activedescendant', options[index].id);
      options[index].scrollIntoView({ block: 'nearest' });
    }

    /** @returns {void} */
    function closeMention() {
      if (!state.mention && mentionList.hidden) return;
      state.mention = null;
      mentionList.hidden = true;
      mentionList.replaceChildren();
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }

    /**
     * Puts the agent's handle where the "@" word was, followed by a space.
     * @param {Agent} agent
     * @returns {void}
     */
    function pickMention(agent) {
      if (!state.mention) return;
      const { start, end } = state.mention;
      const text = `@${agent.id} `;
      const rest = input.value.slice(end).replace(/^ /, '');
      input.value = `${input.value.slice(0, start)}${text}${rest}`;
      const caret = start + text.length;
      input.setSelectionRange(caret, caret);
      closeMention();
      autosize();
      refreshComposer();
    }

    /** The composer's @ button: starts a mention at the caret and opens the list. @returns {void} */
    function startMention() {
      const caret = input.selectionStart;
      const before = input.value.slice(0, caret);
      input.focus();
      input.setRangeText(before && !/\s$/.test(before) ? ' @' : '@', caret, input.selectionEnd, 'end');
      autosize();
      refreshComposer();
      updateMention();
    }

    // ------------------------------------------------------------------- actions --

    /**
     * Enter sends, Shift+Enter breaks the line, Esc stops an answer, ↑ edits the last message, and
     * "/" at the start opens the saved prompts. While the agent suggestions are open, ↑ and ↓ move
     * through them, Enter or Tab picks one, and Esc closes them.
     * @param {KeyboardEvent} event
     * @returns {void}
     */
    function onComposerKey(event) {
      if (event.isComposing) return;
      if (state.mention) {
        const { matches, index } = state.mention;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          highlightMention((index + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
          return;
        }
        if ((event.key === 'Enter' && !event.shiftKey) || (event.key === 'Tab' && !event.shiftKey)) {
          event.preventDefault();
          pickMention(matches[index]);
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          closeMention();
          return;
        }
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        send();
      } else if (event.key === 'Escape' && state.run) {
        event.preventDefault();
        stop();
      } else if (event.key === 'ArrowUp' && input.value === '') {
        const last = current().messages.findLast((message) => message.role === 'user');
        if (last) {
          event.preventDefault();
          editMessage(last);
        }
      } else if (event.key === '/' && input.value === '') {
        event.preventDefault();
        // Opened from the text, the menu hands the focus back to it rather than to its button.
        prompts.focusFirst({ returnFocus: input });
      }
    }

    /** @param {string} value Saved prompt id. @returns {void} */
    function usePrompt(value) {
      const prompt = PROMPTS.find((entry) => entry.value === value);
      if (!prompt) return;
      input.value = input.value ? `${input.value.trimEnd()}\n\n${prompt.text}` : prompt.text;
      autosize();
      refreshComposer();
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }

    /**
     * The per-chat actions, shared by the header's overflow menu and the history's context menu.
     * @param {Chat} chat
     * @returns {Array<Record<string, unknown>|string>}
     */
    function chatMenu(chat) {
      return [
        { label: 'Rename', icon: 'pen', value: 'rename', disabled: chat.messages.length === 0 },
        { label: chat.pinned ? 'Unpin' : 'Pin to top', icon: 'thumbtack', value: 'pin' },
        { label: 'Export as Markdown', icon: 'file-export', value: 'export' },
        { type: 'heading', label: 'Move to folder' },
        ...FOLDERS.map((folder) => ({
          label: folder.label, value: `folder:${folder.id}`, role: 'menuitemradio', checked: chat.folder === folder.id
        })),
        { label: 'No folder', value: 'folder:', role: 'menuitemradio', checked: !chat.folder },
        '-',
        { label: chat.archived ? 'Restore from archive' : 'Archive', icon: 'box-archive', value: 'archive' },
        { label: 'Delete', icon: 'trash', value: 'delete', danger: true }
      ];
    }

    /**
     * @param {string} action A value from `chatMenu()`.
     * @param {Chat} chat
     * @returns {Promise<void>}
     */
    async function chatAction(action, chat) {
      if (action === 'rename') {
        if (chat !== current()) openChat(chat.id);
        later(context, startRename, 0); // after the menu has handed focus back
      } else if (action === 'pin') {
        chat.pinned = !chat.pinned;
        notify(chat.pinned ? 'Pinned to the top of your history.' : 'Unpinned.');
      } else if (action === 'export') {
        downloadBlob(`${slug(chat.title)}.md`, chatToMarkdown(chat), { type: 'text/markdown' });
      } else if (action.startsWith('folder:')) {
        chat.folder = action.slice(7) || null;
        const folder = FOLDERS.find((entry) => entry.id === chat.folder);
        notify(folder ? `Moved to ${folder.label}.` : 'Removed from its folder.');
      } else if (action === 'archive') {
        chat.archived = !chat.archived;
        notify(chat.archived ? 'Chat archived.' : 'Chat restored.');
        if (chat === current() && chat.archived) openNext(chat);
      } else if (action === 'delete') {
        const confirmed = await Dialog.confirm({
          title: 'Delete this chat?',
          message: `“${chat.title}” and all of its messages will be deleted. This cannot be undone.`,
          okLabel: 'Delete chat',
          danger: true
        });
        if (!confirmed || !chats.includes(chat)) return;
        if (chat === current()) openNext(chat);
        chats.splice(chats.indexOf(chat), 1);
        notify('Chat deleted.');
      }
      more.setItems(chatMenu(current()));
      syncNavCounts();
      renderHistory();
    }

    /** @param {Chat} leaving @returns {void} Opens the next chat in the history, or a new one. */
    function openNext(leaving) {
      const next = started().find((chat) => chat !== leaving && !chat.archived);
      if (next) openChat(next.id);
      else newChat();
    }

    /** @returns {Array<Record<string, unknown>>} AppSidebar items with live counts. */
    function navItems() {
      const live = started().filter((chat) => !chat.archived);
      const count = (/** @type {string} */ folder) => live.filter((chat) => chat.folder === folder).length || undefined;
      return [
        { id: 'all', label: 'All chats', icon: 'comments', badge: live.length, invoke: () => showView('all') },
        {
          id: 'folders', label: 'Folders', icon: 'folder',
          children: FOLDERS.map((folder) => ({
            id: folder.id, label: folder.label, badge: count(folder.id), invoke: () => showView(folder.id)
          }))
        },
        { id: 'archive', label: 'Archive', icon: 'box-archive', invoke: () => showView('archive') }
      ];
    }

    /**
     * Refreshes the counts in the navigation in place: redrawing its menu would take the history
     * beneath it, and the focus inside it, along.
     * @returns {void}
     */
    function syncNavCounts() {
      for (const item of navItems().flatMap((entry) => [entry, ...(/** @type {any[]} */ (entry.children) ?? [])])) {
        nav.setBadge(/** @type {string} */ (item.id), /** @type {any} */ (item.badge) ?? null);
      }
    }

    /** @param {string} view `all`, `archive`, or a folder id. @returns {void} */
    function showView(view) {
      state.view = view;
      nav.setActive(view);
      renderHistory();
    }

    /** Opens the chat search; the launcher is created on first use. @returns {void} */
    function openSearch() {
      if (preview || launcher?.isOpen()) return;
      leaveNav();
      launcher ??= keep(new Launcher(null, {
        scope: root,
        shortcut: false,
        label: 'Search chats',
        placeholder: 'Search chats, artifacts, and actions',
        emptyText: 'No chat matches that.'
      }));
      launcher.setItems([
        ...started().map((chat) => ({
          id: chat.id,
          label: chat.title,
          description: [
            chat.branchOf ? 'Branch' : null,
            FOLDERS.find((folder) => folder.id === chat.folder)?.label,
            chat.archived ? 'Archived' : null,
            listTime(chat.updated)
          ].filter(Boolean).join(' · '),
          group: chat.pinned ? 'Pinned' : dayBucket(chat.updated),
          icon: chat.branchOf ? 'code-branch' : 'comment-regular',
          kind: 'record',
          current: chat.id === state.chatId,
          keywords: chat.messages.map((message) => message.text ?? blocksToText(message.blocks ?? [])),
          invoke: () => openChat(chat.id)
        })),
        ...artifacts.filter((item) => chats.some((chat) => chat.id === item.chat)).map((item) => ({
          id: `artifact:${item.id}`,
          label: item.title,
          description: `${item.kind === 'code' ? 'Code' : 'Document'} · ${chats.find((chat) => chat.id === item.chat)?.title}`,
          group: 'Artifacts',
          icon: item.kind === 'code' ? 'code' : 'file-lines',
          invoke: () => {
            openChat(item.chat);
            openArtifact(item.id);
          }
        })),
        { id: 'new', label: 'New chat', group: 'Actions', icon: 'plus', invoke: () => newChat() },
        {
          id: 'settings', label: 'Assistant settings', group: 'Actions', icon: 'sliders',
          invoke: () => toggleSettings(true)
        },
        { id: 'keys', label: 'Keyboard shortcuts', group: 'Actions', icon: 'keyboard', invoke: () => openShortcuts() }
      ]);
      launcher.setQuery('');
      launcher.open();
    }

    // ------------------------------------------------------------------ inspector --

    /**
     * Whether the inspector opens as a drawer: once the shell is too narrow for it beside the
     * conversation, the width at which every layout's inspector gives way.
     * @returns {boolean}
     */
    function asDrawer() {
      return !preview && root.clientWidth <= SHELL_BREAKPOINTS.aside;
    }

    /** @returns {boolean} Whether the inspector is showing, as a column or a drawer. */
    function inspectorShown() {
      return !aside.hidden && (!asDrawer() || root.dataset.asideOpen === 'true');
    }

    /**
     * Where the focus goes when the inspector closes with the focus in it: the card that opened an
     * artifact, or a button that opens the settings again.
     * @returns {HTMLElement|undefined}
     */
    function returnTarget() {
      if (aside.dataset.view === 'artifact') {
        const opener = state.artifactOpener;
        if (opener?.isConnected && opener.checkVisibility()) return opener;
        const card = /** @type {HTMLElement[]} */ ([...column.querySelectorAll('.chat__artifact-card')])
          .find((element) => element.dataset.artifact === state.artifact?.id && element.checkVisibility());
        return card ?? input;
      }
      return asideToggles.find((toggle) => toggle.checkVisibility()) ?? input;
    }

    /**
     * Hides the inspector after the shell took it away, handing the focus it held to whatever
     * opens it again.
     * @returns {void}
     */
    function closeInspectorQuietly() {
      // A column that gave way has already dropped its focus to the page body by now.
      const hadFocus = aside.contains(document.activeElement) || document.activeElement === document.body;
      const target = returnTarget();
      aside.hidden = true;
      syncInspector();
      if (hadFocus) target?.focus();
    }

    /** Keeps the buttons and cards that open the inspector in step with it. @returns {void} */
    function syncInspector() {
      const shown = inspectorShown();
      const view = aside.dataset.view;
      for (const toggle of asideToggles) toggle.setAttribute('aria-expanded', String(shown && view === 'settings'));
      for (const card of /** @type {NodeListOf<HTMLElement>} */ (column.querySelectorAll('.chat__artifact-card'))) {
        card.setAttribute('aria-expanded', String(shown && view === 'artifact' && card.dataset.artifact === state.artifact?.id));
      }
    }

    /**
     * Shows the inspector with one of its views, or closes it. Wide, it is a column beside the
     * conversation; narrow, the shell's drawer, modal within the layout. Opening the settings moves
     * the focus to the instructions (on a phone, to the panel's close button, so no keyboard springs
     * up); opening an artifact moves it to the artifact's title. Closing from inside the panel hands
     * the focus back to what opens it again.
     * @param {'settings'|'artifact'|null} view
     * @param {{focus?: boolean}} [options]
     * @returns {void}
     */
    function setInspector(view, { focus = true } = {}) {
      const returnFocus = !view && aside.contains(document.activeElement);
      const target = returnFocus ? returnTarget() : undefined;
      if (view) {
        aside.dataset.view = view;
        aside.setAttribute('aria-label', view === 'settings' ? 'Assistant settings' : 'Artifact');
        settingsView.hidden = view !== 'settings';
        artifactView.hidden = view !== 'artifact';
      }
      if (asDrawer()) {
        if (view) {
          aside.hidden = false;
          shell.toggleAside(true);
        } else {
          shell.toggleAside(false);
          aside.hidden = true;
        }
      } else {
        aside.hidden = !view;
      }
      syncInspector();
      if (view && focus && !preview) {
        if (view === 'settings') (shell.single() ? hideSettings : system).focus();
        else {
          const title = /** @type {HTMLElement|null} */ (artifactHeader.querySelector('h2'));
          if (title) {
            title.tabIndex = -1;
            title.focus({ preventScroll: true });
          }
        }
      }
      const active = document.activeElement;
      if (returnFocus && (!active || active === document.body || !active.checkVisibility())) target?.focus();
    }

    /**
     * Opens the assistant settings, or closes them. With an artifact showing, the settings take its
     * place.
     * @param {boolean} [show]
     * @returns {void}
     */
    function toggleSettings(show = !(inspectorShown() && aside.dataset.view === 'settings')) {
      setInspector(show ? 'settings' : null);
    }

    /**
     * Shows an artifact in the inspector.
     * @param {string} id
     * @param {{version?: number, focus?: boolean, opener?: HTMLElement}} [options] `version` is an
     *   index; the latest by default.
     * @returns {void}
     */
    function openArtifact(id, { version, focus = true, opener } = {}) {
      const item = artifactById(id);
      if (!item) return;
      state.artifact = { id, version: version ?? item.versions.length - 1 };
      state.artifactOpener = opener ?? null;
      renderArtifact();
      setInspector('artifact', { focus });
    }

    /**
     * The card in an answer: opens its artifact, or closes it when it is the one showing.
     * @param {string} id
     * @param {HTMLElement} card
     * @returns {void}
     */
    function toggleArtifact(id, card) {
      if (inspectorShown() && aside.dataset.view === 'artifact' && state.artifact?.id === id) setInspector(null);
      else openArtifact(id, { opener: card });
    }

    /** Draws the artifact in the inspector at the chosen version. @returns {void} */
    function renderArtifact() {
      const entry = state.artifact;
      const item = entry && artifactById(entry.id);
      if (!entry || !item) return;
      const version = item.versions[entry.version];
      artifactGlyph.replaceChildren(iconTile(item.kind === 'code' ? 'code' : 'file-lines', item.kind === 'code' ? 'violet' : 'amber'));
      artifactName.textContent = item.title;
      if (versionSwitch?.id !== item.id) {
        versionSwitch = {
          id: item.id,
          ...segmented({
            label: 'Version',
            options: item.versions.map((_, index) => ({ id: String(index), label: `v${index + 1}` })),
            onchange: (value) => {
              if (!state.artifact) return;
              state.artifact.version = Number(value);
              renderArtifact();
            },
            signal: context.signal
          })
        };
        artifactVersions.replaceChildren(versionSwitch.element);
      }
      versionSwitch.set(String(entry.version));
      const latest = entry.version === item.versions.length - 1;
      artifactNote.textContent = `${latest ? 'Latest · ' : ''}${version.note} · ${formatDate(new Date(version.at), DATE.time)}`;
      artifactBody.setAttribute('aria-label', `${item.title}, version ${entry.version + 1}`);
      artifactBody.replaceChildren(typeof version.content === 'string'
        ? codeLines(item.language ?? '', version.content)
        : h('div', { class: 'chat__artifact-doc' }, renderBlocks(version.content)));
      artifactBody.scrollTop = 0;
    }

    /** @returns {string} The artifact showing, at its version, as text to copy or download. */
    function artifactSource() {
      const entry = state.artifact;
      const item = entry && artifactById(entry.id);
      if (!entry || !item) return '';
      const content = item.versions[entry.version].content;
      return typeof content === 'string' ? content : blocksToMarkdown(content);
    }

    /** Saves the artifact showing as a file: the code as itself, a document as Markdown. @returns {void} */
    function downloadArtifact() {
      const entry = state.artifact;
      const item = entry && artifactById(entry.id);
      if (!entry || !item) return;
      const suffix = entry.version === item.versions.length - 1 ? '' : `-v${entry.version + 1}`;
      const name = item.kind === 'code'
        ? item.title.replace(/(\.[^.]+)?$/, (extension) => `${suffix}${extension}`)
        : `${slug(item.title)}${suffix}.md`;
      downloadBlob(name, artifactSource(), { type: item.kind === 'code' ? 'text/javascript' : 'text/markdown' });
    }

    /** A share link for the open chat, ready to copy. @returns {void} */
    function openShare() {
      const chat = current();
      if (!sharing) {
        const link = keep(new CopyInput(null, { label: 'Link', value: '' }));
        const replies = keep(new Toggle(null, { label: 'Let people continue the conversation', checked: false }));
        const text = h('p', { class: 'meta' });
        const dialog = keep(new Dialog(null, {
          title: 'Share chat', size: 'sm', scope: root,
          content: stack({ gap: 4 }, text, link.toElement(), replies.toElement()),
          buttons: [{ label: 'Done', kind: 'primary', action: 'close' }]
        }));
        sharing = { dialog, link, text };
      }
      sharing.text.textContent = `Anyone at ${ORGANISATION.name} with the link can read “${chat.title}”. `
        + 'Knowledge files are not shared.';
      sharing.link.set(`https://chat.${ORGANISATION.domain}/s/${chat.id}`);
      sharing.dialog.open();
    }

    // -------------------------------------------------------------------- helpers --

    /**
     * The owner of what an answer creates outside the thread, reset each time the answer is drawn.
     * @param {string} id Message id.
     * @returns {ReturnType<typeof renderScope>}
     */
    function ownerFor(id) {
      let owner = owners.get(id);
      if (!owner) {
        owner = renderScope(context);
        owners.set(id, owner);
      }
      return owner;
    }

    /** @param {string} id @returns {HTMLElement|undefined} The message's element in the thread. */
    function messageNode(id) {
      return /** @type {HTMLElement[]} */ ([...column.querySelectorAll('.chat__message')])
        .find((node) => node.dataset.id === id);
    }

    /**
     * @param {KnowledgeFile} file
     * @returns {Source} The source an answer cites for a knowledge file.
     */
    function knowledgeSource(file) {
      return Object.values(SOURCES).find((source) => source.file && source.title === file.name) ?? {
        title: file.name, site: 'Knowledge file', url: `https://chat.${ORGANISATION.domain}/files/${encodeURIComponent(file.name)}`,
        snippet: `${formatNumber(file.tokens)} tokens, indexed for this chat.`, file: true
      };
    }
  }
};

// ------------------------------------------------------------- rendering answers --

/**
 * Splits a text run into plain, bold, and code segments.
 * @param {string} text
 * @returns {Array<{kind: 'text'|'strong'|'code', text: string}>}
 */
function segments(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).filter(Boolean).map((part) => {
    if (part.startsWith('**') && part.endsWith('**')) return { kind: 'strong', text: part.slice(2, -2) };
    if (part.startsWith('`') && part.endsWith('`')) return { kind: 'code', text: part.slice(1, -1) };
    return { kind: 'text', text: part };
  });
}

/**
 * Renders a text run as text nodes, `<strong>`, and `<code>` — never as HTML.
 * @param {string} text
 * @returns {Array<Node|string>}
 */
function inline(text) {
  return segments(text).map((segment) => (segment.kind === 'strong' ? h('strong', {}, segment.text)
    : segment.kind === 'code' ? h('code', { class: 'chat__code-inline' }, segment.text) : segment.text));
}

/** A string in single, double, or back quotes; unterminated while it is still being streamed. */
const STRING = /'(?:[^'\\\n]|\\.)*'?|"(?:[^"\\\n]|\\.)*"?|`(?:[^`\\]|\\.)*`?/;
/** A number, digit separators included: `30_000`, `0.5`. */
const NUMBER = /\b\d[\d_]*(?:\.\d+)?\b/;
/** A name or a keyword. */
const WORD = /[A-Za-z_$][\w$]*/;

/**
 * What the code highlighter recognises in one language. Comments, strings, numbers, and words are
 * matched in that order from left to right, so a quote inside a comment or a digit inside a name
 * never starts a token of its own.
 * @param {RegExp} comment A line comment.
 * @param {string} keywords Space-separated, lower case.
 * @param {boolean} [caseless] Whether `SELECT` is the keyword `select`.
 * @returns {{pattern: RegExp, keywords: Set<string>, caseless: boolean}}
 */
function grammar(comment, keywords, caseless = false) {
  return {
    pattern: new RegExp([['comment', comment], ['string', STRING], ['number', NUMBER], ['word', WORD]]
      .map(([name, part]) => `(?<${name}>${/** @type {RegExp} */ (part).source})`).join('|'), 'g'),
    keywords: new Set(keywords.split(' ')),
    caseless
  };
}

/** The languages answers colour; any other code block stays plain text. */
const GRAMMARS = {
  javascript: grammar(/\/\/[^\n]*/, 'async await break case catch class const continue default do else export '
    + 'for from function if import in let new of return switch throw try typeof while'),
  sql: grammar(/--[^\n]*/, 'and as by desc from group having interval join not on or order select where', true),
  bash: grammar(/(?<!\S)#[^\n]*/, 'do done elif else esac export fi for function if in then while')
};

/**
 * Colours a code block — keywords, strings, numbers, comments — as text nodes and spans, never HTML.
 * @param {string} language
 * @param {string} source
 * @returns {Array<Node|string>}
 */
function highlight(language, source) {
  const syntax = GRAMMARS[/** @type {keyof typeof GRAMMARS} */ (language)];
  if (!syntax) return [source];
  /** @type {Array<Node|string>} */
  const out = [];
  let plain = 0;
  for (const match of source.matchAll(syntax.pattern)) {
    const { comment, string, number, word } = /** @type {Record<string, string|undefined>} */ (match.groups);
    const token = comment ? 'comment' : string ? 'string' : number ? 'number'
      : word && syntax.keywords.has(syntax.caseless ? word.toLowerCase() : word) ? 'keyword' : null;
    if (!token) continue;
    out.push(source.slice(plain, match.index), h('span', { class: 'chat__token', dataset: { token } }, match[0]));
    plain = Number(match.index) + match[0].length;
  }
  out.push(source.slice(plain));
  return out.filter((part) => part !== '');
}

/**
 * Code in the inspector, line by line: a long line wraps a step deeper than its own indent rather
 * than run out of the panel, and each line carries its number in the margin. The numbers are drawn
 * by CSS, so selecting and copying the code takes the code alone.
 * @param {string} language
 * @param {string} source
 * @returns {HTMLElement}
 */
function codeLines(language, source) {
  return h('pre', { class: 'chat__artifact-code' }, h('code', {},
    source.split('\n').map((line) => h('span', {
      class: 'chat__line', style: { '--chat-indent': `${/^\s*/.exec(line)?.[0].length ?? 0}ch` }
    }, highlight(language, line)))));
}

/**
 * @param {Block[]} blocks
 * @param {(block: Extract<Block, {type: 'artifact'}>) => HTMLElement} [artifactCard] Draws an
 *   artifact block; without it the artifact is named in a line of its own.
 * @returns {HTMLElement[]} The blocks as elements.
 */
function renderBlocks(blocks, artifactCard) {
  return blocks.map((block) => {
    if (block.type === 'artifact') {
      return artifactCard ? artifactCard(block) : h('p', { class: 'chat__p meta' }, block.title);
    }
    if (block.type === 'heading') {
      // One level below the chat's own title, whichever level the answer starts at.
      return h(block.level === 3 ? 'h4' : 'h3', {
        class: 'chat__heading', dataset: { level: String(block.level) }
      }, inline(block.text));
    }
    if (block.type === 'quote') {
      return h('blockquote', { class: 'chat__quote' },
        block.text.split('\n\n').map((paragraph) => h('p', { class: 'chat__p' }, inline(paragraph))));
    }
    if (block.type === 'list') {
      return h(block.ordered ? 'ol' : 'ul', { class: 'chat__list' },
        block.items.map((item) => h('li', { class: 'chat__li' }, inline(item))));
    }
    if (block.type === 'code') {
      return h('figure', { class: 'chat__code' },
        h('figcaption', { class: 'chat__code-head' },
          h('span', { class: 'chat__code-language' }, block.language),
          copyButton({ text: block.code, title: 'Copy code', size: 'sm' })),
        h('pre', { class: 'chat__pre', tabindex: '0' }, h('code', {}, highlight(block.language, block.code))));
    }
    if (block.type === 'table') {
      const align = (/** @type {number} */ index) => ({ align: block.align?.[index] ?? 'start' });
      return h('div', { class: 'chat__table-wrap' }, h('table', { class: 'chat__table' },
        h('thead', {}, h('tr', {}, block.columns.map((column, index) => h('th', {
          class: 'chat__th', scope: 'col', dataset: align(index)
        }, column)))),
        h('tbody', {}, block.rows.map((row) => h('tr', {}, row.map((cell, index) => h('td', {
          class: 'chat__td', dataset: align(index)
        }, inline(cell))))))));
    }
    return h('p', { class: 'chat__p' }, inline(block.text));
  });
}

/**
 * How many characters a block costs to stream. A table row counts as a fixed amount, so rows
 * arrive one at a time; an artifact's card arrives whole.
 * @param {Block} block
 * @returns {number}
 */
function blockLength(block) {
  if (block.type === 'artifact') return 48;
  if (block.type === 'list') return block.items.reduce((sum, item) => sum + visibleLength(item), 0);
  if (block.type === 'code') return block.code.length;
  if (block.type === 'table') return block.rows.length * 24;
  return visibleLength(block.text);
}

/** @param {Block[]} blocks @returns {number} */
function blocksLength(blocks) {
  return blocks.reduce((sum, block) => sum + blockLength(block), 0);
}

/** @param {string} text @returns {number} Characters shown, not counting markup. */
function visibleLength(text) {
  return segments(text).reduce((sum, segment) => sum + segment.text.length, 0);
}

/**
 * Cuts a text run after `limit` visible characters and keeps its markup well formed.
 * @param {string} text
 * @param {number} limit
 * @returns {string}
 */
function truncateText(text, limit) {
  let left = limit;
  let out = '';
  for (const segment of segments(text)) {
    if (left <= 0) break;
    const part = segment.text.slice(0, left);
    left -= part.length;
    out += segment.kind === 'strong' ? `**${part}**` : segment.kind === 'code' ? `\`${part}\`` : part;
  }
  return out;
}

/**
 * The part of an answer that has been "written" after `budget` characters.
 * @param {Block[]} blocks
 * @param {number} budget
 * @returns {Block[]}
 */
function sliceBlocks(blocks, budget) {
  const out = [];
  let left = budget;
  for (const block of blocks) {
    if (left <= 0) break;
    const cost = blockLength(block);
    if (cost <= left) {
      out.push(block);
      left -= cost;
      continue;
    }
    if (block.type === 'list') {
      const items = [];
      for (const item of block.items) {
        if (left <= 0) break;
        items.push(truncateText(item, left));
        left -= visibleLength(item);
      }
      out.push({ ...block, items });
    } else if (block.type === 'code') out.push({ ...block, code: block.code.slice(0, left) });
    else if (block.type === 'table') out.push({ ...block, rows: block.rows.slice(0, Math.floor(left / 24)) });
    else if (block.type !== 'artifact') out.push({ ...block, text: truncateText(block.text, left) });
    left = 0;
  }
  return out;
}

/** @param {Block[]} blocks @returns {string} The answer as plain text, for previews. */
function blocksToText(blocks) {
  return blocks.map((block) => (block.type === 'list' ? block.items.join(' ')
    : block.type === 'code' ? block.code
      : block.type === 'table' ? block.rows.map((row) => row.join(' ')).join(' ')
        : block.type === 'artifact' ? block.title
          : block.text).replaceAll(/\*\*|`/g, '')).join(' ');
}

/** @param {Block[]} blocks @returns {string} The answer as Markdown, for copying and export. */
function blocksToMarkdown(blocks) {
  return blocks.map((block) => {
    if (block.type === 'artifact') return `**${block.title}** (artifact)`;
    if (block.type === 'heading') return `${'#'.repeat(block.level)} ${block.text}`;
    if (block.type === 'quote') return block.text.split('\n').map((line) => `> ${line}`).join('\n');
    if (block.type === 'list') {
      return block.items.map((item, index) => `${block.ordered ? `${index + 1}.` : '-'} ${item}`).join('\n');
    }
    if (block.type === 'code') return `\`\`\`${block.language}\n${block.code}\n\`\`\``;
    if (block.type === 'table') {
      const rows = [block.columns, block.columns.map(() => '---'), ...block.rows];
      return rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
    }
    return block.text;
  }).join('\n\n');
}

/** @param {Chat} chat @returns {string} The whole conversation as Markdown. */
function chatToMarkdown(chat) {
  return [`# ${chat.title}`, ...chat.messages.map((message) => {
    const when = formatDate(new Date(message.at), DATE.dateTime);
    return message.role === 'user'
      ? `**You** · ${when}\n\n${message.text ?? ''}`
      : `**Assistant** · ${when}\n\n${blocksToMarkdown(message.blocks ?? [])}`;
  })].join('\n\n');
}

// -------------------------------------------------------------------- the work --

/**
 * The one line an answer's steps fold into: what kinds of thing it did, and how often.
 * "Searched 12 sources, read 1 file, wrote 2 drafts, ran the tests twice". A step that was stopped
 * counts for nothing but the stop.
 * @param {Step[]} steps
 * @returns {string}
 */
function workSummary(steps) {
  const finished = steps.filter((entry) => !entry.stopped);
  const stopped = steps.find((entry) => entry.stopped);
  if (stopped && !finished.length) return `Stopped while ${stopped.doing.charAt(0).toLowerCase()}${stopped.doing.slice(1)}`;
  const of = (/** @type {StepKind} */ kind) => finished.filter((entry) => entry.kind === kind);
  const times = (/** @type {number} */ count) => (count === 1 ? '' : count === 2 ? ' twice' : ` ${count} times`);
  const phrases = [];
  const searches = of('search');
  if (searches.length) phrases.push(`searched ${searches.reduce((sum, entry) => sum + (entry.sources ?? 0), 0)} sources`);
  const reads = of('read').length;
  if (reads) phrases.push(`read ${reads} ${reads === 1 ? 'file' : 'files'}`);
  const queries = of('query').length;
  if (queries) phrases.push(queries === 1 ? 'ran a query' : `ran ${queries} queries`);
  const drafts = of('write').length;
  if (drafts) phrases.push(`wrote ${drafts === 1 ? 'a draft' : `${drafts} drafts`}`);
  const runs = of('run');
  if (runs.length) {
    const targets = new Set(runs.map((entry) => entry.target));
    phrases.push(targets.size === 1 ? `ran ${runs[0].target}${times(runs.length)}` : `ran ${runs.length} commands`);
  }
  if (stopped) phrases.push('then stopped');
  const text = phrases.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** @param {number} ms @returns {string} A step's duration: "2.1s". */
function seconds(ms) {
  return `${formatNumber(ms / 1000, { decimals: 1 })}s`;
}

/**
 * How long a step shows as running while an answer is written — its real duration, shortened.
 * @param {Step} entry
 * @returns {number}
 */
function stepDelay(entry) {
  return Math.min(1100, Math.max(450, entry.ms / 3));
}

/**
 * The words a question is about, as a web search would put them.
 * @param {string} text
 * @returns {string}
 */
function topicOf(text) {
  const words = text.replace(/(?:^|\s)@[\w-]+/g, ' ').replace(/[^\p{L}\p{N}’' -]+/gu, ' ').trim().split(/\s+/).slice(0, 6);
  return words.join(' ').toLowerCase() || 'your question';
}

/**
 * @param {string} text
 * @returns {Agent|undefined} The first agent the text mentions with `@handle`.
 */
function mentionedAgent(text) {
  for (const match of text.matchAll(/(?:^|\s)@([a-z][\w-]*)/gi)) {
    const agent = AGENTS.find((entry) => entry.id === match[1].toLowerCase());
    if (agent) return agent;
  }
  return undefined;
}

/**
 * @param {ChatMessage} message
 * @returns {AnswerVersion} The answer as it stands, to keep among its versions.
 */
function snapshot(message) {
  return {
    blocks: message.blocks ?? [], steps: message.steps ?? [], sources: message.sources ?? [],
    at: message.at, model: message.model, agent: message.agent,
    rating: message.rating ?? null, stopped: Boolean(message.stopped)
  };
}

/**
 * The three dots of an answer about to be written.
 * @param {string} author
 * @returns {HTMLElement}
 */
function typing(author) {
  return h('span', { class: 'chat__typing', role: 'img', 'aria-label': `${author} is thinking` },
    h('span'), h('span'), h('span'));
}

/**
 * A segmented control: a radio group whose checked option is its one tab stop and whose arrow keys
 * move the choice, as the APG radio group pattern has it.
 * @param {{label: string, options: Array<{id: string, label: string}>,
 *   onchange: (id: string) => void, signal: AbortSignal}} config
 * @returns {{element: HTMLElement, set: (id: string) => void}}
 */
function segmented({ label, options, onchange, signal }) {
  const buttons = options.map((option) => h('button', {
    type: 'button', class: 'segmented__item', role: 'radio', dataset: { id: option.id },
    onclick: () => onchange(option.id)
  }, option.label));
  const element = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label }, buttons);
  element.addEventListener('keydown', (event) => {
    const move = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!move) return;
    event.preventDefault();
    const checked = buttons.findIndex((item) => item.getAttribute('aria-checked') === 'true');
    const next = buttons[(checked + move + buttons.length) % buttons.length];
    onchange(String(next.dataset.id));
    next.focus();
  }, { signal });
  return {
    element,
    set(id) {
      for (const item of buttons) {
        item.setAttribute('aria-checked', String(item.dataset.id === id));
        item.tabIndex = item.dataset.id === id ? 0 : -1;
      }
    }
  };
}

// --------------------------------------------------------------------- helpers --

/**
 * A compact file chip for the composer and for sent messages.
 * @param {Attachment} file
 * @param {() => void} [onremove] Adds a remove button.
 * @returns {HTMLElement}
 */
function fileChip(file, onremove) {
  return h('span', { class: 'chat__chip' },
    h('span', { class: 'chat__chip-icon' }, icon(fileGlyph(file.mime))),
    h('span', { class: 'chat__chip-name' }, file.name),
    h('span', { class: 'chat__chip-size' }, formatFileSize(file.size)),
    onremove ? iconButton('xmark', `Remove ${file.name}`, onremove) : null);
}

/** @param {string} mime @returns {string} The icon for a file type. */
function fileGlyph(mime) {
  return /pdf/.test(mime) ? 'file-pdf' : /csv|sheet|excel/.test(mime) ? 'table'
    : /^image\//.test(mime) ? 'image' : 'file-lines';
}

/** @param {string} text @returns {string} A file name made from a title. */
function slug(text) {
  return text.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();
}

/** @param {Date} date @returns {string} The local date-time as stored in the data, `2026-10-08T10:30`. */
function stamp(date) {
  return formatDate(date, '%Y-%m-%dT%H:%M');
}

/** @param {ChatMessage} message @returns {string} When it was sent, as a time of day. */
function timeOf(message) {
  return formatDate(new Date(message.at), DATE.time);
}

/** @param {string} iso @returns {string} The history group a date falls into. */
function dayBucket(iso) {
  const date = new Date(iso);
  const midnight = (/** @type {Date} */ day) => new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const days = Math.round((midnight(NOW) - midnight(date)) / 86_400_000);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days <= 7 ? 'Previous 7 days' : 'Older';
}
