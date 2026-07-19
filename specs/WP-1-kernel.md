# WP1 — Core kernel

Branch: `wp1-kernel` from `main`. Read `AGENTS.md` first. Legacy reference (read-only):
`../gx-core/src/gx.core.js`, `../gx-core/src/gx.ui.js`, `../gx-core/src/gx.util.js`.

## Scope

```
src/core/component.js  src/core/dom.js  src/core/position.js  src/core/http.js
src/core/i18n.js  src/core/keyboard.js  src/core/date.js  src/core/icons.js  src/core/util.js
src/index.js                     # export the kernel surface
demos/components/kernel.demo.js  # group 'Core'
tests/unit/date.test.js  tests/unit/util.test.js  tests/unit/i18n.test.js  tests/unit/dom.test.js
```

`tests/unit/dom.test.js`: only pure parts (htmlEscape); DOM-dependent code is exercised by demos.
If node lacks DOM, keep DOM code out of unit tests entirely.

## component.js

```js
export class Component extends EventTarget {
  static defaults = {};          // subclasses declare; merged along the prototype chain
  constructor(target, options)   // target: Element | selector string | null
  el;                            // root element; when target === null, render() must create it
  refs;                          // object populated by h() `ref:` props during render()
  options;                       // frozen-ish merged copy; never the caller's object
  render() {}                    // subclass hook; must return root Element when target is null
  on(type, fn)                   // addEventListener bound to this.#abort.signal; returns this
  off(type, fn)  once(type, fn)  addEvent(type, fn)  // addEvent = alias of on
  emit(type, detail)             // dispatch Event on this (type) AND bubbling composed
                                 // CustomEvent('zx-'+type, {detail}) on this.el; returns the
                                 // component-level event so callers can check defaultPrevented
  listen(el, type, fn, opts)     // el.addEventListener with {...opts, signal: this.#abort.signal}
  toElement()                    // returns this.el
  msg(key, ...args)              // i18n resolution: options.msg?.[lang]?.[key] → options.msg?.[key]
                                 // → i18n.translate(key, args) → key; printf %1..%n interpolation
  destroy()                      // idempotent: abort listeners, unregister, remove el ONLY if the
                                 // component created it (target was null)
  static from(el)                // WeakMap registry lookup; replaces legacy el.retrieve('com')
}
```

Details:
- Options merge: walk the prototype chain collecting `static defaults` (subclass wins), then
  shallow-merge user options (`msg` deep-merged). Any option key matching `/^on[a-z]/` whose value
  is a function is auto-subscribed: `onchange: fn` ⇒ `this.on('change', fn)` and removed from
  `this.options`. (Lowercase after `on` — event names are lowercase.)
- Registry: module-level `WeakMap<Element, Component>`; register in constructor, delete in destroy.
- Root class: constructor adds `zx-<name>` class where `<name>` = `this.constructor.cssName`
  (static string each component declares); tolerate absence.
- `emit` detail contract: always a single object (e.g. `{value, item}`), never positional args.

## dom.js

```js
export function h(tag, props?, ...children)   // hyperscript factory
export function htmlEscape(str)
export function resolveElement(target)        // Element | selector | Component(toElement) | null
h.raw = (html) => ...                         // explicit trusted-HTML wrapper (returns fragment)
```
- `props`: `class` (string or array), `style` (object or string), `dataset` (object), `ref`
  (string — see below), `on*` lowercase keys ⇒ addEventListener, `aria*`/other attrs via
  setAttribute, DOM properties when the key exists on the element (`value`, `checked`, ...).
- children: Node | string/number (text nodes) | array (flattened) | null/undefined (skipped) |
  objects with `toElement()`.
- `ref` collection: `h.scope(refsObj, fn)` — inside `fn`, any `ref:'name'` prop stores the element
  on `refsObj`. `Component` wraps `render()` in `h.scope(this.refs = {}, ...)` automatically.

## position.js

```js
export function position(anchor, floating, opts?)  // -> { update(), destroy() }
// opts: { placement:'bottom-start'|'bottom-end'|'top-start'|'top-end'|'bottom'|'top',
//         offset:4, flip:true, matchWidth:false }
```
- The floating element gets `popover="manual"` and is `showPopover()`ed (top layer). destroy()
  hides + cleans up.
- If `CSS.supports('anchor-name: --zx-a')`: assign a unique anchor-name and use CSS anchor
  positioning (`position-anchor`, `position-area`/`inset-area` equivalents, `@position-try` flip).
- Else JS fallback: compute fixed coordinates from `anchor.getBoundingClientRect()`, re-run on
  scroll (capture, passive), resize, and anchor ResizeObserver; flip when overflowing viewport;
  `matchWidth` sets `min-width` to anchor width.

## http.js

```js
export class Http {                   // fetch wrapper
  constructor({ base='', headers={}, onError=null, timeout=30000 })
  request(path, { method='GET', data=null, files=null, query=null, headers={} }) // -> Promise<parsed>
  get/post/put/delete(path, dataOrQuery)
}
export function zeyosService(service, accesskey='', opts={})  // Http with base
   // `${opts.apiBase ?? '../remotecall/'}${service}${accesskey ? ':'+accesskey : ''}/`
export function parseResult(json)     // legacy envelope: {result} -> result, {error} -> throw
```
- JSON in/out by default; `files` (File/FileList/array) switches to FormData. AbortController
  timeout. `onError(error, {path, options})` hook invoked on failure before rejecting.

## i18n.js

```js
export function setTranslator(fn)     // host injects e.g. ZeyOS _()
export function setLanguage(lang)  export function getLanguage()
export function translate(key, args?) // translator ?? identity; then printf
export function printf(str, args)     // replaces %1 %2 ... and %key% (legacy) placeholders
```

## keyboard.js

```js
export function focusTrap(container)            // -> {activate, deactivate}; Tab cycling
export function rovingTabindex(container, itemSelector, {orientation='vertical', wrap=true})
   // -> {focusFirst, focusLast, destroy}; Arrow/Home/End management, tabindex 0/-1 upkeep
export function typeahead(getItems, onMatch)    // 500ms buffer first-letter matching
```

## date.js (pure, no DOM)

```js
export function formatDate(date, fmt)  // tokens: %d %m %Y %y %H %M %S %a %A %b %B %s (unix secs)
export function parseDate(str, fmt)    // inverse for numeric tokens; returns Date|null
export function clampDate(d, min, max) export function isSameDay(a, b)
export function addDays/addMonths(d, n)
export function getWeekStart(lang)     // 1 (Monday) default
```
Month/weekday names resolved through i18n `translate('date.month.0'...)` with English fallbacks
built in. Round-trip property: `parseDate(formatDate(d, f), f)` preserves the fields present in f
— unit-test this for several formats including the legacy `'%d.%m.%Y %H:%M'`.

## icons.js

```js
export function icon(name, {size=16, label=null} = {})  // -> inline <svg> element
export const icons = { ... }   // path data map
```
Names (cover legacy Factory set + kernel needs): `chevron-down, chevron-up, chevron-left,
chevron-right, check, x, plus, minus, search, calendar, clock, trash, gear, eye, lock, reload,
list, filter, dots, info, warning, error, success, upload, drag`. Simple 16×16 stroke paths,
`currentColor`, `aria-hidden` unless `label` given (then role=img + aria-label).

## util.js

`debounce(fn, ms)`, `uid(prefix)`, `deepMerge(a, b)` (plain objects only), `isElement`,
`clamp(n, min, max)`, `toArray`.

## src/index.js

Re-export: `Component, h, htmlEscape, resolveElement, position, Http, zeyosService, parseResult,
i18n helpers, keyboard helpers, date helpers, icon, icons, util helpers` (named exports).

## kernel.demo.js (group 'Core')

Interactive proof: (1) an h()-built card with refs and event log; (2) a position() playground —
button anchoring a floating panel, placement selector, works on scroll; (3) icon gallery of all
names; (4) date format/parse round-trip input; (5) a tiny Component subclass demonstrating
emit/on and `zx-*` DOM event bubbling with destroy/re-create buttons.

## Acceptance criteria

1. `npm test` green: date round-trips (≥6 cases incl. `%s` and `%d.%m.%Y %H:%M`), printf,
   deepMerge, htmlEscape, uid uniqueness, debounce (timer-based ok with node:test).
2. Demo page: all five kernel demos function without console errors; position() panel stays
   attached to its anchor while scrolling the page and flips at viewport edges (verify via the
   demo's own scroll container).
3. lint-tokens still green.
4. JSDoc on every export.
5. Committed on `wp1-kernel`.

## Out of scope

Components, compat, custom elements, build tooling. Do not touch styles/tokens.
