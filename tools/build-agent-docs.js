/**
 * Writes the smaller tiers of the agent documentation from `docs/llms.md` and the surface catalog,
 * so a coding agent can start with a few thousand tokens instead of the whole reference:
 *
 * - `docs/llms-small.txt`: the mental model, the layout chooser, the component for each job, what
 *   never to build, the surface intents and profiles, and a link to every component's file;
 * - `docs/components/<id>.md`: one file per `<!-- doc:<id> -->` section of `docs/llms.md`, opening
 *   with a one-line summary and links to the full reference and the live demo;
 * - `docs/components/index.md`: the list of those files.
 *
 * Every word comes from `docs/llms.md`, the demos' one-line ledes and the catalog, so the tiers
 * cannot say anything the reference does not. Run by `npm run build:agent-docs`. The output is
 * deterministic, so a second run leaves no diff, and `tests/unit/agent-docs.test.js` fails when
 * the committed files are stale.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG, LIMITS, PROFILES, narrowCatalog } from '../src/components/surface/catalog.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** The public site the links point at. */
export const SITE = 'https://zx.zeyos.com';

/** Where the per-component files live, relative to the repository root. */
export const COMPONENTS_DIR = 'docs/components';

/**
 * Reference sections without a component page of their own, and the live page that shows them.
 * The ZeyOS binding is documented beside the components and shown working in its layout.
 */
const LIVE_PAGES = Object.freeze({ zeyos: 'layouts.html#zeyos-invoices' });

/**
 * One `<!-- doc:<id> -->` section of the reference.
 * @typedef {Object} ReferenceSection
 * @property {string} id The marker's id, which is the component page's id.
 * @property {string} heading The section's first heading, without its `#` marks.
 * @property {string} title The part of the heading before a dash: the component's name.
 * @property {string} body The section without its first heading, trimmed.
 * @property {string} summary One line saying what the component is.
 * @property {string} demo The address of its live demo.
 */

/**
 * What a section id may be: it names the file `docs/components/<id>.md`, so lowercase letters and
 * digits in words joined by single hyphens, nothing a path could be built from.
 */
const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Ids a section cannot take: the generator writes these files itself. */
const RESERVED_IDS = new Set(['index']);

/**
 * One `<!-- doc:<id> -->` or `<!-- /doc -->` marker as written.
 * @typedef {Object} DocMarker
 * @property {string} text The marker, as written.
 * @property {number} line Its line, from 1.
 * @property {number} start Where it starts in the reference.
 * @property {number} end Where it ends.
 * @property {boolean} close Whether it closes a section.
 * @property {string} rest What follows `doc` inside the comment.
 */

/**
 * Every section marker of the reference, in order — well formed or not. A marker the reference
 * writes about, inside backticks or a fenced code block, is not one.
 * @param {string} reference
 * @returns {DocMarker[]}
 */
function docMarkers(reference) {
  /** @type {DocMarker[]} */
  const markers = [];
  let fenced = false;
  let offset = 0;
  reference.split('\n').forEach((line, index) => {
    if (/^\s*```/.test(line)) fenced = !fenced;
    else if (!fenced) {
      // Code spans are blanked to their length, so positions still match the line.
      const visible = line.replace(/(`+)[^`]+?\1/g, (span) => ' '.repeat(span.length));
      for (const match of visible.matchAll(/<!--\s*(\/?)\s*doc\b([\s\S]*?)-->/g)) {
        const start = /** @type {number} */ (match.index);
        markers.push({
          text: line.slice(start, start + match[0].length), line: index + 1,
          start: offset + start, end: offset + start + match[0].length, close: match[1] === '/', rest: match[2]
        });
      }
    }
    offset += line.length + 1;
  });
  return markers;
}

/**
 * Reads the reference's sections and checks their markers: each section opened once and closed
 * once, none inside another, no id used twice, every id a safe file name.
 * @param {string} reference
 * @returns {{sections: {id: string, text: string}[], problems: string[]}} The sections, and one
 *   message per problem naming the marker and its line.
 */
function parseReference(reference) {
  /** @type {{id: string, text: string}[]} */
  const sections = [];
  /** @type {string[]} */
  const problems = [];
  /** @type {Map<string, number>} Line each id was first opened on. */
  const opened = new Map();
  /** @type {{id: string, marker: DocMarker}|null} */
  let open = null;
  for (const marker of docMarkers(reference)) {
    const at = `line ${marker.line}: ${marker.text}`;
    if (marker.close) {
      if (marker.rest.trim()) problems.push(`${at} is not a closing marker; a section closes with <!-- /doc -->`);
      if (!open) {
        problems.push(`${at} closes no section`);
        continue;
      }
      sections.push({ id: open.id, text: reference.slice(open.marker.end, marker.start).trim() });
      open = null;
      continue;
    }
    const named = /^\s*:([\s\S]*)$/.exec(marker.rest);
    const id = named ? named[1].trim() : '';
    if (!named) problems.push(`${at} is not a section marker; a section opens with <!-- doc:<id> -->`);
    else if (!id) problems.push(`${at} names no id`);
    else if (RESERVED_IDS.has(id)) problems.push(`${at} takes the id "${id}", which the generator's own ${id}.md uses`);
    else if (!SAFE_ID.test(id)) problems.push(`${at} has the id "${id}", which is not a safe file name: lowercase letters and digits, joined by single hyphens`);
    else if (opened.has(id)) problems.push(`${at} repeats the id opened on line ${opened.get(id)}`);
    if (id && !opened.has(id)) opened.set(id, marker.line);
    if (open) problems.push(`${at} opens inside ${open.marker.text} (line ${open.marker.line}), which is not closed yet`);
    open = { id, marker };
  }
  if (open) problems.push(`line ${open.marker.line}: ${open.marker.text} is never closed`);
  return { sections, problems };
}

/**
 * The problems with the reference's `<!-- doc: -->` markers, which the generator checks before it
 * writes or deletes anything: one message per problem, naming the marker and its line.
 * @param {string} reference The text of `docs/llms.md`.
 * @returns {string[]} Empty when every marker is sound.
 */
export function markerProblems(reference) {
  return parseReference(reference).problems;
}

/**
 * The `<!-- doc:<id> -->` sections of the reference, in the order the reference has them.
 * @param {string} reference The text of `docs/llms.md`.
 * @returns {{id: string, text: string}[]}
 * @throws {Error} Naming every marker that is not sound (see `markerProblems()`).
 */
export function referenceSections(reference) {
  const { sections, problems } = parseReference(reference);
  if (problems.length) throw new Error(`docs/llms.md has unsound section markers:\n${problems.map((problem) => `  ${problem}`).join('\n')}`);
  return sections;
}

/**
 * The part of a Markdown document under a heading, up to the next heading of the same level or
 * above; empty when the heading is missing. Fenced code is not mistaken for headings.
 * @param {string} markdown @param {string} heading The heading line, e.g. `### Never`.
 * @param {{withHeading?: boolean}} [options]
 * @returns {string}
 */
export function markdownSection(markdown, heading, options = {}) {
  const lines = markdown.split('\n');
  const level = /^#+/.exec(heading)?.[0].length ?? 0;
  const start = lines.findIndex((line) => line.trimEnd() === heading);
  if (start < 0 || level === 0) return '';
  let end = lines.length;
  let fenced = false;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*```/.test(lines[index])) fenced = !fenced;
    if (fenced) continue;
    const match = /^(#{1,6}) /.exec(lines[index]);
    if ((match && match[1].length <= level) || /^<!--\s*\/?doc/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(options.withHeading ? start : start + 1, end).join('\n').trim();
}

/**
 * Moves every heading outside fenced code by `shift` levels, never above `#` or below `######`.
 * @param {string} markdown @param {number} shift Negative to promote.
 * @returns {string}
 */
export function shiftHeadings(markdown, shift) {
  let fenced = false;
  return markdown.split('\n').map((line) => {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (fenced) return line;
    return line.replace(/^(#{1,6}) /, (marks) => `${'#'.repeat(Math.min(6, Math.max(1, marks.length - 1 + shift)))} `);
  }).join('\n');
}

/**
 * The ids `website/docs.js` builds a component page for.
 * @param {string} source The text of `website/docs.js`.
 * @returns {string[]}
 */
export function componentPageIds(source) {
  const match = /const COMPONENT_IDS\s*=\s*\[([\s\S]*?)\]/.exec(source);
  return match ? [...match[1].matchAll(/'([^']+)'/g)].map(([, id]) => id) : [];
}

/**
 * The lede a demo module gives its page — its top-level `blurb` — read from the source rather
 * than by importing it, since a demo may need a browser to load.
 * @param {string} source A demo module's text.
 * @returns {string} The lede, or '' when the module has none.
 */
export function demoLede(source) {
  const match = /^ {2}blurb:\s*((?:(?:'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")\s*\+?\s*)+)[,\n]/m.exec(source);
  if (!match) return '';
  return [...match[1].matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)]
    .map(([, single, double]) => JSON.parse(`"${(single ?? double).replace(/\\'/g, "'").replace(/(?<!\\)"/g, '\\"')}"`))
    .join('');
}

/**
 * The first sentence of a text, with its whitespace collapsed.
 * @param {string} text @returns {string}
 */
export function firstSentence(text) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return /^(.+?[.!?])(?=\s+[A-Z`*"(<]|$)/.exec(flat)?.[1] ?? flat;
}

/**
 * The opening paragraph of a section body: the prose before its first list, table, code or heading.
 * @param {string} body @returns {string}
 */
function openingParagraph(body) {
  const lines = [];
  for (const line of body.split('\n')) {
    if (!line.trim()) {
      if (lines.length) break;
      continue;
    }
    if (/^\s*(?:[-*] |\d+\. |```|\||#|>)/.test(line)) break;
    lines.push(line.trim());
  }
  return lines.join(' ');
}

/**
 * One line saying what a component is: the first sentence of its page's lede, unless that sentence
 * speaks about the page; else the first sentence of its reference section; else its name and the
 * lead-ins of its first bullets.
 * @param {string} title @param {string} body @param {string} lede
 * @returns {string}
 */
function summarize(title, body, lede) {
  const fromLede = lede ? firstSentence(lede) : '';
  if (fromLede && !/\bthis page\b/i.test(fromLede)) return fromLede;
  const opening = openingParagraph(body);
  if (opening) return firstSentence(opening);
  const labels = [...body.matchAll(/^- \*\*([^*]+)\*\*/gm)].map(([, label]) => label).slice(0, 6);
  return `${title}: ${labels.join(', ')}.`;
}

/**
 * Inline HTML tags in a summary, set as code so Markdown shows them rather than parsing them.
 * @param {string} text @returns {string}
 */
function codeTags(text) {
  return text.replace(/(`[^`]*`)|(<\/?[a-z][^>\s]*(?:\s[^>]*)?>)/g, (whole, span, tag) => span ?? `\`${tag}\``);
}

/**
 * Reads the reference and the demos and describes every section.
 * @returns {ReferenceSection[]}
 */
export function componentSections() {
  const reference = readFileSync(join(root, 'docs/llms.md'), 'utf8');
  const pages = new Set(componentPageIds(readFileSync(join(root, 'website/docs.js'), 'utf8')));
  return referenceSections(reference).map(({ id, text }) => {
    const [first, ...rest] = text.split('\n');
    const heading = first.replace(/^#+\s*/, '').trim();
    const title = heading.split(/\s+[—–]\s+/)[0].replace(/`/g, '').trim();
    const body = rest.join('\n').trim();
    const demoPath = join(root, 'website/demos', `${id}.demo.js`);
    const lede = existsSync(demoPath) ? demoLede(readFileSync(demoPath, 'utf8')) : '';
    const page = pages.has(id) ? `docs.html#components/${id}` : (/** @type {Record<string, string>} */ (LIVE_PAGES))[id];
    if (!page) throw new Error(`docs/llms.md section "${id}" has no component page and no live page to link`);
    const shift = 1 - (/^#+/.exec(first)?.[0].length ?? 1);
    return { id, heading, title, body: shiftHeadings(body, shift), summary: codeTags(summarize(title, body, lede)), demo: `${SITE}/${page}` };
  });
}

/**
 * One component's file.
 * @param {ReferenceSection} section @returns {string}
 */
export function componentFile(section) {
  return [
    `# ${section.heading}`,
    '',
    section.summary,
    '',
    `Full reference: ${SITE}/docs/llms.md · Live demo: ${section.demo} · All components: ${SITE}/${COMPONENTS_DIR}/index.md`,
    '',
    section.body,
    ''
  ].join('\n');
}

/**
 * The list of component files.
 * @param {ReferenceSection[]} sections @returns {string}
 */
export function componentIndex(sections) {
  return [
    '# Zx components',
    '',
    `One file per component: its section of the full reference (${SITE}/docs/llms.md), opening with a one-line summary and a link to its live demo. Read ${SITE}/docs/llms-small.txt first: it says which layout and which component a screen needs.`,
    '',
    ...sections.map((section) => `- [${section.title}](${section.id}.md) — ${section.summary}`),
    ''
  ].join('\n');
}

/**
 * The surface part of the small tier, generated from the catalog.
 * @returns {string}
 */
function surfaceSummary() {
  const lines = [
    'At runtime, a model composes interface as `surface/1` JSON — never HTML — and the application validates it and draws it with Zx components. Each surface declares one intent and ends in exactly one reply; treat a reply as the person\'s answer, not as proof that anything happened. When validation reports errors, return them to the model so it can correct the surface.',
    '',
    '| Intent | Needs | Default actions | Reply values |',
    '| --- | --- | --- | --- |'
  ];
  for (const entry of Object.values(CATALOG.intents)) {
    if (!entry) continue;
    const needs = entry.requires.length ? entry.requires.map((type) => `a \`${type}\``).join(' or ') : '—';
    lines.push(`| \`${entry.intent}\` | ${needs} | ${entry.actions.join(', ') || '—'} | ${entry.reply} |`);
  }
  lines.push('', 'Give the model the narrowest profile that does the job — `surfacePrompt(CATALOG, { profile })`, `surfaceTools(CATALOG, { profile })`, `narrowCatalog(CATALOG, { profile })`; leaving it out is the whole catalog:', '');
  for (const profile of PROFILES) {
    const catalog = narrowCatalog(CATALOG, { profile });
    const intents = Object.keys(catalog.intents).map((intent) => `\`${intent}\``).join(', ');
    const nodes = Object.keys(catalog.nodes).map((type) => `\`${type}\``).join(', ');
    lines.push(`- \`${profile}\` — intents ${intents}; nodes ${nodes}.`);
  }
  lines.push(
    '',
    `Limits per surface: ${LIMITS.nodes} nodes, ${LIMITS.actions} actions, ${LIMITS.string.toLocaleString('en-US')} characters per string. Every node says when to use it and when not to in the guide and the catalogue.`,
    '',
    `- Model-facing guide: ${SITE}/docs/agent-surfaces.md`,
    `- Catalogue, JSON Schema and tool definitions: ${SITE}/docs/agent-catalog.json`,
    `- The Surface component: ${SITE}/${COMPONENTS_DIR}/surface.md`
  );
  return lines.join('\n');
}

/**
 * The small tier.
 * @param {string} reference The text of `docs/llms.md`. @param {ReferenceSection[]} sections
 * @returns {string}
 */
export function smallReference(reference, sections) {
  /** @param {string} heading @returns {string} */
  const part = (heading) => {
    const text = markdownSection(reference, heading);
    if (!text) throw new Error(`docs/llms.md has no "${heading}" section`);
    return text;
  };
  return [
    '# Xenon Design System (Zx) — small reference',
    '',
    '> Xenon is a dependency-free design system for browser applications; Zx is its vanilla-JavaScript',
    '> implementation. This is the small tier of its agent documentation: how every component works,',
    '> which layout and which component a screen needs, what never to build, and how a model composes',
    `> surfaces at runtime. Each component has its own file, listed at the end; the complete reference is`,
    `> ${SITE}/docs/llms.md.`,
    '',
    '## Mental model',
    '',
    part('## Mental model'),
    '',
    '### Events & lifecycle',
    '',
    part('## Events & lifecycle'),
    '',
    '## Start from a layout, not a blank page',
    '',
    part('### Start from a layout, not a blank page'),
    '',
    '## The component for the job',
    '',
    part('### The component for the job'),
    '',
    '## Never',
    '',
    part('### Never'),
    '',
    `The theming decisions — theme, accent, geometry, material, motion, colour roles, type — are in "Choosing what to build with" in ${SITE}/docs/llms.md.`,
    '',
    '## Composing surfaces at runtime',
    '',
    surfaceSummary(),
    '',
    '## Component files',
    '',
    `Each is the component's section of the full reference: ${SITE}/${COMPONENTS_DIR}/<id>.md.`,
    '',
    ...sections.map((section) => `- [${section.title}](${SITE}/${COMPONENTS_DIR}/${section.id}.md)`),
    ''
  ].join('\n');
}

/**
 * The generated files, by path relative to the repository root.
 * @returns {Record<string, string>}
 */
export function agentDocsFiles() {
  const reference = readFileSync(join(root, 'docs/llms.md'), 'utf8');
  const sections = componentSections();
  /** @type {Record<string, string>} */
  const files = { 'docs/llms-small.txt': smallReference(reference, sections) };
  files[`${COMPONENTS_DIR}/index.md`] = componentIndex(sections);
  for (const section of sections) files[`${COMPONENTS_DIR}/${section.id}.md`] = componentFile(section);
  return files;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  /** @type {Record<string, string>} */
  let files;
  try {
    // Everything is generated, and the reference's markers checked, before any file is touched: a
    // reference that cannot be read changes nothing.
    files = agentDocsFiles();
  } catch (error) {
    console.error(`build-agent-docs: ${error instanceof Error ? error.message : String(error)}\nNo file was written or removed.`);
    process.exit(1);
  }
  // A section that was renamed or removed leaves no file behind.
  const directory = join(root, COMPONENTS_DIR);
  if (existsSync(directory)) {
    for (const name of readdirSync(directory)) {
      if (!Object.hasOwn(files, `${COMPONENTS_DIR}/${name}`)) await rm(join(directory, name), { recursive: true, force: true });
    }
  }
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  const components = Object.keys(files).filter((path) => path.startsWith(`${COMPONENTS_DIR}/`)).length;
  console.log(`wrote docs/llms-small.txt (${Buffer.byteLength(files['docs/llms-small.txt'])} bytes) and ${components} files in ${COMPONENTS_DIR}/`);
}
