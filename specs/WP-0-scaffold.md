# WP0 — Repository scaffold, design tokens, demo harness

Branch: `wp0-scaffold` (create from the current empty `main`; make an initial commit
"chore: repo scaffold" — if `main` has no commit yet, commit directly on `main` and skip the branch).

Read `AGENTS.md` first — it is the binding contract.

## Scope (files to create)

```
package.json  .gitignore  README.md
styles/tokens/global.css  styles/tokens/semantic.css  styles/tokens/dark.css
styles/tokens/density.css  styles/tokens/modules.css
styles/base.css  styles/zx.css
src/index.js                 # placeholder exporting nothing yet, with JSDoc header
demos/index.html  demos/harness.js  demos/harness.css
demos/components/tokens.demo.js
tests/lint-tokens.js
tests/unit/.gitkeep
```

Do NOT create any component or src/core files — those are later WPs.

## package.json

- `"name": "zx"`, `"version": "2.0.0-alpha.0"`, `"type": "module"`, `"private": true`.
- devDependencies: `esbuild` only (latest). Run `npm install` so package-lock.json exists.
- scripts:
  - `"serve"`: `esbuild --servedir=. --serve=127.0.0.1:8321`
  - `"test"`: `node --test tests/unit/ && node tests/lint-tokens.js`
  - `"build"`: `node tools/build.js` (tools/build.js does not exist yet — that's WP11; the
    script entry may exist and fail gracefully or be omitted, your choice).
- `.gitignore`: `node_modules/`, `dist/`, `.DS_Store`.

## Design tokens

### `styles/tokens/global.css` — tier 1, on `:root`

Palette ramp derived from the legacy ZeyOS grayscale (do not invent different hues):

```
--zx-gray-0:#ffffff; --zx-gray-50:#fafafa; --zx-gray-100:#f2f2f2; --zx-gray-150:#eaeaea;
--zx-gray-200:#e0e0e0; --zx-gray-300:#d0d0d0; --zx-gray-400:#b0b0b0; --zx-gray-500:#8f8f8f;
--zx-gray-600:#6b6b6b; --zx-gray-700:#4b4b4b; --zx-gray-800:#2e2f31; --zx-gray-900:#1d1e20;
--zx-gray-950:#161719;
--zx-green-300:#33d95c; --zx-green-400:#00cc33; --zx-green-500:#008040; --zx-green-600:#00662f;
--zx-red-400:#e5484d;  --zx-red-500:#c62f34;
--zx-amber-400:#f2a900; --zx-amber-500:#c78a00;
--zx-blue-400:#3b82d4;  --zx-blue-500:#2a66ab;
```

Plus: spacing `--zx-space-1..8` (4/8/12/16/20/24/32/40px), radii `--zx-radius-sm:4px / md:6px /
lg:8px / full:999px`, font stack `--zx-font-sans: Inter, ui-sans-serif, system-ui, sans-serif`
and `--zx-font-mono`, type scale `--zx-text-xs:11px / sm:12.5px / md:13.5px / lg:15px / xl:18px`,
shadows `--zx-shadow-1/2/3` (soft, low-alpha), motion `--zx-dur-fast:120ms / --zx-dur-base:180ms`,
`--zx-ease: cubic-bezier(.2,.6,.3,1)`.

### `styles/tokens/semantic.css` — tier 2, on `:root, [data-zx-theme="light"]`

Light defaults mapping tier 1 → semantic. Required names (components consume ONLY these):

```
--zx-color-bg-page / bg-surface / bg-raised / bg-control / bg-hover / bg-selected / bg-backdrop
--zx-color-border / border-strong / border-control
--zx-color-text / text-muted / text-placeholder / text-invert
--zx-color-accent / accent-hover / accent-active / on-accent
--zx-color-danger / danger-bg   --zx-color-warning / warning-bg
--zx-color-success / success-bg --zx-color-info / info-bg
--zx-focus-ring            (e.g. 0 0 0 2px color-mix(in srgb, var(--zx-color-accent) 35%, transparent))
--zx-control-height:32px  --zx-control-pad-x  --zx-control-radius  --zx-control-font-size
--zx-overlay-shadow  --zx-header-bg  --zx-header-text
```

Accent = the ZeyOS green (`--zx-green-500` as accent on light, `--zx-green-400` on dark).

### `styles/tokens/dark.css`

`[data-zx-theme="dark"] { ... }` remap of ALL tier-2 color tokens: near-black surfaces
(gray-950/900/800), light text, adjusted accent. Also
`[data-zx-theme="auto"]` block wrapping the dark values in `@media (prefers-color-scheme: dark)`.

### `styles/tokens/density.css`

`[data-zx-density="compact"] { ... }` remapping size tokens only:
`--zx-control-height:26px`, tighter `--zx-control-pad-x`, `--zx-text-md:12.5px`, reduced spacing
steps used by controls.

### `styles/tokens/modules.css`

The ZeyOS module accent map as custom properties `--zx-module-<name>` — copy the ~25 color values
from `../gx-core/src/less/icons.less` (variables named `@gxZeyosModuleIcon-color-<name>`).

### `styles/base.css`

Scoped minimal reset (only under a `.zx-scope` class OR element selectors safe for embedding —
do NOT globally reset the host page: ZeyOS pages will load this CSS next to legacy styles).
Typography defaults, `:focus-visible` ring via `--zx-focus-ring`, `::selection` accent,
scrollbar-gutter, `@media (prefers-reduced-motion: reduce)` global animation kill.

### `styles/zx.css`

`@import` aggregate: tokens (global, semantic, dark, density, modules) then base.css; component
CSS files will be appended by later WPs.

## Demo harness

- `demos/index.html`: loads `../styles/zx.css` + `harness.css`, `<script type="module" src="harness.js">`.
  No build step; must work via `npm run serve` → http://127.0.0.1:8321/demos/.
- `demos/harness.js`:
  - `const demos = [ ... ]` — dynamic-imports of `./components/*.demo.js` registered explicitly
    (start with `tokens.demo.js`).
  - Renders a sidebar (grouped by `group`), a main panel calling the active demo's `mount()`,
    and a fixed toolbar with three switchers: theme (light/dark/auto), density (cozy/compact) —
    these set `data-zx-theme` / `data-zx-density` on `<html>` and persist to localStorage.
  - Vanilla JS only, no dependencies; keep it ~200 lines, clean.
- `demos/components/tokens.demo.js`: token showcase — color swatch grid for every semantic color
  token (name + resolved value), spacing/radius/type-scale specimens, the module color map, and
  a specimen row of native elements (button, input, select) styled by base.css only.

## tests/lint-tokens.js

Node script (no deps): recursively scan `src/components/**/*.css` (tolerate the directory not
existing yet) + `styles/base.css` for raw color literals (`#hex`, `rgb(`, `hsl(`, and the CSS
named colors as whole words) outside comments, and for `outline: none`/`outline:0` not followed
in the same file by a `:focus-visible` rule. Tier-1 usage check: flag `--zx-gray-`, `--zx-green-`,
`--zx-red-`, `--zx-amber-`, `--zx-blue-` references inside `src/components/**`. Exit 1 with a
readable report on violations, exit 0 otherwise. `styles/tokens/**` is exempt.

## README.md

Short: what Zx is, status table of work packages, how to run demos and tests. Mention the gx
compat layer as upcoming.

## Acceptance criteria

1. `npm install && npm test` exits 0 (no unit tests yet is fine — `node --test` on an empty dir
   must not fail the script; adjust the test script if needed, e.g. guard with a file glob).
2. `npm run serve` → `/demos/` renders the harness; tokens demo shows swatches; theme and
   density switchers visibly change the page and persist across reload.
3. Dark theme: page background near-black, readable text, accent green visible.
4. `node tests/lint-tokens.js` exits 0 on the scaffold, and exits 1 if you temporarily add
   `color:#ff0000` to base.css (self-verify, then remove).
5. All work committed.

## Out of scope

Any src/core or component implementation; tools/build.js; custom elements; compat layer.
