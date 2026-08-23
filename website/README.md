# Zx website

A zero-build static site: the landing page, the documentation application, and the brand assets.

## View locally

From the repository root:

    npm run serve

Then open:

- <http://127.0.0.1:8321/website/> — landing page
- <http://127.0.0.1:8321/website/docs.html> — documentation
- <http://127.0.0.1:8321/website/theme.html> — theme studio
- <http://127.0.0.1:8321/website/compat.html> — legacy gx snippet smoke page

Nothing is built: the pages load `../src/index.js` directly as an ES module and use
`../styles/zx.css`. A production deployment would load `dist/zx.esm.js` or `dist/zx.global.js`
instead. `tools/serve.js` sends `Cache-Control: no-store`, so an edit always shows up on the next
reload rather than being served from the browser's heuristic cache.

## Layout

    index.html          marketing landing page (ZeyOS visual language, always-dark bands)
    docs.html           documentation shell + the Getting started guides as <template> blocks
    docs.js             documentation application: sidebar, hash routing, source viewer
    demo-source.js      reads a demo module's helpers back out of its own text
    docs.css            documentation and layout-example styles
    theme.html          theme studio shell
    theme.js            the studio: control rail, persistence, CSS export
    theme-showcase.js   the studio canvas — one card per component family
    theme-presets.js    the standard themes and the OKLab ramp maths behind a custom one
    theme.css           studio styles
    site.css / site.js  chrome shared by every page (header, footer, theme)
    llms.txt            machine-readable index for coding agents
    demos/              one module per component, mounted by the Components section
    layouts/            complete application shells, mounted by the Layouts section
    mock-zeyos-api.js   fetch patch backing the ZeyOS invoices layout
    vendor/             @zeyos/client bundled for zero-build serving

### Documentation entries

`docs.js` assembles three kinds of entry, all addressable by URL hash:

| Kind | Source | Page |
| --- | --- | --- |
| Guide | `<template data-guide>` in `docs.html` | the prose, sectioned by its `<h2>`s |
| Component | `demos/<id>.demo.js` | API card, a card per example, behaviour, whole module |
| Layout | `layouts/<id>.layout.js` | the running shell, and the module behind it |

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
`COMPONENT_IDS` in `docs.js`; adding a layout means creating `layouts/<id>.layout.js` and
appending its id to `LAYOUT_IDS`.

## The theme studio

`theme.html` puts every component on one page under a live theme, so a theme can be judged as a set
rather than one component at a time. `theme-showcase.js` holds the cards; adding one means
appending a factory to its `CARDS` list.

Nothing here themes a preview in isolation. Every change goes through `window.zxTheme` in
`site.js` — the one applier of theme, preset, density, and custom property overrides, on every
page, before first paint. So the studio's own chrome is themed by the theme being edited, and the
choice survives navigating into the documentation. Four `localStorage` keys back it
(`zx-site-theme`, `zx-site-preset`, `zx-docs-density`, `zx-site-theme-vars`); the overrides end up
inside a `<style>` element, so `site.js` filters the names and values it will write.

The six standard themes live in `../styles/tokens/themes.css` as `[data-zx-preset]` blocks, and are
mirrored in `theme-presets.js` for the swatches and the export. `tests/unit/theme-presets.test.js`
fails if the two drift, and if any ramp stops meeting the contrast the semantic tier assumes.

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
