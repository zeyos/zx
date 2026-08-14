# Zx website

A zero-build static site: the landing page, the documentation application, and the brand assets.

## View locally

From the repository root:

    npm run serve

Then open:

- <http://127.0.0.1:8321/website/> — landing page
- <http://127.0.0.1:8321/website/docs.html> — documentation
- <http://127.0.0.1:8321/website/compat.html> — legacy gx snippet smoke page

Nothing is built: the pages load `../src/index.js` directly as an ES module and use
`../styles/zx.css`. A production deployment would load `dist/zx.esm.js` or `dist/zx.global.js`
instead. `tools/serve.js` sends `Cache-Control: no-store`, so an edit always shows up on the next
reload rather than being served from the browser's heuristic cache.

## Layout

    index.html          marketing landing page (ZeyOS visual language, always-dark bands)
    docs.html           documentation shell + the Getting started guides as <template> blocks
    docs.js             documentation application: sidebar, hash routing, tabs, source viewer
    docs.css            documentation and layout-example styles
    site.css / site.js  chrome shared by every page (header, footer, theme toggle)
    llms.txt            machine-readable index for coding agents
    demos/              one module per component, mounted by the Components section
    layouts/            complete application shells, mounted by the Layouts section
    mock-zeyos-api.js   fetch patch backing the ZeyOS invoices layout
    vendor/             @zeyos/client bundled for zero-build serving

### Documentation entries

`docs.js` assembles three kinds of entry, all addressable by URL hash:

| Kind | Source | Tabs |
| --- | --- | --- |
| Guide | `<template data-guide>` in `docs.html` | Guide |
| Component | `demos/<id>.demo.js` | Demo · JavaScript · Reference |
| Layout | `layouts/<id>.layout.js` | Preview · JavaScript |

The JavaScript tab fetches the same file the browser just executed, so it can never drift from the
running example. The Reference tab renders the component's `<!-- doc:<id> -->` section from
`../docs/llms.md`.

Adding a component demo means creating `demos/<id>.demo.js` and appending its id to
`COMPONENT_IDS` in `docs.js`; adding a layout means creating `layouts/<id>.layout.js` and
appending its id to `LAYOUT_IDS`.

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
