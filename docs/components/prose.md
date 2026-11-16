# Prose — `.zx-prose` and `.zx-callout`

The reading register for authored content: its own typeface, size, line height, and measure.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/prose · All components: https://zx.zeyos.com/docs/components/index.md

The reading register: a class, not a component, that sets authored content — a document, a
record's notes, a message body, an assistant's answer — in the reading tokens rather than the
interface ones. Write plain HTML inside it: `h1`–`h4`, `p`, `ul`/`ol`, `blockquote`, `hr`, links,
inline `code`, `pre`, `kbd`, `mark`, tables, `figure`/`figcaption`, `img`.

- **Tokens** — `--zx-font-prose` (the interface stack by default; a serif here leaves the interface
  alone), `--zx-prose-size` (16px, `--zx-text-lg`), `--zx-prose-leading` (1.7), `--zx-prose-measure`
  (62ch, the reading width). Headings scale with the reading size and read `--zx-weight-title`.
- **Attributes** — `data-size="sm"` sets prose at the interface size, for comments, previews, and
  panels; `data-zx-measure="full"` drops the measure where the column already sets the width.
- **Rhythm** — one gap between blocks, more above a heading and less below it; links in the body
  colour over a quiet underline, accent on hover; tables without a frame, a muted header over
  hairline rows, `data-align="end"` cells in tabular figures.
- **Content colour** — a bare `mark` highlights in the amber tone; `mark[data-tone]` in any of the
  nine tones; a bare `span[data-tone]` colours its text, and `data-fill` highlights it as well.
- **Callout** — `.zx-callout` with an optional `.zx-callout__icon` and a `.zx-callout__body`
  (`.zx-callout__title` for a bold first line): a tinted fill, no frame, at the interface size.
  Neutral by default, because most callouts are emphasis; `data-kind="info|success|warning|danger"`
  makes it a status and `data-tone` a category. Works inside or outside prose.
- **Specificity** — every rule is `.zx-prose` plus `:where()`, and the stylesheet loads before the
  components, so a badge, an entity reference, or a table placed in prose keeps its own styles,
  while an application's bare element reset cannot undo the rhythm.
- **Section links** — `proseAnchors(root, options)` ends every `h2`–`h4` with an `id` inside a
  `.zx-prose` under `root` with a small link to itself (`a.zx-prose__anchor`, "Copy link to …").
  It shows while the heading is pointed at or the link has focus (and always on a touch screen or
  under a contrast preference). A click copies the address with the section's hash — the current
  address by default, `href(id)` to build another — and confirms with a tick and a polite "Link
  copied"; it never changes the location, and a middle or modified click is left to the browser.
  Options: `selector`, `label` (`%1` is the heading), `title`, `feedback`, `feedbackDuration`,
  `href`, `oncopy(url, copied)`. It returns `{refresh(), destroy()}`: call `refresh()` after
  re-rendering the content. Headings without an id are skipped — give the ones worth linking a
  stable id. `sectionHref(base, id)` builds the address.
