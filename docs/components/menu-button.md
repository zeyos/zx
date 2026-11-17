# MenuButton — APG menu button

A trigger and its menu, following the APG menu button pattern: typeahead, wrapping arrows, and focus returned to the trigger on close.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/menu-button · All components: https://zx.zeyos.com/docs/components/index.md

A button that opens a `role="menu"`.

- **Options** — `label`, `icon`, `kind`, `placement`, and a shared `items` entry model:
  - `'-'` or `{type: 'separator'}` draws a separator; `{type: 'heading', label}` draws a visible,
    non-interactive heading.
  - Actions keep `label`, `icon`, `value`, `disabled`, `danger`, and `onselect`, and may add
    `description`, `badge`, `shortcut`, or a text/Node `adornment`.
  - `href`, `target`, and `rel` render a genuine safe native link, preserving modifier clicks and
    targets. Executable URL schemes are rejected; `_blank` receives `noopener noreferrer` by
    default.
  - `role: 'menuitemcheckbox'|'menuitemradio'` with `checked` exposes an APG checked action.
    Choosing one updates it in place — a checkbox toggles, a radio is checked and the other radio
    items of its section (between separators or headings) are unchecked — and `select` reports the
    new state as `detail.checked`. Preventing `select` leaves the state as it was; the item objects
    passed in are not modified, so call `setItems()` to keep the model in step.
  - `{type: 'choice', label, value, options: [{value, label, icon|glyph}], onselect(value, entry,
    menu)}` draws a setting chosen in place — a theme, a layout: the label, then a small segmented
    group of `menuitemradio` options named by it. Choosing an option checks it and calls
    `onselect`; the menu stays open so the change shows, and `select` does not fire. Left and Right
    move within the row; Up and Down leave it, landing on another row's checked option.
    `AccountMenu` takes the same entries; `ContextMenu`, which closes on every activation, leaves
    them out.
- **Methods** — `setItems()`, `open({returnFocus})`, `close()`, `toggle()` (opens when closed,
  closes when open, moves no focus), `isOpen()`, `setLabel()`, `getTrigger()`, `getPanel()`,
  `focusFirst({returnFocus})`, `focusLast({returnFocus})`.
- **Events** — `select {value, item}`, `open`, `close`.
- **Focus return** — choosing an item closes the menu and returns focus to the trigger before the
  `select` event and the item's `onselect` run, so a dialog they open returns to the trigger when
  it closes, and focus they move themselves stays where they put it. Escape returns focus the same
  way. `returnFocus` sets the destination for one opening: `true` (default) is the trigger, an
  element is that element — the list row a keyboard shortcut opened the menu from — and `false`
  leaves focus alone.
- **Cancellation** — `select` is cancelable. Preventing it skips the item's `onselect` callback and
  leaves the menu open with focus back on the item, which is the composition seam used by
  `AccountMenu` and rail flyouts.
- **Keyboard** — ArrowDown/Enter/Space open and focus the first item; ArrowUp opens and focuses the
  last; arrows cycle; Home/End; typeahead; Enter/Space select; Esc/Tab close. Esc reaches the menu
  through the overlay stack, so inside a Sheet or Dialog it closes the menu and leaves the sheet
  open; a menu opened inside a modal Dialog is hosted by it and stays usable.
- **Appearance** — the highlighted item is a neutral step, a checked item keeps its accent check
  mark, and section headings are sentence-case captions. ContextMenu shares the same rules.
