# Aurora

A CSS-driven, multicolour ambient light field that decorates an existing surface without owning its content or application logic.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/aurora · All components: https://zx.zeyos.com/docs/components/index.md

A decorative, CSS-driven ambient light field for an existing application surface. Aurora enhances
the target in place: it does not wrap, replace, or relocate the surface's content, and it does not
own routing, overlays, or interaction. Its gradients sit behind the target's children, so raised
Cards and other Liquid Glass surfaces can pick up the underlying colour naturally.

- **Options** — `preset: 'source'|'confluence'|'horizon'|'diagonal'|'edge'|'curtain'|'mesh'|'ribbon'|'bloom'`,
  `colors: []` (zero to four concrete CSS colours),
  `intensity: 'subtle'|'balanced'|'vivid'`, `motion: 'none'|'drift'|'flow'`.
- **Methods** — `setPreset(preset)`, `setColors(colors)`, `setIntensity(intensity)`,
  `setMotion(motion)`.
- **Palette** — an empty list uses semantic accent, info, success, and warning colours. One colour
  fills all four fields; two alternate; three repeat the second colour in the fourth field; four
  map directly. Network/image-bearing CSS values and palettes longer than four are rejected.
- **Geometry** — Source starts at the leading chrome; Confluence meets from the corners; Horizon
  forms a shallow top band; Diagonal crosses the surface; Edge preserves a neutral centre; Curtain
  descends as four elongated fields; Mesh binds four fields with a wash in the middle; Ribbon hangs
  two arcs of light from above the top edge; Bloom rises from below the bottom edge. All are
  ordinary CSS gradients, written into `--zx-aurora-image`.
- **Motion** — `drift` lets the field breathe while two lights wander across it; `flow` turns a disc
  of colour slowly behind it. For either, Aurora adds one `<span class="zx-aurora__motion"
  aria-hidden="true">` as the target's first child, clipped to the surface, and moves its layers by
  transform alone, so nothing repaints. `--zx-aurora-duration` (18s) sets the pace. Readers who ask
  for reduced motion see the static field.
- **Lifecycle** — `destroy()` removes an owned root or restores every original attribute and child
  of an enhanced target. Content is never rebuilt when a setter changes the effect; `setMotion()`
  adds or removes only the motion element.
- **Accessibility** — the light field is pointer-transparent and purely decorative. Forced-colour
  and reduced-transparency preferences remove it entirely.
