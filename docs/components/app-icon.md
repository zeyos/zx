# AppIcon — application identity

A stable application identity with a centred white glyph, module colour, tile or circle geometry, accessible labeling, interaction-aware feedback, badges, selection state, and an optional CSS-first glass material.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/app-icon · All components: https://zx.zeyos.com/docs/components/index.md

A fixed-size, product-agnostic application identity. It keeps glyph geometry stable in launchers,
sidebars, entity results, and recent-item rows while identity colour and material remain explicit
options rather than application globals.

- **Options** — `icon` (bundled name, Node, or lazy renderer), `color` (any CSS colour) or `tone`
  (one of the nine categorical tones, drawn with its `--zx-color-tone-<tone>-solid` fill; `color`
  wins when both are given), `size: 36`,
  `iconSize: '52%'`, `label`, `badge`, `selected: false`, `shape: 'tile'|'circle'`,
  `glass: false|'subtle'|'strong'`, and
  additional `class` names.
- **Methods** — `set(partialOptions)` updates the existing root; `destroy()` restores an enhanced
  target. `appIcon(options)` is the element-returning convenience factory.
- **ZeyOS preset** — import `zeyosAppIcon(module, options)` from `@zeyos/zx/zeyos`. Every current
  ZeyOS application/module has a canonical colour and icon mapping in `src/zeyos/modules.js`;
  entity names and aliases resolve through the same catalogue. `zeyosAppIcon()` defaults to a
  circular application vessel; `moduleChip()` deliberately keeps a compact tile for entity and
  record identity. An application may call `useZeyosIcons()` for the existing custom glyph kit or
  inject an offline `icon` override; Zx never loads a network asset automatically.
- **Shape and material** — core `AppIcon` keeps the backward-compatible `tile` default. Application
  launchers and rails use `circle`; entity rows, recent records, badges, and tables use `tile`.
  Subtle glass uses a quiet colour bloom, rim, reflection, and shadow without per-icon backdrop
  blur; strong glass increases those material cues without changing geometry.
  `prefers-reduced-transparency` receives a solid surface. Glyphs remain crisp white and
  geometrically centred in either built-in SVG or Font Awesome form. Enabled interactive hosts
  respond through rim, light, and shadow without translating the icon; decorative and disabled
  identities do not imply clickability.
- **Accessibility** — on an owned identity surface, a non-empty `label` gives the root
  `role="img"`; otherwise it is decorative. When AppIcon enhances a button or link, it preserves
  that control's native role and uses `label` only as its accessible name. The badge is visual
  supplementary status, so include its meaning in `label` when it matters.
