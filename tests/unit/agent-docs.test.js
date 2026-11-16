/*
 * The agent documentation comes in tiers: `docs/llms.txt` (the index, with rules and two tracks),
 * `docs/llms-small.txt` (a first read under 8k tokens), `docs/components/<id>.md` (one section of
 * the reference each) and `docs/llms.md` (everything). The smaller tiers are generated from the
 * reference and the surface catalog, so a stale or hand-edited file is caught here, as the
 * catalog's generated files are.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { CATALOG, INTENTS, PROFILES } from '../../src/components/surface/catalog.js';
import {
  COMPONENTS_DIR, SITE, agentDocsFiles, componentPageIds, demoLede, firstSentence, markdownSection, markerProblems, referenceSections,
  shiftHeadings
} from '../../tools/build-agent-docs.js';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
/** @param {string} path @returns {string} */
const read = (path) => readFileSync(join(root, path), 'utf8');

const reference = read('docs/llms.md');
const sections = referenceSections(reference);
const files = agentDocsFiles();
const small = files['docs/llms-small.txt'];

test('the generated files match a fresh generation, and a second one is identical', () => {
  for (const [path, content] of Object.entries(files)) {
    assert.equal(read(path), content, `${path} is stale: run npm run build:agent-docs`);
  }
  assert.deepEqual(agentDocsFiles(), files, 'the generation is not deterministic');
  const onDisk = readdirSync(join(root, COMPONENTS_DIR)).map((name) => `${COMPONENTS_DIR}/${name}`).sort();
  const generated = Object.keys(files).filter((path) => path.startsWith(`${COMPONENTS_DIR}/`)).sort();
  assert.deepEqual(onDisk, generated, `${COMPONENTS_DIR}/ holds files the generator does not write`);
});

test('the small tier stays under 32 KB and carries what a first read needs', () => {
  assert.ok(Buffer.byteLength(small) < 32 * 1024, `docs/llms-small.txt is ${Buffer.byteLength(small)} bytes`);
  for (const heading of ['## Mental model', '## Start from a layout, not a blank page', '## The component for the job', '## Never', '## Composing surfaces at runtime', '## Component files']) {
    assert.ok(small.includes(`\n${heading}\n`), `missing ${heading}`);
  }
  assert.ok(small.includes('| The screen | Start from | Not from |'), 'the layout chooser table');
  assert.ok(small.includes('| Job | Use | Rather than |'), 'the component-for-the-job table');
  assert.ok(small.includes(markdownSection(reference, '### Never')), 'the never-list, as the reference has it');
  for (const intent of INTENTS) assert.ok(small.includes(`| \`${intent}\` |`), `intent ${intent}`);
  for (const profile of PROFILES) assert.ok(small.includes(`- \`${profile}\` — intents`), `profile ${profile}`);
  for (const { id } of sections) assert.ok(small.includes(`(${SITE}/${COMPONENTS_DIR}/${id}.md)`), `no link to ${id}.md`);
});

test('there is one component file per reference section, opening with a summary and its links', () => {
  const pages = new Set(componentPageIds(read('website/docs.js')));
  const ids = sections.map((section) => section.id);
  assert.ok(ids.length > 80, `${ids.length} sections`);
  assert.deepEqual(Object.keys(files).filter((path) => path.startsWith(`${COMPONENTS_DIR}/`) && !path.endsWith('/index.md')).sort(),
    ids.map((id) => `${COMPONENTS_DIR}/${id}.md`).sort());
  for (const page of pages) assert.ok(ids.includes(page), `the ${page} page has no component file`);
  for (const { id, text } of sections) {
    const file = files[`${COMPONENTS_DIR}/${id}.md`];
    const [title, blank, summary, blank2, links] = file.split('\n');
    assert.match(title, /^# \S/, `${id}: title`);
    assert.equal(`${blank}${blank2}`, '', `${id}: layout of the opening`);
    assert.match(summary, /^[^\s#>-].{10,}[.!?]$/, `${id}: one-line summary`);
    assert.ok(links.includes(`Full reference: ${SITE}/docs/llms.md`), `${id}: link to the full reference`);
    const demo = pages.has(id) ? `${SITE}/docs.html#components/${id}` : /Live demo: (\S+)/.exec(links)?.[1];
    assert.ok(demo && links.includes(`Live demo: ${demo}`), `${id}: link to the live demo`);
    // The body is the section itself: every bullet of it arrives.
    for (const bullet of text.match(/^- \*\*[^*]+\*\*/gm) ?? []) assert.ok(file.includes(bullet), `${id}: ${bullet}`);
    assert.ok(files[`${COMPONENTS_DIR}/index.md`].includes(`](${id}.md) — ${summary}`), `${id}: not in the index`);
  }
});

test('the generator reads sections, headings, ledes and sentences the way the reference writes them', () => {
  assert.equal(shiftHeadings('#### A\n```sh\n# not a heading\n```\n##### B', -2), '## A\n```sh\n# not a heading\n```\n### B');
  assert.equal(firstSentence('An APG combobox: a real input.\nLocale presets follow. More.'), 'An APG combobox: a real input.');
  assert.equal(firstSentence('Calls `Dialog.confirm()` once. Then more.'), 'Calls `Dialog.confirm()` once.');
  assert.equal(demoLede("export default {\n  title: 'X',\n  blurb: 'One ' +\n    'two \\u2014 it\\'s \"three\".',\n  examples: []\n};"), 'One two — it\'s "three".');
  assert.equal(demoLede("export default {\n  title: 'X',\n  examples: [{\n    blurb: 'not the lede'\n  }]\n};"), '');
  assert.equal(markdownSection('## A\ntext\n### B\nmore\n## C\nend', '## A'), 'text\n### B\nmore');
  assert.equal(markdownSection('## A\n```md\n## not C\n```\n## C', '## A'), '```md\n## not C\n```');
});

test('the generator reads only sound section markers, and names every one that is not', () => {
  assert.deepEqual(markerProblems(reference), [], 'docs/llms.md');
  // Markers written about — in a code span, in fenced code — are not markers.
  const sound = [
    'Each section is wrapped in `<!-- doc:<name> -->` markers.',
    '<!-- doc:alpha -->', '## Alpha', 'Text.', '<!-- /doc -->',
    '```html', '<!-- doc:in-code -->', '```',
    '<!-- doc:beta-2 -->', '## Beta', '<!-- /doc -->'
  ].join('\n');
  assert.deepEqual(markerProblems(sound), []);
  assert.deepEqual(referenceSections(sound), [{ id: 'alpha', text: '## Alpha\nText.' }, { id: 'beta-2', text: '## Beta' }]);

  const malformed = [
    '<!-- doc:alpha -->', '## Alpha',
    '<!-- doc:beta -->', '<!-- /doc -->',
    '<!-- /doc -->',
    '<!-- doc:alpha -->', '<!-- /doc -->',
    '<!-- doc:../escape -->', '<!-- /doc -->',
    '<!-- doc:index -->', '<!-- /doc -->',
    '<!-- doc:Upper_Case -->', '<!-- /doc -->',
    '<!-- doc: -->', '<!-- /doc -->',
    '<!-- doc gamma -->', '<!-- /doc -->',
    '<!-- /doc gamma -->',
    '<!-- doc:last -->', '## Never closed'
  ].join('\n');
  const expected = [
    [3, '<!-- doc:beta -->', /opens inside <!-- doc:alpha --> \(line 1\), which is not closed yet$/],
    [5, '<!-- /doc -->', /closes no section$/],
    [6, '<!-- doc:alpha -->', /repeats the id opened on line 1$/],
    [8, '<!-- doc:\.\.\/escape -->', /"\.\.\/escape", which is not a safe file name/],
    [10, '<!-- doc:index -->', /takes the id "index"/],
    [12, '<!-- doc:Upper_Case -->', /"Upper_Case", which is not a safe file name/],
    [14, '<!-- doc: -->', /names no id$/],
    [16, '<!-- doc gamma -->', /is not a section marker/],
    [18, '<!-- \/doc gamma -->', /is not a closing marker/],
    [18, '<!-- \/doc gamma -->', /closes no section$/],
    [19, '<!-- doc:last -->', /is never closed$/]
  ];
  const problems = markerProblems(malformed);
  assert.equal(problems.length, expected.length, problems.join('\n'));
  expected.forEach(([line, marker, pattern], index) => {
    assert.match(problems[index], new RegExp(`^line ${line}: ${marker} `), problems[index]);
    assert.match(problems[index], pattern);
  });
  // Reading the sections refuses the whole reference, every problem named, before anything is made of it.
  assert.throws(() => referenceSections(malformed), (error) => error instanceof Error && problems.every((problem) => error.message.includes(problem)));
});

test('llms.txt opens with the rules for agents, then a track for writing code and one for runtime surfaces', () => {
  for (const path of ['docs/llms.txt', 'website/llms.txt']) {
    const text = read(path);
    const headings = [...text.matchAll(/^## (.+)$/gm)].map(([, heading]) => heading);
    assert.deepEqual(headings.slice(0, 3), ['Rules for agents', 'Writing Zx code', 'Composing surfaces at runtime'], path);
    assert.ok(headings.includes('Start here: choosing'), `${path} keeps "Start here: choosing"`);
    assert.match(text, /^# .+\n\n(?:> .*\n)+\n## Rules for agents\n/, `${path}: the rules come right after the summary`);
    const rules = markdownSection(text, '## Rules for agents').split('\n');
    assert.ok(rules.length <= 12, `${path}: ${rules.length} lines of rules`);
    const said = rules.join('\n');
    for (const [rule, pattern] of Object.entries({
      layout: /layout/, documented: /options, methods, and events the reference documents/, tokens: /semantic `--zx-\*` tokens only/,
      innerHTML: /innerHTML/, icons: /`icon\(name\)`/, motion: /prefers-reduced-motion/, surfaces: /`surface\/1`[^\n]*never HTML/,
      profile: /narrowest surface profile/, reply: /person's answer, not as proof/
    })) assert.match(said, pattern, `${path}: the ${rule} rule`);
    const writing = markdownSection(text, '## Writing Zx code');
    for (const link of ['docs/llms-small.txt', 'docs/components/index.md', 'docs/llms.md', 'docs.html']) {
      assert.ok(writing.includes(`(${SITE}/${link})`), `${path}: Writing Zx code links ${link}`);
    }
    const runtime = markdownSection(text, '## Composing surfaces at runtime');
    for (const link of ['docs/agent-surfaces.md', 'docs/agent-catalog.json', 'docs/components/surface.md']) {
      assert.ok(runtime.includes(`(${SITE}/${link})`), `${path}: Composing surfaces links ${link}`);
    }
  }
});

test('the tiers carry public product documentation only, and ship in the package and the site', () => {
  for (const [path, content] of Object.entries(files)) {
    assert.doesNotMatch(content, /specs\/|\bWP-?\d|AGENTS\.md|DESIGN-NOTES|RELEASING\.md|\.claude\//, path);
  }
  const pkg = JSON.parse(read('package.json'));
  for (const path of ['docs/llms-small.txt', 'docs/components']) assert.ok(pkg.files.includes(path), `package.json files: ${path}`);
  assert.equal(pkg.scripts['build:agent-docs'], 'node tools/build-agent-docs.js');
  assert.match(read('tools/build-site.js'), /\['docs\/llms-small\.txt', 'llms-small\.txt'\]/);
  for (const path of ['README.md', '.claude/skills/zx/SKILL.md']) {
    const text = read(path);
    assert.match(text, /llms-small\.txt/, `${path} points at the small tier`);
    const runtime = /^## Composing surfaces at runtime\n([\s\S]*?)(?=^## )/m.exec(text)?.[1] ?? '';
    assert.ok(runtime, `${path} has a "Composing surfaces at runtime" section`);
    for (const word of ['profile', 'one reply', 'errors']) assert.match(runtime, new RegExp(word, 'i'), `${path}: ${word}`);
  }
});

test('every component page offers Copy page and Copy prompt through the library\'s copy button', () => {
  const source = read('website/docs.js');
  assert.match(source, /^import \{ copyButton as libraryCopyButton \} from '\.\.\/src\/components\/copy\/copy-button\.js';$/m);
  assert.match(source, /libraryCopyButton\(\{ label: 'Copy page'/);
  assert.match(source, /libraryCopyButton\(\{ label: 'Copy prompt'/);
  const prompt = /function agentPrompt\(entry\) \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? '';
  assert.match(prompt, /\$\{SITE_URL\}\/docs\/llms-small\.txt/);
  assert.match(prompt, /\$\{SITE_URL\}\/docs\/components\/\$\{entry\.id\}\.md/);
  assert.match(source, new RegExp(`const SITE_URL = '${SITE}';`));
  // Every catalog node's guidance is public product documentation, too.
  for (const entry of Object.values(CATALOG.nodes)) assert.doesNotMatch(`${entry.use} ${entry.avoid}`, /specs\/|\bWP-?\d|AGENTS\.md/);
});
