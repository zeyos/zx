# Launcher — application and record search

A full application launcher with app tiles, current and pinned state, recent records, grouped asynchronous search, and application-owned routing.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/launcher · All components: https://zx.zeyos.com/docs/components/index.md

A native-dialog launcher for applications, recent records, commands, and grouped remote results.
Zx owns ranking, focus, request cancellation, and presentation; ZeyOS owns the catalogue,
permissions, recent-history/cache policy, and the route or command ultimately invoked.

- **Constructor** — `new Launcher(null, options)` owns a top-layer dialog in the opener's nearest
  Zx theme scope — never inside another open dialog, which it stacks above in the top layer. Open,
  it is a modal on the shared overlay stack: Esc and presses inside it reach no popup left open
  behind it, and toasts move into it while it is open;
  `new Launcher(existingDialog, options)` enhances and later restores an existing `<dialog>`.
- **Options** — `items`, abortable `sources: [{id, label?, minQuery?, when?, order?, load(query, {signal})}]`,
  `query`, `debounce: 250`, `minQuery: 0`, `maxResults: 100`, `placeholder`, `label`, `emptyText`,
  `loadingText`, `shortcut: 'mod+k'|false`, visible `hints` labels `{move, open, back, close}` (or
  `false`), and `scope` to explicitly select an element whose nearest Zx theme scope owns the launcher.
- **Items** — `{id, label, description?, keywords?, group?, icon?, badge?, hint?, shortcut?, keys?,
  value?, href?, target?, invoke?, pinned?, disabled?, kind?, current?, when?, groupOrder?,
  itemOrder?, items?, placeholder?, order?, agent?}`. `icon` accepts a bundled icon name, Node, or
  factory. `agent` (AgentAvatar options, or `true`) draws the item as the agent's still face
  instead — a tile's size for an `application` — with its activity's word, visually hidden, after
  the label in the option's name. Links stay native so modified and middle clicks work;
  non-link commands may provide an application-owned `invoke` callback. Malformed and executable
  URL schemes are stripped; a descriptor with no safe link or callback is disabled. `hint` is muted
  text at the end of the row (a current value, a project); `shortcut: ['⌘', 'K']` (or Button's
  `{label, keys}`) draws key caps for display only, and `keys: 'Meta+K'` adds `aria-keyshortcuts`.
- **Pages** — an item with `items` opens a page instead of being selected: an array, or a loader
  `(query, {signal}) => items | Promise<items>` that runs when the page opens and, debounced, as
  its query changes (the loading and empty states show meanwhile; `order: 'source'` keeps the
  loader's order instead of ranking it). Opening a page clears the query, shows a scope chip with
  the item's label before the input — part of the combobox's name, `Search <label>` — and adds
  "⌫ Back" to the footer; `placeholder` sets the page's placeholder. Page rows show a chevron.
  Backspace on an empty query, ArrowLeft on an empty query, or the chip's × goes back one page,
  restoring the query and highlighted row beneath; Escape closes from any page, and the next
  opening starts on the root. Pages nest. `open({page})` opens straight into a page — a local page
  id (at any depth of array pages, the path becoming the back stack) or a page item. A polite
  status line announces each change ("Agents, 7 results").
- **Methods** — `open({page}?)`, `close()`, `toggle()`, `isOpen()`, `focus()`, `setQuery()`,
  `getQuery()`, `back()`, `getPage()`, `setItems()` (the root's items), `setCurrent()`,
  `setSources()`, `destroy()`.
- **Events** — cancelable `select {item, value, source, query, page}`, `query {query}`,
  `page {page, path}` (after every page change; `page` is null on the root), `open`, `close`, and
  `error {source, error, page}` (a failing page loader reports as source `page:<id>`). Preventing
  `select` suppresses the supplied link or callback.
- **Ranking** — local results are case/diacritic-insensitive and deterministic: exact label,
  label prefix, word prefix, label substring, identifier substring, then acronym prefix. Pinned
  items retain an explicit order ahead of otherwise equal results. A new async query aborts and
  ignores stale source work.
- **Keyboard** — Cmd+K on macOS or Ctrl+K elsewhere opens by default; the shortcut is ignored in
  editable controls, composition, and modal contexts. Application tiles use spatial arrow-key
  movement; Up/Down may continue into record groups. Home/End, Page Up/Down, and Enter operate the
  single listbox selection model; Escape closes and restores focus. Enter, or ArrowRight with the
  caret at the end of the query, opens a page row; Backspace or ArrowLeft on an empty query goes
  back. `aria-current` marks the active destination independently from the keyboard's
  `aria-selected` option.
- **Optional ZeyOS adapter** — import `zeyosLauncher()` or `buildZeyosLauncherConfig()` from
  `@zeyos/zx/zeyos`. The adapter receives the permitted module/menu catalogue, pins, current
  identifier, recent loader or cache, abortable search, destination resolvers, and application/
  record icon renderers explicitly. It maps the complete shell payload without reading globals or
  taking over application routing.
- **Appearance** — group labels are sentence-case captions. The application you are in
  (`aria-current="page"`) takes the neutral `--zx-color-bg-current` fill and a semibold label; the
  highlighted row is the lighter hover step. Neither uses the accent.
