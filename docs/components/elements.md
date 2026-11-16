# Custom elements — `defineElements()`

Form controls, containers, the agent kit and the data views also ship as custom elements, so a screen can be written as markup and configured with attributes instead of constructor calls.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/elements · All components: https://zx.zeyos.com/docs/components/index.md

Call `defineElements()` once to register `<zx-*>` light-DOM wrappers with attribute↔option
reflection and ElementInternals form association, so they participate in a native `<form>` and its
`FormData`. Events bubble as `zx-*` on the host element, and removing an element from the DOM
destroys its component.

Registered elements: `<zx-toggle>`, `<zx-check-button>`, `<zx-select items='[…]' required>`,
`<zx-checklist>`, `<zx-datebox>`, `<zx-timebox>`, `<zx-search>`, `<zx-groupbox>`, `<zx-tabbox>`,
`<zx-table>`, `<zx-dialog>`. `<zx-datebox>` takes `display-format` beside `format`, as the
Datebox options `displayFormat` and `format`.

**Agent kit and data views.** `<zx-agent-thread>`, `<zx-composer>`, `<zx-block-view>`,
`<zx-run-trace>`, `<zx-approval-card>`, `<zx-source-list>`, `<zx-run-status>`, `<zx-card-view>`,
`<zx-kanban-view>`, `<zx-tree>` (TreeView) and `<zx-chart>` are made for an application written in a
framework: it renders the tag, sets properties, calls methods, and listens for events. None of them
is form-associated.

```js
thread.authors = authors;                 // data goes on the property
thread.items = items;
composer.addEventListener('send', (event) => {
  thread.upsert({ id, type: 'user', text: event.detail.text });
  composer.busy = true;
});
thread.appendText('answer-1', chunk);     // forwarded to the component
```

- **Options.** Every component option keeps its name and default. A scalar is an attribute, kebab-cased
  (`heading-level`, `submit-key`), and its property reflects to it. Two stay on the property: a
  Composer's `value`, as an input's does, and an ApprovalCard's `title`, which as an attribute
  would be a tooltip over the whole card. A boolean that defaults to `true` is turned off with
  `="false"` (`numbered="false"`, `follow-output="false"`).
- **Data is a property.** Lists, items, columns and records are properties first. A JSON attribute
  is read for static markup, but a value set on the property is never written to an attribute, so
  a long thread does not pass through `JSON.stringify`. Functions, nodes and the chart `adapter`
  have no attribute at all: `chart.adapter = new ChartJsAdapter(ChartJs)`, `tree.load = fetchChildren`.
  A property set before `defineElements()` ran is taken over at upgrade.
- **Methods are forwarded.** Call them on the element: `thread.upsert(item)`, `composer.setBusy(true)`,
  `tree.expandAll()`, not `element.component`. The streaming and update methods of every component
  are forwarded, and on AgentThread also `get`, `getItems` and `getComponent`. A call made before
  the component exists is queued and runs, in order, once it does; a queued call returns
  `undefined`. Once running, a call returns the component's answer, with the component replaced by
  the element so a chain stays on it.
- **Two names shared with the DOM.** `thread.remove(id)` removes an item and `thread.remove()` the
  element. `blockView.append(block)` adds a block and `blockView.append(node)` a child node.
- **Events.** Each event the component documents is dispatched on the host under its plain name,
  so `addEventListener('send', …)` and a framework's `onsend` both work. It does not bubble, and
  `zx-send` does; use that one to delegate. Cancelling either cancels the component's event. A
  DOM event of a declared name stops at the component's root, so `input` on `<zx-composer>` is the
  component's, with `detail.text`, once per change. Setting a property emits nothing; a forwarded
  method emits what the component's method emits.
- **Lifecycle.** Removing the element destroys its component, and re-inserting it rebuilds one from
  the current properties, including what forwarded methods changed: a streamed answer, a board's
  moved records, a tree's selection. Unsent attachments, a tree's open branches and a stopped
  answer's note live only in the component and do not come back. An option the component cannot
  change in place rebuilds it the same way.
- **Display.** A host is `display: inline` until the page says otherwise. Give it `display: block`
  when it must fill a height, as a scrolling thread does.
