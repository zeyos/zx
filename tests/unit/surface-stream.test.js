import assert from 'node:assert/strict';
import test from 'node:test';

import { inlineSplitter, lineSplitter } from '../../src/components/surface/stream.js';

/**
 * Runs text through `lineSplitter()` in the given chunks.
 * @param {string[]} chunks @param {object} [options]
 */
function splitLines(chunks, options = {}) {
  const lines = [];
  const errors = [];
  const splitter = lineSplitter((line) => lines.push(line), { ...options, onerror: (error) => errors.push(error) });
  for (const chunk of chunks) splitter.write(chunk);
  splitter.end();
  return { lines, errors };
}

/**
 * Runs answer text through `inlineSplitter()` in the given chunks, recording every call in order.
 * @param {string[]} chunks @param {object} [options]
 */
function splitInline(chunks, options = {}) {
  const calls = [];
  const splitter = inlineSplitter({
    ...options,
    ontext: (text) => calls.push(['text', text]),
    online: (line) => calls.push(['line', line]),
    onerror: (error) => calls.push(['error', error.code])
  });
  for (const chunk of chunks) splitter.write(chunk);
  splitter.end();
  const text = calls.filter(([kind]) => kind === 'text').map(([, value]) => value).join('');
  const lines = calls.filter(([kind]) => kind === 'line').map(([, value]) => value);
  const errors = calls.filter(([kind]) => kind === 'error').map(([, value]) => value);
  return { calls, text, lines, errors };
}

/** Every way of cutting a string in two. @param {string} text @returns {string[][]} */
function everySplit(text) {
  return Array.from({ length: text.length + 1 }, (_, index) => [text.slice(0, index), text.slice(index)]);
}

test('lineSplitter emits whole lines for every chunk boundary, \\r\\n included', () => {
  const text = '{"op":"begin"}\r\n{"op":"node"}\n\n{"op":"end"}';
  const expected = ['{"op":"begin"}', '{"op":"node"}', '', '{"op":"end"}'];
  for (const chunks of everySplit(text)) assert.deepEqual(splitLines(chunks).lines, expected, JSON.stringify(chunks));
  assert.deepEqual(splitLines([...text]).lines, expected, 'one character at a time');
});

test('lineSplitter keeps a lone \\r inside a line and drops only the one before \\n', () => {
  assert.deepEqual(splitLines(['a\rb\r', '\nc\r']).lines, ['a\rb', 'c']);
});

test('lineSplitter reports an over-long line instead of buffering it and carries on', () => {
  const long = 'x'.repeat(50);
  const { lines, errors } = splitLines(['ok\n', long.slice(0, 20), long.slice(20), long, '\nnext\n'], { maxLine: 16 });
  assert.deepEqual(lines, ['ok', 'next']);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'line-too-long');
});

test('lineSplitter accepts a line of exactly maxLine characters, with or without \\r\\n', () => {
  const line = 'y'.repeat(16);
  assert.deepEqual(splitLines([`${line}\r\n${line}\n${line}`], { maxLine: 16 }).lines, [line, line, line]);
  const over = splitLines([`${line}z\n`], { maxLine: 16 });
  assert.deepEqual(over.lines, []);
  assert.equal(over.errors.length, 1);
});

test('lineSplitter reports a last line over the limit at end()', () => {
  const { lines, errors } = splitLines(['short\n', 'z'.repeat(17)], { maxLine: 16 });
  assert.deepEqual(lines, ['short']);
  assert.equal(errors.length, 1);
});

test('lineSplitter ignores writes after end()', () => {
  const lines = [];
  const splitter = lineSplitter((line) => lines.push(line));
  splitter.write('a\nb');
  splitter.end();
  splitter.write('c\n');
  splitter.end();
  assert.deepEqual(lines, ['a', 'b']);
});

const FENCED = [
  'Here is the form.\n',
  '```zx-surface\n',
  '{"op":"begin","surface":"s1"}\n',
  '{"op":"end","surface":"s1"}\n',
  '```\n',
  'Between ``` the fences.\n',
  '```zx-surface\n',
  '{"op":"begin","surface":"s2"}\n',
  '```\n',
  'After.'
].join('');
const FENCED_PROSE = 'Here is the form.\nBetween ``` the fences.\nAfter.';
const FENCED_LINES = ['{"op":"begin","surface":"s1"}', '{"op":"end","surface":"s1"}', '{"op":"begin","surface":"s2"}'];

test('inlineSplitter separates fences from prose for a split at every offset', () => {
  for (const chunks of everySplit(FENCED)) {
    const { text, lines, errors } = splitInline(chunks);
    assert.equal(text, FENCED_PROSE, JSON.stringify(chunks));
    assert.deepEqual(lines, FENCED_LINES, JSON.stringify(chunks));
    assert.deepEqual(errors, []);
  }
  const single = splitInline([...FENCED]);
  assert.equal(single.text, FENCED_PROSE);
  assert.deepEqual(single.lines, FENCED_LINES);
});

test('inlineSplitter handles \\r\\n line breaks around and inside fences', () => {
  const text = FENCED.replace(/\n/g, '\r\n');
  for (const chunks of everySplit(text)) {
    const { text: prose, lines } = splitInline(chunks);
    assert.equal(prose, FENCED_PROSE.replace(/\n/g, '\r\n'), JSON.stringify(chunks));
    assert.deepEqual(lines, FENCED_LINES);
  }
});

test('inlineSplitter keeps the order of prose and lines', () => {
  const { calls } = splitInline([FENCED]);
  const kinds = calls.map(([kind]) => kind).join(',');
  assert.equal(kinds, 'text,line,line,text,line,text');
});

test('inlineSplitter does not hold prose back by a whole line', () => {
  const seen = [];
  const splitter = inlineSplitter({ ontext: (text) => seen.push(text) });
  splitter.write('Hello wor');
  assert.equal(seen.join(''), 'Hello wor', 'prose in the middle of a line goes out at once');
  splitter.write('ld\nNext');
  assert.equal(seen.join(''), 'Hello world\nNext');
  splitter.write('\n``');
  assert.equal(seen.join(''), 'Hello world\nNext\n', 'only a possible fence start is held');
  splitter.write('x and more');
  assert.equal(seen.join(''), 'Hello world\nNext\n``x and more', 'released once it cannot be the fence');
  splitter.end();
});

test('inlineSplitter holds a possible opening fence only until it cannot be one', () => {
  const seen = [];
  const splitter = inlineSplitter({ ontext: (text) => seen.push(text) });
  splitter.write('```zx-surf');
  assert.deepEqual(seen, []);
  splitter.write('ace2\n');
  assert.equal(seen.join(''), '```zx-surface2\n');
  splitter.end();
});

test('inlineSplitter leaves other lines starting with three backticks as prose', () => {
  const text = '```js\nconst a = 1;\n```\n ```zx-surface\n```zx-surface \n';
  for (const chunks of everySplit(text)) {
    const { text: prose, lines } = splitInline(chunks);
    assert.equal(prose, text, JSON.stringify(chunks));
    assert.deepEqual(lines, []);
  }
});

test('inlineSplitter only closes a fence on a line reading exactly ```', () => {
  const { text, lines, errors } = splitInline(['```zx-surface\n{"a":1}\n``` \n````\n```\ntail']);
  assert.deepEqual(lines, ['{"a":1}', '``` ', '````']);
  assert.equal(text, 'tail');
  assert.deepEqual(errors, []);
});

test('inlineSplitter reports a fence still open at end()', () => {
  for (const text of ['Intro\n```zx-surface\n{"op":"begin"}\n', 'Intro\n```zx-surface\n{"op":"begin"}', 'Intro\n```zx-surface']) {
    const { text: prose, lines, errors } = splitInline([text]);
    assert.equal(prose, 'Intro\n');
    assert.deepEqual(errors, ['unterminated-fence'], text);
    assert.deepEqual(lines, text.includes('{') ? ['{"op":"begin"}'] : []);
  }
});

test('inlineSplitter accepts a closing fence without a final line break', () => {
  const { text, lines, errors } = splitInline(['```zx-surface\n{"x":1}\n```']);
  assert.equal(text, '');
  assert.deepEqual(lines, ['{"x":1}']);
  assert.deepEqual(errors, []);
});

test('inlineSplitter keeps lineSplitter\'s limit inside a fence', () => {
  const { lines, errors } = splitInline([`\`\`\`zx-surface\n${'q'.repeat(40)}\nshort\n\`\`\`\n`], { maxLine: 16 });
  assert.deepEqual(lines, ['short']);
  assert.deepEqual(errors, ['line-too-long']);
});

test('inlineSplitter passes HTML-looking prose through untouched', () => {
  const text = 'Use <b>care</b> & <script>x()</script>\n';
  assert.equal(splitInline([text]).text, text);
});
