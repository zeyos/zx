# copyButton() / CopyInput

Copying a value, and saying so.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/copy · All components: https://zx.zeyos.com/docs/components/index.md

Copying a value, and saying so. A clipboard write is silent, so both of these confirm it in place
— and stay quiet when the browser refuses. Both go through `copyToClipboard()`, which falls back
to a hidden textarea when the async Clipboard API is unavailable or denied.

## copyButton()

- **Signature** — `copyButton({text, label, title, feedback, feedbackDuration, size, kind, oncopy})`
  → `HTMLButtonElement`.
- **Options** — `text: ''` — a string, or **a function returning one**, which is what a button
  beside a live value needs so the copy is never stale; `label: ''` (empty renders an icon-only
  ghost button), `title`, `feedback` (by default the `copy.copy` and `copy.copied` messages, and `null` gives no text), `feedbackDuration: 2000`,
  `size: 'md'|'sm'`, `kind: 'default'|'primary'|'ghost'`.
- **Events** — `oncopy(text, copied)` is called for every attempt; `copied` is `false` when the
  clipboard refused the write, and the button then stays untouched rather than claiming a copy
  that did not happen.
- **Accessibility** — on success the glyph becomes a tick and a visually hidden `role="status"`
  speaks the confirmation, then both revert. The icon-only form carries the `title` as its
  accessible name. The status line is positioned inside the button, so it never adds scrollable
  overflow to the page or to a scrolling pane.

## CopyInput

- **Options** — `value: ''`, `label: ''`, `hideLabel: false`, `feedback`, `buttonTitle` (by default
  the `copy.copied` and `copy.copy` messages, and `null` gives no text), `size: 'md'|'sm'`.
- **Methods** — `get()`, `set(value)`, `focus()` (focuses and selects the whole value).
- **Events** — `copy {value, copied}`.
- **Behaviour** — the field is `readonly`, not `disabled`, so the text stays selectable and
  reachable by keyboard; focusing it selects the whole value, which is what someone reaching for
  Ctrl+C expects.
