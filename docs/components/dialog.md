# Dialog (extends Modal)

A modal built on native `<dialog>`: focus trapping, Escape, and the top layer come from the platform, and Modal adds initial focus and the return to the opener on top of them.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/dialog · All components: https://zx.zeyos.com/docs/components/index.md

Structured modal: a header with title and close button, a body, and footer buttons.

- **Options** — `title`, `size: 'sm'|'md'|'lg'|number`,
  `buttons: [{ label, kind, action: 'close'|'cancel'|fn(dialog), autofocus, shortcut }]`, `closable: true`.
  `closable: false` refuses Escape and takes the header ✕ away entirely: it is not displayed, not
  focusable, and closes nothing. Close such a dialog from a footer button or with `close()`.
- **Methods** — `setTitle()`, `setContent()`, `setButtons()`,
  `addView(key, { content, buttons? })`, `showView(key)`.
- **Statics returning Promises** — `Dialog.alert({ title, message, okLabel })`,
  `Dialog.confirm({ title, message, okLabel, cancelLabel, danger })` → boolean,
  `Dialog.prompt({ title, message, value, placeholder, okLabel, cancelLabel })` → string|null.
  The labels default to the translated "OK" and "Cancel"; name the action instead where you can
  ("Delete", "Rename").
- **Type to confirm** — `Dialog.confirm({ ..., confirmText: 'Website Redesign' })` adds an input
  labelled "Type **Website Redesign** to confirm" (a real `<label>`; message
  `dialog.typeToConfirm`, `'Type %1 to confirm'`). Focus starts in the input; the confirm button
  stays disabled, and Enter does nothing, until the value matches exactly (case-sensitive, ignoring
  surrounding spaces). Escape, the close button, and Cancel resolve `false` as before. Use it for
  deletes that cannot be undone, with `danger: true` and an `okLabel` that names the action.
