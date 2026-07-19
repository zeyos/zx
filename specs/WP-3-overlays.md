# WP3 — Overlays: Modal, Dialog, Dropdown, MenuButton

Branch: `wp3-overlays` from `main` (kernel merged). Read `AGENTS.md`.
Legacy reference: `../gx-zeyos/src/classes/{Popup,Dialog,Dropdown}.js`,
`../gx-bootstrap/src/classes/{Popup,MenuButton}.js`.

## Scope

```
src/components/modal/modal.js|css
src/components/dialog/dialog.js|css
src/components/dropdown/dropdown.js|css
src/components/menu-button/menu-button.js|css
demos/components/{modal,dialog,dropdown,menu-button}.demo.js
src/index.js styles/zx.css
```

## modal.js — `class Modal` (cssName `modal`)

Thin `<dialog>` wrapper (the low-level overlay; Dialog builds on it).
`defaults: { content:null, width:'auto', closable:true, lightDismiss:false, destroyOnClose:false }`.
Constructor always creates its own `<dialog class="zx-modal">` appended to `document.body`
(target arg ignored/null). Methods: `open()`, `close(result?)`, `setContent(content)`,
`isOpen()`. Events: `open`, `close {result}`, `cancel` (Esc — preventable via
`event.defaultPrevented` → keep open). `closable:false` blocks Esc. `lightDismiss:true` closes on
backdrop click. Uses `showModal()`; `::backdrop` styled with `--zx-color-bg-backdrop`.
Body scroll lock via `overscroll-behavior`/`overflow` on open.

## dialog.js — `class Dialog extends Modal` (cssName `dialog`)

Structured modal: header (title + close ×), body, footer buttons. Successor to gx.zeyos.Popup,
gx.zeyos.Dialog, gx.bootstrap.Popup, and Msgbox-style alerts.
`defaults: { title:'', size:'md' ('sm'=400|'md'=600|'lg'=840|number px), buttons:[], closable:true }`.
`buttons: [{ label, kind, action:'close'|'cancel'|fn(dialog), autofocus }]` rendered with
`button()` from WP2.
Methods: `setTitle(t)`, `setContent(c)`, `setButtons(list)`, plus **views** (successor of legacy
frames): `addView(key, {content, buttons?, title?})`, `showView(key)`, `getView(key)` — one view
visible at a time within the body.
Statics returning Promises (successor of PopupAlert/PopupConfirm/Msgbox):
`Dialog.alert({title, message, okLabel}) -> Promise<void>`,
`Dialog.confirm({title, message, okLabel, cancelLabel, danger=false}) -> Promise<boolean>`,
`Dialog.prompt({title, message, value, placeholder}) -> Promise<string|null>`.
Focus: autofocus button or first focusable; focus returns to opener on close (`<dialog>` handles
top-layer; store `document.activeElement` on open, restore on close).

## dropdown.js — `class Dropdown` (cssName `dropdown`)

Generic anchored floating panel (building block for MenuButton/Select/pickers, and the successor
of legacy gx.zeyos.Dropdown's panel behavior).
Constructor `(anchor, options)` — anchor is Element|selector (NOT the panel).
`defaults: { content:null, placement:'bottom-start', offset:4, matchWidth:false,
openOn:'click'|'manual', closeOnSelect:false }`.
Methods: `open()`, `close()`, `toggle()`, `isOpen()`, `setContent(c)`, `getPanel()`.
Events: `open`, `close`. Uses `position()` from the kernel; panel is `popover="manual"` in top
layer. Light dismiss: outside pointerdown + Esc close it (module-level shared listener while
any dropdown open — mind cleanup). `aria-expanded` mirrored on the anchor; `aria-controls` wired.

Also export `class SelectDropdown extends Dropdown`? — NO. Keep single class; Select (WP4) uses
Dropdown directly. (Listed here so you don't invent it.)

## menu-button.js — `class MenuButton` (cssName `menu-button`)

Button opening an APG menu (successor of gx.bootstrap.MenuButton + legacy gx.zeyos.Dropdown item
usage). Constructor `(target, options)`; target may be an existing button or null (then
`options.label`/`icon` build one via `button()`).
`defaults: { label:'', icon:null, kind:'default', items:[], placement:'bottom-start' }`.
`items: [{ label, icon?, value?, disabled?, danger?, onselect? } | '-' (separator)]`.
Methods: `setItems(items)`, `open()`, `close()`, `setLabel(l)`.
Events: `select {value, item}`, `open`, `close`.
ARIA/keyboard (APG menu-button pattern): trigger `aria-haspopup="menu"` + `aria-expanded`; panel
`role="menu"`, items `role="menuitem"`; ArrowDown/Enter/Space on trigger opens + focuses first
item; ArrowUp opens + focuses last; in menu: Arrow cycle (rovingTabindex), Home/End, typeahead
(kernel helper), Enter/Space selects, Esc closes returning focus to trigger, Tab closes.
Built on Dropdown.

## Demos

- modal: basic open/close, light-dismiss variant, non-closable variant, nested (Dialog.confirm on
  top of an open Modal — top-layer stacking must just work).
- dialog: sizes, views walkthrough (a 2-step wizard), alert/confirm/prompt buttons logging
  resolved values, danger confirm.
- dropdown: panels on all 6 placements around a center button, matchWidth demo, scroll-following
  check inside a scrollable container.
- menu-button: action menu with icons, separators, disabled + danger items, keyboard walkthrough
  instructions text, event log.

## Acceptance criteria

1. `npm test` + lint green.
2. Esc closes topmost overlay only; focus returns to opener (verify in demo manually).
3. MenuButton full APG keyboard map works (Arrow/Home/End/typeahead/Esc/Tab).
4. Dropdown panel stays anchored while scrolling; flips at viewport edge (JS fallback path must
   work even where CSS anchor positioning is supported — test by forcing
   `position.js`'s fallback via a demo toggle if the kernel exposes one, otherwise note it).
5. Light/dark × cozy/compact clean; backdrop uses token.
6. Double create/destroy clean; no orphan popover elements in DOM after destroy.
7. Committed on `wp3-overlays`.

## Out of scope

Select/date pickers (WP4/5); toasts (WP2); compat.
