/*
 * The layout gallery.
 *
 * One page, two sections, both read from the registry in `layouts/index.js`: the application
 * templates, then the screen patterns. Every tile shows its layout running — the real module,
 * mounted in preview mode at a fixed desktop size and scaled down to the tile — and opens it full
 * size in a Modal, where it can be used and read as source. Each tile, and the popup, also link to
 * `layout.html#<id>`, the same layout on a page of its own.
 *
 * Mounting, unmounting, and the source view live in `layout-host.js`, which the standalone page
 * shares. Closing the popup unmounts its layout — aborting its signal and running every cleanup it
 * registered — so opening and closing layouts one after another leaves the page as it was.
 *
 * Routing is the URL hash: `layouts.html#crm` opens the CRM on load, opening a tile adds a history
 * entry so Back closes it again, and closing clears the hash.
 */

import { Aurora, Modal, badge, button, h, icon } from '../src/index.js';
import { LAYOUT_IDS, PATTERN_IDS, TEMPLATE_IDS } from './layouts/index.js';
import {
  LAYOUTS_TITLE, buildSourceView, loadLayout, mountLayout, parseLayoutHash, standaloneHref, tintAurora
} from './layout-host.js';

/** Every layout renders its thumbnail at this size, and is then scaled to the tile's width. */
const THUMBNAIL = { width: 1440, height: 900 };

/** The page's two sections, in order. */
const SECTIONS = [
  {
    id: 'templates',
    title: 'Application templates',
    blurb: 'Complete products — navigation, lists, records, and editors working together. They '
      + 'share one shell and one set of conventions, because they share one design system.',
    ids: TEMPLATE_IDS
  },
  {
    id: 'patterns',
    title: 'Screen patterns',
    blurb: 'Single screens that recur inside every application: master–detail, dashboards, '
      + 'wizards, settings, and a screen generated from a live ZeyOS schema.',
    ids: PATTERN_IDS
  }
];

/*
 * Everything above is declared before the page is built, which happens at the bottom of this
 * module's evaluation: a `const` declared further down would still be in its temporal dead zone.
 */

const app = /** @type {HTMLElement} */ (document.querySelector('#layouts-app'));
const entries = await loadEntries();
const page = buildPage();
const popup = buildPopup();

/** The layout currently mounted in the popup. */
let current = /** @type {import('./layout-host.js').MountedLayout | null} */ (null);

app.replaceChildren(page.root);
window.addEventListener('hashchange', route);
window.addEventListener('popstate', route);
route();

/* ------------------------------------------------------------------- registry -- */

/**
 * Imports every layout module the registry names. One that fails to load still gets a tile, so a
 * broken layout is visible as broken rather than silently missing from the page.
 * @returns {Promise<Map<string, import('./layout-host.js').LayoutEntry>>}
 */
async function loadEntries() {
  const list = await Promise.all(LAYOUT_IDS.map((id) => loadLayout(id)));
  return new Map(list.map((entry) => [entry.id, entry]));
}

/* ----------------------------------------------------------------------- page -- */

/**
 * Builds the title and one grid of tiles per section.
 * @returns {{root: HTMLElement, tiles: Map<string, HTMLElement>}}
 */
function buildPage() {
  const tiles = new Map();
  const sections = SECTIONS.map((section) => {
    const items = section.ids.map((id) => entries.get(id)).filter(Boolean);
    const grid = h('ul', { class: `gallery-grid gallery-grid--${section.id}`, role: 'list' },
      items.map((entry) => {
        const node = tile(entry);
        tiles.set(entry.id, node);
        return node;
      }));
    return h('section', {
      class: 'gallery-section',
      'aria-labelledby': `gallery-${section.id}-title`
    },
    h('header', { class: 'gallery-section__head' },
      h('h2', { class: 'gallery-section__title', id: `gallery-${section.id}-title` },
        section.title,
        h('span', { class: 'gallery-section__count' }, String(items.length))),
      h('p', { class: 'gallery-section__blurb' }, section.blurb)),
    grid);
  });

  const root = h('div', { class: 'gallery__inner' },
    h('header', { class: 'gallery-intro' },
      h('h1', { class: 'gallery-intro__title' }, 'Layouts')),
    sections);

  // The page itself is the plain page tone: the tiles are surfaces on it, so tone and a hairline
  // separate them, and nothing ambient competes with the screens they show.
  observeThumbnails(tiles);
  return { root, tiles };
}

/**
 * One tile: the live thumbnail, then the category, title, and blurb. The title is the tile's
 * button; its hit area is stretched over the whole tile in CSS, so the tile behaves as a single
 * button named by its title, and the thumbnail never sits inside it. Beside the title, outside the
 * button, a link opens the layout on its own page in a new tab.
 * @param {import('./layout-host.js').LayoutEntry} entry
 * @returns {HTMLLIElement}
 */
function tile(entry) {
  const blurbId = `gallery-${entry.id}-blurb`;
  const canvas = h('div', { class: 'gallery-thumb__canvas zx-scope' });
  return /** @type {HTMLLIElement} */ (h('li', { class: 'gallery-tile', dataset: { layout: entry.id } },
    h('div', { class: 'gallery-thumb', inert: true, 'aria-hidden': 'true', dataset: { state: 'idle' } },
      canvas),
    h('div', { class: 'gallery-tile__body' },
      h('p', { class: 'gallery-tile__category' }, entry.category),
      h('h3', { class: 'gallery-tile__title' },
        h('button', {
          type: 'button',
          class: 'gallery-tile__button',
          'aria-describedby': blurbId,
          onclick: () => open(entry.id, { push: true })
        }, entry.title)),
      h('p', { class: 'gallery-tile__blurb', id: blurbId }, entry.blurb),
      h('a', {
        class: 'zx-icon-btn gallery-tile__open',
        href: standaloneHref(entry.id),
        target: '_blank',
        rel: 'noopener',
        'aria-label': `Open ${entry.title} in a new tab`,
        title: 'Open in a new tab'
      }, icon('arrow-up-right-from-square', { size: 14 })))));
}

/**
 * Mounts each thumbnail as its tile approaches the viewport, and keeps its scale matched to the
 * tile's width. A thumbnail is the real layout in preview mode — its first state, with no timers,
 * shortcuts, or focus — made inert so it can be neither focused nor clicked.
 * @param {Map<string, HTMLElement>} tiles
 * @returns {void}
 */
function observeThumbnails(tiles) {
  const scale = new ResizeObserver((records) => {
    for (const record of records) {
      const width = record.contentBoxSize?.[0]?.inlineSize ?? record.contentRect.width;
      /** @type {HTMLElement} */ (record.target)
        .style.setProperty('--gallery-thumb-scale', String(width / THUMBNAIL.width));
    }
  });
  const near = new IntersectionObserver((records) => {
    for (const record of records) {
      if (!record.isIntersecting) continue;
      near.unobserve(record.target);
      mountThumbnail(/** @type {HTMLElement} */ (record.target));
    }
  }, { rootMargin: '50% 0px' });

  for (const node of tiles.values()) {
    const thumb = /** @type {HTMLElement} */ (node.querySelector('.gallery-thumb'));
    scale.observe(thumb);
    near.observe(thumb);
  }
}

/**
 * Mounts one tile's layout in preview mode. The thumbnail stays for the life of the page, so its
 * context is never aborted and nothing the layout registers is ever run.
 *
 * The canvas is a Zx scope, so overlays created against an anchor already inside it are hosted
 * there. A menu or tooltip built before its anchor is in the document has no scope to join yet and
 * lands on <body>; a thumbnail's overlays never open, so those move into the thumbnail as well.
 * @param {HTMLElement} thumb
 * @returns {void}
 */
function mountThumbnail(thumb) {
  const entry = entries.get(/** @type {HTMLElement} */ (thumb.closest('.gallery-tile')).dataset.layout);
  const canvas = /** @type {HTMLElement} */ (thumb.querySelector('.gallery-thumb__canvas'));
  if (!entry?.layout) {
    thumb.dataset.state = 'failed';
    return;
  }
  const before = new Set(document.body.children);
  try {
    entry.layout.mount(canvas, {
      preview: true,
      signal: new AbortController().signal,
      cleanup: () => {}
    });
    new Aurora(canvas, { preset: 'source', intensity: 'subtle' });
    tintAurora(canvas);
    thumb.dataset.state = 'ready';
  } catch (error) {
    console.error(`The "${entry.id}" thumbnail failed to render.`, error);
    canvas.replaceChildren();
    thumb.dataset.state = 'failed';
  } finally {
    for (const node of [...document.body.children]) {
      if (!before.has(node)) canvas.append(node);
    }
  }
}

/* ---------------------------------------------------------------------- popup -- */

/**
 * Builds the popup once: a near-full-screen Modal whose header names the open layout and holds its
 * actions, and whose body is the stage the layout mounts into, with the source view above it.
 * @returns {{modal: Modal, stage: HTMLElement, title: HTMLElement, category: HTMLElement,
 *   blurb: HTMLElement, sourceToggle: HTMLButtonElement, standalone: HTMLAnchorElement,
 *   source: ReturnType<typeof buildSourceView>}}
 */
function buildPopup() {
  const title = h('h2', {
    class: 'gallery-popup__title',
    id: 'gallery-popup-title',
    tabindex: '-1',
    // Initial focus lands on the title, as the dialog pattern recommends for large content: the
    // layout below is a whole application, and its first control is rarely where to begin.
    autofocus: true
  });
  const category = h('span', { class: 'gallery-popup__category' });
  const blurb = h('p', { class: 'gallery-popup__blurb', id: 'gallery-popup-blurb' });

  // Quiet actions: ghost buttons in the header, so the layout below keeps the only solid accent.
  // Pressed, the toggle takes the library's neutral current fill.
  const sourceToggle = button({ label: 'Source', icon: 'code', size: 'sm', kind: 'ghost' });
  sourceToggle.classList.add('gallery-popup__source-toggle');
  sourceToggle.setAttribute('aria-pressed', 'false');
  sourceToggle.addEventListener('click', () => {
    showSource(sourceToggle.getAttribute('aria-pressed') !== 'true');
  });

  // A real link, styled as a small button: it opens the layout's own page in a new tab, and the
  // browser's own link affordances (copy address, open in a window) work on it too.
  const standalone = /** @type {HTMLAnchorElement} */ (h('a', {
    class: 'zx-btn gallery-popup__standalone',
    target: '_blank',
    rel: 'noopener',
    dataset: { kind: 'ghost', size: 'sm' }
  }, icon('arrow-up-right-from-square', { size: 14 }), h('span', { class: 'zx-btn__label' }, 'Open in new tab')));

  const close = h('button', {
    type: 'button',
    class: 'zx-icon-btn gallery-popup__close',
    'aria-label': 'Close',
    title: 'Close (Esc)',
    onclick: () => modal.close()
  }, icon('x'));

  const stage = h('div', { class: 'gallery-popup__stage' });
  const source = buildSourceView();

  const content = h('div', { class: 'gallery-popup__frame' },
    h('header', { class: 'gallery-popup__header' },
      h('div', { class: 'gallery-popup__heading' },
        h('div', { class: 'gallery-popup__name' }, title, category),
        blurb),
      h('div', { class: 'gallery-popup__actions' },
        sourceToggle,
        standalone,
        h('span', { class: 'gallery-popup__divider', 'aria-hidden': 'true' })),
      close),
    h('div', { class: 'gallery-popup__body' }, stage, source.root));

  const modal = new Modal(null, {
    content,
    // The inset is a custom property so the stylesheet can take it to zero on a phone.
    width: 'calc(100% - 2 * var(--gallery-popup-inset))',
    closable: true
  });
  modal.el.classList.add('gallery-popup');
  modal.el.setAttribute('aria-labelledby', title.id);
  modal.el.setAttribute('aria-describedby', blurb.id);
  // Ambient light behind the stage: it shows wherever a layout leaves the stage clear, and a ZeyOS
  // screen tints it with its module colour (`tintAurora`).
  new Aurora(stage, { preset: 'source', intensity: 'subtle' });

  /*
   * Escape closes the popup — unless something inside the layout used it first: a menu closing,
   * a search clearing, a reader going back from a conversation to its list. Those handlers mark
   * the keystroke handled with `preventDefault()`, which is final by the time `cancel` arrives.
   */
  let escape = /** @type {KeyboardEvent|null} */ (null);
  modal.el.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') escape = event;
  }, { capture: true });
  modal.on('cancel', (event) => {
    if (escape?.defaultPrevented) event.preventDefault();
    escape = null;
  });
  modal.on('close', () => {
    const id = current?.id;
    unmount();
    showSource(false);
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }
    document.title = LAYOUTS_TITLE;
    if (id) focusTile(id);
  });

  return { modal, stage, title, category, blurb, sourceToggle, standalone, source };
}

/* -------------------------------------------------------------------- opening -- */

/**
 * Opens a layout in the popup, or swaps the open one for it.
 * @param {string} id Registry id.
 * @param {{push?: boolean}} [options] `push` adds a history entry, so Back closes the popup.
 * @returns {void}
 */
function open(id, { push = false } = {}) {
  const entry = entries.get(id);
  if (!entry) return;
  if (push && window.location.hash !== `#${id}`) window.history.pushState(null, '', `#${id}`);
  if (current?.id === id && popup.modal.isOpen()) return;

  unmount();
  showSource(false);
  popup.title.textContent = entry.title;
  // The category is a label, not a status or the brand: a neutral badge.
  popup.category.replaceChildren(badge({ label: entry.category, size: 'sm' }));
  popup.blurb.textContent = entry.blurb;
  popup.blurb.title = entry.blurb;
  popup.standalone.href = standaloneHref(entry.id);
  document.title = `${entry.title} — ${LAYOUTS_TITLE}`;
  // Shown first, mounted second: a layout measures itself as it builds, and a closed dialog has
  // no size to measure.
  if (!popup.modal.isOpen()) popup.modal.open();
  current = mountLayout(popup.stage, entry);
  tintAurora(popup.stage);
}

/**
 * Unmounts the open layout: aborts its signal, runs every cleanup it registered — destroying its
 * components and the overlays they own — and empties the stage.
 * @returns {void}
 */
function unmount() {
  const mounted = current;
  current = null;
  mounted?.unmount();
  popup.stage.replaceChildren();
}

/**
 * Shows or hides the source view over the stage. The stage is inert underneath it, so focus and
 * screen readers stay in the code.
 * @param {boolean} visible
 * @returns {void}
 */
function showSource(visible) {
  popup.sourceToggle.setAttribute('aria-pressed', String(visible));
  popup.source.root.hidden = !visible;
  popup.stage.inert = visible;
  if (visible) popup.stage.setAttribute('aria-hidden', 'true');
  else popup.stage.removeAttribute('aria-hidden');
  if (visible && current) void popup.source.show(current.id);
}

/**
 * Returns focus to a layout's tile after its popup closes, or to the page heading when the tile is
 * gone.
 * @param {string} id
 * @returns {void}
 */
function focusTile(id) {
  const tileButton = /** @type {HTMLElement|null} */ (
    page.tiles.get(id)?.querySelector('.gallery-tile__button') ?? null);
  if (tileButton) {
    tileButton.focus();
    return;
  }
  const heading = /** @type {HTMLElement} */ (app.querySelector('.gallery-intro__title'));
  heading.tabIndex = -1;
  heading.focus();
  heading.removeAttribute('tabindex');
}

/* -------------------------------------------------------------------- routing -- */

/**
 * Applies the URL hash: a known layout id opens that layout, anything else closes the popup. Runs
 * on load, on `hashchange`, and on `popstate`, and does nothing when the page already matches.
 * @returns {void}
 */
function route() {
  const { id, known } = parseLayoutHash(window.location.hash);
  if (known && entries.has(id)) open(id);
  else if (popup.modal.isOpen()) popup.modal.close();
}
