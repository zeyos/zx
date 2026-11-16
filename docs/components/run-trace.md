# RunTrace

What an agent did during a run: a one-line summary that opens into a timeline of its steps, each tool call opening to its arguments and result.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/run-trace · All components: https://zx.zeyos.com/docs/components/index.md

What an agent did during a run: a one-line summary ("Worked for 41 s · 5 tool calls · 9 sources ·
1 retry") that opens into a timeline of its steps. A tool call opens to the arguments it was made
with and what came back; a retry is drawn under the call it repeats; a hand-off shows both agents.
The same component draws a plan: `task` steps under a `label` of the plan's own, the people's
`ask` and `decision` steps among them, chosen one at a time with `selectable`. The trace changes
only when the application calls `setSteps()`, `upsert()` or `setLabel()`.

- **Options** — `steps: []` (`TraceStep[]`, in the order they started), `open: false` (the step
  list starts open), `label: null` (text the summary reads instead of the computed line — "Close
  September · 2 of 5 done"; every state but done still follows it as a word, "· Running"),
  `authors: {}` (who the steps' `actor` and `to` keys name), `showArguments: true`,
  `maxResult: 4000` (characters of a result shown before a "Show all" button; 0 shows every
  result whole), `summary: true` (false: no summary line, the list always shows — for a run panel
  whose state is told beside it), `kindIcons: null` (whether a step leads with its kind's glyph;
  null hides them for a plan whose steps are all `task`s), `selectable: false` (every step can be chosen, see Events), `ticking: false`
  (a running step that has `at` counts its time once a second, on from its `ms` when it was
  resumed), `now: null` (`() => Date`, the
  clock `ticking` counts against, for an application whose world is fixed on another date; real
  time when null), `formatTime: null` (`(at) => string`, how a step's start time is written;
  "10:31:05" when null), `icons: {}` (glyph per step kind over the built-in `search`→search,
  `read`→file, `query`→table, `write`→type, `run`→code, `call`→gear, `handoff`→link-2,
  `think`→dots, `task`→list, `ask`→mail, `decision`→check), `msg` (`runTrace.*` and the
  `agent.status.*` words).
- **Methods** — `setSteps(steps)` (open steps stay open, focus stays on its step),
  `upsert(step)` (replaces the step with the same `id` and redraws only that step, keeping its
  retries, its open state, and focus on its row or links; a new step is appended, under the step
  it repeats when it has `retryOf`), `setLabel(text|null)` (null or `''` goes back to the computed
  line), `expand(id?)` (opens the list, and that step), `collapse(id?)` (closes the list, or only
  that step), `reveal(id)` (opens the list and the step, scrolls to it, focuses its row and marks
  it `data-state="revealed"` for 2 s; the scroll jumps under reduced motion), `getSteps()`,
  `isOpen()`, `destroy()` (also stops the clock).
- **Events** — `toggle {id, open}` whenever the list (`id: null`) or a step opens or closes, from a
  click or a method; `reveal {id}`; `open {step, ref}` when one of a step's links is activated
  (copies; the application opens what the `ref` names); `select {id}` in a `selectable` trace when
  the reader activates a row with nothing to open, or opens a step's disclosure (not from
  `expand()` or `reveal()`, so an application can answer `select` with them).
- **Rendering** — while a step runs the summary reads "Working…" with the step's `doing` line, and
  the step shows "Reading the policy…"; with `ticking` and an `at`, its end shows how long it has
  run ("41 s", "1 min 42 s"). A waiting or blocked run says so and names the step ("Blocked after
  12 s · 3 tool calls"); paused, stopped and failed runs say so first ("Failed after 12 s · 3
  tool calls"); a run no step of which has started reads "Not started · 6 steps". Counts are left
  out at zero, and `think`, `handoff`, `task`, `ask` and `decision` steps are not tool calls. Each
  step's muted meta line follows its label and wraps under it only when narrow: the `count`, a
  search's `sources`, the actor's name, the start time (`<time>`, tabular figures) and the
  `tokens` it used ("912 tokens"), each only when present. A step's `refs` (`ItemRef[]`, `{id,
  label, icon?, entity?}`) are quiet underlined link buttons under its words, with the glyph when
  `icon` is set. A step with `args`, `result`, `error` or `detail` is a disclosure holding the tool
  name (mono), the detail, the arguments (pretty-printed when they parse as JSON, verbatim
  otherwise) and the result or the error, each in a focusable `<pre>` with a copy button. A
  `handoff` step reads "Finance agent handed over to Collections agent" beside both authors'
  avatars joined by a dotted line — round for a `person`, a rounded square for an agent or a
  model — and its own label moves to the meta line.
- **Accessibility** — the summary and every step with content follow the APG Disclosure pattern
  (`aria-expanded`, `aria-controls`); in a `selectable` trace a step without content is a plain
  `<button>`. A step's links are buttons beside its row, never inside it, so no control holds
  another; each is reached with Tab. The running step carries `aria-current="step"`. Every state
  is a glyph and a word: visible for waiting, blocked, failed, stopped, skipped and queued steps
  (blocked and failed in the danger tone), visually hidden beside a finished step's duration and a
  running step's "…ing" line. The running glyph pulses only without a reduced-motion preference.
  The clock is one interval for the whole trace, running only while a counting step is in the open
  list and the page is visible. The trace has no live region; the thread it sits in announces
  milestones.
- **State** — the root's `data-state` is the run's state (`running`, `waiting`, `blocked`,
  `paused`, `stopped`, `failed`, `queued`, `done`), and it is hidden while it has no steps. Each
  step's `<li>` carries `data-kind` and `data-status`.
