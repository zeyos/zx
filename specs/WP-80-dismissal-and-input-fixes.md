# WP80 — Dismissal, exact numbers, and application feedback fixes

Branch: `wp/80-dismissal-and-input-fixes`, from the 5.7.0 release. AGENTS.md applies.

Six problems reported by an application built on 5.7.0, each reproduced in Chrome before work began.

## Confirmed items and required result

| ID | Scope | Required result |
| --- | --- | --- |
| F1 | Modal, Dialog, Sheet | Every dismissal by the reader raises one preventable `cancel` with `detail.reason`: `escape`, `close-button`, `button` (footer action `'cancel'`), `backdrop`, `outside`, `drag`. Programmatic `close()` and the footer action `'close'` stay unconditional. The topmost modal answers Escape itself from a `window` keydown listener — after every element and `document` handler, and only when none of them prevented the key — and cancels the keydown, so a prevented `cancel` holds on every press; the native `cancel` listener remains for close requests that are not a keydown. `closable: false` keeps refusing Escape and still reports it. This supersedes WP3's "cancel (Esc)". |
| F2 | NumberField | `snap: false` keeps typed and assigned values exactly; `step` is then only the stepping increment, decimals round only to an explicit `precision`, `min`/`max` still clamp, and the value is displayed with its own decimals. Default behavior and `snapNumber` are unchanged. |
| F3 | Checklist and its field adapter | `label` and `disabled` options; `setLabel()`, `enable()`, `disable()`, `isDisabled()`. The disabled state covers the search field and every checkbox and survives search, `setItems()` and reload. The adapter uses the component API. |
| F4 | `src/core/position.js`, `src/core/dom.js` | Closing an anchored popup and restoring an enhanced target never write the `style` attribute: inline style is restored through the CSSOM and an originally absent attribute is removed after a read, so no empty `style=""` remains and a `style-src` policy without `'unsafe-inline'` reports nothing. `restoreTarget` keeps attribute order and leaves an untouched style unchanged. |
| F5 | `src/components/button/button.css` | A pressed button stays neutral but is drawn with a stronger fill and a frame that holds 3:1 against the unpressed neighbour and the page in both themes; pressed `ghost` buttons take the frame. |
| F6 | `src/core/icons.js`; `website/layouts/layout-icons.js` | Bundle `download`, `box-archive`, `pencil`, `pen-to-square`; alias `archive` and `edit`. A glyph an application registered under an alias name keeps precedence. Remove the duplicates from the layout pack. |

## File scope

- This specification.
- `src/components/{modal,dialog,sheet,number-field,checklist,button}/**`.
- `src/core/position.js`, `src/core/dom.js`, `src/core/icons.js` (explicit core permission for F4
  and F6 only).
- `website/demos/{sheet,number-field,checklist,button}.demo.js`, `website/layouts/layout-icons.js`.
- `tests/regression/dismissal-and-input.js`, `tests/unit/icons.test.js`.
- `docs/llms.md`, `docs/api.json` (generated), `CHANGELOG.md`.

## Validation

`npm test`; `npm run test:browser`; the new regression suite in both themes, including a page served
with `style-src 'self'` in both positioning modes and a measured contrast for the pressed state.

## Out of scope

A release or version bump, new tokens, step-mismatch validation for NumberField, a public
`requestClose()` method, changes to non-keydown close requests the browser makes non-cancelable,
other components' pressed or current styling, deployment.
