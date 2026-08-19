/*
 * The Zx documentation application.
 *
 * One page holds three kinds of entry, all reachable from the sidebar and addressable by URL hash
 * (`#components/select`, `#layouts/master-detail`, …):
 *
 *   guide      prose from a <template data-guide> in docs.html
 *   component  a demo module from website/demos/<id>.demo.js
 *   layout     a whole application shell from website/layouts/<id>.layout.js
 *
 * A component entry is a single scrolling document rather than a set of views: the API reference
 * first, then one card per example, then the behavioural notes. Each example card carries its own
 * code, disclosed underneath the running demo, so the demo never disappears to make room for the
 * source — and the source is extracted from the function the browser just executed, so it cannot
 * drift from what is on screen. A sticky "On this page" rail keeps the long document navigable and
 * gives every example a linkable anchor (`#components/select/async-filter`).
 */

import { icon } from '../src/core/icons.js';

/** Component demos, in sidebar order. The id is the `website/demos/<id>.demo.js` basename. */
const COMPONENT_IDS = [
  'tokens', 'kernel', 'icons', 'helpers', 'gx-compat',
  'button', 'badge', 'check-button', 'toggle', 'search', 'number-field', 'rating',
  'groupbox', 'panel', 'tabbox', 'navigation-bar', 'toolbar', 'empty-state',
  'stepper', 'breadcrumb', 'split-view',
  'message', 'modal', 'dialog', 'dropdown', 'menu-button', 'tooltip',
  'select', 'checklist', 'tag-picker', 'permission',
  'date-picker', 'datebox', 'date-range', 'timebox',
  'table', 'data-filter', 'pagination', 'tree', 'finder',
  'form', 'form-widgets', 'elements',
  'value-list', 'multi-value-editor', 'field-upload'
];

/** Application layout examples. The id is the `website/layouts/<id>.layout.js` basename. */
const LAYOUT_IDS = [
  'master-detail', 'dashboard', 'inbox', 'record-page',
  'record-wizard', 'checkout-wizard', 'settings-workspace', 'zeyos-invoices'
];

const DOCS_URL = '../docs/llms.md';
const STORAGE_KEY = 'zx-docs-density';
const DENSITIES = ['cozy', 'compact'];

/**
 * Reference bullets whose lead-in label belongs in the API card at the top of the page. Everything
 * else in a `docs/llms.md` section is behaviour, and reads better after the examples that show it.
 */
const API_LABELS = /^(options?|methods?|events?|propert(y|ies)|constructor|factor(y|ies)|signature|exports?|returns?|params?|parameters|statics?|getters?|refs?|fields?|types?|variants?)\b/i;

/** Reference bullets that make up the keyboard and screen-reader contract. */
const ACCESSIBILITY_LABELS = /\b(keyboard|accessibilit|a11y|screen reader|aria)\b/i;

/** Matches a bullet in the reference markdown and captures its indent and text. */
const BULLET = /^(\s*)[-*]\s+(.*)$/;

/** @type {Map<string, string>} Module sources, fetched at most once each. */
const sourceCache = new Map();

const root = document.querySelector('#docs-app');
const shell = element('div', 'docs-shell');
const sidebar = element('aside', 'docs-sidebar');
const navigation = element('nav', 'docs-navigation');
const filterField = element('input', 'docs-filter');
const main = element('main', 'docs-main');
const article = element('div', 'docs-article');
const rail = element('aside', 'docs-rail');
const toolbar = element('div', 'docs-toolbar');

navigation.setAttribute('aria-label', 'Documentation');
filterField.type = 'search';
filterField.placeholder = 'Filter…';
filterField.setAttribute('aria-label', 'Filter the documentation');
sidebar.append(filterField, navigation);
main.append(article);
shell.append(sidebar, main, rail);
root.replaceChildren(shell, toolbar);

/** @type {Map<string, object>} Every entry, keyed by `<section>/<id>`. */
const entries = new Map();
/** @type {{id: string, label: string, groups: Map<string, object[]>}[]} */
const sections = [];
/**
 * @type {{title: string, group: string, row: HTMLElement, heading: HTMLElement | null,
 *   block: HTMLElement}[]} Every sidebar row, with the headings that have to disappear with it.
 */
const navigationRows = [];

/** Teardown for whatever the current page mounted; run before the next page is built. */
let pageCleanups = [];
let activeKey = null;
let referenceText = null;

await buildRegistry();
renderNavigation();
buildDensitySwitcher();
window.addEventListener('hashchange', route);
route();

/* ------------------------------------------------------------------- registry -- */

/** Loads the guides, demo modules, and layout modules that make up the sidebar. */
async function buildRegistry() {
  const guides = [...document.querySelectorAll('template[data-guide]')].map((template) => ({
    section: 'getting-started',
    id: template.dataset.guide,
    title: template.dataset.title || template.dataset.guide,
    blurb: template.dataset.blurb || '',
    group: 'Guides',
    kind: 'guide',
    template
  }));

  const [demoModules, layoutModules, reference] = await Promise.all([
    Promise.all(COMPONENT_IDS.map((id) => import(`./demos/${id}.demo.js`))),
    Promise.all(LAYOUT_IDS.map((id) => import(`./layouts/${id}.layout.js`))),
    // Every component page opens with its reference, so the one file behind all of them is
    // fetched once here rather than on each navigation.
    fetch(moduleUrl(DOCS_URL)).then((response) => (response.ok ? response.text() : '')).catch(() => '')
  ]);
  referenceText = reference;

  const components = demoModules.map((module, index) => describe(module.default, {
    section: 'components',
    id: COMPONENT_IDS[index],
    kind: 'component',
    group: module.default.group,
    source: `./demos/${COMPONENT_IDS[index]}.demo.js`
  }));

  const layouts = layoutModules.map((module, index) => describe(module.default, {
    section: 'layouts',
    id: LAYOUT_IDS[index],
    kind: 'layout',
    group: 'Applications',
    source: `./layouts/${LAYOUT_IDS[index]}.layout.js`
  }));

  const all = [...guides, ...components, ...layouts];
  for (const entry of all) entries.set(`${entry.section}/${entry.id}`, entry);

  for (const [id, label] of [
    ['getting-started', 'Getting started'],
    ['components', 'Components'],
    ['layouts', 'Layouts']
  ]) {
    const groups = new Map();
    for (const entry of all.filter((item) => item.section === id)) {
      if (!groups.has(entry.group)) groups.set(entry.group, []);
      groups.get(entry.group).push(entry);
    }
    sections.push({ id, label, groups });
  }
}

/**
 * Normalises one demo or layout module into a registry entry.
 *
 * Modules come in two shapes. The current one exports `examples: [{title, render}]`, which gives
 * the page one card per example with its own extracted source. The older one exports a single
 * `mount(container)`; those still render, as one unnamed example showing the whole module, so the
 * catalogue never has to be converted in one go.
 * @param {object} module The module's default export.
 * @param {{section: string, id: string, kind: string, group: string, source: string}} base
 * @returns {object}
 */
function describe(module, base) {
  const examples = (module.examples ?? []).map((example, index) => ({
    ...example,
    id: example.id || slug(example.title) || `example-${index + 1}`
  }));
  return {
    ...base,
    title: module.title,
    blurb: module.blurb || '',
    import: module.import || '',
    demoTitle: module.demoTitle || '',
    examples,
    mount: examples.length === 0 ? module.mount : null
  };
}

/* ---------------------------------------------------------------- navigation -- */

/** Builds the sidebar from the registry. */
function renderNavigation() {
  for (const section of sections) {
    const block = element('section', 'docs-navigation__section');
    const title = element('h2', 'docs-navigation__section-title', section.label);
    title.id = `nav-${section.id}`;
    block.append(title);

    for (const [group, items] of section.groups) {
      // A single-group section (Layouts) needs no second-level label.
      const heading = section.groups.size > 1
        ? element('h3', 'docs-navigation__group', group)
        : null;
      if (heading) block.append(heading);
      const list = element('ul', 'docs-navigation__list');
      for (const entry of items) {
        const key = `${entry.section}/${entry.id}`;
        const link = element('a', 'docs-navigation__item', entry.title);
        link.href = `#${key}`;
        link.dataset.key = key;
        const row = element('li', 'docs-navigation__row', undefined, link);
        list.append(row);
        navigationRows.push({ title: entry.title, group: entry.group, row, heading, block });
      }
      block.append(list);
    }
    navigation.append(block);
  }
  buildFilter();
}

/**
 * Wires the sidebar filter. Sixty entries is more than a reader can scan, and the redesign made
 * each page longer rather than shorter, so getting to the right page quickly matters more than it
 * used to. Matching covers the group name as well as the title: "picker" should find Select and
 * TagPicker even though neither says so.
 * @returns {void}
 */
function buildFilter() {
  const empty = element('p', 'docs-navigation__empty', 'No match.');
  empty.hidden = true;
  navigation.append(empty);

  const apply = () => {
    const query = filterField.value.trim().toLowerCase();
    const blocks = new Set();
    const headings = new Set();
    let matches = 0;

    for (const { title, group, row, heading, block } of navigationRows) {
      const hit = query === '' || `${title} ${group}`.toLowerCase().includes(query);
      row.hidden = !hit;
      if (!hit) continue;
      matches += 1;
      blocks.add(block);
      if (heading) headings.add(heading);
    }

    // A group label or a section with nothing left under it would read as an empty heading.
    for (const { heading, block } of navigationRows) {
      if (heading) heading.hidden = !headings.has(heading);
      block.hidden = !blocks.has(block);
    }
    empty.hidden = matches > 0;
  };

  filterField.addEventListener('input', apply);
  filterField.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      filterField.value = '';
      apply();
      return;
    }
    if (event.key !== 'Enter') return;
    const first = navigation.querySelector('.docs-navigation__row:not([hidden]) [data-key]');
    if (first) window.location.hash = `#${first.dataset.key}`;
  });

  // `/` is the conventional focus shortcut, and must not fire while the reader is typing.
  window.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      || (active instanceof HTMLElement && active.isContentEditable)) return;
    event.preventDefault();
    filterField.focus();
    filterField.select();
  });
}

/**
 * Applies the current hash: a new entry is built, while a hash that only changes the trailing
 * example anchor scrolls within the page that is already mounted.
 * @returns {void}
 */
function route() {
  const { key, anchor } = readHash();
  if (key !== activeKey) showEntry(key);
  if (anchor) scrollToAnchor(anchor);
}

/**
 * Reads the routed entry and example from the URL hash, tolerating section-only hashes.
 * @returns {{key: string, anchor: string}}
 */
function readHash() {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  const parts = hash.split('/');
  const key = parts.slice(0, 2).join('/');
  if (entries.has(key)) return { key, anchor: parts.slice(2).join('/') };
  const section = sections.find((item) => item.id === hash);
  return { key: firstKeyOf(section ?? sections[0]), anchor: '' };
}

/** @param {{groups: Map<string, object[]>}} section @returns {string} */
function firstKeyOf(section) {
  const [items] = [...section.groups.values()];
  const entry = items[0];
  return `${entry.section}/${entry.id}`;
}

/** @param {string} anchor Example id. @returns {void} */
function scrollToAnchor(anchor) {
  const target = document.getElementById(`section-${anchor}`);
  if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
}

/* --------------------------------------------------------------------- page -- */

/**
 * Builds one entry as a single scrolling document and fills the "On this page" rail from the
 * sections it produced. Navigation happens through hash links, so this never writes the hash.
 * @param {string} key Registry key, `<section>/<id>`.
 * @returns {void}
 */
function showEntry(key) {
  const entry = entries.get(key);
  if (!entry) return;

  for (const cleanup of pageCleanups.splice(0)) {
    try { cleanup(); } catch { /* a failed teardown must not block navigation */ }
  }
  activeKey = key;

  for (const link of navigation.querySelectorAll('[data-key]')) {
    if (link.dataset.key === key) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  const blocks = entry.kind === 'guide' ? guidePage(entry) : entryPage(entry);
  article.replaceChildren(...blocks);
  document.title = `${entry.title} — Zx`;
  buildToc();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/**
 * Composes a component or layout page: heading, API card, one card per example, then the
 * behavioural notes and keyboard contract that the examples have just demonstrated.
 * @param {object} entry
 * @returns {HTMLElement[]}
 */
function entryPage(entry) {
  const reference = splitReference(entry.id);
  const nodes = [pageHeader(entry, reference)];

  const api = apiSection(entry, reference);
  if (api) nodes.push(api);

  const examples = element('div', 'docs-examples', undefined,
    element('h2', 'docs-examples__title', 'Examples'));
  for (const example of entry.examples) examples.append(exampleCard(entry, example));
  if (entry.mount) examples.append(legacyCard(entry));
  nodes.push(examples);

  if (reference.notes.length) {
    nodes.push(referenceSection('notes', 'Behaviour', reference.notes));
  }
  if (reference.accessibility.length) {
    nodes.push(referenceSection('accessibility', 'Keyboard and screen readers', reference.accessibility));
  }
  nodes.push(sourceSection(entry));
  return nodes;
}

/**
 * @param {object} entry
 * @param {{summary: Node[]}} reference
 * @returns {HTMLElement}
 */
function pageHeader(entry, reference) {
  const header = element('header', 'docs-header');
  header.append(element('h1', 'docs-title', entry.title));
  if (entry.blurb) header.append(element('p', 'docs-blurb', entry.blurb));
  // The reference's opening paragraphs describe what the component is for; that belongs with the
  // title rather than buried in the API card below it.
  if (reference.summary.length) {
    const summary = element('div', 'docs-prose docs-summary');
    summary.append(...reference.summary);
    header.append(summary);
  }
  return header;
}

/**
 * The API card: how to import the component, and its options, methods, and events. This is what a
 * returning reader came for, so it sits above the examples.
 * @param {object} entry
 * @param {{api: Node[]}} reference
 * @returns {HTMLElement | null}
 */
function apiSection(entry, reference) {
  if (entry.kind !== 'component' && reference.api.length === 0) return null;

  const section = docsSection('api', 'API');
  const slot = element('div', 'docs-api__import');
  section.append(slot);
  if (entry.import) {
    slot.replaceChildren(codeBlock(entry.import, 'Import', { compact: true }));
  } else {
    void fetchSource(entry).then((source) => {
      const line = importFrom(source);
      if (line) slot.replaceChildren(codeBlock(line, 'Import', { compact: true }));
    });
  }

  if (reference.api.length) {
    const body = element('div', 'docs-prose docs-api');
    body.append(...reference.api);
    section.append(body);
  } else {
    section.append(element('p', 'docs-note', undefined,
      text('No reference section yet — see '), link(DOCS_URL, 'docs/llms.md'), text('.')));
  }
  return section;
}

/**
 * One example: title, blurb, the running component, and its source one click away. The source is
 * read back from the very function that just ran, so the card cannot show code that no longer
 * matches the demo above it.
 * @param {object} entry
 * @param {object} example
 * @returns {HTMLElement}
 */
function exampleCard(entry, example) {
  const card = docsSection(example.id, example.title, {
    className: 'docs-example',
    href: `#${entry.section}/${entry.id}/${example.id}`
  });
  if (example.blurb) card.append(element('p', 'docs-example__blurb', example.blurb));

  // The stage supplies the arrangement — a wrapped row by default — so an example's own source
  // stays a list of Zx calls instead of the flex containers that would otherwise surround them.
  const stage = element('div', `docs-example__stage docs-example__stage--${example.layout ?? 'row'}`);
  if (example.width) stage.style.maxInlineSize = example.width;
  card.append(stage);
  mountExample(example, card, stage);

  const code = example.code ?? sourceOf(example.render);
  if (code) card.append(codeDisclosure(code));
  return card;
}

/**
 * Runs one example's `render`, giving it somewhere to report events and somewhere to register
 * teardown, and appending whatever it returns to the stage.
 * @param {object} example
 * @param {HTMLElement} card
 * @param {HTMLElement} stage
 * @returns {void}
 */
function mountExample(example, card, stage) {
  let output = null;
  const lines = [];
  const context = {
    host: stage,
    /** @param {() => void} fn Runs when the reader navigates away. */
    cleanup: (fn) => pageCleanups.push(fn),
    /** @param {string} message Appended to a log below the demo, newest first. */
    log: (message) => {
      if (!output) {
        output = element('output', 'docs-example__log');
        output.setAttribute('aria-live', 'polite');
        stage.after(output);
      }
      lines.unshift(message);
      output.textContent = lines.slice(0, 8).join('\n');
    }
  };

  try {
    const result = example.render(context);
    if (result) stage.append(...[result].flat().filter(Boolean));
  } catch (error) {
    card.append(element('p', 'docs-note', `This example failed to run: ${error.message}`));
    console.error(error);
  }
}

/**
 * Renders a module that exports a single `mount(container)` rather than a list of examples. It gets
 * the same card chrome as a converted example, with the whole module as its code — the right shape
 * for the specimen galleries (tokens, icons, helpers), where the page is one exhibit rather than a
 * sequence of independent usages.
 * @param {object} entry
 * @returns {HTMLElement}
 */
function legacyCard(entry) {
  const title = entry.demoTitle || (entry.kind === 'layout' ? 'Preview' : 'Demo');
  const card = docsSection('demo', title, {
    className: 'docs-example',
    href: `#${entry.section}/${entry.id}/demo`
  });
  const stage = element('div', 'docs-example__stage docs-example__stage--full');
  try {
    entry.mount(stage);
  } catch (error) {
    stage.append(element('p', 'docs-note', `This demo failed to run: ${error.message}`));
    console.error(error);
  }
  card.append(stage);

  const disclosure = codeDisclosure('', { label: sourcePath(entry) });
  disclosure.onOpen(async () => disclosure.setCode(await fetchSource(entry)));
  card.append(disclosure);
  return card;
}

/**
 * The page's last block: the whole module behind everything above, and the reference file the API
 * card was built from.
 * @param {object} entry
 * @returns {HTMLElement}
 */
function sourceSection(entry) {
  const section = docsSection('source', 'Source');
  section.append(element('p', 'docs-note', undefined,
    text('Every example on this page comes from '),
    link(entry.source, sourcePath(entry), { target: '_blank' }),
    text(', and the reference from '), link(DOCS_URL, 'docs/llms.md'),
    text(' — the same file the Zx agent skill reads.')));

  const disclosure = codeDisclosure('', { label: sourcePath(entry), toggle: 'Whole module' });
  disclosure.onOpen(async () => disclosure.setCode(await fetchSource(entry)));
  section.append(disclosure);
  return section;
}

/* ---------------------------------------------------------------- reference -- */

/**
 * Splits a component's `docs/llms.md` section into the three places the page puts it: the opening
 * prose under the title, the API bullets in the card at the top, and the behavioural notes below
 * the examples. The split is on the bold lead-in each bullet already carries — 43 of the 47
 * sections name `Options`, `Methods`, and `Events` this way — so nothing has to be rewritten.
 * @param {string} id Demo basename, which doubles as the `<!-- doc:<id> -->` marker.
 * @returns {{summary: Node[], api: Node[], notes: Node[], accessibility: Node[]}}
 */
function splitReference(id) {
  const empty = { summary: [], api: [], notes: [], accessibility: [] };
  const match = new RegExp(`<!--\\s*doc:${id}\\s*-->([\\s\\S]*?)<!--\\s*/doc\\s*-->`).exec(referenceText ?? '');
  if (!match) return empty;

  const parsed = [...renderMarkdown(match[1]).childNodes];
  const result = { ...empty };
  let seenList = false;

  for (const node of parsed) {
    // The section's own `###` heading repeats the component name the page already shows as its
    // title; its signature, when it carries one, is worth keeping as a lead-in.
    if (node.nodeName === 'H3') {
      const signature = node.textContent.replace(/^[^—–-]*[—–-]\s*/, '');
      if (signature && signature !== node.textContent) {
        result.summary.push(element('p', 'docs-signature', signature));
      }
      continue;
    }
    if (node.nodeName !== 'UL') {
      (seenList ? result.notes : result.summary).push(node);
      continue;
    }
    seenList = true;
    for (const item of [...node.children]) {
      const label = item.firstElementChild?.nodeName === 'STRONG'
        ? item.firstElementChild.textContent : '';
      const bucket = ACCESSIBILITY_LABELS.test(label) ? 'accessibility'
        : API_LABELS.test(label) ? 'api' : 'notes';
      appendItem(result[bucket], item);
    }
  }

  // A section that names no Options or Methods documents its API some other way — Button lists its
  // two factories by signature, for instance. With nothing to separate the API from the notes, the
  // bullets are the API, and splitting them would only hide them under a "Behaviour" heading.
  if (result.api.length === 0) {
    result.api = result.notes;
    result.notes = [];
  }
  return result;
}

/**
 * Adds one bullet to a bucket, reusing the bucket's trailing list so consecutive bullets stay in
 * the same `<ul>` rather than each becoming a list of one.
 * @param {Node[]} bucket
 * @param {HTMLLIElement} item
 * @returns {void}
 */
function appendItem(bucket, item) {
  const last = bucket.at(-1);
  if (last?.nodeName === 'UL') {
    last.append(item);
    return;
  }
  const list = document.createElement('ul');
  list.append(item);
  bucket.push(list);
}

/**
 * @param {string} id
 * @param {string} title
 * @param {Node[]} nodes
 * @returns {HTMLElement}
 */
function referenceSection(id, title, nodes) {
  const section = docsSection(id, title);
  const body = element('div', 'docs-prose');
  body.append(...nodes);
  section.append(body);
  return section;
}

/* ------------------------------------------------------------------- source -- */

/**
 * Recovers an example's source from its `render` function.
 *
 * The site is served and deployed unbundled and unminified — `tools/build-site.js` copies the
 * modules verbatim — so `Function.prototype.toString` hands back the exact text in the file. A
 * parameterless arrow is unwrapped to its body, which is what makes an example read as ordinary
 * usage rather than as a callback; anything else is shown whole, so a parameter is never left
 * dangling without the signature that introduced it.
 * @param {Function} [render]
 * @returns {string}
 */
function sourceOf(render) {
  if (typeof render !== 'function') return '';
  const source = render.toString();
  const arrow = /^(?:async\s+)?\(\s*\)\s*=>\s*/.exec(source);
  if (!arrow) return dedent(source);

  const body = source.slice(arrow[0].length).trim();
  if (body.startsWith('{') && body.endsWith('}')) {
    return dedent(body.slice(1, -1).replace(/^\n|\s+$/g, ''));
  }
  return dedent(body.replace(/;$/, ''));
}

/**
 * Removes the shared indentation a nested function carries from its source file. The first line
 * arrives already flush — it followed the `=>` — so it is excluded from the measurement.
 * @param {string} code
 * @returns {string}
 */
function dedent(code) {
  const lines = code.replace(/\t/g, '  ').split('\n');
  const indents = lines.slice(1).filter((line) => line.trim()).map((line) => /^ */.exec(line)[0].length);
  const shift = indents.length ? Math.min(...indents) : 0;
  return [lines[0], ...lines.slice(1).map((line) => line.slice(shift))].join('\n').trimEnd();
}

/**
 * Builds the import line shown in the API card from the demo module's own imports, rewritten to
 * the published specifier. Deep imports into `src/` are internal paths that no consumer would
 * write, so only the package entry points are shown.
 * @param {string} source The demo module's own source.
 * @returns {string}
 */
function importFrom(source) {
  const lines = [];
  for (const match of source.matchAll(/^import\s+(\{[^}]*\}|[\w*\s,]+?)\s+from\s+'([^']+)';/gm)) {
    const specifier = /\/src\/index\.js$/.test(match[2]) ? '@zeyos/zx'
      : /\/src\/zeyos\//.test(match[2]) ? '@zeyos/zx/zeyos' : null;
    if (specifier) lines.push(`import ${match[1].replace(/\s+/g, ' ')} from '${specifier}';`);
  }
  return lines.join('\n');
}

/**
 * @param {object} entry
 * @returns {Promise<string>}
 */
async function fetchSource(entry) {
  if (sourceCache.has(entry.source)) return sourceCache.get(entry.source);
  try {
    const response = await fetch(moduleUrl(entry.source));
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const raw = await response.text();
    sourceCache.set(entry.source, raw);
    return raw;
  } catch (error) {
    return `// Could not load ${entry.source}: ${error.message}`;
  }
}

/**
 * Resolves a path that is relative to this module rather than to the page.
 *
 * `fetch()` resolves against the document, while `import()` resolves against the importing module.
 * The two agree until the build serves the application from a revision-stamped directory — then a
 * bare `fetch('./demos/x.js')` reads the unversioned copy at the site root, which is exactly the
 * file a CDN may still be holding from the previous deploy. The links shown to a reader keep
 * pointing at the stable root path; only what is read at runtime is pinned to this revision.
 * @param {string} path Path relative to `website/`.
 * @returns {string}
 */
function moduleUrl(path) {
  return new URL(path, import.meta.url).href;
}

/** @param {object} entry @returns {string} */
function sourcePath(entry) {
  return `website/${entry.source.replace(/^\.\//, '')}`;
}

/* --------------------------------------------------------------------- code -- */

/**
 * A code block that stays folded until asked for. Disclosure rather than a separate view is what
 * keeps the running demo on screen while its source is read: the card grows downward instead of
 * swapping its contents.
 *
 * The returned element carries `onOpen` and `setCode`, so a block whose source has to be fetched
 * can be appended immediately and filled in when the reader first opens it.
 * @param {string} code
 * @param {{label?: string, toggle?: string}} [options]
 * @returns {HTMLElement & {onOpen: (fn: () => void | Promise<void>) => void, setCode: (code: string) => void}}
 */
function codeDisclosure(code, options = {}) {
  const { label = '', toggle: toggleLabel = 'Code' } = options;
  const body = element('div', 'docs-disclosure__body');
  body.hidden = true;
  let current = code;
  let loaded = false;
  /** @type {(() => void | Promise<void>) | null} */
  let onOpenHandler = null;

  const toggle = element('button', 'docs-disclosure__toggle', undefined,
    icon('chevron-down', { size: 14 }),
    element('span', 'docs-disclosure__label', toggleLabel));
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');

  const bar = element('div', 'docs-disclosure__bar', undefined, toggle, copyButton(() => current));
  const wrapper = element('div', 'docs-disclosure', undefined, bar, body);

  const render = () => body.replaceChildren(codeBlock(current, label, { bare: !label }));
  toggle.addEventListener('click', () => {
    const open = body.hidden;
    body.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    wrapper.classList.toggle('docs-disclosure--open', open);
    if (!open) return;
    render();
    if (!loaded) {
      loaded = true;
      void onOpenHandler?.();
    }
  });

  return Object.assign(wrapper, {
    /** @param {() => void | Promise<void>} fn */
    onOpen(fn) { onOpenHandler = fn; },
    /** @param {string} value */
    setCode(value) {
      current = value;
      if (!body.hidden) render();
    }
  });
}

/**
 * Builds a code block with an optional filename header and a copy button.
 * @param {string} code
 * @param {string} label
 * @param {{bare?: boolean, compact?: boolean}} [options]
 * @returns {HTMLElement}
 */
function codeBlock(code, label, options = {}) {
  const pre = element('pre', 'docs-code__body');
  const codeNode = document.createElement('code');
  codeNode.innerHTML = highlight(code);
  pre.append(codeNode);

  const figure = element('figure', 'docs-code');
  if (options.compact) figure.classList.add('docs-code--compact');
  if (options.bare) {
    figure.classList.add('docs-code--bare');
    figure.append(pre);
    return figure;
  }
  figure.append(
    element('figcaption', 'docs-code__head', undefined,
      element('span', 'docs-code__name', label),
      copyButton(() => code)),
    pre);
  return figure;
}

/**
 * @param {() => string} read Supplies the current text, so a block whose source arrives later
 *   still copies what is on screen.
 * @returns {HTMLButtonElement}
 */
function copyButton(read) {
  const copy = element('button', 'docs-code__copy', 'Copy');
  copy.type = 'button';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(read());
      copy.textContent = 'Copied';
    } catch {
      copy.textContent = 'Press ⌘C';
    }
    setTimeout(() => { copy.textContent = 'Copy'; }, 1600);
  });
  return /** @type {HTMLButtonElement} */ (copy);
}

/**
 * Minimal JavaScript syntax highlighter. The source is HTML-escaped as it is emitted, so the
 * only tags in the result are the spans produced here.
 * @param {string} code
 * @returns {string}
 */
function highlight(code) {
  const pattern = new RegExp([
    /(?<comment>\/\*[\s\S]*?\*\/|\/\/[^\n]*)/,
    /(?<string>`(?:\\[\s\S]|[^`\\])*`|'(?:\\[\s\S]|[^'\\\n])*'|"(?:\\[\s\S]|[^"\\\n])*")/,
    /(?<number>\b0[xX][\da-fA-F]+\b|\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/,
    /(?<keyword>\b(?:as|async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|yield)\b)/
  ].map((part) => part.source).join('|'), 'g');

  let result = '';
  let last = 0;
  for (const match of code.matchAll(pattern)) {
    const [kind] = Object.entries(match.groups).find(([, value]) => value !== undefined);
    result += escapeHtml(code.slice(last, match.index));
    result += `<span class="tok-${kind}">${escapeHtml(match[0])}</span>`;
    last = match.index + match[0].length;
  }
  return result + escapeHtml(code.slice(last));
}

/* ---------------------------------------------------------------------- toc -- */

/**
 * Fills the "On this page" rail from the sections the page just rendered, and keeps the entry for
 * the section under the reader highlighted.
 * @returns {void}
 */
function buildToc() {
  const targets = [...article.querySelectorAll('.docs-section')];
  rail.replaceChildren();
  if (targets.length < 2) return;

  const list = element('ul', 'docs-toc__list');
  const links = new Map();
  for (const target of targets) {
    const anchor = element('a', 'docs-toc__link', target.dataset.title);
    anchor.href = `#${target.id.replace(/^section-/, '')}`;
    anchor.addEventListener('click', (event) => {
      event.preventDefault();
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    if (target.classList.contains('docs-example')) anchor.classList.add('docs-toc__link--nested');
    links.set(target, anchor);
    list.append(element('li', '', undefined, anchor));
  }

  const nav = element('nav', 'docs-toc', undefined,
    element('h2', 'docs-toc__title', 'On this page'), list);
  nav.setAttribute('aria-label', 'On this page');
  rail.append(nav);

  let frame = 0;
  const spy = () => {
    frame = 0;
    // The section whose top has most recently passed under the sticky header is the one being
    // read; before any has, the first stays marked.
    let current = targets[0];
    for (const target of targets) {
      if (target.getBoundingClientRect().top <= 140) current = target;
    }
    for (const [target, anchor] of links) {
      anchor.classList.toggle('docs-toc__link--current', target === current);
    }
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(spy);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  pageCleanups.push(() => {
    window.removeEventListener('scroll', onScroll);
    if (frame) cancelAnimationFrame(frame);
  });
  spy();
}

/**
 * A page section: an anchored heading the rail can link to, plus a self-link on the heading so a
 * reader can hand someone a URL that lands on this exact example.
 * @param {string} id
 * @param {string} title
 * @param {{className?: string, href?: string}} [options]
 * @returns {HTMLElement}
 */
function docsSection(id, title, options = {}) {
  const section = element('section', `docs-section ${options.className ?? ''}`.trim());
  section.id = `section-${id}`;
  section.dataset.title = title;

  const heading = element('h2', 'docs-section__title');
  if (options.href) {
    const anchor = element('a', 'docs-section__anchor', title);
    anchor.href = options.href;
    heading.append(anchor);
  } else {
    heading.textContent = title;
  }
  section.append(heading);
  return section;
}

/* --------------------------------------------------------------------- guides -- */

/**
 * Builds a guide page from its template, upgrading `<pre data-code="path">` blocks and giving each
 * `<h2>` an anchor so the rail can index the prose the same way it indexes examples.
 * @param {object} entry
 * @returns {HTMLElement[]}
 */
function guidePage(entry) {
  const header = element('header', 'docs-header');
  header.append(element('h1', 'docs-title', entry.title));
  if (entry.blurb) header.append(element('p', 'docs-blurb', entry.blurb));

  const body = element('div', 'docs-guide');
  body.append(entry.template.content.cloneNode(true));
  for (const pre of body.querySelectorAll('pre[data-code]')) {
    pre.replaceWith(codeBlock(pre.textContent.replace(/^\n|\s+$/g, ''), pre.dataset.code));
  }

  // Each `<h2>` and the content up to the next one becomes a section, so the guide gets the same
  // rail as a component page without the guides being authored any differently.
  const nodes = [];
  let current = null;
  for (const node of [...body.childNodes]) {
    if (node.nodeName === 'H2') {
      current = docsSection(slug(node.textContent), node.textContent, { className: 'docs-guide' });
      nodes.push(current);
      continue;
    }
    if (current) current.append(node);
    else header.append(node);
  }
  return nodes.length ? [header, ...nodes] : [header, body];
}

/* ---------------------------------------------------------------------- chrome -- */

/** Adds the floating density switcher; theme is owned by the shared site chrome. */
function buildDensitySwitcher() {
  const label = element('span', 'docs-switcher__label', 'Density');
  const select = element('select', 'docs-switcher__select');
  select.setAttribute('aria-label', 'Density');
  for (const value of DENSITIES) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value.charAt(0).toUpperCase() + value.slice(1);
    select.append(option);
  }

  let saved = DENSITIES[0];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (DENSITIES.includes(stored)) saved = stored;
  } catch { /* storage unavailable */ }

  const apply = (value) => {
    document.documentElement.dataset.zxDensity = value;
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* current page only */ }
  };

  select.value = saved;
  apply(saved);
  select.addEventListener('change', () => {
    apply(select.value);
    // Re-mount so components that read density at build time pick up the new metrics.
    const key = activeKey;
    activeKey = null;
    showEntry(key);
  });

  toolbar.append(element('label', 'docs-switcher', undefined, label, select));
}

/* ---------------------------------------------------------------- markdown -- */

/**
 * Markdown → DOM for the reference blocks. It covers what `docs/llms.md` actually uses — ATX
 * headings, paragraphs, nested bullet lists with continuation lines, fenced code, and inline
 * code/bold/links — and builds nodes rather than a markup string, so fenced blocks get the same
 * highlighting and copy button as a source view and nothing is ever assigned as HTML.
 * @param {string} md
 * @returns {DocumentFragment}
 */
function renderMarkdown(md) {
  const fragment = document.createDocumentFragment();
  const lines = md.replace(/\r\n?/g, '\n').trim().split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      const body = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1;
      fragment.append(codeBlock(body.join('\n'), fence[1] || 'js'));
      continue;
    }

    const heading = line.match(/^(#{2,5})\s+(.*)$/);
    if (heading) {
      // The page already carries the component name as its title, so the section's own `###` is
      // the top heading here and `####` its subsections.
      const node = document.createElement(`h${Math.min(5, Math.max(3, heading[1].length))}`);
      node.append(renderInline(heading[2]));
      fragment.append(node);
      index += 1;
      continue;
    }

    if (BULLET.test(line)) {
      const [list, next] = renderList(lines, index);
      fragment.append(list);
      index = next;
      continue;
    }

    const paragraph = [];
    while (index < lines.length && lines[index].trim()
      && !BULLET.test(lines[index]) && !/^(#{2,5})\s/.test(lines[index])
      && !/^\s*```/.test(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    const node = document.createElement('p');
    node.append(renderInline(paragraph.join(' ')));
    fragment.append(node);
  }
  return fragment;
}

/**
 * Consumes one bullet list, including deeper-indented sublists and wrapped continuation lines.
 * @param {string[]} lines All lines of the block.
 * @param {number} start Index of the list's first bullet.
 * @returns {[HTMLUListElement, number]} The list and the index of the first line after it.
 */
function renderList(lines, start) {
  const root = document.createElement('ul');
  const stack = [{ indent: BULLET.exec(lines[start])[1].length, list: root }];
  let item = null;
  let index = start;

  while (index < lines.length) {
    const bullet = BULLET.exec(lines[index]);
    if (!bullet) {
      // An indented, non-bullet line continues the item above it; anything else ends the list.
      if (!item || !lines[index].trim() || !/^\s/.test(lines[index])) break;
      item.append(renderInline(` ${lines[index].trim()}`));
      index += 1;
      continue;
    }

    const indent = bullet[1].length;
    while (stack.length > 1 && indent < stack.at(-1).indent) stack.pop();
    if (indent > stack.at(-1).indent) {
      const nested = document.createElement('ul');
      (item ?? stack.at(-1).list).append(nested);
      stack.push({ indent, list: nested });
    }
    item = document.createElement('li');
    item.append(renderInline(bullet[2]));
    trimLabelSeparator(item);
    stack.at(-1).list.append(item);
    index += 1;
  }
  return [root, index];
}

/**
 * Drops the dash between a `**Label** — detail` lead-in and its text. The label is styled as a
 * heading above the detail, where a dangling dash would read as a stray character.
 * @param {HTMLLIElement} item
 * @returns {void}
 */
function trimLabelSeparator(item) {
  const label = item.firstChild;
  const rest = label?.nextSibling;
  if (label?.nodeName !== 'STRONG' || rest?.nodeType !== Node.TEXT_NODE) return;
  rest.textContent = rest.textContent.replace(/^\s*[—–-]\s*/, '');
}

/**
 * Renders inline markdown — `code`, **bold**, and links — as text and element nodes.
 * @param {string} value
 * @returns {DocumentFragment}
 */
function renderInline(value) {
  const fragment = document.createDocumentFragment();
  let last = 0;
  for (const match of value.matchAll(/`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g)) {
    if (match.index > last) fragment.append(text(value.slice(last, match.index)));
    if (match[1] !== undefined) {
      const code = document.createElement('code');
      code.textContent = match[1];
      fragment.append(code);
    } else if (match[2] !== undefined) {
      const strong = document.createElement('strong');
      strong.textContent = match[2];
      fragment.append(strong);
    } else {
      const href = safeHref(match[4]);
      fragment.append(link(href, match[3], /^https?:/i.test(href) ? { target: '_blank' } : {}));
    }
    last = match.index + match[0].length;
  }
  fragment.append(text(value.slice(last)));
  return fragment;
}

/**
 * Keeps a markdown link on a navigable scheme, so a stray `javascript:` in the source cannot
 * become a live link.
 * @param {string} href
 * @returns {string}
 */
function safeHref(href) {
  return /^(https?:|mailto:|#|[./])/i.test(href.trim()) ? href.trim() : '#';
}

/* ----------------------------------------------------------------- DOM helpers -- */

/**
 * @param {string} tag
 * @param {string} className
 * @param {string} [textContent]
 * @param {...Node} children
 * @returns {HTMLElement}
 */
function element(tag, className, textContent, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent !== undefined) node.textContent = textContent;
  if (children.length) node.append(...children);
  return node;
}

/** @param {string} value @returns {Text} */
function text(value) {
  return document.createTextNode(value);
}

/** @param {string} href @param {string} label @param {{target?: string}} [options] @returns {HTMLAnchorElement} */
function link(href, label, options = {}) {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.textContent = label;
  if (options.target) {
    anchor.target = options.target;
    anchor.rel = 'noopener';
  }
  return anchor;
}

/** @param {string} value @returns {string} */
function slug(value) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** @param {string} value @returns {string} */
function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
