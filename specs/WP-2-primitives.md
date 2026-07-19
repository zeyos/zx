# WP2 — Primitives: Button, CheckButton, Toggle, Groupbox, Search, Message

Branch: `wp2-primitives` from `main` (kernel merged). Read `AGENTS.md`.
Legacy reference: `../gx-zeyos/src/classes/{Factory,Toggle,Groupbox,Search,Msgbox}.js`,
`../gx-bootstrap/src/classes/{CheckButton,Message}.js`.

## Scope

```
src/components/button/button.js|css          # function factory, not a Component
src/components/check-button/check-button.js|css
src/components/toggle/toggle.js|css
src/components/groupbox/groupbox.js|css
src/components/search/search.js|css
src/components/message/message.js|css
demos/components/{button,check-button,toggle,groupbox,search,message}.demo.js
tests/unit/message-queue.test.js             # pure queue/timeout logic if extracted; else omit
src/index.js styles/zx.css                   # register exports/imports
```

## button.js — `button(opts) -> HTMLButtonElement` (group Inputs)

Replaces legacy `gx.zeyos.Factory.Button/Icon`. Not a class.
`opts: { label='', icon=null (icons.js name), kind='default'|'primary'|'danger'|'ghost',
size='md'|'sm', disabled=false, title, onclick }`. Also `buttonGroup(buttons[]) -> div.zx-btn-group`.
CSS: `.zx-btn`, `[data-kind]`, `[data-size]`; flat surface, 1px border, subtle hover; primary =
accent bg + on-accent text. Focus ring token. Compact density via `--zx-control-height`.

## check-button.js — `class CheckButton` (cssName `check-button`)

Two-state press button. `defaults: { label:'' | [onLabel, offLabel], checked:false, icon:true,
disabled:false }`. Methods: `get() -> boolean`, `set(checked, {silent}={})`, `toggle()`,
`setLabel(label)`, `enable()/disable()`. Event: `change {checked}` — ONLY on real state change
(fixes legacy bug where `check` fired on uncheck). ARIA: native `<button aria-pressed>`.
Keyboard: Space/Enter native.

## toggle.js — `class Toggle` (cssName `toggle`)

Switch. `defaults: { checked:false, value:true, label:null, disabled:false }`.
Methods: `get()`, `set(checked, {silent})`, `toggle()`, `getValue()` (legacy semantics: returns
`options.value` when on, `false` when off), `enable()/disable()`.
Event: `change {checked, value}`. ARIA: `role="switch"`, `aria-checked`, focusable root button;
Space/Enter toggles. CSS: modern track+thumb, motion-reduced-safe animation, accent when on.

## groupbox.js — `class Groupbox` (cssName `groupbox`)

Collapsible titled section on native `<details>/<summary>`. `defaults: { title:'', open:true }`.
Methods: `open()`, `close()`, `toggle()`, `isOpen()`, `setTitle(title)`, `setContent(content)`
(string|Node|Component). Events: `open`, `close` (from the native toggle event).
Constructor with existing element: if target is a `<details>`, adopt; if a plain container,
wrap its children as the content. Summary shows chevron icon rotating on state.

## search.js — `class Search` (cssName `search`)

Input + embedded search button + optional clear button. `defaults: { placeholder:'', value:'',
clearable:true, debounce:250 }`. Methods: `get()`, `set(value, {silent})`, `focus()`, `clear()`.
Events: `input {value}` (debounced), `submit {value}` (Enter or button click), `clear`.
ARIA: `role="search"` landmark on root, labelled input.

## message.js — `class Message` + module-level toast API (cssName `message`)

Toast stack + progress statusbar, successor to gx.zeyos.Msgbox + gx.bootstrap.Message.
- Singleton region: lazily created `div.zx-message-region` with `popover="manual"`, shown in the
  top layer, positioned top-center (CSS, not position()); `role="status"` + `aria-live="polite"`
  (danger toasts use `role="alert"`).
- Static API: `Message.info(msg, opts)`, `.success()`, `.warning()`, `.error()`,
  `.show(msg, {kind, timeout=4000, closable=true})` -> handle `{close()}`. `msg` string|Node.
  Timeout pauses on hover. Max 5 visible, queue the rest (this queue logic in a small pure
  module or exported testable function).
- Progress: `Message.progress(text) -> {update(pct, text?), done(), fail(text?)}` rendering a
  slim bar in the region.
- Instance form `new Message(target, opts)` for an inline (non-floating) message area with the
  same `.show()` API — used later by forms.
- CSS: kind-colored left border + `--zx-color-*-bg` backgrounds, icon per kind, enter/exit
  animation honoring reduced motion.

## Demos

One demo module per component (groups: Inputs for button/check-button/toggle/search, Layout for
groupbox, Overlays for message). Show all kinds/sizes/states incl. disabled; wire event logs;
message demo triggers every kind + progress + a burst of 8 toasts to show queueing.

## Acceptance criteria

1. `npm test` green (incl. message queue test if extracted; lint-tokens clean).
2. Demos render in light/dark × cozy/compact without console errors; focus rings visible on all
   interactive elements via keyboard Tab.
3. Toggle/CheckButton: Space and Enter toggle; `change` fires exactly once per user action.
4. Groupbox chevron + native details semantics work; open/close events fire.
5. 8-toast burst shows max 5 concurrently, rest queued; hover pauses dismissal.
6. destroy(): create/destroy each component twice on the same target — no errors, no leftover
   nodes (message region may persist as singleton but must be empty).
7. Committed on `wp2-primitives`.

## Out of scope

src/core changes; form Field integration; custom elements; compat.
