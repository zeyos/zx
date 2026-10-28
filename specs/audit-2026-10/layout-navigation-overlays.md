# Zx audit: layout, navigation, overlays, styles, layout kit

Scope: src/components/{layout, groupbox, card, panel, master-panel, tabbox, navigation-bar, toolbar, empty-state, stepper, breadcrumb, split-view, dock, app-sidebar, module-bar, app-rail, loading, skeleton, message, modal, dialog, sheet, dropdown, menu-button, context-menu, tooltip, aurora}; src/internal/{app-rail,menu-items}.js; src/core/{overlay-host,position,motion,breakpoint,keyboard}.js; styles/**; website/layouts/kit.{js,css}, fixtures.js; matching demos and docs/llms.md blocks. Yardstick: AGENTS.md. Baseline: `node --test` (925 pass) and `node tests/lint-tokens.js` are green. That says more about what the tests don't cover than about the code.

Findings marked **[verified]** were reproduced in headless Chrome through playwright-core against `tools/serve.js`. The probe scripts are in this scratchpad's `probe/` folder. No repository file was modified.

## Executive summary

1. **[verified] Every anchored popup is unusable inside a modal Dialog/Sheet, and every toast is unclickable while one is open.** `overlayHost()` parks Dropdown/MenuButton/ContextMenu/rail-flyout/Message panels outside the `<dialog>`, so `showModal()` makes them inert.
2. **[verified] Non-modal Sheets close themselves when you click an item in a menu opened from inside them, and Escape closes the sheet while leaving its dropdown open.** Root cause: there is no overlay stack.
3. There is no shared overlay kernel. `nextOverlayOrder()` exists in three copies (modal, sheet, dropdown, with a source comment admitting it). Escape/outside-click logic is written six times: Dropdown manager, Tooltip (5 document listeners *per instance*), non-modal Sheet, AppRail, MenuButton/ContextMenu, and the kit drawer.
4. **Forced-colors focus loss.** base.css deliberately keeps a transparent outline for forced colors. 22 component rules in this area, plus `.zx-icon-btn` in base.css itself, set `outline: none/0` and rely on box-shadow, which forced-colors mode removes.
5. **[verified] Geometry is declared inside the light theme block.** A nested `[data-zx-theme="light"]` region resets an application's `--zx-control-height` override to 30px, while a dark region keeps it. This breaks the "one geometry" rule.
6. **[verified] Toolbar's roving tabindex takes ArrowLeft/Right/Home/End from text inputs inside it.** **[verified] A generic Dropdown panel can't be reached with Tab.**
7. There are four navigation primitives (AppRailPresenter, ModuleBar, AppSidebar, NavigationBar) with three keyboard models: every tile tabbable, one tab stop, wrap vs no-wrap. There are three tab implementations (Tabbox, NavigationBar tab mode, Dock pane tabs) and two typeahead implementations (core 500ms, ModuleBar 600ms).
8. **Copy-paste helpers that belong in core:** `snapshot/restore` in 8 files, although `core/dom.js` already exports `snapshotTarget/restoreTarget`. Also `replaceContent/appendSlot` (9 copies), `_message()` (15 classes), the visually-hidden recipe (50 copies in 36 files), and identical MenuButton/ContextMenu CSS (~125 lines each).
9. **The APIs disagree.** `closable` means "Escape allowed" in Modal, "Escape + ✕" in Dialog, "Escape only" in Sheet, and "render ✕" in Message. Others: `delay/hideDelay` vs `openDelay/closeDelay`; `show/hide` vs `open/close`; `snap` (detent array vs pixel radius); `size` (px presets vs CSS length vs sm/md/lg); item identity as `name/title` vs `name/label` vs `id/label`; seven different action-descriptor shapes.
10. **The token tier has duplicate and unused roles,** and a ZeyOS-specific module palette sits in an "agnostic" system. The lint misses whole classes of breach: `--zx-accent-*`, icons.css, JS-set custom properties, `oklch()`. The kit (`iconButton`, `paneHeader`, `shortcuts`, a hand-made drawer) shows four missing library primitives.

---

## 1. Redundancies

### 1.1 No overlay kernel: stacking, Escape and outside-click written six times — **high**
- `nextOverlayOrder()` is copied verbatim three times: src/components/modal/modal.js:463-468, src/components/sheet/sheet.js:514-518 (comment at :510-511 says "the three should converge on one kernel helper") and src/components/dropdown/dropdown.js:269-274. `topmostOverlayComponent()` exists only in dropdown.js:255-266.
- Escape / light-dismiss implementations:
  - Dropdown: `DropdownDismissManager`, a fake Component that appends a hidden marker `<span>` to `<body>` so it can own document listeners (dropdown.js:201-222, 276-289).
  - Tooltip: five permanent document listeners per instance (tooltip.js:129-146). AppRail creates one Tooltip per tile (app-rail.js:237-245), so a 20-tile rail adds 100 document listeners.
  - Non-modal Sheet: own `keydown` on its root and `pointerdown` on the document (sheet.js:125-137).
  - AppRail: own document `pointerdown` (app-rail.js:256-262) and own Escape with `stopPropagation` (app-rail.js:459-471).
  - MenuButton / ContextMenu: panel Escape (menu-button.js:267-273, context-menu.js:275-278).
  - Kit drawer: capture-phase Escape with selector special cases (kit.js:1193-1205).
- None of the non-Dropdown handlers consult the overlay order. This is the root cause of the verified bugs in 3.1 and 3.2.
- **Recommendation:** add `src/core/overlay-stack.js` with `push(component, {modal, dismiss})`, `pop()`, `topmost()`, `isTopmost(el)` and one lazily installed document `keydown`/`pointerdown` dispatcher, built on an AbortController and not on a DOM marker. Modal, Sheet, Dropdown, Tooltip, AppRail flyouts and Message register with it. Delete the three `nextOverlayOrder` copies and the dismiss manager. `overlay-host.js` (42 lines, hosting only) should merge into it or sit next to it.
- **Cost:** internal only, so not breaking. `data-zx-overlay-order` can stay as a debugging attribute.

### 1.2 Modal / Dialog / Sheet — **low (mostly done right), with leftovers**
- Inheritance is sound: Sheet → Dialog → Modal. The focus trap, Escape, backdrop and scroll lock come from native `showModal()` plus one CSS rule (modal.css:54-57).
- Leftovers:
  - `replaceContent` is in both modal.js:442-453 and dialog.js:542-562 (plus `appendContent`).
  - `_message()` is redefined identically in dialog.js:438-441 and sheet.js:277-280.
  - `Dialog.open()` is a no-op override (dialog.js:156-164).
  - The trap-focus Sheet adds `focusTrap()` (keyboard.js:30-72), which captures and restores focus a second time on top of `Modal#restoreFocus` (modal.js:230-234). The restore is harmless, but there are two owners.
- **Recommendation:** delete the duplicates and the no-op override. Move `replaceContent` into core/dom.js (see 1.10).

### 1.3 Dropdown vs MenuButton vs ContextMenu vs Tooltip — **medium**
- Positioning is shared through `position()`, which is good. The placement enum is duplicated in tooltip.js:8-11 (`PLACEMENTS` Set) and position.js:4-9. Default offsets differ for no stated reason: Dropdown 4 (dropdown.js:36), Tooltip 6 (tooltip.js:63), rail flyouts 6 (app-rail.js:350).
- MenuButton and ContextMenu duplicate the menu controller: roving + typeahead setup (menu-button.js:114-118 / context-menu.js:101-102), `#onMenuKeydown` (menu-button.js:266-287 / context-menu.js:273-289), select-then-close (menu-button.js:351-384 / context-menu.js:292-310) and `#menuItems`.
- The copies have already drifted. Tab calls `preventDefault()` in ContextMenu (:275-277) but not in MenuButton (:274-277). Choice rows exist only in MenuButton. ContextMenu has no `cssName` and appends its anchor straight to `document.body` (context-menu.js:89) instead of going through `overlayHost`.
- CSS: src/components/menu-button/menu-button.css and src/components/context-menu/context-menu.css are line-for-line identical apart from the block name and the choice rules (diff ≈ 60 lines out of 194/136). `renderMenuEntries(entries, block)` (menu-items.js:92) parameterises the block only so that the CSS can be copied.
- **Recommendation:** extract an internal `MenuController(panel, {items, onselect, returnFocus})` into src/internal/menu-items.js. Render one `.zx-menu` block. Keep `.zx-menu-button__menu` and `.zx-context-menu` as aliases for one release.
- **Cost:** CSS class rename, breaking for theme overrides. An alias period softens it.

### 1.4 Navigation primitives: AppRailPresenter, ModuleBar, AppSidebar, NavigationBar, Dock — **high**
- What is shared: `AppRailPresenter` (internal) → `ModuleBar` extends it, and AppSidebar composes either one.
- What is duplicated between AppSidebar and AppRailPresenter:
  - `navControl()` (app-rail.js:746-763 vs app-sidebar.js:1176-1194, already diverged: only the rail adds `rel: 'noopener'` and runs `safeHref`).
  - `_select()` (app-rail.js:406-426 vs app-sidebar.js:1048-1065, identical).
  - `_syncActive()` (app-rail.js:604-626 vs app-sidebar.js:1068-1083).
  - `findItem`/`containsItemId` (app-rail.js:808, app-sidebar.js:1196-1218, module-bar.js:1056-1070).
  - `appendSlot` (app-rail.js:813, app-sidebar.js:1210).
  - The "snapshot original root" block (app-rail.js:88-91 + 212-216, app-sidebar.js:132-135 + 462-466).
- Keyboard models (see 3.5 for details):
  - AppRailPresenter makes every tile a Tab stop and wraps (app-rail.js:429-452).
  - ModuleBar is one Tab stop with its own roving (module-bar.js:777-807) and its own typeahead (module-bar.js:22, 600ms; core keyboard.js:192 uses 500ms).
  - The AppSidebar tree makes every row a Tab stop and doesn't wrap (app-sidebar.js:1036-1043).
- Coupling: AppSidebar calls ModuleBar's private `_tiles()` (app-sidebar.js:1028). app-sidebar.css:533-606 restyles `.zx-app-rail__item*` classes from outside.
- NavigationBar is a fifth primitive with its own overflow algorithm (container query + ResizeObserver, navigation-bar.js:421-497). It also contains a whole second Tabbox (see 1.5).
- `src/components/app-rail/` contains only a CSS file. The component lives in `src/internal/`, yet `normalizeAppItems` is exported publicly from it (src/index.js:127).
- **Recommendation:**
  1. Move the shared helpers (`navControl`, `select`, `syncActive`, tree utils, `appendSlot`) into `internal/app-rail.js` and make AppSidebar use them.
  2. Pick one keyboard contract for nav lists: roving, one Tab stop, and a documented choice of wrap or no wrap. Implement it with `rovingTabindex` + `typeahead` from core and delete ModuleBar's private copies.
  3. Make `_tiles()` public (`getTiles()`) or route through an event.
  4. Either promote AppRail to a public component with JS + demo + docs, or move its CSS into module-bar.css and app-sidebar.css.
- **Cost:** keyboard changes are behavioural (a minor-version break for AppRail tab order). Helper extraction is not breaking.

### 1.5 Three tab implementations — **medium**
- Tabbox (tabbox.js:342-378), NavigationBar tab mode (navigation-bar.js:388-419, plus `_ensurePanel` :375-386 duplicating Tabbox `_ensureContent` :435-447, and `isPanelContent` :595 duplicating `isTabContent` :501) and Dock pane tabs (dock.js:486-536, the only one using core `rovingTabindex`).
- **Recommendation:** extract an internal `tabs(list, panels, {activation:'manual'})` controller on top of `rovingTabindex`. Drop NavigationBar's tab mode and document "use Tabbox for panels". If the mode stays, it at least has to be documented (see 5).
- **Cost:** removing NavigationBar tab mode is breaking. It is also undocumented, so the exposure is likely small.

### 1.6 Panel vs Groupbox vs Card vs MasterPanel vs kit `paneHeader`/`panelBlock` — **medium**
- Groupbox (`<details>`, title, open/close events) is a strict subset of Panel (`collapsible:true`, no buttons). Both emit `open`/`close`, the same names the overlays use for a different concept.
- Each surface has its own header row CSS: panel.css header, card.css header, master-panel.css:12-22, dialog.css:11-22, dock pane header, and kit.css:123-180 `.shell__header` used by 46 `paneHeader()` calls.
- Heading semantics vary:
  - Panel's title is a `<span>` inside the toggle button, so it is not a heading (panel.js:80, 90-99).
  - MasterPanel hard-codes `<h1>` (master-panel.js:71).
  - Dialog hard-codes `<h2>` (dialog.js:134).
  - Card has `headingLevel` (card.js:28).
  - The kit's `paneHeader` has `level`.
- Action slots use the same `button()`-descriptor-with-`onclick` shape, but the `onclick` → `this.listen` conversion is written out twice (panel.js:274-288, master-panel.js:126-142) and NavigationBar repeats it in `setActions`.
- **Recommendation:**
  1. Fold Groupbox into Panel as `new Panel(details, {native: true})`, or deprecate one of the two.
  2. Extract a shared `.zx-header` part (title + actions, plus an optional leading slot) and a `buildActions(list, listen)` helper.
  3. Add `headingLevel` to Panel, MasterPanel, Dialog and Groupbox.
- **Cost:** Groupbox deprecation is breaking with an alias path. `headingLevel` is additive.

### 1.7 Toolbar vs ListToolbar — **low (cross-area)**
- ListToolbar deliberately doesn't use Toolbar (list-toolbar.js:82). It uses `role="group"` without roving, a `{id,label,pressed}` tool descriptor and localised labels. Toolbar uses `{name,label,active}` and English defaults (toolbar.js:66-68). The same "pressed toggle" concept has two property names (`active` vs `pressed`).
- **Recommendation:** align on `pressed`, and give ListToolbar's tool strip `role="toolbar"` with roving by reusing Toolbar for its trailing tools. Flagged for the data/views auditor.

### 1.8 Loading vs Skeleton vs Message progress — **low**
- Spinner, ProgressBar, InlineLoading and Skeleton have distinct roles, which is fine.
- `Message.progress` builds a second progressbar with its own markup and CSS (message.js:378-392, `.zx-message__progress`) instead of composing `ProgressBar`. Status vocabularies differ: InlineLoading `inactive|active|success|error`, ProgressBar `active|success|error`, Message `info|success|warning|error` plus the alias `danger`.
- **Recommendation:** render `ProgressBar({size:'sm'})` inside the toast, and align the status enums.

### 1.9 Message vs kit toast helpers — **medium**
- kit.js:95-114 (`toast`, `toaster`) is a thin wrapper, but it exists mainly because `Message.show` without `scope` falls back to `document.activeElement` (overlay-host.js:17-19). Every layout therefore has to pass `scope: root`.
- website/layouts/checkout-wizard.layout.js:307-316 hand-builds an Undo toast with `.toast-action` (kit.css:918) and a raw `button()` inside the message content. That bypasses `Message`'s `action` option, so the toast neither stays 8 s (message.js:49, 609-612) nor closes after Undo. This public example teaches the wrong pattern.
- **Recommendation:** switch the layout to `action: {label:'Undo', onclick}` and delete `.toast-action`. Consider `Message.configure({scope})` or a per-app default scope.
- **Cost:** not breaking.

### 1.10 Core helpers re-implemented per component — **medium (cross-area with core auditor)**
- `snapshot()/restore()` copies: panel.js:314-331, master-panel.js:164-181, groupbox.js (`snapshot`/`restore`), navigation-bar.js:601-617, tabbox.js:507-525, message.js:706-718, menu-button.js:84-87 + 249-253, app-rail.js:88-91 + 212-216, app-sidebar.js:132-135 + 462-466. Card, Toolbar, Dock and ListToolbar already use `snapshotTarget/restoreTarget` from core/dom.js.
- Content insertion copies: modal.js:442, dialog.js:542-562, dropdown.js:241, panel.js:334, master-panel.js:184, app-rail.js:813, app-sidebar.js:1210, dock.js:968, tooltip.js:387. Their accepted types differ silently: Panel throws on numbers, Modal accepts `toElement`, Groupbox throws on null.
- `_message(key, fallback)` is copied into 15 classes (card, checklist, time-picker, dialog, finder, message, number-field, panel, search, select, sheet, tabbox, timebox, tree, plus a printf variant in app-rail.js:653 and app-sidebar.js:1107).
- The focusable selector is written four times: keyboard.js:2-6, modal.js:9-12, kit.js:841-842 and app-sidebar.js:863.
- **Recommendation:**
  - `Component#t(key, fallback, ...args)` in core.
  - `toNode(content)` / `setContent(el, content)` in core/dom.js with one accepted-type contract.
  - Mandatory use of `snapshotTarget/restoreTarget`.
  - Export `FOCUSABLE_SELECTOR` from keyboard.js.
- **Cost:** not breaking.

### 1.11 Duplicated CSS recipes — **medium**
- **Visually hidden:** `clip-path: inset(50%)` appears 50 times in 36 files (in this area: app-rail.css:82, spinner.css:41, progress-bar.css:62, stepper.css:166, plus kit.css:700 `.visually-hidden`). There is no utility in base.css. Add `.zx-visually-hidden` to base.css.
- **Glass surface recipe:** border + `background-color` + `background-image` + `background-clip` + `backdrop-filter` + `box-shadow` is restated in modal.css:1-15, dropdown.css:1-15, tooltip.css:7-31, message.css (~:75-95) and the app-rail popover. Each copy adds its own `@media (prefers-reduced-transparency)` fallback (12 blocks in this area, 22 library-wide). semantic.css:205-242 already resolves exactly that at the token seam ("so every material consumer ... receives the same deterministic opaque fallback"). The component blocks are redundant and also skip `prefers-contrast: more`, which the token seam covers.
  - Recommendation: one `.zx-surface[data-material="overlay|panel|raised|chrome"]` part, or a documented mixin pattern, and delete the per-component media blocks.
- **Icon buttons, four recipes:**
  - `.zx-icon-btn` (base.css:112-139, a CSS-only utility with no JS factory);
  - Dialog close: `.zx-btn.zx-dialog__close` with a literal "×" (dialog.js:135-142, dialog.css:32-37);
  - the kit's `iconButton()` (kit.js:527-537, used in 21 layouts);
  - `button({icon, title})` producing a bordered `.zx-btn`.
  - Recommendation: export `iconButton({icon, label, kind:'ghost', shortcut})` from button.js (cross-area) and use it everywhere.
- **Badge recipes in nav CSS, seven of them:** app-rail.css:84-95 (raw `font-size:10px`, `line-height:15px`), :212, app-sidebar.css:266 and :533-556, module-bar.css:69, :315-334 and :444. They ignore the Badge component and disagree on semantics: rail badges use the accent, while the docs say tab and nav badges are "neutral counts" (llms.md Tabbox/NavigationBar).
- **Segmented control, four copies:** Tabbox `segmented` variant (tabbox.css ~:196-230), menu choice row (menu-button.css:131-193), AppSidebar presentation radiogroup (app-sidebar.css:381-452) and kit `.segmented` (kit.css:875-916, used as a radiogroup by inbox.layout.js:184-187). A library SegmentedControl / radio-button group is missing (CheckButton may cover it; cross-area).
- **Focus treatment:** most components use `box-shadow: var(--zx-focus-ring)`, but modal.css:45-48 uses `outline: 2px solid var(--zx-color-ring)`. See 3.4.

### 1.12 Token duplication and near-duplicates — **medium**
- Two backdrop roles: `--zx-color-bg-backdrop` (50%/75%) and `--zx-color-overlay-backdrop` (28%/38%) (semantic.css:27, 118; dark.css:35, 37). The first is consumed only by website/theme-presets.js and as the fallback of the second.
- Identical values in light:
  - `--zx-color-accent-subtle` ≡ `--zx-color-bg-selected` (semantic.css:26, 44);
  - `--zx-color-accent-hover` ≡ `--zx-color-accent-active` (:42-43; `-active` has 0 consumers);
  - `--zx-color-border` ≡ `--zx-color-border-control` (:28, 30);
  - `bg-surface` ≡ `bg-raised` ≡ `bg-control` (:19-21).
  - Each pair needs a written reason to exist, or should be collapsed.
- Hover, selected and divider come in two parallel sets: `--zx-color-bg-hover` vs `--zx-color-overlay-hover`, `--zx-color-bg-selected` vs `--zx-color-overlay-selected`, `--zx-color-border-subtle` vs `--zx-color-overlay-divider`.
- Blur and filter: `--zx-overlay-blur: 8px` and `--zx-glass-blur: 8px` (semantic.css:106, 120). `--zx-glass-filter-overlay` vs `--zx-glass-filter-panel` (:128-129). `--zx-overlay-shadow` vs `--zx-glass-overlay-shadow`, `--zx-glass-panel-shadow` and `--zx-glass-raised-shadow` (:200-202).
- Unused (0 consumers in src/, website/ or styles/): `--zx-header-bg`, `--zx-header-text` (declared in three places: semantic.css:132-133, dark.css:90-91, :163-164), `--zx-ease-spring` (global.css:163) and `--zx-color-accent-active`.
- Single-component tokens in the semantic tier: nine `--zx-app-icon-*` tokens and three `--zx-color-app-icon-*` tokens (semantic.css:39-40, 112-117, 166-167, 198-199). `--zx-overlay-toast-image` reads the component-local `--zx-message-kind` (semantic.css:189-191), so a component variable leaks into the token tier.
- Raw values in semantic: `--zx-control-font-weight: 500` (semantic.css:99) should be `var(--zx-weight-medium)`. There is no title weight token, so `font-weight: 650` is hard-coded in card.css:110, master-panel.css:29, navigation-bar.css:32 and dialog.css:27.
- themes.css:22-28 restates the emerald hex values instead of `var(--zx-emerald-*)`. Preset naming is confusing: `zx` is the ZeyOS green and `zeyos` is "Marque Gold" (themes.css:21-37).
- styles/tokens/modules.css (110 lines of `--zx-module-*` hex) is ZeyOS-specific, generated from src/zeyos/modules.js and imported unconditionally by styles/zx.css:5, in a system that AGENTS.md calls product-agnostic. master-panel.js:19-24 hard-codes a different, shorter subset of module names (28), so `module: 'items'` silently becomes `default`.
- dark.css duplicates its whole block for `auto` (:94-166). That is acknowledged and test-guarded, so low.
- **Recommendation:**
  - Collapse the identical pairs or document each one.
  - Delete the unused tokens.
  - Move the app-icon tokens into app-icon.css as component-local properties.
  - Add `--zx-weight-bold`/`--zx-weight-title`.
  - Move modules.css into an opt-in `styles/zeyos.css` entry, imported by the zx-zeyos binding.
- **Cost:** removing tokens is breaking for applications that set them. Deprecate for one minor version.

---

## 2. API inconsistencies

| Concept | Spellings found (file:line) | Recommendation |
|---|---|---|
| Dismiss via Escape | Modal `closable` = Escape only (modal.js:18); Dialog `closable` = Escape **and** ✕ (dialog.js:21, :107); Sheet `closable` = Escape only, ✕ controlled by `closeButton` (sheet.js:31-32, 44, 118); Message `closable` = render ✕ (message.js:18) | `dismissible: {escape, closeButton, outside}` or three flat booleans with one meaning everywhere. Rename Message's to `closeButton`. Breaking, so add aliases. |
| Outside click | Modal `lightDismiss:false`, Sheet `lightDismiss:true` (sheet.js:92), Dropdown always on, Tooltip always on, AppRail always on | Default by kind, documented in one table. Add `lightDismiss` to Dropdown. |
| `cancel` event | Fired only for Escape (modal.js:76-79) and footer `action:'cancel'`. Not fired for the ✕ (dialog.js:109 calls `close()`), light dismiss (modal.js:83-86) or swipe dismiss (sheet.js:227-231). The ✕ also closes when `closable:false` + `closeButton:true` in Sheet. | Route every user dismissal through one cancelable `cancel` (reason: `'escape'|'close-button'|'outside'|'swipe'`). |
| Open/close verbs | Modal, Dialog, Sheet: `open/close/isOpen`, no `toggle`. Dropdown: `open/close/toggle/isOpen`. MenuButton: no `toggle`. ContextMenu: `openAt/openAtElement/close/isOpen`. **Tooltip: `show/hide/toggle`** (tooltip.js:169, 200) while still emitting `open/close`. Tabbox: `show(name)` and `openTab(name)` (tabbox.js:237, 253). | `open/close/toggle/isOpen` on every overlay. Keep `show/hide` as deprecated aliases. |
| Disclosure verbs and events | Panel/Groupbox `open/close` events (the same names as overlays). Dock and SplitView `collapse/expand` events. AppSidebar `collapsechange {collapsed}` plus `presentationchange`. `isCollapsed()` returns boolean in Dock but `'start'|'end'|false` in SplitView. | Disclosures emit `toggle {open}` (matching the native `<details>` event). Collapsible layouts emit `collapse/expand`. |
| Hover delays | Tooltip `delay/hideDelay` (tooltip.js:30-31). AppRail, AppSidebar, ModuleBar `openDelay/closeDelay`, repeated in three typedefs and defaults (app-rail.js:33-34, 68-69; app-sidebar.js:64-65, 110-111; module-bar.js:55-56, 102-103). AppRail also hard-codes Tooltip `delay: 450` (app-rail.js:241). | `openDelay/closeDelay` everywhere. A shared `HOVER_DELAYS` constant in core. |
| Size | Modal `width` (px or CSS); Dialog `size: 'sm'|'md'|'lg'|number`, mapped to 400/600/840 px (dialog.js:427), with **Modal's `width` silently overwritten** (modal.js:73 then dialog.js:102); Sheet `size` = CSS length (sheet.js:28); Spinner sm/md/lg = 16/24/40 px; EmptyState md/sm; MenuButton forces `data-size="md"` (menu-button.js:96) with no option. | `size` is always a preset enum; `width`/`length` is always a CSS length. Throw or warn when Dialog gets `width`. |
| `snap` | Sheet: array of detents (sheet.js:38-40). SplitView: pixel radius number (split-view.js:22-23). | Rename SplitView's to `snapRadius`. |
| Collapsibility | Panel/Dock/AppSidebar `collapsible: boolean`; SplitView `collapsible: false|'start'|'end'` | Acceptable but undocumented as a pattern. |
| Modality | Sheet `modal: true|'trap-focus'|false` (sheet.js:23-25); Modal is always modal. | Keep the tri-state, but rename it to `modality: 'modal'|'trap'|'none'`, so a boolean-looking option isn't secretly a string. |
| Side / edge | Sheet logical `start|end|top|bottom` (sheet.js:7). AppRail, AppSidebar, ModuleBar physical `left|right|top|bottom` (app-rail.js:29, app-sidebar.js:39, module-bar.js:38). | Logical everywhere. Accept physical values as aliases. |
| Item identity | `name/title`: Tabbox (tabbox.js:10-11), NavigationBar (:11-12), Dock tabs (:18-19), Stepper (steps.js:9-10). `name/label`: Breadcrumb (:11-12), Toolbar (:23-24). `id/label`: AppNavItem (app-rail.js:10-11), ModuleItem, ListToolbar tools. | `id` + `label` everywhere. `title` stays for headings only. |
| Action descriptors | Panel `buttons`/`footerButtons`; MasterPanel `buttons`; NavigationBar `actions`; Card `actions` (`ButtonOptions`); EmptyState `actions`; Dialog `buttons` with `action:'close'|'cancel'|fn` + `autofocus`; Message `action` (single); Toolbar items `active`; ListToolbar tools `pressed`. | One `ActionDescriptor` typedef in button.js. Rename slots to `actions` (header) and `footerActions`. |
| Selection events | `select {item,id,value,href,event}` (AppNav); `select {value,item}` (MenuButton); `select {value,item,context}` (ContextMenu); `change {name}` (NavigationBar); `change {name,previous}` (Tabbox); `action {name,item}` (Toolbar); `tabchange {pane,tab,previous}` (Dock). | Navigation uses `select {id, item, value}`. Tab-like controls use `change {id, previous}`. |
| Slots | AppSidebar `header/footer/railHeader/railFooter`, where `railHeader` means "strip header" in modules layout (app-sidebar.js:58-61); ModuleBar `header/footer`. | Nest them: `rail: {header, footer}`. |
| "expanded" | AppSidebar `expanded` = branch ids (:37), `presentation: 'expanded'` = layout state (:46), ModuleBar `expanded` = module id (module-bar.js:46). | Rename to `openBranches` and `panelModule`. Breaking, so add aliases. |
| Static defaults | Tabbox `label` is in the typedef but missing from `static defaults` (tabbox.js:43-45 vs 70-75). Dialog/Sheet typedefs omit the inherited `lightDismiss`, `destroyOnClose`, `width`, `scope`, `content` (dialog.js:17-27). Sheet's `this.options` is typed `ModalOptions` through the inheritance chain. | Complete the typedefs. Use `@extends {Dialog}` with an intersection options type. |
| English literals as defaults | Toolbar `label:'Toolbar'`, `overflowLabel:'More'` (toolbar.js:66-68); SplitView and Dock `'Resize panes'` (split-view.js:73, 184; dock.js:102, 609); AppRail/AppSidebar `'Applications'` (app-rail.js:65, app-sidebar.js:105); NavigationBar `'More'`, `'Primary navigation'`, `'Application actions'` (navigation-bar.js:97, 127, 144); MasterPanel `'Panel actions'` (master-panel.js:76). Panel, Sheet and Breadcrumb already go through `msg()`. | `null` defaults resolved through `this.t('component.key', 'English')`. |

---

## 3. Behaviour and accessibility

### 3.1 [verified] Popups and toasts are inert under a modal Dialog/Sheet — **high**
- `overlayHost()` (overlay-host.js:16-23) returns the nearest `.zx-scope`/`[data-zx-theme]`/`[data-zx-preset]` and never the open `<dialog>` containing the anchor.
- Dropdown (dropdown.js:63, 98-99), Tooltip (:100, 172-173), Message regions (message.js:557-575), rail flyouts (via Dropdown) and ContextMenu (context-menu.js:89, `document.body`) therefore append their panels outside the dialog. `showModal()` makes everything outside the dialog subtree inert.
- Reproduced: a MenuButton inside a `Dialog` opens, `elementFromPoint` on an item returns the dialog, pointer clicks time out, ArrowDown leaves focus on the trigger, and Enter selects nothing.
- `Message.show(..., {action})` while a Dialog is open: the Undo button can't be clicked.
- Affected: MenuButton, ContextMenu, Dropdown, Toolbar overflow, NavigationBar overflow, Breadcrumb overflow, ModuleBar catalogue and flyouts, AccountMenu, and every toast while any modal is open. Tooltips still render, because they aren't interactive.
- **Recommendation:**
  - In `overlayHost()`, prefer `anchor.closest('dialog:modal, dialog[open], [popover]:popover-open')` when present, then the theme scope.
  - Give the Message region a "re-parent into the topmost modal" rule through the overlay stack in 1.1.
  - Add a smoke test: a menu inside a Dialog, and a toast action while a Dialog is open.
- **Cost:** not breaking.

### 3.2 [verified] Non-modal Sheet dismissal ignores its own child overlays — **high**
- Light dismiss (sheet.js:131-136) tests `this.el.contains(target)`. A MenuButton/Dropdown panel opened from inside the sheet lives in the overlay host, so a click on a menu item closes the sheet before `select` fires. Probe log: `["sheet-close","select:a"]`.
- Escape (sheet.js:125-130) handles the key on the sheet root before the Dropdown dismiss manager sees it, calls `preventDefault()`, and closes the sheet. The Dropdown stays open, anchored to a hidden element. Probe result: `{sheetOpen:false, dropdownOpen:true}`.
- **Recommendation:** check overlay ownership through the overlay stack (1.1): dismiss only when the sheet is topmost, and treat descendants registered with the stack as inside.
- **Cost:** not breaking.

### 3.3 Escape chaining in general — **medium**
- Tooltip's document Escape (tooltip.js:129-133) calls `preventDefault()` unconditionally and ignores `defaultPrevented` and overlay order. With a Dropdown and a tooltip both open, one Escape closes both.
- The kit drawer needs selector heuristics to avoid swallowing Escape meant for popups (kit.js:1199-1203). It also special-cases ModuleBar tiles, which carry `aria-expanded` for an adjacent panel.
- **Recommendation:** use the overlay stack, so each Escape closes exactly one topmost layer.

### 3.4 Forced-colors focus indicator removed — **high (WCAG 2.4.7 under forced colors)**
- base.css:25-33 explains that the outline must stay (transparent) because forced colors drops box-shadow. base.css:131-134 then sets `outline: 0` on `.zx-icon-btn:focus-visible`.
- In this area, outline is suppressed in: card.css:54, 132; panel.css:52; tabbox.css:116, 158, 186, 223, 294; stepper.css:73; breadcrumb.css:61; split-view.css:102; dock.css:86, 144, 175, 225; app-sidebar.css:416; module-bar.css:215, 379, 429; modal.css:42 (`:focus`); sheet.css:252; menu-button.css:184.
- None of the forced-colors blocks (card.css:39, app-sidebar.css:447/600, module-bar.css:475, app-rail.css:291, menu-button.css:188) restore an outline.
- The token lint (tests/lint-tokens.js:61-69) passes any file that contains one `:focus-visible` rule anywhere, so it can't catch this.
- **Recommendation:** replace `outline: 0/none` with `outline-color: transparent` (or delete the declaration) in every one of these rules. Tighten the lint so `outline: none|0` is allowed only together with `outline-color: transparent` or inside `@media not (forced-colors: active)`.
- **Cost:** not breaking.

### 3.5 Roving tabindex consistency — **medium**
- Core `rovingTabindex` is used by Toolbar (toolbar.js:114), MenuButton, ContextMenu and Dock tabs.
- Hand-rolled: Tabbox (tabbox.js:448-452), NavigationBar (:498-502), ModuleBar (module-bar.js:777-807), the AppSidebar presentation switch (:699-717).
- No roving at all, so every item is a Tab stop: AppRailPresenter tiles (app-rail.js:429-452) and the AppSidebar tree (app-sidebar.js:1001-1046). Together with ModuleBar's "one Tab stop" (module-bar.js:78-79), the same visual rail behaves differently depending on which class drew it.
- `rovingTabindex` has no RTL handling: ArrowLeft/Right aren't swapped (keyboard.js:120-121). The same is true of Tabbox (tabbox.js:348-354) and NavigationBar, while position.js and Sheet are direction-aware.
- `rovingTabindex` watches *all* attribute mutations in the subtree (keyboard.js:146-147) and re-queries on each. That's expensive in large menus, and it sees its own `tabIndex` writes.
- **Recommendation:** add `rtl: 'auto'` to `rovingTabindex`, restrict the observer to `attributeFilter: ['hidden','disabled','aria-disabled']`, and migrate all hand-rolled instances to it.

### 3.6 [verified] Toolbar arrow keys are taken from text inputs — **medium**
- `ITEM_SELECTOR` includes `input`, `select` and `textarea` (toolbar.js:8-19). `rovingTabindex.onKeydown` (keyboard.js:112-134) prevents default for ArrowLeft/Right/Home/End on any matching item.
- Reproduced: caret at position 3 in `<input>` inside a Toolbar; ArrowLeft moves focus to the previous button and the caret doesn't move. The APG toolbar pattern explicitly exempts text inputs.
- **Recommendation:** skip editable targets in `rovingTabindex` (an `isEditable` check, which the kit already has at kit.js:665-672), or remove text controls from the selector.
- **Cost:** not breaking.

### 3.7 [verified] Generic Dropdown is not keyboard-reachable — **medium**
- The panel is portaled to the overlay host. `open()` (dropdown.js:96-111) moves no focus, and `showPopover()` gets no `source` (position.js:219-226). Tab from the anchor therefore skips the panel. Probe result: `{open:true, active:"after"}`.
- No `role` and no `aria-haspopup` is set on the anchor or panel. `close()` with focus inside the panel doesn't restore focus: only the Escape path does (dropdown.js:186-192).
- **Recommendation:** add `focus: 'first'|'panel'|'none'` and `role: 'dialog'|null`. Pass `{source: anchor}` to `showPopover` where supported (it restores invoker tab order). Restore focus in `close()` when focus is inside the panel.

### 3.8 Dialog semantics — **medium**
- `Dialog.alert/confirm/prompt` (dialog.js:263-416) never set `role="alertdialog"` or `aria-describedby` on the message, which the APG alert dialog pattern requires. A destructive confirm is announced as a plain dialog.
- Bare `Modal` has no way to get an accessible name: no `label`/`labelledBy` option.
- The close glyph is the text "×" (dialog.js:142), which breaks the AGENTS rule that icons go through `icon()`.
- **Recommendation:** add `alert: true` (sets the role and describedby) for the statics, `label`/`labelledBy` for Modal, and `icon('x')` for the close button.

### 3.9 Tooltip — **medium**
- `pointer-events: none` (tooltip.css:27-30) means the bubble can't be hovered. Moving the pointer onto it fires `pointerleave` on the anchor and it hides after 80 ms. That fails WCAG 1.4.13 "Hoverable", although the docs claim 1.4.13 compliance (llms.md Tooltip "Keyboard", tooltip.js:127). Only "Dismissible" is met.
- Each instance adds five document listeners (see 1.1).
- **Recommendation:** a pointer-safe corridor (cancel the hide while the pointer is over the bubble) with `pointer-events: auto` on the bubble, plus one shared listener set.

### 3.10 Messages — **medium**
- Live regions are nested: the region is `role="status" aria-live="polite"` (message.js:179-180, 569-570) and each toast is also `role="status"`/`"alert"` (message.js:357). Some screen readers announce twice. Keep the live region on the container only. For errors, use a separate assertive region rather than a nested `role="alert"`.
- `shouldAnimate()` (message.js:700-703) re-implements the reduced-motion check and ignores `data-zx-motion="reduced"`, although core/motion.js's `prefersReducedMotion()` exists.
- The exit timer is a hard-coded `260` ms (message.js:505) instead of following `--zx-dur-*`.

### 3.11 AppRail flyouts open on focus — **low/medium**
- `focus` on a tile opens its flyout (app-rail.js:382-384). Tabbing through a rail (every tile is a Tab stop, see 3.5) pops a flyout open at each step.
- Each open flyout is a `role="region"` landmark (app-rail.js:357-358) portaled to `<body>`, outside the `<nav>`.
- **Recommendation:** open on Enter, Space or Arrow-into only. Use `role="group"` with `aria-labelledby` on the trigger instead of a landmark.

### 3.12 Landmarks and headings — **low**
- NavigationBar renders `<nav aria-label="Primary navigation">` with a hard-coded, untranslated name (navigation-bar.js:125-128), so two bars produce duplicate landmarks. In tab mode the `<nav>` contains a `role="tablist"` (:214).
- MasterPanel's fixed `<h1>` (master-panel.js:71): several panels on a page produce several h1 elements.
- The Tabbox close "×" is a mouse-only `span` (tabbox.js:179-187). Delete is the keyboard path, but nothing exposes that: add `aria-keyshortcuts="Delete"` on closable tabs.

### 3.13 Reduced motion — **low (fine)**
- Every transition and animation in this area sits inside `@media (prefers-reduced-motion: no-preference)`, and base.css adds a global stop.
- Gap: the OS-level block in base.css:155-164 doesn't include `::backdrop`, while the `data-zx-motion` block (:171-179) does. Any remaining issue comes from JS timers (Message 260 ms, Sheet drag).

---

## 4. Convention breaches

### 4.1 Stray `addEventListener` and listener scoping — **medium**
- AppSidebar `_listenMode` calls `target.addEventListener(...)` with its own AbortController (app-sidebar.js:470-473, 916-918).
- Card calls `addEventListener` with `_actionAbort`/`_linkAbort` (card.js:161, 213).
- To get scoped listeners, two classes invent fake Components that insert hidden `<span>` markers into the DOM: `RailListenerScope` inside the `<nav>` (app-rail.js:660-671) and `DropdownDismissManager` on `<body>` (dropdown.js:201-222).
- Elsewhere, components that rebuild children call `this.listen()` on every rebuild, and the root AbortController keeps those listeners and detached nodes alive until `destroy()`. Examples: NavigationBar `_appendItem` (navigation-bar.js:345-352), Panel `_buildButtons` (panel.js:285) and MasterPanel `setButtons` (:137).
- All of these show one missing core API: `Component#scope()` returning a child `{listen, abort}`. It's a core change, so it belongs to the core auditor. **Cost:** additive.

### 4.2 Module-level and static mutable state — **medium**
- `static #floating = new WeakMap()` (message.js:164) is per-module mutable state wearing a class field. AGENTS forbids exactly this.
- The DOM-marker singleton in Dropdown (dropdown.js:276-289) works around the same rule.
- Both should move into an explicit core registry: the overlay stack.

### 4.3 Class fields vs `render()` — **low (correct, fragile)**
- Modal/Dialog/Sheet/Dropdown/Tooltip/MenuButton/ContextMenu/Toolbar declare private class fields. All of them are only touched after `super()`, so they work.
- Dialog declares `#renderedButtons` *after* the constructor (dialog.js:119-120). Sheet has to set `this._dock = null` after `super()` while `mountTarget()` reads it during `render()` (sheet.js:109-114, 322-324). This works only because `undefined?.el` short-circuits.
- **Recommendation:** document the pattern on `Component`.

### 4.4 Tier-1, raw colour and lint gaps — **medium**
- tests/lint-tokens.js:13 lints `base.css` and `print.css`, but **not `icons.css`**, which the comment above it says must be added deliberately.
- The tier-1 regex (lint-tokens.js:74) covers `gray|green|red|amber|blue|emerald|tone`, but not `--zx-accent-*` (forbidden to components per AGENTS), `--zx-module-*` or `--zx-shadow-*`.
- `oklch()`, `lab()`, `lch()`, `hwb()` and `color()` aren't recognised as raw colours.
- JS-set custom properties aren't checked: master-panel.js:92 writes `var(--zx-module-${name})` (raw hex palette tokens) inline, and that property, `--zx-master-panel-accent`, is **never consumed** by master-panel.css. That is dead code leaking the product palette. Aurora accepts arbitrary CSS colours by design (aurora.js:16), which is acceptable but should be documented as an exception.
- AGENTS lists the allowed tier-2 families. Components in this area also consume `--zx-glass-*`, `--zx-overlay-*-image`, `--zx-overlay-blur`, `--zx-ease-drawer`, `--zx-font-*` and `--zx-drag-shadow`, which aren't on the list, and nothing enforces an allowlist.
- **Recommendation:** either extend the AGENTS list or enforce it. Add icons.css, accent/module/shadow patterns, modern colour functions and a JS `setProperty('--zx-…', 'var(--zx-<tier1>…')` scan.

### 4.5 Hard-coded pixel values and one-geometry violations — **medium**
- **[verified]** semantic.css:15-16 declares `--zx-control-height: 30px`, `--zx-control-pad-x`, `--zx-control-radius`, `--zx-control-font-*`, `--zx-overlay-blur` and the glass filters on `:root, [data-zx-theme="light"]`. The file's own comment (:140-142) says geometry stays on `:root` "so an application's own overrides there still reach nested regions".
  - Reproduced: `html{--zx-control-height:40px}` gives 30px inside `[data-zx-theme=light]` and 40px inside `[data-zx-theme=dark]`.
  - Fix: move every non-colour declaration into a `:root`-only block. Not breaking.
- Fixed pixel sizes that should follow tokens:
  - stepper marker `26px` (stepper.css:15);
  - Tabbox `calc(var(--zx-control-height) + 8px)` (tabbox.css:96, 128, 169) instead of `--zx-space-2`;
  - app-rail badge `10px`/`15px` (app-rail.css:88-94; `--zx-text-xs` is 12px);
  - spinner 16/24/40 px (spinner.css:11-25);
  - Dialog presets 400/600/840 px (dialog.js:427);
  - icon sizes passed as px to `icon()` everywhere (panel.js:86, groupbox, tabbox.js:176/187, message.js:350, empty-state.js:19);
  - kit column widths (kit.css:12-15);
  - kit icon tile 24/32 px (kit.css:426-440, 931-940).
- Raw font weights: 650 in four files (1.12); 500/600 in stepper.css:89/123/138, breadcrumb.css:50/72, app-sidebar.css:231, app-rail.css:186, module-bar.css:62/448, progress-bar.css:18, menu-button.css:124 and context-menu.css:129.
- Radii are within `--zx-radius-lg`, except `--zx-radius-full`, which is used for intentional pills.
- Breakpoints come in three scales: core/breakpoint.js:21 (480/768/1024/1280), kit `SHELL_BREAKPOINTS` (kit.js:839: 1440/1180/860/640) and NavigationBar `44rem` (navigation-bar.js:56). The kit doesn't use the library's breakpoint module.

### 4.6 Component-local custom properties share the `--zx-` namespace — **low**
- Examples: `--zx-pane-size` is shared by Dock and Sheet (sheet.css:172), `--zx-grid-*` belongs to the layout helper while a `Grid` component also exists, and `--zx-split-size`, `--zx-sheet-*`, `--zx-module-bar-*`. Nothing tells a public hook from a private one, and the Sheet docs have to say "internal geometry, not published styling hooks".
- `grid` (layout helper) and `Grid` (data grid) are both exported from src/index.js:87 and :181. They differ only in case, also on `window.zx`.
- **Recommendation:** use a `--_zx-` (or `--zx-_`) prefix for private properties, and rename the layout helper to `autoGrid` (keep `grid` as a deprecated alias).

---

## 5. Docs drift and public-content issues

### Docs drift — **medium**
- **NavigationBar** (llms.md "NavigationBar"): the options list `items: [{ name, title, badge? }]`. Tab mode (`content` → tablist + tabpanels), `href`, `disabled` and per-item `onselect` (navigation-bar.js:9-17, 214, 296-353) are undocumented.
- **Message**: the docs list `maxVisible: 5` under "Per-message options". It is a constructor option (message.js:31, 160).
- **Tooltip**: the docs and JSDoc claim WCAG 1.4.13. "Hoverable" isn't met (3.9). The docs' "Only one is ever visible at a time" is false for `trigger:'manual'` tooltips, which install no listeners (tooltip.js:107).
- **Tabbox**: `show(name)` (tabbox.js:253) is undocumented; only `openTab()` is listed.
- **Dialog**: `getView()` and `addView`'s `title` are undocumented. Inherited `lightDismiss`, `destroyOnClose` and `width` are absent from the typedef and docs, and `width` is silently ignored (2, Size row).
- **Sheet**: the docs say "everything Dialog takes — `closable`" but don't say that Sheet's `closable` no longer controls the ✕ (`closeButton` does), which contradicts Dialog's own `closable` doc.
- **AppSidebar**: the docs say sections give "one `<nav>`", but the modules layout renders two `<nav>` elements (app-sidebar.js:589, 775).
- **MasterPanel**: `module: <ZeyOS module name → accent token>` is documented, but the accent is never painted (4.4), and only 28 names are accepted (master-panel.js:19-24).
- **Dropdown**: "Tooltip, MenuButton, and ContextMenu panels follow the same rule". ContextMenu's anchor is appended to `document.body` unconditionally (context-menu.js:89).

### Public website content (AGENTS "Public website content") — **low**
- Demos, kit and fixtures contain no internal studies or experiments ("Internal review/notes" strings are fictional data). `website/README.md` is excluded by tools/build-site.js:46.
- `src/` ships in the npm package (package.json:56-69) and carries internal decision history in comments:
  - core/breakpoint.js:79-82 and :102-107 ("Table hit exactly this");
  - internal/app-rail.js:645-647 ("Copied from `Pagination` rather than invented");
  - sheet.js:510-511 ("the three should converge on one kernel helper").
  - These are minor, but they are the kind of implementation history AGENTS asks to keep out of published files. Move them to issues or commit messages.
- The public layout example checkout-wizard.layout.js:307-316 shows the wrong toast-with-action pattern (1.9).
- kit.css:367-374 defines `.zx-mark` with the library's own `zx-` prefix for a website-only brand mark. This pollutes the namespace consumers will copy from the examples.

### Kit as a consumer: missing primitives — **medium**
1. **`iconButton()`** (kit.js:527-537, used in 21 layouts). The library has the `.zx-icon-btn` CSS but no factory, and `button()` can only produce a bordered icon button. → export `iconButton` from button.js.
2. **`paneHeader()`** (kit.js:162-168, 46 calls) plus `.shell__header` CSS. Every surface component has its own header. → a `.zx-header` part / `header({title, level, leading, actions})` helper (1.6).
3. **`shortcuts()`, `modShortcut()`, `isMac()`, `isEditable()`, `kbd()`** (kit.js:490-672). The library renders shortcut *hints* in Button, Dialog buttons and menu items ("the host binds the action", dialog.js:14), but offers no binding helper, and every application re-implements it. → `core/shortcuts.js` (root-scoped, editable-aware, sequences), plus a `kbd()` element helper shared with menu-items.js:142 and button.js.
4. **The adaptive shell drawer** (kit.js:1101-1171) hand-implements scrim, `inert`, Escape, focus capture and restore. That is exactly Sheet's job, but Sheet can only anchor to the viewport (top layer) or to a Dock. → a container-scoped drawer mode for Sheet (`container: element`, modal within it via `inert` siblings), or an internal `drawer()` controller that Sheet and the kit share.
5. **Toasts** need an explicit scope (1.9). The `sectionLabel`, `dot`, `.visually-hidden`, `.segmented`, `.icon-tile` and `.list-row` helpers duplicate component internals: AppSidebar section header, Badge dot, ModuleBar/AppIcon tiles (1.11).
6. kit.css:250-402 reaches deep into `.zx-app-sidebar__*`, `.zx-module-bar__*` and `.zx-account-menu__trigger` internals. That is a sign the nav components lack presentation hooks. The selectors will break silently on any internal rename.

---

## Prioritised top 10

1. **Fix overlay hosting under modals (3.1, high, verified).** Make `overlayHost()` prefer the containing open `<dialog>`/popover, re-home toast regions into the topmost modal, and add smoke tests for a menu-in-dialog and a toast while a dialog is open. Not breaking.
2. **Build `core/overlay-stack.js` (1.1, high).** One order counter, one Escape/outside-click dispatcher with topmost checks. Migrate Modal, Sheet, Dropdown, Tooltip, AppRail and Message to it, and delete three `nextOverlayOrder` copies, `DropdownDismissManager` and Tooltip's per-instance document listeners. That fixes 3.2 and 3.3. Not breaking.
3. **Restore forced-colors focus (3.4, high).** Replace 22+ `outline: none/0` with a transparent outline-colour, fix `.zx-icon-btn` in base.css, and tighten the outline lint. Not breaking.
4. **Move geometry out of the light theme block (4.5, high, verified).** `--zx-control-*`, blur and filters go `:root`-only. Not breaking.
5. **Fix `rovingTabindex` (3.5, 3.6, medium, verified).** Skip editable targets, add RTL, narrow the MutationObserver, and migrate Tabbox, NavigationBar, ModuleBar and the AppSidebar switch onto it. Pick one nav keyboard contract for AppRail, ModuleBar and the AppSidebar tree. Behavioural, minor break.
6. **Unify dismissal semantics (2, medium).** One meaning of `closable`/`closeButton`/`lightDismiss` across Modal, Dialog, Sheet and Message. Every user dismissal emits a cancelable `cancel {reason}`, and the ✕ honours it. Breaking, so add aliases.
7. **Extract a menu controller and a single `.zx-menu` CSS block (1.3, medium).** Removes ~250 duplicated JS + CSS lines and the drift between MenuButton and ContextMenu. CSS rename, with an alias period.
8. **Move per-component helpers into core (1.10, 1.11, medium).** `Component#t()`, `toNode`/`setContent`, mandatory `snapshotTarget`, exported `FOCUSABLE_SELECTOR`, `.zx-visually-hidden`, and one surface/material part, deleting the 12 redundant `prefers-reduced-transparency` blocks. Not breaking.
9. **Add the primitives the kit exposes as missing (5, 1.6, medium).** `iconButton()`, a header part with `headingLevel` on Panel/MasterPanel/Dialog, `core/shortcuts.js`, and a container-scoped drawer mode for Sheet. Fold Groupbox into Panel and drop NavigationBar's undocumented tab mode. Additive, plus two deprecations.
10. **Clean up tokens and the lint (1.12, 4.4, medium).**
    - Collapse the identical light pairs and delete the unused `--zx-header-*`, `--zx-ease-spring` and `--zx-color-accent-active`.
    - Move app-icon tokens to component scope, add a title-weight token, and make modules.css opt-in.
    - Extend the lint to icons.css, `--zx-accent-*`/`--zx-module-*`, modern colour functions and JS `setProperty`.
    - Remove the dead `--zx-master-panel-accent`.
    - Fix the docs drift in 5: NavigationBar, Message `maxVisible`, the Tooltip WCAG claim, Dialog `width`, and the checkout Undo toast.
    - Removing tokens is breaking, so deprecate first.
