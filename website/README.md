# Zx website

This directory is a zero-build static website for Zx. It contains the focused landing page,
hand-written SVG brand assets, and an Invoices kitchen sink that exercises the real Zx components
on top of the dedicated ZeyOS client library `@zeyos/client`.

## View locally

From the repository root, start the development server:

    npm run serve

Then open:

- http://127.0.0.1:8321/website/ for the landing page
- http://127.0.0.1:8321/website/kitchen-sink.html for the Invoices screen

The site needs no build step: it loads ../src/index.js directly as an ES module and uses
../styles/zx.css. A production deployment would load the built dist/zx.esm.js or dist/zx.global.js
bundles instead.

## What the kitchen sink demonstrates

- MasterPanel application layout with header actions and a billing-module accent
- DataFilter connected to a locally sortable, selectable, sticky-header Table
- Dialog and Form editing with Fieldset, Select, Datebox-backed fields, and Permission
- Invoice and customer data read and written through **`@zeyos/client`** — the dedicated,
  dependency-free ZeyOS client library (npm: `@zeyos/client`). Invoices map to the ZeyOS
  `transactions` resource and customers to `accounts`; the demo uses
  `client.api.listTransactions / getTransaction / createTransaction / updateTransaction` and
  `client.api.listAccounts`, with `normalizeListResult` for list responses.

`vendor/zeyos-client.esm.js` is `@zeyos/client` bundled for the browser (zero-build serving);
a real app would `npm install @zeyos/client` instead. `mock-zeyos-api.js` patches `window.fetch`
and adds roughly 250 ms of latency while serving deterministic data for the OpenAPI endpoints the
client calls (`/api/v1/transactions`, `/api/v1/accounts`). Removing that one script and pointing
the client's `platform` at a live instance lets the same code talk to a real ZeyOS server.
