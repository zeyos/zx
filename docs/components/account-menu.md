# AccountMenu

A single accessible Avatar trigger and grouped account-action popup; identity, permissions, preferences, and sign-out stay application-owned.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/account-menu · All components: https://zx.zeyos.com/docs/components/index.md

Composes `Avatar` and `MenuButton` into one account trigger and APG menu. The popup repeats the
identity before its actions; Zx never decides role visibility, changes preferences, signs a user
out, or mutates the session.

- **Options** — `account: {name, secondary, src?, initials?, status?, statusLabel?}`, `items`,
  `compact: false`, `label`, and any top/bottom/left/right `placement`.
- **Methods** — `open()`, `close()`, `toggle()`, `isOpen()`, `setAccount()`, `setItems()`,
  `setCompact(compact)` (the avatar alone, or with the name and secondary line — for a navigation
  column that narrows and widens), `focus()`,
  `getPanel()`, `destroy()`.
- **Events** — cancelable `select {value, item}`, `open`, and `close`. A canceled selection does
  not run the item's callback and leaves the menu open, so an application can reject or confirm an
  action without rebuilding the account surface.
- **Accessibility** — compact mode is visually avatar-only but keeps the full account-menu name on
  its single native trigger; MenuButton retains focus return, typeahead, and arrow-key behavior.
- **Appearance** — the trigger is a flat row (avatar, name, secondary line, chevron) with the hover
  fill, not a button: it takes back the border, glass fill, blur and shadow MenuButton's `.zx-btn`
  would give it, whatever order the stylesheets load in.
