# WP21 — Aurora surface-light exploration

Branch: work on `main`. Read `AGENTS.md` before changing this work package.

## Objective

Create a static comparison page that lets the Zx team evaluate how a subtle, module-coloured
“Aurora” light field could behave behind dense application surfaces and Liquid Glass overlays.
This work package explores the visual direction only; it deliberately does not create a public
component, helper, token contract, or export.

## Scope

Only these files may be created or changed:

```
specs/WP-21-aurora-preview.md
website/aurora-preview.html
website/aurora-preview.css
tests/unit/aurora-preview.test.js
```

The preview must:

- compare six named lighting geometries: Source Bloom, Corner Confluence, Horizon Band,
  Diagonal Veil, Edge Frame, and Curtain Field;
- show every geometry against the same dense application skeleton in both dark and light themes;
- place the same translucent overlay over every geometry, so glass interaction can be compared;
- offer emerald, coral, and violet accent samples without JavaScript;
- use ordinary CSS gradients, `color-mix()`, and `backdrop-filter` only;
- remain readable and free of horizontal page overflow at 1440 px and 390 px viewport widths;
- remove decorative gradients and blur in forced-colours or reduced-transparency modes.

## Constraints

- Zero runtime dependencies and no JavaScript.
- No canvas, WebGL, SVG filters, raster textures, generated image assets, or external requests.
- Use semantic `--zx-*` tokens for page chrome; exploration-only variables must use the
  `--aurora-*` or `--preview-*` namespace.
- The module colour is the primary hue. A direction may use at most one complementary hue.
- Dense application content remains visually dominant; Aurora is illumination, not wallpaper.
- The page is an unindexed design study and is not linked from the public navigation.

## Acceptance criteria

1. All six directions appear with an exact dark/light pair and an identical overlay/content frame.
2. Native radio controls switch the study accent between emerald, coral, and violet with no script.
3. Text, table rules, focus indication, and overlay boundaries remain legible in both themes.
4. `prefers-reduced-transparency` and `forced-colors` have explicit, quiet fallbacks.
5. The page has no external asset requests other than existing local Zx styles and logo assets.
6. `node --test tests/unit/aurora-preview.test.js` passes.
7. Browser inspection at desktop and mobile widths reports no console errors or page overflow.

## Out of scope

- An `Aurora` class, function, custom element, CSS utility, public token set, or package export.
- Selecting a final direction or promising backward compatibility for any study variable.
- Animating the gradients.
- Adding the preview to the public documentation registry, search index, header, or footer.
- Publishing, tagging, or releasing the library or website.
