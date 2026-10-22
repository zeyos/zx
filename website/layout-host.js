/*
 * Hosting one layout: loading its module, mounting it with a context, unmounting it again, and
 * showing its source. The gallery's popup (`layouts.js`) and the standalone page (`layout.js`)
 * share it, so a layout behaves the same wherever it is opened.
 *
 * A layout module is `{title, category, blurb, components, mount(container, context)}`. Whoever
 * mounts it owns the context: an AbortSignal for listeners outside the layout's root, a cleanup
 * list that destroys every component the layout registered, and `open(id)`, which moves to another
 * layout of the suite. Unmounting aborts the one and runs the
 * other, so mounting layouts one after another in one page leaves the page as it was.
 */

import { copyButton, emptyState, h, icon } from '../src/index.js';
import { LAYOUT_IDS, PATTERN_IDS } from './layouts/index.js';
// The layouts' own icon set, which also carries the "open in a new tab" glyph the chrome uses.
import './layouts/layout-icons.js';

/** Every page title on the layout pages ends with this. */
const LAYOUTS_TITLE = 'Layouts — ZeyOS Xenon Design System';

/**
 * The tokens the source view colours. Comments and strings come first, so a keyword inside either
 * stays part of it.
 */
const TOKEN = new RegExp([
  /(?<comment>\/\*[\s\S]*?\*\/|\/\/[^\n]*)/,
  /(?<string>`(?:\\[\s\S]|[^`\\])*`|'(?:\\[\s\S]|[^'\\\n])*'|"(?:\\[\s\S]|[^"\\\n])*")/,
  /(?<number>\b0[xX][\da-fA-F]+\b|\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/,
  /(?<keyword>\b(?:as|async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|yield)\b)/
].map((part) => part.source).join('|'), 'g');

/** @type {Map<string, Promise<string>>} Module sources, fetched at most once each. */
const sources = new Map();

/**
 * @typedef {Object} LayoutModule
 * @property {string} [title]
 * @property {string} [category]
 * @property {string} [blurb]
 * @property {(container: HTMLElement, context?: object) => void} mount
 */

/**
 * @typedef {Object} LayoutEntry
 * @property {string} id Registry id, the `layouts/<id>.layout.js` basename.
 * @property {string} title
 * @property {string} category
 * @property {string} blurb
 * @property {LayoutModule | null} layout The module's default export, or null when it failed to
 *   load or has no `mount`.
 */

/**
 * @typedef {Object} MountedLayout
 * @property {string} id The mounted layout's registry id.
 * @property {HTMLElement} scope The element the layout was mounted into.
 * @property {() => void} unmount Aborts the signal, runs every cleanup, and removes the scope.
 */

/**
 * Imports one layout module the registry names. A module that fails to load still yields an entry,
 * so a broken layout shows up as broken rather than silently missing.
 * @param {string} id Registry id.
 * @returns {Promise<LayoutEntry>}
 */
async function loadLayout(id) {
  let layout = null;
  try {
    layout = (await import(`./layouts/${id}.layout.js`)).default ?? null;
  } catch (error) {
    console.error(`The "${id}" layout could not be loaded.`, error);
  }
  return {
    id,
    title: String(layout?.title ?? id),
    category: String(layout?.category ?? (PATTERN_IDS.includes(id) ? 'Screen pattern' : 'Application')),
    blurb: String(layout?.blurb ?? 'This layout could not be loaded.'),
    layout: typeof layout?.mount === 'function' ? layout : null
  };
}

/**
 * Reads a layout id out of a URL hash.
 * @param {string} hash `location.hash`, with or without its `#`.
 * @returns {{id: string, known: boolean}} The id it names — empty for an empty hash — and whether
 *   the registry lists it. Only a known id is ever imported.
 */
function parseLayoutHash(hash) {
  let id = hash.replace(/^#/, '');
  try {
    id = decodeURIComponent(id);
  } catch {
    return { id, known: false };
  }
  return { id, known: LAYOUT_IDS.includes(id) };
}

/**
 * The address of a layout on its own page, relative to the gallery.
 * @param {string} id Registry id.
 * @returns {string}
 */
function standaloneHref(id) {
  return `layout.html#${encodeURIComponent(id)}`;
}

/**
 * Mounts a layout into a container with a fresh context, inside a scope element of its own.
 *
 * The scope is a Zx styling scope, which makes it where the layout's menus, dialogs, and toasts are
 * hosted: inside a popup they stay inside it, and either way they leave with the scope on unmount
 * rather than being reused by the next layout.
 * @param {HTMLElement} container Where the scope goes; its other children are replaced.
 * @param {LayoutEntry} entry
 * @returns {MountedLayout}
 */
function mountLayout(container, entry) {
  const controller = new AbortController();
  /** @type {Array<() => void>} */
  const cleanups = [];
  const scope = h('div', { class: 'layout-mount zx-scope', dataset: { layout: entry.id } });
  // A screen pattern written before the mount context existed takes only a container, so it
  // cannot register its teardown; what it leaves on <body> is collected when it unmounts.
  const body = entry.layout && entry.layout.mount.length < 2 ? new Set(document.body.children) : null;
  container.replaceChildren(scope);
  try {
    if (!entry.layout) throw new Error('The module did not load.');
    entry.layout.mount(scope, {
      id: entry.id,
      preview: false,
      signal: controller.signal,
      cleanup: (fn) => cleanups.push(fn),
      // Both hosts route by hash: the gallery swaps the open layout, the standalone page its own.
      open: (id) => {
        if (LAYOUT_IDS.includes(id) && id !== entry.id) window.location.hash = `#${encodeURIComponent(id)}`;
      }
    });
  } catch (error) {
    console.error(`The "${entry.id}" layout failed to mount.`, error);
    scope.replaceChildren(emptyState({
      icon: 'warning',
      title: 'This layout could not be shown',
      description: error instanceof Error ? error.message : String(error)
    }));
  }

  return {
    id: entry.id,
    scope,
    unmount() {
      controller.abort();
      for (const cleanup of cleanups.splice(0)) {
        try {
          cleanup();
        } catch (error) {
          console.error(`A cleanup of the "${entry.id}" layout failed.`, error);
        }
      }
      if (body) {
        for (const node of [...document.body.children]) if (!body.has(node)) node.remove();
      }
      scope.remove();
    }
  };
}

/**
 * Lets a ZeyOS screen's ambient light pick up its module colour, as the module header does.
 * @param {HTMLElement} surface An element carrying an Aurora.
 * @returns {void}
 */
function tintAurora(surface) {
  const module = /** @type {HTMLElement|null} */ (surface.querySelector('.zx-master-panel[data-module]'))
    ?.dataset.module;
  if (module) surface.style.setProperty('--zx-aurora-color-1', `var(--zx-module-${module})`);
  else surface.style.removeProperty('--zx-aurora-color-1');
}

/**
 * Reads a layout module's own text, once.
 * @param {string} id Registry id.
 * @returns {Promise<string>}
 */
function sourceOf(id) {
  if (!sources.has(id)) {
    // Resolved against this module rather than the page, so a revision-stamped deploy reads the
    // copy that belongs to the code it is running.
    const url = new URL(`./layouts/${id}.layout.js`, import.meta.url);
    sources.set(id, fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.text();
      })
      .catch((error) => `// Could not load layouts/${id}.layout.js: ${error.message}`));
  }
  return /** @type {Promise<string>} */ (sources.get(id));
}

/**
 * The source view: the module's text with line numbers, a copy button, and a link to the file. It
 * lies over the stage rather than replacing it, so the layout keeps its state and its measurements
 * while the reader looks at the code behind it.
 * @returns {{root: HTMLElement, show: (id: string) => Promise<void>}}
 */
function buildSourceView() {
  const path = h('span', { class: 'gallery-source__path' });
  const lines = h('span', { class: 'gallery-source__lines' });
  const file = h('a', { class: 'gallery-source__file', target: '_blank', rel: 'noopener' },
    'Open file', icon('chevron-right', { size: 14 }));
  const gutter = h('pre', { class: 'gallery-code__gutter', 'aria-hidden': 'true' });
  const code = h('code');
  const scroller = h('div', { class: 'gallery-code', tabindex: '0', role: 'region' },
    h('div', { class: 'gallery-code__grid' }, gutter, h('pre', { class: 'gallery-code__body' }, code)));
  let text = '';
  const copy = copyButton({ text: () => text, label: 'Copy', size: 'sm' });
  const root = h('section', { class: 'gallery-source', hidden: true, 'aria-label': 'Source' },
    h('div', { class: 'gallery-source__bar' },
      icon('code', { size: 14 }), path, lines,
      h('span', { class: 'gallery-source__spacer' }),
      file, copy),
    scroller);

  /** @param {string} id Registry id. */
  const show = async (id) => {
    const relative = `layouts/${id}.layout.js`;
    path.textContent = `website/${relative}`;
    file.href = relative;
    scroller.setAttribute('aria-label', `Source of website/${relative}`);
    if (root.dataset.layout === id) return;
    root.dataset.layout = id;
    lines.textContent = '';
    code.replaceChildren();
    gutter.textContent = '';
    const loaded = await sourceOf(id);
    // The reader may have closed this layout or opened another while the file was on its way.
    if (root.dataset.layout !== id) return;
    text = loaded;
    const count = loaded.replace(/\n$/, '').split('\n').length;
    lines.textContent = `${count} lines`;
    gutter.textContent = Array.from({ length: count }, (_, index) => index + 1).join('\n');
    code.replaceChildren(highlight(loaded.replace(/\n$/, '')));
    scroller.scrollTo({ top: 0, left: 0 });
  };
  return { root, show };
}

/**
 * Turns JavaScript source into text nodes and coloured spans. Built as nodes rather than markup,
 * so nothing in the file is ever interpreted as HTML.
 * @param {string} code
 * @returns {DocumentFragment}
 */
function highlight(code) {
  const fragment = document.createDocumentFragment();
  let last = 0;
  for (const match of code.matchAll(TOKEN)) {
    const kind = Object.keys(match.groups ?? {}).find((name) => match.groups?.[name] !== undefined);
    if (match.index > last) fragment.append(code.slice(last, match.index));
    fragment.append(h('span', { class: `tok-${kind}` }, match[0]));
    last = match.index + match[0].length;
  }
  fragment.append(code.slice(last));
  return fragment;
}

export {
  LAYOUTS_TITLE, buildSourceView, loadLayout, mountLayout, parseLayoutHash, standaloneHref, tintAurora
};
