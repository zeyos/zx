# Card

A semantic content or record surface with optional media, a native title link, secondary actions, and metadata.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/card · All components: https://zx.zeyos.com/docs/components/index.md

A semantic content or record surface. Card is intentionally not a Panel preset: it has no
disclosure state or application chrome, and composes as one repeated item in a grid or list. A
linked Card keeps the root non-interactive and renders a real title anchor as its primary action,
so buttons and links in its action, content, and footer regions remain valid sibling controls.

- **Options** — `title: ''`, `media: null`, `content: null`, `actions: []`, `footer: null`,
  `link: null|string|{href, target?, rel?, onclick?}`, `variant: 'outlined'|'raised'|'filled'`,
  `orientation: 'vertical'|'horizontal'`, `headingLevel: 3`.
- **Methods** — `setTitle()`, `setMedia()`, `setContent()`, `setActions()`, `setFooter()`,
  `setLink()`.
- **Content** — media, body, and footer accept text, a Node, a Component, or null. Enhanced target
  children become body content when no explicit content is supplied, and `destroy()` restores the
  target exactly.
- **Interaction** — `link` stretches the native title anchor across the visual surface; secondary
  controls stay above it and are never nested inside it. A linked card requires a non-empty title.
  Executable/data URL schemes are rejected. Commands belong in `actions`, and selectable cards
  should compose a native checkbox or radio.
- **Layout** — horizontal media uses the public `--zx-card-media-size` hook and stacks through a
  container query when the card itself becomes narrow.
