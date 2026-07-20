# Zx website

This directory is a zero-build static website for Zx. It contains the focused landing page,
hand-written SVG brand assets, and an Invoices kitchen sink that exercises the real Zx components
and both generations of the ZeyOS HTTP client.

## View locally

From the repository root, build the classic bundles needed by the compatibility example and start
the development server:

    npm run build
    npm run serve

Then open:

- http://127.0.0.1:8321/website/ for the landing page
- http://127.0.0.1:8321/website/kitchen-sink.html for the Invoices screen

The site itself needs no build step. During development it loads ../src/index.js directly as an ES
module and uses ../styles/zx.css. A production deployment would load the built dist/zx.esm.js or
dist/zx.global.js bundles instead.

## What the kitchen sink demonstrates

- MasterPanel application layout with header actions and a billing-module accent
- DataFilter connected to a locally sortable, selectable, sticky-header Table
- Dialog and Form editing with Fieldset, Select, Datebox-backed fields, and Permission
- Invoice and customer data loaded through zeyosService
- Saves posted through the modern Zx HTTP client with success and error messages
- A classic-script gx.zeyos.Client action running through zx.global.js and zx-compat.global.js

mock-remotecall.js patches window.fetch and adds roughly 250 ms of latency while serving deterministic
invoice and customer data. It understands both REST-style ../remotecall/service/action routes and
the flat ./remotecall.php shape used by the legacy client. Removing that one script lets the same
client calls target a real ZeyOS remotecall backend.
