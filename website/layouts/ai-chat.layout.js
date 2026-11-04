import {
  AgentThread, BlockView, Composer, ContextMenu, CopyInput, Dialog, FileList, InlineLoading, Launcher,
  MenuButton, NumberField, ProgressBar, PromptStarters, Select, Slider, Toggle, appIcon, blocksToMarkdown,
  blocksToText, button, copyButton, downloadBlob, emptyState, formatDate, formatNumber, formatPercent, h, icon,
  prefersReducedMotion, rovingTabindex, stack, uid, watchMotion
} from '../../src/index.js';
import {
  DATE, SHELL_BREAKPOINTS, adaptiveShell, disposer, iconButton, iconTile, later, layoutContext, listTime,
  paneHeader, renderScope, shortcutSheet, shortcuts, suiteNav, toaster
} from './kit.js';
import { ME, NOW, ORGANISATION, person } from './fixtures.js';

/**
 * An assistant answer is a list of blocks in the agent kit's model, which `AgentThread` draws: model
 * output is untrusted text, and inside a text run `**bold**` and `` `code` `` are the only markup.
 * An `artifact` block is a card that opens a document or a piece of code the assistant wrote in the
 * inspector; the thread is given its kind and number of versions to show.
 * @typedef {{type: 'p'|'quote', text: string}
 *   | {type: 'heading', level: 2|3, text: string}
 *   | {type: 'list', ordered: boolean, items: string[]}
 *   | {type: 'code', language: string, code: string}
 *   | {type: 'table', columns: string[], rows: string[][], align?: Array<'start'|'end'>}
 *   | {type: 'artifact', id: string, title: string, kind?: 'code'|'document', versions?: number}} Block
 * @typedef {{name: string, size: number, mime: string}} Attachment
 * One thing the assistant did before it answered: what it was (`label`, and `doing` while it runs),
 * a muted detail, how long it took, and for a web search how many sources it looked at.
 * @typedef {'search'|'read'|'query'|'write'|'run'} StepKind
 * @typedef {{kind: StepKind, label: string, doing: string, detail?: string, ms: number,
 *   sources?: number, stopped?: boolean}} Step
 * A source an answer drew on: a web page, or a file the chat knows.
 * @typedef {{title: string, site: string, url: string, snippet: string, file?: boolean}} Source
 * What the thread is given: plain JSON items (`user`, `answer`, `trace`, `notice`) and sources.
 * @typedef {{id: string, type: string, [key: string]: unknown}} ThreadItem
 * @typedef {{id: string, title: string, kind: 'web'|'file', site: string, snippet: string,
 *   href: string}} ThreadSource
 * One piece of a streamed answer: text for its last paragraph, or a block that arrives whole.
 * @typedef {{text: string}|{block: Block}} Feed
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
function ran(what, detail, ms) { return step('run', `Ran ${what}`, `Running ${what}`, detail, ms); }

/** The glyph each kind of step carries in the trace: a web search is a globe, a query a database. */
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

/** Saved prompts: the composer's commands, from its button or "/" in an empty composer. */
const PROMPTS = [
  { value: 'summary', label: 'Summarise for a manager', description: 'Five bullets with owners and dates', text: 'Summarise the following for a manager in five bullets, with owners and due dates:\n\n' },
  { value: 'reply', label: 'Draft a customer reply', description: 'Friendly, short, one next step', text: 'Draft a short, friendly reply to this customer with one clear next step:\n\n' },
  { value: 'sql', label: 'Explain this query', description: 'What it does and how to speed it up', text: 'Explain what this SQL query does and how to make it faster:\n\n' },
  { value: 'actions', label: 'Turn notes into actions', description: 'Decisions, owners, open questions', text: 'Turn these meeting notes into decisions, action items with owners, and open questions:\n\n' }
];

/** Conversation starters on an empty chat. */
const SUGGESTIONS = [
  { id: 'escalations', title: 'Summarise escalations', text: 'Summarise this week’s customer escalations for the Monday operations review.' },
  { id: 'reply', title: 'Draft a reply', text: 'Draft a friendly reply to Meridian Health asking to move our call to Tuesday.' },
  { id: 'concept', title: 'Explain a concept', text: 'Explain what a LEFT JOIN does, with a short example.' },
  { id: 'analyst', title: 'Ask the analyst', text: '@analyst Which warehouse site’s costs grew fastest this quarter?' }
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

/**
 * How a streamed answer appears: characters per tick, tick length, the pause before it, and the
 * pause after a block that arrives whole — a list, a table, code, or an artifact's card.
 */
const STREAM = { step: 6, tick: 28, think: 650, block: 240 };

/** The chat whose artifact the screen opens with, wherever the inspector fits beside the thread. */
const FIRST_ARTIFACT = 'retry-helper';

/** The composer's context chip while a sent message is being edited. */
const EDIT_CHIP = 'editing';

export default {
  title: 'AI chat',
  category: 'Communication',
  blurb: 'Chat with an assistant that shows its work: tool steps, cited sources, artifacts with versions, agent mentions, and per-chat model settings.',
  components: [
    'AgentThread', 'Composer', 'BlockView', 'RunTrace', 'SourceList', 'Slider', 'FileList', 'CopyInput',
    'Launcher', 'Select', 'InlineLoading', 'ContextMenu', 'MenuButton', 'NumberField', 'Toggle',
    'ProgressBar', 'AppIcon', 'Dialog', 'Message', 'AppSidebar', 'ModuleBar', 'AccountMenu'
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
    const authors = threadAuthors(me.name);
    const state = {
      chatId: 'export-limits',
      view: 'all',
      minutes: 0,
      /**
       * The answer being written: its plan, how far it has got — the step running, then what is
       * still to be fed to the answer — and the timer of its next step.
       * @type {{chat: Chat, message: ChatMessage, plan: Plan, phase: 'steps'|'answer', step: number,
       *   feed: Feed[], timer: number}|null}
       */
      run: null,
      /** @type {{id: string, version: number}|null} The artifact in the inspector. */
      artifact: null,
      /** @type {HTMLElement|null} What opened the inspector — a card, a button — where the focus returns. */
      opener: null,
      /** @type {string|null} The sent message the composer is editing. */
      editing: null
    };
    context.cleanup(() => clearTimeout(state.run?.timer));
    /** @type {Launcher|null} */ let launcher = null;
    /** @type {{dialog: Dialog, link: CopyInput, text: HTMLElement}|null} */ let sharing = null;

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
        syncComposer();
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
    settingsButton.classList.add('chat__aside-toggle');
    settingsButton.setAttribute('aria-controls', asideId);
    settingsButton.setAttribute('aria-expanded', 'false');
    const status = keep(new InlineLoading(null, { status: 'inactive', size: 'sm' }));

    // The conversation is the kit's thread, centred in a scroller of the layout's own whose ends
    // fade under the header and the composer. A new chat shows a welcome in its place. Your own
    // messages offer Edit and Copy on hover or focus; each step kind carries the layout's glyph.
    const column = h('div', { class: 'chat__column' });
    const welcomeScope = renderScope(context);
    const scroller = h('div', { class: 'shell__body chat__thread' }, column);
    const thread = keep(new AgentThread(null, {
      authors,
      scroller,
      answerActions: ['copy', 'regenerate', 'branch', 'rate'],
      userActions: ['edit', 'copy'],
      icons: { regenerate: 'rotate-right', branch: 'code-branch', rateUp: 'thumbs-up', rateDown: 'thumbs-down', edit: 'pen' },
      traceIcons: STEP_ICONS,
      formatTime: (at) => formatDate(new Date(at), DATE.time),
      onaction: (event) => threadAction(event),
      onartifact: ({ detail }) => toggleArtifact(detail.id)
    }));
    // A knowledge file an answer cites opens like a web page does: the thread's sources leave
    // every kind but `web` to the application.
    thread.toElement().addEventListener('zx-select', (event) => {
      const source = /** @type {CustomEvent<{source?: ThreadSource}>} */ (event).detail?.source;
      if (source?.kind === 'file' && source.href?.startsWith('https://')) window.open(source.href, '_blank', 'noopener,noreferrer');
    }, { signal: context.signal });

    // The composer is the kit's. Its placeholder and note name the chat's model and follow the
    // model picker (see `syncComposer()`); beside Attach and the saved prompts its bar has @, which
    // starts a mention, and Parameters, which opens the assistant settings. Esc while editing a sent
    // message gives up the edit.
    const composer = keep(new Composer(null, {
      attachments: true,
      icons: { attach: 'paperclip', commands: 'book-open' },
      mentions: {
        trigger: '@',
        items: AGENTS.map((agent) => ({ id: agent.id, label: agent.name, description: agent.description, icon: agent.icon }))
      },
      commands: PROMPTS.map(({ value, label, description }) => ({ id: value, label, description, icon: 'book-open' })),
      tools: [
        { id: 'mention', label: 'Mention an agent', icon: 'at' },
        { id: 'parameters', label: 'Parameters', icon: 'sliders', pressed: false }
      ],
      onsend: (event) => onSend(event),
      onstop: () => stop(),
      oninput: () => {
        if (!state.run) status.set('inactive', '');
      },
      oncommand: ({ detail }) => usePrompt(String(detail.item.id)),
      ontool: ({ detail }) => (detail.id === 'mention' ? startMention() : toggleSettings()),
      onhistoryprevious: () => editMessage(current().messages.findLast((message) => message.role === 'user')),
      onremove: ({ detail }) => {
        if (detail.kind === 'context' && detail.id === EDIT_CHIP) cancelEdit();
      }
    }));
    const dock = h('div', {
      class: 'chat__dock',
      onkeydown: (/** @type {KeyboardEvent} */ event) => {
        if (event.key !== 'Escape' || event.defaultPrevented || !state.editing) return;
        event.preventDefault();
        cancelEdit();
      }
    }, h('div', { class: 'chat__composer' }, composer.toElement()));

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
      h('div', { class: 'chat__stage' }, scroller),
      dock);

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

    // An artifact: what it is, its versions, Copy and Download, and its content on the canvas —
    // drawn by a BlockView of its own, made again for each version shown.
    const artifactGlyph = h('span', { class: 'chat__artifact-glyph' });
    const artifactName = h('span');
    const artifactVersions = h('div', { class: 'chat__version-switch' });
    const artifactNote = h('span', { class: 'chat__version-note' });
    const artifactBody = h('div', {
      class: 'shell__body chat__artifact-body', role: 'region', tabindex: '0', 'aria-label': 'Artifact'
    });
    const artifactCanvas = renderScope(context);
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
        ['Saved prompts, in an empty composer', '/'], ['Edit your last message, in an empty composer', '↑'],
        ['Next message, from a message', 'PageDown'], ['Previous message, from a message', 'PageUp']
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
      '/': () => composer.focus(),
      '?': () => openShortcuts(),
      // Esc stops a running answer; with nothing running it is left to whatever holds the layout.
      Escape: () => (state.run ? stop() : false)
    }, context);

    openChat(state.chatId);
    container.append(root);
    // Where the inspector fits beside the conversation, the screen opens with the code the latest
    // answer wrote; on a narrower screen its card in the answer opens it.
    if (preview || !asDrawer()) openArtifact(FIRST_ARTIFACT, { focus: false });
    thread.scrollToEnd();

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
      cancelEdit();
      for (let index = chats.length - 1; index >= 0; index -= 1) {
        if (chats[index].messages.length === 0 && chats[index].id !== id) chats.splice(index, 1);
      }
      state.chatId = id;
      const chat = current();
      if (chat.archived && state.view !== 'archive') showView('archive');
      modelSelect.set(chat.model, { silent: true });
      more.setItems(chatMenu(chat));
      if (state.artifact && !aside.hidden && aside.dataset.view === 'artifact' && !carries(chat, state.artifact.id)) {
        setInspector(null, { focus: false });
      }
      syncComposer();
      renderTitle();
      renderThread();
      renderHistory();
      renderSettings();
      status.set('inactive', '');
    }

    /**
     * @param {Chat} chat @param {string} artifactId
     * @returns {boolean} Whether an answer in the chat carries the artifact's card.
     */
    function carries(chat, artifactId) {
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
      composer.focus();
    }

    /**
     * What the composer sends: a new message, or the edit of the last one.
     * @param {CustomEvent<{text: string, files: File[], context: Array<{id: string}>}>} event
     * @returns {void}
     */
    function onSend({ detail }) {
      if (detail.context.some((chip) => chip.id === EDIT_CHIP)) resend(detail.text);
      else send(detail.text, detail.files.map((file) => ({ name: file.name, size: file.size, mime: file.type })));
    }

    /**
     * Sends a message (or a suggestion) and streams the answer. A message that mentions an agent
     * is answered by that agent.
     * @param {string} text
     * @param {Attachment[]} [files]
     * @returns {void}
     */
    function send(text, files = []) {
      const chat = current();
      const value = text.trim();
      if (state.run || (!value && files.length === 0)) return;
      const at = clock();
      chat.messages.push({ id: uid('message'), role: 'user', at, text: value, files });
      if (chat.messages.length === 1) {
        chat.title = value.length > 48 ? `${value.slice(0, 46).trimEnd()}…` : value || files[0].name;
      }
      chat.updated = at;
      renderTitle();
      if (chat.messages.length === 1) renderThread();
      else for (const item of messageItems(chat, chat.messages.length - 1)) thread.upsert(item);
      thread.scrollToEnd();
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
     * Writes an answer into the thread: first its steps, one at a time, in an open timeline, then
     * the answer — text a few characters at a time, every other block whole. Once it is written the
     * steps fold into the answer's own summary, and follow it from version to version. Under
     * reduced motion, and in a preview, the whole answer appears at once. The run owns its timer,
     * so Stop, switching chats, and unmounting all cancel the next step. Given a `message`, the
     * answer is written into it as a new version.
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
        clearTurn(chat, message);
        for (const item of messageItems(chat, chat.messages.indexOf(message))) thread.upsert(item);
        syncInspector();
        renderHistory();
        renderUsage();
        status.set('success', 'Answer ready');
        return;
      }
      /** @type {NonNullable<typeof state.run>} */
      const run = { chat, message, plan, phase: steps.length ? 'steps' : 'answer', step: 0, feed: [], timer: 0 };
      state.run = run;
      composer.setBusy(true);
      clearTurn(chat, message);
      const day = dayItem(chat, chat.messages.indexOf(message));
      if (day) thread.upsert(day);
      if (steps.length) {
        thread.upsert({
          id: traceId(message), type: 'trace', author: authorOf(chat, message), at: message.at, open: true,
          steps: traceSteps(message.id, steps.slice(0, 1), 0)
        });
      } else startAnswer(run);
      renderHistory();
      const author = authors[authorOf(chat, message)].name;
      const tick = () => {
        if (state.run !== run) return;
        if (run.phase === 'steps') {
          run.step += 1;
          const running = run.step < steps.length ? run.step : -1;
          thread.patch(traceId(message), { steps: traceSteps(message.id, steps.slice(0, run.step + 1), running) });
          if (running >= 0) {
            status.set('active', `${steps[running].doing}…`);
            run.timer = window.setTimeout(tick, stepDelay(steps[running]));
          } else {
            run.phase = 'answer';
            startAnswer(run);
            status.set('active', `${author} is writing…`);
            run.timer = window.setTimeout(tick, STREAM.think);
          }
          return;
        }
        const next = run.feed.shift();
        if (!next) {
          finishRun();
          return;
        }
        feed(message, next);
        run.timer = window.setTimeout(tick, 'block' in next ? STREAM.block : STREAM.tick);
      };
      status.set('active', steps.length ? `${steps[0].doing}…` : `${author} is writing…`);
      run.timer = window.setTimeout(tick, steps.length ? stepDelay(steps[0]) : STREAM.think);
    }

    /**
     * Opens the running answer in the thread, empty and streaming, with what is to be fed into it.
     * @param {NonNullable<typeof state.run>} run
     * @returns {void}
     */
    function startAnswer(run) {
      run.message.sources = run.plan.sources ?? [];
      putAnswer(run.chat, run.message, { streaming: true });
      run.feed = feedOf(run.plan.blocks);
    }

    /**
     * Feeds the running answer: text into its last paragraph, any other block whole. Only the end
     * of the answer changes, and the end stays in view while the reader is there.
     * @param {ChatMessage} message
     * @param {Feed} next
     * @returns {void}
     */
    function feed(message, next) {
      if ('text' in next) {
        thread.appendText(message.id, next.text);
        return;
      }
      thread.appendBlock(message.id, answerBlocks([next.block])[0]);
      if (next.block.type === 'artifact') syncInspector();
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
     * Ends the running answer — completed, the rest appearing at once, or stopped where it was. The
     * timeline of its steps gives way to the answer's own, folded into their one-line summary.
     * @param {{stopped?: boolean}} [options]
     * @returns {void}
     */
    function finishRun({ stopped = false } = {}) {
      const run = state.run;
      if (!run) return;
      clearTimeout(run.timer);
      state.run = null;
      const { chat, message, plan } = run;
      const steps = plan.steps ?? [];
      const answering = run.phase === 'answer';
      if (!stopped && !answering) startAnswer(run);
      if (!stopped) for (const next of run.feed.splice(0)) feed(message, next);
      if (stopped) {
        message.steps = answering ? steps : [...steps.slice(0, run.step), { ...steps[run.step], stopped: true }];
        message.blocks = answering ? /** @type {{blocks?: Block[]}|null} */ (thread.get(message.id))?.blocks ?? [] : [];
        message.sources = answering ? plan.sources ?? [] : [];
      } else complete(message, plan);
      message.stopped = stopped;
      if (message.versions) message.versions[message.version ?? 0] = snapshot(message);
      composer.setBusy(false);
      status.set(stopped ? 'inactive' : 'success', stopped ? 'Stopped' : 'Answer ready');
      thread.remove(traceId(message));
      const written = Boolean(thread.get(message.id));
      if (written) thread.patch(message.id, { streaming: false, stopped });
      // Drawn again with its steps, and with every version complete for the thread to page through.
      if (!written || message.steps?.length || message.versions) putAnswer(chat, message);
      renderUsage();
      renderHistory();
    }

    /** Stops the running answer, keeping what was written so far. @returns {void} */
    function stop() {
      if (state.run) finishRun({ stopped: true });
    }

    // ----------------------------------------------------------------- the thread --

    /**
     * What one message is in the thread: the day it starts, if the one before it was sent on
     * another; the message itself — your text with the agents it calls on, or an answer with the
     * steps it took — and, after the message a branch was cut at, where it came from.
     * @param {Chat} chat
     * @param {number} index
     * @returns {ThreadItem[]}
     */
    function messageItems(chat, index) {
      const message = chat.messages[index];
      return [
        dayItem(chat, index),
        message.role === 'user' ? {
          id: message.id, type: 'user', author: 'me', at: message.at, text: message.text ?? '',
          mentions: mentionsIn(message.text ?? ''),
          files: (message.files ?? []).map(({ name, size }) => ({ name, size }))
        } : answerItem(chat, message),
        branchItem(chat, index)
      ].filter((item) => item !== null);
    }

    /**
     * @param {Chat} chat @param {number} index
     * @returns {ThreadItem|null} The day a message starts, when the message before it was sent on another.
     */
    function dayItem(chat, index) {
      const at = chat.messages[index].at;
      const previous = chat.messages[index - 1];
      const day = formatDate(new Date(at), DATE.day);
      if (previous && formatDate(new Date(previous.at), DATE.day) === day) return null;
      return { id: `day:${at.slice(0, 10)}`, type: 'notice', text: day };
    }

    /**
     * @param {Chat} chat @param {number} index
     * @returns {ThreadItem|null} Where a branch left the chat it came from, under the message it was
     *   cut after, with the way back while that chat is still there.
     */
    function branchItem(chat, index) {
      if (!chat.branchOf || index !== chat.branchOf.after - 1) return null;
      const source = chats.find((entry) => entry.id === chat.branchOf?.id);
      return {
        id: 'branch', type: 'notice', text: `Branched from “${source?.title ?? chat.branchOf.title}”`,
        ...(source ? { action: { id: 'back', label: 'Back to original' } } : {})
      };
    }

    /**
     * An answer as the thread draws it: its steps, blocks and sources, its rating, and — once it was
     * regenerated — every version with its own steps, the one showing taken from the message itself.
     * @param {Chat} chat
     * @param {ChatMessage} message
     * @returns {ThreadItem}
     */
    function answerItem(chat, message) {
      const versions = (message.versions?.length ?? 0) > 1 ? /** @type {AnswerVersion[]} */ (message.versions) : null;
      const showing = message.version ?? 0;
      const content = (/** @type {AnswerVersion|ChatMessage} */ shown) => ({
        blocks: answerBlocks(shown.blocks ?? []), sources: (shown.sources ?? []).map(sourceOf),
        steps: traceSteps(message.id, shown.steps ?? [])
      });
      return {
        id: message.id, type: 'answer', author: authorOf(chat, message), at: message.at, ...content(message),
        stopped: Boolean(message.stopped), rating: message.rating ?? null,
        ...(versions ? {
          version: showing,
          versions: versions.map((version, index) => {
            const shown = index === showing ? message : version;
            return { ...content(shown), at: shown.at };
          })
        } : {})
      };
    }

    /**
     * Adds an answer at the end of the thread, with the note of a branch cut after it.
     * @param {Chat} chat
     * @param {ChatMessage} message
     * @param {Record<string, unknown>} [extra] Fields over the answer's own: `streaming`.
     * @returns {void}
     */
    function putAnswer(chat, message, extra = {}) {
      thread.upsert({ ...answerItem(chat, message), ...extra });
      const note = branchItem(chat, chat.messages.indexOf(message));
      if (note) thread.upsert(note);
      syncInspector();
    }

    /**
     * Takes an answer that is written again out of the thread, its steps with it, and the note of
     * a branch cut after it.
     * @param {Chat} chat
     * @param {ChatMessage} message
     * @returns {void}
     */
    function clearTurn(chat, message) {
      thread.remove(message.id);
      if (branchItem(chat, chat.messages.indexOf(message))) thread.remove('branch');
    }

    /**
     * An answer's blocks with each artifact's kind and number of versions, which its card shows.
     * @param {Block[]} blocks
     * @returns {Block[]}
     */
    function answerBlocks(blocks) {
      return blocks.map((block) => {
        const item = block.type === 'artifact' ? artifactById(block.id) : undefined;
        return item ? { ...block, kind: item.kind, versions: item.versions.length } : block;
      });
    }

    /**
     * @param {Chat} chat @param {ChatMessage} message
     * @returns {string} The thread author of an answer: its agent on its model, or the model.
     */
    function authorOf(chat, message) {
      const model = message.model ?? chat.model;
      return message.agent ? `${message.agent}@${model}` : model;
    }

    /**
     * What the thread asks of a message: edit your own; regenerate, branch, rate, or page through
     * the versions of an answer; or, from the note where a branch began, go back to the original.
     * @param {CustomEvent<{item: ThreadItem, action: string, value?: unknown}>} event
     * @returns {void}
     */
    function threadAction(event) {
      const { item, action, value } = event.detail;
      const chat = current();
      if (item.type === 'notice') {
        const source = chats.find((entry) => entry.id === chat.branchOf?.id);
        if (action !== 'back' || !source) return;
        openChat(source.id);
        focusTitle();
        return;
      }
      const message = chat.messages.find((entry) => entry.id === item.id);
      if (!message) return;
      if (action === 'edit') editMessage(message);
      else if (action === 'regenerate') regenerate();
      else if (action === 'branch') branchFrom(message);
      else if (action === 'rate') {
        message.rating = value === 'up' || value === 'down' ? value : null;
        if (message.rating) notify('Thanks — your feedback helps tune the assistant.');
      } else if (action === 'version') pageVersion(event, chat, message, Number(value));
    }

    /**
     * The thread pages to another version of an answer, its steps with it, and keeps the focus on
     * the pager; the chat follows, so its preview, its export, and the inspector's cards agree. A
     * version also keeps its own rating and whether it was stopped, which the thread holds for the
     * answer as a whole: where those differ, the answer is drawn again from the chat.
     * @param {CustomEvent} event The thread's `version` action, cancelled while an answer is written.
     * @param {Chat} chat
     * @param {ChatMessage} message
     * @param {number} index
     * @returns {void}
     */
    function pageVersion(event, chat, message, index) {
      const versions = message.versions;
      if (!versions?.[index] || state.run) {
        event.preventDefault();
        return;
      }
      versions[message.version ?? 0] = snapshot(message);
      const before = { rating: message.rating ?? null, stopped: Boolean(message.stopped) };
      Object.assign(message, versions[index]);
      message.version = index;
      if ((message.rating ?? null) !== before.rating || Boolean(message.stopped) !== before.stopped) {
        event.preventDefault();
        thread.upsert(answerItem(chat, message));
      }
      // The thread draws the version once this event is over; its artifact cards then take their state.
      queueMicrotask(syncInspector);
      renderHistory();
      renderUsage();
    }

    /** Keeps the newest output in view, as the chat opens. @returns {void} */
    function renderThread() {
      const chat = current();
      thread.setItems(chat.messages.flatMap((_, index) => messageItems(chat, index)));
      welcomeScope.reset();
      column.replaceChildren(chat.messages.length ? thread.toElement() : welcome(chat));
      syncInspector();
      thread.scrollToEnd();
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

    /**
     * The empty state of a new chat: a greeting and a few conversation starters.
     * @param {Chat} chat
     * @returns {HTMLElement}
     */
    function welcome(chat) {
      const model = modelById(chat.model);
      const starters = welcomeScope.own(new PromptStarters(h('div', { class: 'chat__starters' }), {
        items: SUGGESTIONS,
        onpick: ({ detail }) => {
          send(detail.item.text);
          // The starter that was pressed has gone with the welcome: to the composer, where Esc
          // stops the answer.
          composer.focus();
        }
      }));
      return h('div', { class: 'chat__welcome' },
        appIcon({ icon: model.icon, size: 48, shape: 'circle' }),
        h('h3', { class: 'chat__welcome-title' }, `What can I help with, ${me.name.split(' ')[0]}?`),
        h('p', { class: 'meta' }, `${model.name} · ${model.description}`),
        starters.toElement());
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
      // The button that asked has gone with the old answer: to the composer, where Esc stops the
      // new one, or to the new answer.
      if (document.activeElement && document.activeElement !== document.body && root.contains(document.activeElement)) return;
      if (state.run) composer.focus();
      else thread.reveal(`item:${message.id}`);
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
      if (index < 0 || state.run) return;
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
      composer.focus();
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
     * A message's Edit, or ↑ in an empty composer for the last one: the message goes back into the
     * composer, marked by a chip, and sending it drops everything after it and asks again. Removing
     * the chip, or Esc, gives up the edit.
     * @param {ChatMessage|undefined} message One of yours.
     * @returns {void}
     */
    function editMessage(message) {
      const chat = current();
      if (!message?.id) return;
      stop();
      const last = chat.messages.findLast((entry) => entry.role === 'user') === message;
      state.editing = message.id;
      composer.addContext({ id: EDIT_CHIP, label: last ? 'Editing your last message' : 'Editing your message', icon: 'pen' });
      composer.setValue(message.text ?? '');
      composer.focus();
    }

    /** Gives up editing a sent message. @returns {void} */
    function cancelEdit() {
      if (!state.editing) return;
      state.editing = null;
      composer.removeContext(EDIT_CHIP);
      composer.clear();
    }

    /**
     * Saves the edit of a sent message and asks again.
     * @param {string} text
     * @returns {void}
     */
    function resend(text) {
      const chat = current();
      const message = chat.messages.find((entry) => entry.id === state.editing);
      state.editing = null;
      composer.removeContext(EDIT_CHIP);
      if (!message || !text) return;
      message.text = text;
      chat.messages.splice(chat.messages.indexOf(message) + 1);
      renderThread();
      const { plan, agent } = planFor(chat, text);
      stream(chat, plan, { agent });
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
        // A table rather than the generic glyph FileItem has for CSV.
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

    // ------------------------------------------------------------------ composer --

    /**
     * Names the open chat's model in the composer's placeholder and note. The composer changes in
     * place: what was written, attached, and the edit chip all stay, and so does the focus.
     * @returns {void}
     */
    function syncComposer() {
      const model = modelById(current().model);
      composer.update({
        placeholder: `Message ${model.name} — / for prompts, @ for agents`,
        note: `${model.name} can make mistakes. Check figures before you share them.`
      });
    }

    /**
     * The composer's @: starts a mention at the caret, after a space when the caret ends a word, and
     * the composer opens its list of agents.
     * @returns {void}
     */
    function startMention() {
      composer.insertText(/\S$/.test(composer.getValue()) ? ' @' : '@');
    }

    /** @param {string} value Saved prompt id. @returns {void} */
    function usePrompt(value) {
      const prompt = PROMPTS.find((entry) => entry.value === value);
      if (!prompt) return;
      const text = composer.getValue();
      composer.setValue(text ? `${text.trimEnd()}\n\n${prompt.text}` : prompt.text);
      // After the prompt list has handed the focus back.
      later(context, () => composer.focus(), 0);
    }

    // ------------------------------------------------------------------- actions --

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
     * Where the focus goes when the inspector closes with the focus in it: what opened it — an
     * artifact's card, the header's settings button, the composer's Parameters — while it is still
     * there, else a button that opens the settings again, else the composer.
     * @returns {{focus: () => void}}
     */
    function returnTarget() {
      const opener = state.opener;
      if (opener?.isConnected && opener.checkVisibility()) return opener;
      return aside.dataset.view === 'settings' && settingsButton.checkVisibility() ? settingsButton : composer;
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
      if (hadFocus) target.focus();
    }

    /**
     * Keeps what opens the inspector in step with it: the settings button and Parameters show the
     * settings are open, and an answer's artifact card is a disclosure of the inspector, expanded
     * while its artifact shows there. Called again whenever the thread draws an answer.
     * @returns {void}
     */
    function syncInspector() {
      const shown = inspectorShown();
      const view = aside.dataset.view;
      settingsButton.setAttribute('aria-expanded', String(shown && view === 'settings'));
      composer.setToolPressed('parameters', shown && view === 'settings');
      for (const item of artifacts) {
        thread.setArtifactState(item.id, {
          expanded: shown && view === 'artifact' && state.artifact?.id === item.id, controls: asideId
        });
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
        const active = document.activeElement;
        state.opener = active instanceof HTMLElement && root.contains(active) && !aside.contains(active) ? active : null;
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
     * @param {{version?: number, focus?: boolean}} [options] `version` is an index; the latest by
     *   default.
     * @returns {void}
     */
    function openArtifact(id, { version, focus = true } = {}) {
      const item = artifactById(id);
      if (!item) return;
      state.artifact = { id, version: version ?? item.versions.length - 1 };
      renderArtifact();
      setInspector('artifact', { focus });
    }

    /**
     * The card in an answer: opens its artifact, or closes it when it is the one showing.
     * @param {string} id
     * @returns {void}
     */
    function toggleArtifact(id) {
      if (inspectorShown() && aside.dataset.view === 'artifact' && state.artifact?.id === id) setInspector(null);
      else openArtifact(id);
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
      artifactCanvas.reset();
      const view = artifactCanvas.own(new BlockView(null, {
        blocks: typeof version.content === 'string'
          ? [{ type: 'code', language: item.language ?? '', code: version.content, lines: true }]
          : version.content
      }));
      artifactBody.replaceChildren(h('div', { class: 'chat__artifact-canvas' }, view.toElement()));
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

// ------------------------------------------------------------- the agent kit --

/**
 * Who writes in the thread: the signed-in user; each model, marked by its glyph; and each agent on
 * each model, marked by its glyph in its own tone, whose byline names the model it ran on.
 * @param {string} name The signed-in user's name.
 * @returns {Record<string, {name: string, kind: 'person'|'agent'|'model', icon?: string, tone?: string, via?: string}>}
 */
function threadAuthors(name) {
  /** @type {Record<string, {name: string, kind: 'person'|'agent'|'model', icon?: string, tone?: string, via?: string}>} */
  const authors = { me: { name, kind: 'person' } };
  for (const model of MODELS) {
    authors[model.ID] = { name: model.name, kind: 'model', icon: model.icon };
    for (const agent of AGENTS) {
      authors[`${agent.id}@${model.ID}`] = { name: agent.name, kind: 'agent', icon: agent.icon, tone: agent.tone, via: model.name };
    }
  }
  return authors;
}

/**
 * @param {ChatMessage} message
 * @returns {string} The id of the timeline an answer's steps run in while it is written.
 */
function traceId(message) {
  return `${message.id}:steps`;
}

/**
 * An answer's steps as the thread's trace draws them: each step's detail is the muted line under
 * it, and a step that was stopped took no time worth counting.
 * @param {string|undefined} id The answer's id.
 * @param {Step[]} steps
 * @param {number} [running] The step that is running, if any.
 * @returns {Array<Record<string, unknown>>}
 */
function traceSteps(id, steps, running = -1) {
  return steps.map((entry, index) => ({
    id: `${id}:${index}`, kind: entry.kind, label: entry.label, doing: entry.doing, count: entry.detail,
    status: index === running ? 'running' : entry.stopped ? 'stopped' : 'done',
    ...(entry.stopped ? {} : { ms: entry.ms }),
    ...(entry.sources ? { sources: entry.sources } : {})
  }));
}

/**
 * A page or a file an answer cites, as the thread's sources take it: a web page opens itself, a
 * file names itself on its chip.
 * @param {Source} source
 * @returns {ThreadSource}
 */
function sourceOf(source) {
  return {
    id: source.url, title: source.title, kind: source.file ? 'file' : 'web',
    site: source.file ? source.title : source.site, snippet: source.snippet, href: source.url
  };
}

/**
 * What an answer is fed as it streams: its text a few characters at a time, every other block
 * whole. A `**bold**` or `` `code` `` run arrives in one piece, so its markers never show, and a
 * paragraph that follows another starts with the blank line that opens it.
 * @param {Block[]} blocks
 * @returns {Feed[]}
 */
function feedOf(blocks) {
  return blocks.flatMap((block, index) => {
    if (block.type !== 'p') return [{ block }];
    const lead = index > 0 && blocks[index - 1].type === 'p' ? '\n\n' : '';
    const pieces = block.text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).filter(Boolean)
      .flatMap((part) => (/^(?:\*\*|`)/.test(part) ? [part] : part.match(new RegExp(`[\\s\\S]{1,${STREAM.step}}`, 'g')) ?? []));
    return pieces.map((text, at) => ({ text: at ? text : lead + text }));
  });
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
 * @returns {string[]} The agents the text calls on, as it writes them (`analyst`, `Analyst`), which
 *   the thread tints.
 */
function mentionsIn(text) {
  return [...text.matchAll(/(?:^|\s)@([a-z][\w-]*)/gi)]
    .map((match) => match[1])
    .filter((name) => AGENTS.some((agent) => agent.id === name.toLowerCase()));
}

/**
 * @param {string} text
 * @returns {Agent|undefined} The first agent the text mentions with `@handle` or `@Name`.
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

/** @param {string} text @returns {string} A file name made from a title. */
function slug(text) {
  return text.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();
}

/** @param {Date} date @returns {string} The local date-time as stored in the data, `2026-10-08T10:30`. */
function stamp(date) {
  return formatDate(date, '%Y-%m-%dT%H:%M');
}

/** @param {string} iso @returns {string} The history group a date falls into. */
function dayBucket(iso) {
  const date = new Date(iso);
  const midnight = (/** @type {Date} */ day) => new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const days = Math.round((midnight(NOW) - midnight(date)) / 86_400_000);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days <= 7 ? 'Previous 7 days' : 'Older';
}
