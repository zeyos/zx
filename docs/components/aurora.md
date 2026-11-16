# Aurora

A CSS-driven, multicolour ambient light field that decorates an existing surface without owning its content or application logic.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/aurora · All components: https://zx.zeyos.com/docs/components/index.md

A decorative, CSS-driven ambient light field for an existing application surface. Aurora enhances
the target in place: it does not wrap, replace, or relocate the surface's content, and it does not
own routing, overlays, or interaction. Its gradients sit behind the target's children, so raised
Cards and other Liquid Glass surfaces can pick up the underlying colour naturally.

- **Options** — `preset: 'source'|'confluence'|'horizon'|'diagonal'|'edge'|'curtain'`,
  `colors: []` (zero to four concrete CSS colours),
  `intensity: 'subtle'|'balanced'|'vivid'`.
- **Methods** — `setPreset(preset)`, `setColors(colors)`, `setIntensity(intensity)`.
- **Palette** — an empty list uses semantic accent, info, success, and warning colours. One colour
  fills all four fields; two alternate; three repeat the second colour in the fourth field; four
  map directly. Network/image-bearing CSS values and palettes longer than four are rejected.
- **Geometry** — Source starts at the leading chrome; Confluence meets from the corners; Horizon
  forms a shallow top band; Diagonal crosses the surface; Edge preserves a neutral centre; Curtain
  descends as four elongated fields. All use ordinary CSS gradients without animation.
- **Lifecycle** — `destroy()` removes an owned root or restores every original attribute and child
  of an enhanced target. Content is never rebuilt when a setter changes the effect.
- **Accessibility** — the light field is pointer-transparent and purely decorative. Forced-colour
  and reduced-transparency preferences remove it entirely.
