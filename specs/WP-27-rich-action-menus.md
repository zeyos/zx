# WP27 — Rich action menus

Gives the shared menu-button and context-menu action model the metadata needed by dense business
applications while keeping both controls conforming APG menus. This work deliberately does not
turn either component into a free-form account panel: composite preferences and other interactive
content belong in an application-owned dialog or popover.

## Files in scope

```
specs/WP-27-rich-action-menus.md
src/internal/menu-items.js                         # new shared normalization/rendering
src/components/menu-button/menu-button.js
src/components/menu-button/menu-button.css
src/components/context-menu/context-menu.js
src/components/context-menu/context-menu.css
tests/unit/menu-items.test.js
tests/smoke/smoke.js                               # MenuButton and ContextMenu cases only
website/demos/menu-button.demo.js
website/demos/context-menu.demo.js
docs/llms.md                                       # the two component sections only
docs/api.json                                      # regenerated public API metadata
CHANGELOG.md                                       # Unreleased entry only
```

`src/core/**`, `AccountMenu`, and every other component are unchanged.

## Shared entry model

Both components accept the same backward-compatible entry union:

- `'-'` and `{type: 'separator'}` render a separator.
- `{type: 'heading', label}` renders a visible, non-interactive section heading.
- An action keeps the established `label`, `icon`, `value`, `disabled`, `danger`, and `onselect`
  fields and may additionally provide:
  - `href`, `target`, and `rel` for a genuine native link. Unsafe executable URLs are rejected by
    `safeHref`; `_blank` links receive `noopener noreferrer` unless the application supplied `rel`.
  - `description`, `badge`, `shortcut`, and `adornment` for supporting text and trailing metadata.
    An adornment may be a text value or an already-created Node; server strings are never parsed.
  - `role: 'menuitem'|'menuitemcheckbox'|'menuitemradio'` and `checked` for APG checked actions.

The shared renderer owns the structure and security-sensitive link normalization. Each component
supplies its CSS block name and retains ownership of events, focus, opening, and closing.

## Selection and native links

- `select` stays cancelable. Preventing it skips `onselect`, leaves the menu open, and prevents a
  native link from navigating.
- A disabled link never navigates. Disabled menu items remain reachable by arrow navigation, as
  APG permits, but cannot activate.
- An accepted native-link selection runs `onselect`, closes the menu, and then keeps the browser's
  ordinary link behavior, including modifier click and `target`.
- Enter and Space activate every entry once. Links use their native click path so the component
  does not synthesize duplicate selections.
- ContextMenu adopts the same cancellation behavior MenuButton already documents.

## Accessibility

- Roving focus and typeahead include `menuitem`, `menuitemcheckbox`, and `menuitemradio` roles and
  exclude headings and separators.
- Checked roles expose `aria-checked`; plain actions do not.
- Icons and decorative metadata do not replace the visible label. Headings are presentation text,
  not focusable pseudo-actions.

## Out of scope

- Arbitrary render callbacks or nested interactive controls inside a menu.
- Nested submenus.
- Turning `AccountMenu` into a composite account/preferences surface.
- Automatic mutation of checkbox/radio state; the owning application updates its item model.

## Acceptance criteria

1. Every existing flat item and `'-'` separator renders and selects exactly as before.
2. MenuButton and ContextMenu render identical entry anatomy for the same descriptor.
3. Links preserve native behavior, reject executable URLs, and honor cancellation/disabled state.
4. Checked roles, headings, descriptions, badges, shortcuts, and adornments are represented
   correctly and do not enter the roving focus order unless they are actions.
5. ContextMenu selection cancellation leaves the menu open and suppresses its callback.
6. Source and global-distribution smoke cases exercise rich entries, keyboard activation, and
   create/destroy/recreate behavior.
7. `npm test`, `npm run build`, and `npm run test:browser` pass.

## Release

All changes are backward-compatible public additions and ship in the 4.4.0 minor release.
