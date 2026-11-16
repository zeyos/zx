# Search

A debounced search field with a clear button and a submit on Enter.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/search · All components: https://zx.zeyos.com/docs/components/index.md

Search input with embedded search and clear buttons (`role="search"`).

- **Options** — `placeholder`, `value`, `clearable: true`, `debounce: 250`.
- **Methods** — `get()`, `set(value, {silent})`, `focus()`, `clear()`.
- **Events** — `input {value}` (debounced), `submit {value}` (Enter or the button), `clear`.
