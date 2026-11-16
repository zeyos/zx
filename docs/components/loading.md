# Spinner / ProgressBar / InlineLoading

Three shapes of "wait": a ring when the duration is unknown, a track when the share done is known, and a status line that resolves into its own outcome.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/loading · All components: https://zx.zeyos.com/docs/components/index.md

Three shapes of "wait". A **spinner** when the duration is unknown and there is nothing to say
about progress; a **progress bar** when the completed share is known; **inline loading** when the
wait resolves into its own outcome in the place it started. `spinner()` is a factory returning an
element — there is no state to update and nothing to destroy — while the other two are components.

## spinner()

- **Signature** — `spinner({size, label, showLabel, kind})` → `HTMLSpanElement`.
- **Options** — `size: 'sm'|'md'|'lg'` (16px, 24px, 40px), `label: ''`, `showLabel: false`,
  `kind: 'accent'|'current'` — `current` draws the ring in `currentColor`, which is what a ring
  inside a button or a badge needs.
- **Accessibility** — a `label` makes the element `role="status"` and keeps the text in the
  accessibility tree even when `showLabel` is false; without a label the ring is `aria-hidden`,
  which is correct whenever a nearby element already announces the wait.

## ProgressBar

- **Options** — `value: 0`, `max: 100`, `label: ''`, `helperText: ''`,
  `status: 'active'|'success'|'error'`, `indeterminate: false`, `size: 'md'|'sm'`,
  `hideLabel: false`, `showValue: true`, `formatValue: (value, max) => string`.
- **Methods** — `get()`, `set(value, {silent})` (clamped to `[0, max]`), `percent()`, `setMax()`,
  `setStatus(status, helperText?)`, `setLabel()`, `setHelperText()`, `setIndeterminate(flag)`.
- **Events** — `change {value, percent}`, `complete {value}` once the value reaches `max`.
- **Behaviour** — `status` is a display concern only: a run that failed at 100% still reads 100%.
  An indeterminate bar drops `aria-valuenow` rather than reporting a number it does not have, and
  under reduced motion its travelling band becomes a static muted track — visibly busy, never a
  wrong number.
- **Accessibility** — the track is `role="progressbar"` with `aria-valuemin`, `aria-valuemax`,
  `aria-valuenow`, and `aria-valuetext`, labelled by the visible label (kept for assistive
  technology when `hideLabel` is set).

## InlineLoading

- **Options** — `status: 'inactive'|'active'|'success'|'error'`, `description: ''`,
  `size: 'sm'|'md'`, `live: true`.
- **Methods** — `get()`, `getDescription()`, `set(status, description?, {silent})`,
  `setDescription()`.
- **Events** — `statuschange {status, description}`.
- **Accessibility** — the whole element is one polite live region (`role="status"`), so the
  outcome is announced without the focus moving off the control that started the work. Use
  `Message` instead when the outcome deserves a dismissible notification rather than a line of
  text that stays put.
