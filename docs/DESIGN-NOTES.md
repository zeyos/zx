# Design notes

Internal design principles and completed follow-ups that guide future Zx work.

## Stable principles

- **Design tokens are the theming contract.** The two-tier token model (global palette → semantic
  `--zx-color-*` and `--zx-control-*` roles) separates structure from theme. Dark mode, density,
  and product accents are attribute and token changes rather than component forks.
- **Density is contextual.** `data-zx-density="cozy|compact"` lets the same component adapt to
  spacious and information-dense interfaces.
- **Accessibility starts with the interaction pattern.** Components implement native semantics or
  the relevant WAI-ARIA Authoring Practices pattern, visible focus, and reduced-motion behavior.
- **Application content stays visually primary.** Small radii, hairline borders, limited shadows,
  and neutral type keep component chrome quiet around dense workflows.
- **Composition is declarative.** The Form field registry, Table columns, shell navigation items,
  and component options turn application metadata into consistent controls without coupling Zx to
  a router, back end, or state store.

## Applied follow-ups

- `Table.setLoading(true|false)` dims the body, shows an indeterminate top progress bar, and sets
  `aria-busy`; the behavior is reduced-motion safe.
- Responsive table pop-in collapses secondary columns into a stacked label/value block within the
  row according to the table container rather than the viewport.
- A deliberately small set of component styling hooks falls back to semantic tokens and is kept in
  sync with tests and documentation.
- `Table.emptyText` accepts a Node or factory, allowing an illustrated, actionable `emptyState()`.
- Growing tables expose `growing`, `growBy()`, and `showAll()`; row virtualization remains a
  separate future concern.
- The theming guide documents the override order: global semantic token, published component hook,
  and only then an application-owned selector.

## Open follow-ups

- Evaluate row virtualization only with measured production data and a stable row-height contract.
- Add public component hooks only when multiple real applications need the same override; every
  published hook is a compatibility promise.
- Keep application-owned concerns—routing, persistence, permissions, formulas, and remote
  orchestration—outside the component layer.
