# WP42 — Layouts at every width, and accessible

The nine application templates and eight screen patterns (`website/layouts/`) are designed at
1440 × 900. Below that the shared shell simply dropped columns: under 1180px the inspector vanished,
under 860px the navigation vanished with no way back, and on a phone list and detail squeezed side
by side. This WP makes every layout usable from a phone to a wide screen, and clean under the new
accessibility audit.

Work in the current checkout. **Do not commit.** Groups run in parallel with disjoint file scopes
(the layouts named in each group: `<id>.layout.js` and `<id>.layout.css`). `AGENTS.md` and the
WP40 design rules apply (neutral current, one solid accent, tones for categories, sentence case,
small corners, no edge bars). `website/layouts/kit.js`, `kit.css`, `fixtures.js`, and
`layout-icons.js` are the coordinator's: ask for a kit change in your report instead of making it.
WP41 (component defects) runs at the same time and changes components under you; if a component
misbehaves mid-run, re-run before you work around it, and report it.

## The kit's narrow mode — `adaptiveShell(root, context, labels)`

Read its JSDoc in `kit.js` and its CSS at the end of `kit.css`. In short:

- Below **1180px** the inspector (`.shell__aside`) gives way unless it carries `data-pinned`;
  `asideToggle()` makes a button that opens it as a drawer from the end.
- Below **860px** the navigation column gives way; `navToggle()` makes a button that opens it as a
  drawer from the start. Place one first in the header of every pane that can be the leftmost one
  showing.
- Below **640px** a shell with a `.shell__list` column shows the list or the main pane, never both:
  call `show('main')` when a record is opened by pointer or Enter (not when J/K moves), and
  `show('list')` where the layout closes its record; `backToggle()` makes the back button for the
  main pane's header (a layout with its own back button calls `show()` from it instead).
- Drawers are modal within the layout (other columns inert, Escape and the scrim close, choosing a
  navigation item closes, focus returns). Toggles are factories; make as many as the headers need.
- `data-narrow="hide"` on a header or toolbar control hides it below 640px; `data-narrow="icon"` on
  a labelled `.zx-btn` keeps only its icon there (the words stay in its accessible name). Put
  anything you hide that way somewhere reachable — an overflow menu, the command palette.
- `mail` is the pilot: see how it creates the root first, builds the shell controller, places the
  toggles, and calls `show()` from its own reading mode.

## Per layout

1. **Every width.** Check 1440, 1180, 1024, 860, 768, 640, 390 (portrait phone) and 844 × 390
   (landscape phone). Nothing overlaps or clips, text never runs under a control, no horizontal
   scroll of the whole layout (a wide table may scroll inside its pane), and every column's content
   stays reachable. Wrap or condense headers and toolbars rather than let them overflow: decide per
   control what stays, what becomes icon-only, and what moves into a menu. Tables become cards or
   scroll inside their pane; boards scroll horizontally inside their pane; multi-column grids
   reflow (container queries on the pane, not media queries).
2. **The shell controller.** Every layout with a navigation column or an inspector uses
   `adaptiveShell()`; every layout with a list column wires `show()`. Escape handling stays
   consistent: a drawer first (the kit does it), then the layout's own steps back.
3. **The audit.** `node tools/audit-layout.js <id>` (read its header) must come out clean — no FAIL
   lines — in light and dark, at 1440 and at 390, and in the states your step scripts reach (a
   record open, a dialog open, a drawer open). Fix what it finds in the layout: names for every
   control and for repeated landmarks (each `<aside>`, `<nav>`, `<section aria-label>`, `<form>`),
   tab lists named (Tabbox has a new `label` option), contrast (use `--zx-color-text-muted` for
   text; `--zx-color-text-subtle` is only for icons and non-essential meta at 3:1), visible focus,
   heading order, decorative text `aria-hidden`. Target-size warnings: fix the ones that are easy
   (pad an icon button to 24px); list the rest.
4. **Keyboard.** The full keyboard map still works at every width, focus is never lost to `<body>`
   after a pane switch or a drawer, and a screen reader hears where it went (the kit focuses the
   main pane's heading on `show('main')`).

## Verification

- `node tools/shoot-layout.js <id> --out <dir> --width <w> --height <h> --themes light,dark` at the
  widths above, with step scripts that open the drawers and switch panes (your scripts may live in
  your scratch folder); read the PNGs critically.
- `node tools/audit-layout.js <id>` at 1440 and 390, light and dark, plus with your step scripts.
- `node --test tests/unit/layout-templates.test.js tests/unit/layout-gallery.test.js` and
  `node tests/lint-tokens.js`.

## Groups

| Group | Layouts |
|---|---|
| A · messaging | `mail` (finish the pilot), `inbox`, `ai-chat` |
| B · record lists | `issue-tracker`, `crm`, `master-detail` |
| C · content and flows | `wiki`, `workflows`, `settings-workspace` |
| D · documents and forms | `invoice-editor`, `record-wizard`, `checkout-wizard`, `zeyos-invoices` |
| E · records and dashboards | `item-inventory`, `infrastructure`, `dashboard`, `record-page` |

## Out of scope

Kit changes (report them), component changes (report them; WP41 owns the defects), new features in
the layouts, and the 1440 design — it must look exactly as it does now at full width.
