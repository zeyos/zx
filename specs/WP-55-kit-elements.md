# WP55 — Custom elements for the agent kit and the data views

`src/elements/define.js` wraps 11 of the library's components as `<zx-*>` elements, all of them
form controls or containers. An application written in a framework reaches Zx most easily through
custom elements: a framework that sets properties and listens for events on an element needs no
wrapper per framework. The agent kit and the data views, the components such applications want
most, have none. This WP adds them.

Work on the branch `wp/55-kit-elements`, from `main`. `AGENTS.md` applies. `src/core/**` is **not**
in scope. `CHANGELOG.md` is central: report changelog lines instead of writing them.
`docs/api.json` is regenerated, never hand-edited. Public files must not mention this spec.

## Decisions (binding)

1. **One wrapper machinery.** The new elements are built with `elementFor()` and `attributes()`,
   extended where they fall short. There is no second wrapper system.
2. **Rich data travels as properties.** Lists, items, columns and data are properties first. A JSON
   attribute is accepted for static markup, but a property set from script is never serialised
   back into an attribute, so a 5,000-item thread does not round-trip through `JSON.stringify`.
3. **Methods are forwarded, not reached through.** Each element declares the component methods it
   forwards (`thread.upsert(item)` on the element, not `thread.component.upsert(item)`). A method
   called before the component exists is queued and runs, in order, once it does.
4. **Events reach the host by their plain names.** Each element declares its component's events, and
   the wrapper re-dispatches them on the host as the existing elements do, so `onsend` in a
   framework template and `addEventListener('send', …)` both work. The `zx-<type>` events keep
   bubbling as before.
5. **Properties set before upgrade count.** A property assigned to the element before
   `defineElements()` ran (a framework rendering first and defining later) is taken over at upgrade,
   following the standard lazy-property pattern.
6. **Nothing becomes form-associated that is not a form control.** None of the new elements is
   form-associated.

## §1 · The elements

**Scope:** `src/elements/**`, `website/demos/elements.demo.js`, `tests/smoke/smoke.js`,
`tests/unit/elements-kit.test.js` (pure attribute and queue logic only), `docs/llms.md` (Custom
elements).

- **Agent kit:** `<zx-agent-thread>`, `<zx-composer>`, `<zx-block-view>`, `<zx-run-trace>`,
  `<zx-approval-card>`, `<zx-source-list>`, `<zx-run-status>`.
- **Data views:** `<zx-card-view>`, `<zx-kanban-view>`, `<zx-tree>`, `<zx-chart>`.
- **For each element:**
  - Scalar options that markup sets (labels, flags, variants) are attributes, with the same
    names and defaults as the component's options, kebab-cased.
  - Data options are properties (Decision 2).
  - The streaming and update methods are forwarded (Decision 3). For AgentThread at least
    `setItems`, `upsert`, `patch`, `appendText`, `appendBlock`, `remove`, `get`, `getItems`,
    `reveal` and `scrollToEnd`. For Composer `setBusy`, `update`, `focus` and `clear` where
    they exist. Every other element forwards its public mutators.
  - Every event its component documents is declared (Decision 4).
- **Lifecycle:** removing the element destroys its component; re-inserting it rebuilds it from the
  current properties. Creating and removing an element twice leaves the DOM as found.
- **Demo:** a new example in the Custom elements demo: an agent thread, a composer and a run
  status written as markup and driven by script, with the events logged. The example sets only
  properties and listens only for events, as a framework would.

## Out of scope

- Elements for other components, framework-specific wrappers, server-side rendering and
  declarative shadow DOM.
- The WP52 Surface. It gets an element once it has landed.
- Changes to the components themselves, beyond a getter or setter an element cannot work without.
  Name any you add in the report.

## Acceptance criteria

1. `npm test` and `npm run test:browser` pass; `node tools/check-site.js` and `git diff --check`
   are clean.
2. Smoke cases for every new element:
   - It renders from properties set before and after upgrade.
   - A forwarded method called before connection runs after it.
   - Each declared event arrives on the host by its plain name.
   - A data property does not appear as an attribute.
   - Create, remove and recreate twice leave the DOM as found.
3. The demo works in light and dark with no console errors.
4. Changelog lines are reported.
