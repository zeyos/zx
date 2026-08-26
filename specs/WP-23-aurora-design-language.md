# WP-23 — Aurora design language

## Objective

Turn Aurora from an isolated effect into a coherent Xenon surface language. Aurora supplies one
ambient light field per application canvas; semantic material roles determine how persistent
chrome, raised content, controls, and transient overlays reveal that light. Add an optional
circular AppIcon presentation without changing the existing compact ZeyOS tile default.

## Evidence and design invariants

- The supplied reference screenshots use atmospheric colour on the canvas, not an independent
  gradient on every card.
- Persistent navigation and transient overlays are translucent; dense tables, forms, lists, code,
  and reading planes remain opaque or nearly opaque.
- Circles are appropriate for spacious icon-only actions and launcher identities. Compact rails,
  badged icons, entity rows, and tables retain the existing tile geometry.
- Aurora and material are orthogonal. Changing material must not change Aurora geometry or colour;
  changing Aurora must not change component dimensions or interaction.
- One Aurora may decorate an application/docs canvas. A bounded layout preview may own one
  additional Aurora. Repeated cards and overlays never instantiate Aurora.
- Reduced transparency and forced colours remove decorative illumination and make surfaces opaque.

## In scope — exact files

### Contract and tokens

- `specs/WP-23-aurora-design-language.md`
- `styles/tokens/semantic.css`
- `website/theme-presets.js`
- `website/theme.css`
- `website/theme.js`
- `website/theme-showcase.js`

### Core component styling

- `src/components/aurora/aurora.css`
- `src/components/app-icon/app-icon.js`
- `src/components/app-icon/app-icon.css`
- `src/components/button/button.css`
- `src/components/card/card.css`
- `src/components/app-sidebar/app-sidebar.css`
- `src/components/app-rail/app-rail.css`
- `src/components/master-panel/master-panel.css`
- `src/components/navigation-bar/navigation-bar.css`
- `src/components/panel/panel.css`
- `src/components/avatar/avatar.css`
- `src/components/dropdown/dropdown.css`
- `src/components/modal/modal.css`
- `src/components/launcher/launcher.css`
- `src/components/message/message.css`
- `src/components/sheet/sheet.css`
- `src/components/select/select.css`
- `src/components/tag-picker/tag-picker.css`
- `src/components/date-picker/date-picker.css`
- `src/components/datebox/datebox.css`
- `src/components/datebox/date-range-box.css`
- `src/components/tooltip/tooltip.css`
- `src/components/table/table.css`
- `src/zeyos/icons.js`

### Documentation and examples

- `website/docs.html`
- `website/docs.js`
- `website/docs.css`
- `website/site.css`
- `website/demos/app-icon.demo.js`
- `website/demos/launcher.demo.js`
- `website/demos/aurora.demo.js`
- `website/aurora.html`
- `website/aurora.js`
- `website/aurora.css`
- `README.md`
- `docs/llms.md`
- `docs/llms.txt`
- `docs/api.json`
- `website/llms.txt`

### Verification

- `tests/unit/app-icon.test.js`
- `tests/unit/aurora.test.js`
- `tests/unit/theme-presets.test.js`
- `tests/smoke/smoke.js`

## Public contract changes

- `AppIcon` adds `shape: 'tile' | 'circle'`, defaulting to `tile`.
- `moduleChip()` and `zeyosAppIcon()` forward the optional `shape`; their default remains `tile`.
- No Aurora API changes.
- No new runtime dependency.

## Implementation rules

- New component CSS consumes only tier-2 semantic tokens.
- Preserve existing material token names for custom-theme compatibility.
- Add semantic roles for persistent chrome and shared filter tiers; do not duplicate blur, colour
  mixing, or shadow recipes inside components.
- Remove the one-sided accent borders from MasterPanel, Toast, Launcher selection, documentation
  callouts, NavigationBar panels, and example/source frames. Selection is a complete region.
- AppIcon hover elevation applies only when the icon itself or an ancestor is interactive.
- Keep Tables, Grid, Dock, docked Sheet, form fields, docs prose, and code blocks opaque.
- The standalone Aurora example may use ordinary wrapper elements for page layout, but every
  interactive control and showcased application surface must be composed from Zx APIs.
- Preserve routing, keyboard behavior, events, density, and geometry.

## Non-goals

- Rebuilding ZeyOS application routing or the removed five-view mockup.
- Copying the reference application's artwork, star texture, copy, or branded icons.
- Making every AppIcon circular.
- Adding animated particles, canvas rendering, or JavaScript-driven glass effects.
- Rewriting the eight documentation layout modules.
- Publishing, tagging, or releasing the library in this work package.

## Acceptance criteria

1. Flat, Glass, and Deep Glass visibly differ across Button, raised Card, persistent chrome, and
   every overlay tier while component geometry remains unchanged.
2. Documentation owns one subtle Aurora; every mounted `.layout-frame` owns one route-scoped
   Aurora that is destroyed on navigation.
3. AppSidebar/AppRail, NavigationBar, MasterPanel, Panel chrome, docs header/sidebar/search/toolbar,
   and overlay components consume shared material roles.
4. Dense content remains readable and opaque; no repeated card or overlay creates an Aurora.
5. `AppIcon({shape:'circle'})` renders a centred white glyph, visible badge, selection, focus, and
   interactive hover states. The default and ZeyOS presets remain tile-shaped.
6. Launcher application icons demonstrate the circle option; record/entity icons remain tiles.
7. One-sided border/radius constructions in the touched surfaces are replaced with complete
   regions.
8. Reduced transparency and forced colours remove Aurora and material filters while retaining
   borders and focus visibility.
9. Documentation explains canvas, chrome, content, and overlay roles and shows a Zx-composed live
   example.
10. Unit tests, token lint, full test suite, library build, site build, and browser smoke/visual QA
    pass in light and dark themes at desktop and mobile widths.
