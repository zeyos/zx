# Dropdown

A top-layer panel tethered to an anchor.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/dropdown · All components: https://zx.zeyos.com/docs/components/index.md

Generic anchored popover in the top layer, constructed as `new Dropdown(anchor, options)`. It
light-dismisses on an outside click or Esc, mirrors `aria-expanded` onto the anchor, and stays a
DOM child of the anchor's nearest Zx theme scope while the browser lifts it into the top layer.

- **Options** — `content`,
  `placement: 'bottom-start'|'bottom-end'|'top-start'|'top-end'|'bottom'|'top'` plus the matching
  `left*` and `right*` placements, `offset: 4`,
  `matchWidth: false`, `openOn: 'click'|'manual'`, `closeOnSelect: false`, `scope: null` (the
  anchor's nearest Zx theme scope by default).
- **Hosting** — the host is resolved again on every `open()`. A dropdown created before its anchor
  is in the document keeps its panel detached until the first open instead of parking it on
  `<body>`, so an anchor inserted into a `[data-zx-theme]` region or a `.zx-scope` afterwards still
  gets its theme. Tooltip, MenuButton, and ContextMenu panels follow the same rule. While open, a
  panel whose anchor sits in an open `<dialog>` (a modal Dialog or Sheet, a focus-trapping or
  non-modal Sheet) is hosted by that dialog instead, so `showModal()` does not make it inert and a
  focus trap still reaches it; it returns to the theme scope when it closes.
- **Overlay stack** — an open panel is one entry on the shared overlay stack
  (`src/core/overlay-stack.js`). Esc closes only the topmost layer that takes it, and an Esc that
  something inside already handled (`defaultPrevented`) closes nothing. A press outside the panel
  and every overlay opened from it closes it; a press on the anchor does not. Light dismiss stops
  at the first layer that contains the press, so a press inside an overlay above the panel (one
  not opened from it) leaves the panel open; nothing below an open modal reacts at all. A panel
  opened from inside another overlay closes with that overlay.
- **Keyboard** — the panel follows its trigger in the Tab order: Tab on the anchor of an open panel
  moves to the panel's first Tab stop, or onto the panel itself when it has a `tabindex`; Tab past
  the last stop continues with whatever follows the anchor; Shift+Tab from the first
  stop returns to the anchor. A Tab stop is what the browser itself stops at: a `tabindex="-1"` part
  of a composite (a Select's toggle), a roving toolbar's inactive items, disabled, hidden and inert
  controls, and all but one radio of a group are not. A panel with no Tab stop is skipped. Esc and `close()` with
  focus inside return focus to the anchor. Opening moves no focus — give the panel `role` and
  `aria-*` semantics yourself if it is more than a disclosure.
- **Methods** — `open()`, `close()`, `toggle()`, `isOpen()`, `setContent()`, `getPanel()`.
- **Events** — `open`, `close`.
