import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acceptsFile, autosizeHeight, filterMentions, isSubmitKey, mentionQuery, mentionsInText, normalizeTools, rowRange
} from '../../src/components/composer/composer.js';

const AGENTS = [
  { id: 'finance', label: 'Finance agent', description: 'Invoices and payments' },
  { id: 'sales', label: 'Sales agent', description: 'Pipeline and quotes' },
  { id: 'support', label: 'Support agent', description: 'Tickets and returns' }
];

test('mentionQuery reads the text after the trigger up to the caret', () => {
  assert.deepEqual(mentionQuery('@', 1), { start: 0, query: '' });
  assert.deepEqual(mentionQuery('Ask @fin', 8), { start: 4, query: 'fin' });
  assert.deepEqual(mentionQuery('Ask @fin about it', 8), { start: 4, query: 'fin' });
  // The caret decides where the query ends.
  assert.deepEqual(mentionQuery('Ask @finance', 6), { start: 4, query: 'f' });
  assert.deepEqual(mentionQuery('line one\n@sa', 12), { start: 9, query: 'sa' });
});

test('mentionQuery needs the trigger to open a word and the query to hold no whitespace', () => {
  assert.equal(mentionQuery('mail@example', 12), null);
  assert.equal(mentionQuery('@Finance agent ', 15), null);
  assert.equal(mentionQuery('@fin ance', 9), null);
  assert.equal(mentionQuery('no trigger', 10), null);
  assert.equal(mentionQuery('', 0), null);
  assert.equal(mentionQuery('Ask @fin', 3), null, 'a caret before the trigger is not in a mention');
});

test('mentionQuery takes another trigger', () => {
  assert.deepEqual(mentionQuery('see #12', 7, '#'), { start: 4, query: '12' });
  assert.equal(mentionQuery('see @12', 7, '#'), null);
});

test('filterMentions ranks label prefixes, then word prefixes, then substrings', () => {
  assert.deepEqual(filterMentions(AGENTS, '').map((item) => item.id), ['finance', 'sales', 'support']);
  assert.deepEqual(filterMentions(AGENTS, 's').map((item) => item.id), ['sales', 'support']);
  assert.deepEqual(filterMentions(AGENTS, 'nt').map((item) => item.id), ['finance', 'sales', 'support']);
  assert.deepEqual(filterMentions(AGENTS, 'sup').map((item) => item.id), ['support']);
  assert.deepEqual(filterMentions(AGENTS, 'AGENT').map((item) => item.id), ['finance', 'sales', 'support']);
  // A description matches on the start of a word, an identifier on its start.
  assert.deepEqual(filterMentions(AGENTS, 'quotes').map((item) => item.id), ['sales']);
  assert.deepEqual(filterMentions(AGENTS, 'voices'), []);
  assert.deepEqual(filterMentions([{ id: 'ops-bot', label: 'Operations' }], 'ops').map((item) => item.id), ['ops-bot']);
  assert.deepEqual(filterMentions(AGENTS, 'zzz'), []);
});

test('filterMentions ignores accents and malformed items', () => {
  const items = [{ id: 1, label: 'Zoë Müller' }, null, { label: 'no id' }, { id: 2 }];
  assert.deepEqual(filterMentions(/** @type {any} */ (items), 'mull').map((item) => item.id), [1]);
  assert.deepEqual(filterMentions(/** @type {any} */ (items), 'zoe').map((item) => item.id), [1]);
  assert.deepEqual(filterMentions(/** @type {any} */ (null), 'a'), []);
});

test('mentionsInText keeps the picked mentions still written, once each', () => {
  const picked = [AGENTS[0], AGENTS[1], AGENTS[0]];
  assert.deepEqual(mentionsInText('@Finance agent and @Sales agent', picked).map((item) => item.id), ['finance', 'sales']);
  assert.deepEqual(mentionsInText('@Sales agent only', picked).map((item) => item.id), ['sales']);
  assert.deepEqual(mentionsInText('Finance agent without the trigger', picked), []);
  assert.deepEqual(mentionsInText('#Finance agent', picked, '#').map((item) => item.id), ['finance']);
});

test('isSubmitKey: Enter sends and Shift+Enter breaks the line', () => {
  assert.equal(isSubmitKey({ key: 'Enter' }, 'enter', { apple: true }), true);
  assert.equal(isSubmitKey({ key: 'Enter', shiftKey: true }, 'enter', { apple: true }), false);
  assert.equal(isSubmitKey({ key: 'Enter', altKey: true }, 'enter', { apple: false }), false);
  assert.equal(isSubmitKey({ key: 'Enter', metaKey: true }, 'enter', { apple: true }), true);
  assert.equal(isSubmitKey({ key: 'a' }, 'enter'), false);
});

test('isSubmitKey: Mod+Enter sends in the instruction style, and plain Enter does not', () => {
  assert.equal(isSubmitKey({ key: 'Enter' }, 'mod+enter', { apple: true }), false);
  assert.equal(isSubmitKey({ key: 'Enter', metaKey: true }, 'mod+enter', { apple: true }), true);
  assert.equal(isSubmitKey({ key: 'Enter', ctrlKey: true }, 'mod+enter', { apple: true }), false);
  assert.equal(isSubmitKey({ key: 'Enter', ctrlKey: true }, 'mod+enter', { apple: false }), true);
  assert.equal(isSubmitKey({ key: 'Enter', metaKey: true }, 'mod+enter', { apple: false }), false);
  assert.equal(isSubmitKey({ key: 'Enter', ctrlKey: true, shiftKey: true }, 'mod+enter', { apple: false }), false);
});

test('isSubmitKey: a key during an IME composition never sends', () => {
  assert.equal(isSubmitKey({ key: 'Enter', isComposing: true }, 'enter', { apple: true }), false);
  assert.equal(isSubmitKey({ key: 'Enter', keyCode: 229 }, 'enter', { apple: true }), false);
  assert.equal(isSubmitKey({ key: 'Enter', metaKey: true, isComposing: true }, 'mod+enter', { apple: true }), false);
});

test('acceptsFile reads extensions, MIME types and MIME groups', () => {
  const pdf = { name: 'Invoice 2041.PDF', type: 'application/pdf' };
  const png = { name: 'chart.png', type: 'image/png' };
  assert.equal(acceptsFile(pdf, ''), true);
  assert.equal(acceptsFile(pdf, '.pdf'), true);
  assert.equal(acceptsFile(pdf, 'image/*'), false);
  assert.equal(acceptsFile(png, 'image/*, .pdf'), true);
  assert.equal(acceptsFile(png, 'application/pdf'), false);
  assert.equal(acceptsFile(pdf, 'application/pdf'), true);
});

test('autosizeHeight grows with the content between one row and maxRows', () => {
  const metrics = { lineHeight: 24, padding: 8, maxRows: 4 };
  assert.deepEqual(autosizeHeight(0, metrics), { height: 32, scrolls: false });
  assert.deepEqual(autosizeHeight(32, metrics), { height: 32, scrolls: false });
  assert.deepEqual(autosizeHeight(80, metrics), { height: 80, scrolls: false });
  assert.deepEqual(autosizeHeight(104, metrics), { height: 104, scrolls: false });
  assert.deepEqual(autosizeHeight(400, metrics), { height: 104, scrolls: true });
  assert.deepEqual(autosizeHeight(400, { ...metrics, border: 2 }), { height: 106, scrolls: true });
  assert.deepEqual(autosizeHeight(400, { lineHeight: 24, maxRows: 0 }), { height: 24, scrolls: true });
});

test('rowRange keeps whole rows, at least one, the least never above the most', () => {
  assert.deepEqual(rowRange(), { min: 1, max: 10 });
  assert.deepEqual(rowRange(3, 8), { min: 3, max: 8 });
  assert.deepEqual(rowRange(3.7, 8.9), { min: 3, max: 8 });
  assert.deepEqual(rowRange(12, 6), { min: 6, max: 6 }, 'minRows is capped at maxRows');
  assert.deepEqual(rowRange(0, 0), { min: 1, max: 1 });
  assert.deepEqual(rowRange(-2, 4), { min: 1, max: 4 });
  assert.deepEqual(rowRange(/** @type {any} */ ('2'), /** @type {any} */ ('5')), { min: 2, max: 5 });
  assert.deepEqual(rowRange(/** @type {any} */ (null), /** @type {any} */ ('x')), { min: 1, max: 1 });
});

test('autosizeHeight never shrinks below minRows, and maxRows stays the ceiling', () => {
  const metrics = { lineHeight: 24, padding: 8, minRows: 3, maxRows: 6 };
  // An empty text still spans three rows.
  assert.deepEqual(autosizeHeight(0, metrics), { height: 80, scrolls: false });
  assert.deepEqual(autosizeHeight(32, metrics), { height: 80, scrolls: false });
  // Content beyond the floor grows the text as before.
  assert.deepEqual(autosizeHeight(104, metrics), { height: 104, scrolls: false });
  assert.deepEqual(autosizeHeight(152, metrics), { height: 152, scrolls: false });
  assert.deepEqual(autosizeHeight(400, metrics), { height: 152, scrolls: true });
  // A floor above the ceiling is the ceiling.
  assert.deepEqual(autosizeHeight(0, { lineHeight: 24, padding: 8, minRows: 9, maxRows: 4 }), { height: 104, scrolls: false });
});

test('normalizeTools keeps valid tools once each, in order', () => {
  const tools = normalizeTools([
    { id: 'search', label: 'Web search', icon: 'search', pressed: false },
    { id: 'params', label: 'Parameters', icon: 'gear' },
    { id: 'search', label: 'Duplicate', icon: 'star' },
    { id: 'nameless', label: '  ', icon: 'star' },
    { id: 'glyphless', label: 'No icon' },
    { label: 'No id', icon: 'star' },
    null,
    'search'
  ]);
  assert.deepEqual(tools.map((tool) => tool.id), ['search', 'params']);
  assert.equal(tools[0].label, 'Web search');
  assert.deepEqual(normalizeTools(null), []);
  assert.deepEqual(normalizeTools({ id: 'x', label: 'X', icon: 'x' }), []);
});

test('normalizeTools makes a toggle only of a boolean pressed, and keeps the application\'s fields', () => {
  const [toggle, plain, numeric] = normalizeTools([
    { id: 7, label: 'Deep research', icon: 'book', pressed: true, disabled: 1, ref: { mode: 'deep' } },
    { id: 'params', label: 'Parameters', icon: 'gear', pressed: 'yes' },
    { id: 'n', label: 'N', icon: 'hash', pressed: 0 }
  ]);
  assert.deepEqual(toggle, { id: '7', label: 'Deep research', icon: 'book', pressed: true, disabled: true, ref: { mode: 'deep' } });
  assert.equal('pressed' in plain, false, 'a non-boolean pressed makes a plain button');
  assert.equal(plain.disabled, false);
  assert.equal('pressed' in numeric, false);
});
