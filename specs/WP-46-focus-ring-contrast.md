# WP46 — Focus ring contrast: one quiet line that clears 3:1

Xenon's keyboard focus indicator is a soft accent halo: `--zx-focus-ring` is
`0 0 0 3px color-mix(in srgb, var(--zx-color-ring) 45%, transparent)`, declared in
`styles/tokens/semantic.css` and restated in `styles/tokens/dark.css` and its `auto` twin. It is
visible, but it is not a contrast-compliant indicator. A focus indicator is non-text contrast and
needs 3:1 against what it sits on; the halo measures 1.7–2.3:1 in light and 2.0–3.1:1 in dark across
the seven presets, and is lowest exactly where focus most often lands — a current row in the chrome
column. WP45 named this as a separate accessibility follow-up. This WP makes the indicator clear 3:1
against every surface it sits on, in both themes, under every preset, without making it loud: the
product direction is quiet chrome and small corners, so the answer is a thinner, crisper line, not
a heavier outline.

Work in the current checkout, on top of WP45 (it supplies the Folio preset that makes seven, the
`--zx-color-text-chrome` role, and the paper tint the tests sweep). **Do not commit**: this lands
after central review. `AGENTS.md`, the WP40 design rules (small corners, no edge bars, one solid
accent), and WP42 (every layout from 390px to 1440, clean under `tools/audit-layout.js`) apply. This
WP explicitly permits changes to `styles/tokens/semantic.css` and `styles/tokens/dark.css` (the two
focus tokens and the file headers only). `styles/base.css` and `src/core/**` are **not** in scope.
`CHANGELOG.md` and `docs/api.json` are central: report changelog lines instead of writing them.
Public files (source comments, demos, docs) must not mention this spec or any other internal
material; `tools/check-site.js` enforces it.

## Review: the focus indicator today

What exists and works:

- **One token, consumed everywhere.** About 145 rules across components, the layout kit, the
  templates, and the website read `--zx-focus-ring`; 26 of them draw it inside the element as
  `box-shadow: inset var(--zx-focus-ring)` (tabs, table cells, card-view cards, list rows, panel
  headers), and a few list it beside another shadow (`var(--zx-focus-ring), var(--zx-drag-shadow)`).
- **The colour follows the accent per theme.** `--zx-color-ring` is `--zx-color-accent`: the 600
  stop in light and the 400 stop in dark. The ramp promise (`tests/unit/theme-presets.test.js`)
  already guarantees 600 at 4.5:1 on white and 400 at 4.5:1 on every dark surface step, for every
  shipped preset and every ramp the studio derives.
- **Forced colours.** `styles/base.css` keeps a transparent 2px outline on every `:focus-visible`
  element, and under `forced-colors: active` paints it in `Highlight`, because forced colours drop
  box shadows. Components never remove the outline; `tests/lint-tokens.js` enforces it.

The gaps:

1. **Below 3:1 everywhere in light, and most places in dark.** Measured with the test file's own
   resolver (premultiplied `color-mix`, composited over the painted background):

   | Theme | Lowest | Where | Highest |
   |---|---|---|---|
   | light | 1.72 (folio) | a current row in the chrome | 2.34 (rose, surface) |
   | dark | 1.95 (rose) | a current row on the canvas | 3.07 (zeyos, chrome) |

2. **Translucency cannot fix it quietly.** Raising the alpha until every case passes needs 85% for
   Folio and 87% for the worst derived ramp in light: a translucent ring that is opaque in all but
   name.
3. **Nothing checks it.** The tests pin text, muted, subtle, chart, tone and status contrast, but
   not the focus indicator.

## Decisions

- **One opaque 2px line in the accent.** `--zx-focus-ring: 0 0 0 2px var(--zx-color-ring)`, in
  light, dark, and auto-dark. Opaque, the ring inherits the ramp promise: at least 3.8:1 under every
  shipped preset and tint, and at least 3.5:1 for any derived ramp. 2px is the smallest indicator
  whose area matches a 2px perimeter (the focus-appearance measure) and reads as a precise line
  rather than a halo; the old ring was 3px of a pale wash. The colour role `--zx-color-ring` is
  unchanged.
- **One shadow, so `inset` keeps working.** The token stays a single shadow. `inset` applies only to
  the first shadow of a list, so a two-layer recipe (an offset gap plus a ring) would break every
  inset consumer or need a second inset role and a migration of 26 rules — and a gap colour
  can only be right on one background. No consumer migrates.
- **An accent fill gets a line of its own ink.** Around an element that is itself an accent fill, an
  accent ring only makes it look 2px larger. Such a component composes
  `inset 0 0 0 1px var(--zx-color-on-accent-solid), var(--zx-focus-ring)` (or `--zx-color-on-accent`
  for a `--zx-color-accent` fill): ring, then the fill's own edge, then a hairline of its ink. The
  composition lives in the component; no new token.
- **Forced colours unchanged.** `styles/base.css` is not touched.

## §1 · Tokens

**Scope:** `styles/tokens/semantic.css`, `styles/tokens/dark.css`.

- `--zx-focus-ring: 0 0 0 2px var(--zx-color-ring);` in the light block (`:root, [data-zx-theme]`),
  the dark block, and the `auto` dark block. `--zx-color-ring` stays `var(--zx-color-accent)` in
  all three.
- A short comment on the light declaration says what the ring is and why it is one shadow; the
  semantic file header's "3px translucent focus ring" becomes "2px accent focus ring".

## §2 · Accent fills

**Scope:** `src/components/button/button.css`, `src/components/calendar/calendar.css`,
`src/components/date-picker/{date-picker,date-range-picker,time-picker}.css`,
`website/layouts/agent-chat.layout.css`, `website/layouts/ai-chat.layout.css`.

Every focusable element whose own fill is the accent or the solid accent, found by sweeping every
component demo, `theme.html`, and every layout in both themes:

| Element | Fill | Inner line |
|---|---|---|
| `.zx-btn[data-kind="primary"]` | solid accent | `--zx-color-on-accent-solid` |
| `.zx-calendar__new` | solid accent | `--zx-color-on-accent-solid` |
| `.zx-date-picker__day[aria-selected="true"]` | accent | `--zx-color-on-accent` |
| `.zx-date-range-picker__day` at the range start and end | accent | `--zx-color-on-accent` |
| `.zx-time-picker__mark[aria-checked="true"]` | accent | `--zx-color-on-accent` |
| agent-chat's send button, when ready | solid accent | `--zx-color-on-accent-solid` |
| ai-chat's send button, when ready | solid accent | `--zx-color-on-accent-solid` |

Each gets a `:focus-visible` rule with the composed shadow, after its plain focus rule. The table's
row checkbox needs none: its transparent slack border already holds the ring 4px off the fill.

## §3 · Tests

**Scope:** `tests/unit/theme-presets.test.js`.

Using the file's existing resolver (`tokensFor`, `resolve`, `over`, `paint`, `currentRow`,
`splitArgs`, `contrast`, `atLeast`):

- `--zx-focus-ring` parses as exactly one `0 0 0 <n>px <colour>` shadow, `n ≥ 2`.
- The ring colour, composited over each background, reaches 3:1 against it on: page, chrome,
  surface, raised, a current row in the chrome, a current row on the canvas, and a selected row —
  for all seven presets in both themes, and again under every tint at its own strength and at the
  maximum.
- The same holds for a derived ramp at every 15° of hue, as the ramp promise is checked.
- The five component rules of §2 compose the inner line before the ring.

## §4 · Documentation

**Scope:** `docs/llms.md` (Theming section).

A **Focus** paragraph: the ring is one 2px line in the accent that clears 3:1 on every surface and
row, in both themes, under every preset, tint, and conforming custom ramp; one shadow, so it works
plain and `inset`; how to list it with other shadows; the inner line on accent fills; the
transparent outline that forced colours paint; and what a product that restyles the ring must keep.
`--zx-color-ring` joins the overridable semantic roles.

## Out of scope

- Native checkboxes and radios drawn by the browser (`accent-color`), such as card-view's
  selection box: the ring cannot be separated from a native widget's fill without restyling it.
- A thicker ring under `prefers-contrast: more`.
- Tone-coloured solid tiles (ModuleBar's solid appearance, AppIcon): their fill is a tone, not the
  accent, and the ring stays distinct from it.
- Any change to `styles/base.css` or the forced-colours behaviour.

## Acceptance criteria

1. `npm test` and `npm run test:browser` pass; `git diff --check` is clean.
2. The §3 tests pass, and fail when the token is restored to the 45% ring (1.96:1 on the light page)
   or turned into a list of shadows.
3. `node tools/audit-layout.js <id>` reports no problems for crm, wiki, and record-page at 1440 and
   390, light and dark.
4. `styles/base.css` is unchanged by this WP.
5. Both themes checked by eye: the ring on page, chrome, surface, raised, current and selected rows,
   and on each element of §2, under the default preset and Folio (light) and Rose (dark).
