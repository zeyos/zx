/*
 * One layout on a page of its own: `layout.html#<id>` mounts the layout the hash names and fills
 * the window with it, so it can be used like an application in a browser tab. The only chrome is a
 * slim bar — the way back to the gallery, the layout's title, its source, and the theme.
 *
 * The layout mounts with a normal context, exactly as it does in the gallery's popup (both go
 * through `layout-host.js`). Changing the hash unmounts it and mounts the one the new hash names;
 * an id the registry does not list gets a message instead, and is never imported.
 */

import { Aurora, button, emptyState, h, icon } from '../src/index.js';
import {
  LAYOUTS_TITLE, buildSourceView, loadLayout, mountLayout, parseLayoutHash, tintAurora
} from './layout-host.js';

/** @type {Map<string, Promise<import('./layout-host.js').LayoutEntry>>} Modules, loaded once each. */
const loaded = new Map();

/*
 * Everything above is declared before the page is built, which happens at the bottom of this
 * module's evaluation: a `const` declared further down would still be in its temporal dead zone.
 */

const app = /** @type {HTMLElement} */ (document.querySelector('#layout-app'));
const title = /** @type {HTMLElement} */ (document.querySelector('.layout-bar__title'));
const view = buildView();

/** The layout on the page, if any. */
let current = /** @type {import('./layout-host.js').MountedLayout | null} */ (null);
/** Counts routes, so a module that arrives after the hash moved on is not mounted. */
let routing = 0;

app.replaceChildren(view.stage, view.source.root);
window.addEventListener('hashchange', route);
await route();

/* ----------------------------------------------------------------------- page -- */

/**
 * Completes the bar the page ships with — an icon on the way back, the Source toggle beside the
 * theme — and builds the stage the layout mounts into, with the source view above it.
 * @returns {{stage: HTMLElement, sourceToggle: HTMLButtonElement,
 *   source: ReturnType<typeof buildSourceView>}}
 */
function buildView() {
  const back = /** @type {HTMLAnchorElement} */ (document.querySelector('.layout-bar__back'));
  back.replaceChildren(icon('arrow-left', { size: 14 }),
    h('span', { class: 'layout-bar__back-label' }, back.textContent.trim() || 'All layouts'));

  // A ghost button, like the popup's: the bar's actions stay quiet above the application.
  const sourceToggle = button({ label: 'Source', icon: 'code', size: 'sm', kind: 'ghost' });
  sourceToggle.classList.add('gallery-popup__source-toggle');
  sourceToggle.setAttribute('aria-pressed', 'false');
  sourceToggle.addEventListener('click', () => {
    showSource(sourceToggle.getAttribute('aria-pressed') !== 'true');
  });
  /** @type {HTMLElement} */ (document.querySelector('.layout-bar__actions')).prepend(sourceToggle);

  const stage = h('div', { class: 'layout-page__stage' });
  // Ambient light behind the layout, as in the gallery's popup: it shows wherever a layout leaves
  // the stage clear, and a ZeyOS screen tints it with its module colour (`tintAurora`).
  new Aurora(stage, { preset: 'source', intensity: 'subtle' });

  const source = buildSourceView();
  // Escape puts the code away again and returns to the button that showed it.
  source.root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    showSource(false);
    sourceToggle.focus();
  });
  return { stage, sourceToggle, source };
}

/**
 * Shows or hides the source view over the stage. The stage is inert underneath it, so focus and
 * screen readers stay in the code.
 * @param {boolean} visible
 * @returns {void}
 */
function showSource(visible) {
  view.sourceToggle.setAttribute('aria-pressed', String(visible));
  view.source.root.hidden = !visible;
  view.stage.inert = visible;
  if (visible) view.stage.setAttribute('aria-hidden', 'true');
  else view.stage.removeAttribute('aria-hidden');
  if (visible && current) void view.source.show(current.id);
}

/**
 * Names the page: the bar's heading and the document title.
 * @param {string} name
 * @returns {void}
 */
function setTitle(name) {
  title.textContent = name;
  document.title = `${name} — ${LAYOUTS_TITLE}`;
}

/* -------------------------------------------------------------------- routing -- */

/**
 * Mounts the layout the hash names, after unmounting the one before it. Runs on load and on every
 * `hashchange`.
 * @returns {Promise<void>}
 */
async function route() {
  const run = ++routing;
  const { id, known } = parseLayoutHash(window.location.hash);
  unmount();
  if (!known) {
    missing(id);
    return;
  }
  if (!loaded.has(id)) loaded.set(id, loadLayout(id));
  const entry = await loaded.get(id);
  // The hash moved on while the module was loading; the newer route mounts instead.
  if (run !== routing) return;
  setTitle(entry.title);
  view.sourceToggle.disabled = false;
  current = mountLayout(view.stage, entry);
  tintAurora(view.stage);
}

/**
 * Unmounts the layout on the page — aborting its signal, running every cleanup it registered —
 * and puts the source view away.
 * @returns {void}
 */
function unmount() {
  const mounted = current;
  current = null;
  mounted?.unmount();
  view.stage.replaceChildren();
  showSource(false);
}

/**
 * Says that the hash names no layout, and leads back to the gallery.
 * @param {string} id What the hash held: empty, or an id the registry does not list.
 * @returns {void}
 */
function missing(id) {
  setTitle(id ? 'Layout not found' : 'No layout chosen');
  view.sourceToggle.disabled = true;
  const gallery = h('a', { class: 'zx-btn', href: 'layouts.html', dataset: { kind: 'primary' } },
    h('span', { class: 'zx-btn__label' }, 'All layouts'));
  const message = emptyState({
    icon: 'search',
    title: id ? `There is no layout called “${id}”` : 'This page shows one layout at a time',
    description: id
      ? 'The address names a layout this site does not have. Every layout is listed in the gallery.'
      : 'Open a layout from the gallery to give it a tab of its own.',
    actions: [gallery]
  });
  message.classList.add('layout-page__missing');
  view.stage.replaceChildren(message);
}
