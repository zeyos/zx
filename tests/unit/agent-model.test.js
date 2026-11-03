import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTIVITY,
  AGENT_MESSAGES,
  STATUS,
  blocksToMarkdown,
  blocksToText,
  figureRow,
  formatDuration,
  formatElapsed,
  initialsOf,
  inlineText,
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
