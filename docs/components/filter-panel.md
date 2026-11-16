# FilterPanel — typed filters from server metadata

The filter form a data-driven list needs: field metadata in, a query object out.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/filter-panel · All components: https://zx.zeyos.com/docs/components/index.md

The third filter component, and the one a data-driven application reaches for. `DataFilter`
filters a client-side row set; `Filter` builds a backend-neutral AST with groups and operators.
`FilterPanel` takes the `{key: {type, label, options, min, max}}` map a list endpoint already
publishes and gives back a query object — so the shape the server describes is the shape the
form renders, with no per-application translation layer in between.

- **Options** — `fields: Record<string, {type, label?, options?, min?, max?, step?, search?}>`,
  `order` (display order; omitted uses object order), `value` (the applied filters, drafted
  from), `mode: 'draft'|'live'`, `serialize: 'seconds'|'ms'|'iso'|(date, edge) => unknown`,
  `timeZone` (IANA zone the days are counted in; null = the runtime's own), `emptyText`, `msg`.
- **Types** — `text`, `select`, `date`, `date:range`, `int`, `float`, `number`, and
  `int:range` / `float:range` / `number:range`. An unrecognised type renders a visible,
  labelled placeholder naming it and is excluded from the value — never dropped silently.
- **Methods** — `getValue()`, `setValue()`, `apply()`, `reset()`, `clear()`.
- **Events** — `apply {value}`, `change {value, field}`. Values read back from typed controls
  include their normalization, such as integer rounding and numeric bounds.

Five behaviours are deliberate rather than incidental:

- **A select is multi-valued.** "Open or waiting" is the common request, and single choice turns
  it into two visits. It composes `Checklist`, which brings its own search past eight options,
  and the group is named after the filter rather than after the component.
- **Each end of a range carries its own accessible name.** One `<label for>` cannot name two
  inputs, and a group label that names neither is worse than no group label.
- **`clear()` commits; `reset()` does not.** Clear is "no filters" and applies immediately —
  emptying the controls while the list stays filtered is a panel that lies about what is on
  screen. Reset restores the constructed value without committing, which is a host sheet's
  Cancel.
- **An empty `fields` map is normal.** An instance that configures no filters for a settings
  section is the ordinary case; the panel renders `emptyText`, never an error.
- **`0` is a value.** `''`, `null`, `[]` and `{from: null, to: null}` are not, and only active
  constraints reach the emitted value.

`serialize` decides how a date leaves the component, because the answer is a wire-format
decision rather than an application one. A range's upper bound takes the **end** of its day, or
a one-day range matches nothing. `timeZone` decides *which* day: with the ZeyOS instance's zone
(`'Europe/Vienna'`), 15 January serializes from 23:00 UTC on the 14th wherever the browser is, and
an incoming Unix timestamp shows as the day it falls on there — the rule `zeyosForm()` and
`zeyosTable()` apply to date-only fields. An unknown zone throws a `RangeError`.
