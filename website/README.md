# Zx website

A zero-build static site: the landing page, the documentation application, the layout gallery, the
theme studio, and the brand assets.

## View locally

From the repository root:

    npm run serve

Then open:

- <http://127.0.0.1:8321/website/> — landing page
- <http://127.0.0.1:8321/website/docs.html> — documentation
- <http://127.0.0.1:8321/website/layouts.html> — layout gallery
- <http://127.0.0.1:8321/website/layout.html#mail> — one layout in a tab of its own
- <http://127.0.0.1:8321/website/theme.html> — theme studio

Nothing is built: the pages load `../src/index.js` directly as an ES module and use
`../styles/zx.css`. A production deployment would load `dist/zx.esm.js` or `dist/zx.global.js`
instead. `tools/serve.js` sends `Cache-Control: no-store`, so an edit always shows up on the next
reload rather than being served from the browser's heuristic cache.

## Layout

    index.html          marketing landing page (ZeyOS visual language, always-dark bands)
    docs.html           documentation shell + the Getting started guides as <template> blocks
    docs.js             documentation application: sidebar, hash routing, source viewer
    demo-source.js      reads a demo module's helpers back out of its own text
    docs.css            documentation styles
    layouts.html        layout gallery shell
    layouts.js          the gallery: tiles, live thumbnails, the popup, hash routing
    layouts.css         imports the layout stylesheets, then the gallery's and layout.html's chrome
    layout.html         one layout filling the window: layout.html#<id>
    layout.js           the standalone page: mounts the layout the hash names, re-mounts on change
    layout-host.js      loading, mounting, and unmounting a layout, and its source view — shared
                        by the gallery's popup and the standalone page
    theme.html          theme studio shell
    theme.js            the studio: control rail, persistence, CSS export
    theme-showcase.js   the studio canvas — one card per component family
    theme-presets.js    the standard themes and the OKLab ramp maths behind a custom one
    theme.css           studio styles
    site.css / site.js  chrome shared by every page (header, footer, theme)
    llms.txt            machine-readable index for coding agents
    demos/              one module per component, mounted by the Components section
    layouts/            the layouts, their registry, and the shared kit (see below)
    mock-zeyos-api.js   fetch patch backing the ZeyOS invoices layout
    vendor/             @zeyos/client bundled for zero-build serving

### Documentation entries

`docs.js` assembles two kinds of entry, both addressable by URL hash:

| Kind | Source | Page |
| --- | --- | --- |
| Guide | `<template data-guide>` in `docs.html` | the prose, sectioned by its `<h2>`s |
| Component | `demos/<id>.demo.js` | API card, a card per example, behaviour, whole module |

The layouts have their own page (below). The header search still lists them, linking to
`layouts.html#<id>`, and the retired `docs.html#layouts/<id>` addresses forward there.

A component page is one scrolling document, not a set of views: the source folds out under the
example it belongs to, so the running demo never has to leave the screen. That source is recovered
from the `render` function the browser just executed — which is why nothing here is bundled or
minified. The behavioural notes and the API card come from the component's `<!-- doc:<id> -->`
section in `../docs/llms.md` and from `../docs/api.json`.

Beside the snippet, a card offers a tab for every module-level declaration the example uses, and
for whatever those use in turn: `items: catalogue()` says nothing about the shape of a tree node,
and `catalogue()` says all of it. Those are found by reading the demo module's own text
(`demo-source.js`), so a demo needs no extra ceremony to opt in — declare the data at the top of
the module, use it from an example, and it appears.

Adding a component demo means creating `demos/<id>.demo.js` and appending its id to
`COMPONENT_IDS` in `docs.js`.

## The layout gallery

`layouts.html` shows every layout as a tile in one of two sections, both read from the registry in
`layouts/index.js`: **application templates** (`TEMPLATE_IDS` — mail, an issue tracker, a knowledge
base, an AI chat, an invoice editor, an item record, workflows, infrastructure, a CRM) and **screen
patterns** (`PATTERN_IDS` — master–detail, dashboard, inbox, record page, two wizards, settings,
ZeyOS invoices). A filter matches title, blurb, and category.

A tile is the thumbnail, the category, the title, and the blurb. Its thumbnail is the real module,
mounted with `preview: true` when the tile nears the viewport, rendered at 1440 × 900 and scaled to
the tile; it is `inert`, so the tile stays a single button named by its title. Beside the title, a
small icon link — its own tab stop, outside the button — opens `layout.html#<id>` in a new tab.

Opening a tile mounts the module again in a near-full-screen `Modal`, with a fresh context, inside
a `.layout-mount` scope element (`layout-host.js`) — which is also where the layout's menus,
dialogs, and toasts are hosted. **Source** lays the module's own text over the stage, **Open in new
tab** is a real link to the layout's own page, and closing aborts the context's signal, runs its
cleanups, empties the stage, and returns focus to the tile. Opening sets the hash (Back closes),
closing clears it, and `layouts.html#<id>` opens a layout on load.

### The standalone page

`layout.html#<id>` renders one layout filling the whole window, so it can be used like an
application in a tab of its own. The only chrome is a slim bar: **All layouts** (back to the
gallery), the layout's title, **Source**, and the theme toggle. It loads the same stylesheets as the
gallery and mounts the layout through the same `layout-host.js`, with a normal (non-preview)
context. Changing the hash unmounts the layout and mounts the one the new hash names; an id the
registry does not list — or no id at all — gets a message and a way back to the gallery, and is
never imported. The document title is "<Layout> — Layouts — ZeyOS Xenon Design System".

A layout module is `{title, category, blurb, components, mount(container, context)}`, with
`context` = `{preview, signal, cleanup}`:

```js
import { Table, h } from '../../src/index.js';
import { disposer, layoutContext, paneHeader } from './kit.js';

export default {
  title: 'Mail',
  category: 'Communication',
  blurb: 'One sentence.',
  components: ['AppSidebar', 'Launcher', 'Avatar'],
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);       // keep(component) destroys it when the popup closes
    const table = keep(new Table(null, { /* … */ }));
    container.append(h('div', { class: 'mail shell' }, paneHeader({ title: 'Inbox' }), table.toElement()));
  }
};
```

- `layouts/kit.js` / `kit.css` — the shared application shell: `.shell` with `.shell__nav`,
  `.shell__list`, `.shell__main`, `.shell__aside`, `paneHeader()`, `sectionLabel()`, `propList()`,
  `.list-row`, `.surface`, `shortcuts()` (keys bound on the layout root, inert in preview), and
  `loadChartJs()`.
- `layouts/fixtures.js` — the one fictional world every template shares (Fieldstone GmbH, its
  people, its customers, `TODAY`); `layouts/layout-icons.js` — icons beyond the built-in set.
- `layouts/<id>.layout.css` — a template's own styles, every selector under its block class,
  imported by `layouts.css`. The screen patterns are built the same way as the templates.

`node tools/audit-layout.js <id>` runs the same harness through an accessibility audit (names,
contrast, focus, headings, ids). Layouts that should work narrow use `adaptiveShell()` from the kit.

`node tools/shoot-layout.js <id> --out <dir>` mounts one layout full-screen through
`../tests/layouts/harness.html` and screenshots it in light and dark (`--preview` for the
thumbnail state, `--width`/`--height`, `--steps <module>` to drive it first). It reports console
errors, failed requests, and anything left on `<body>` after unmount.

## The theme studio

`theme.html` puts every component family on one page under a live theme, so a theme can be judged as a set
rather than one component at a time. `theme-showcase.js` holds the cards; adding one means
appending a factory to its `CARDS` list.

Nothing here themes a preview in isolation. Every change goes through `window.zxTheme` in
`site.js` — the one applier of theme, preset, and custom property overrides, on every page, before
first paint. So the studio's own chrome is themed by the theme being edited, and the choice
survives navigating into the documentation. Three `localStorage` keys back it (`zx-site-theme`,
`zx-site-preset`, `zx-site-theme-vars`); the overrides end up inside a `<style>` element, so
`site.js` filters the names and values it will write.

The six standard themes live in `../styles/tokens/themes.css` as `[data-zx-preset]` blocks, and are
mirrored in `theme-presets.js` for the swatches and the export. `tests/unit/theme-presets.test.js`
fails if the two drift, and if any ramp stops meeting the contrast the semantic tier assumes.

Export and Import move a theme as a JSON file: `{ "format": "zx-theme", "version": 1, settings,
tokens }`. `settings` are the studio's controls, appearance excluded, and are all Import reads —
`readThemeJson()` and `normalizeSettings()` in `theme-presets.js` check every value against what its
control can show, the same check the studio's own `localStorage` entry goes through. `tokens` are
the custom properties the settings produce, for tooling that wants them without the studio.

## The ZeyOS invoices layout

`layouts/zeyos-invoices.layout.js` is the reference integration for the schema-driven `zx-zeyos`
binding. Its table, filters, and dialog editor are generated from the real ZeyOS `transactions` and
`accounts` schemas exposed by an injected **`@zeyos/client`** — invoices map to the `transactions`
resource and customers to `accounts`.

`vendor/zeyos-client.esm.js` is `@zeyos/client` bundled for the browser (zero-build serving); a real
app would `npm install @zeyos/client` instead. `mock-zeyos-api.js` exports `installMockZeyosApi()`,
which patches `window.fetch` with roughly 250 ms of latency and serves deterministic data for the
OpenAPI endpoints the client calls (`/api/v1/transactions`, `/api/v1/accounts`). Requests that do
not target `/api/v1/…` fall through untouched. Dropping that one call and pointing the client's
`platform` at a live instance lets the same code talk to a real ZeyOS server.
