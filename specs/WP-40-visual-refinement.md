# WP40 — Visual refinement: quiet selection, tones, outline icons, layered surfaces

A design comparison of the nine application templates against the products that informed them
found the structure sound and the finish behind: colour used everywhere, heavy solid icons, every
area white and separated by lines, uppercase labels, bold weights, placeholder-looking avatars, and
property panels that read as walls of form boxes. This WP fixes the finish at the system level so
every component and template improves at once; the templates then polish themselves on top (§5).

Work in the current checkout. **Do not commit.** Sections run in parallel with disjoint file scopes.
`AGENTS.md` applies. This WP explicitly permits changes to `styles/tokens/**`, `styles/base.css`,
and `src/core/icons.js` (§3 only). Run `node --test` and `node tests/lint-tokens.js` before and after
(baseline 750 passing). Verify visually through your own headless scripts (see `tools/run-smoke.js`
for how to serve and launch Chrome) on `website/theme.html` (both themes, a few presets) and the
relevant `docs.html#components/<name>` pages — never the shared browser pane.

## Design rules (binding for every section)

1. **Current vs selected.** Where you *are* (the active navigation item, the current list row, the
   open tree node, the active tab or view) is **neutral**: `--zx-color-bg-current` fill, normal text
   colour, weight 600. What you have *picked* (checked table rows, chosen options, a multi-selection)
   keeps the accent tint `--zx-color-bg-selected`. Nothing is docked to an edge.
2. **One solid accent per screen.** Solid accent is for the single primary button. Focus rings,
   links, checkboxes, toggles, sliders and progress keep the accent; tab underlines, pressed view
   toggles, "Saved" texts and decorative icons do not.
3. **Status is not the brand.** `success` must be visibly different from the default (ZeyOS green)
   accent. Categorical colour (tags, chips, icon tiles, chart series, avatars) comes from a tone
   palette that is neither the accent nor the status set.
4. **Tone separates, lines only where tone cannot.** Chrome columns sit on a grey, the working canvas
   on white; dividers use the subtle border; boxes inside boxes go.
5. **Quiet type.** Mid weights (500–600; 650/700 only for titles and numbers), sentence case — no
   decorative uppercase or letter-spaced labels anywhere — labels quieter than values, and real title
   sizes.
6. **Corners stay small** (the product owner's preference): no radius increases beyond the WP38
   scale. Pills only where a pill is the meaning.

## §1 · Foundation tokens (tokens agent)

**File scope:** `styles/tokens/**`, `styles/base.css`, `styles/zx.css` (imports only),
`tests/unit/theme-presets.test.js`, `tests/unit/geometry.test.js`, new `tests/unit/tokens.test.js`,
`website/theme-presets.js` + `website/theme.js` + `website/theme-showcase.js` (only where a new token
must be shown or exported), `docs/llms.md` (the tokens section only), `README.md` (theme section only).

- **New tier-2 colour roles**, light and dark, for every preset where relevant:
  - `--zx-color-bg-current` — neutral "you are here" fill: a text-colour mix (about 7–9%) so it
    works on any surface; hover stays below it (about 4–5%).
  - `--zx-color-bg-chrome` — the navigation/inspector column tone: one clear step below the canvas
    in light (around `#f5f5f6`), one step above the page in dark.
  - `--zx-color-border-subtle` — row and grid dividers, lighter than `--zx-color-border`.
  - `--zx-color-text-subtle` — icons and non-essential meta, at least 3:1 on surface and chrome.
  - Tone palette: `--zx-color-tone-{blue,teal,green,amber,orange,red,pink,violet,slate}-bg` and `-fg`
    (bg ≈ 12–14% tint on light / ≈ 18–22% on dark; fg ≥ 4.5:1 on its own bg in both themes).
  - Chart series: `--zx-color-chart-1 … -8`, ordered for distinguishability, **not starting with
    the accent**, readable on both themes (lines/areas ≥ 3:1 against the surface).
- **Success is its own green.** Retune the tier-1 `--zx-green-*` ramp to a yellow-green status green
  that is distinguishable from the ZeyOS accent at a glance (and keep `success` ≥ 4.5:1 as text on
  its own bg and on white / the dark surface). Check every use of the green ramp (`grep`), including
  module colours and Aurora, and keep anything that is meant to be brand on the accent ramp.
- **Dark theme ramp.** Lift the dark page/surface/raised/overlay steps off near-black (aim:
  page ≈ `#1b1c1f`, surface ≈ `#212226`, raised ≈ `#28292e`, overlay ≈ `#303237`), soften primary text
  to ≈ 90% white and muted text to ≈ 62–65% white, borders ≈ 9–10% white. Filled primary buttons in
  dark use the accent **600** step with `--zx-color-on-accent` (white) instead of the bright 400
  step; links and accent text stay on 400. Keep every preset's invariant (`AGENTS.md`).
- **Type tokens:** `--zx-text-3xl: 30px` (document titles), `--zx-weight-medium: 500`,
  `--zx-weight-semibold: 600`, `--zx-tracking-tight: -0.01em` (UI text 13–14px may use it; titles
  -0.015em). `styles/base.css` gives `body` the tight tracking and turns on Inter's `cv11` (single-
  storey a is optional — choose what reads best; document the choice).
- **Quiet fields context** in `styles/base.css`: inside `[data-zx-fields="quiet"]`, native inputs,
  selects and textareas show no border and no background until hover (`--zx-color-bg-hover`) or
  focus (normal border + focus ring). §2 extends this to the composite controls.
- Tests: contrast checks for every new role in both themes and all presets (extend
  `theme-presets.test.js`), success ≠ accent (ΔE or hue distance above a threshold), and the token
  names exist.

## §2 · Components (components agent)

**File scope:** `src/components/**` (CSS first; JS only where named below), their demos in
`website/demos/**`, `tests/unit/*.test.js` for the components touched, `docs/llms.md` (their
sections). Not yours: `styles/**`, `src/core/**`, `website/layouts/**`.

Use the §1 token names even before §1 lands (they will exist).
- **AppSidebar / AppRail / flyouts, TreeView, Finder, ListToolbar view switch, Tabbox (all
  variants), SortControl, Calendar view buttons, CardView/Kanban "current" states:** rule 1 — current
  is neutral `--zx-color-bg-current`, text colour, weight 600; icons in the current row use the text
  colour. Tabbox `line` indicator becomes `--zx-color-text`. Hover stays lighter than current.
- **Uppercase sweep:** remove decorative `text-transform: uppercase` and letter-spacing across
  component CSS (menu section labels, Select group labels, StatTile labels, Fieldset legends,
  Calendar headers, Table headers, Launcher groups, …) → sentence case, `--zx-text-xs`/`-sm`,
  weight 500–600, `--zx-color-text-muted`. Keep uppercase only where content demands it (`kbd`).
- **Weights:** item/row/label weights 600→500 where they are not titles; titles keep 600–650.
- **Field labels** (`Field`, Fieldset legends): `--zx-text-sm`, weight 500, `--zx-color-text-muted`
  — quieter than values.
- **Table:** headers weight 500, `--zx-color-text-muted`, no uppercase, background the surface (no
  band) by default or a very light one; row dividers `--zx-color-border-subtle`; numbers
  `tabular-nums`. Add `variant: 'plain'` (JS option → `data-variant="plain"`): no outer frame, no
  header band, hairline rows — for tables inside cards.
- **Avatar:** fallback background from a stable hash of the name over the §1 tone palette (`-bg` +
  `-fg`), no border ring; sizes `sm` 24px, `md` 32px, `lg` 40px; initials ≥ 10px, weight 600,
  0.4× size; one initial below 24px. Status dot unchanged.
- **Badge:** add `tone: 'blue'|'teal'|…` (categorical, uses the tone palette, no border, weight 500,
  sentence case) beside the existing semantic `kind`; soft/outline/solid variants keep working.
- **StatTile:** label sentence case muted 13px/500; value 24–28px/650 tabular; add a `caption`
  option (muted context line such as "of 13,184"); equal heights with/without sparkline; no
  coloured icon circles by default (icon muted, no chip).
- **Quiet fields:** extend `[data-zx-fields="quiet"]` to Select, TagPicker, Datebox, DateRangeBox,
  NumberField, Timebox: no border/background/chevron/stepper chrome until hover or focus-within.
- **Buttons:** pressed toggle buttons neutral (`--zx-color-bg-current`); ghost buttons quieter; the
  dark primary uses the §1 tokens.
- **AccountMenu trigger** (the cascade defect in WP39 A1): fix it here — flat row, no glass shadow.
- **Menus, listboxes:** current/highlighted option neutral; checked options keep the check mark.

Check every touched component in both themes in `theme.html` and on its docs page.

## §3 · Outline icons (icons agent)

**File scope:** `src/core/icons.js`, `src/core/fontawesome.js` (name mapping only), `styles/icons.css`,
`tests/unit/icons.test.js`, `website/layouts/layout-icons.js`, `website/zeyos-demo-icons.js`,
`website/demos/icons.demo.js`, `docs/llms.md` (icons section), `README.md` (icons paragraph),
`CHANGELOG.md` is central (report, don't edit).

Replace the bundled inline glyphs and the layout icon pack with one **outline** set (source given in
the agent prompt), keeping every existing icon **name** working (map names to the closest outline
glyph). Icons render as strokes: `fill="none"`, `stroke="currentColor"`, `stroke-width` 1.75 at
24px (≈1.5 at 16px rendering), round caps/joins, via `icon()` — the public API and the
`.zx-icon` class do not change; Font Awesome mode keeps working. Default rendered size 16px; muted
colour stays a consumer choice. Keep the licence notice. Regenerate the layout pack with the same
names the templates use (`grep -oh "icon('[a-z0-9-]*'" website/layouts/*.js` and every
`icon:` / `iconButton(` name) so no template loses an icon.

## §4 · Shared shell (coordinator)

`website/layouts/kit.css` / `kit.js`: chrome columns on `--zx-color-bg-chrome`, canvas on surface,
list rows inset without dividers, current rows neutral, section labels and panel titles sentence
case, page-title size for `paneHeader`, a document title class, an icon-tile primitive with tones,
quiet fields in property lists, chart helpers on the chart series tokens.

## §5 · Templates (template agents, after §1–§4)

Each template applies the comparison's recommendations for it (given in its prompt), on top of the
new system defaults, and deletes local styling the system now covers.
