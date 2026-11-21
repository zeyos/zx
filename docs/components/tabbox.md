# Tabbox — APG tabs

Manual-activation tabs following the APG pattern: arrow keys move focus, Enter or Space selects, and panels can be built lazily.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/tabbox · All components: https://zx.zeyos.com/docs/components/index.md

Four appearances, all square-cornered. `divided` (the default) sets flat blocks on a muted track,
split by hairline dividers, above a bordered panel, with the active block lifted onto the panel
surface. `bracket` outlines folder tabs that fuse into that same panel, the active tab bridging
the seam. `line` underlines the active tab in the text colour across a full-width rule, for page-
and section-level navigation. `segmented` renders a compact framed group with the active tab on
the neutral `--zx-color-bg-current` fill, so the row reads as one control inside a toolbar or card
header. The active tab is where you are, not a pick: every variant gives it the text colour and a
semibold label, and none uses the accent. Tab badges are neutral counts, not accent bubbles.

`divided` and `bracket` draw the panel box themselves; `line` and `segmented` leave the panel bare
for the surrounding layout to frame. The boxed variants read `--zx-tabbox-radius` (default `0px`)
from the component root, so `el.style.setProperty('--zx-tabbox-radius', 'var(--zx-radius-lg)')`
restores rounded corners without forking the stylesheet.

- **Options** — `tabs: [{ name, title, content, icon?, closable?, disabled? }]`, `active`,
  `variant: 'divided'|'bracket'|'line'|'segmented'`, `keepAlive: true`, `label` (the tab list's
  accessible name — give one whenever a page has more than one tab list).
- **Methods** — `addTab()`, `removeTab()`, `openTab(name)`, `getActive()`, `setTitle()`,
  `setBadge(name, text|null)`, `enableTab()`/`disableTab()`.
- **Events** — `change {name, previous}` (preventable), `close {name}`.
- **Behaviour** — a `closable` tab renders a × that closes it on click, and `close` fires for that
  gesture just as it does for Delete. `removeTab()` is the silent programmatic path. Closing the
  active tab activates its neighbour through the usual `change` event, so a `preventDefault()` on
  that change also vetoes the close.
- **Keyboard** — ArrowLeft/Right and Home/End move focus, Enter/Space activate, Delete closes a
  closable tab. The × is a plain glyph rather than a nested button (buttons cannot nest), so
  keyboard and screen-reader users close through Delete; focus lands on the neighbouring tab.
- **Panel focus** — a panel holding a control is not a Tab stop itself, so Tab from the tab list
  reaches the control. A panel with nothing focusable inside is a Tab stop (`tabindex="0"`), drawn
  with the ring inside its edge, so its text can be read and scrolled from the keyboard. This is
  settled whenever a panel is shown and again as Tab leaves the tab list, so content that changes
  inside a panel is taken into account. Controls inside a custom element's shadow root are not
  seen, so a panel whose only controls sit there stays a Tab stop as well.
