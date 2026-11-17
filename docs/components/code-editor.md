# CodeEditor — structured text without an editor dependency

A dependency-free, text-safe source editor with native undo, IME behavior, indentation and line/column feedback.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/code-editor · All components: https://zx.zeyos.com/docs/components/index.md

A textarea that behaves like a source editor, and deliberately not more than that: native undo,
native IME, and no syntax engine. It never executes or injects the value, so it is the safe
surface for structured text — templates, queries, configuration — while rich HTML authoring
stays a separate policy decision.

- **Options** — `value`, `name`, `language` (shown to the reader and exposed as data),
  `label`, `placeholder`, `rows` (clamped 2–100), `indent: '\t'` (inserted by Tab, removed by
  Shift+Tab; `'  '` for two spaces, `''` to leave Tab alone), `wrap: 'off'|'soft'|'hard'`,
  `spellcheck`, `readOnly` (also spelled `readonly`, as on every other control; either one set to
  true makes the editor read-only), `disabled`, `status` (the line/column readout).
- **Methods** — `setValue()`, `getValue()`, `setLanguage()`, `setReadOnly()` (also spelled
  `setReadonly()`), `enable()`/`disable()`, `getInput()` (the
  native textarea: the element that carries the name, validity and description, and the one a
  `<label for>` names), `setHighlight(message, kind = 'danger')`, `clearHighlight()`, `focus()`.
- **Events** — `input {value}`, `change {value}`, `invalid {message}`.
- **Tab** — while `indent` is non-empty the editor captures Tab: Tab inserts the indent at the
  caret or indents every selected line, Shift+Tab outdents them, and focus stays in the editor.
  That is what a code surface has to do and what makes it a keyboard trap if nothing else is
  arranged — so Escape releases the capture until the next keystroke in the editor: Escape then
  Tab (or Shift+Tab) leaves the field, and any other key, or leaving the editor, restores
  indentation. `indent: ''` switches the capture off: Tab and Shift+Tab move focus as in any other
  field and nothing is indented. Tab with Ctrl, Alt or Meta, and Tab in a read-only or disabled
  editor, are never captured.
- **Error state** — a standalone editor reports a validation or status message the way a Field
  does. `setHighlight(message, kind)` shows it under the text and reflects `kind`
  (`'danger'|'warning'|'success'`) as `data-state` on the root. `'danger'` is the error state: the
  textarea gets `aria-invalid="true"`, the message is announced as an alert, the frame takes the
  danger colour, and `invalid {message}` is emitted. The message describes the textarea
  (`aria-describedby`) for as long as it is shown; an empty message, or `clearHighlight()`, clears
  it.
- **In a Form** — a `code` field adapter is registered by `registerFieldAdapters()`. Set the
  Field's own message there (`field.setHighlight()`), not the editor's: the Field labels the
  textarea, marks it invalid and describes it with its message, and the editor's frame follows.
