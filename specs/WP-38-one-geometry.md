# WP38 — One geometry: no density modes, tighter corners and indents, spacing in the theme

Xenon has two view modes, cozy and compact (`data-zx-density`). They double every visual check,
complicate nested scopes (a cozy island inside a compact page cannot be expressed), and leave the
choice of spacing to the end user instead of to whoever designs the product. They go. In their
place: one geometry with a slightly tighter default, and spacing as a theme setting beside radius,
control height, and text size in the theme studio.

At the same time the geometry gets quieter: smaller corner radii throughout, and less indentation
and padding in structured menus (AppSidebar, TreeView, menus, listboxes).

Work in the current checkout. **Do not commit.** This is a breaking change for applications that
set `data-zx-density`; it ships in the next major release, noted under "Unreleased" in
`CHANGELOG.md`.

## Shared rules

`AGENTS.md` applies. This WP explicitly permits changes to `src/core/overlay-host.js` (the scope
selector) and to `styles/tokens/**`. Run `node --test` and `node tests/lint-tokens.js` before you
start (baseline 734 passing) and after. Check visually with `website/theme.html` (every component
family at once, light and dark, all six presets) through your own headless script — do not use the
shared browser pane, which another agent is using.

## §1 · Remove density (library agent)

**File scope:** `styles/**`, `src/**`, `docs/llms.md`, `docs/llms.txt`, `docs/DESIGN-NOTES.md`,
`README.md`, `CHANGELOG.md`, `website/site.js`, `website/theme.html`, `website/theme.js`,
`website/theme-presets.js`, `website/theme-showcase.js`, `website/theme.css`, `website/docs.html`
(guide prose only), `website/index.html` (copy only), `website/llms.txt`, `website/demos/**`,
`tests/unit/**` (except `layout-*.test.js`), `tests/smoke/**`, `.claude/skills/zx/SKILL.md`.
Not yours: `website/docs.js`, `website/docs.css`, `website/layouts*`, `website/layouts/**`,
`website/README.md`, `tools/**`, `AGENTS.md`, `tests/layouts/**`.

1. **Tokens.** Delete `styles/tokens/density.css` and its import. One set of values:
   - Spacing derives from one unit: `--zx-space-unit: 4px` and `--zx-space-1 … -8` as
     `calc(var(--zx-space-unit) * n)` with n = 1, 2, 3, 4, 5, 6, 8, 10 (today's 4/8/12/16/20/24/32/40
     at the default unit).
   - Radius derives proportionally from one base so a theme can scale it: `--zx-radius: 4px`,
     `-sm` ×0.5, `-md` ×0.75, `-lg` ×1, `-xl` ×1.5 (2 / 3 / 4 / 6px by default; today 3 / 5 / 7 /
     11). `--zx-control-radius` stays `var(--zx-radius-lg)`.
   - `--zx-control-height: 30px` (from 32), `--zx-control-pad-x: 10px`. Text sizes unchanged.
   - Remove `[data-zx-density]` from every selector list (`semantic.css` forced-colours blocks,
     `overlay-host.js` `SCOPE_SELECTOR`), every `[data-zx-density="compact"]` rule in component
     CSS (AppSidebar, Kanban, Calendar, …), and every comment that explains density.
2. **Structured menus get tighter.** Measured at the new defaults, aim for:
   - AppSidebar: item height = `--zx-control-height` (not + space-2); child indent one icon
     column less than today (children align under the parent's label, not further); group gap
     `--zx-space-3`; row gap 2px; item radius `--zx-radius-md`. Rail and flyouts follow.
   - TreeView: indent per level 12px; row padding `--zx-space-1` block.
   - Menus (MenuButton / ContextMenu / Dropdown menus), Select / TagPicker / Launcher listboxes,
     Finder columns: item padding `--zx-space-1` block × `--zx-space-2`… `-3` inline, panel padding
     `--zx-space-1`, panel radius `--zx-radius-lg`, item radius `--zx-radius-sm`; section labels in
     menus no taller than an item.
   - Anything that hard-codes a large radius (`--zx-radius-xl` on panels, cards, popovers, the
     account menu, chips) is reviewed: surfaces use `-lg`, controls `-md`/control radius, pills
     only where a pill is the meaning (badges, avatars, toggles).
   Check every component family in `theme.html` light and dark; nothing may clip, misalign, or
   lose its focus ring.
3. **Theme studio.** The Density section becomes **Spacing**: a slider for the spacing unit
   (3–6px, step 0.5, default 4) written as `--zx-space-unit`. The radius slider sets `--zx-radius`
   in px (0–10, default 4). The six standard recipes drop `density` and carry `spacing` instead
   (compact recipes ≈3.5, roomy ones ≈4.5). Copy CSS exports the unit. Persisted state with an old
   `density` field still loads (it is ignored).
4. **site.js.** `window.zxTheme` loses density: no `data-zx-density` attribute, no density key in
   its state; remove the `zx-docs-density` storage key (and delete a stored value once, so it
   cannot linger). Anything that calls a density setter elsewhere is being removed by §2 in
   parallel — do not fail if it is still called during the transition (accept and ignore it).
5. **Docs and tests.** Update `README.md` ("Themes and density" → "Themes"), `docs/llms.md`,
   `docs/llms.txt`, `website/llms.txt`, the Theming guide in `docs.html`, the skill file, and
   `CHANGELOG.md` (Unreleased → Breaking: density removed, with the migration: drop the attribute;
   to tighten an application set `--zx-space-unit` and `--zx-control-height`). Update or delete
   tests that assert density; add one that `styles/zx.css` no longer imports a density file and
   that no stylesheet under `styles/` or `src/` mentions `data-zx-density`.

Report: what changed per area, before/after measurements for AppSidebar and TreeView, the
screenshots you checked, and test counts.

## §2 · Gallery and documentation chrome (gallery agent)

**File scope:** `website/layouts.html`, `website/layouts.js`, `website/layouts.css` (below the
`@import` block), `website/layouts/patterns.css`, a new standalone view page (`website/layout.html`
+ its script), `website/docs.js`, `website/docs.css`, `website/README.md`, `tools/run-smoke.js`,
`tools/check-site.js`, `tests/unit/layout-gallery.test.js`. Not yours: anything in §1's scope,
`website/layouts/*.layout.*`, the kit, `tools/shoot-layout.js`, `tests/layouts/**`, `AGENTS.md`.

1. **No density anywhere in the chrome.** Remove the docs density switcher (and its styles) and
   the popup's Cozy/Compact switch, and any per-mount density scoping in `layouts.js`.
2. **Cards without chips.** Remove the component chips from the gallery tiles. The tile is the
   thumbnail, the category, the title, and the blurb; give the freed space back so the grid reads
   calmer (and drop chip-only CSS and filter logic that only existed for them, but keep filtering
   by title, blurb, and category).
3. **Open in a separate tab.** A standalone page, `layout.html#<id>`, renders one layout filling
   the whole window — no gallery chrome around it beyond a slim bar with the title, "Source",
   "All layouts" (back to `layouts.html`), and the theme toggle — so a layout can be used like an
   application in its own tab. It mounts with a normal (non-preview) context, re-mounts on
   `hashchange`, and shows a clear message for an unknown id. Offer it in two places: an
   "Open in new tab" button in the popup header (a real link with `target="_blank"` and
   `rel="noopener"`), and a secondary icon link on each tile (keyboard-reachable, with an
   accessible name, not nested inside the tile's button). The page's `<title>` is
   "<Layout> — Layouts — ZeyOS Xenon Design System". It loads the same stylesheets as the gallery.
4. **Smaller corners in the chrome** to match §1: tiles, popup, and source view use
   `--zx-radius-lg` or less.
5. `tools/check-site.js` requires the new page; `tools/run-smoke.js` opens one layout through it
   (no console errors, a `.shell` or `.layout-frame` fills the window, unknown id handled) and
   drops any density assertions; `tests/unit/layout-gallery.test.js` covers the new contracts.
   `website/README.md` describes the standalone page and drops density.

Report: what changed, screenshots (gallery light/dark, popup header, standalone page), test
counts, and anything that depended on §1 landing.
