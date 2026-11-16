# Message — toasts, inline, progress

Transient notifications: a floating region for toasts, a progress handle for long work, and an inline area for messages that belong to one part of the screen.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/message · All components: https://zx.zeyos.com/docs/components/index.md

Floating toasts come from statics; `new Message(target)` gives an inline, non-floating area with
the same `.show()`. The toast region is `role="status"`/`aria-live` (`role="alert"` for errors).
A floating region sits at the top of the viewport on the inline-end side by default (`top-end`:
the upper right in a left-to-right page), sizes to its messages rather than the page, and uses the
translucent glass surface tokens with a solid fallback. A message is a plain card with a neutral
border; its kind shows in the icon. Floating messages pile into a stack that opens on hover, focus,
or a press (see **Stack**).

- **Statics** — `Message.info/success/warning/error(msg, opts)`,
  `Message.show(msg, { kind, timeout=4000, closable, highlight?, scope?, placement? })` → `{ close() }`,
  `Message.progress(text, {scope?, placement?, highlight?})` → `{ update(pct, text?), done(), fail(text?) }`,
  `Message.setPlacement(placement)` / `Message.getPlacement()`,
  `Message.setStack(enabled)` / `Message.getStack()`. `scope` is an element or selector
  whose nearest Zx theme scope owns that floating region; without it the focused opener supplies
  the scope.
- **Placement** — `placement: 'top-start'|'top'|'top-end'|'bottom-start'|'bottom'|'bottom-end'`
  per call, default `'top-end'`: the block edge, then the inline position, logical, so `start` and
  `end` follow the writing direction and `top`/`bottom` alone are centred.
  `Message.setPlacement(placement)` sets the default for calls that name none and returns the
  placement now in effect (anything unknown restores `'top-end'`); it applies to messages shown
  from then on. Messages of one placement share a region, so a scope has one region per placement
  in use, each carrying `data-placement`. At the foot the newest toast is nearest the edge. The
  distance from the viewport edge is the `--zx-message-offset` custom property (default
  `var(--zx-space-4)`), read from the region's theme scope: set it there or on `:root` to clear a
  header or a status bar. At 640px and narrower every placement spans the foot of the viewport,
  full width. An inline area ignores `placement`.
- **Region lifecycle** — a floating region is created on the first toast for its scope and removed
  when its last toast closes. One whose host was emptied or left the document is replaced on the
  next toast rather than reused, and a scope that is itself detached falls back to the focused
  element's scope. `Message.disposeRegion(scope)` → boolean removes a scope's regions at once — all
  placements, toasts and all — for a host torn down while toasts are still showing. While a modal Dialog or
  Sheet is open the region moves into the topmost one, so toasts and their actions stay visible
  and clickable above it, and moves back when it closes. A press on a toast dismisses no open menu
  or drawer.
- **Per-message options** — `kind: 'info'`, `timeout`, `closable: true`, `maxVisible: 5` (extras
  queue, and hovering pauses dismissal), `highlight: false`.
- **Highlight** — `highlight: 'border'` (or `true`) draws the message's border in the kind colour;
  `highlight: 'animated'` draws it faintly with a light travelling round it, and is the still
  kind-coloured border under `prefers-reduced-motion: reduce`. Per message, or as an inline area's
  default; the message carries it as `data-highlight`. `false` (the default) is the plain card.
- **Stack** — floating regions stack by default, and `stack: true` makes an inline area stack:
  the visible messages pile into one stack, the newest in front, the next two peeking out behind
  it a step smaller, the rest out of sight. `Message.setStack(false)` lists floating messages one
  below another instead (at once, those on screen included; `getStack()` reads it). It
  opens — every visible message laid out with its own height — while the pointer is over it or
  focus is inside it; a press on it that is not on a button (a tap included) keeps it open until a
  press outside it, Escape (which returns focus to where it came from), or `collapse()`. While it
  is open by any of these no message in it times out. The outside press is handled after its own
  click handlers, so a button elsewhere can toggle the stack with
  `isExpanded() ? collapse() : expand()`. Closing a message from the keyboard moves focus to the
  same control of the next message, and from the last one back to where it was before it came
  into the stack. An open floating stack taller than the viewport becomes a scrolling list
  (`data-overflow`) with the newest message in view. `expanded: true` keeps it open without
  holding the timers. Instance methods: `expand()` (opens and keeps it open), `collapse()`,
  `isExpanded()`, `setStack(enabled)`; events `expand` and `collapse`. The root carries
  `data-stack` and `data-state="collapsed"|"expanded"`; document order follows the visual order,
  so Tab meets the messages as they are seen. A stack at the top (inline areas, `top*`) piles
  downwards, one at the foot (`bottom*`, and every region at 640px and narrower) upwards. The
  geometry is the exported pure helper `messageStackLayout(heights, expanded)`.
- **Action** — `action: { label, onclick?, kind? }` renders one small button (`.zx-btn`,
  `data-size="sm"`, secondary unless `kind` is `primary`/`danger`/`ghost`) in a toast or an inline
  message; activating it runs `onclick(event)` and closes the message. A message with an action
  stays at least 8000ms (`timeout: 0` still persists). Every message holds its timer while the
  pointer is over it or focus is inside it (WCAG 2.2.1) and resumes once neither is; the region is
  not modal, so Tab moves between the action and the close button, and closing a message that holds
  focus returns focus to where it came from. The live region still announces the text.
- **Leading** — `leading: Node | component` (an Avatar, say) replaces the kind icon. It is
  decorative; the text must name what it shows.
- **Handle** — every `show()` (static or inline) and `info/success/warning/error()` return
  `{ close() }`; closing twice, or a queued message, is safe.
