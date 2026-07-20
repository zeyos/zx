# WP12 — Carbon-inspired visual polish: line tabs, notification close, Font Awesome icons

Branch: work directly on `main` (single cohesive package, orchestrator reviews before push).
Read `AGENTS.md`. Design reference: IBM Carbon Design System (carbondesignsystem.com) —
we borrow its *patterns* (line tabs, notification anatomy, ghost icon buttons, restrained
radii), not its tokens or assets. User-reported problems driving this WP:

1. Tabbox tabs look like buttons, and a scrollbar appears that should not be there.
2. The Message toast close button is badly formatted.
3. Icons should be Font Awesome.

## Scope

```
src/core/icons.js                       # replace path set with Font Awesome Free (solid)
src/components/tabbox/tabbox.css        # Carbon line-tab restyle
src/components/navigation-bar/navigation-bar.css  # align with the same line-tab language
src/components/message/message.css      # notification anatomy + ghost close button
styles/base.css                         # scope scrollbar-gutter properly (see below)
(any component CSS that styled icons assuming stroke rendering — sweep and adjust)
```

## 1. Icons → Font Awesome Free (solid)

Replace the hand-drawn stroke paths in `src/core/icons.js` with **Font Awesome Free 6 solid**
SVG path data, embedded inline (the library stays dependency-free — no webfont, no CDN, no
npm package):

- Header comment: `Font Awesome Free 6 icons (fontawesome.com), CC BY 4.0 —
  https://fontawesome.com/license/free. Path data embedded unmodified.`
- FA solid icons are FILLED, not stroked: `icon()` must emit
  `fill="currentColor"` and NO stroke attributes; per-icon viewBox as published by FA
  (e.g. `0 0 448 512`, `0 0 512 512` — store `[viewBox, path]` per icon).
- Keep the exact public API (`icon(name, {size, label})`, `icons`, aliases) and every
  existing name: chevron-down/up/left/right, check, x (fa xmark), plus, minus, search
  (fa magnifying-glass), calendar, clock, trash (fa trash-can), gear, eye, lock, reload
  (fa rotate-right), list, filter, dots (fa ellipsis), info (fa circle-info), warning
  (fa triangle-exclamation), error (fa circle-exclamation), success (fa circle-check),
  upload, drag (fa grip-vertical) + the legacy aliases.
- Use the real FA path data (you know these paths; if unsure for one, pick the closest FA
  solid glyph — do NOT invent new artwork).
- Sweep consumers: grep component CSS/JS for `stroke` assumptions on `.zx-*` svg styling and
  adjust (sizes stay 16px default; optically FA glyphs are denser — where an icon sits in a
  control, verify 12–14px sizing may fit better and adjust the call sites' `size` option,
  e.g. select chevron, datebox calendar, search glass, toast close x).

## 2. Tabbox — Carbon "line tabs"

Current problems: tabs are raised bordered boxes (button look); tablist has `overflow-x: auto`
which, combined with the global `scrollbar-gutter: stable`, reserves a permanent scrollbar.

Restyle `.zx-tabbox` to Carbon line-tab anatomy:
- Container: NO outer border, NO radius, transparent background (the tabbox no longer draws
  a card around itself — panels sit directly under the tab line). Remove the container
  border/background/radius rules.
- Tablist: single 1px bottom border (`--zx-color-border`), no background, no gutter
  scrollbar: replace `overflow-x: auto` with `overflow-x: auto; scrollbar-width: none;`
  + `::-webkit-scrollbar { display: none }` (keyboard arrows already provide access) and
  set `scrollbar-gutter: auto` on the tablist to override the base rule.
- Tab: borderless, transparent, `padding: 0 var(--zx-space-4)`, height
  `calc(var(--zx-control-height) + 4px)`, muted text; a 2px transparent bottom border in the
  same box (sitting on the tablist border).
  - Hover: text color full, bottom border `--zx-color-border-strong`.
  - Selected: text full + font-weight 600, bottom border 2px `--zx-color-accent`.
  - Disabled: `--zx-color-text-placeholder`, no hover.
  - Focus-visible: the standard focus ring, inset.
  - Badge stays as a small counted pill; close × on closable tabs becomes a small ghost icon
    (see §3 pattern) using the FA xmark at 12px.
- Panel: no border/radius of its own; `padding-block-start: var(--zx-space-4)`. When the
  tabbox has a `height` option, the PANEL scrolls (`overflow-y: auto`), never the tablist.
- NavigationBar items adopt the same underline language (it already renders a tablist-like
  bar — align hover/active/underline styles; keep its bar background).

## 3. Message — Carbon notification anatomy + ghost close

Restyle `.zx-message__toast`:
- Grid: `[icon] [content] [close]` with `align-items: start`; kind icon 16px aligned with the
  first text line; 3px solid kind-colored left border (keep); background kind `-bg` token
  (keep); `border-radius: var(--zx-radius-sm)` only.
- Close button = **ghost icon button**: 32×32 hit area, transparent background, NO border,
  NO shadow, the FA xmark at 14px in `--zx-color-text-muted`; hover: `--zx-color-bg-hover`
  background + full text color; focus-visible ring; `aria-label` kept. It must sit flush in
  the top-right with `margin: 2px 2px 0 0` and never stretch the toast height.
- Progress variant and inline Message get the same close treatment.
- Add the same ghost-icon-button pattern as a small shared CSS utility class
  `.zx-icon-btn` in `styles/base.css` and reuse it in message close, closable tab ×,
  datebox clear ×, select clear × (sweep those call sites to add the class; do not change
  their JS behavior).

## 4. base.css scrollbar-gutter

`scrollbar-gutter: stable` currently applies too broadly (line ~16) and reserves gutters in
places that never scroll. Scope it to intentional scroll containers only (e.g. a
`.zx-scroll` utility + the known scrollers: table scroll container, select listbox, checklist
list, tabbox panel-with-height, master-panel content) and remove the broad rule. Verify no
layout shift regressions in the demos.

## Acceptance criteria

1. `node --test tests/unit/*.test.js` and `node tests/lint-tokens.js` green (icon aliases
   keep passing; no raw colors added).
2. Demos: Tabbox shows Carbon-style line tabs — no borders around tabs, no visible scrollbar
   in the tab row (macOS "always show scrollbars" case covered by scrollbar-width: none);
   selected tab = green underline + semibold.
3. Message demo: toast close button is a borderless ghost icon button, correctly aligned;
   warning/error/success/info all aligned identically.
4. Icon gallery (kernel demo) renders every name as a filled FA glyph; select chevron,
   search glass, datebox calendar, picker nav arrows all look correct at their sizes.
5. Light/dark × cozy/compact clean across tabbox, message, select, datebox demos.
6. `tests/smoke/smoke.html` still 33/33 (window.__zxSmoke).
7. `npm run build` succeeds.
8. git commit when green.

## Out of scope

New components; token renames; behavioral/JS changes beyond icon call-site size tweaks and
adding the .zx-icon-btn class to existing buttons.
