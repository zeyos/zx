# Zx — Contributor Contract

Zx is a dependency-free vanilla-JavaScript UI component library for the ZeyOS ERP, the successor
to the MooTools-based "gx" library (which lives in the sibling directories `../gx-core`,
`../gx-zeyos`, `../gx-bootstrap` — read-only reference material).

Every work package (WP) is specified in `specs/WP-*.md`. Implement exactly what the spec says;
its "Out of scope" section is binding. Do not modify files outside the spec's file scope.
`src/core/**` may only be modified when the spec explicitly says so.

## Hard rules

- **Zero runtime dependencies.** `package.json` may contain devDependencies only (esbuild).
  Never add a runtime import from `node_modules`.
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

## Naming

- API namespace: lowercase `zx` — classes exported PascalCase from `src/index.js`
  (`export { Select } ...`; the global bundle exposes them as `window.zx.Select`).
- CSS classes: `.zx-<component>` block, `.zx-<component>__<part>` elements (BEM-ish, no modifiers
  — states use attributes, see below).
- CSS custom properties: `--zx-*`. Components may **only** consume tier-2 semantic tokens
  (`--zx-color-*`, `--zx-control-*`, `--zx-focus-ring`, `--zx-overlay-shadow`, `--zx-space-*`,
  `--zx-radius-*`, `--zx-text-*`, `--zx-dur-*`, `--zx-ease`). Never tier-1 palette tokens
  (`--zx-gray-500` etc.), never raw color literals (`#hex`, `rgb()`, `hsl()`, named colors).
  `tests/lint-tokens.js` enforces this.
- Custom elements (WP9 only): `<zx-*>`.
- Events: lowercase names without `on` prefix (`change`, `open`, `close`, `rowclick`, `sort`).
  Emit via `this.emit(type, detail)` which also dispatches a bubbling, composed
  `CustomEvent('zx-<type>')` on the root element.

## Component conventions

- Extend `Component` from `src/core/component.js`. Constructor signature is always
  `(target, options)` where target is `Element | selector string | null` (null ⇒ the component
  creates its own root via `render()`).
- Options: declare `static defaults`; never mutate the passed options object.
- State is expressed via ARIA attributes and `data-state`, styled with attribute selectors
  (`[aria-expanded="true"]`, `[aria-selected="true"]`, `[data-state="open"]`), not state classes.
- Accessibility follows the WAI-ARIA Authoring Practices Guide (APG) pattern named in the spec,
  including the full keyboard map. Focus styling uses `:focus-visible` with the
  `--zx-focus-ring` token. Wrap all non-essential animation in
  `@media (prefers-reduced-motion: no-preference)`.
- Both themes and densities must work: verify light/dark (`data-zx-theme`) × cozy/compact
  (`data-zx-density`) render correctly for every component you touch.
- `destroy()` must leave the DOM as found: remove created elements, abort listeners.
  Creating and destroying a component twice on the same target must not throw or leak nodes.

## File layout per component

```
src/components/<name>/<name>.js     # the component class
src/components/<name>/<name>.css    # its styles (imported into styles/zx.css)
demos/components/<name>.demo.js     # demo module (see below)
tests/unit/<name>.test.js           # only where the spec names pure logic to test
```

Register exports in `src/index.js` and CSS `@import` in `styles/zx.css`.

## Demo modules (required for every component)

`demos/components/<name>.demo.js` exports:

```js
export default {
  title: 'Select',            // display name
  group: 'Inputs',            // sidebar group: Inputs | Overlays | Data | Forms | Layout | Core
  mount(container) { ... }    // build one or more usage examples into container
};
```

and is registered in `demos/harness.js`'s demo list. Demos double as documentation: show the
common options, wire visible event output (e.g. a small log element), keep them self-contained.

## Definition of done (per WP)

1. All files in the spec's scope exist and are complete; nothing outside the scope touched.
2. `npm test` passes (`node --test tests/unit/` + `node tests/lint-tokens.js`).
3. Demo module(s) registered and rendering without console errors.
4. Keyboard map from the spec fully implemented.
5. JSDoc complete on public API.
6. Work committed on the WP branch named in the spec with a concise message per component.
