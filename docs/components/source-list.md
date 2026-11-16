# SourceList

The sources an answer cites, as numbered chips with a card of each one’s title, site, and the passage used.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/source-list · All components: https://zx.zeyos.com/docs/components/index.md

The sources an answer cites: a numbered chip (or row) for each, naming its site or title, with a
card of its title, where it is, and the passage used on hover and focus. It never loads a favicon,
a thumbnail, or any other remote resource.

- **Options** — `sources: []` (`Source[]`, numbered in order as the answer's `[n]` markers are),
  `label` (the visible label naming the list, by default the `sourceList.label` message; `''` or
  `null` drops it and names the list with that message), `layout: 'chips'|'list'` (`list` gives each source a row with
  its title and site), `numbered: true`, `icons: {}` (glyph per kind over the built-in
  `web`→link-2, `file`→file, `record`→table, `call`→gear), `msg`.
- **Methods** — `setSources(sources)` (focus stays on the same source), `highlight(n)` (a number is
  the 1-based position, a string an `id`: scrolls to it, focuses it, and marks it
  `data-state="highlighted"` for 2 s — the answer to a BlockView `cite`), `getSources()`,
  `destroy()`.
- **Events** — `select {source, n}`, **preventable** (on the component or on the bubbling
  `zx-select`). Unprevented, a `web` source opens its `href` in a new tab with
  `noopener,noreferrer`, and only when `safeHref()` accepts it and it is an absolute `https:` URL;
  the card shows that host. Every other kind is the application's to act on, for example
  `runTrace.reveal(source.call)`.
- **Accessibility** — each source is a native `<button>` named "Source 1: bank.example" (the
  visible number and name, plus visually hidden words); its card is a `Tooltip`, so it is the
  button's description while open. The list is an `<ol>` labelled by the visible label. It is not
  a landmark, so a thread with many answers does not repeat a "Sources" region.
- **Privacy** — the pure `sourceHref(source)` returns the only address a source may open, or null;
  nothing is fetched to draw a source.
