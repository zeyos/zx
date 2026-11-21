# RunStatus

Where an agent's run stands: its state in a glyph and a word, what it is doing, its steps, its clock, and what it has cost against its budget.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/run-status · All components: https://zx.zeyos.com/docs/components/index.md

Where an agent's run stands, for a run panel or a narrow header: the state as a glyph and a word,
one sentence on what is happening, the steps as a progressbar, when it started and how long the
agent has worked, the tokens, and the cost against a budget. It draws the values it is given and
announces nothing itself; the thread the run belongs to announces its milestones.

- **Options** — `state` (a run state: `queued`, `running`, `waiting`, `paused`, `blocked`, `done`,
  `failed`, `stopped`, `skipped`; default `'queued'`, reflected as `data-state`), `summary` (one
  sentence, text only), `steps: {done, total}|null`, `started`, `finished` and `waitingSince`
  (local ISO date-time strings or `Date`s), `workMs` (milliseconds worked; the row shows only when
  it is a number), `tokens: [in, out]|number|null` (the pair, or the total as one number),
  `tokenBudget: number|null`, `cost: {amount, budget?, currency}|null`, `model`, `agent`
  (`{seed?, name?, tone?, body?, eyes?, material?}` or `true`: the agent's face before the state,
  working while it runs, looking up while it waits, blocked when blocked or failed, at rest
  otherwise; the compact pill leaves it out), `actions: [{label, kind?, icon?, onclick?}]`, `ticking: true`, `compact: false|true|'icon'`,
  `now: (() => Date)|null`, `locale`, and `msg` (the `agent.status.*` words and the `runStatus.*`
  labels).
- **Rendering** — the state line; the summary; a `role="progressbar"` whose `aria-valuetext` reads
  "3 of 6 steps"; the actions as small buttons; and a `<dl>` of Started, Working time, Waiting
  since (while `waiting`) or Blocked since (while `blocked`), Finished / Failed at / Stopped at
  (once the run is over), Model, Tokens ("18,420 in · 1,236 out", or "22,840" for a total) and
  Cost. With a `budget` the cost is a `role="meter"` reading "€0.14 of €2.00" whose `data-level`
  is `warning` from 80% and `danger` at 100%. With a `tokenBudget` the tokens are a meter the same
  way, in the locale's compact figures (`Intl.NumberFormat` `notation: 'compact'`): "22.8K of 60K
  tokens"; without one they stay text. A time on another day than today shows its date too.
- **Blocked** — `blocked` is a glyph and the word "Blocked" in the danger tone, and the steps bar
  takes the danger tone. A blocked run is not over: it shows "Blocked since" from `waitingSince`
  and never a finished time.
- **Compact** — `compact: true` (reflected as `data-compact`) draws only the state, glyph and
  word, as a pill for a header too narrow for the panel. `compact: 'icon'`
  (`data-compact="icon"`) draws the glyph alone, for a list row: the word stays in the pill,
  visually hidden, as its accessible text, and is the pill's `title` tooltip.
- **Ticking** — while `state` is `running` and `ticking` is on, the working time counts on once a
  second from `workMs` and the moment of the last `update()`, through one interval that sleeps
  while the page is hidden. Leaving `running` freezes the clock where it stands. `now` replaces
  the clock, both for that count and for deciding whether a time is today; a fixed `now` makes the
  panel deterministic for screenshots and tests. It is fixed at construction.
- **Focus** — `update()` keeps focus where it was: an action row whose labels, kinds, and icons did
  not change is kept as it is, so the focused button never leaves the DOM; otherwise focus goes to
  the action at the same index, or the nearest one left. When no action is left the panel itself
  holds focus (`tabindex="-1"` with `data-zx-focus="container"`, so no focus ring; both removed
  again once focus moves on).
- **Methods** — `update(values)` merges new values and redraws (the clock carries on unless the
  update brings a new `workMs`; `locale`, `msg`, `now`, and `onaction` are fixed), `getState()`
  (the values as copies, `tokenBudget` included, `workMs` counted up to now), `destroy()`.
- **Events** — `action {index, action}`, after the descriptor's own `onclick`.
