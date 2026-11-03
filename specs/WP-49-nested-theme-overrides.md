# WP49 — Nested theme overrides: one colour declaration that reaches every region

Xenon lets a region differ from its page: `data-zx-theme` on any element starts a light, dark, or
auto region, and the docs promise that "a dark panel inside a light application is just another
attribute". Geometry already composes with that promise — WP38 moved every non-colour token to
`:root`, so `:root { --zx-control-height: 28px }` reaches every nested region. Colour does not. The
colour roles are restated on every `[data-zx-theme]` element (`styles/tokens/semantic.css`,
`styles/tokens/dark.css`), and a custom property resolves where it is declared, so an application's
`:root` override of a colour role stops at the first nested theme element — of either polarity.
The theme studio's export, which `website/site.js` writes to `:root`, inherits the gap: a material
recipe half-applies inside a nested region. A review of the theming API during WP45 named it; this
WP closes it with `light-dark()` and a per-element `color-scheme`, so an application declares a
colour override once and it reaches light, dark, auto, and nested regions alike.

Work in the current checkout, on top of WP45–WP47 (`feat/wp45-calm-and-precise` at `8ba5cd0` or
later). **Do not commit**: this lands after central review. `AGENTS.md`, the WP40 design rules and
WP42 (every layout from 390px to 1440, clean under `tools/audit-layout.js`) apply. This WP
explicitly permits changes to `styles/tokens/semantic.css` and `styles/tokens/dark.css`.
`styles/tokens/global.css`, `themes.css`, `styles/base.css`, `styles/print.css` and `src/core/**`
are **not** in scope. `CHANGELOG.md` and `docs/api.json` are central: report changelog lines
instead of writing them. Public files (source comments, demos, docs) must not mention this spec or
any other internal material; `tools/check-site.js` enforces it.

## Review: colour overrides today

Measured in Chrome against the shipped token stylesheets, with `:root { --zx-color-bg-surface:
rgb(1 2 3) }` and the Smoke material recipe applied to `:root` on a light page:

| Region | `--zx-color-bg-surface` | `--zx-color-overlay-surface` | `--zx-glass-filter-overlay` |
|---|---|---|---|
| the page itself | the override | Smoke | Smoke |
| nested `data-zx-theme="light"` | **stock white** | **stock glass** | Smoke |
| nested `data-zx-theme="dark"` | stock dark | **stock glass** | Smoke |
| nested `data-zx-preset="rose"` alone | the override | Smoke | Smoke — **but the accent stays the page's** |

1. **An override stops at every nested theme element, even one of the same polarity.** The light
   block is declared on `:root, [data-zx-theme="light"]` and the derived block on `:root,
   [data-zx-theme]`, so each nested theme element re-declares the stock value over the inherited
   override.
2. **Materials half-apply.** A recipe's filters are geometry (on `:root` only) and survive; its
   colours are restated per theme element and revert. Deep glass and Smoke look like Glass inside a
   nested dark panel, with Smoke's blur.
3. **A per-polarity override is three blocks.** To override one role for both appearances an
   application writes `:root, [data-zx-theme="light"]`, `[data-zx-theme="dark"]`, and the
   `[data-zx-theme="auto"]` twin under `prefers-color-scheme: dark` — and then every role derived
   from it as well, because the derived block is resolved per element from the stock values. The
   documented "product theme" pattern (`[data-zx-theme="acme"]`) only half-works for the same
   reason: its accent reaches the focus ring (derived block) but not the selected fill or the
   accent tint (light block).
4. **A nested preset needs a theme attribute beside it.** `data-zx-preset` repoints the accent
   ramp, but the roles that read the ramp are only re-resolved on theme elements.

What works and stays: geometry on `:root` only (WP38, `tests/unit/geometry-tokens.test.js`); the
seven presets as five ramp declarations; every contrast invariant in
`tests/unit/theme-presets.test.js`; the preference fallbacks at the token seam (reduced
transparency, increased contrast, forced colours) and the no-`backdrop-filter` capability fallback,
all declared with `!important` on `:root, .zx-scope, [data-zx-theme], [data-zx-preset]`; `auto`
following the operating system; print.

## Baseline

`light-dark()` is Baseline 2024: Firefox 120 (November 2023), Chrome and Edge 123 (March 2024),
Safari 17.5 (May 2024). `AGENTS.md` sets the baseline at "evergreen ~2023+", and the failure mode
without a guard is total — a browser that does not parse `light-dark()` drops every colour role at
use time and renders the library unstyled. So the new mapping sits behind
`@supports (color: light-dark(#000, #fff))`, and today's blocks stay, value for value, under
`@supports not (…)` as the fallback. The fallback keeps today's behaviour exactly, gaps included.

## Decisions

1. **Every colour role is declared once, on `:root`.** Where light and dark agree, the value is
   written once; where they differ it is `light-dark(<light>, <dark>)`, with today's two values as
   the arguments. Roles derived from other roles (hover, current, glass and overlay tiers, tone
   tints, the focus ring) keep their one formula and are not restated anywhere: the reference is
   substituted on `:root`, the `light-dark()` inside it travels with the inherited value, and each
   element picks its branch from its own `color-scheme`.
2. **A theme element declares only `color-scheme`.** `:root, [data-zx-theme="light"]` → `light`,
   `[data-zx-theme="dark"]` → `dark`, and `[data-zx-theme="auto"]` → `dark` under
   `prefers-color-scheme: dark`, exactly the conditions today's blocks use. These rules are
   unconditional; they were already part of today's blocks.
3. **`auto` keeps today's semantics, including its nested edge.** An auto region inside a dark
   region on a light system stays dark today (nothing re-declares light there); `color-scheme:
   light dark` would turn it light. That is arguably more correct, but it is a behaviour change
   this WP does not make. Named as a follow-up. The one place the two paths still differ is that
   region: the fallback restates the every-theme block on the auto element with the light
   formulas (a 4.5% hover over dark text), a hybrid; the single mapping paints the dark theme
   whole. The equivalence test names and skips it.
4. **Shadows are one list per role.** `light-dark()` chooses a colour, not a shadow list. Two
   shadow roles keep their shape across themes (`--zx-glass-control-shadow`,
   `--zx-glass-chrome-shadow`) and take `light-dark()` per layer. Three change shape
   (`--zx-surface-shadow`, `--zx-overlay-shadow`, `--zx-drag-shadow`): each becomes the union of
   both layer lists, every layer coloured `light-dark(<colour>, transparent)` or the reverse, so
   each theme paints exactly today's layers and the other theme's layers are transparent. Tier-1
   `--zx-shadow-1/-3` stay in the palette; the light layers restate their values.
5. **A preset element re-declares the roles that read the accent ramp.** The fourteen roles whose
   value reads `--zx-accent-*`, directly or through another role (the accent family, the solid
   accent, `--zx-color-bg-selected`, `--zx-color-ring`, `--zx-focus-ring`,
   `--zx-color-overlay-selected`, and the three overlay images, which carry a faint accent
   caustic), sit in one block on `:root, [data-zx-preset]`. A nested preset now rethemes on its own
   or beside a theme attribute. The consequence is documented: inside a nested preset region the
   preset decides those fourteen roles, and an application that overrides one of them and wants it
   to reach a nested preset too adds `[data-zx-preset]` to its selector. A test computes the
   closure from the stylesheet and fails if the block and the closure differ.
6. **Colour roles are never registered with `@property`.** A registered `<color>` computes
   `light-dark()` where it is declared — on `:root`, in light — which is this bug again. Stated in
   the stylesheet header.
7. **Script that reads a colour token as text resolves it.** `getPropertyValue('--zx-color-text')`
   now returns `light-dark(…)`, which a canvas cannot parse (verified: `fillStyle` ignores it).
   Chart's theme defaults read the colour through a probe's computed `color` instead; the Design
   tokens demo shows the resolved colour. The layout kit already resolves through a probe.
8. **The studio export and `site.js` are unchanged.** They write `:root`, which is now the right
   place: the recipes compose the per-theme ingredients, and those resolve per region.

## Scope

**Files:** `styles/tokens/semantic.css`, `styles/tokens/dark.css`, `src/components/chart/chart.js`
(theme colour defaults only), `website/demos/tokens.demo.js`, `tests/unit/tokens.test.js`,
`tests/unit/theme-presets.test.js`, `tests/unit/geometry-tokens.test.js`, a new
`tests/unit/theme-tokens.js` (shared parsing, not a test file), a new
`tests/unit/colour-overrides.test.js`, `tools/run-smoke.js`, `docs/llms.md` (Theming),
`website/docs.html` (Theming), `README.md` (Themes).

### §1 · Tokens

- `semantic.css`: geometry block unchanged; the three `color-scheme` rules; under
  `@supports (color: light-dark(#000, #fff))` one `:root` block with every colour role that does
  not read the accent ramp and one `:root, [data-zx-preset]` block with the fourteen that do, the
  explanatory comments moved here from both themes; under `@supports not (…)` today's light block
  and derived block, values unchanged; the capability and preference fallbacks unchanged and still
  after both paths.
- `dark.css`: today's dark block and its auto twin, values unchanged, under `@supports not (…)`.
  The header says what the file now is: the dark half of the fallback.

### §2 · Consumers

- Chart: `themeChartOptions()` resolves `--zx-color-text` and `--zx-color-border` through a
  hidden probe inside the chart root (`getComputedStyle(probe).color`), removed straight after.
- Design tokens demo: each colour card shows the computed colour of its swatch.

### §3 · Tests

- `tests/unit/theme-tokens.js` parses the modern blocks and the fallback blocks, and resolves
  `light-dark()` to a branch. `tokens.test.js` and `theme-presets.test.js` read the light and dark
  mappings through it, so every existing contrast test runs against the new source.
- Structure (no browser): every role in the modern blocks has a fallback counterpart and vice
  versa; the fallback dark and auto lists stay one list; no `[data-zx-theme]` rule declares a
  colour role on the modern path; the preset block equals the accent closure; no `@property`
  registers a colour role; the geometry test still sees the fallback theme blocks (only the
  `backdrop-filter` `@supports` is a capability fallback).
- `tests/unit/colour-overrides.test.js` (Chrome via `playwright-core`, skipped where none is
  installed, like the geometry browser test):
  - a `:root` override — a plain colour, a `light-dark()` pair, a derived role, a shadow, and the
    Smoke recipe — reaches a nested region of the other polarity and of the same polarity, from a
    light page and from a dark page, and under `auto` with the system in either preference; inside
    a nested dark region the recipe computes what it computes on a dark page;
  - a nested `data-zx-preset` rethemes the accent, ring, and selected fill, with and without a
    theme attribute;
  - the fallback paints what the modern path paints: the same stylesheets with the `light-dark()`
    condition made false compute the same value for every role (colours and shadows, transparent
    layers aside) in light, dark, auto under both preferences, and nested regions without
    overrides;
  - reduced transparency, increased contrast, and forced colours still win inside a nested region
    over a `:root` override.
- `tools/run-smoke.js`: the theme studio check opens a nested dark scope on a light page with the
  Smoke material and requires the overlay surface there to match a dark page's.

### §4 · Documentation

- `docs/llms.md` and `website/docs.html`, Theming: an **Override once** paragraph — declare a
  colour role on `:root`, with `light-dark(<light>, <dark>)` where the appearances differ; it
  reaches every light, dark, auto and nested region; a nested preset decides the accent roles;
  derived roles follow a base override; browsers before 2024 get the per-theme fallback, so an
  application that must support them guards its own `light-dark()` the same way.
  The product-theme example becomes a `:root` block with `light-dark()` pairs plus a preset for
  the accent, replacing `[data-zx-theme="acme"]`.
- `README.md`: the same example and one sentence.

## Out of scope

- Nested `auto` inside a dark region on a light system (decision 3).
- Dropping the fallback once the baseline moves past 2024: delete the `@supports not` blocks and
  `dark.css`, and the equivalence test with them.
- The theming docs' "Where the current theme comes from" paragraph still describes the pre-WP46
  three-pixel translucent focus ring.
- `website/theme-presets.js` says the stylesheet "restates" the glass ingredients per theme; it
  now declares each once, as a pair.
- Studio UI for per-polarity overrides.

## Verification

`npm test` (report the count before and after) and `npm run test:browser` green. `node
tools/shoot-layout.js` clean on crm and wiki at 1440 in light and dark under two presets (the
default and Ocean), and at 390. `website/theme.html` in both themes with every material. `dist/`
rebuilt and `dist/zx.css` checked to keep `light-dark()` and both `@supports` blocks.
