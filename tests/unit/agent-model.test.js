import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTIVITY,
  AGENT_ITEM_KEYS,
  AGENT_MESSAGES,
  RUN_ACTIVITY,
  STATUS,
  agentAvatarOptions,
  agentFaceTraits,
  authorFace,
  blocksToMarkdown,
  blocksToText,
  figureRow,
  formatDuration,
  formatElapsed,
  initialsOf,
  inlineText,
  mentionPattern,
  normalizeActivity,
  normalizeRunState,
  parseInline,
  runCost,
  traceSummary
} from '../../src/internal/agent-model.js';
import { highlight, isHighlighted } from '../../src/internal/highlight.js';

/* ------------------------------------------------------------------ inline grammar -- */

test('the inline grammar knows bold, code, and citations, and nothing else', () => {
  assert.deepEqual(parseInline('Paid **€4,860.00** on `RE-0121` [2].'), [
    { kind: 'text', text: 'Paid ' },
    { kind: 'strong', text: '€4,860.00' },
    { kind: 'text', text: ' on ' },
    { kind: 'code', text: 'RE-0121' },
    { kind: 'text', text: ' ' },
    { kind: 'cite', text: '[2]', n: 2 },
    { kind: 'text', text: '.' }
  ]);
});

test('markup-looking model text stays text', () => {
  const segments = parseInline('<img src=x onerror=alert(1)> [link](https://example.com) _em_');
  assert.deepEqual(segments, [{ kind: 'text', text: '<img src=x onerror=alert(1)> [link](https://example.com) _em_' }]);
});

test('an unclosed marker stays literal until its close arrives', () => {
  assert.deepEqual(parseInline('half **stre'), [{ kind: 'text', text: 'half **stre' }]);
  assert.deepEqual(parseInline('a `tick'), [{ kind: 'text', text: 'a `tick' }]);
  assert.deepEqual(parseInline('half **streamed**'), [{ kind: 'text', text: 'half ' }, { kind: 'strong', text: 'streamed' }]);
});

test('a backslash makes a marker literal; code spans are verbatim', () => {
  assert.deepEqual(parseInline('2 \\*\\* 3 and \\[1] and \\`x\\` and \\\\'), [{ kind: 'text', text: '2 ** 3 and [1] and `x` and \\' }]);
  assert.deepEqual(parseInline('**a \\** b**'), [{ kind: 'strong', text: 'a ** b' }]);
  assert.deepEqual(parseInline('`a\\*b`'), [{ kind: 'code', text: 'a\\*b' }]);
});

test('citations are one to three digits and never zero', () => {
  assert.deepEqual(parseInline('[0] [1234] [x]').map((segment) => segment.kind), ['text']);
  assert.equal(parseInline('see [12]').at(-1)?.kind, 'cite');
  assert.equal(inlineText('**Bold** and `code` [3]'), 'Bold and code [3]');
});

test('empty and missing text parse to nothing', () => {
  assert.deepEqual(parseInline(''), []);
  assert.deepEqual(parseInline(null), []);
  assert.deepEqual(parseInline('****'), [{ kind: 'text', text: '****' }]);
});

/* ------------------------------------------------------------------ export -- */

const ANSWER = [
  { type: 'heading', level: 2, text: 'October cash' },
  { type: 'p', text: 'October should close **€62,400.00** ahead [1].' },
  { type: 'list', ordered: true, items: ['Payroll', 'Bills'] },
  { type: 'quote', text: 'Dear Ms Weber,\nplease pay.' },
  { type: 'code', language: 'sql', code: 'select 1' },
  { type: 'table', columns: ['Invoice', 'Amount'], rows: [['RE-1', '€1|2']] },
  { type: 'figures', rows: [['Expected in', '58 invoices', '€246,800.00'], { label: 'Going out', value: '€184,400.00', call: 'payroll' }] },
  { type: 'callout', tone: 'warning', title: 'Tight day', text: '27 October' },
  { type: 'artifact', id: 'a1', title: 'Forecast.xlsx', kind: 'document', versions: 2 }
];

test('blocksToMarkdown writes every block type', () => {
  assert.equal(blocksToMarkdown(ANSWER), [
    '## October cash',
    'October should close **€62,400.00** ahead [1].',
    '1. Payroll\n2. Bills',
    '> Dear Ms Weber,\n> please pay.',
    '```sql\nselect 1\n```',
    '| Invoice | Amount |\n| --- | --- |\n| RE-1 | €1\\|2 |',
    '- Expected in (58 invoices): **€246,800.00**\n- Going out: **€184,400.00**',
    '> **Tight day** 27 October',
    '**Forecast.xlsx**'
  ].join('\n\n'));
});

test('blocksToText drops markers and keeps citations', () => {
  const text = blocksToText(ANSWER);
  assert.ok(text.includes('October should close €62,400.00 ahead [1].'));
  assert.ok(text.includes('Expected in\t58 invoices\t€246,800.00'));
  assert.ok(!text.includes('**'));
  assert.equal(blocksToText(null), '');
});

test('figure rows read the same in both forms', () => {
  assert.deepEqual(figureRow(['A', 'b', '1']), { label: 'A', detail: 'b', value: '1', call: null });
  assert.deepEqual(figureRow({ label: 'A', value: '1', call: 'c1' }), { label: 'A', detail: '', value: '1', call: 'c1' });
});

/* ------------------------------------------------------------------ runs -- */

test('traceSummary counts calls, retries, sources, and finished time', () => {
  const summary = traceSummary([
    { id: 'think', kind: 'think', label: 'Planned', ms: 300 },
    { id: 's', kind: 'search', label: 'Searched', sources: 9, ms: 1200 },
    { id: 'b1', label: 'Fetched', status: 'failed', ms: 10_000 },
    { id: 'b2', label: 'Fetched', retryOf: 'b1', ms: 2100 },
    { id: 'h', kind: 'handoff', label: 'Handed over', actor: 'a', to: 'b' },
    { id: 'r', label: 'Drafting', status: 'running', ms: 999 }
  ]);
  assert.equal(summary.calls, 4);
  assert.equal(summary.retries, 1);
  assert.equal(summary.steps, 5);
  assert.equal(summary.failed, 0, 'a failed call that was retried does not count as failed');
  assert.equal(summary.sources, 9);
  assert.equal(summary.ms, 300 + 1200 + 10_000 + 2100);
  assert.equal(summary.running?.id, 'r');
  assert.equal(traceSummary([{ id: 'x', label: 'X', status: 'failed' }]).failed, 1);
  assert.equal(traceSummary([{ id: 'x', label: 'X', status: 'stopped' }]).stopped?.id, 'x');
});

test('durations read the way a person says them', () => {
  assert.equal(formatDuration(600, { locale: 'en' }), '0.6 s');
  assert.equal(formatDuration(9_949, { locale: 'en' }), '9.9 s');
  assert.equal(formatDuration(12_100), '12 s');
  assert.equal(formatDuration(102_000), '1 min 42 s');
  assert.equal(formatElapsed(3_900_000), '1 h 5 min');
  assert.equal(formatDuration(-1), '');
  assert.equal(formatDuration(Number.NaN), '');
});

test('runCost multiplies tokens by their prices', () => {
  assert.equal(runCost([1000, 100], { in: 0.000006, out: 0.00002 }).toFixed(4), '0.0080');
  assert.equal(runCost(null, { in: 1, out: 1 }), 0);
});

test('initials come from the first and last word', () => {
  assert.equal(initialsOf('Finance agent'), 'FA');
  assert.equal(initialsOf('Ada'), 'AD');
  assert.equal(initialsOf(''), '?');
});

/* ------------------------------------------------------------------ states -- */

test('every state and activity has a glyph or tone and a word', () => {
  for (const [state, entry] of Object.entries(STATUS)) {
    assert.ok(entry.status, `${state} has no glyph`);
    assert.ok(entry.tone, `${state} has no tone`);
    assert.ok(AGENT_MESSAGES[entry.key], `${state} has no word`);
  }
  for (const [activity, entry] of Object.entries(ACTIVITY)) {
    assert.ok(entry.tone, `${activity} has no tone`);
    assert.ok(AGENT_MESSAGES[entry.key], `${activity} has no word`);
  }
  assert.equal(normalizeRunState('nonsense'), 'done');
  assert.equal(normalizeRunState('waiting'), 'waiting');
  assert.equal(normalizeActivity('__proto__'), null);
  assert.equal(normalizeActivity('needs-you'), 'needs-you');
});

/* ------------------------------------------------------------------ highlighter -- */

test('the highlighter colours keywords, strings, numbers, and comments and returns no markup', () => {
  const segments = highlight('js', 'const total = 42; // sum\nconst name = "x";');
  const tokens = segments.filter((segment) => segment.token).map((segment) => `${segment.token}:${segment.text}`);
  assert.deepEqual(tokens, ['keyword:const', 'number:42', 'comment:// sum', 'keyword:const', 'string:"x"']);
  assert.equal(segments.map((segment) => segment.text).join(''), 'const total = 42; // sum\nconst name = "x";');
});

test('SQL keywords are caseless, unknown languages stay plain', () => {
  assert.ok(highlight('sql', 'SELECT * FROM t').some((segment) => segment.token === 'keyword' && segment.text === 'SELECT'));
  assert.deepEqual(highlight('cobol', 'MOVE A TO B'), [{ text: 'MOVE A TO B', token: null }]);
  assert.deepEqual(highlight('js', ''), []);
  assert.equal(isHighlighted('TS'), true);
  assert.equal(isHighlighted('brainfuck'), false);
});

test('a string still being streamed is coloured to its end', () => {
  const segments = highlight('python', 'print("unfinished');
  assert.equal(segments.at(-1)?.token, 'string');
});

/* ------------------------------------------------------------------ agent faces -- */

test('RUN_ACTIVITY gives every run state an agent expression', () => {
  assert.deepEqual(Object.keys(RUN_ACTIVITY).sort(), Object.keys(STATUS).sort());
  for (const activity of Object.values(RUN_ACTIVITY)) assert.ok(Object.hasOwn(ACTIVITY, activity), activity);
  assert.equal(RUN_ACTIVITY.running, 'working');
  assert.equal(RUN_ACTIVITY.waiting, 'needs-you');
  assert.equal(RUN_ACTIVITY.blocked, 'blocked');
  assert.equal(RUN_ACTIVITY.failed, 'blocked');
  for (const state of ['queued', 'paused', 'done', 'stopped', 'skipped']) assert.equal(RUN_ACTIVITY[state], 'idle', state);
  assert.ok(Object.isFrozen(RUN_ACTIVITY));
});

test('an author face contributes its traits and nothing else; a person or another value has none', () => {
  const face = {
    seed: 'agt-1', tone: 'teal', body: 'hexagon', eyes: 'oval', mouth: 'cat', cheeks: false, material: 'soft', spacing: 2,
    name: 'Spoofed', label: 'Click me', size: 96, animate: true, phase: 0.5, activity: 'needs-you',
    expression: 'happy', indicator: false, msg: { 'agent.activity.idle': 'x' }, class: 'evil'
  };
  assert.deepEqual(authorFace({ name: 'Ledger', face }),
    { seed: 'agt-1', tone: 'teal', body: 'hexagon', eyes: 'oval', mouth: 'cat', cheeks: false, material: 'soft', spacing: 2 });
  assert.deepEqual(authorFace({ name: 'Ledger', face: true }), {});
  assert.equal(authorFace({ name: 'Ada', kind: 'person', face: true }), null);
  for (const value of [undefined, null, false, 'yes', 1, ['seed']]) assert.equal(authorFace({ name: 'Ledger', face: value }), null);
  assert.equal(authorFace(null), null);
  // Only well-formed traits are kept.
  assert.deepEqual(authorFace({ face: { seed: '', tone: 7, spacing: 3, eyes: null, mouth: 1, cheeks: 'yes' } }), {});
});

test('a number seed is read as text, so an agent has one face wherever it is drawn', () => {
  assert.deepEqual(authorFace({ face: { seed: 42 } }), { seed: '42' });
  assert.deepEqual(agentFaceTraits({ seed: 42, name: 'Ledger' }), { seed: '42', name: 'Ledger' });
  assert.equal(agentAvatarOptions({ seed: 42 }).seed, '42');
  assert.equal(agentAvatarOptions({ seed: '42' }).seed, '42');
  for (const seed of [Number.NaN, Number.POSITIVE_INFINITY]) assert.ok(!('seed' in agentAvatarOptions({ seed })), String(seed));
});

test('agentAvatarOptions: the place decides how a face is drawn; data says only which face it is', () => {
  const data = {
    seed: 'agt-1', name: 'Ledger', tone: 'teal', body: 'drop', eyes: 'square', material: 'soft', spacing: 0,
    size: 96, label: 'Spoofed', animate: true, phase: 0.5, activity: 'needs-you', activityLabel: 'Help', indicator: false,
    expression: 'happy', msg: { 'agent.activity.needsYou': 'x' }
  };
  const fixed = { size: 'sm', label: null, animate: false };
  assert.deepEqual(agentAvatarOptions(data, fixed), {
    seed: 'agt-1', name: 'Ledger', tone: 'teal', body: 'drop', eyes: 'square', material: 'soft', spacing: 0,
    size: 'sm', label: null, animate: false
  });
  // A place that lets its data say what the agent is doing carries those keys, and only those.
  const carried = agentAvatarOptions(data, fixed, { carry: AGENT_ITEM_KEYS });
  assert.equal(carried.activity, 'needs-you');
  assert.equal(carried.activityLabel, 'Help');
  assert.equal(carried.indicator, false);
  assert.equal(carried.expression, 'happy');
  assert.ok(!('expression' in agentAvatarOptions(data, fixed)), 'an expression is carried only where the place allows it');
  assert.deepEqual(carried.msg, data.msg);
  assert.ok(!('phase' in carried) && carried.size === 'sm' && carried.label === null && carried.animate === false);
  // Fixed options win over carried ones.
  assert.equal(agentAvatarOptions(data, { activity: null }, { carry: AGENT_ITEM_KEYS }).activity, null);
});

test('agentAvatarOptions: fallbacks fill what the source leaves out, and no source is no face', () => {
  assert.deepEqual(agentAvatarOptions(true, { size: 'sm' }, { fallback: { name: 'Step 3 of 6', tone: 'violet' } }),
    { name: 'Step 3 of 6', tone: 'violet', size: 'sm' });
  assert.deepEqual(agentAvatarOptions({ name: 'Ledger', tone: 'teal' }, {}, { fallback: { name: 'Title', tone: 'violet' } }),
    { name: 'Ledger', tone: 'teal' });
  assert.equal(agentAvatarOptions({ name: '' }, {}, { fallback: { name: 'Title' } }).name, 'Title', 'an empty name is no name');
  for (const value of [undefined, null, false, 'yes', 0, ['seed']]) assert.equal(agentAvatarOptions(value, { size: 'sm' }), null);
  const source = { seed: 'agt-1', name: 'Ledger' };
  agentAvatarOptions(source, { size: 'sm' }).seed = 'changed';
  assert.deepEqual(source, { seed: 'agt-1', name: 'Ledger' }, 'the source is never changed');
});

test('mentionPattern finds whole mentions only, in any script', () => {
  const find = (text, names, trigger) => [...text.matchAll(mentionPattern(names, trigger) ?? /$^/g)].map((match) => match[0]);
  assert.deepEqual(find('Ask @Annabel', ['Ann']), [], 'a longer name is not the shorter one');
  assert.deepEqual(find('Ask @Annabel and @Ann', ['Ann', 'Annabel']), ['@Annabel', '@Ann']);
  assert.deepEqual(find('ann@Ledger.example', ['Ledger']), [], 'an e-mail address mentions nobody');
  assert.deepEqual(find('@Ledger, please', ['Ledger']), ['@Ledger']);
  assert.deepEqual(find('(@Ledger) and @Ledger.', ['Ledger']), ['@Ledger', '@Ledger']);
  assert.deepEqual(find('@Annéa', ['Ann']), [], 'a letter outside ASCII still continues the word');
  assert.deepEqual(find('@Ann\u0301', ['Ann']), [], 'so does a combining mark');
  assert.deepEqual(find('山田@Ledger', ['Ledger']), []);
  assert.deepEqual(find('@Ann_1', ['Ann']), []);
  assert.deepEqual(find('hi @Finance agent.', ['Finance agent']), ['@Finance agent']);
  assert.deepEqual(find('#Finance agent', ['Finance agent'], '#'), ['#Finance agent']);
  assert.deepEqual(find('@a.b+c', ['a.b+c']), ['@a.b+c'], 'a name is matched literally');
  assert.equal(mentionPattern([]), null);
  assert.equal(mentionPattern(['', null]), null);
});
