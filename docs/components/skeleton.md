# Skeleton

Placeholders shaped like the content that is coming, so the layout does not jump when it arrives.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/skeleton · All components: https://zx.zeyos.com/docs/components/index.md

Placeholders shaped like the content that is coming, so the layout does not jump when it arrives.
That is the whole reason to prefer them over a spinner, and the reason they only pay off where the
shape is genuinely known. All three are factories returning elements.

- **Factories** — `skeleton({width, height, radius})` → one block; `skeletonText({lines, width,
  heading, lastLineWidth})` → a stack of lines; `skeletonTable({rows, columns, header})` → the
  grid a table will fill.
- **skeleton options** — `width: '100%'`, `height: '1rem'` (a number is read as pixels),
  `radius: 'sm'|'md'|'full'`. Equal sides plus `radius: 'full'` gives the circle an avatar or icon
  placeholder needs.
- **skeletonText options** — `lines: 3` (1–20), `width: '100%'`, `heading: false` (draws the first
  line taller), `lastLineWidth: '60%'` — the short final line is what makes the block read as
  prose rather than as a filled rectangle.
- **skeletonTable options** — `rows: 5` (1–50), `columns: 4` (1–20), `header: true`. Rendered as
  plain elements, not a `<table>`: there is no data to expose, and a table whose cells are all
  empty is worse for assistive technology than no table at all.
- **Accessibility** — every skeleton is `aria-hidden`, because a screen reader gains nothing from
  an announced grey box. Set `aria-busy="true"` on the region being filled and remove it together
  with the placeholder.
- **Behaviour** — the pulse is wrapped in `prefers-reduced-motion: no-preference`; without motion
  a legible static block stays behind.
