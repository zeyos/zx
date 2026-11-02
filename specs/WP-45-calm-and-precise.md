# WP45 — Calm and precise: reading type, row rhythm, receding chrome, and craft

Xenon serves two kinds of screen that pull in different directions: the calm document workspace
(a page of prose, a wiki, a record's notes) and the precise data tool (a CRM list, a record's
attributes, a pipeline). A review in November 2026 compared the system against two products that
are reference points for each register — one for content-first calm, one for data-dense precision
— and against a product designer's published still-frame craft rules. Five reviewers on different
models worked independently (calm-workspace lens, data-tool lens, craft audit of every component
stylesheet, theming-API review, and sourced measurements of both products); their transcripts stay
outside the repository. This WP is their consensus. Qualities are borrowed, identity never: no
reference product's name, colours, copy or assets anywhere under `website/` or `src/`.

Work in the current checkout. **Do not commit**: this lands after central review. `AGENTS.md`, the
WP40 design rules, and WP42 (every layout from 390px to 1440, clean under `tools/audit-layout.js`)
apply. This WP explicitly permits changes to `styles/tokens/**`, `styles/base.css`, a new
`styles/prose.css`, `styles/zx.css` (imports), `tests/lint-tokens.js` (style list), and
`AGENTS.md` (the token-family list in *Naming* only). `src/core/**` is **not** in scope.
`CHANGELOG.md` and `docs/api.json` are central: report changelog lines instead of writing them.
Public files (source comments, demos, docs) must not mention this spec, the reviews, or the
reference products; `tools/check-site.js` enforces it.

## What the review found

Already right, and to be kept: neutral current vs. accent selected (WP40 rule 1); translucent
hover and current fills that read on any surface; muted text at 4.5:1 on chrome and on current
rows — **both reviewers independently named "faint grey secondary text" as the one thing not to
copy**; the tone palette apart from accent and status; quiet fields; tabular figures in tables;
the wiki's reading column (62ch, 16px at 1.7, frameless tables, links in body colour).

The gaps, in the order of the consensus:

1. **The type scale does not scale.** The studio's text-size setting moves only `--zx-text-md`
   (`website/theme-presets.js:483`); the other steps are fixed pixels (`global.css:132-138`). At
   12px the body is smaller than `-sm`, at 17px larger than `-lg`: the hierarchy inverts at both
   ends of the slider.
2. **Reading type is a layout, not a foundation.** The heading scale, measure, rhythm, lists,
   quotes, code, tables and callouts live in `wiki.layout.css`. An issue description, a record's
   notes, a mail body or an assistant reply cannot opt in, and a theme cannot make documents serif
   without making the interface serif.
3. **No row rhythm.** Row height is whatever the content makes it: 36px in the CRM (forced by a
   layout override), 38 on the record page, 41 on the dashboard, 42 in the tracker. Density is
   three unrelated sliders and never a decision.
4. **Chrome as loud as content.** Navigation labels are full text colour at 500 (18:1 on the
   chrome tone, the same ink as the article). Every column carries a tone *and* a hairline, every
   header a rule, whether or not anything has scrolled under it.
5. **Craft defects, systemic and measured.** Hover is more specific than state and wipes a
   selected row or pressed button under the pointer (table, check-button, navigation-bar,
   list-toolbar, select, launcher); an open popover's trigger loses its pressed look; menu panels
   (4px) are not concentric with their 2px items behind 4px padding + 1px border; chips draw a fill
   *and* a border; an overflow chip in an avatar stack is translucent over the face it overlaps;
   five keyboard-hint styles ("New company N" reads as a typo); placeholder and border inks used as
   real text and data marks; counts without tabular figures; `--zx-radius-pill` is used but never
   declared.
6. **The attribute panel has two value edges** and mixed row heights; `fit-content` per list
   gives each block its own label column.

## Design rules (binding, extending WP40)

1. **Two registers, one system.** Interface type (controls, rows, navigation) and reading type
   (prose) are separate dimensions with separate tokens. A theme may make documents serif without
   touching the interface.
2. **Quiet comes from size, weight, space and fewer lines — never from contrast below the floors**
   (text-muted 4.5:1 on chrome and current rows, text-subtle 3:1). This rule outranks any
   reference measurement.
3. **Chrome recedes.** Navigation rests one ink step below content and comes up to full text on
   hover and when current. Lines are drawn only where tone cannot separate — never in light
   between chrome and canvas, always in dark, high-contrast and forced colours. A header's rule
   appears when content scrolls under it.
4. **One rhythm.** A data row is a token derived from the control height; a row density is one
   decision.
5. **State is never lost under the pointer**, and a trigger keeps its pressed look while its
   popover is open.
6. **Concentric corners.** Outer radius = inner radius + inset (+ border). Corners stay small (WP40
   rule 6): the derived panel radius equals `--zx-radius-xl` at the default base.
7. **One fill or one line, not both,** on a chip or pill. **Nothing translucent overlaps.**
8. **Hover-revealed affordances** are allowed only for repeated, secondary per-row actions that are
   reachable another way. They keep their space (opacity, never `display`), stay in the tab order,
   appear on `:focus-within`, and are always visible under `(hover: none)`, `prefers-contrast:
   more` and forced colours.
9. **One keyboard-hint construction** everywhere a key is shown.

## §1 · Foundation (coordinator)

**File scope:** `styles/tokens/**` except `themes.css`, `styles/base.css`, new `styles/prose.css`,
`styles/zx.css`, `tests/lint-tokens.js`, `tests/unit/tokens.test.js`,
`tests/unit/geometry-tokens.test.js`, new `tests/unit/prose.test.js`, new `src/components/kbd/**`,
`src/index.js` (export only), `AGENTS.md` (token families).

1. **One base text size.** `--zx-text-base: 14px` on `:root`; every step derives from it:
   `xs = base − 2px`, `sm = base − 1px`, `md = base`, `lg = base × 8/7`, `xl = base × 9/7`,
   `2xl = base × 12/7`, `3xl = base × 15/7` — exactly 12/13/14/16/18/24/30 at the default. A test
   pins those values and the ordering at 12 and 17. An application that already sets
   `--zx-text-md` keeps working.
2. **Row height.** `--zx-row-height: calc(var(--zx-control-height) + var(--zx-space-1) + 2px)`
   on `:root` (36px at the default): the single-line height of a data row. Table body rows and
   the kit's single-line rows read it; menus, trees and sidebars keep their control-derived items.
3. **Reading type.** On `:root`: `--zx-font-prose: var(--zx-font-sans)`, `--zx-prose-size:
   var(--zx-text-lg)`, `--zx-prose-leading: 1.7`, `--zx-prose-measure: 62ch`, and
   `--zx-weight-title: 650` (titles and figures; record and document titles read it).
   `styles/prose.css` defines **`.zx-prose`**: the typography of authored content — `h1`–`h4`,
   `p`, lists, `blockquote`, `hr`, links (body colour over a quiet underline, accent on hover),
   inline `code`, `pre`, `kbd`, `mark`, frameless tables with tabular end-aligned cells, `figure`
   and `figcaption`, `img` — with one block gap, more above headings and less below.
   `data-size="sm"` sets it at the interface size (comments, previews); `data-zx-measure="full"`
   drops the measure. Content colour: `mark[data-tone]` and `[data-tone]` spans take the nine
   tone pairs; a bare `mark` is the amber tone. **`.zx-callout`** (in the same file): a neutral
   muted fill by default, `data-kind="info|success|warning|danger"` for status, `data-tone` for a
   category; icon column + body, no frame. Every selector is under `.zx-prose` or `.zx-callout`
   and at zero specificity inside it, so a component placed in prose keeps its own styles.
4. **Receding chrome.** `--zx-color-text-chrome`: `color-mix(in srgb, var(--zx-color-text-muted)
   70%, var(--zx-color-text))`, restated on every theme element (≥ 7:1 on chrome in both
   themes, tested). `--zx-color-border-chrome`: `transparent` in light, `--zx-color-border-subtle`
   in dark and auto-dark, `--zx-color-border` under `prefers-contrast: more`, `CanvasText` under
   forced colours.
5. **Concentric panels.** `--zx-radius-panel: calc(var(--zx-radius-sm) + min(var(--zx-radius),
   var(--zx-space-1) + 1px))` — 6px at the default, 0 when square, exactly concentric with a 4px
   inset at large bases.
6. **Dark depth from light, not shadow.** Dark (and auto-dark) `--zx-surface-shadow` becomes a
   lit top edge with a short contact shadow.
7. **Reveal.** In `base.css`, at zero specificity: `[data-zx-reveal]` inside a
   `[data-zx-reveal-host]` rests at opacity 0 and shows on the host's `:hover`, `:focus-within`,
   `[aria-current]`, `[aria-selected="true"]`, and when it holds an open popup
   (`:has([aria-expanded="true"])`); always shown under the three preferences in rule 8. Hosts do
   not nest.
8. **Kbd.** New `src/components/kbd/`: `kbd(keys, options?)` returns `<kbd class="zx-kbd">` with
   one nested `<kbd class="zx-kbd__key">` per key (the HTML form of a key combination). `keys` is
   `'Mod+Shift+K'` or an array of labels; `Mod`, `Alt`, `Shift`, `Ctrl`, `Enter`, `Escape`,
   arrows and `Backspace` map to platform glyphs (⌘ ⌥ ⇧ ⌃ on Apple platforms, words elsewhere).
   Options: `size: 'sm'|'md'`. The keycap is a surface fill with one hairline and a 1px foot,
   text-xs/500, centred on cap height (`text-box` behind `@supports`), and adapts on solid fills
   (`currentColor` mixes). Exported from `src/index.js`; demo and docs in §5.
9. **Fill under hover in dark.** `base.css`'s default `button:hover` layers the hover fill over
   the control fill, so it is visible where both are 5% white.

## §2a · Overlays and menus (component agent A)

**File scope:** `src/components/{dropdown,menu-button,context-menu,select,tag-picker,launcher,
value-list,entity-ref,tooltip,account-menu,workspace-switcher}/**`, their demos and unit tests.

- Panels: `border-radius: var(--zx-radius-panel)` on Dropdown (MenuButton, ContextMenu), Select's
  listbox, TagPicker's popup, Launcher. Items keep `--zx-radius-sm`. Segmented thumbs inside 2px
  padding: `calc(var(--zx-radius-sm) + 2px)` (`menu-button.css:155`).
- State under hover: Select's chosen option keeps its cursor and selected fill when hovered or
  active; Launcher's current row likewise (a stronger mix, never the plain hover).
- One fill or one line: TagPicker chips (default and coloured), ValueList chips, EntityRef drop
  the border and keep the fill; their remove buttons sit inset (`block-size: calc(100% −
  var(--zx-space-1))`, 2px inline margin) so the hover fill never touches the chip edge.
- Keyboard hints: Launcher's hints use `kbd()`; menus keep their right-aligned shortcut text but
  read the `.zx-kbd` typography (no box) so all hints share one font treatment.
- Counts: `tabular-nums` on menu and launcher badges and counts.
- Faint inks: Select's neutral status icon takes `--zx-color-text-subtle`, not border-strong.

## §2b · Data, navigation and controls (component agent B)

**File scope:** `src/components/{button,check-button,table,table-view,navigation-bar,list-toolbar,
tabbox,calendar,breadcrumb,app-sidebar,app-rail,module-bar,kanban-view,stat-tile,stepper,
view-settings,rating,file-item,questionnaire,badge,avatar}/**` (CSS first; JS only where named),
their demos and unit tests. `src/internal/app-rail.*` if the rail lives there.

- **Table rows read `--zx-row-height`:** a single-line body row is exactly the token, wrapped
  content grows it; checkbox and control cells stay centred; the plain variant too. Sort-header
  hover fill gets an inline inset (`table.css:315`).
- **State under hover:** table selected rows, CheckButton pressed, NavigationBar current,
  ListToolbar pressed keep their fill under the pointer (`:not([aria-…])` on the hover rule, or a
  stronger mix on the stateful one).
- **Open trigger:** `.zx-btn[aria-expanded="true"]` holds its hover/pressed fill for default,
  primary (`--zx-color-accent-solid-hover`) and ghost (`--zx-color-bg-hover`).
- **Dark hover** on CheckButton layered over its control fill (as §1.9).
- **Button shortcut** renders with `kbd()` (`size: 'sm'`) instead of bare text; `title` and
  `aria-keyshortcuts` unchanged. Questionnaire's key hints likewise.
- **Navigation recedes:** AppSidebar and AppRail item labels rest at `--zx-color-text-chrome`;
  hover, focus and current take `--zx-color-text`. Icons follow the label colour.
- **Segmented insets:** ListToolbar, Tabbox (segmented) and Calendar view buttons:
  `max(0px, calc(var(--zx-control-radius) − 3px))`; AppSidebar's thumb `calc(var(--zx-radius-sm)
  + 2px)`.
- **Breadcrumb:** the current item never shrinks before its ancestors; ancestors shrink and fold
  into the existing overflow first.
- **Faint inks:** Stepper's "Optional", StatTile's sparkline, ViewSettings' lock and Rating's empty
  stars move off placeholder/border-strong onto text-subtle or text-muted.
- **Counts:** `tabular-nums` on KanbanView column counts, AppRail and ModuleBar badges.
- **Avatar stack:** KanbanView's overflow chip is opaque (`color-mix` of the text into the
  surface); overlap at most `var(--zx-space-1)`.
- **FileItem:** `--zx-radius-pill` → `--zx-radius-full`.
- **StatTile and title figures** read `--zx-weight-title`.

## §3 · Layout kit and templates (layout agent)

**File scope:** `website/layouts/**`, `tests/unit/layout-*.test.js`, `tests/layouts/**`.

- **Prose:** the wiki article composes `.zx-prose`; delete the duplicated wiki prose rules, keep
  only what is the wiki's own (code head with copy, checklist, mention pill, figure frame, child
  cards). The "release captain" callout is not a status: it becomes a neutral `.zx-callout`. Any
  other layout that renders authored text (issue description, mail body, assistant reply, record
  notes) adopts `.zx-prose` where it is a natural fit.
- **Column edges** read `--zx-color-border-chrome` wherever chrome meets canvas; two columns of
  the same tone keep `--zx-color-border-subtle`.
- **Header rule on scroll:** `.shell__header`'s rule is transparent at rest; the kit sets
  `data-scrolled` on the pane when its body scrolls (passive listener on `context.signal`), and the
  rule fades in. Panes whose header is followed by tabs or a toolbar keep the same behaviour.
- **Navigation rows** in the kit (`.shell__nav .list-row`, section items) rest at
  `--zx-color-text-chrome`.
- **Property lists line up:** one label column per inspector (a custom property set once on the
  aside, used by every `.prop-list`), `align-items: start`, every row at least the control height,
  quiet controls pulled back by `--zx-control-pad-x` so their text shares the static values' edge,
  a quiet NumberField hugs its value so the unit follows it, labels muted, values tabular.
- **CRM:** drop the header-ink override (headers stay muted) and the forced row height (the token
  rules).
- **Titles:** `.record-title`, `.document-title` read `--zx-weight-title`.
- **Avatar stacks** overlap at most `var(--zx-space-1)` with a 2px ring.
- **Keyboard hints:** `kbd()` in `kit.js` delegates to the core `kbd()`; delete `.kbd` styles.
- **Reveal:** section-label actions (the wiki's "+" beside Pages) and repeated per-row actions in
  list rows use `data-zx-reveal-host` / `data-zx-reveal` where rule 8 allows; primary actions stay
  visible.
- Every touched layout passes `tools/shoot-layout.js` and `tools/audit-layout.js` at 1440 and 390,
  light and dark.

## §4 · Theme studio (studio agent)

**File scope:** `website/theme-presets.js`, `website/theme.js`, `website/theme-showcase.js`,
`website/theme.css`, `styles/tokens/themes.css` (the new preset only), `website/site.js` (only if
stored state needs it), `tests/unit/theme-presets.test.js`.

- **Text size writes `--zx-text-base`** (the whole ladder follows).
- **Rows:** a three-way control, Compact / Default / Relaxed, writing `--zx-row-height` as a calc
  on the control height (`+ 2px`, the default `+ space-1 + 2px`, `+ space-3 + 2px`) so rows keep
  following the other settings. Default writes nothing.
- **Reading:** a group with *Reading typeface* (Interface — the default, follows the interface
  stack — or any stack from `FONTS`), *Reading size* (14–20px, default 16) and *Measure* (52–84ch,
  step 2, default 62), writing `--zx-font-prose`, `--zx-prose-size`, `--zx-prose-measure`. The
  showcase gains a short prose specimen (title, paragraph with a link and a mark, a list, a
  callout, a small table) so the group shows its effect.
- **Paper tint:** tints gain a `profile`: `'arch'` (today's — chroma peaks mid-ramp) and `'flat'`
  (a floor of warmth at the near-whites, rising gently towards the darks, tapered below lightness
  0.25 so dark surfaces never read brown). A new `paper` tint (hue ≈ 75) uses it. Tested: muted
  text keeps 4.5:1 on chrome and current rows, and the 500/600 stops stay at or below 0.008
  chroma.
- **Folio preset** — the calm document look: an ink-blue accent derived with `accentRamp()` (low
  chroma, clearly apart from Ocean), the paper tint, the system interface stack with a
  transitional serif for reading, Paper material, default rows, small corners. Its ramp goes into
  `themes.css` and `PRESETS`; every existing invariant test covers it. **Ocean** gains compact rows
  (it is already the precise utility look). Every preset's recipe carries the new keys.
- Export (CSS and JSON), restore, reset and the URL state round-trip the new keys; old stored
  states without them restore to the defaults.

## §5 · Documentation (coordinator)

`docs/llms.md` (theming decisions, Theming section, new `Kbd` and `Prose` sections),
`website/demos/{kbd,prose}.demo.js` registered in `COMPONENT_IDS`, `README.md` (theme paragraph),
`DESIGN-SYSTEM.md` (Shortcut/Kbd is covered). Describe the reading and row dimensions by
character, not by numbers. Report changelog lines.

## Out of scope (follow-ups named by the review)

- One view bar: saved views, filter/sort/view and search on one row in `overview.js` (this branch
  is aligning the overview; do it after).
- Row actions as API: `rowActions` on Tree, `actions` on AppSidebar items, heading anchors.
- `displayFormat` on Datebox (one date format per screen).
- Named icon sizes per role in `src/core/icons.js` (chevron, dismiss, check drift from 7 to 16px).
- Focus-ring contrast (the 45% ring is about 2:1 on white) — a separate accessibility WP.
- One chip shape across Badge and TagPicker; an Edge/Elevation studio dimension; `light-dark()`
  so `:root` colour overrides reach nested theme regions; reserving bold width on selected tabs.

## Verification

`npm test` green (report the count before and after). `tools/shoot-layout.js` and
`tools/audit-layout.js` on wiki, crm, record-page, issue-tracker, dashboard and
settings-workspace at 1440 and 390, light and dark, plus `--preset ocean` and the new preset on
two of them. `theme.html` in both themes with the new controls exercised. No console errors on
`docs.html#components/kbd` and `#components/prose`.
