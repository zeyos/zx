# WorkspaceSwitcher

The current workspace at the head of a navigation column — tile, name, and secondary line — opening a menu of the workspaces with the current one checked, then the application’s own actions.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/workspace-switcher · All components: https://zx.zeyos.com/docs/components/index.md

Composes `AppIcon` and `MenuButton` into the workspace switcher at the head of a navigation column:
a trigger with the current workspace's tile, name and secondary line, opening an APG menu of the
workspaces with the current one checked, then the application's own actions. Zx never decides
which workspaces a user may see, loads another workspace, or changes the session — switching is a
cancelable event the application acts on.

- **Options** — `workspaces: [{id, label, secondary?, icon?, tone?, color?, src?, initials?, badge?,
  disabled?}]` (the tile is the image, else the icon, else the initial, on the tone — derived from
  the label when neither `tone` nor `color` is given), `active` (defaults to the first enabled
  workspace, which also replaces an id that is not listed or is disabled), `items` (actions after
  the workspaces; the separator between them is added for you), `compact: false`, `heading` (null
  resolves message `workspaceSwitcher.heading`, "Workspaces"; `''` leaves it out), `label` (`%1` is
  the active workspace's name, filled in again after every switch; null resolves
  `workspaceSwitcher.label`, "Switch workspace: %1", or `workspaceSwitcher.labelEmpty`, "Switch
  workspace", while no workspace is active), and any `placement` (default `bottom-start`).
- **Messages** — `workspaceSwitcher.heading`, `workspaceSwitcher.label` (`%1` the workspace name),
  `workspaceSwitcher.labelEmpty`; override them per instance through `msg`, or for every instance
  through `setTranslator()`.
- **Methods** — `getActive()`, `setActive(id, {silent = true})` (`silent: false` emits `select`
  first), `setWorkspaces(list)` (keeps the active workspace while it is still listed and enabled,
  else the first enabled one becomes active), `setItems()`,
  `setCompact(compact)`, `open()`, `close()`, `toggle()`, `isOpen()`, `focus()`, `getPanel()`,
  `destroy()`.
- **Events** — cancelable `select {workspace, id, previous}`: a canceled switch keeps the previous
  workspace active and the menu open. Cancelable `action {value, item}` for the extra items: a
  canceled action does not run the item's callback. Both honour `preventDefault()` on the component
  event and on the bubbling `zx-select` / `zx-action` DOM event alike. `open` and `close`. Choosing the current
  workspace again only closes the menu.
- **Semantics** — one native `<button aria-haspopup="menu" aria-expanded>` trigger, named "Switch
  workspace: <name>" (or the custom `label`) in both states; compact mode shows the tile alone and adds the name as its
  `title`. Workspaces are `menuitemradio` rows with `aria-checked` under a presentational heading;
  MenuButton keeps focus return, typeahead and the arrow-key map.
- **Appearance** — the trigger is a flat full-width row (tile, name, secondary line, chevron) with
  the hover fill, at least a control and a space-2 tall; its tile is the module bar's tile size, so
  as an `AppSidebar` `railHeader` it lines up with the module tiles under it. Keep it in step with a
  modules sidebar by calling `setCompact(presentation !== 'expanded')` on `presentationchange`.
