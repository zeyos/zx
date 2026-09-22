# WP33 — Respect handled Escape in nested dropdown controls

## Scope

- `src/components/dropdown/dropdown.js`
- `tests/smoke/smoke.js`

## Contract

The shared Dropdown dismissal listener must respect `event.defaultPrevented`. A nested Select
consumes its first Escape to close its choices. The parent Dropdown remains open until another
Escape reaches it unhandled. The second Escape closes the parent and restores trigger focus.
Existing outside-click dismissal and disposal remain intact. No API, core, style or dependency
changes. Do not publish or commit unrelated work.

## Validation

Exercise a real Select within a Dropdown in browser smoke, including both Escape presses,
trigger focus restoration and owned instance disposal. Run unit tests and the source browser
smoke suite; verify the host panel in light and dark themes.
