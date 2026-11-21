# Design tokens

Two tiers of CSS custom properties.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/tokens · All components: https://zx.zeyos.com/docs/components/index.md

Two tiers of CSS custom properties. Dark mode is a pure token/attribute swap
(`[data-zx-theme="dark"]`), there is one geometry derived from `--zx-space-unit` and
`--zx-radius`, and `tests/lint-tokens.js` forbids raw colour literals and tier-1 colour references
in component CSS.

- **Tier 1** — the global palette and primitives in `styles/tokens/global.css`: `--zx-gray-0…950`,
  `--zx-emerald-*` (the brand ramp the default accent reads), the status ramps
  `--zx-green/red/amber/blue-*` (green is a yellow-green, deliberately apart from the brand), the
  tone ramps `--zx-tone-<hue>-300/500/700` — none of them referenced by components — plus the
  spacing scale (`--zx-space-unit`, `--zx-space-1…8`), the radius scale (`--zx-radius`,
  `--zx-radius-sm/md/lg/xl/full`), the type scale (`--zx-text-xs…3xl`, 12–30px), weights
  (`--zx-weight-medium` 500, `--zx-weight-semibold` 600), tracking (`--zx-tracking-tight`
  -0.01em, set on `.zx-scope`; `--zx-tracking-title` -0.015em), shadows, and motion
  (`--zx-dur-fast` 120ms, `--zx-dur-base` 180ms — both 0ms in a reduced-motion region — and the
  curves `--zx-ease`, `--zx-ease-spring`, `--zx-ease-drawer`).
- **Tier 2** — the semantic set, the only tokens components may use: `--zx-color-*`,
  `--zx-control-*`, `--zx-focus-ring`, `--zx-surface-shadow` (the contact shadow of a resting
  surface: a panel, an outlined card in a lane, a slider thumb), `--zx-overlay-shadow`,
  `--zx-drag-shadow` (an item being dragged; its own value in dark, with a faint light rim). The
  lint also rejects the accent ramp `--zx-accent-*`, the module palette `--zx-module-*`, and the
  raw `--zx-shadow-*` steps in component and layout CSS, and any `outline: 0`/`outline: none`:
  forced-colors mode drops the box-shadow focus ring, so components make the outline transparent
  and `styles/base.css` repaints it in a system colour there. The roles that carry the visual
  language:
  - **Columns.** `--zx-color-bg-surface` is the working canvas; `--zx-color-bg-chrome` is the
    navigation and inspector tone beside it (one step below the canvas in light, between page and
    canvas in dark), so tone rather than a line separates them. Dividers inside a column use
    `--zx-color-border-subtle`; `--zx-color-border` is for frames.
  - **Current vs selected.** Where you *are* — the active navigation item, the current row, the
    open node, the active view — is neutral: `--zx-color-bg-current` (translucent text, about 8%,
    so it works on any column), text colour, weight 600. Hover is `--zx-color-bg-hover`, about half
    as strong. What you have *picked* keeps the accent tint `--zx-color-bg-selected`.
  - **Text.** `--zx-color-text`, `--zx-color-text-muted` (secondary text, 4.5:1 on every column and
    on a current row), `--zx-color-text-subtle` (icons and non-essential meta, 3:1),
    `--zx-color-text-placeholder`.
  - **Solid accent.** `--zx-color-accent-solid` (`-hover`, `-active`) with
    `--zx-color-on-accent-solid` is the one primary action per screen: the 600 stop with white ink in
    both themes. `--zx-color-accent` is the accent as text, marks, and focus (600 in light, 400 in
    dark) and pairs with `--zx-color-on-accent` when something is filled with it.
  - **Status.** `--zx-color-success/warning/danger/info` and their `-bg` fills mean state and
    nothing else; they ship with an icon or a word.
  - **Tones.** `--zx-color-tone-{blue,teal,green,amber,orange,red,pink,violet,slate}-bg` and `-fg`:
    categorical colour for tags, chips, icon tiles, and avatars — neither the accent nor a status. A
    soft fill (13% of the tone over the surface in light, 20% in dark) with ink at 4.5:1 or better.
  - **Chart series.** `--zx-color-chart-1…8`, assigned in order, never cycled: blue, orange, teal,
    amber, pink, green, violet, red. Neighbours stay apart under red-green colour-vision deficiency
    and every series clears 3:1 as a mark on the light and the dark surface; the list does not open
    on the accent.
- **Component styling hooks** — a short, deliberately small set of component-level custom
  properties for restyling one component without touching its internals. Each falls back to the
  semantic token it replaces, so setting none of them changes nothing:
  `--zx-table-header-bg`, `--zx-table-row-hover-bg`, `--zx-table-row-selected-bg`,
  `--zx-table-border-color`, `--zx-table-pin-bg` (the opaque base of pinned columns; the header
  background unless set), `--zx-button-radius`, `--zx-panel-header-bg`, `--zx-message-offset`
  (the distance of floating messages from the viewport edge; `--zx-space-4` unless set).
  `--zx-chart-min-block-size` is public as well, with a fixed 220px default rather than a token.
  Reach for the least specific override that works: a global semantic token first, one of these
  second, an internal selector never. Component CSS declares many other `--zx-<component>-*`
  properties — those are internal geometry, not API, and will change without notice.

**Base typography.** `.zx-scope` sets Inter with `--zx-tracking-tight` and the `cv11` feature (the
single-storey a, chosen because it reads rounder and calmer at 13–14px; fonts without it ignore it).

**Quiet fields.** Put `data-zx-fields="quiet"` on a property panel, an inspector, or an inline
record: native inputs, selects, and textareas inside it drop their border and fill until hover
(`--zx-color-bg-hover`) or focus (the normal border, the control fill, and the focus ring), so values
read as text rather than as a wall of boxes. Read-only and disabled fields stay quiet. The rules have
zero specificity, so a component's own input styling still wins.

**Revealed actions.** Mark a row or a section heading `data-zx-reveal-host` and a secondary action
inside it `data-zx-reveal`: the action rests invisible and appears while the host is pointed at,
holds focus, is current or selected, or has a menu open. It keeps its space, so nothing shifts, and
stays in the tab order, so focusing it shows it. On touch screens, under `prefers-contrast: more`
and in forced colours it is always visible. Use it only for repeated, secondary per-row actions
that are reachable another way (a context menu, a keyboard shortcut); a primary action stays
visible. Hosts do not nest.

**Focus targets.** `.zx-scope` draws the focus ring on whatever matches `:focus-visible`, and
Chrome matches any focused element once a key has been pressed — even Shift — so a click into a
focusable panel followed by a keystroke would ring the whole panel like a field. An element that
takes focus without being a control says which kind it is with `data-zx-focus`:
- `data-zx-focus="container"` — only a script focuses it (`tabindex="-1"`, never a Tab stop): a
  view root that keeps its shortcuts reachable, a heading a route change moves the reader to, a
  panel holding focus after the control in it went away. It draws no ring and no outline, in forced
  colours either; its own box-shadow (an overlay's elevation) stays.
- `data-zx-focus="region"` — a Tab stop that is not a control: a scroll region the keyboard has to
  reach, a tab panel with nothing inside to operate. Keyboard focus there stays visible as a ring
  inside its edge, drawn as an outline so the region's own content cannot cover it; forced colours
  paint it in the system highlight.

Set it when the element is created; it only matters while the element has focus. It works on the
`.zx-scope` element itself as well as on anything inside it. Zx components
mark their own: the Modal, Dialog and Sheet panel, a Dropdown panel only a script focuses, the
ApprovalCard and RunStatus roots, Questionnaire's question and review, Surface's verdict and the
emptied Table and CardView bodies are containers; tab panels, code blocks, a Dropdown panel with a
`tabindex` of 0 or more, and the scroll regions of Table, Dock and MasterPanel are regions.
