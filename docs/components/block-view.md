# BlockView — `new BlockView(target, options)` / `renderBlocks(blocks, options)`

An answer an agent wrote, drawn block by block as prose and written to as it streams.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/block-view · All components: https://zx.zeyos.com/docs/components/index.md

An answer an agent wrote, drawn block by block as semantic elements inside `.zx-prose`, and
written to as it streams. Finished blocks are never redrawn: `append()` and `appendText()` touch
only the last block, so a reader's selection or focus in an earlier paragraph survives the rest of
the answer arriving.

- **Options** — `blocks: []`, `headingLevel: 3` (the element level of a level-2 `heading` block;
  set it one below the heading that names the answer), `size: 'sm'|'md'` (interface or reading
  size), `streaming: false`, `sources: null` (names the citation buttons by title), `msg`.
- **Methods** — `setBlocks(blocks, {streaming?})`, `append(block)`, `appendText(text)` (continues
  the last paragraph, or opens one; a blank line in the text starts a new paragraph; a marker split
  across two chunks resolves when its close arrives), `end()`, `stop()` (adds "Stopped here."),
  `setSources(sources)`, `setArtifactState(id, {expanded, controls})` (reflects whether the
  application has the artifact open somewhere), `getBlocks()`, `isStreaming()`, `toText()`,
  `toMarkdown()`, `destroy()`. A single line break in model text is kept (an address, a sign-off); a
  blank line starts a new paragraph.
- **Events** — `cite {n, source}` from a citation button, `artifact {id}` from an artifact card,
  `end` when a streamed answer is marked finished.
- **Rendering** — code is a figure with its language, a copy button and a focusable `<pre>`
  (`lines: true` on a code block numbers its lines and wraps long ones under their own indent, for
  code read at length in an inspector),
  coloured for js, ts, json, sql, python, shell and css (anything else stays plain); a wide table
  scrolls inside the answer and becomes a named, focusable region only while it overflows; figures
  are a `<dl>` with tabular numbers; a callout uses `.zx-callout` with its tone as `data-kind`.
- **Static** — `renderBlocks(blocks, options)` returns a `DocumentFragment` for a transcript or a
  print view: citations are plain superscripts and artifacts plain cards. `blocksToMarkdown(blocks)`
  and `blocksToText(blocks)` export an answer for copying and search.
- **State** — `data-state` is `streaming`, `done` or `stopped`; the root is `aria-busy` while it
  streams. Streamed text is never inside a live region.
