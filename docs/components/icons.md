# Icons — bundled glyphs or Font Awesome

One icon() call, two renderers: the outline SVG glyphs Zx bundles, or Font Awesome once an application loads a kit.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/icons · All components: https://zx.zeyos.com/docs/components/index.md

`icon(name, {size, label, class, style, family, fixedWidth})` returns an element: an inline `<svg>`
from the bundled set, or an `<i>` carrying Font Awesome classes. Both get `class="zx-icon"`, so
component CSS styles either. Zx renders the bundled glyphs by default and **never loads anything on
its own** — Font Awesome is an opt-in an application makes.

```js
import { loadFontAwesome, useFontAwesome, registerIcons } from '/assets/zx.esm.js';

await loadFontAwesome({ kit: 'ae8320b210', style: 'duotone' });  // injects the kit, switches over
useFontAwesome();                          // page already carries Font Awesome; no network
registerIcons({ rocket: ['0 0 512 512', 'M…'] });            // a filled glyph (Font Awesome paths)
registerIcons({ anchor: ['0 0 24 24', 'M12 6v16…', 'stroke'] });  // an outline glyph (Lucide paths)
```

- `loadFontAwesome(kit | {kit, style, family, fixedWidth, activate})` — injects the kit script once
  per URL (a kit token expands to `https://kit.fontawesome.com/<token>.js`), adopts a kit the page
  already embeds, then switches the renderer. Rejects if the script fails; kits only load on the
  domains configured in the Font Awesome account.
- `useFontAwesome(opts)` / `useBuiltinIcons()` / `configureIcons(opts)` / `getIconConfig()` —
  switch or read the renderer without touching the network.
- `iconNames()` lists every name `icon()` renders as an inline glyph: the bundled set, the glyphs
  added with `registerIcons()`, and the aliases. A bare name that is not in the list renders the
  placeholder. `icons` is the bundled table and `iconAliases` the frozen `alias → bundled name`
  table. An alias is listed beside the glyph it draws, so the list holds more names than glyphs;
  for one entry per glyph, as in an icon gallery, leave them out:
  `iconNames().filter((name) => !Object.hasOwn(iconAliases, name))`.
- `registerIcons(map)` adds or replaces inline glyphs. `[viewBox, path]` is a filled shape — the
  form Font Awesome path data comes in. `[viewBox, path, 'stroke']` is an outline drawn with the
  bundled pen; its stroke scales with the view box, so a 24-unit outline set such as Lucide renders
  exactly like the bundled glyphs. Anything else throws `TypeError`.

**The bundled set is outline.** The inline glyphs are Lucide icons (https://lucide.dev, ISC licence;
the notice is in `src/core/icons.js`) on a 24-unit grid: `fill="none"`, `stroke="currentColor"`,
round caps and joins, a stroke of 1.75 units — about 1.2px at the default 16px, the weight of
13–14px interface text — and never thinner than one pixel, so 11–13px glyphs stay legible. The
names are Zx's own (`gear`, `dots`, `warning`, `success`, `drag`, …), not Lucide's. Colour follows
`currentColor`; muting an icon is the caller's choice. The paint sits on the `<svg>` as attributes,
so CSS on `.zx-icon` overrides it — `fill: currentColor` turns an outline into its solid form, which
is how a state such as a set star or a liked heart is shown without a second glyph.

**Names decide their own renderer.** A bare name (`'check'`) follows the active provider, and the
built-in names are translated to their Font Awesome counterparts (`x` → `fa-xmark`, `search` →
`fa-magnifying-glass`, `warning` → `fa-triangle-exclamation`, …), so component code never changes.
A bare name may also be an alias, under either renderer: `archive` → `box-archive`, `edit` →
`pen-to-square`, `settings` → `gear`, `clear` → `x`, `checked` → `check`, `question` → `info`,
`range` → `filter`, `fields` → `list`, `grid` → `table-cells-large`. A glyph an application
registered under the alias name itself wins over the alias, which is also how an alias is changed.
Prefixes override: `'fa:user'`, `'fas:user'`/`'regular:user'`/`'duotone:user'`/`'thin:user'`,
`'kit:zeyos-notes'` (custom kit icons), `'builtin:check'` (force the inline SVG). A literal class
list — `'fa-sharp fa-solid fa-user'` — is used verbatim. Unknown names under Font Awesome are
passed through to the kit, which resolves them in the browser.

**An unknown *built-in* name does not throw.** Icon names routinely arrive from a server, and one
unconfigured name must not take down the screen it appears on, so it renders an empty `<svg>` of
the requested size — layout does not shift — carrying `data-zx-icon-missing="<name>"`, and reports
itself once per distinct name through `console.warn`. Pass `icon(name, { strict: true })` for the
old `RangeError`, at a call site that can afford to fail: a test, or a build-time check.

Font Awesome elements are sized with `font-size` and occupy 1em; bundled SVGs use width/height
attributes (default 16). Both honour `label` (`null` ⇒ `aria-hidden`, otherwise `role="img"` +
`aria-label`).

**Size an icon by its role.** `ICON_SIZE` names one pixel size per role, so every chevron, every
dismiss ×, and every check renders alike wherever it appears, and a call site says what a glyph is
for rather than how big it is: `icon('chevron-down', { size: ICON_SIZE.chevron })`. The components
use it throughout; use it in application code too, and never write a number for one of these roles.

- `ICON_SIZE.control` (16) — the default: an icon that is a control's content or leads its label.
- `ICON_SIZE.chevron` (14) — dropdown, disclosure, and reorder chevrons; calendar and pager
  arrows; breadcrumb separators.
- `ICON_SIZE.dismiss` (14) — the × that clears a field, closes a tab, dialog, or message, or
  removes a row.
- `ICON_SIZE.check` (14) — the check of a selected option, a pressed toggle button, or a completed
  step.
- `ICON_SIZE.sort` (14) — the sort-direction arrow beside a column heading.
- `ICON_SIZE.chip` (12) — any glyph inside a chip or token, its remove × included.
- `ICON_SIZE.marker` (8) — a glyph drawn inside a small status marker.

Several roles share a value and are named apart so one can change on its own. At 14px and below an
outline is drawn with a one-pixel line, so the indicator roles also share a stroke weight. A text
character is never a stand-in for an icon: draw "×", "✓", or an arrow with `icon()`.
