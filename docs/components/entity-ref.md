# EntityRef

Dense linked or static record identity with labelled metadata and host-injected actions.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/entity-ref · All components: https://zx.zeyos.com/docs/components/index.md

Dense record identity for table cells, feeds, selectors, and detail metadata. It owns presentation
and safe native interaction semantics; the application injects routes, permissions, context menus,
and record mutations.

- **Options** — `id`, `title`, `subtitle` (text, Node, or Component), `icon` (name, Node,
  Component, or lazy renderer), `metadata: [{label,value,icon?,showLabel?}]`, `link` (a URL or
  `{href,target?,rel?,download?,onclick?}`), `actions`, `size: 'sm'|'md'|'lg'`, `wrap: false`, and
  `actionsLabel`.
- **Actions** — an action is a caller-owned Element or
  `{id,label?,icon?,title?,href?,target?,rel?,kind?,disabled?,onselect?}`. Descriptors with `href`
  remain native anchors; others are buttons. Executable destinations are discarded, `_blank`
  gains `noopener`, and an icon-only action requires `title`.
- **Methods** — `set(values)`, `setMetadata()`, `setActions()`, `setLink()`, `getEntity()`,
  `focus()`, and `destroy()`.
- **Events** — cancelable `activate {id,entity,href,event}` before a primary-link callback/native
  navigation and `action {id,action,entity,event}` before an action callback/navigation. The
  bubbling `zx-*` mirrors may cancel the same boundary.
- **Accessibility** — metadata is a definition list; `showLabel:false` clips its label visually
  while keeping it available to assistive technology. Identity links and secondary controls keep
  native keyboard and modifier-click behavior.
