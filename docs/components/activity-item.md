# ActivityItem

One chronological record with actor identity, timestamp, metadata, attachments, content, and host actions.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/activity-item · All components: https://zx.zeyos.com/docs/components/index.md

One chronological activity entry. It owns actor/avatar anatomy, semantic time, safe content slots,
attachments, and actions; the application owns posting, reactions, permissions, routing,
persistence, and sanitization before any rich content becomes a Node.

- **Options** — `id`, `actor`, `avatar` (Avatar options or Element), `title`, `content`,
  `timestamp`, `timeLabel`, `metadata`, `attachments`, `actions`, `kind`, and
  `headingLevel: 1..6`. Content slots accept text, Nodes, or Components and never parse HTML.
- **Actions** — Elements pass through; descriptors accept
  `{id,label?,icon?,href?,target?,rel?,title?,disabled?,kind?,onselect?}`. Unsafe links and unnamed
  icon-only controls are omitted.
- **Methods** — `setActivity(values)`, `getActivity()`, and `destroy()`.
- **Events** — cancelable `action {id,action,event}` before a callback or native navigation; its
  bubbling `zx-action` mirror can cancel the same boundary.
- **Accessibility** — an entry is a native list item containing an article and semantic heading;
  valid timestamps use `<time datetime>`, while display-only labels remain ordinary text.
