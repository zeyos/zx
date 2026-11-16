# truncate()

Clamps text to a number of lines and hands the cut-off text back on hover — because a cell that silently drops the end of a value is a data-loss bug wearing a layout costume.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/truncate · All components: https://zx.zeyos.com/docs/components/index.md

Clamps text to a number of lines and gives the cut-off text back on hover. The tooltip half is
what makes it more than a CSS class: a cell that silently drops the end of a value is a data-loss
bug wearing a layout costume, while a tooltip that is always there is noise.

- **Signature** — `truncate(target, {lines, title})` → `{update, isTruncated, destroy}`.
- **Options** — `lines: 1` (1–10; one line ends in an ellipsis, more clamp the block),
  `title: true` — sets a native `title` **only while the text is actually cut off**, re-measured
  through a `ResizeObserver` on every resize, and restores any previous title on `destroy()`.
- **Controller** — `update()` re-measures and returns the current state, `isTruncated()` reports
  the last measurement, `destroy()` removes the class, the observer, and any title it set.
- **Exported helper** — `isTruncated(element)` compares scroll and client sizes on both axes (a
  single line runs out of width, a clamped block runs out of height) with a one-pixel tolerance
  for the sub-pixel difference fractional zoom produces.
- **Class** — `.zx-truncate` alone does the clamping from static markup with no JavaScript;
  `data-lines` plus `--zx-truncate-lines` select the multi-line form.
