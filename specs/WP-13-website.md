# WP13 — Marketing/docs website, Zx logo, and ZeyOS-client kitchen sink

Branch: work on `main`. Read `README.md`, `docs/API.md`, `.claude/skills/zx/SKILL.md`, and
`AGENTS.md` first. This package is a zero-build static site plus a logo; it consumes the existing
Zx library, it does not modify component source.

## Design language (keep it simple)

ZeyOS is a minimal, professional "all-in-one business platform" (CRM + ERP + collaboration):
white backgrounds, generous whitespace, clear hierarchy, a grid-of-modules motif, restrained
color. The ZeyOS logo (`assets/zeyos.black.svg`) uses a warm gold accent `#F7BC60`. Zx's own
brand accent is green (`--zx-green-500 #008040` / `--zx-green-400 #00cc33`).

Site aesthetic: clean, light, lots of whitespace, one accent (Zx green), system/Inter type,
subtle 1px borders over heavy shadows. Do NOT build a heavy marketing site — one focused landing
page, a components showcase section, and the kitchen sink. Light/dark support via the same
`data-zx-theme` mechanism the library uses (add a small theme toggle in the header).

## Scope (files to create)

```
website/index.html            # landing page
website/kitchen-sink.html     # realistic ERP screen (see §3)
website/site.css              # site chrome only (NOT component styles — those come from zx.css)
website/site.js               # nav, theme toggle, small landing interactions
website/mock-remotecall.js    # mock ZeyOS backend (see §3)
website/assets/zx-logo.svg        # full wordmark logo (light backgrounds)
website/assets/zx-logo-dark.svg   # wordmark for dark backgrounds
website/assets/zx-mark.svg        # square monogram mark (favicon / social)
website/favicon.svg               # = the mark, or an inline copy
website/README.md             # how to view the site + what the kitchen sink demonstrates
```

The site loads the library from source for zero-build viewing:
`<link rel="stylesheet" href="../styles/zx.css">` and
`<script type="module">import { … } from '../src/index.js'</script>`. (A short note in
website/README.md should say the production site would instead load the built `dist/` bundles.)

## 1. Logo

Design a clean, modern **"Zx"** logo — the library is called Zx, the successor to gx.
- A **wordmark** "Zx" set in a strong geometric style, plus a **monogram mark** (the "Zx"
  or a stylized "Z"/"x" ligature) inside a rounded square for the favicon/app icon.
- Use the Zx green accent (`#008040`/`#00cc33`). Keep it simple and confident — geometric,
  balanced, no gradients required (a single flat accent is fine; a subtle two-tone green is OK).
- Provide light-background and dark-background variants (swap ink color; keep the accent).
- Pure hand-written SVG, crisp at small sizes, no external fonts (convert any lettering to paths
  or use a common system font family in the SVG with a path fallback for the mark).
- The mark should read clearly at 32×32 and 16×16 (favicon).
Reference `assets/zeyos.black.svg` only for co-branding context ("built for ZeyOS"); do not copy it.

## 2. Landing page (`index.html`)

Sections, in order, simple and scannable:
1. **Header**: Zx logo (left), nav links (Docs, Components, Kitchen sink, GitHub placeholder `#`),
   a light/dark theme toggle button on the right.
2. **Hero**: the logo/wordmark, headline (e.g. "The modern UI toolkit for ZeyOS"), one-sentence
   subhead ("Dependency-free, accessible, themeable components — the vanilla-JS successor to gx."),
   two buttons (`zx.button`): primary "Explore components" (→ `../demos/`), ghost "Kitchen sink"
   (→ kitchen-sink.html). A subtle "Built for ZeyOS" line with the ZeyOS logo small.
3. **Feature grid** (module-grid motif, ~6 cards): Zero dependencies · Accessible (WAI-ARIA APG) ·
   Themeable tokens (light/dark/density) · 30+ components · gx compatibility layer · Native
   platform (dialog/popover/ElementInternals). Each card: an `icon()` glyph + title + one line.
4. **Live showcase**: instantiate ~5 real Zx components inline so visitors see them working —
   a `Toggle`, a `Select` (local filter), a small `Table`, a `Datebox`, and a "Show toast" button
   firing `Message.success`. Wire them with the real ESM imports.
5. **Quick start**: two short code blocks (ESM import + global script), copied from README.
6. **Footer**: links (Docs/API/Migration/Skill), "successor to gx", license line.

Keep total custom CSS modest; lean on `zx.css` tokens (`--zx-color-*`, `--zx-space-*`, etc.) for
colors and spacing so the site tracks the theme automatically. The theme toggle sets
`data-zx-theme` on `<html>` (light/dark) and persists to localStorage.

## 3. Kitchen sink (`kitchen-sink.html`) — with the ZeyOS Client library

A realistic single-screen ERP module — **"Invoices"** — that exercises many components AND loads
its data through the ZeyOS HTTP client, both the modern Zx client and the legacy compat client.

Layout: a `MasterPanel` (title "Invoices", `module` accent, header action buttons "New invoice"
and "Refresh"), containing:
- A `DataFilter` bar (a text filter on customer/number, a select filter on status) above a
  `Table` (columns: Number, Customer, Issued (date), Amount, Status; `sortMode: 'local'`,
  `selectable: 'multi'`, sticky header). Table data is **loaded via the ZeyOS client** on page
  load and on "Refresh".
- Row click opens an "Edit invoice" `Dialog` with a `Form` (Fieldset, 2 columns): invoice number
  (text), customer (`type: 'zxselect'` whose options are **loaded via the ZeyOS client**), issue
  date (`type: 'date'`), due (`type: 'date'`), amount (`type: 'float'`), status (`optionlist`),
  notes (textarea), a `Permission` field. Save → **POST via the ZeyOS client** → on success
  `Message.success` + update the table row; on error `Message.error`.
- "New invoice" opens the same Dialog empty.

### The ZeyOS client (this is the point of the exercise)

`mock-remotecall.js` patches `window.fetch` to simulate a ZeyOS backend with ~250ms latency, so
the **real** `zx.Http` / `zeyosService` and the **compat** `gx.zeyos.Client` work unmodified:
- Intercept REST-style `../remotecall/invoices[:key]/list`, `/get`, `/save` and return
  `{ result: … }` JSON envelopes. Also intercept the flat `./remotecall.php` endpoint (action in
  the POST body) for the compat-client demo.
- Seed ~25 fake invoices and ~8 customers in-module.

Wire it two ways and make the page state which client did what (a small "data source" note):
1. **Modern Zx client** (primary): 
   ```js
   import { zeyosService, parseResult } from '../src/index.js';
   const api = zeyosService('invoices');            // base ../remotecall/invoices/
   const invoices = parseResult(await api.get('list'));
   const customers = parseResult(await zeyosService('customers').get('list'));
   await api.post('save', invoiceData);
   ```
2. **Legacy compat client** (show it works): load `../dist/zx.global.js` + `../dist/zx-compat.global.js`
   (run `npm run build` first so these exist), then in a classic script use
   `new gx.zeyos.Client({ url: './remotecall.php' })` for ONE action (e.g. the "Refresh" button,
   or a small "Load via legacy client" button) and log the result to a visible panel. This proves
   the ZeyOS Client library runs on Zx.

Add a short "About the data layer" note on the page explaining that no real backend is required —
`mock-remotecall.js` fakes the ZeyOS `remotecall` endpoints, and the same code would talk to a
real ZeyOS server by removing the mock.

## Acceptance criteria

1. `npm run build` succeeds (needed for the compat-client part of the kitchen sink).
2. `npm run serve`, then:
   - `http://127.0.0.1:8321/website/` renders the landing page with the logo, working live
     showcase components, and a functioning light/dark toggle (persisted).
   - `http://127.0.0.1:8321/website/kitchen-sink.html` loads invoices into the table via the Zx
     client (visible latency), filtering and sorting work, editing opens the dialog with the
     customer select populated via the client, saving shows a success toast and updates the row,
     and the legacy `gx.zeyos.Client` action works and logs its result.
   - No console errors on either page.
3. Logo reads clearly at favicon size; light and dark variants both legible.
4. Light/dark parity on both pages; the site uses semantic `--zx-*` tokens (no hardcoded colors
   for anything that should track the theme — a couple of brand values in the logo/hero are fine).
5. `node tests/lint-tokens.js` still passes (it only scans component CSS + base.css, but keep
   `website/site.css` clean of surprises).
6. git commit when done.

## Out of scope

Changing any `src/`, `styles/`, or component behavior; a build step for the site; hosting/deploy;
real backend integration.
