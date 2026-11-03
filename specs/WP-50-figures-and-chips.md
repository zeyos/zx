# WP50 — Figures without boxes, and one chip shape

Two follow-ups the WP45 review named and left open. Record pages still stack bordered stat tiles
of equal weight: three frames, three 24px figures, none of them leading — the opposite of "one
number gets to be big" and "hierarchy from proportion and space, not more boxes". And a tag is
drawn two ways: `Badge` as a 12px pill, `TagPicker` as a 13px rounded rectangle, so a label reads
differently in a list row or a record header from the field that edits it.

Work on top of `feat/wp45-calm-and-precise`. **Do not commit**: this lands after central review.
`AGENTS.md`, the WP40 and WP45 design rules, and WP42 (every layout from 390px to 1440, clean under
`tools/audit-layout.js`) apply. `src/core/**` and `styles/tokens/**` are **not** in scope: every
size below is derived from existing tokens. `CHANGELOG.md` is central: report changelog lines
instead of writing them. `docs/api.json` is regenerated (`npm run build:api`), never hand-edited. Public files (source comments, demos, docs) must not
mention this spec or the review.

## Design rules (binding, extending WP45)

1. **A figure needs no frame.** On a record page the figures sit on the page: no border, no fill,
   aligned to the content edge, separated by space. Bordered tiles stay where a figure stands
   alone among other content (a dashboard).
2. **One figure leads.** In a row of figures one may be set large; the others step down. The lead
   is never larger than the page title above it.
3. **The shape says what a chip is.** A tag (what something *is*: a category, a label) is a small
   rectangle at `--zx-radius-md`. A status (how something *is doing*) is a pill at
   `--zx-radius-full`, and a workflow status carries a 6px dot.
4. **A chip belongs to its row.** Its height follows `--zx-row-height`, bounded by its own text, so
   a chip never makes a row taller and never shrinks below a readable line.
5. **One fill, never also a line** (WP45 rule 7) — unchanged. The edge comes back only under
   `prefers-contrast: more` and forced colours.

## §1 · StatTile — `variant: 'plain'` and `emphasis`

**File scope:** `src/components/stat-tile/**`, `website/demos/stat-tile.demo.js`,
`tests/unit/stat-tile.test.js`.

- New option **`variant: 'default'|'plain'`** (default `'default'`), reflected as `data-variant`
  on the root. Unknown values fall back to `'default'`.
- **Plain:** no border, no fill, no padding; the label muted (13px, medium), the figure at
  `--zx-weight-title` in tabular figures at `--zx-text-lg`, the caption muted. The icon leads the
  label instead of sitting at the far end, because without a frame there is no corner to put it
  in. A linked or clickable plain tile keeps its text on the content edge and shows its hover fill
  and focus ring bled `--zx-space-2` beyond it, at `--zx-radius-md`.
- New option **`emphasis: boolean`** (default `false`), reflected as `data-emphasis="true"`: the
  figure leads its row. Plain: `--zx-text-2xl` (the record title's size, never above it). Default:
  one step above the tile's own figure, `--zx-text-3xl`.
- The figure size is one custom property, `--zx-stat-tile-value-size`, set per variant and
  emphasis. The loading skeleton's figure block reads it, so a plain tile's placeholder is as tall
  as its number.
- `update()` takes both options. Forced colours: a plain tile draws no frame.
- Unit tests: the variant and emphasis normalise; the stylesheet's plain rule draws no border and
  no background, and the plain figure is smaller than the emphasised one.

## §2 · One chip shape — Badge and TagPicker

**File scope:** `src/components/{badge,tag-picker}/**`, `website/demos/{badge,tag-picker}.demo.js`,
`tests/unit/{badge,tag-picker,overlay-states}.test.js`, `tests/smoke/smoke.js` (TagPicker case
only).

**Badge**

- **Height from the row:** `block-size: clamp(text-xs × 1.4, row-height × 5/9, text-xs × 2)` for
  `md` — 20px in the default 36px row — and `clamp(text-xs × 1.4, row-height / 2, text-xs × 1.75)`
  for `sm` — 18px. No block padding; the label is centred.
- **Type:** 12px (`--zx-text-xs`) at weight 500 at **both** sizes; `sm` no longer drops to 11px.
  `sm` differs in height and inline padding only.
- **Shape:** the pill (`--zx-radius-full`) by default; a badge with `tone` is a tag at
  `--zx-radius-md`, in every variant.
- **Dot:** 6px at both sizes, its centre on the centre of the pill's round end (inline start
  padding = half the height − 4px: the 1px edge plus half the dot), with `--zx-space-1` to the
  label.
- Under `prefers-contrast: more` a soft badge gets its edge back (`--zx-color-border-strong`);
  under forced colours, `CanvasText`.

**TagPicker**

- A selected tag is built by `badge({ tone })` and carries `zx-badge zx-tag-picker__tag`: the
  height, type, padding, fill, ink and tone pairs are the Badge's. `tag-picker.css` keeps only what
  is the picker's own: the tag shape for an untoned tag (`--zx-radius-md`; an untoned tag in a
  field is a value, so it keeps the text ink), the custom `colorKey` fill, the inset remove button,
  and the end padding it replaces.
- An item icon inside a tag is a bare 12px glyph in the tag's ink — one fill, no tile on top of
  the tag's own. The options list keeps its icon tile.
- The label span carries `zx-badge__label` so a long tag ellipsises like a long badge.
- The chip's high-contrast and forced-colours edge comes from the Badge rule.

## §3 · Layouts

**File scope:** `website/layouts/{record-page,crm}.layout.{js,css}`.

- **Record page:** the three figures become plain tiles; *Amount* leads. They sit on the page
  edge with `--zx-space-6` between them; below 520px the lead takes its own line.
- **CRM record:** the figures leave their boxes. Open deals (lead), annual recurring revenue (with
  its delta) and connection strength become one row of plain tiles over the content; the next
  meeting and the open-deal list stay as surfaces, without their duplicated figures. The stage in
  the header, the deal stages and the list stages are status pills with dots; the categories
  picker carries the categories' tones, so a category reads the same in the header as in the
  field that edits it.

## §4 · Documentation

`docs/llms.md` — StatTile (`variant`, `emphasis`, when to use which), Badge (the two shapes, the
row-derived height, 12px at both sizes), TagPicker (tags are Badges). Demos: a plain record row
with a leading figure in `stat-tile.demo.js`; tags beside statuses in `badge.demo.js`; a toned
picker beside the badges it produces in `tag-picker.demo.js`.

## Out of scope

- `ValueList` and `EntityRef` chips (they keep WP45's one-fill chip; adopting the Badge
  construction is a follow-up).
- `Select.status()`'s value rendering (a status glyph, not a chip).
- A semantic `--zx-chip-height` token — the formula lives in `badge.css` until a third component
  needs it.

## Verification

`npm test` and `npm run test:browser` green (report counts). `tools/shoot-layout.js` and
`tools/audit-layout.js` on record-page, crm (with the company record open), issue-tracker and
dashboard at 1440 and 390, light and dark. `docs.html#components/{stat-tile,badge,tag-picker}`
without console errors.
