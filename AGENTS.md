# Xenon / Zx — Contributor Contract

Xenon is a product-agnostic design system developed at ZeyOS; Zx is its dependency-free
vanilla-JavaScript implementation.

Every work package (WP) is specified in `specs/WP-*.md`. Implement exactly what the spec says;
its "Out of scope" section is binding. Do not modify files outside the spec's file scope.
`src/core/**` may only be modified when the spec explicitly says so.

## Hard rules

- **Zero runtime dependencies.** `package.json` may contain devDependencies only — esbuild for the
  bundles, typescript for declaration emit, playwright-core to drive the browser smoke suites
  against an already-installed Chrome. Never add a runtime import from `node_modules`.
- **JSDoc-typed plain JS.** ES2022 modules (`.js`), no TypeScript syntax, no build step required
  to run in a browser. Every public class, method, option object, and event gets JSDoc
  (`@param`, `@returns`, `@fires`, `@typedef` for options).
- **Browser baseline:** evergreen ~2023+. `<dialog>`, popover attribute, `:has()`, container
  queries may be used freely. CSS anchor positioning only behind a support check with the JS
  fallback from `src/core/position.js`.
- **No `innerHTML`** except through `h.raw()` (see `src/core/dom.js`), and only for content the
  component itself generated. User/server data always goes through text nodes or `htmlEscape`.
- **All DOM event listeners** in components go through `this.listen(el, type, fn)` so that
  `destroy()` cleans them up via one AbortController. No stray `addEventListener` in components.
- **No module-level mutable state** in components (module-level constants are fine).

## Public website content

- The public website, documentation, demos, release notes, and published package may contain only
  supported product documentation and intentional public examples. Never publish internal studies,
  experiments, discarded directions, design explorations, review transcripts, prompts, agent output,
  implementation reasoning, or other internal working material.
- Component documentation may explain the stable public API, supported behavior, accessibility, and
  usage. Keep internal decision history, comparative studies, prototypes, and speculative material
  outside every file copied into the public site or package.
- Standalone exploratory pages and internal preview routes must not be linked, copied, or deployed
  unless the user explicitly approves that exact material for publication. Before every release,
  audit public navigation and generated site output for accidental internal content.
- Contributor instructions, agent skills, internal design audits, release procedures, and working
  notes stay repository-only. Keep them out of `tools/build-site.js` public sources and out of the
  npm package allowlist; extend `tools/check-site.js` whenever a new private path is identified.

## Naming

- API namespace: lowercase `zx` — classes exported PascalCase from `src/index.js`
  (`export { Select } ...`; the global bundle exposes them as `window.zx.Select`).
- CSS classes: `.zx-<component>` block, `.zx-<component>__<part>` elements (BEM-ish, no modifiers
  — states use attributes, see below).
- CSS custom properties: `--zx-*`. Components may **only** consume tier-2 semantic tokens
  (`--zx-color-*`, `--zx-control-*`, `--zx-focus-ring`, `--zx-overlay-shadow`, `--zx-space-*`,
  `--zx-radius-*`, `--zx-text-*`, `--zx-weight-*`, `--zx-tracking-*`, `--zx-dur-*`, `--zx-ease`).
  Never tier-1 palette tokens (`--zx-gray-500`, `--zx-emerald-*`, `--zx-tone-*` etc.) — categorical
  colour comes through `--zx-color-tone-*` and `--zx-color-chart-*` — and never raw color literals
  (`#hex`, `rgb()`, `hsl()`, named colors).
  `tests/lint-tokens.js` enforces this. One tier-1 name is public API for *applications* though
  still off limits to components: `--zx-accent-300`…`-700`, the ramp the accent roles resolve
  through, which is all a theme preset overrides. A new preset keeps the invariant the semantic
  tier assumes — 600 at 4.5:1 or better on white, 400 the same on the dark page — and
  `tests/unit/theme-presets.test.js` checks it.
- Custom elements (WP9 only): `<zx-*>`.
- Events: lowercase names without `on` prefix (`change`, `open`, `close`, `rowclick`, `sort`).
  Emit via `this.emit(type, detail)` which also dispatches a bubbling, composed
  `CustomEvent('zx-<type>')` on the root element.

## Component conventions

- Extend `Component` from `src/core/component.js`. Constructor signature is always
  `(target, options)` where target is `Element | selector string | null` (null ⇒ the component
  creates its own root via `render()`).
- Options: declare `static defaults`; never mutate the passed options object.
- **Bind the options typedef to the generic**: put `@extends {Component<XOptions>}` in the class
  JSDoc. `Component` is generic over its options type, and a subclass that declares no constructor
  inherits the base signature — without the binding the component still works perfectly and
  silently offers `Record<string, any>` to every TypeScript consumer. `tests/unit/type-bindings.test.js`
  fails if it is missing, or if it names a typedef the file does not declare.
- **No instance class-field declarations** (`_foo = [];` at class level) for state the component
  touches during `render()` or its helpers: `render()` runs inside the base constructor, BEFORE
  class-field initializers, which would then clobber anything render set. Initialize all instance
  state at the top of `render()` instead. When creating your own root (target null), assign
  `this.el = root` immediately after building it so helpers can use it.
- **Icons always go through `icon(name, options)`** from `src/core/icons.js` — never hand-written
  `<svg>` or `<i class="fa-…">` in a component. The same call renders either the bundled inline
  SVG set or Font Awesome, depending on what the application opted into, and both carry
  `class="zx-icon"`. Component CSS that targets icons must match `.zx-icon`, not `svg`.
- State is expressed via ARIA attributes and `data-state`, styled with attribute selectors
  (`[aria-expanded="true"]`, `[aria-selected="true"]`, `[data-state="open"]`), not state classes.
- Accessibility follows the WAI-ARIA Authoring Practices Guide (APG) pattern named in the spec,
  including the full keyboard map. Focus styling uses `:focus-visible` with the
  `--zx-focus-ring` token. Wrap all non-essential animation in
  `@media (prefers-reduced-motion: no-preference)`.
- Both themes must work: verify light and dark (`data-zx-theme`) render correctly for every
  component you touch. There is one geometry; spacing, radius, and control
  height are theme settings (`--zx-space-unit`, `--zx-radius`, `--zx-control-height`), so never
  hard-code a pixel size that should follow them. `website/theme.html` renders the whole library at
  once and is the fastest way to check a component against both themes, the spacing and radius
  settings, and the six accent presets (`data-zx-preset`, `styles/tokens/themes.css`).
- `destroy()` must leave the DOM as found: remove created elements, abort listeners.
  Creating and destroying a component twice on the same target must not throw or leak nodes.

## File layout per component

```
src/components/<name>/<name>.js     # the component class
src/components/<name>/<name>.css    # its styles (imported into styles/zx.css)
website/demos/<name>.demo.js     # demo module (see below)
tests/unit/<name>.test.js           # only where the spec names pure logic to test
```

Register exports in `src/index.js` and CSS `@import` in `styles/zx.css`.

## Demo modules (required for every component)

`website/demos/<name>.demo.js` exports:

```js
export default {
  title: 'Select',            // display name
  group: 'Inputs',            // Core | Helpers | Inputs | Layout | Feedback | Overlays | Pickers | Data | Forms
  mount(container) { ... }    // build one or more usage examples into container
};
```

and is registered in the `COMPONENT_IDS` list in `website/docs.js`. Demos double as documentation:
show the common options, wire visible event output (e.g. a small log element), keep them
self-contained. The documentation page shows each example's own source under it, extracted from the
function it just ran, so write it as example code a reader can copy. The data an example feeds its
component belongs in a declaration at the top of the module (`catalogue()`, `COLUMNS`, `makeRows()`)
rather than inline: the page offers those as tabs beside the snippet, comment included, so the
shape the component expects is documented by the demo itself.

## Layout examples

`website/layouts.html` is the layout gallery: a tile per layout carrying a live thumbnail (the real
module mounted in preview mode at 1440 × 900, scaled down), opening it in a near-full-screen Modal
with its source. `layouts.html#<id>` opens one directly; `layout.html#<id>` shows one on its own,
filling the window, for use in a separate tab.

- **Registry** — `website/layouts/index.js`: `TEMPLATE_IDS` (complete applications) and
  `PATTERN_IDS` (single screens), in gallery order. The gallery, the documentation search,
  `tools/check-site.js`, and `tools/run-smoke.js` all read it; adding a layout means adding its id
  there.
- **Module** — `website/layouts/<id>.layout.js` exports only `default`:
  `{ title, category, blurb, components, mount(container, context) }`. `context` is
  `{ preview, signal, cleanup }`; normalise it with `layoutContext()` and wrap every component in
  `disposer(context)` so closing the popup destroys it (menus, tooltips, dialogs, and sheets attach
  outside the root). Listeners outside the root take `context.signal`; keys bind on the root via
  `shortcuts(root, map, context)`, a `Launcher` gets `shortcut: false`. In preview render the first
  state only — no timers, streaming, launchers, toasts, or `focus()`. `mount` appends one root,
  `h('div', { class: '<block> shell' })`, that fills its container; no hard-coded element ids.
- **Kit** — `website/layouts/kit.js` and `kit.css` are the shared application shell (`.shell` and
  its columns, `paneHeader()`, `propList()`, `.list-row`, `.surface`, `shortcuts()`,
  `loadChartJs()`, and `adaptiveShell()`, which keeps every column reachable at any width: the
  inspector and the navigation become drawers below 1180px and 860px, and below 640px a shell with
  a list column shows the list or the main pane; at full width it collapses columns and opens a
  `.shell__panel` bottom panel, with Mod+B/I/J when asked), `.shell__statusbar`, key sequences in
  `shortcuts()` (`'g h'`), and `shortcutSheet()` for the `?` reference; `fixtures.js` is the shared fictional world, `layout-icons.js` the extra icons.
  A layout's styles live in `<id>.layout.css` — templates and screen patterns alike — every
  selector under its block class, imported by `website/layouts.css`. `tests/lint-tokens.js` holds
  all of them to the semantic-token rule.
- **Checking one** — `node tools/shoot-layout.js <id> --out <dir>` mounts a layout through
  `tests/layouts/harness.html` and screenshots it in light and dark (`--preview`, `--preset`,
  `--width`/`--height`, `--steps <module>` to drive it first). It fails on page or console errors
  and on anything left on `<body>` after unmount — the gallery opens and closes layouts all session.
  `node tools/audit-layout.js <id>` takes the same options and fails on accessibility problems:
  unnamed controls and landmarks, text contrast, missing focus indicators, skipped headings,
  duplicate ids. A layout is done when both pass at 1440 and at 390 wide, in both themes.
- Templates borrow information architecture, never identity: no reference product's name, logo,
  colours, or copy anywhere under `website/`. `tools/check-site.js` and
  `tests/unit/layout-templates.test.js` fail on the names.

## Definition of done (per WP)

1. All files in the spec's scope exist and are complete; nothing outside the scope touched.
2. `npm test` passes (`node --test`, which finds `tests/unit/*.test.js`, + `node tests/lint-tokens.js`).
3. Demo module(s) registered and rendering without console errors.
4. Keyboard map from the spec fully implemented.
5. JSDoc complete on public API.
6. Work committed on the WP branch named in the spec with a concise message per component.
