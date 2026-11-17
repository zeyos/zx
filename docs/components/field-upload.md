# FieldUpload

Click/drop file upload with progress.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/field-upload · All components: https://zx.zeyos.com/docs/components/index.md

Click/drop file upload with progress. The drop zone is keyboard-accessible and progress comes from
`XMLHttpRequest`. Passing the shipped `Http` client keeps XHR upload progress while applying its
base URL, default headers, timeout, JSON/envelope parsing, and error observer. Per-upload headers
can override defaults; the browser supplies the multipart boundary. Custom `upload()` or
`request()` transports receive files, `paramName`, a cancellation signal, and a progress callback.
Aborted uploads ignore late progress and success callbacks.

- **Options** — `url`, `paramName: 'upload'`, `params`, `headers`, `multiple: false`, `accept`,
  `maxSize`, `autoUpload: true`, `preview: true`, `http`.
- **Methods** — `upload(files?)`, `abort()`, `clear()`, `setDisabled(bool)`,
  `enable()`/`disable()`, `isDisabled()`.
- **Events** — `select {files}`, `progress {percent}`, `success {response}`, `error {error}`,
  `abort`.
