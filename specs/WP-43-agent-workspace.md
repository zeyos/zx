# WP43 — Agent workspace, system states, and the details that make them work

Two reference applications — an agent workspace laid out like an IDE, and a project tool that
documents its own empty, loading, and error states — showed details Xenon lacks: motion as a user
setting, a command palette with nested pages, toasts that carry their action, type-to-confirm
deletes, named easing and drag shadows, key sequences, and an application frame with a status bar
and a bottom panel. This WP adds them, then builds what shows them off: a true agent-workspace
template, an expanded AI chat, a screen pattern for agent chat, and a screen pattern of every system
state.

Work in the current checkout. **Do not commit.** `AGENTS.md` and the WP40 design rules apply
(neutral current, one solid accent per screen, tones for categories, sentence case and mid weights,
small corners, no edge bars), as does WP42: every layout works from 390px to 1440 and passes
`tools/audit-layout.js` and `tools/shoot-layout.js` at 1440 and 390 in both themes. This WP
explicitly permits a new `src/core/motion.js` (§1) and changes to `styles/tokens/**` and
`styles/base.css` (§1). `CHANGELOG.md` and `docs/api.json` are central: report changelog lines.

## Phase 1 — foundations (parallel)

### §1 · Tokens, motion, theme studio

**Scope:** `styles/tokens/**`, `styles/base.css`, new `src/core/motion.js` (+ its export in
`src/index.js`), the JS motion consumers that must honour it (`src/components/aurora/**`,
`src/components/chart/**`), `src/components/sheet/**` (drawer easing), `src/components/kanban-view/kanban-view.css`
(drag shadow only), `website/theme*.js`, `website/theme.css`, `website/site.js`, `tests/unit/tokens.test.js`,
`tests/unit/theme-presets.test.js`, `tests/lint-tokens.js` (allow-list only), `docs/llms.md` (theming
section and the touched components' sections).

- **Motion as a setting.** `data-zx-motion="reduced"` on any element turns motion off inside it:
  `--zx-dur-*` become `0ms`, and a base rule stops CSS animations and transitions in that subtree
  (state changes still apply — only movement stops). There is no "full" that overrides the OS: a
  user who asked their system for less motion gets less. `src/core/motion.js` exports
  `prefersReducedMotion(element?)` — true under the OS preference or inside a reduced region — and
  `watchMotion(element, fn)` (returns a disposer) for components that animate in script; Aurora and
  Chart use it.
- **Named easing and shadows.** `--zx-ease-spring` (a small overshoot, for things that pop in) and
  `--zx-ease-drawer` (a decisive ease-out, for panels that slide) beside `--zx-ease`;
  `--zx-drag-shadow` (tier-2, light and dark) for an item being dragged. Sheet slides on the drawer
  curve; KanbanView's dragged card takes the drag shadow.
- **Theme studio.** A Motion control (System · Reduced) persisted with the rest of the site theme
  (`site.js`), and a warm neutral recipe beside the existing ones. A **state matrix** card: each
  Button kind (primary, secondary/default, ghost, danger, icon) in default, hover, active, focus,
  disabled, and loading, side by side — the pseudo-class states rendered by mirroring the
  library's own `:hover` / `:active` / `:focus-visible` rules onto a studio-only attribute at run
  time, so the card can never drift from the real styles.
- Tests: the new tokens exist in light and dark; the drag shadow is defined for both; the reduced
  rule zeroes the durations.

### §2 · Launcher pages

**Scope:** `src/components/launcher/**`, `website/demos/launcher.demo.js`, `tests/unit/launcher*.test.js`,
`docs/llms.md` (Launcher section).

- An item with `items` (an array, or a function returning one or a promise of one) opens a **page**:
  the query clears, the input shows a scope chip with the item's label, the results are that page's
  items, and the footer gains "⌫ Back". Backspace on an empty query, or clicking the chip's ×, goes
  back one page; Escape closes the launcher from any page. Pages nest. `open({ page })` opens
  straight into a page; a `page` event reports navigation.
- Item `hint` (muted text at the end of the row — a current value, a project) and `shortcut` (an
  array of key labels drawn as key caps; display only, `aria-keyshortcuts` when given as `keys`).
- Rows that open a page show a chevron. Keyboard: APG combobox/listbox as today; ArrowRight on a
  page row opens it, ArrowLeft on an empty query goes back.

### §3 · Message action, Dialog type-to-confirm, status and priority glyphs

**Scope:** `src/components/{message,dialog,select}/**`, `src/index.js` (exports only),
`website/demos/{message,dialog,select}.demo.js`, their tests, their `docs/llms.md` sections.

- **Message `action`** — `{ label, onclick, kind? }` renders a button in the toast; activating it
  runs `onclick` and closes the toast. A toast with an action does not time out while it has hover
  or focus (WCAG 2.2.1), and pauses for at least 8s. **`leading`** (a Node, e.g. an Avatar) replaces
  the kind icon. `Message.show()` returns a handle with `close()`.
- **`Dialog.confirm({ confirmText })`** — the dialog shows "Type <b>name</b> to confirm" and an
  input; the confirm button stays disabled until the input matches exactly (trimmed). Escape and
  Cancel resolve `false` as before.
- **`statusIcon(status)` and `priorityIcon(level)`** — the glyphs `Select.status()` and
  `Select.priority()` already draw, as public factories returning decorative elements
  (`aria-hidden`), so lists, boards, and filters show the same glyph as the picker. Statuses:
  backlog (dotted circle), todo (empty circle), in-progress (half), review (three quarters), done
  (check), cancelled (crossed). Documented: always paired with text or a tooltip.

### §4 · Kit — the application frame (coordinator)

`website/layouts/kit.js` / `kit.css`: key sequences in `shortcuts()` (`'g h'`), a `shortcutSheet()`
dialog listing groups of shortcuts (the `?` key), `adaptiveShell()` panel toggles at full width
(`collapseNav()`, `collapseAside()`; Mod+B and Mod+I when asked), `.shell__statusbar` (24px, quiet,
at the foot of the shell) and `.shell__panel` (a bottom panel with tabs, toggled, its height a
token), drawers on `--zx-ease-drawer`.

## Phase 2 — layouts (parallel, after phase 1)

Each layout follows `AGENTS.md` "Layout examples", uses the fictional Fieldstone world
(`fixtures.js`), and names no reference product.

- **`agent-workspace`** (template, block `.agents`) — a workspace where a team of AI agents works
  on tasks: navigation (workspace, resources, the agent roster with live presence), editor-style
  tabs (Home, a task, a chat, a file), an inspector (agents by state, run figures), a bottom panel
  (terminal, output, problems), and a status bar (branch, run, motion setting, tokens). Home has a
  composer that routes a request to an agent, suggestion chips, the task table, and recent
  activity. A task shows its plan (checklist with owners and durations) and an execution log
  (timestamps in mono, tool calls, hand-offs drawn as two avatars joined by a dotted line).
  Approvals and blockers arrive as toasts with their action (Approve, Resolve). The command palette
  uses Launcher pages (Open agent ›, Run workflow ›, Switch model ›). Agents' presence is animated
  (idle, thinking, working, waiting, needs you) in one shared animation loop that pauses when hidden
  or off screen and stops entirely under reduced motion; presence is never shown by motion alone.
  Keys: Mod+K, Mod+B, Mod+I, Mod+J, `?`, `g` sequences, N new task.
- **`ai-chat`** (expanded) — answers show their work: tool steps (searched, read, ran) as a
  collapsible timeline with counts and durations, sources as chips with a hover card, and a final
  answer; an artifact (a document or code) opens in the inspector with versions and copy; message
  actions (copy, regenerate, branch); `@agent` mentions in the composer with a suggestion list;
  everything it does today keeps working.
- **`agent-chat`** (screen pattern, block `.agent-chat`) — one conversation with an agent that acts:
  a thread with tool calls, an approval card (approve, edit, reject) that blocks the run until
  answered, a streamed answer (static in preview), and the composer; the aside shows the run (state,
  steps, sources, cost).
- **`system-states`** (screen pattern, block `.states`) — every empty, loading, error, and
  confirmation state an application needs, in one place: empty (with and without an action),
  loading (skeleton rows, cards, a board column, a page; a busy button), errors (offline, failed to
  load, failed to save, permission denied, not found), form validation, and confirmation dialogs
  including type-to-confirm; a "Simulate offline" switch shows how a page degrades.

## Out of scope

WP-39's other extensions; density (removed for good); changing existing layouts beyond `ai-chat`.
