# Badge — `badge(options)` / `badgeGroup(badges)`

A status pill or a tag you place yourself: kind says how something is doing, tone what it is, and the shape follows.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/badge · All components: https://zx.zeyos.com/docs/components/index.md

Factories (not classes) returning a chip: a small, non-interactive `<span>` carrying a semantic
colour — a status — or, with `tone`, a categorical one — a tag — used for stages, counts, labels,
and record-header metadata. A badge with no label but a `title` is named for assistive technology
through `role="img"`; everything else is plain text and needs no ARIA.

- **Options** — `label`, `icon` (an icon name, rendered before the label), `kind:
  'neutral'|'accent'|'success'|'warning'|'danger'|'info'`, `tone:
  'blue'|'teal'|'green'|'amber'|'orange'|'red'|'pink'|'violet'|'slate'|null`, `variant:
  'soft'|'solid'|'outline'`, `size: 'md'|'sm'`, `dot` (a leading status dot instead of an icon),
  `title`.
- **`kind` vs `tone`** — `kind` says how something is doing (status); `tone` says what it is (a
  project, a label, a module) and draws from the `--zx-color-tone-*` palette, which is neither the
  accent nor the status set, so a project tagged red never reads as an error. When `tone` is set it
  decides the colour and `kind` is ignored for it; every `variant` still applies (soft: tinted,
  borderless; solid: filled with the tone's ink; outline). The badge carries `data-tone`. Badges
  are sentence case.
- **Two shapes, one construction** — a status is a pill (`--zx-radius-full`); give a workflow state
  `dot: true`, a 6px dot centred in the pill's round end. A tag (any badge with a `tone`) has small
  corners (`--zx-radius-md`). Both are one fill and no line, 12px at weight 500 at either size,
  and their height follows the row they sit in: about five ninths of `--zx-row-height` for `md`
  and half of it for `sm` (20px and 18px in the default row), never below a line of their own text,
  so a chip follows the row height setting without making a row taller. `TagPicker` builds its tags with
  `badge()`, so a label reads the same in a list row, a record header and the field that edits it.
- **Neutral and small** — the neutral soft fill is a wash of the text colour, not an opaque surface
  step, so it stays visible on raised surfaces in the dark theme. `size: 'sm'` fits table cells
  and board cards; it is shorter and tighter, never smaller type. Under `prefers-contrast: more` a
  soft badge gets its edge back, and under forced colours every badge does.
- **Methods** — none. `badge(options)` → `HTMLSpanElement`, `badgeGroup([badge(…), …])` → a wrapping
  inline row with its own spacing; you own both elements.
- **Events** — none; a badge is not interactive.
