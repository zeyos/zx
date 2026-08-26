# WP22 — Aurora multicolour surface helper and examples

Branch: work on `main`. Read `AGENTS.md` before changing this work package.

## Objective

Promote the Aurora lighting exploration into a dependency-free Zx surface decorator that can add
one- or multicolour ambient illumination behind existing application content. Provide both normal
component documentation and a standalone example page that demonstrates Aurora with dense business
UI and Liquid Glass surfaces.

## Scope

Only these files may be created or changed:

```
specs/WP-22-aurora.md
src/components/aurora/aurora.js
src/components/aurora/aurora.css
src/index.js
styles/zx.css
website/demos/aurora.demo.js
website/docs.js
website/aurora.html
website/aurora.css
website/aurora.js
website/aurora-preview.html
website/aurora-preview.css
docs/llms.md
docs/llms.txt
website/llms.txt
docs/api.json
README.md
tests/unit/aurora.test.js
tests/smoke/smoke.js
```

## Public API

`Aurora` extends `Component` and enhances an existing surface without owning its application
content. A null target creates an empty `<div>` that callers may compose normally.

```js
new Aurora(target, {
  preset: 'source',
  colors: [],
  intensity: 'subtle'
});
```

- `preset`: `source | confluence | horizon | diagonal | edge | curtain`.
- `colors`: zero to four concrete CSS colours. An empty list uses the semantic Zx accent, info,
  success, and warning roles. A shorter non-empty palette repeats predictably across four fields.
- `intensity`: `subtle | balanced | vivid`.
- `setPreset(preset)`, `setColors(colors)`, and `setIntensity(intensity)` update the lighting
  without replacing content.
- `destroy()` removes an owned root or restores an enhanced root's original attributes and children.

Invalid preset, intensity, colour type, colour value, or a palette longer than four throws a
`TypeError`. Colour validation must reject executable/image/network-bearing CSS values.

## Styling contract

- `.zx-aurora` creates an isolated stacking context and a pointer-transparent `::before` light
  field behind its content.
- The six presets use ordinary CSS `radial-gradient()` and `linear-gradient()` layers only.
- Default colours resolve from tier-2 semantic colour tokens. Option colours are written to
  `--zx-aurora-color-1` … `--zx-aurora-color-4` on the root.
- Light, dark, and automatic themes get tuned intensity values; application content stays dominant.
- `prefers-reduced-transparency` and `forced-colors` remove the decorative light field.
- No animation is included.

## Documentation and examples

- Register `Aurora` in the Layout documentation group with examples for enhancing a surface,
  multicolour geometry presets, and composition with a raised/Liquid Glass Card.
- Add `website/aurora.html` as a standalone example. It must contain a live dense workspace,
  controls for preset/palette/intensity, six multicolour preset samples, and copyable usage code.
- Link the original single/two-colour study to the component example page without adding either
  experimental page to the primary site navigation.

## Acceptance criteria

1. No runtime dependency is added; the source runs directly as an ES module.
2. One to four colours render as a four-field palette and setters update in place.
3. All six geometries visibly use more than one colour when given a multicolour palette.
4. Enhanced targets keep their content and restore exactly on destroy; owned roots are removed.
5. API reference generation, package build, full unit suite, and token lint pass.
6. Documentation demo and standalone example render without console errors.
7. Standalone example has no horizontal overflow at 1440 px or 390 px and remains legible in
   light and dark themes.

## Out of scope

- Canvas, WebGL, SVG filters, noise textures, generated image assets, or external requests.
- Gradient animation or pointer-following effects.
- Choosing Aurora automatically from a ZeyOS module; applications pass their module palette.
- Changing routing, overlay behaviour, Liquid Glass material tokens, or existing components.
- Publishing, versioning, tagging, or deployment.
