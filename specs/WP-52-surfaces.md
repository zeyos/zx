# WP52 — Surfaces: agents compose answers and dialogs as JSON

WP51 gives the agent thread a plain-JSON model. This WP lets an agent go further and compose UI on
the fly. Besides a rich answer (figures, a table, a chart, record references), it can build an
interactive dialog: a form for missing parameters, a choice between options, a confirmation, a
review of proposed changes, or a short questionnaire. Zx validates and renders the JSON, and the
person's input goes back to the agent as structured data.

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
   - How the lines reach the page is Decision 11.
4. **Inputs are restricted JSON Schema.** It is the subset MCP elicitation's form mode uses:
   - one flat object, with `required`;
   - types `string`, `number`, `integer` and `boolean`;
   - `enum`, or `oneOf` of `{const, title}`;
   - `format`: `date`, `date-time`, `time`, `email` or `uri`;
   - `minimum`/`maximum` and `minLength`/`maxLength`;
   - `default`, `title` and `description`.

   An `x-zx` hint may name a registered Field type (`zxselect`, `rating`, `toggle`, `tagpicker`,
   …) and carry `visible` (Decision 12). The same renderer is therefore an MCP form-mode client
   (§4).
5. **The application decides consequence.**
   - An action may name the `tool` it triggers. The application's
     `policy(action, surface) → 'allow'|'confirm'|'type-to-confirm'|'deny'` decides how it must be
     confirmed, and `deny` removes the action.
   - Nothing inside a surface can lower that: there is no "skip confirmation", and `kind: 'danger'`
     is presentation only.
   - A reply records what the page did; it does not prove it. A modified client can send any
     reply, so the application's server runs its policy again for the named tool and the submitted
     values before acting. `confirmation` says which way the person confirmed, nothing more.
   - The application may give a surface an opaque `token` (§4). It comes back unchanged in every
     reply, so the server can match a reply to the surface it issued and refuse one it never issued
     or has already consumed. The model cannot set it: a `token` in a model-written line is an
     unknown key, dropped and reported.
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
   - Three shape mistakes that can only mean one thing are repaired (§2), and each repair is
     reported like any other problem, marked `repaired: true`. The list is closed; nothing else is
     guessed at.
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
    - An application may narrow the catalog to some intents and nodes, never widen it. A surface
      given a narrowed catalog refuses what lies outside it as unknown.
    - The model-facing prompt, the schema and the tool definitions are functions of the catalog
      (§3), so an application generates them at runtime from the same narrowed catalog and the
      model is told exactly what will render. The prompt only informs; validation and policy
      enforce.
11. **Three ways in, one format.**
    - **Stream:** the application's server forwards operation lines, for example in an agent
      event stream (WP54).
    - **Tool:** the model calls `show_surface` or `ask_user` with a whole `document` as the
      arguments, and the person's reply becomes the call's result. The arguments are parsed once
      they are complete, so a surface delivered this way renders whole; a Skeleton stands in while
      they arrive.
    - **Inline:** the model writes operation lines inside a fence in its answer text, opened by a
      line reading exactly `` ```zx-surface `` and closed by a line reading exactly `` ``` ``.
      `inlineSplitter()` (§2) separates them from the prose without holding the prose back. An
      application that does not split them shows the fence as a code block.
    - The application chooses; `surfacePrompt(catalog, {mode})` (§3) tells the model which.
12. **Conditional inputs use the Questionnaire's conditions, and nothing more.**
    - Any node may carry `visible`, and a `fields` property `x-zx.visible`: a §1 condition whose
      `field` names an input (a key of the reply's `values`).
    - A condition may only name inputs that come earlier in the surface (depth first from `root`,
      and in property order within a `fields` node), so there are no cycles. A condition that
      names anything else is dropped and reported, and its node stays visible.
    - A hidden input is not required, is left out of `getValues()` and the reply, and keeps what
      was typed for when it is shown again.
    - There are no templates, computed values, change watchers or action chains.

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
- **Visibility:** any node may carry `visible`, and a `fields` schema property `x-zx: {visible}`,
  under Decision 12:

  ```json
  {"type":"object","required":["method"],"properties":{"method":{"type":"string","title":"Payment","enum":["card","transfer"]},"iban":{"type":"string","title":"IBAN","x-zx":{"visible":{"field":"method","op":"eq","value":"transfer"}}}}}
  ```
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

  `confirmation` in the reply is `clicked`, `typed` or `null`. `token` is present only when the
  application gave the surface one (Decision 5).
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
  answers)` and `checkRules(rules, value)`, all pure. The Surface evaluates Decision 12's
  `visible` with the same `evaluate()`, so the two cannot drift.
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
  - A `visible` condition is checked against Decision 12: the §1 grammar, at most four deep, and
    only inputs declared earlier.
  - **Repairs** (Decision 8), each reported with `repaired: true`:
    - `root` or `children` given as one id string is wrapped in a list;
    - a non-empty `$data` pointer without its leading `/` gets one (`"overdue"` → `"/overdue"`);
    - a child given inline as a whole node with an `id` and a `type` is lifted out as its own
      `node` operation and replaced by its id. It counts towards the depth limit, and its id
      follows the duplicate-id rule. An inline child without an `id` is refused.
- **`schema.js`:** `schemaToFields(schema)` → Fieldset field options; `checkValue(schema, values,
  hidden)` for the submitted values, skipping the hidden properties; `unsupported(schema)` → the
  constructs outside the subset. Reply values are always JSON, whatever a Field holds internally: a
  `date` field's `Date` becomes `YYYY-MM-DD`, `date-time` a local ISO date-time, `time` `HH:MM`.
- **`stream.js`:**
  - `lineSplitter(onLine, {maxLine: 262144})` takes string chunks and emits whole lines. It
    handles `\r\n` and chunk boundaries anywhere, and reports an over-long line instead of
    buffering it.
  - `inlineSplitter({ontext, online, onerror})` → `{write(chunk), end()}` takes answer text in
    chunks (Decision 11). Prose goes to `ontext` as it arrives; only a line that could still turn
    out to be the opening fence is held back, and only until it can no longer be one. Each line
    inside a fence goes to `online`, and the fence lines themselves go nowhere. A fence still open
    at `end()` is reported through `onerror`. Lines inside a fence keep `lineSplitter`'s limit.
- **Test corpus:**
  - HTML in text stays text.
  - `javascript:`, `data:`, `//host` and `http:` links are dropped.
  - `__proto__` is refused at depth.
  - 10,000-deep nesting, oversized arrays and strings are refused.
  - Unknown intents and node types are reported.
  - An action trying to set its own confirmation is ignored.
  - A `token` in a model-written `begin` is dropped and reported.
  - A duplicate node id replaces the earlier node.
  - A `data` path through a non-object is reported.
  - Each repair is applied and reported; an inline child without an `id` is refused.
  - A `visible` condition naming a later input, an unknown input or nesting five deep is dropped
    and reported, and its node stays visible.
  - `inlineSplitter`: a fence split across chunks at every offset; prose before, between and after
    fences arrives unchanged and is not delayed by a whole line; a line that starts with three
    backticks but is not the opening fence stays prose; an unterminated fence is reported.

## §3 · Catalog and generator

**Scope:** new `src/components/surface/catalog.js`, new `tools/build-agent-catalog.js`,
`package.json` (`build:catalog`), generated `docs/agent-catalog.json` and `docs/agent-surfaces.md`,
`tests/unit/surface-catalog.test.js`.

- **Catalog entry:** `{type, component, intentOnly?, children: boolean, input: boolean, props:
  {name: {type, enum?, max?, required?, option}}}`. `option` names the component option the
  property maps to. `visible` is common to every entry rather than repeated in each.
- **Runtime functions** (Decision 10), exported from `catalog.js`. The module imports nothing that
  touches the DOM, so a server can import `@zeyos/zx/src/components/surface/catalog.js` directly.
  - `narrowCatalog(catalog, {intents?, nodes?})` → a new catalog limited to those. It refuses a
    name the catalog does not have, and an intent whose required node it would remove (`ask`
    without `fields`, `choose` without `choice`, `review` without `diff` or `table`).
  - `surfaceSchema(catalog)` → the JSON Schema of (a).
  - `surfaceTools(catalog)` → the tool definitions of (b), leaving out `ask_user` when `ask` is
    not in the catalog.
  - `surfacePrompt(catalog, {mode: 'tool'|'inline', rules?: string[]})` → the model-facing guide
    of (c) as one string. `mode` picks the delivery of Decision 11 that the guide teaches, and its
    worked examples are written for it. `rules` are the application's own lines, appended after
    the library's.
- **Generator output:** `tools/build-agent-catalog.js` calls the runtime functions with the full
  catalog and writes what they return, so the files and the functions cannot drift.
  - (a) JSON Schema 2020-12 for one operation line and for a whole document.
  - (b) Two tool definitions in the neutral function-calling shape `{name, description,
    parameters}`: `show_surface` (a whole document) and `ask_user` (an `ask` surface). Both are
    usable with providers' strict structured output. The person's reply is each call's result.
  - (c) `docs/agent-surfaces.md`: the model-facing guide, with the intents, the node reference
    generated from the catalog, the rules of Decisions 5–9 and 12 written for a model, and two
    worked examples, in `tool` mode.
- **Tests:**
  - Every catalog property exists in `docs/api.json` for its component, with a compatible type.
  - The generated files match a fresh in-memory generation (no stale output).
  - The schema accepts the worked examples and rejects the corpus of §2.
  - `catalog.js` imports under `node --test` with no DOM.
  - A narrowed catalog's schema, tools and prompt name only its intents and nodes, and
    `narrowCatalog` refuses an unknown name and an intent left without its required node.
  - The `inline` prompt's worked examples pass through `inlineSplitter` into valid operations.

## §4 · Surface component and `elicit()`

**Scope:** new `src/components/surface/{surface.js,surface.css,elicit.js,text.js}`,
`src/components/agent-thread/**` (registering `surface`), `website/demos/surface.demo.js`,
`tests/smoke/smoke.js`, `tests/unit/surface-text.test.js`, `docs/llms.md` (Surface).

- **`new Surface(target, options)`:**
  - **Options:** `document`, `policy`, `resolve: {ref, link, asset, entities}`, `authors`,
    `userInitiated: false`, `headingLevel: 3`, `locale`, `msg`.
    - `catalog`: a narrowed catalog (§3); the full one by default.
    - `token: null`: the application's opaque string (at most 512 characters), copied into every
      reply (Decision 5).
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
  - `visible` is evaluated as values change. A node that hides takes no focus with it: when it
    held the focus, focus moves to the input whose value hid it.
- **Policy:**
  - `confirm` asks through a Dialog, and `type-to-confirm` through `Dialog.confirm({confirmText})`
    with text the policy supplies.
  - A denied action is not drawn, and the reply reports which actions were removed.
- **Receipt:**
  - Inputs become read-only displays of what was answered, selected rows are marked, and the
    actions give way to a verdict line.
  - The surface carries `data-state="answered"`.
  - `surfaceText(document, reply)` in `text.js` gives the same receipt as plain text, for an
    application's audit log or a notification: the title, each answered value under its label
    (choice and enum titles rather than raw values), the selected rows by `rowId`, the verdict and
    the time. It is pure and never includes hidden inputs.
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
  - Registers `{type: 'surface', id, document?, token?, catalog?}`. The item comes from the
    application, never from a model line, so `token` and `catalog` cannot be set by the model.
  - `thread.surface(id)` returns the Surface to stream into.
  - Replies bubble as the thread event `reply {item, reply}`.

## §5 · Demos and a layout

**Scope:** `website/demos/surface.demo.js`, `website/docs.js` (`COMPONENT_IDS`),
`website/layouts/agent-chat.layout.{js,css}`.

- **Demo** (group `Agents`):
  - The reminder review above, streamed line by line with a Replay button (instant under reduced
    motion).
  - An `ask` form, a `choose`, and a three-step `questionnaire` with a branch.
  - An `ask` form with a conditional field (the IBAN example of the format).
  - A malformed surface showing the fallback and the error list, including a repair.
  - An answer whose text carries an inline surface, split by `inlineSplitter`.
  - An `elicit()` call.
  - A playground: a CodeEditor where a reader pastes operation lines or a whole document, rendered
    live into a Surface beside it, with its `errors[]`, the reply and `surfaceText()` of the reply.
  - A visible log of replies and errors.
- **`agent-chat`:** one new conversation in its fixtures where the agent lacks a parameter and asks
  for it with an `ask` surface, then continues with the answer. The layout still passes
  `tools/shoot-layout.js` and `tools/audit-layout.js` at 1440 and 390, light and dark.

## Out of scope

- Transport (server-sent events, sockets, agent-to-agent protocols).
- AG-UI and MCP adapters (WP54); mapping to other declarative UI protocols.
- Sandboxed HTML apps: they cannot use the tokens, the focus handling or the APG patterns.
- Node types registered by applications, and widening the catalog in any other way. That needs its
  own review of the trust model; narrowing does not.
- File inputs, asynchronous validation (an agent asks again with a new surface), computed
  expressions, templates, change watchers, action chains, style or theme properties, and
  translation of agent-written text.
- Repairs beyond the closed list of §2.

## Acceptance criteria

1. `npm test` and `npm run test:browser` pass; `node tools/check-site.js` and `git diff --check`
   are clean; `npm run build:catalog` leaves no diff after a run.
2. Unit tests cover §1–§3 as listed, plus:
   - the reply shape for each intent;
   - idempotency (a second submit is ignored);
   - the `schemaToFields` mapping for every schema type and format;
   - `checkValue` skipping hidden properties, and a hidden required field not blocking submit;
   - `surfaceText()` for each intent, with titles in place of raw values and no hidden inputs.
3. Smoke cases:
   - A streamed surface renders progressively, with its actions disabled until `end`.
   - Exactly one reply is emitted for each of submit, action, cancel, Escape, supersede and
     destroy.
   - A `type-to-confirm` policy cannot be bypassed by any document.
   - The `token` option appears unchanged in every reply.
   - A conditional field appears and disappears as its condition changes, keeps its value, and is
     left out of the reply while hidden.
   - A node outside a narrowed catalog renders the fallback and is reported.
   - Create and destroy twice leaves the DOM as found.
4. `elicit()` handles text, enum with titles, boolean, a number range and a date, and rejects a
   nested object.
5. Changelog lines are reported.
