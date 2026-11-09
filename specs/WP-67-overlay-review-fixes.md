# WP67 — Overlay lifecycle and keyboard corrections

Branch: `wp/65-library-review-fixes`, from WP65. `AGENTS.md` and WP65 apply.

## Scope

- `website/demos/tooltip.demo.js` (supported hover behavior wording only).

- `src/components/message/message.js`, `tabbox/tabbox.js`, `menu-button/menu-button.js`,
  `breadcrumb/breadcrumb.js`, `context-menu/context-menu.js`, `launcher/launcher.js`,
  `dock/dock.js`, `sheet/sheet-stack.js`, `sheet/sheet.js`, `dialog/dialog.js`,
  `tooltip/tooltip.js`, `tooltip/tooltip.css` (all paths under `src/components/`).
- Existing `tests/unit/{message-queue,launcher,dock,modal,overlay-states,breadcrumb}.test.js`
  where applicable, and `tests/regression/overlays.js`.

No core or shared documentation edits. `sheet.js` changes are limited to safe re-presentation
needed by O9. Report documentation changes to the integration owner.

## Required corrections (P2)

1. **O1: persistent messages.** Leaving hover/focus must not dismiss `timeout:0` or unfinished
   progress messages; timed-message pause/resume and explicit dismissal remain correct.
2. **O2: tabs retain a Tab stop.** Removing/disabling a manually focused inactive tab reassigns
   its roving stop and restores focus if needed. Respect active-tab change vetoes and empty lists.
3. **O3: menu Tab exits in order.** Tab/Shift+Tab from a keyboard-opened MenuButton go to the
   next/previous control relative to the trigger. Preserve cancelable selection and focus moved by
   callbacks; use native sequential navigation where possible.
4. **O4: breadcrumb links survive overflow.** Preserve href and native-link behavior when an
   ancestor is collapsed into the shared menu model, including prevented selection.
5. **O5: context menus can open dialogs.** Establish the return-focus destination before selection
   callbacks; a dialog opened by an action must restore the invoking control. Preserve canceled
   selections, native links and intentional focus moves.
6. **O6: Launcher ignores stale close events.** An immediate close/reopen must leave its new
   presentation, ARIA state and requests intact and avoid a spurious close for that presentation.
7. **O7: restored Dock panes materialize.** Restoring an expanded lazy pane invokes its factory
   once and makes content usable, including persisted initial restoration.
8. **O8: Dock releases surviving Sheets.** Destruction removes adopted Sheet subscriptions and
   Dock-owned sizing/styles, preserves caller-owned values where appropriate, and leaves Sheets
   independently usable. No callbacks into the destroyed Dock.
9. **O9: SheetStack raises native presentation.** Re-pushing an open Sheet must align stack order,
   visual top-layer order and Escape handling. Avoid duplicate ownership/close listeners or stale
   close callbacks removing the newly raised sheet; keep meaningful lifecycle events coherent.
10. **O10: prompt IME safety.** Composing Enter cannot submit Dialog.prompt; ordinary Enter still
    submits and cancellation still resolves once.
11. **O11: hoverable tooltips.** A pointer may cross from anchor to tooltip and remain over it
    without hiding it; leaving both hides after the delay. Keep focus-trigger behavior, Escape
    dismissal, touch handling, theme inheritance and destroy cleanup.

## Regression acceptance

Browser checks reproduce each O1–O11 failure through public APIs and actual keyboard/pointer
actions where needed, in both themes. Check no unexpected body nodes after close/destroy,
consecutive create/destroy, focus restoration and canceled actions. Use a deferred Launcher
request to show reopening cannot abort the new request. Observe SheetStack's real Escape target.

## Out of scope

Disabled sidebar branch activation (P3), new overlay APIs beyond what the fixes require, design
changes, new tokens, keyboard-core changes and Datebox (WP66).
