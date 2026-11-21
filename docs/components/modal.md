# Modal

A bare top-layer surface you fill yourself — Dialog’s unopinionated sibling, for overlays that supply their own chrome.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/modal · All components: https://zx.zeyos.com/docs/components/index.md

Thin overlay on the native `<dialog>` element. The surface uses the shared, reading-sized overlay
panel material; the backdrop uses `--zx-color-overlay-backdrop`, and focus returns to the opener on close.

- **Options** — `content`, `width: 'auto'`, `closable: true`, `lightDismiss: false`,
  `destroyOnClose: false`, `scope: null` (the opener's nearest Zx theme scope by default). The
  scope is resolved again on every `open()`; a `scope` element not yet in the document leaves the
  dialog detached until then, rather than parking it on `<body>` outside the theme.
- **Methods** — `open()`, `close(result?)`, `setContent()`, `isOpen()`.
- **Events** — `open`, `close {result}`, `cancel {reason}`.
- **Focus** — opening focuses an `autofocus` control, else the first focusable one. A panel with
  nothing focusable takes focus itself (`tabindex="-1"`, outside the Tab order) and draws no focus
  ring, keeping its elevation: the panel is a surface, not a control (`data-zx-focus="container"`).
- **Dismissal** — everything the reader does to dismiss an overlay raises `cancel` first, with
  `reason` `'escape'`, `'close-button'` (Dialog/Sheet header ✕), `'button'` (a footer button whose
  action is `'cancel'`), `'backdrop'` (`lightDismiss`), `'outside'` or `'drag'` (Sheet).
  `event.preventDefault()` keeps it open, which is the place for an "unsaved changes" check.
  A programmatic `close()` raises no `cancel`. Escape is handled by Zx rather than by the browser's
  close request, so preventing it holds however often the key is pressed; a handler that calls
  `preventDefault()` on the Escape keydown (a popup inside the dialog, your own) keeps the key.
- **Without `showModal()`** — in a DOM that has `<dialog>` but not `showModal()` (jsdom, for unit
  tests), Modal, Dialog and Sheet present themselves through the `open` attribute instead.
  `open()`, `close(result)`, `isOpen()`, Escape, `cancel`, the events and `destroy()` work the
  same; there is no top layer, no inert page, no backdrop and no `aria-modal`, so modality itself
  is not testable there.
