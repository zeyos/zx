import {
  ActivityList, Avatar, Breadcrumb, CodeEditor, CopyInput, Dialog, Fieldset,
  Groupbox, InlineLoading, Launcher, MenuButton, Select, Sheet, SplitView, Toolbar, TreeView, button,
  copyButton, debounce, downloadBlob, emptyState, formatDate, formatNumber, formatRelativeTime, h,
  icon
} from '../../src/index.js';
import {
  DATE, adaptiveShell, disposer, iconButton, iconTile, kbd, layoutContext, modShortcut, modifierLabel,
  paneHeader, propList, renderScope, sectionLabel, shortcuts, suiteNav, toaster, unavailable
} from './kit.js';
import { ME, NOW, PEOPLE, person } from './fixtures.js';

/** Spaces group pages by team. Each has its own tree, and a tone that tells its tile apart. */
const SPACES = [
  { ID: 'engineering', name: 'Engineering', icon: 'code-branch', tone: 'blue', description: 'Architecture, runbooks, and how we ship.', owner: 'camille', created: '2024-02-12' },
  { ID: 'operations', name: 'Operations', icon: 'warehouse', tone: 'amber', description: 'Depots, vendors, and planning.', owner: 'ines', created: '2024-05-06' },
  { ID: 'handbook', name: 'Handbook', icon: 'book-open', tone: 'violet', description: 'How ACME works, for everyone.', owner: 'ines', created: '2023-11-20' }
];

/** Pages the signed-in user has starred. */
const FAVORITES = ['incident', 'api-style', 'welcome'];

/** The editor's width, in pixels, below which the Markdown and its preview take turns. */
const SIDE_BY_SIDE = 640;

/**
 * Template tag for page bodies: removes the indentation the surrounding code adds, so a body can
 * sit indented inside its object and still be plain Markdown starting at column zero.
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 * @returns {string}
 */
function md(strings, ...values) {
  const text = strings.reduce((out, part, index) => out + part + (values[index] ?? ''), '');
  const lines = text.replace(/^\n+|\s+$/g, '').split('\n');
  const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => /^ */.exec(line)[0].length));
  return lines.map((line) => line.slice(indent)).join('\n');
}

/**
 * Every page, flat; `parent` builds the tree. Bodies are Markdown: `##` headings, `~~~` code
 * fences, `> [!note]` callouts, `- [ ]` checklists, pipe tables, `![caption](figure)` images,
 * `[label](page:id)` links, and `@id` mentions of people in `PEOPLE`.
 */
const PAGES = [
  { ID: 'start', space: 'engineering', parent: null, title: 'Start here', author: 'piet', editor: 'piet', created: '2024-02-12T09:00', updated: '2026-09-14T10:05', contributors: ['piet', 'camille'], body: md`
    This space is where Engineering writes things down: how we ship, what to do when something breaks, and the rules our public API follows.

    > [!tip] Can't find something?
    > Press **⌘K** and type a few words. Search covers page titles and headings in every space.

    - [Release process](page:release) — the weekly train, step by step
    - [Incident response](page:incident) — severities, roles, and the first fifteen minutes
    - [API style guide](page:api-style) — naming, errors, and versioning` },
  { ID: 'shipping', space: 'engineering', parent: null, title: 'How we ship', author: 'camille', editor: 'camille', created: '2024-03-01T14:00', updated: '2026-08-27T11:40', contributors: ['camille'], body: md`
    We release small changes often. These pages describe the path from a pull request to production, and the guard rails along the way.` },
  { ID: 'release', space: 'engineering', parent: 'shipping', title: 'Release process', author: 'camille', editor: 'jonas', created: '2025-11-03T10:00', updated: '2026-10-06T16:20', contributors: ['camille', 'jonas', 'owen', 'piet'], viewers: ['jonas', 'owen', 'camille'], history: [['owen', '2026-09-28T09:10', 'added the Monday review by Support'], ['camille', '2026-09-02T15:45', 'split the rollout into three waves']], body: md`
    ACME ships the platform every **Tuesday**. This page is the checklist the release captain works through, and the reference for everyone who wants to know what happens between merging a pull request and a customer seeing the change.

    > [!note] Release captain this cycle
    > @jonas runs release 4.12. Questions go to the #releases channel rather than to direct messages, so the next captain can find the answer.

    ## Schedule

    | Day | What happens | Owner |
    | --- | --- | --- |
    | Thursday | Release branch is cut from \`main\` at 16:00 | Release captain |
    | Friday | Staging deploy, smoke tests, changelog draft | Release captain |
    | Monday | Customer-facing notes reviewed | @owen |
    | Tuesday | Production rollout in three waves | Release captain |

    Anything merged after the cut waits for the next train. Hotfixes are the only exception; they follow [Incident response](page:incident).

    ## Cutting the branch

    Run the release script from a clean checkout. It tags the commit, opens the release branch, and writes the changelog draft for review.

    ~~~bash
    git switch main && git pull --ff-only
    npm run release -- --cut 4.12
    npm run release -- --changelog > CHANGELOG.draft.md
    ~~~

    ### Checks before the cut

    - [x] Every migration on \`main\` can be rolled back
    - [x] Flags for unfinished work default to off
    - [ ] Load test of the export service is green
    - [ ] Each changelog entry has a customer-facing sentence

    ## Rolling out

    Production rollout happens in three waves, so a bad build reaches as few customers as possible. Each wave waits until the dashboards have stayed quiet for *30 minutes*.

    ![Rollout waves — internal tenants, then 10 % of customers, then everyone](figure)

    > [!warning] Never skip a wave
    > If a wave shows an error rate above **0.5 %**, stop the rollout and page the on-call engineer. Rolling back is always cheaper than debugging in production.

    ## After the release

    1. Close the milestone and move leftovers to the next one.
    2. Post the summary in #releases with the build number.
    3. Hand the captain role to the next person on the rota.` },
  { ID: 'review', space: 'engineering', parent: 'shipping', title: 'Code review guidelines', author: 'piet', editor: 'marta', created: '2024-06-18T13:30', updated: '2026-09-21T09:15', contributors: ['piet', 'marta', 'camille'], body: md`
    Every change to \`main\` is reviewed by one other engineer. Reviews are about the code, never about its author.

    ## What reviewers look for

    - The change does one thing, and its title says which
    - Tests cover the behaviour, not the implementation
    - Public APIs have documentation and a changelog entry

    ## Response times

    | Size | First response | Merged within |
    | --- | ---: | ---: |
    | Small, under 100 lines | 4 hours | 1 day |
    | Medium | 1 day | 2 days |
    | Large, over 600 lines | Split it first | — |

    > [!tip] Make it easy to say yes
    > Open a draft early and ask one specific question. “Is this the right place for the cache?” gets an answer in minutes.` },
  { ID: 'flags', space: 'engineering', parent: 'shipping', title: 'Feature flags', author: 'camille', editor: 'camille', created: '2025-01-09T11:00', updated: '2026-07-30T17:05', contributors: ['camille', 'jonas'], body: md`
    Unfinished work ships behind a flag that defaults to off. Flags are cheap to add and expensive to forget, so every flag has an owner and an expiry date.

    ~~~ts
    if (flags.enabled('export-v2', { tenant })) {
      return exportV2(report);
    }
    ~~~

    ## Retiring a flag

    - [ ] The flag has been on for every tenant for two weeks
    - [ ] The old code path is deleted
    - [ ] The flag is removed from the admin console` },
  { ID: 'runbooks', space: 'engineering', parent: null, title: 'Runbooks', author: 'jonas', editor: 'jonas', created: '2024-04-22T08:30', updated: '2026-09-02T12:00', contributors: ['jonas'], body: md`
    Step-by-step guides for whoever holds the pager. Every runbook opens with how to tell that you are in the right one.` },
  { ID: 'incident', space: 'engineering', parent: 'runbooks', title: 'Incident response', author: 'jonas', editor: 'camille', created: '2024-04-22T09:00', updated: '2026-10-07T18:30', contributors: ['jonas', 'camille', 'nadine', 'ines'], body: md`
    An incident is anything that stops customers from doing their work or puts their data at risk. When in doubt, declare one: closing an incident that turned out to be harmless costs five minutes.

    ## Severity levels

    | Level | Example | Response | Updates |
    | --- | --- | --- | --- |
    | **SEV 1** | Platform down for every tenant | Immediately, around the clock | Every 30 min |
    | **SEV 2** | One feature broken for many tenants | Within 30 min | Hourly |
    | **SEV 3** | Slow, but a workaround exists | Next business day | Daily |

    ## Declaring an incident

    1. Post \`/incident declare\` in #ops with a one-line summary.
    2. Take the incident commander role, or hand it on explicitly.
    3. Open the status page draft and publish the first update.

    > [!danger] Customer data
    > If customer data may have left our systems, call @ines and the data protection officer before anything else. The clock for regulatory notification starts now.

    ## During the incident

    - [ ] Incident commander named in the channel topic
    - [ ] Status page updated within 15 minutes
    - [ ] Timeline kept in the incident document
    - [ ] Customer Success briefed by @nadine

    ### Useful commands

    ~~~bash
    acme-ctl status --env production
    acme-ctl logs api --since 30m --level error
    acme-ctl rollback api --to previous
    ~~~

    ## Afterwards

    Write the review within five working days. Reviews are blameless: they describe what the system allowed to happen, not who pressed the button.` },
  { ID: 'failover', space: 'engineering', parent: 'runbooks', title: 'Database failover', author: 'jonas', editor: 'jonas', created: '2025-03-14T16:00', updated: '2026-08-11T08:50', contributors: ['jonas', 'piet'], body: md`
    The primary database runs in FRA1 with a synchronous replica in BER2. Failover is automatic; this runbook covers the cases where it is not.

    > [!warning] Before you start
    > Confirm that the primary is really gone. A failover during a network partition can leave you with two primaries.

    ~~~bash
    acme-ctl db status --cluster main
    acme-ctl db promote --cluster main --replica ber2-db-1
    ~~~

    - [ ] Replica lag below one second before promoting
    - [ ] Application connection strings updated
    - [ ] Old primary fenced so it cannot accept writes` },
  { ID: 'api-style', space: 'engineering', parent: null, title: 'API style guide', author: 'piet', editor: 'piet', created: '2024-09-02T10:30', updated: '2026-09-29T14:10', contributors: ['piet', 'camille', 'owen'], body: md`
    The public API is the product for a third of our customers. These rules keep it predictable.

    ## Naming

    | Thing | Style | Example |
    | --- | --- | --- |
    | Resources | Plural nouns | \`/invoices\` |
    | Fields | snake_case | \`due_date\` |
    | Enums | Lowercase strings | \`"overdue"\` |

    ## Errors

    Every error has a stable \`code\`, a sentence a person can read, and a link to the documentation.

    ~~~json
    {
      "code": "invoice_locked",
      "message": "Finalised invoices cannot be edited.",
      "docs": "https://developers.acme.example/errors#invoice_locked"
    }
    ~~~` },
  { ID: 'rollout', space: 'operations', parent: null, title: 'Picking system rollout', author: 'lea', editor: 'ines', created: '2026-06-01T09:00', updated: '2026-10-07T07:40', contributors: ['lea', 'ines', 'tobias'], body: md`
    The new picking system goes live in three depots before peak season. @lea owns the plan; this page tracks where each depot stands.

    | Depot | Go-live | Status |
    | --- | --- | --- |
    | Munich | 12 October | Ready |
    | Hamburg | 26 October | Training |
    | Rotterdam | 9 November | Hardware ordered |

    ## Go-live checklist

    - [x] Scanners paired and tested on every shift
    - [x] Pick paths imported from the old system
    - [ ] Night shift trained on exceptions
    - [ ] Fallback to paper lists rehearsed` },
  { ID: 'vendors', space: 'operations', parent: null, title: 'Vendor onboarding', author: 'ruth', editor: 'ruth', created: '2025-02-17T10:00', updated: '2026-09-09T13:20', contributors: ['ruth', 'ines'], body: md`
    New suppliers are set up by Finance before the first purchase order goes out.

    1. Request the vendor's bank details on letterhead.
    2. Check the VAT ID and record it on the supplier.
    3. Agree payment terms — 30 days is our default.

    > [!note] Who approves
    > Anything above €10,000 a year needs @ruth to sign off.` },
  { ID: 'planning', space: 'operations', parent: null, title: 'Q4 planning', author: 'ines', editor: 'ines', created: '2026-09-15T08:00', updated: '2026-10-01T16:45', contributors: ['ines', 'lea', 'tobias'], body: md`
    Three goals for the last quarter of 2026, agreed in the September offsite.

    - Picking errors below **0.3 %** in every depot
    - Same-day dispatch for orders placed before 14:00
    - Warehouse costs per order down by 8 %` },
  { ID: 'welcome', space: 'handbook', parent: null, title: 'Welcome to ACME', author: 'ines', editor: 'marta', created: '2023-11-20T09:00', updated: '2026-09-30T11:55', contributors: ['ines', 'marta', 'nadine'], body: md`
    Good to have you here. This handbook explains how we work; the people mentioned below are happy to explain the rest.

    ## Your first week

    - [x] Laptop, badge, and accounts set up
    - [ ] Lunch with your buddy
    - [ ] Read [Time off and leave](page:leave)

    ## Who to ask

    | Topic | Person |
    | --- | --- |
    | Payroll and expenses | @ruth |
    | Office and equipment | @ines |
    | Customer questions | @nadine |` },
  { ID: 'leave', space: 'handbook', parent: null, title: 'Time off and leave', author: 'ines', editor: 'ines', created: '2023-11-20T09:30', updated: '2026-01-08T10:00', contributors: ['ines'], body: md`
    Everyone at ACME has **28 days** of paid leave a year, plus public holidays in their state.

    | Kind of leave | Days | Notice |
    | --- | ---: | --- |
    | Holiday | 28 | Two weeks |
    | Learning | 5 | One week |
    | Moving house | 1 | — |

    > [!tip] Plan the long ones early
    > Holidays of two weeks or more go in the team calendar before the quarter starts.` },
  { ID: 'expenses', space: 'handbook', parent: null, title: 'Travel and expenses', author: 'ruth', editor: 'ruth', created: '2024-01-15T15:00', updated: '2026-05-19T09:30', contributors: ['ruth'], body: md`
    Book trains for anything under four hours. Submit receipts within 30 days; @ruth's team pays them with the next payroll.` }
];

/** Discussion under each page, oldest first. A reply names the comment that opened its thread. */
const COMMENTS = [
  { ID: 1, page: 'release', author: 'owen', at: '2026-10-06T17:02', text: 'Support needs the customer notes by Monday noon, not end of day. Can we move that row?' },
  { ID: 2, page: 'release', author: 'jonas', at: '2026-10-07T08:45', replyTo: 1, text: 'Done, and I added the wave thresholds from last week’s retro.' },
  { ID: 3, page: 'release', author: 'camille', at: '2026-10-07T10:12', text: 'Should the load test run before the cut? It failed twice on Friday.' },
  { ID: 4, page: 'incident', author: 'nadine', at: '2026-10-05T14:30', text: 'Please add the customer hotline to the SEV 1 checklist.' },
  { ID: 5, page: 'rollout', author: 'lea', at: '2026-10-07T07:55', text: 'Munich passed the dry run on both shifts.' }
];

/** Callout kinds, keyed by their Markdown marker: `> [!warning] Title`. */
const CALLOUTS = {
  note: { tone: 'info', icon: 'circle-info' },
  tip: { tone: 'success', icon: 'lightbulb' },
  warning: { tone: 'warning', icon: 'triangle-exclamation' },
  danger: { tone: 'danger', icon: 'circle-exclamation' }
};

/** Inline spans: bold, italic, code, links, and mentions. One capture group, so `split` keeps them. */
const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|@[a-z]+\b)/;

/** Lines that start a block of their own and therefore end a paragraph. */
const BLOCK_START = /^(#{2,4}\s|~~~|>|\||[-*] |\d+\. |!\[|-{3,}$)/;

/**
 * @typedef {Object} MarkdownHooks
 * @property {(id: string) => Node|null} mention Renders `@id`, or null for an unknown id.
 * @property {(id: string) => void} openPage Follows a `page:<id>` link.
 * @property {(line: number, done: boolean) => void} toggle Ticks the checklist item on a line.
 */

/**
 * Turns page Markdown into DOM nodes. Everything goes through `h()` and text nodes, so a page can
 * never inject markup, and external links are limited to http(s) and mailto.
 * @param {string} source
 * @param {MarkdownHooks} hooks
 * @returns {{nodes: HTMLElement[], headings: Array<{level: number, text: string, el: HTMLElement}>}}
 */
function renderMarkdown(source, hooks) {
  const lines = source.split('\n');
  const nodes = [];
  const headings = [];
  let index = 0;
  /** @param {(text: string) => boolean} test @returns {Array<{text: string, line: number}>} */
  const take = (test) => {
    const rows = [];
    while (index < lines.length && test(lines[index])) rows.push({ text: lines[index], line: index++ });
    return rows;
  };
  while (index < lines.length) {
    const line = lines[index];
    let match;
    if (!line.trim()) index += 1;
    else if ((match = /^(#{2,4})\s+(.+)$/.exec(line))) {
      const level = match[1].length;
      const el = h(`h${level}`, { class: 'wiki__heading', tabIndex: -1, dataset: { level } }, inline(match[2], hooks));
      headings.push({ level, text: el.textContent ?? '', el });
      nodes.push(el);
      index += 1;
    } else if ((match = /^~~~\s*(\S*)$/.exec(line))) {
      index += 1;
      const code = take((text) => !text.startsWith('~~~')).map((row) => row.text).join('\n');
      index += 1;
      nodes.push(codeBlock(code, match[1] || 'text'));
    } else if (line.startsWith('>')) {
      nodes.push(callout(take((text) => text.startsWith('>')).map((row) => row.text.replace(/^>\s?/, '')), hooks));
    } else if (line.startsWith('|')) {
      nodes.push(table(take((text) => text.startsWith('|')).map((row) => row.text), hooks));
    } else if (/^- \[[ x]\] /.test(line)) {
      nodes.push(checklist(take((text) => /^- \[[ x]\] /.test(text)), hooks));
    } else if (/^([-*]|\d+\.) /.test(line)) {
      const ordered = /^\d/.test(line);
      const items = take((text) => (ordered ? /^\d+\. / : /^[-*] /).test(text));
      nodes.push(h(ordered ? 'ol' : 'ul', { class: 'wiki__list' }, items.map((row) =>
        h('li', { class: 'wiki__list-item' }, inline(row.text.replace(/^([-*]|\d+\.) /, ''), hooks)))));
    } else if ((match = /^!\[([^\]]*)\]\(([^)]*)\)$/.exec(line))) {
      nodes.push(figure(match[1]));
      index += 1;
    } else if (/^-{3,}$/.test(line)) {
      nodes.push(h('hr', { class: 'wiki__rule' }));
      index += 1;
    } else {
      index += 1;
      const rest = take((text) => text.trim() !== '' && !BLOCK_START.test(text));
      nodes.push(h('p', { class: 'wiki__paragraph' }, inline([line, ...rest.map((row) => row.text)].join(' '), hooks)));
    }
  }
  return { nodes, headings };
}

/**
 * @param {string} text One line of Markdown.
 * @param {MarkdownHooks} hooks
 * @returns {Array<Node|string>}
 */
function inline(text, hooks) {
  return text.split(INLINE).filter((part) => part !== '').map((part) => {
    if (!INLINE.test(part) || part.length < 2) return part;
    if (part.startsWith('**')) return h('strong', {}, inline(part.slice(2, -2), hooks));
    if (part.startsWith('`')) return h('code', { class: 'wiki__inline-code' }, part.slice(1, -1));
    if (part.startsWith('*')) return h('em', {}, inline(part.slice(1, -1), hooks));
    if (part.startsWith('@')) return hooks.mention(part.slice(1)) ?? part;
    const [, label, target] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part) ?? [];
    if (target?.startsWith('page:')) {
      return h('button', { type: 'button', class: 'link-button wiki__link', onclick: () => hooks.openPage(target.slice(5)) }, label);
    }
    if (/^(https?:|mailto:)/.test(target ?? '')) {
      return h('a', { class: 'link-button wiki__link', href: target, target: '_blank', rel: 'noopener' }, label);
    }
    return label ?? part;
  });
}

/**
 * A fenced code block: one muted fill holding a slim row — the language, and a copy button that
 * confirms with a tick and a polite "Copied" — above the code.
 * @param {string} code
 * @param {string} language
 * @returns {HTMLElement}
 */
function codeBlock(code, language) {
  return h('figure', { class: 'wiki__code' },
    h('figcaption', { class: 'wiki__code-head' },
      h('span', { class: 'wiki__code-language' }, language),
      copyButton({ text: code, title: 'Copy code', size: 'sm' })),
    h('pre', { class: 'wiki__pre', tabIndex: 0 }, h('code', {}, code)));
}

/**
 * A `> [!kind] Title` block becomes a callout; any other quote stays a blockquote.
 * @param {string[]} lines Quote lines without their `>` marker.
 * @param {MarkdownHooks} hooks
 * @returns {HTMLElement}
 */
function callout(lines, hooks) {
  const marker = /^\[!(\w+)\]\s*(.*)$/.exec(lines[0] ?? '');
  const kind = marker ? CALLOUTS[marker[1].toLowerCase()] : undefined;
  const paragraphs = (kind ? lines.slice(1) : lines).join('\n').split(/\n\s*\n/)
    .filter((text) => text.trim())
    .map((text) => h('p', { class: 'wiki__callout-text' }, inline(text.replace(/\n/g, ' '), hooks)));
  if (!kind) return h('blockquote', { class: 'wiki__quote' }, paragraphs);
  return h('div', { class: 'wiki__callout', role: 'note', dataset: { tone: kind.tone } },
    h('span', { class: 'wiki__callout-icon' }, icon(kind.icon, { size: 16 })),
    h('div', { class: 'wiki__callout-body' },
      marker[2] ? h('p', { class: 'wiki__callout-title' }, inline(marker[2], hooks)) : null,
      paragraphs));
}

/**
 * A pipe table; `---:` in the rule row right-aligns a column.
 * @param {string[]} rows
 * @param {MarkdownHooks} hooks
 * @returns {HTMLElement}
 */
function table(rows, hooks) {
  /** @param {string} row @returns {string[]} */
  const cells = (row) => row.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
  const ruled = /^[\s|:-]+$/.test(rows[1] ?? '');
  const align = ruled ? cells(rows[1]).map((rule) => (rule.endsWith(':') ? 'end' : 'start')) : [];
  /** @param {string} text @param {'th'|'td'} tag @returns {HTMLElement} */
  const row = (text, tag) => h('tr', { class: 'wiki__row' }, cells(text).map((value, column) =>
    h(tag, { class: 'wiki__cell', scope: tag === 'th' ? 'col' : null, dataset: { align: align[column] ?? 'start' } },
      inline(value, hooks))));
  return h('div', { class: 'wiki__table-wrap' },
    h('table', { class: 'wiki__table' },
      h('thead', {}, row(rows[0], 'th')),
      h('tbody', {}, rows.slice(ruled ? 2 : 1).map((text) => row(text, 'td')))));
}

/**
 * Checklist items stay live: ticking one writes `[x]` back into the Markdown.
 * @param {Array<{text: string, line: number}>} rows
 * @param {MarkdownHooks} hooks
 * @returns {HTMLElement}
 */
function checklist(rows, hooks) {
  return h('ul', { class: 'wiki__checklist' }, rows.map(({ text, line }) =>
    h('li', { class: 'wiki__check-item' },
      h('label', { class: 'wiki__check-label' },
        h('input', {
          type: 'checkbox',
          class: 'wiki__check',
          checked: text[3] === 'x',
          onchange: (event) => hooks.toggle(line, event.target.checked)
        }),
        h('span', { class: 'wiki__check-text' }, inline(text.slice(6), hooks))))));
}

/** @param {string} caption @returns {HTMLElement} An image placeholder with its caption. */
function figure(caption) {
  return h('figure', { class: 'wiki__figure' },
    h('div', { class: 'wiki__figure-frame', role: 'img', 'aria-label': caption || 'Image' }, icon('image', { size: 28 })),
    caption ? h('figcaption', { class: 'wiki__figure-caption' }, caption) : null);
}

/**
 * @param {string|null} at ISO date-time, or null for a change made in this session.
 * @returns {string} "2 days ago", "yesterday", "just now".
 */
function since(at) {
  return at ? formatRelativeTime(new Date(at), { now: NOW }) : 'just now';
}

/**
 * Names a button's keyboard shortcut in its tooltip and to assistive technology, without the key
 * cap `button({ shortcut })` draws, so a header of labelled buttons stays calm. The layout binds
 * the key itself.
 * @param {HTMLButtonElement} control
 * @param {{label: string, keys: string}} shortcut
 * @returns {HTMLButtonElement}
 */
function withKeyHint(control, shortcut) {
  control.title = `${control.textContent} (${shortcut.label})`;
  control.setAttribute('aria-keyshortcuts', shortcut.keys);
  return control;
}

export default {
  title: 'Knowledge base',
  category: 'Product',
  blurb: 'Nested pages in team spaces: a reading column with a live outline, comments, and Markdown editing.',
  components: [
    'TreeView', 'CodeEditor', 'SplitView', 'Breadcrumb', 'Toolbar', 'ActivityList', 'Launcher',
    'Select', 'Avatar', 'MenuButton', 'InlineLoading', 'Sheet', 'Dialog', 'Fieldset', 'TagPicker',
    'CopyInput', 'AppSidebar', 'ModuleBar', 'AccountMenu'
  ],

  /**
   * Mounts the knowledge base: spaces and a page tree, the reading column, and the page's outline,
   * details, and comments — with an editor that swaps in for the reading column.
   * @param {HTMLElement} container Gallery stage.
   * @param {import('./kit.js').LayoutContext} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const pages = PAGES.map((page) => ({ ...page, contributors: [...page.contributors], history: [...(page.history ?? [])] }));
    const comments = COMMENTS.map((comment) => ({ ...comment }));
    const spaces = SPACES.map((space) => ({ ...space }));
    const favorites = new Set(FAVORITES);
    const state = { space: 'engineering', page: 'release', view: 'page', editing: false, edited: false };
    // Components inside a rendered page (its avatars) and its comment threads are rebuilt with them.
    const pageParts = renderScope(context);
    const commentParts = renderScope(context);
    let created = 0;
    let commentId = COMMENTS.length;

    /** @param {string|null} id @returns {(typeof pages)[number] | undefined} */
    const pageById = (id) => pages.find((page) => page.ID === id);
    /** @returns {(typeof pages)[number]} The open page. */
    const current = () => pageById(state.page);
    /** @returns {(typeof spaces)[number]} */
    const currentSpace = () => spaces.find((space) => space.ID === state.space);
    /** @param {string|null} parent @returns {typeof pages} The direct sub-pages, in the current space. */
    const childrenOf = (parent) => pages.filter((page) => page.space === state.space && page.parent === parent);
    /** @param {(typeof pages)[number]} page @returns {typeof pages} The page and its ancestors, root first. */
    const pathOf = (page) => {
      const path = [];
      for (let step = page; step; step = pageById(step.parent)) path.unshift(step);
      return path;
    };
    /** @param {string|null} [parent] @returns {Array<object>} The current space's pages as TreeView nodes. */
    const treeItems = (parent = null) => childrenOf(parent).map((page) => {
      const children = treeItems(page.ID);
      return { ID: page.ID, name: page.title, children: children.length ? children : undefined };
    });
    /** @param {string|null} [parent] @returns {typeof pages} Pages in reading order, for [ and ]. */
    const readingOrder = (parent = null) => childrenOf(parent).flatMap((page) => [page, ...readingOrder(page.ID)]);

    // ------------------------------------------------------------ navigation column --

    // The space switcher heads the module's panel: the space's tile and name, with its pages beneath.
    const spaceSelect = keep(Select.entity(null, {
      items: spaces,
      value: state.space,
      label: 'Space',
      subtitleKey: 'description',
      renderIcon: (space) => iconTile(space.icon, space.tone),
      onchange: (event) => {
        if (event.detail.value && event.detail.value !== state.space) switchSpace(event.detail.value);
      }
    }));
    // Without icons, a page with sub-pages shows the tree's chevron and any other page a dot.
    const tree = keep(new TreeView(null, {
      label: 'Pages',
      icons: false,
      items: treeItems(),
      selected: [state.page],
      expanded: ['shipping', 'runbooks'],
      onselect: (event) => openPage(event.detail.id)
    }));
    const favoriteTree = keep(new TreeView(null, {
      label: 'Favorites',
      icons: false,
      emptyText: 'Star a page to keep it here.',
      onselect: (event) => openPage(event.detail.id)
    }));

    // The suite's navigation, with the knowledge base's panel: the space switcher, the space's own
    // destinations, and its page tree and favorites beneath them. The ids of the destinations stay
    // clear of the suite's modules (Home, Settings), which share the navigation with them.
    const nav = suiteNav(context, {
      module: 'wiki',
      menu: [
        { id: 'wiki:home', label: 'Home', icon: 'house', invoke: () => showHome() },
        { id: 'wiki:settings', label: 'Settings', icon: 'gear', invoke: () => openSettings() }
      ],
      // A page lives in the tree, not the menu: the module itself is where the reader is.
      active: 'wiki',
      header: h('div', { class: 'wiki__space' }, spaceSelect.toElement()),
      content: h('div', { class: 'wiki__trees' },
        sectionLabel('Pages', iconButton('plus', 'New page', () => createPage(null))),
        tree.toElement(),
        sectionLabel('Favorites'),
        favoriteTree.toElement()),
      onsearch: () => openLauncher(),
      account: {
        items: [
          { label: 'Profile', value: 'profile', icon: 'user' },
          { label: 'Notifications', value: 'notifications', icon: 'bell' },
          '-',
          { label: 'Sign out', value: 'sign-out', icon: 'power-off' }
        ],
        onselect: (event) => notify(unavailable(event.detail.item.label), 'info')
      }
    });
    const root = h('div', { class: 'wiki shell', dataset: { mode: 'read' } }, nav.column);
    // Narrow, the page tree and then the outline and comments become drawers.
    const shell = adaptiveShell(root, context, { asideLabel: 'Show outline and comments' });

    // ------------------------------------------------------------------ main pane --

    const crumbs = keep(new Breadcrumb(null, {
      maxVisible: 4,
      onselect: (event) => (event.detail.name === 'space' ? showHome() : openPage(event.detail.name))
    }));
    const viewers = h('div', { class: 'avatar-stack wiki__viewers', role: 'group', dataset: { narrow: 'hide' } });
    const saving = keep(new InlineLoading(null, { size: 'sm' }));
    saving.el.hidden = true;
    // Reading, every action is quiet; the one filled button is Done, while editing.
    const starButton = iconButton('star', 'Favorite', () => toggleFavorite());
    starButton.classList.add('star-toggle');
    // On a phone Share and Edit keep their icons; their words stay in the accessible name.
    const shareButton = button({ label: 'Share', icon: 'share-nodes', kind: 'ghost', onclick: () => openShare() });
    shareButton.dataset.narrow = 'icon';
    const editButton = withKeyHint(
      button({ label: 'Edit', icon: 'pen', kind: 'ghost', onclick: () => startEditing() }), { label: 'E', keys: 'E' });
    editButton.dataset.narrow = 'icon';
    const doneButton = withKeyHint(
      button({ label: 'Done', icon: 'check', kind: 'primary', onclick: () => finishEditing() }), modShortcut('Enter', '↵'));
    doneButton.hidden = true;
    const more = keep(new MenuButton(iconButton('ellipsis', 'More actions'), {
      kind: 'ghost',
      placement: 'bottom-end',
      items: [
        { label: 'Page history', value: 'history', icon: 'clock-regular' },
        { label: 'Export as Markdown', value: 'export', icon: 'file-export' },
        { label: 'Add sub-page', value: 'child', icon: 'plus' },
        { label: 'Move…', value: 'move', icon: 'arrow-right-arrow-left' },
        '-',
        { label: 'Delete', value: 'delete', icon: 'trash-can', danger: true }
      ],
      onselect: (event) => pageAction(event.detail.value)
    }));

    const article = h('article', { class: 'wiki__article' });
    // Focusable, so the reading pane can be scrolled from the keyboard.
    const readBody = h('div', { class: 'shell__body wiki__read', tabIndex: 0, 'aria-label': 'Page content' }, article);

    const titleInput = h('input', {
      class: 'wiki__title-input', placeholder: 'Untitled', 'aria-label': 'Page title', oninput: () => draftChanged()
    });
    const editor = keep(new CodeEditor(null, {
      language: 'markdown', label: 'Page content', wrap: 'soft', spellcheck: true, indent: '  ', rows: 16,
      placeholder: 'Write in Markdown. ## starts a heading, - [ ] a checklist item.',
      oninput: () => draftChanged()
    }));
    const preview = h('article', { class: 'wiki__article', 'aria-label': 'Preview' });
    const previewPane = h('div', { class: 'wiki__preview' }, preview);
    const split = keep(new SplitView(null, {
      start: h('div', { class: 'wiki__compose' }, titleInput, editor.toElement()),
      end: previewPane,
      size: '50%',
      min: 280,
      collapsible: 'end',
      label: 'Resize editor and preview'
    }));
    const mention = keep(new MenuButton(iconButton('at', 'Mention someone'), {
      kind: 'ghost',
      items: PEOPLE.map((who) => ({ label: who.name, value: who.id, description: who.role })),
      onselect: (event) => insertText(`@${event.detail.value} `)
    }));
    const formatting = keep(new Toolbar(null, {
      label: 'Formatting',
      dense: true,
      items: [
        { name: 'heading', kind: 'ghost', icon: 'heading', title: 'Heading', onclick: () => prefixLines(() => '## ') },
        { name: 'bold', kind: 'ghost', icon: 'bold', title: `Bold (${modShortcut('b').label})`, onclick: () => wrapSelection('**') },
        { name: 'italic', kind: 'ghost', icon: 'italic', title: `Italic (${modShortcut('i').label})`, onclick: () => wrapSelection('*') },
        { name: 'code', kind: 'ghost', icon: 'code', title: 'Inline code', onclick: () => wrapSelection('`') },
        { name: 'link', kind: 'ghost', icon: 'link', title: 'Link', onclick: () => wrapSelection('[', '](https://)', 'link text') },
        '-',
        { name: 'bullets', kind: 'ghost', icon: 'list-ul', title: 'Bulleted list', onclick: () => prefixLines(() => '- ') },
        { name: 'numbers', kind: 'ghost', icon: 'list-ol', title: 'Numbered list', onclick: () => prefixLines((index) => `${index + 1}. `) },
        { name: 'tasks', kind: 'ghost', icon: 'list-check', title: 'Checklist', onclick: () => prefixLines(() => '- [ ] ') },
        '-',
        { name: 'callout', kind: 'ghost', icon: 'lightbulb-regular', title: 'Callout', onclick: () => insertBlock('> [!note] Title\n> Text') },
        { name: 'table', kind: 'ghost', icon: 'table', title: 'Table', onclick: () => insertBlock('| Column | Column |\n| --- | --- |\n| Value | Value |') },
        { name: 'fence', kind: 'ghost', icon: 'terminal', title: 'Code block', onclick: () => insertBlock('~~~bash\n\n~~~') },
        { name: 'image', kind: 'ghost', icon: 'image', title: 'Image', onclick: () => insertBlock('![Caption](figure)') },
        mention.toElement(),
        '-',
        { name: 'preview', kind: 'ghost', icon: 'eye', label: 'Preview', active: true, onclick: () => togglePreview() }
      ]
    }));
    const wordCount = h('span', { class: 'meta wiki__format-hint', 'aria-live': 'polite', dataset: { narrow: 'hide' } });
    const formatBar = h('div', { class: 'shell__toolbar wiki__format', hidden: true }, formatting.toElement(), wordCount);
    const editBody = h('div', { class: 'wiki__edit', hidden: true }, split.toElement());

    const asideButton = shell.asideToggle();
    const main = h('section', { class: 'shell__main', 'aria-label': 'Page' },
      paneHeader({
        leading: [shell.navToggle(), crumbs.toElement()],
        actions: [saving.toElement(), viewers, starButton, shareButton, editButton, doneButton, more.toElement(), asideButton]
      }),
      formatBar, readBody, editBody);

    // ------------------------------------------------------------------- inspector --

    const outline = h('nav', { class: 'wiki__outline', 'aria-label': 'On this page' });
    // A page's details fold away under the outline; a space's are all its home has to show.
    const details = h('div');
    const detailsBox = keep(new Groupbox(null, { title: 'Details', open: false })).setContent(details);
    detailsBox.el.classList.add('wiki__details');
    const spaceDetails = h('div');
    const commentsTitle = h('h3', { class: 'panel-block__title' }, 'Comments');
    const threads = h('div', { class: 'wiki__threads' });
    const composer = h('textarea', {
      class: 'wiki__composer-input', rows: 2, tabindex: '0', placeholder: 'Add a comment…', 'aria-label': 'Add a comment',
      'aria-keyshortcuts': modShortcut('Enter').keys
    });
    const outlineBlock = h('div', { class: 'panel-block wiki__outline-block' }, outline);
    const detailsBlock = h('div', { class: 'panel-block' }, detailsBox.toElement());
    const spaceBlock = h('div', { class: 'panel-block', hidden: true }, spaceDetails);
    const commentsBlock = h('div', { class: 'panel-block' },
      commentsTitle,
      threads,
      h('div', { class: 'wiki__composer' }, composer,
        h('div', { class: 'wiki__composer-bar' },
          h('span', { class: 'meta' }, kbd(modifierLabel(), '↵')),
          button({ label: 'Comment', size: 'sm', onclick: () => postFromComposer() }))));
    const asideTitle = h('span', {}, 'On this page');
    const aside = h('aside', { class: 'shell__aside', 'aria-label': 'Page details' },
      paneHeader({ title: asideTitle }),
      h('div', { class: 'shell__body' }, outlineBlock, detailsBlock, spaceBlock, commentsBlock));

    root.append(main, aside);
    const notify = toaster(context, root);

    // --------------------------------------------------------------------- render --

    /** @param {string} id @returns {HTMLElement} A small avatar, owned by the rendered page. */
    const avatar = (id) => pageParts.own(new Avatar(null, { name: person(id)?.name ?? id, size: 'sm' })).toElement();
    /** @param {string} id @returns {HTMLElement} An avatar and a name. */
    const personChip = (id) => h('span', { class: 'person' }, avatar(id), h('span', { class: 'person__name' }, person(id)?.name ?? id));
    /** @param {string[]} ids @returns {HTMLElement} */
    const avatarStack = (ids) => h('span', { class: 'avatar-stack', title: ids.map((id) => person(id)?.name).join(', ') },
      ids.map((id) => avatar(id)));

    /** @type {MarkdownHooks} A mention is a quiet name pill; page links and checklists stay live. */
    const markdownHooks = {
      mention: (id) => {
        const who = person(id);
        if (!who) return null;
        return h('span', { class: 'wiki__mention', title: `${who.name} · ${who.role}` },
          h('span', { class: 'wiki__mention-at', 'aria-hidden': 'true' }, '@'), who.name);
      },
      openPage: (id) => openPage(id),
      toggle: (line, done) => toggleCheck(line, done)
    };

    /** Rebuilds both trees and the sidebar state, keeping keyboard focus on the open page. @returns {void} */
    function renderNav() {
      const focused = [tree, favoriteTree].find((view) => view.el.contains(document.activeElement));
      tree.setItems(treeItems());
      if (state.view === 'page') tree.reveal(state.page);
      tree.setSelection(state.view === 'page' ? [state.page] : []);
      const starred = pages.filter((page) => favorites.has(page.ID));
      favoriteTree.setItems(starred.map((page) => ({ ID: page.ID, name: page.title })));
      favoriteTree.setSelection(state.view === 'page' && favorites.has(state.page) ? [state.page] : []);
      nav.setActive(state.view === 'home' ? 'wiki:home' : 'wiki');
      if (state.view === 'page') focused?.focusNode(state.page);
    }

    /** Renders the open page into the header, the reading column, and the inspector. @returns {void} */
    function renderPage() {
      pageParts.reset();
      const page = current();
      const space = currentSpace();
      crumbs.setItems([
        { name: 'space', label: space.name, icon: space.icon },
        ...pathOf(page).map((step) => ({ name: step.ID, label: step.title }))
      ]);
      const watching = page.viewers ?? page.contributors.filter((id) => id !== ME).slice(0, 2);
      viewers.replaceChildren(...watching.map((id) => avatar(id)));
      viewers.setAttribute('aria-label', `Also viewing: ${watching.map((id) => person(id)?.name).join(', ')}`);
      viewers.title = `${watching.map((id) => person(id)?.name).join(', ')} ${watching.length === 1 ? 'is' : 'are'} viewing`;
      syncStar();
      for (const control of [starButton, more.el, viewers]) control.hidden = false;

      const { nodes, headings } = renderMarkdown(page.body, markdownHooks);
      const children = childrenOf(page.ID);
      article.replaceChildren(...[
        h('header', { class: 'wiki__head' },
          h('h1', { class: 'document-title' }, page.title),
          h('p', { class: 'wiki__byline' },
            h('span', {}, `Last edited by ${person(page.editor)?.name}`),
            h('span', { 'aria-hidden': 'true' }, '·'),
            h('time', { dateTime: page.updated ?? NOW.toISOString() }, since(page.updated)))),
        nodes.length
          ? h('div', { class: 'wiki__prose' }, nodes)
          : emptyState({
            icon: 'pen-to-square',
            title: 'This page is empty',
            description: 'Press E to start writing.',
            actions: [{ label: 'Edit page', onclick: () => startEditing() }]
          }),
        children.length ? h('section', { class: 'wiki__children', 'aria-label': 'Pages in this section' },
          h('h2', { class: 'panel-block__title' }, 'In this section'),
          h('div', { class: 'wiki__child-grid' }, children.map((child) =>
            h('button', { type: 'button', class: 'wiki__child', onclick: () => openPage(child.ID) },
              h('span', { class: 'wiki__child-title' }, child.title),
              h('span', { class: 'wiki__child-excerpt' }, excerpt(child.body)),
              h('span', { class: 'meta' }, `Edited ${since(child.updated)}`))))) : null
      ].filter(Boolean));

      buildOutline(headings);
      const words = page.body.split(/\s+/).filter(Boolean).length;
      details.replaceChildren(propList([
        ['Created', formatDate(new Date(page.created), DATE.year)],
        ['Author', personChip(page.author)],
        ['Last edited', since(page.updated)],
        ['Contributors', avatarStack(page.contributors)],
        ['Reading time', `${Math.max(1, Math.round(words / 220))} min · ${formatNumber(words)} words`]
      ]));
      renderComments();
      asideTitle.textContent = 'On this page';
      nameAsideButton('Show outline and comments');
      for (const block of [outlineBlock, detailsBlock, commentsBlock]) block.hidden = false;
      spaceBlock.hidden = true;
    }

    /** The space overview behind Home. @returns {void} */
    function renderHome() {
      pageParts.reset();
      const space = currentSpace();
      const inSpace = pages.filter((page) => page.space === space.ID);
      const recent = [...inSpace].sort((a, b) => (b.updated ?? '9').localeCompare(a.updated ?? '9')).slice(0, 5);
      crumbs.setItems([{ name: 'space', label: space.name, icon: space.icon }, { name: 'home', label: 'Home' }]);
      for (const control of [starButton, editButton, more.el, viewers]) control.hidden = true;
      article.replaceChildren(
        h('header', { class: 'wiki__head' },
          h('h1', { class: 'document-title' }, space.name),
          h('p', { class: 'wiki__lede' }, space.description)),
        h('section', { class: 'wiki__home-section', 'aria-label': 'Recently updated' },
          h('h2', { class: 'panel-block__title' }, 'Recently updated'),
          h('div', { class: 'surface wiki__recent' }, recent.map((page) =>
            h('button', { type: 'button', class: 'list-row', onclick: () => openPage(page.ID) },
              h('span', { class: 'list-row__top' },
                h('span', { class: 'list-row__title' }, page.title),
                h('span', { class: 'list-row__meta' }, since(page.updated))),
              h('span', { class: 'wiki__recent-meta' }, avatar(page.editor),
                h('span', { class: 'list-row__snippet' }, `${person(page.editor)?.name} · ${excerpt(page.body)}`)))))));
      readBody.scrollTop = 0;
      asideTitle.textContent = 'About this space';
      nameAsideButton('Show space details');
      for (const block of [outlineBlock, detailsBlock, commentsBlock]) block.hidden = true;
      spaceBlock.hidden = false;
      spaceDetails.replaceChildren(propList([
        ['Owner', personChip(space.owner)],
        ['Pages', formatNumber(inSpace.length)],
        ['Contributors', avatarStack([...new Set(inSpace.flatMap((page) => page.contributors))].slice(0, 6))],
        ['Created', formatDate(new Date(space.created), DATE.year)],
        ['Visibility', space.private ? 'Space members' : 'Everyone at ACME']
      ]));
    }

    /** @param {string} body @returns {string} The first sentence-ish of a page, without Markdown. */
    function excerpt(body) {
      const line = body.split('\n').find((text) => text.trim() && !BLOCK_START.test(text)) ?? '';
      const plain = line.replace(/\*\*|`|\*|\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/@([a-z]+)/g, (_, id) => person(id)?.name ?? id);
      return plain.length > 90 ? `${plain.slice(0, 88).trimEnd()}…` : plain;
    }

    /** The open page's comments, one card per thread. @returns {void} */
    function renderComments() {
      commentParts.reset();
      const onPage = comments.filter((comment) => comment.page === state.page);
      const openers = onPage.filter((comment) => comment.replyTo == null);
      commentsTitle.textContent = onPage.length ? `Comments · ${onPage.length}` : 'Comments';
      threads.replaceChildren(...(openers.length
        ? openers.map((opener) => commentThread(opener, onPage.filter((comment) => comment.replyTo === opener.ID)))
        : [h('p', { class: 'meta' }, 'No comments yet.')]));
    }

    /**
     * A thread as a card: the comment that opened it, its replies, and a field to answer in.
     * @param {(typeof comments)[number]} opener
     * @param {typeof comments} replies
     * @returns {HTMLElement}
     */
    function commentThread(opener, replies) {
      const name = person(opener.author)?.name ?? opener.author;
      const list = commentParts.own(new ActivityList(null, {
        label: `Comment by ${name}`,
        items: [opener, ...replies].map((comment) => {
          const who = person(comment.author)?.name ?? comment.author;
          return { id: comment.ID, actor: who, avatar: { name: who, size: 'sm' }, content: comment.text, timeLabel: since(comment.at) };
        })
      }));
      const field = h('input', {
        class: 'wiki__reply-input', placeholder: 'Reply…', 'aria-label': `Reply to ${name}`, enterKeyHint: 'send'
      });
      // A form, so Enter in the field sends the reply.
      const form = h('form', {
        class: 'wiki__reply',
        'aria-label': `Reply to ${name}`,
        'data-zx-fields': 'quiet',
        onsubmit: (event) => {
          event.preventDefault();
          if (postComment(field.value, opener.ID)) replyField(opener.ID)?.focus();
        }
      }, field);
      return h('div', { class: 'wiki__thread', dataset: { thread: opener.ID } }, list.toElement(), form);
    }

    /** @param {number} thread @returns {HTMLInputElement|null} The reply field of a rendered thread. */
    const replyField = (thread) => threads.querySelector(`[data-thread="${thread}"] .wiki__reply-input`);

    // -------------------------------------------------------------------- outline --

    /** @type {Array<{heading: HTMLElement, link: HTMLElement}>} */
    let outlineItems = [];
    /** @type {HTMLElement|null} The heading jumped to last, kept active if the page cannot scroll that far. */
    let jumpTarget = null;
    let frame = 0;

    /** @param {Array<{level: number, text: string, el: HTMLElement}>} headings @returns {void} */
    function buildOutline(headings) {
      outlineItems = headings.filter((heading) => heading.level <= 3).map((heading) => ({
        heading: heading.el,
        link: h('button', {
          type: 'button', class: 'wiki__outline-link', dataset: { level: heading.level }, onclick: () => jumpTo(heading.el)
        }, heading.text)
      }));
      outline.replaceChildren(...(outlineItems.length
        ? outlineItems.map((item) => item.link)
        : [h('p', { class: 'meta' }, 'Headings in the page appear here.')]));
      jumpTarget = null;
      syncOutline();
    }

    /** Marks the section being read: the last heading above the top third of the pane. @returns {void} */
    function syncOutline() {
      if (outlineItems.length === 0) return;
      const pane = readBody.getBoundingClientRect();
      const line = pane.top + Math.min(120, pane.height / 3);
      let active = outlineItems[0];
      for (const item of outlineItems) if (item.heading.getBoundingClientRect().top <= line) active = item;
      const scrollable = readBody.scrollHeight > readBody.clientHeight + 1;
      if (scrollable && readBody.scrollTop + readBody.clientHeight >= readBody.scrollHeight - 2) {
        active = outlineItems.find((item) => item.heading === jumpTarget) ?? outlineItems[outlineItems.length - 1];
      }
      for (const item of outlineItems) {
        if (item === active) item.link.setAttribute('aria-current', 'location');
        else item.link.removeAttribute('aria-current');
      }
    }

    /** @param {HTMLElement} heading @returns {void} */
    function jumpTo(heading) {
      // From the outline drawer, the drawer steps aside so the section can take the focus.
      shell.toggleAside(false);
      jumpTarget = heading;
      const top = readBody.scrollTop + heading.getBoundingClientRect().top - readBody.getBoundingClientRect().top - 16;
      const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
      readBody.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
      heading.focus({ preventScroll: true });
    }

    readBody.addEventListener('scroll', () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        syncOutline();
      });
    }, { passive: true, signal: context.signal });
    for (const type of ['wheel', 'touchstart', 'keydown']) {
      readBody.addEventListener(type, () => { jumpTarget = null; }, { passive: true, signal: context.signal });
    }

    // ------------------------------------------------------------------ navigation --

    /** @param {string} id @returns {void} */
    function openPage(id) {
      const page = pageById(id);
      if (!page) return;
      const fromDrawer = closeDrawers();
      if (state.editing) finishEditing({ quiet: true });
      if (page.space !== state.space) {
        state.space = page.space;
        spaceSelect.set(page.space, { silent: true });
      }
      state.page = id;
      state.view = 'page';
      editButton.hidden = false;
      renderNav();
      renderPage();
      readBody.scrollTop = 0;
      syncOutline();
      keepFocus(fromDrawer);
    }

    /**
     * After a re-render removed the focused control (a link in the page), focus the reading pane;
     * after a choice in a drawer, which has closed, the page's title.
     * @param {boolean} [toTitle]
     * @returns {void}
     */
    function keepFocus(toTitle = false) {
      if (context.preview) return;
      const title = article.querySelector('h1');
      if (toTitle && title instanceof HTMLElement) {
        title.tabIndex = -1;
        title.focus({ preventScroll: true });
      } else if (!root.contains(document.activeElement)) readBody.focus({ preventScroll: true });
    }

    /**
     * Closes an open drawer before the page behind it changes, so the focus can move there.
     * @returns {boolean} Whether a drawer was open.
     */
    function closeDrawers() {
      const open = root.dataset.navOpen === 'true' || root.dataset.asideOpen === 'true';
      shell.closeNav();
      shell.toggleAside(false);
      return open;
    }

    /** @param {string} label What the inspector holds, as its drawer button says. @returns {void} */
    function nameAsideButton(label) {
      asideButton.setAttribute('aria-label', label);
      asideButton.title = label;
    }

    /** @returns {void} */
    function showHome() {
      const fromDrawer = closeDrawers();
      if (state.editing) finishEditing({ quiet: true });
      state.view = 'home';
      renderNav();
      renderHome();
      keepFocus(fromDrawer);
    }

    /** @param {string} id @returns {void} */
    function switchSpace(id) {
      if (state.editing) finishEditing({ quiet: true });
      state.space = id;
      spaceSelect.set(id, { silent: true });
      showHome();
    }

    /** @param {-1|1} step @returns {void} */
    function stepPage(step) {
      if (state.view !== 'page' || state.editing) return;
      const order = readingOrder();
      const next = order[order.findIndex((page) => page.ID === state.page) + step];
      if (next) openPage(next.ID);
    }

    // --------------------------------------------------------------------- editing --

    /** Swaps the reading column for the editor and its live preview. @returns {void} */
    function startEditing() {
      if (state.view !== 'page' || state.editing) return;
      const page = current();
      state.editing = true;
      state.edited = false;
      root.dataset.mode = 'edit';
      titleInput.value = page.title === 'Untitled' ? '' : page.title;
      editor.setValue(page.body, { silent: true });
      saving.set('inactive', '');
      // Editing trades the inspector for room: the editor and its preview share the full width.
      shell.toggleAside(false);
      for (const control of [readBody, editButton, starButton, aside]) control.hidden = true;
      for (const control of [formatBar, editBody, doneButton, saving.el]) control.hidden = false;
      fitSplit();
      renderPreview();
      field().setSelectionRange(0, 0);
      field().scrollTop = 0;
      if (!context.preview) (page.title === 'Untitled' ? titleInput : editor).focus();
    }

    /** @param {{quiet?: boolean}} [options] @returns {void} */
    function finishEditing({ quiet = false } = {}) {
      if (!state.editing) return;
      commitDraft();
      state.editing = false;
      root.dataset.mode = 'read';
      for (const control of [readBody, editButton, starButton, aside]) control.hidden = false;
      for (const control of [formatBar, editBody, doneButton, saving.el]) control.hidden = true;
      saving.set('inactive', '');
      preview.replaceChildren();
      if (quiet) return;
      renderNav();
      renderPage();
      if (state.edited) notify(`Saved “${current().title}”.`);
      editButton.focus();
    }

    /** Writes the editor's title and Markdown into the page. @returns {void} */
    function commitDraft() {
      const page = current();
      const title = titleInput.value.trim() || 'Untitled';
      const body = editor.getValue();
      if (title === page.title && body === page.body) return;
      Object.assign(page, { title, body, editor: ME, updated: null });
      if (!page.contributors.includes(ME)) page.contributors.push(ME);
      if (page.history[0]?.[1] !== null) page.history.unshift([ME, null, 'edited the page']);
      renderNav();
      crumbs.setItems([...crumbs.getItems().slice(0, -1), { name: page.ID, label: title }]);
    }

    /** Autosave: commits the draft once typing pauses. */
    const saveDraft = debounce(() => {
      if (context.signal.aborted || !state.editing) return;
      commitDraft();
      saving.set('success', 'Saved');
    }, 800);
    /** Re-renders the preview a beat after the last keystroke. */
    const refreshPreview = debounce(() => {
      if (!context.signal.aborted && state.editing) renderPreview();
    }, 120);

    /** @returns {void} */
    function draftChanged() {
      state.edited = true;
      saving.set('active', 'Saving…');
      saveDraft();
      refreshPreview();
    }

    /** @returns {void} */
    function renderPreview() {
      const words = editor.getValue().split(/\s+/).filter(Boolean).length;
      wordCount.textContent = `${formatNumber(words)} ${words === 1 ? 'word' : 'words'} · Markdown`;
      const { nodes } = renderMarkdown(editor.getValue(), markdownHooks);
      preview.replaceChildren(
        h('header', { class: 'wiki__head' }, h('h1', { class: 'document-title' }, titleInput.value.trim() || 'Untitled')),
        h('div', { class: 'wiki__prose' }, nodes));
    }

    /** @returns {boolean} Whether the editor is too narrow to share its width with the preview. */
    const narrowEditor = () => editBody.clientWidth > 0 && editBody.clientWidth <= SIDE_BY_SIDE;
    /** @returns {boolean} Whether the preview is showing (narrow, an open split shows the editor only). */
    const previewShowing = () => split.isCollapsed() === 'start' || (split.isCollapsed() === false && !narrowEditor());

    /**
     * Where the editor is too narrow for two panes, writing and previewing take turns: editing starts
     * on the Markdown, and Preview swaps it for the rendered page. Wide, the panes sit side by side.
     * @returns {void}
     */
    function fitSplit() {
      if (narrowEditor()) split.collapse('end');
      else if (split.isCollapsed() === 'start') split.expand();
      formatting.setActive('preview', previewShowing());
    }

    /** @returns {void} */
    function togglePreview() {
      const showing = previewShowing();
      if (showing) split.collapse('end');
      else if (narrowEditor()) split.collapse('start');
      else split.expand();
      formatting.setActive('preview', !showing);
    }

    /** Brings the editor back when a formatting command is used while only the preview shows. @returns {void} */
    function revealEditor() {
      if (split.isCollapsed() !== 'start') return;
      split.collapse('end');
      formatting.setActive('preview', false);
    }

    /** @returns {HTMLTextAreaElement} The CodeEditor's native text area, for selection-aware commands. */
    const field = () => /** @type {HTMLTextAreaElement} */ (editor.el.querySelector('textarea'));

    // The preview follows the editor's scroll position proportionally.
    field().addEventListener('scroll', () => {
      const area = field();
      const ratio = area.scrollTop / Math.max(1, area.scrollHeight - area.clientHeight);
      previewPane.scrollTop = ratio * (previewPane.scrollHeight - previewPane.clientHeight);
    }, { passive: true, signal: context.signal });

    /**
     * Types text over the selection through the browser's own editing command, so Undo still works.
     * @param {string} text
     * @returns {void}
     */
    function insertText(text) {
      revealEditor();
      const area = field();
      area.focus();
      if (!document.execCommand('insertText', false, text)) {
        area.setRangeText(text, area.selectionStart, area.selectionEnd, 'end');
        area.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    /** @param {string} before @param {string} [after] @param {string} [placeholder] @returns {void} */
    function wrapSelection(before, after = before, placeholder = 'text') {
      const area = field();
      const start = area.selectionStart;
      const selected = area.value.slice(start, area.selectionEnd) || placeholder;
      insertText(before + selected + after);
      area.setSelectionRange(start + before.length, start + before.length + selected.length);
    }

    /** @param {(index: number) => string} prefix @returns {void} */
    function prefixLines(prefix) {
      const area = field();
      const start = area.value.lastIndexOf('\n', area.selectionStart - 1) + 1;
      area.setSelectionRange(start, area.selectionEnd);
      insertText(area.value.slice(start, area.selectionEnd).split('\n').map((line, index) => prefix(index) + line).join('\n'));
    }

    /** @param {string} snippet A block of Markdown, inserted on lines of its own. @returns {void} */
    function insertBlock(snippet) {
      const area = field();
      const before = area.value.slice(0, area.selectionStart);
      const gap = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
      insertText(`${gap}${snippet}\n`);
    }

    /** @param {number} line @param {boolean} done @returns {void} */
    function toggleCheck(line, done) {
      const source = (state.editing ? editor.getValue() : current().body).split('\n');
      source[line] = source[line].replace(/^- \[[ x]\]/, done ? '- [x]' : '- [ ]');
      if (state.editing) {
        editor.setValue(source.join('\n'), { silent: true });
        draftChanged();
      } else current().body = source.join('\n');
    }

    // --------------------------------------------------------------- page actions --

    /** @param {string|null} parent Parent page id, or null for the top of the space. @returns {void} */
    function createPage(parent) {
      if (state.editing) finishEditing({ quiet: true });
      created += 1;
      const id = `new-${created}`;
      pages.push({
        ID: id, space: state.space, parent, title: 'Untitled', author: ME, editor: ME, created: NOW.toISOString(),
        updated: null, contributors: [ME], history: [[ME, null, 'created the page']], body: ''
      });
      openPage(id);
      startEditing();
    }

    /** The star is a toggle: pressed, it shows the solid form (`.star-toggle` in kit.css). @returns {void} */
    function syncStar() {
      starButton.setAttribute('aria-pressed', String(favorites.has(state.page)));
    }

    /** @returns {void} */
    function toggleFavorite() {
      if (favorites.has(state.page)) favorites.delete(state.page);
      else favorites.add(state.page);
      syncStar();
      renderNav();
    }

    /** @param {string} action A value from the overflow menu. @returns {void} */
    function pageAction(action) {
      const page = current();
      if (action === 'history') openHistory();
      if (action === 'child') createPage(page.ID);
      if (action === 'move') openMove();
      if (action === 'delete') void deletePage();
      if (action === 'export') {
        const slug = page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        downloadBlob(`${slug || 'page'}.md`, `# ${page.title}\n\n${page.body}\n`, { type: 'text/markdown' });
        notify(`Exported “${page.title}” as Markdown.`);
      }
    }

    /** @returns {Promise<void>} */
    async function deletePage() {
      const page = current();
      const doomed = [page, ...readingOrder(page.ID)];
      const confirmed = await Dialog.confirm({
        title: 'Delete page?',
        message: doomed.length > 1
          ? `“${page.title}” and its ${doomed.length - 1} sub-pages will be deleted for everyone.`
          : `“${page.title}” will be deleted for everyone.`,
        okLabel: 'Delete',
        danger: true
      });
      if (!confirmed || context.signal.aborted) return;
      for (const gone of doomed) {
        pages.splice(pages.indexOf(gone), 1);
        favorites.delete(gone.ID);
      }
      if (page.parent) openPage(page.parent);
      else showHome();
      notify(`Deleted “${page.title}”.`);
    }

    /**
     * Adds a comment by the signed-in user to the open page.
     * @param {string} text
     * @param {number|null} [replyTo] The comment whose thread it answers; null opens a thread.
     * @returns {boolean} Whether there was anything to post.
     */
    function postComment(text, replyTo = null) {
      const body = text.trim();
      if (!body) return false;
      commentId += 1;
      comments.push({ ID: commentId, page: state.page, author: ME, at: null, replyTo, text: body });
      renderComments();
      return true;
    }

    /** @returns {void} */
    function postFromComposer() {
      if (postComment(composer.value)) composer.value = '';
    }

    // -------------------------------------------------------------------- overlays --

    const launcher = context.preview ? null : keep(new Launcher(null, {
      shortcut: false,
      label: 'Search the knowledge base',
      placeholder: 'Search pages and commands',
      emptyText: 'No pages match.'
    }));

    /** @returns {void} */
    function openLauncher() {
      if (!launcher) return;
      // Opened from the navigation drawer, the drawer closes first, so the palette hands the focus
      // back to something that is still on screen.
      closeDrawers();
      /** @param {string} id @returns {string} */
      const spaceName = (id) => spaces.find((space) => space.ID === id)?.name ?? '';
      launcher.setItems([
        ...pages.map((page) => ({
          id: page.ID,
          label: page.title,
          description: pathOf(page).slice(0, -1).map((step) => step.title).join(' › ') || spaceName(page.space),
          group: spaceName(page.space),
          icon: 'file-lines',
          keywords: page.body.match(/^#{2,4} .+$/gm) ?? [],
          current: page.ID === state.page && state.view === 'page',
          invoke: () => openPage(page.ID)
        })),
        { id: 'new', label: 'New page', group: 'Commands', icon: 'plus', invoke: () => createPage(null) },
        { id: 'edit', label: 'Edit this page', group: 'Commands', icon: 'pen', invoke: () => startEditing() },
        { id: 'home', label: `Go to ${currentSpace().name} home`, group: 'Commands', icon: 'house', invoke: () => showHome() }
      ]);
      launcher.open();
    }

    /**
     * Opens a dialog around a Fieldset; the primary button hands the field values over. The dialog
     * and everything in it are destroyed when it closes, or when the layout unmounts first.
     * @param {{title: string, fields: Record<string, object>, submit: string,
     *   onsubmit: (values: Record<string, any>) => void}} options
     * @returns {void}
     */
    function formDialog({ title, fields, submit, onsubmit }) {
      if (context.preview) return;
      const fieldset = keep(new Fieldset(null, { fields }));
      const dialog = keep(new Dialog(null, {
        title,
        size: 'sm',
        content: h('div', { class: 'form-sheet' }, fieldset.toElement()),
        buttons: [
          { label: 'Cancel', action: 'cancel' },
          {
            label: submit,
            kind: 'primary',
            action: (self) => {
              onsubmit(fieldset.getValues());
              self.close();
            }
          }
        ]
      }));
      dialog.on('close', () => {
        fieldset.destroy();
        dialog.destroy();
      });
      dialog.open();
    }

    /** @returns {void} */
    function openShare() {
      const page = current();
      const onPage = state.view === 'page';
      formDialog({
        title: onPage ? `Share “${page.title}”` : `Share ${currentSpace().name}`,
        submit: 'Share',
        fields: {
          people: {
            type: 'tagpicker',
            label: 'Invite people',
            props: { items: PEOPLE.filter((who) => who.id !== ME).map((who) => ({ ID: who.id, name: who.name })), placeholder: 'Add people by name' }
          },
          access: {
            type: 'zxselect',
            label: 'General access',
            value: 'org',
            props: { items: [{ ID: 'org', name: 'Everyone at ACME can view' }, { ID: 'space', name: 'Only space members can view' }, { ID: 'invited', name: 'Only invited people' }] }
          },
          link: {
            type: 'custom',
            label: 'Link',
            // Any component can sit in a Fieldset through a small adapter; the field owns it.
            adapter: (field) => {
              const copy = field.own(new CopyInput(null, {
                value: `https://wiki.acme.example/${state.space}/${onPage ? page.ID : ''}`
              }));
              return { el: copy.el, get: () => copy.get(), set: () => {}, focus: () => copy.focus(), setDisabled: () => {} };
            }
          }
        },
        onsubmit: ({ people }) => notify(people.length
          ? `Invited ${people.length} ${people.length === 1 ? 'person' : 'people'}.`
          : 'Sharing settings saved.')
      });
    }

    /** @returns {void} */
    function openMove() {
      const page = current();
      const excluded = new Set([page.ID, ...readingOrder(page.ID).map((child) => child.ID)]);
      formDialog({
        title: `Move “${page.title}”`,
        submit: 'Move',
        fields: {
          parent: {
            type: 'zxselect',
            label: 'Put it under',
            description: 'Sub-pages move with it.',
            value: page.parent ?? 'top',
            props: {
              filter: 'local',
              items: [
                { ID: 'top', name: `Top level of ${currentSpace().name}` },
                ...readingOrder().filter((candidate) => !excluded.has(candidate.ID))
                  .map((candidate) => ({ ID: candidate.ID, name: pathOf(candidate).map((step) => step.title).join(' › ') }))
              ]
            }
          }
        },
        onsubmit: ({ parent }) => {
          page.parent = parent === 'top' ? null : parent;
          openPage(page.ID);
          notify(`Moved “${page.title}”.`);
        }
      });
    }

    /** @returns {void} */
    function openSettings() {
      const space = currentSpace();
      formDialog({
        title: `${space.name} settings`,
        submit: 'Save',
        fields: {
          name: { type: 'text', label: 'Name', value: space.name, required: true },
          description: { type: 'textarea', label: 'Description', value: space.description },
          access: {
            type: 'zxselect',
            label: 'Who can view',
            value: space.private ? 'members' : 'org',
            props: { items: [{ ID: 'org', name: 'Everyone at ACME' }, { ID: 'members', name: 'Space members only' }] }
          }
        },
        onsubmit: ({ name, description, access }) => {
          Object.assign(space, { name: name.trim() || space.name, description: description.trim(), private: access === 'members' });
          spaceSelect.setItems(spaces);
          spaceSelect.set(space.ID, { silent: true });
          if (state.view === 'home') renderHome();
          else renderPage();
          notify('Space settings saved.');
        }
      });
    }

    /** @type {{sheet: Sheet, list: ActivityList}|null} */
    let historySheet = null;
    /** @returns {void} */
    function openHistory() {
      if (context.preview) return;
      historySheet ??= (() => {
        const list = keep(new ActivityList(null, { label: 'Versions' }));
        const sheet = keep(new Sheet(null, { title: 'Page history', side: 'end', size: 400, content: list.toElement() }));
        return { sheet, list };
      })();
      const page = current();
      const versions = [
        ...page.history,
        ...(page.updated ? [[page.editor, page.updated, 'edited the page']] : []),
        [page.author, page.created, 'created the page']
      ].sort((a, b) => (b[1] ?? '9').localeCompare(a[1] ?? '9'));
      historySheet.list.setItems(versions.map(([who, at, summary], index) => ({
        id: index,
        actor: person(who)?.name,
        avatar: { name: person(who)?.name, size: 'sm' },
        title: summary,
        timeLabel: at ? `${since(at)} · ${formatDate(new Date(at), DATE.dateTime)}` : 'just now',
        actions: index === 0 ? [] : [{
          id: 'restore',
          label: 'Restore',
          onselect: () => {
            historySheet.sheet.close();
            notify(`Restored the version from ${at ? formatDate(new Date(at), DATE.short) : 'today'}.`);
          }
        }]
      })));
      historySheet.sheet.setTitle(`History of “${page.title}”`);
      historySheet.sheet.open();
    }

    // ------------------------------------------------------------------- keyboard --

    // A handler that returns false declines its key, leaving it to the focused widget or the host.
    shortcuts(root, {
      'Mod+k': () => openLauncher(),
      e: () => startEditing(),
      '[': () => stepPage(-1),
      ']': () => stepPage(1),
      'Mod+Enter': () => (state.editing ? finishEditing() : false),
      'Mod+s': () => {
        if (!state.editing) return false;
        commitDraft();
        saving.set('success', 'Saved');
        return true;
      },
      'Mod+b': () => state.editing && wrapSelection('**'),
      'Mod+i': () => state.editing && wrapSelection('*')
    }, context);
    shortcuts(composer, { 'Mod+Enter': () => postFromComposer() }, context);
    // Escape finishes editing from anywhere in the layout, text fields included (the shared map skips
    // text fields). While reading it is left alone, so whatever hosts the layout can use it to close.
    root.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !state.editing || event.defaultPrevented) return;
      event.preventDefault();
      finishEditing();
    }, { signal: context.signal });

    renderNav();
    renderPage();
    container.append(root);
    syncOutline();
  }
};
