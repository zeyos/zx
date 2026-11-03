# WP52 — Surfaces: agents compose answers and dialogs as JSON

WP51 gives the agent thread a plain-JSON model. This WP lets an agent go further and compose UI on
the fly. Besides a rich answer (figures, a table, a chart, record references), it can build an
interactive dialog: a form for missing parameters, a choice between options, a confirmation, a
review of proposed changes, or a short questionnaire. Zx validates and renders the JSON, and the
person's input goes back to the agent as structured data.

The design draws on public prior art:

- **MCP elicitation:** a restricted JSON Schema for forms.
- **Declarative agent-UI protocols:** a flat component list with catalog negotiation and
  streaming.
- **Agent↔UI event streams:** JSON Patch state.
- **Sandboxed HTML "apps":** rejected for the library, because they cannot use the tokens, the
  focus handling or the APG patterns.

Two independent reviews on other models fed the format and its safety rules; their transcripts stay
outside the repository.

Work in the current checkout, on top of WP51. **Do not commit**: this lands after central review.
`AGENTS.md`, the WP40 and WP45 design rules, and WP42 apply. `src/core/**` is **not** in scope.

This WP explicitly permits:

- changes to `src/components/questionnaire/**`, for declarative conditions (§1);
- a new `tools/build-agent-catalog.js`;
- a `build:catalog` script in `package.json`;
- the generated `docs/agent-catalog.json` and `docs/agent-surfaces.md`.

`CHANGELOG.md` is central: report changelog lines instead of writing them. `docs/api.json` is
regenerated, never hand-edited. Public files must not mention this spec or the reviews.

## Decisions (binding)

1. **Model output is data, never code.** A surface carries no HTML, script, style, expression or
   regular expression. Everything drawn is a Zx component built from validated values, and every
   string reaches the page as a text node.
2. **Two layers: intents and nodes.** A surface declares one `intent` (`show`, `ask`, `choose`,
   `confirm`, `review` or `questionnaire`), which fixes its frame, its default actions and the
   shape of its reply. Its body is composed from catalog nodes. Intents are what models get right;
   nodes leave room.
3. **Flat, addressed, streamable.**
   - A surface arrives as JSON Lines operations. Nodes are addressed by `id`, and `children` is a
     list of ids, so the structure is an adjacency list rather than nesting.
   - Data is kept apart from structure and bound by JSON Pointer.
   - Every line is complete JSON and goes through `JSON.parse`, so there is no partial-JSON parser.
   - The same surface can also be given whole, as one `document`.
4. **Inputs are restricted JSON Schema.** It is the subset MCP elicitation's form mode uses:
   - one flat object, with `required`;
   - types `string`, `number`, `integer` and `boolean`;
   - `enum`, or `oneOf` of `{const, title}`;
   - `format`: `date`, `date-time`, `time`, `email` or `uri`;
   - `minimum`/`maximum` and `minLength`/`maxLength`;
   - `default`, `title` and `description`.

   An `x-zx` hint may name a registered Field type (`zxselect`, `rating`, `toggle`, `tagpicker`,
   …). The same renderer is therefore an MCP form-mode client (§4).
5. **The application decides consequence.**
   - An action may name the `tool` it triggers. The application's
     `policy(action, surface) → 'allow'|'confirm'|'type-to-confirm'|'deny'` decides how it must be
     confirmed, and `deny` removes the action.
   - Nothing inside a surface can lower that: there is no "skip confirmation", and `kind: 'danger'`
     is presentation only.
6. **No URLs from the model to navigate to or to load.**
   - Records are `{"$ref": "<entity>", "id": "…"}`, which the application resolves into an
     EntityRef through `resolve.ref`.
   - External links are `link` nodes: `https:` only, the host shown beside the text, and passed
     through `resolve.link`, which may refuse them.
   - No image loads from a URL, because an image is a channel for leaking data. Images exist only
     as `{"$asset": "…"}`, resolved by the application.
7. **Every surface ends in exactly one reply.**
   - Submit and every action reply. So do cancel, Escape, closing, the surface being superseded,
     the run stopping, and `destroy()` of an unanswered surface (`dismiss`). A waiting agent never
     hangs.
   - A reply carries an idempotency key.
   - An answered surface freezes into a read-only receipt that stays in the thread.
8. **Tolerant rendering, strict reporting.**
   - An invalid property is dropped. An invalid or unknown node renders a quiet fallback ("This
     part could not be shown"). A surface with an invalid intent renders no controls.
   - Every problem goes into `errors[]`, which the application may return to the agent so it can
     correct itself.
9. **Composed UI says it is composed.**
   - A surface carries a quiet byline, "Composed by <author>".
   - It cannot reach application chrome: no toasts, navigation or headers of its own.
   - `placement: 'inline'|'sheet'|'dialog'` is a request. The default policy allows a sheet or a
     dialog only in direct reply to the person's latest message; otherwise the surface is placed
     inline.
   - There are no password or secret inputs; credentials go through the application's own flows.
10. **One catalog, checked against the library.** The catalog is curated by hand. A test fails
    when a catalog property names an option that does not exist in `docs/api.json` for its
    component, or when the types disagree. A tool generates JSON Schema and function-calling tool
    definitions from it.

## The format (normative)

Every line names its `surface`; one stream may carry several. `begin` carries the version.

```jsonl
{"zx":"surface/1","op":"begin","surface":"s1","intent":"review","title":"Send 3 first reminders?","author":"finance","root":["why","list","opts"]}
{"op":"node","surface":"s1","id":"why","type":"text","text":"Three invoices are more than **14 days** overdue [1]."}
{"op":"node","surface":"s1","id":"list","type":"table","name":"invoices","selectable":"multi","rows":{"$data":"/overdue"},"rowId":"invoice","columns":[{"id":"invoice","label":"Invoice"},{"id":"customer","label":"Customer"},{"id":"amount","label":"Amount","align":"end","format":"currency"}]}
{"op":"node","surface":"s1","id":"opts","type":"fields","schema":{"type":"object","required":["template"],"properties":{"template":{"type":"string","title":"Template","oneOf":[{"const":"reminder-1","title":"First reminder"},{"const":"reminder-2","title":"Second reminder, €5.00 fee"}]},"sendOn":{"type":"string","format":"date","title":"Send on"}}}}
{"op":"data","surface":"s1","path":"/overdue","value":[{"invoice":"RE-2026-0121","customer":{"$ref":"company","id":"helios"},"amount":4860}]}
{"op":"actions","surface":"s1","items":[{"id":"send","label":"Send reminders","kind":"primary","tool":"mail.send"},{"id":"later","label":"Not now"}]}
{"op":"end","surface":"s1","sources":[{"n":1,"call":"invoices"}]}
```

```json
{"zx":"reply/1","surface":"s1","action":"send","key":"s1#send","values":{"invoices":["RE-2026-0121"],"template":"reminder-1","sendOn":"2026-10-09"},"confirmation":"clicked","at":"2026-10-08T10:31:12"}
```

- **Operations:**
  - `begin`: `intent`, `title`, `author`, `root`, and optionally `placement` and `description`.
  - `node`: a full node, which replaces any earlier node with the same id.
  - `patch {id, props}`: merges props.
  - `append {id, text}`: adds to a `text` node.
  - `remove {id}`.
  - `data {path, value}`, or `{path, remove: true}`.
  - `actions {items}`.
  - `end {sources?}`.
- **Binding:** any property may be `{"$data": "/pointer"}`, an RFC 6901 pointer into the surface
  data, with no wildcards.
- **Display nodes:**
  - The WP51 blocks: `text` (inline grammar), `heading`, `list`, `quote`, `code`, `table`,
    `figures` and `callout`.
  - `stat` (StatTile: `label`, `value`, `format`, `currency`, `delta`, `caption`; drawn as
    `variant: 'plain'`).
  - `badge`, `ref` (EntityRef from `$ref`) and `link`.
  - `chart` (Chart: `type: bar|line|pie|doughnut`, `data: {labels, datasets: [{label, data}]}`,
    `label`, `description`; its data table is always offered).
  - `empty` (EmptyState).
- **Layout nodes:** `stack` (`gap: sm|md|lg`), `columns` (`count: 1–3`, one column when the
  container is narrow) and `group` (Groupbox with a `title`).
- **Input nodes** (each has a `name`; its value lands in `values[name]`):
  - `fields` (a schema rendered as a Fieldset).
  - `choice` (`choices: [{value, label, description?, icon?}]`, `multiple`).
  - A selectable `table` (the selected `rowId`s).
  - `diff` (`rows: [{id, field, label, before, after, ref?}]`; the accepted row ids).
- **Intents and their replies:**

  | Intent | What it needs | Default actions | Reply values |
  |---|---|---|---|
  | `show` | — | none | none; actions optional, `dismiss` on close |
  | `ask` | at least one `fields` | Submit, Cancel | the fields' values |
  | `choose` | one `choice` | Submit, Cancel | the choice; a single choice may submit on pick |
  | `confirm` | — | Confirm, Cancel | `{}`; the policy may require type-to-confirm |
  | `review` | a `diff` or a selectable `table` | Approve selected, Reject | the selected ids |
  | `questionnaire` | `steps` | the Questionnaire's own | `{answers, path}` |

  `confirmation` in the reply is `clicked`, `typed` or `null`.
- **Questionnaire steps** use the Questionnaire item shape with declarative `when`, `next` and
  `validate` (§1).
- **Limits:** 400 nodes, depth 12, 20,000 characters per string, 1,000 table rows, 50 fields,
  64 choices, 8 actions and 1 MB of data per surface. Anything over a limit is dropped and
  reported.

## §1 · Declarative conditions in Questionnaire

**Scope:** new `src/components/questionnaire/conditions.js`, `src/components/questionnaire/**`,
`website/demos/questionnaire.demo.js`, `tests/unit/questionnaire-conditions.test.js`,
`docs/llms.md` (Questionnaire).

- **Conditions:** `{field, op, value?}`, combined with `{all: […]}`, `{any: […]}` and `{not: …}`,
  at most four deep.
  - Ops: `eq`, `ne`, `in`, `nin`, `gt`, `gte`, `lt`, `lte`, `empty`, `filled`, `contains`.
  - A condition sees only the answers of visible items declared before it, so the current
    cascading rule holds.
- **`next`:** an item name, `$review`, `$submit`, or a list
  `[{if: Condition, goto: name}, …, {goto: name}]` whose first match wins.
- **`validate`:** a list of rules: `required`, `minLength`, `maxLength`, `minimum`, `maximum`,
  `format` (the named formats of Decision 4) and `oneOf`, each with an optional `message`. There
  are no patterns.
- **Compatibility:** `when`, `next` and `validate` accept these forms beside the existing
  functions, and the function forms keep working unchanged.
- **Exports** from `conditions.js`: `evaluate(condition, answers)`, `resolveNext(next, answer,
  answers)` and `checkRules(rules, value)`, all pure.
- **Tests:** every op, the combinators, the cascading visibility, first-match `next`, the
  `$review`/`$submit` sentinels, and each rule's message.

## §2 · Validator and stream

**Scope:** new `src/components/surface/{validate,stream,schema}.js`,
`tests/unit/surface-validate.test.js`, `tests/unit/surface-stream.test.js`.

- **`validate.js`:**
  - `validateOp(op, state, catalog)` → `{op|null, errors}`, and `validateDocument(doc, catalog)`.
  - Unknown keys are dropped and reported.
  - `__proto__`, `constructor` and `prototype` keys are refused at any depth, as are non-finite
    numbers and strings over the limit.
  - A `link` must be `https:` and pass `safeHref()`. Protocol-relative `//host` and relative URLs
    are refused.
  - A `$ref` entity outside `resolve.entities` is refused.
  - An input node without a `name`, a schema property without a `title`, and an action without a
    `label` are each reported.
- **`schema.js`:** `schemaToFields(schema)` → Fieldset field options; `checkValue(schema, values)`
  for the submitted values; `unsupported(schema)` → the constructs outside the subset. Reply values
  are always JSON, whatever a Field holds internally: a `date` field's `Date` becomes `YYYY-MM-DD`,
  `date-time` a local ISO date-time, `time` `HH:MM`.
- **`stream.js`:** `lineSplitter(onLine, {maxLine: 262144})` takes string chunks and emits whole
  lines. It handles `\r\n` and chunk boundaries anywhere, and reports an over-long line instead of
  buffering it.
- **Test corpus:**
  - HTML in text stays text.
  - `javascript:`, `data:`, `//host` and `http:` links are dropped.
  - `__proto__` is refused at depth.
  - 10,000-deep nesting, oversized arrays and strings are refused.
  - Unknown intents and node types are reported.
  - An action trying to set its own confirmation is ignored.
  - A duplicate node id replaces the earlier node.
  - A `data` path through a non-object is reported.

## §3 · Catalog and generator

**Scope:** new `src/components/surface/catalog.js`, new `tools/build-agent-catalog.js`,
`package.json` (`build:catalog`), generated `docs/agent-catalog.json` and `docs/agent-surfaces.md`,
`tests/unit/surface-catalog.test.js`.

- **Catalog entry:** `{type, component, intentOnly?, children: boolean, input: boolean, props:
  {name: {type, enum?, max?, required?, option}}}`. `option` names the component option the
  property maps to.
- **Generator output:**
  - (a) JSON Schema 2020-12 for one operation line and for a whole document.
  - (b) Two tool definitions in the neutral function-calling shape `{name, description,
    parameters}`: `show_surface` (a whole document) and `ask_user` (an `ask` surface). Both are
    usable with providers' strict structured output.
  - (c) `docs/agent-surfaces.md`: the model-facing guide, with the intents, the node reference
    generated from the catalog, the rules of Decisions 5–9 written for a model, and two worked
    examples.
- **Tests:**
  - Every catalog property exists in `docs/api.json` for its component, with a compatible type.
  - The generated files match a fresh in-memory generation (no stale output).
  - The schema accepts the worked examples and rejects the corpus of §2.

## §4 · Surface component and `elicit()`

**Scope:** new `src/components/surface/{surface.js,surface.css,elicit.js}`,
`src/components/agent-thread/**` (registering `surface`), `website/demos/surface.demo.js`,
`tests/smoke/smoke.js`, `docs/llms.md` (Surface).

- **`new Surface(target, options)`:**
  - **Options:** `document`, `policy`, `resolve: {ref, link, asset, entities}`, `authors`,
    `userInitiated: false`, `headingLevel: 3`, `locale`, `msg`.
  - **Methods:** `apply(op)`, `write(chunk)`, `end()`, `getValues()`, `getErrors()`,
    `cancel(reason)`, `supersede()`, `focus()`, `toDocument()`.
  - **Events:**
    - `reply {reply}`, exactly once.
    - `error {errors}`, each time new errors are collected.
    - `change {name, value}`.
    - `ready`, at the first renderable state.
    - `end`.
- **Progressive rendering:**
  - A node renders once its required properties are present, and a referenced child that has not
    arrived is a Skeleton line.
  - Actions other than Cancel stay disabled until `end`, so a half-streamed form cannot be
    submitted.
- **Policy:**
  - `confirm` asks through a Dialog, and `type-to-confirm` through `Dialog.confirm({confirmText})`
    with text the policy supplies.
  - A denied action is not drawn, and the reply reports which actions were removed.
- **Receipt:**
  - Inputs become read-only displays of what was answered, selected rows are marked, and the
    actions give way to a verdict line.
  - The surface carries `data-state="answered"`.
- **Accessibility:**
  - An input surface is a `<form>` labelled by its title; any other surface is a `region`.
  - Heading levels are relative to `headingLevel`.
  - After a failed submit, focus moves to the first invalid field, as in Form.
  - A chart offers its data table.
- **`openSurface(document, {placement, …})`:** builds the Sheet or Dialog around a Surface,
  applies the placement policy, focuses the first control, and resolves with the reply.
- **`elicit({message, requestedSchema}, options)`** → `Promise<{action: 'accept'|'decline'|'cancel',
  content?}>`:
  - It renders an `ask` surface (in a Dialog by default, or into `options.target`).
  - Submit resolves `accept` with the content checked against the schema, Decline resolves
    `decline`, and Escape or close resolves `cancel`.
  - A schema outside the subset rejects with a `TypeError` naming the unsupported constructs.
- **AgentThread:**
  - Registers `{type: 'surface', id, document?}`.
  - `thread.surface(id)` returns the Surface to stream into.
  - Replies bubble as the thread event `reply {item, reply}`.

## §5 · Demos and a layout

**Scope:** `website/demos/surface.demo.js`, `website/docs.js` (`COMPONENT_IDS`),
`website/layouts/agent-chat.layout.{js,css}`.

- **Demo** (group `Agents`):
  - The reminder review above, streamed line by line with a Replay button (instant under reduced
    motion).
  - An `ask` form, a `choose`, and a three-step `questionnaire` with a branch.
  - A malformed surface showing the fallback and the error list.
  - An `elicit()` call.
  - A visible log of replies and errors.
- **`agent-chat`:** one new conversation in its fixtures where the agent lacks a parameter and asks
  for it with an `ask` surface, then continues with the answer. The layout still passes
  `tools/shoot-layout.js` and `tools/audit-layout.js` at 1440 and 390, light and dark.

## Out of scope

- Transport (server-sent events, sockets, agent-to-agent protocols).
- AG-UI and MCP adapters (WP54); mapping to other declarative UI protocols.
- Sandboxed HTML apps.
- Node types registered by applications. That needs its own review of the trust model.
- File inputs, asynchronous validation (an agent asks again with a new surface), computed
  expressions, style or theme properties, and translation of agent-written text.

## Acceptance criteria

1. `npm test` and `npm run test:browser` pass; `node tools/check-site.js` and `git diff --check`
   are clean; `npm run build:catalog` leaves no diff after a run.
2. Unit tests cover §1–§3 as listed, plus:
   - the reply shape for each intent;
   - idempotency (a second submit is ignored);
   - the `schemaToFields` mapping for every schema type and format.
3. Smoke cases:
   - A streamed surface renders progressively, with its actions disabled until `end`.
   - Exactly one reply is emitted for each of submit, action, cancel, Escape, supersede and
     destroy.
   - A `type-to-confirm` policy cannot be bypassed by any document.
   - Create and destroy twice leaves the DOM as found.
4. `elicit()` handles text, enum with titles, boolean, a number range and a date, and rejects a
   nested object.
5. Changelog lines are reported.
