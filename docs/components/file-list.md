# FileList

An accessible ordered file collection with empty/loading states and incremental host-controlled mutation.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/file-list · All components: https://zx.zeyos.com/docs/components/index.md

An accessible ordered collection of `FileItem` rows with loading and empty presentations.
Explicit duplicate file IDs are rejected; source order is preserved.

- **Options** — `items`, `label`, `loading`, `loadingCount: 3`, `loadingText`, and `emptyText` (text,
  Node, or Component). Unset, the three read the `fileList.*` messages; `loadingText` or `emptyText`
  set to `null` shows no text.
- **Methods** — `setItems(items,{silent?})`, `getItems()`, `getItem(id)`,
  `addItem(item,index?,{silent?})`, `updateItem(id,values,{silent?})`,
  `removeItem(id,{silent?})`, `setLoading()`, and `destroy()`.
- **Events** — cancelable `activate {id,index,file,href,event}` and
  `action {id,fileId,index,action,file,event}`, plus `datachange {items}` after a collection
  mutation. Returned items are defensive snapshots.
- **Updates in place** — mutations are reconciled by file `id`: unchanged rows are left alone and a
  changed one is updated through `FileItem.set()`, so upload progress can tick through
  `updateItem(id, {progress})` while focus (say, on that file's Cancel action) and the scroll
  position stay put. Removing the focused file moves focus to the file that takes its place. Files
  without an `id` are rebuilt on every mutation.
