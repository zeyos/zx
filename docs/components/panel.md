# Panel / MasterPanel

A raised surface with a title, an optional collapse control, header actions, and a footer — plus MasterPanel, its full-height variant.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/panel · All components: https://zx.zeyos.com/docs/components/index.md

## Panel

Framed, optionally collapsible section. Its header is a row rather than one big button: the chevron
and title form the collapse control and `buttons` sit at the trailing edge beside it, so clicking
an action never collapses the panel. The footer bar appears as soon as it has `footer` content,
`footerButtons`, or both, and its buttons are right-aligned.

- **Options** — `title`, `content`, `open: true`, `collapsible: true`, `buttons: []` (elements or
  `button()` descriptors, right-aligned in the header), `footer`, `footerButtons: []`
  (right-aligned in the footer).
- **Methods** — `setTitle()`, `setContent()`, `setButtons()`, `setFooter()`, `setFooterButtons()`,
  `open()`/`close()`/`toggle()`, `isOpen()`.
- **Events** — `open`, `close`.

## MasterPanel

Full-height application panel with a fixed header (title plus action buttons) and an optional
fixed footer, while the body scrolls.

- **Options** — `title`, `content`, `buttons: []`,
  `module: <ZeyOS module name → accent token>`, `footer`.
- **Methods** — `setTitle()`, `setContent()`, `setButtons()`, `setFooter()`.
