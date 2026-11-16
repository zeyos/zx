# FileItem

A durable or transient file row with a readable type and size, native downloads, actions, and accessible progress.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/file-item · All components: https://zx.zeyos.com/docs/components/index.md

A durable or transient file row composed from `EntityRef`, MIME/byte-size metadata, lifecycle
status, and accessible progress. It never starts a transfer, decides authorization, resolves a
preview, or persists a file.

- **Options** — `id`, `name`, `size` (bytes), `mime`, `typeLabel: null`, `subtitle`,
  `icon: 'file'`, additional
  `metadata`, safe native `link`, `actions`, status (`ready` | `temporary` | `waiting` |
  `uploading` | `processing` | `success` | `error`), `statusLabel`, `progress` (0–100), `indeterminate`,
  `identitySize: 'sm'|'md'|'lg'`, `wrap`, `actionsLabel`, and `locale`.
- **Methods** — `set(values)`, `setStatus(status,label?)`,
  `setProgress(percent|null,{indeterminate?})`, `getFile()`, `focus()`, and `destroy()`.
- **Events** — cancelable `activate {id,file,href,event}` and
  `action {id,fileId,action,file,event}`. Cancellation propagates to the composed EntityRef, so it
  suppresses callbacks and navigation rather than merely observing them.
- **Progress** — determinate work exposes min/max/now and percentage text. Indeterminate work
  omits `aria-valuenow`; status changes are announced separately.
- **Type** — the MIME type is shown as a readable type ("PDF", "CSV", "Image", "Spreadsheet"),
  falling back to the name's extension ("EXE") when it is unfamiliar and never to the raw string;
  `typeLabel` overrides it and `''` hides it. The default `icon: 'file'` gives way to a glyph for
  the MIME type (`file-pdf`, `file-image`, …) when the active icon set has one — Font Awesome, or
  a glyph added with `registerIcons()`; any other `icon` is used as given.
