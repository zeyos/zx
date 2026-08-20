# Design notes — learnings from SAP Fiori/UI5 and Salesforce SLDS

A short review of two mature enterprise component systems and how Zx compares, to guide future
work. Sources are listed at the end.

## What Zx already does well (validated against both systems)

- **Design tokens as the theming contract.** SLDS 2's central idea is *styling hooks* — CSS custom
  properties that "separate structure from theme"; IBM Carbon and SAP use the same model. Zx's
  two-tier tokens (global palette → semantic `--zx-color-*` / `--zx-control-*`) match this, and
  dark mode + density are pure token/attribute swaps.
- **Content density.** SAP ships cozy/compact (and a denser "condensed" for tables); SLDS has
  comparable density. Zx has `data-zx-density="cozy|compact"`.
- **Accessibility first.** Both mandate WAI-ARIA patterns and visible focus. Zx implements the APG
  patterns (combobox, dialog, tabs, grid, menu) with `:focus-visible` rings.
- **Restrained modern visuals.** SLDS 2 "Cosmos" moved to rounded-but-restrained corners and a
  refined neutral palette — the direction Zx already took (small radii, 1px borders over heavy
  shadows, system/Inter type).
- **Declarative, metadata-driven composition.** SAP Fiori elements generate forms/tables from
  annotations; Zx's Form field registry (`Field.register`, declarative `fields: {}`) and Table
  column config are the same idea at a smaller scale.

## Applied now

- **Table loading state** (`Table.setLoading(true|false)`): dims the body, shows an indeterminate
  top progress bar, and sets `aria-busy` — the busy/skeleton pattern both SAP UI5 tables and SLDS
  emphasize. Wired into the kitchen sink's `@zeyos/client` loads. Reduced-motion safe.

## Recommended next (prioritized, not yet done)

1. ~~**Responsive table pop-in.**~~ **Done** — `Table` gained `responsive` and per-column `popin`,
   driven by `onBreakpoint()` observing the table's own container. See the Table reference.
   Originally described as: SAP UI5's most distinctive table feature: below a per-column
   `minScreenWidth`, secondary columns collapse into a stacked label/value block within the row
   instead of horizontal scroll. High value for ERP screens on narrow viewports. Medium effort —
   add a `column.minWidth`/`popin` option and a container-query-driven row layout.
2. **Column-level styling hooks** (SLDS `--slds-c-*`). Expose a small, curated set of
   component-level custom properties (e.g. `--zx-table-header-bg`, `--zx-table-row-hover`,
   `--zx-button-radius`) that default to the current semantic tokens, so products can restyle a
   component without overriding internal selectors. Note: SLDS itself keeps this layer small and
   warns it's easy to over-expose — pick a handful per component. Low effort, backward-compatible.
3. ~~**Illustrated empty states.**~~ **Done** — `Table.emptyText` now accepts a Node or a factory,
   so `emptyState({icon, title, description, actions})` drops straight in. Originally described as: Enterprise UX guidance treats the empty state as a first-class
   screen (guidance + a primary action), not blank space. Zx Table has `emptyText`; extend it to
   accept a node (icon + message + action) and document the pattern.
4. **Table "growing"/load-more and (later) virtualization.** SAP UI5 grows rows on demand; Zx
   renders all rows in one pass (fast to ~5k). For large ERP result sets, add incremental
   load-more, then optional row virtualization.
5. **"Use the least-specific override that works."** Adopt SLDS's explicit guidance in the theming
   docs: prefer a global token override; reach for a component hook only when necessary; never
   override internal component selectors. (Partly documented already.)

## Sources

- [UI5 Web Components](https://ui5.github.io/webcomponents/) · [SAP Fiori design system](https://www.sap.com/design-system/fiori-design-web/) · [SAP responsive table / auto pop-in](https://community.sap.com/t5/technology-blog-posts-by-sap/ui5ers-buzz-58-column-resizing-auto-pop-in-feature-in-responsive-table/ba-p/13506047)
- [What is SLDS 2](https://www.salesforce.com/blog/what-is-slds-2/) · [SLDS styling hooks](https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-custom-properties.html)
- [Enterprise data-table UX patterns](https://pencilandpaper.io/articles/user-experience/ux-pattern-analysis-enterprise-data-tables/) · [Empty-state best practices](https://www.pencilandpaper.io/articles/empty-states)
