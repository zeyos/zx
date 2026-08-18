/*
 * The Zx documentation application.
 *
 * One page holds four kinds of entry, all reachable from a single sidebar and addressable by URL
 * hash (`#components/select`, `#layouts/master-detail`, …):
 *
 *   guide      prose from a <template data-guide> in docs.html
 *   component  a demo module from website/demos/<id>.demo.js
 *   layout     a whole application shell from website/layouts/<id>.layout.js
 *
 * Every runnable entry offers a JavaScript tab that shows its real, unmodified source, fetched
 * from the same file the browser just executed.
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

const root = document.querySelector('#docs-app');
const shell = element('div', 'docs-shell');
const sidebar = element('aside', 'docs-sidebar');
const navigation = element('nav', 'docs-navigation');
const main = element('main', 'docs-main');
const header = element('header', 'docs-header');
const heading = element('h1', 'docs-title');
const blurb = element('p', 'docs-blurb');
const stage = element('div', 'docs-stage');
const toolbar = element('div', 'docs-toolbar');

navigation.setAttribute('aria-label', 'Documentation');
sidebar.append(navigation);
header.append(heading, blurb);
main.append(header, stage);
shell.append(sidebar, main);
root.replaceChildren(shell, toolbar);

/** @type {Map<string, object>} Every entry, keyed by `<section>/<id>`. */
const entries = new Map();
/** @type {{id: string, label: string, groups: Map<string, object[]>}[]} */
const sections = [];
let activeKey = null;
let activeTab = 'preview';
let referenceText = null;

await buildRegistry();
renderNavigation();
buildDensitySwitcher();
window.addEventListener('hashchange', () => {
  const key = keyFromHash();
  if (key !== activeKey) showEntry(key);
});
showEntry(keyFromHash());

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

  const [demoModules, layoutModules] = await Promise.all([
    Promise.all(COMPONENT_IDS.map((id) => import(`./demos/${id}.demo.js`))),
    Promise.all(LAYOUT_IDS.map((id) => import(`./layouts/${id}.layout.js`)))
  ]);

  const components = demoModules.map((module, index) => ({
    section: 'components',
    id: COMPONENT_IDS[index],
    title: module.default.title,
    blurb: module.default.blurb || '',
    group: module.default.group,
    kind: 'component',
    mount: module.default.mount,
    source: `./demos/${COMPONENT_IDS[index]}.demo.js`
  }));

  const layouts = layoutModules.map((module, index) => ({
    section: 'layouts',
    id: LAYOUT_IDS[index],
    title: module.default.title,
    blurb: module.default.blurb || '',
    group: 'Applications',
    kind: 'layout',
    mount: module.default.mount,
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
      if (section.groups.size > 1) {
        block.append(element('h3', 'docs-navigation__group', group));
      }
      const list = element('ul', 'docs-navigation__list');
      for (const entry of items) {
        const key = `${entry.section}/${entry.id}`;
        const link = element('a', 'docs-navigation__item', entry.title);
        link.href = `#${key}`;
        link.dataset.key = key;
        list.append(element('li', 'docs-navigation__row', undefined, link));
      }
      block.append(list);
    }
    navigation.append(block);
  }
}

/** Reads the routed entry key from the URL hash, tolerating section-only hashes. */
function keyFromHash() {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (entries.has(hash)) return hash;
  const section = sections.find((item) => item.id === hash);
  if (section) return firstKeyOf(section);
  return firstKeyOf(sections[0]);
}

/** @param {{groups: Map<string, object[]>}} section @returns {string} */
function firstKeyOf(section) {
  const [items] = [...section.groups.values()];
  const entry = items[0];
  return `${entry.section}/${entry.id}`;
}

/* -------------------------------------------------------------------- stage -- */

/**
 * Mounts one entry: its heading, blurb, and tab set. Navigation happens through the sidebar's
 * `#<section>/<id>` links, so this never writes the hash itself.
 * @param {string} key Registry key, `<section>/<id>`.
 * @returns {void}
 */
function showEntry(key) {
  const entry = entries.get(key);
  if (!entry) return;
  activeKey = key;

  heading.textContent = entry.title;
  blurb.textContent = entry.blurb;
  blurb.hidden = !entry.blurb;

  for (const link of navigation.querySelectorAll('[data-key]')) {
    if (link.dataset.key === key) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  const tabs = buildTabs(entry);
  if (tabs.length === 0) return;

  const tablist = element('div', 'docs-tabs');
  tablist.setAttribute('role', 'tablist');
  const panels = element('div', 'docs-panels');

  for (const tab of tabs) {
    const button = element('button', 'docs-tab', undefined,
      icon(tab.icon, { size: 15 }), element('span', 'docs-tab__label', tab.label));
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.dataset.tab = tab.id;
    button.addEventListener('click', () => selectTab(tab.id));
    tablist.append(button);
    tab.panel.setAttribute('role', 'tabpanel');
    panels.append(tab.panel);
  }

  stage.replaceChildren(...(tabs.length > 1 ? [tablist, panels] : [panels]));
  if (!tabs.some((tab) => tab.id === activeTab)) activeTab = tabs[0].id;
  selectTab(activeTab);

  /** @param {string} id */
  function selectTab(id) {
    activeTab = id;
    for (const tab of tabs) {
      const selected = tab.id === id;
      tab.panel.hidden = !selected;
      tablist.querySelector(`[data-tab="${tab.id}"]`)?.setAttribute('aria-selected', String(selected));
      if (selected && tab.load && !tab.panel.dataset.loaded) {
        tab.panel.dataset.loaded = 'true';
        tab.load();
      }
    }
  }
}

/**
 * Produces the tab descriptors for one entry. Each tab carries its own glyph so the three views
 * stay distinguishable at a glance: the running example, its source, and the written reference.
 * @param {object} entry
 * @returns {{id: string, label: string, icon: string, panel: HTMLElement, load?: () => void}[]}
 */
function buildTabs(entry) {
  if (entry.kind === 'guide') {
    const panel = element('div', 'docs-panel docs-guide');
    panel.append(entry.template.content.cloneNode(true));
    enhanceGuide(panel);
    return [{ id: 'preview', label: 'Guide', icon: 'book', panel }];
  }

  const preview = element('div', 'docs-panel docs-preview');
  const source = element('div', 'docs-panel docs-source');
  const tabs = [];

  entry.mount(preview);
  tabs.push({
    id: 'preview',
    label: entry.kind === 'layout' ? 'Preview' : 'Demo',
    icon: 'eye',
    panel: preview
  });

  tabs.push({
    id: 'source',
    label: 'JavaScript',
    icon: 'code',
    panel: source,
    load: () => loadSource(entry, source)
  });

  if (entry.kind === 'component') {
    const reference = element('div', 'docs-panel docs-reference');
    tabs.push({
      id: 'reference',
      label: 'Reference',
      icon: 'book',
      panel: reference,
      load: () => loadReference(entry.id, reference)
    });
  }
  return tabs;
}

/* --------------------------------------------------------------- source view -- */

/**
 * Fetches an entry's source and renders it as a highlighted, copyable code block.
 * @param {object} entry
 * @param {HTMLElement} panel
 * @returns {Promise<void>}
 */
async function loadSource(entry, panel) {
  panel.replaceChildren(element('p', 'docs-panel__note', 'Loading source…'));
  try {
    const response = await fetch(entry.source);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const raw = await response.text();
    const path = `website/${entry.source.replace(/^\.\//, '')}`;
    panel.replaceChildren(
      element('p', 'docs-panel__note',
        'This is the exact module the preview above just executed.'),
      codeBlock(raw, path)
    );
  } catch (error) {
    panel.replaceChildren(element('p', 'docs-panel__note', `Could not load source: ${error.message}`));
  }
}

/**
 * Builds a code block with a filename header and a copy button.
 * @param {string} code
 * @param {string} label
 * @returns {HTMLElement}
 */
function codeBlock(code, label) {
  const copy = element('button', 'docs-code__copy', 'Copy');
  copy.type = 'button';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      copy.textContent = 'Copied';
    } catch {
      copy.textContent = 'Press ⌘C';
    }
    setTimeout(() => { copy.textContent = 'Copy'; }, 1600);
  });

  const pre = element('pre', 'docs-code__body');
  const codeNode = document.createElement('code');
  codeNode.innerHTML = highlight(code);
  pre.append(codeNode);

  return element('figure', 'docs-code', undefined,
    element('figcaption', 'docs-code__head', undefined,
      element('span', 'docs-code__name', label),
      copy),
    pre);
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

/* ------------------------------------------------------------------ reference -- */

/**
 * Renders a component's section of docs/llms.md, the reference both humans and agents read.
 * @param {string} id Demo basename, which doubles as the `<!-- doc:<id> -->` marker.
 * @param {HTMLElement} panel
 * @returns {Promise<void>}
 */
async function loadReference(id, panel) {
  panel.replaceChildren(element('p', 'docs-panel__note', 'Loading reference…'));
  try {
    if (referenceText === null) referenceText = await (await fetch(DOCS_URL)).text();
    const match = new RegExp(`<!--\\s*doc:${id}\\s*-->([\\s\\S]*?)<!--\\s*/doc\\s*-->`).exec(referenceText);
    const article = element('div', 'docs-prose');
    if (match) {
      article.append(renderMarkdown(match[1]));
    } else {
      article.append(element('p', '', undefined,
        text('No dedicated section yet — see '), link(DOCS_URL, 'docs/llms.md'), text('.')));
    }
    panel.replaceChildren(
      element('p', 'docs-panel__note', undefined,
        text('From '), link(DOCS_URL, 'docs/llms.md'),
        text(' — the same reference the Zx agent skill reads.')),
      article
    );
  } catch (error) {
    panel.replaceChildren(element('p', 'docs-panel__note', `Could not load reference: ${error.message}`));
  }
}

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
      // The panel already carries the component name as its page title, so the section's own `###`
      // is the top heading here and `####` its subsections.
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

/** Matches a bullet and captures its indent and text. */
const BULLET = /^(\s*)[-*]\s+(.*)$/;

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

/* --------------------------------------------------------------------- guides -- */

/**
 * Upgrades static guide markup: every `<pre data-code="path">` gains the same filename header,
 * copy button, and highlighting as a fetched source view.
 * @param {HTMLElement} panel
 * @returns {void}
 */
function enhanceGuide(panel) {
  for (const pre of panel.querySelectorAll('pre[data-code]')) {
    pre.replaceWith(codeBlock(pre.textContent.replace(/^\n|\s+$/g, ''), pre.dataset.code));
  }
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
    showEntry(activeKey);
  });

  toolbar.append(element('label', 'docs-switcher', undefined, label, select));
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
  node.className = className;
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
function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
