# Stepper

The wizard progress rail: four step states, an optional “Step 2 of 4” counter, and a preventable change event so a step can refuse to be left.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/stepper · All components: https://zx.zeyos.com/docs/components/index.md

Linear progress through a multi-step flow: a numbered `<ol>` where each step is upcoming, active,
complete, or errored. It promotes the markup the checkout and record wizards used to hand-roll.
Advancing past a step marks it complete automatically, and only steps the `clickable` policy allows
are rendered as real buttons — the rest are not focusable at all. A horizontal rail fills the width
it is given: the labels keep their own width and the connectors stretch to take the slack, wrapping
onto more lines only when the container is too narrow to hold them. A wrapped row ends at its last
step: no connector runs on from it to the container's edge. The component marks that step with
`data-row-end` as the layout changes.

- **Options** — `steps: [{name, title, description?, optional?, disabled?}]`, `active` (defaults to
  the first enabled step), `orientation: 'horizontal'|'vertical'`, `clickable:
  'completed'|'all'|false` (default `'completed'`, so users can go back but not skip ahead),
  `showNumbers: true`, `counter: false` (adds a "Step 2 of 4" line).
- **Methods** — `setSteps()`, `goTo(name)`, `next()`, `previous()`, `getActive()`, `getIndex()`,
  `complete(name)`/`uncomplete(name)`, `setError(name, boolean)`, `setDisabled(name, boolean)`,
  `getState()` → `{active, index, completed, errored}`, `destroy()`.
- **Events** — `change {name, previous, index}`, **preventable** with `event.preventDefault()` so a
  step can refuse to be left until its form validates.
- **Semantics** — the active step carries `aria-current="step"`; every step carries
  `data-state="upcoming"|"active"|"complete"|"error"`, and complete and errored steps swap the
  number for a `check` or `warning` glyph.
