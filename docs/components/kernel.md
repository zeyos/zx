# Core helpers

Core helpers: Component, DOM, Compact events, Icons, Positioning, i18n.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/kernel · All components: https://zx.zeyos.com/docs/components/index.md

- **Component** — the base class: `on`/`off`/`once`/`emit`, `listen`, `toElement`, `msg`,
  `destroy`, and the static `Component.from(el)`. Options are merged over the class's
  `static defaults`; a key passed as `undefined` keeps its default (also inside `msg`), `null`
  overrides it. `msg(key, ...args)` always returns text: the
  instance's `msg` option (a `{[lang]: {…}}` table for the active language, then flat keys), else
  the host translator, else the class's built-in `msg` defaults, else the default English
  catalogue, and only then the key itself; `%1`, `%2`, … are filled from `args`.
- **DOM** — `h(tag, props, ...children)`, `h.raw(html)`, `htmlEscape`, `resolveElement`.
  `__(tag#id.class, properties, content)` is Zx's compact DOM builder and public alias for
  `compactElement()`. It preserves `D*` data, `S*` style, boolean/built-in property, attribute,
  and legacy `on*` callback rules while keeping content text-safe. `applyCompactProperties`,
  `appendContent`, `appendCompact` (parent return), `appendCompactChild` (child return), and
  `fragment(...children)` are the pure forms.
- **Compact events** — `onCompactEvent`, `offCompactEvent`, and `fireCompactEvent` share one
  newest-first handler registry. Existing `DOM.on/remEvt/fireEvt` methods can delegate to this
  triad. Zx never installs globals or alters DOM prototypes; applications decide whether to expose
  these functions globally or compose them into their own UI and routing layer.
- **Icons** — `icon(name, {size, label})`, `icons`, `iconAliases`, `iconNames()`, and `ICON_SIZE` (one size per role); see the
  Icons section — bundled inline SVG by default, Font Awesome after an opt-in.
- **Positioning** — `position(anchor, floating, {placement, offset, flip, matchWidth})` →
  `{update, destroy}`. It anchors a manual popover with CSS anchor positioning where the browser
  supports it and a scroll/resize-tracked fallback where it does not. Options are resolved once,
  so changing a placement means `destroy()` and a fresh `position()` call.
- **i18n** — `setTranslator`, `setLanguage`, `getLanguage`, `translate`, `translatePlural`, `printf`, and
  `defaultMessages`, the frozen English catalogue of every component key (`table.empty` → "No
  records") that a host copies as the starting point for a locale.
- **Dates** — `formatDate(d, fmt, {locale})`, `parseDate(s, fmt)` (tokens
  `%d %m %Y %y %H %M %S %a %A %b %B %s`), `clampDate`, `isSameDay`, `addDays`, `addMonths`,
  `getWeekStart`. A supported explicit `locale` takes precedence over `getLanguage()`, then
  English. Names and abbreviations come from `Intl`, preserving regional differences.
- **Keyboard** — `focusTrap`, `rovingTabindex`, `typeahead`.
- **Motion** — `prefersReducedMotion(element?)` → boolean, and
  `watchMotion(element, fn, {signal?, immediate?})` → disposer, for code that animates in script;
  see Theming.
- **Utils** — `debounce`, `uid`, `deepMerge`, `isElement`, `clamp`, `toArray`.
