# Sheet

An edge-anchored Dialog — one component covers both side sheets and mobile drawers, since only the edge and presentation differ.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/sheet · All components: https://zx.zeyos.com/docs/components/index.md

Edge-anchored surface — a `Dialog` attached to one side of the viewport instead of floating in the
middle. One primitive covers both side sheets and mobile drawers, which differ mainly in the edge they take, so
`side` replaces what would otherwise be two components. Inherits the whole Dialog anatomy: title,
footer buttons, switchable views, focus restoration, and the reading-sized overlay panel material.
When a Dock adopts it, the Sheet becomes an opaque layout surface instead.

- **Options** — `side: 'end'` (`'start' | 'end' | 'top' | 'bottom'`, logical), `modal: true`
  (`true | 'trap-focus' | false`), `backdrop: 'dim'` (`'dim' | 'blur' | 'none'`), `size: null`
  (CSS length or px number, applied to whichever axis `side` implies), `closeButton: true`
  (independent of `closable`, which governs Escape; when false the ✕ is not displayed, not
  focusable, and closes nothing), plus everything Dialog takes — `title`, `content`, `buttons`, `closable`, `lightDismiss`
  (defaults to `true` here, unlike Modal), `destroyOnClose`, `scope`.
- **Methods** — `open()`, `close(result?)`, `setSide(side)`, `getSide()`, `setSize(size)`,
  `isModal()`, `isDocked()`, `isOpen()`, `getSize()`, `snapTo(target)`, plus Dialog's `setTitle()`, `setContent()`,
  `setButtons()`, `addView()`, `showView()`.
- **Events** — `open`, `close {result}`, `cancel {reason}` (preventable; raised by Escape, the ✕,
  a backdrop click or outside press, and a dismissing drag — see Modal's **Dismissal**),
  `resize {size, ratio}`, `dockchange {docked, dock}`.
- **Docked** — a sheet has two lives, and it does not choose between them: `Dock.adopt(sheet)`
  makes it a track in that dock's flow instead of an overlay, and the dock then owns its side,
  size, and resizing. A docked sheet is always non-modal, `close()` collapses its track to zero
  rather than sliding away, and Escape and outside-click stop dismissing it — it is part of the
  layout, not something covering it. `Dock.release(sheet)` hands it back. Nothing is rebuilt
  across a handoff: the element moves and reopens in place, so DOM state and listeners survive,
  and no `open`/`close` is emitted for what is only a change of address.
- **Modality** — `true` delegates focus containment, page inertness, Escape, and the backdrop to
  the browser through `showModal()`. Floating `'trap-focus'` and `false` sheets use a manual
  Popover top layer, so they stay viewport-anchored even inside a transformed or clipped theme
  scope while the page keeps scrolling and stays interactive. Escape and outside-click are
  re-implemented through the overlay stack, and `'trap-focus'` adds `focusTrap()` on top: Esc
  closes the sheet when focus is in it (or in a popup it opened) and no popup above it takes the
  key first, an Esc already handled inside (`defaultPrevented`) is ignored, and a press inside a
  menu or dropdown anchored in the sheet counts as inside the sheet. Closing the sheet closes the
  popups it opened. Light dismiss stops at the first layer that contains the press: a press inside
  the upper of two light-dismiss sheets (or inside any overlay above this one) closes neither the
  lower sheet nor anything beneath it; a press outside every layer closes each one that
  light-dismisses. A floating non-modal sheet opened from inside a modal Dialog is hosted by that
  dialog while open, so it stays usable above it, closes when the dialog closes, and goes back to
  its theme scope when it closes. Their top-layer backdrop is
  explicitly transparent and non-filtering; `backdrop` is meaningful only when `modal` is `true`.
  A docked Sheet remains a native non-modal dialog in its Dock's flow. Where the platform has no
  `showPopover()` (jsdom), a floating non-modal sheet is presented the same in-flow way, without
  the top layer.
- **Resizing and detents** — `resizable` makes the inner edge draggable between `min` and `max`.
  `snap` gives it detents: a number at or below 1 is a fraction of the viewport along the sheet's
  axis, anything larger is pixels, and a string is any CSS length (`'320px'`, `'90%'`). With
  detents a drag settles on the nearest one rather than where it was released, and `snapTo(index)`
  or `snapTo(value)` moves there directly. Dragging below half the smallest allowed size dismisses
  a `closable` sheet, so resize, detent, and swipe-to-dismiss are one gesture whose meaning is
  decided when the pointer settles. `getSize()` reports the current pixel size. A sheet that is
  neither `resizable` nor snapping still has a draggable handle where `handle` shows one — that is
  what makes a drawer dismissible — but the drag may only take size away, never add it, so it
  cannot be grown by dragging when nothing asked for resizing.
- **Handle** — `handle: 'auto'` shows a grab handle on `top` and `bottom` sheets, which is what
  makes them read as drawers; `true` and `false` force it either way. It exists whenever the sheet
  is `resizable` or has `snap`, visible or not. It is a `separator` with live
  `aria-valuenow`/`aria-valuemin`/`aria-valuemax`: arrow keys along the axis step it by 16px, Shift
  by 64px. A docked sheet hides its handle — the dock's own divider resizes it there.
- **Custom properties** — `--zx-sheet-size` (written by `size`; the per-side default otherwise)
  and `--zx-sheet-radius` (inner corners of a top/bottom sheet, default `--zx-radius-lg`) are
  internal geometry, not published styling hooks — prefer the options. `--zx-overlay-blur` is a
  tier-2 semantic token and is public: it sets the `'blur'` backdrop's radius, default `8px`.
- **Motion** — entry and exit both animate, via `@starting-style` and
  `transition-behavior: allow-discrete` on `display`/`overlay`; without them the sheet appears and
  disappears instantly. The slide (and a docked track's collapse, and a stack's shift) runs on
  `--zx-ease-drawer`; the fade keeps `--zx-ease`. All of it sits inside
  `prefers-reduced-motion: no-preference`, and stops inside a `data-zx-motion="reduced"` region.
- **Keyboard and screen readers** — identical to Dialog: the native `<dialog>` supplies the role
  and `aria-labelledby` points at the title. Escape closes when `closable`, focus moves to the
  `[autofocus]` control or the first focusable descendant on open, and returns to the opener on
  close. Tab cycles within the sheet when `modal` is `true` or `'trap-focus'`.
