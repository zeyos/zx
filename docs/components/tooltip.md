# Tooltip

A description bubble that stays visible over its anchor or bubble: hover opens it after a beat, keyboard focus opens it at once, and touch leaves it alone.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/tooltip · All components: https://zx.zeyos.com/docs/components/index.md

A description bubble anchored to another element. The panel is a manual popover positioned by the kernel's `position()`, so it escapes clipping and stacking contexts and flips near a viewport edge; it carries `role="tooltip"` and a generated id, and the anchor's `aria-describedby` includes its id only while it is open — opening adds the id to whatever the attribute holds then, and closing removes only that id, so ids added by others (a field error) stay. The bubble contains no focusable controls and stays visible while the pointer is over either the anchor or the bubble. Keyboard focus on the anchor independently keeps it visible. Hover opens it after `delay`; keyboard focus opens it immediately, because a keyboard user cannot hover a moment longer; a touch pointer never opens it, since a bubble with no "move away" gesture would simply stick. Only one is ever visible at a time, which falls out of the dismissal rules rather than a registry.

- **Options** — `content` (string, Node, or a function re-evaluated on every open), `placement`
  (`'top'` default, plus top/bottom/left/right and their start/end variants), `offset` (6), `delay`
  (400), `hideDelay` (80), `maxWidth` (260; a number is pixels, a string is any CSS length),
  `trigger` (`'both'` default, or `'hover'`, `'focus'`, `'manual'` — `manual` installs no listeners
  at all and leaves everything to the methods), `disabled` (false).
- **Methods** — `show()`, `hide()`, `toggle()`, `isOpen()`, `setContent(content)`, `enable()`, `disable()`, `isDisabled()`, `getAnchor()`, `destroy()`. Convenience factories: `tooltip(anchor, contentOrOptions)` takes either a content value or a full option object, and `describe(anchor, text)` is the one-liner replacement for a `title` attribute. Both return the instance.
- **Events** — `open`, `close`. Both fire only on a real transition, so a `show()` on an open tooltip is silent.
- **Keyboard** — Focusing the anchor opens the tooltip at once; it closes after both focus and hover have left the anchor and bubble. `Escape` closes it without moving focus (WCAG 1.4.13 "dismissible") — and only it, when it is the topmost open overlay, so one press never closes a tooltip and the menu beneath it. A `pointerdown` anywhere closes it, and focus that arrives with a click does not re-open it. A closed tooltip listens to nothing outside its anchor; an open one is an entry on the shared overlay stack.
