# WP9 — Custom elements: zx.defineElements()

Branch: `wp9-elements` from `main` (requires WP2–WP8 merged — wraps existing components).
Read `AGENTS.md`.

## Scope

```
src/elements/define.js        # defineElements() + the generic wrapper factory
src/elements/reflect.js       # attribute<->option coercion helpers (pure, node-testable)
demos/components/elements.demo.js
tests/unit/reflect.test.js
src/index.js                  # export defineElements (NOT auto-called)
```

## Design

`defineElements(prefix='zx')` registers custom elements wrapping these components:

| Element | Component | Form-associated |
|---|---|---|
| `<zx-toggle>` | Toggle | yes (checkbox-like) |
| `<zx-check-button>` | CheckButton | yes |
| `<zx-select>` | Select | yes |
| `<zx-checklist>` | Checklist | yes (value = JSON array) |
| `<zx-datebox>` | Datebox | yes (value = %Y-%m-%d[T%H:%M]) |
| `<zx-timebox>` | Timebox | yes (numeric) |
| `<zx-search>` | Search | no |
| `<zx-groupbox>` | Groupbox | no |
| `<zx-tabbox>` | Tabbox | no |
| `<zx-table>` | Table | no |
| `<zx-dialog>` | Dialog | no |

Generic wrapper factory `elementFor(Component, {formAssociated, attrs})`:
- `connectedCallback`: instantiate the component with `null` target, move the element's
  pre-existing light-DOM children into the component where meaningful (Groupbox content,
  Dialog content; document per element), append component root. No Shadow DOM (light DOM —
  Zx styles are global by design).
- Attributes → options via `reflect.js` coercion (string/number/bool/JSON for complex:
  `items='[...]'`). `observedAttributes` from a per-element attr map; changes call the mapped
  setter. Property accessors mirror attributes (`el.value`, `el.checked`, `el.items` as
  property accepts arrays directly).
- Events: components already dispatch bubbling `zx-*` CustomEvents on their root — re-dispatch
  on the host element so `document.querySelector('zx-select').addEventListener('zx-change', ...)`
  works.
- Form association: `static formAssociated = true` + ElementInternals: `setFormValue` on change,
  `disabled` via `formDisabledCallback`, restore via `formResetCallback` /
  `formStateRestoreCallback`; validity: required select/datebox empty → `internals.setValidity`.
- `disconnectedCallback`: destroy the component.
- `defineElements` is idempotent (guard re-registration).

## Demos

`elements.demo.js`: declarative markup samples built with h.raw (trusted static strings):
a `<form>` containing `<zx-select items='[...]' required>`, `<zx-toggle>`, `<zx-datebox>`,
native submit button — submitting logs FormData entries proving ElementInternals participation;
attribute-mutation playground (change items/disabled via buttons and observe reflection);
`<zx-tabbox>` + `<zx-table>` declarative usage.

## Acceptance criteria

1. `npm test` green (reflect coercions: bool presence, number, JSON, invalid JSON → warn+ignore).
2. FormData includes values from form-associated elements; form reset restores defaults;
   `:invalid` styling reachable for required-empty `<zx-select>`.
3. Attribute changes reflect live; property setters accept rich values.
4. Removing an element from DOM destroys its component (registry check in demo).
5. Committed on `wp9-elements`.

## Out of scope

Shadow DOM; SSR; elements for every component (the table above is the set); compat.
