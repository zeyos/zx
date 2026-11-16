# Surface — `new Surface(target, options)` / `openSurface()` / `elicit()` / `surfaceText()`

Interface an agent composes as JSON — a rich answer, or a dialog asking the person something — validated and drawn with the library’s own components.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/surface · All components: https://zx.zeyos.com/docs/components/index.md

Interface an agent composes as JSON — a rich answer, or a dialog asking the person something —
validated and drawn with the library's own components. A surface declares one `intent`, which fixes
its frame, default actions and reply, and composes its body from catalog nodes laid out by id. The
format, the node reference and the rules a model reads are in `docs/agent-surfaces.md`; the catalog
functions (`narrowCatalog`, `surfaceSchema`, `surfaceTools`, `surfacePrompt`) and the validator are
in `src/components/surface/catalog.js` and `validate.js`, importable on a server.

- **Options** — `document` (a whole surface; leave it out to stream), `policy`, `resolve: {ref,
  link, asset, entities}`, `authors`, `userInitiated: false`, `headingLevel: 3`, `locale`,
  `catalog` (a narrowed catalog; the full one by default), `token: null` (the application's opaque
  string, at most 512 characters, copied unchanged into every reply), `reply: null` (a stored reply:
  the surface starts as its receipt), `labelledBy: null` (the id of a title shown by a host),
  `chartAdapter: null` (draws `chart` nodes; without one a chart shows its data table), `msg`.
- **Methods** — `apply(op)`, `write(chunk)` (operation lines in chunks), `end()` (the stream is
  over), `getValues()`, `getErrors()`, `cancel(reason)`, `supersede()`, `focus()`, `toDocument()`,
  `getReply()`, `destroy()`.
- **Events** — `reply {reply}` exactly once, `error {errors}` each time new problems are found,
  `change {name, value}`, `ready` at the first drawn state, `end`.
- **Streaming** — every line is validated before it is drawn. A child that has not arrived is a
  skeleton line, and every action but Cancel stays disabled until the surface's `end`. What is
  invalid is dropped and reported; an unknown node, or one outside a narrowed catalog, draws "This
  part could not be shown". A surface whose stream ends without its `end` keeps its actions
  disabled. A node that fails while drawing shows the same line beside the rest of the surface, and
  is reported as `draw-failed`. One operation costs what it touches: a `data` operation redraws only
  the nodes bound to the path it changed.
- **Catalog and profiles** — every node in `CATALOG` carries `use` (one sentence: when to pick it)
  and `avoid` (one sentence naming the node or intent to use instead); the guide `surfacePrompt()`
  writes both under each node, and leaves out an `avoid` whose alternative the catalog lacks.
  `PROFILES` names four nested sets: `answer` (a `show` surface of `text`, `heading`, `list`,
  `callout`, `figures`, `table`, `stat`, `badge`, `chart`, `code`, `link`, `ref`, `empty`, `stack`,
  `columns` and `group`), `ask` (adds the `ask`, `choose` and `confirm` intents with `fields` and
  `choice`), `review` (adds the `review` intent with `diff`) and `full` (everything, also `quote`
  and `questionnaire`). `narrowCatalog(CATALOG, { profile })` starts from one, and `intents` and
  `nodes` narrow within it; `surfaceSchema()`, `surfaceTools()` and `surfacePrompt()` take the same
  `profile` option, and leaving it out keeps the whole catalog. Give the model the narrowest
  profile that does the job: `answer` costs well under half the prompt and tools of `full`.
- **Limits** — 400 nodes, depth 12, 20,000 characters per string, 1,000 rows per table, 50 fields,
  64 choices, 8 actions, 1 MB of data, and 100,000 table cells across all tables, each `$data`
  binding counted where it is used. What is over a limit is dropped and reported, and the table
  budget holds while a surface streams; rows past it draw the fallback.
- **Actions** — the intent's defaults (`submit`, `confirm`, `approve`/`reject`) or the surface's own,
  plus Cancel for `ask`, `choose`, `confirm` and `questionnaire`, and for a `review` left without
  its `reject`. The ids `cancel` and `dismiss` are reserved: an action using one is dropped and
  reported, as is any action of a `questionnaire`'s own. Escape closes whatever waits for an answer
  (`cancel`, or `dismiss` for a `show` surface with actions), except while it closes something
  inside the surface (an open picker, an expanded list) or another handler took it. The answering
  defaults (`submit`, `confirm`, `approve`) and an own action with `kind: 'primary'` check the
  visible inputs first, move focus to the first invalid one, and send the values; any other own
  action replies at once with `values: {}`. With several primary actions the one pressed answers,
  and Enter in a field presses the first. A single `choice` must be picked before an answering
  action replies; a `multiple` one may be empty. A questionnaire's `next` that names a dropped step,
  or can lead back to its own step, is dropped and reported.
- **Policy** — `policy(action, surface)` returns `'allow'`, `'confirm'` (a confirmation Dialog),
  `'type-to-confirm'` (`Dialog.confirm({confirmText})`) or `'deny'` (the action is not drawn, and
  the reply lists it under `removed`), or `{level, confirmText?, message?}`. Supply `confirmText`
  for `type-to-confirm`: without it the person types the fixed word "confirm"
  (`surface.typeToConfirm`), never text from the surface. A questionnaire's own Submit is put to the
  policy up front, as `submit`; denied, it is hidden and reported. The policy is synchronous:
  nothing waits for it, so a Promise denies, like a policy that throws. Anything else counts as
  `confirm`. Nothing in a surface can lower it: `kind: 'danger'` is presentation only, and
  confirmation keys in a surface are dropped.
- **Reply** — `{zx: 'reply/1', surface, action, key, values, confirmation, at, token?, removed?,
  reason?}`. `key` is `<surface>#<action>`; `confirmation` is `clicked`, `typed` or `null`;
  `reason` says why a closing reply (`cancel`, `dismiss`) was sent: `cancelled`, `escape`,
  `closed`, `superseded`, `stopped`, `destroyed`, or the application's. Submit and every action
  reply, and so do Cancel, Escape, `cancel()`, `supersede()` and destroying an unanswered surface
  (`dismiss`), whatever happens while its receipt is drawn. When its run stops, the application
  calls `surface.cancel('stopped')`. A surface
  whose `begin` never validated still replies once: `surface` is the id it was given when that was
  a valid id, `null` otherwise. A reply records what the page did; the server runs its policy again
  before it acts.
- **Conditions** — a node's `visible` and a schema property's `x-zx.visible` are evaluated as values
  change. A hidden input keeps what was typed, is not required, and is left out of `getValues()`
  and the reply. A node that hides while it holds the focus hands it to the input whose value hid
  it.
- **Receipt** — answered, the surface carries `data-state="answered"`: inputs become read-only
  displays of what was answered, tables stay with their selected rows marked, and the actions give
  way to a verdict line. A restored surface (`reply`) shows what that reply answered.
  `surfaceText(document, reply)` gives the same receipt as plain text, with choice titles rather
  than raw values and never a hidden input or step, whatever the reply carries.
- **Field types** — a schema property's `x-zx.field` draws through `Field`. The surface registers the
  types it needs only where nothing draws them yet, so an adapter the application registered with
  `Field.register()` stays.
- **Placement** — `openSurface(document, {placement, target, …})` resolves with the reply. A sheet
  or a dialog the document asks for is honoured only with `userInitiated`; otherwise the surface goes
  inline into `target`. Closing the sheet or dialog replies `cancel`. A document that cannot begin
  rejects with a `TypeError` (its `errors` attached) before anything opens; given its `reply`, it
  resolves with it at once. `signal` withdraws it: on abort the surface is cancelled with the reason
  `stopped` and the promise resolves that reply — a sheet or dialog closes, an inline surface stays
  as its receipt — and a signal already aborted resolves it without drawing anything. Removing an
  inline `target` is not noticed: abort the signal or destroy the surface so the promise settles.
- **Elicitation** — `elicit({message, requestedSchema}, options)` draws an `ask` form in a Dialog,
  or inline into `options.target`, and resolves `{action: 'accept', content}`, `{action: 'decline'}`
  or `{action: 'cancel'}`. A schema outside the subset (a nested object, a pattern, …) rejects with
  a `TypeError` naming what is unsupported. The message is drawn as plain text, never as markup;
  the labels resolve through `msg` (by language, then flat), the host translator, then English.
  `options.signal` withdraws the request: it resolves `cancel`.
- **MCP elicitation** — `elicitationHandler({serverName, authors?, target?, open?, msg?})` returns
  `(params, {signal}?) => Promise<{action, content?}>` for an MCP client to install; `MCP_ELICITATION_VERSION`
  (`'2026-07-28'`) names the revision it implements. Call it with the `params` of an
  `elicitation/create` request, or of each `inputRequests` entry whose `method` is
  `elicitation/create` in an `input_required` result, and send what it resolves back — in
  `inputResponses` under the same key, with `requestState` echoed unchanged. Fields a mode does not
  use, such as an `elicitationId`, are ignored. The byline says "Asked by <server>": the
  `authors[serverName].name` when listed, else `serverName`, which is required. Abort `signal` when
  the request is withdrawn (the server cancelled it, the call timed out, the session closed, or the
  inline `target` was removed): the surface is cancelled, nothing opens, and it resolves `cancel`.
  - Form mode, the default without `mode`, is `elicit()`; a schema outside the subset rejects with
    its `TypeError`, so the client can answer the server with an error. Single and multiple choice
    (`enum`, `oneOf`, `items.enum`, `items.anyOf`) and defaults are supported; the deprecated
    `enumNames` is reported as unsupported.
  - URL mode is a `confirm` surface that asks first: the server's message as plain text, the page's
    host emphasised, its full address, a warning for an internationalised host, and no link. Nothing
    is fetched or opened before the person agrees. Open page opens the address in a new tab with
    `noopener` and `noreferrer`, inside the click, and resolves `{action: 'accept'}`; Decline
    resolves `decline`; Cancel, Escape or closing the dialog resolves `cancel`. The address must be
    an absolute lower-case `https://` URL without credentials, checked and normalised like a surface
    link; anything else rejects with a `TypeError`. `open(url)` replaces the opener: it must open a
    browsing context that cannot reach the application, and `false` or a throw answers `cancel`.

  ```js
  const answer = elicitationHandler({ serverName: 'Orders server' });
  const inputResponses = {};
  for (const [key, request] of Object.entries(result.inputRequests ?? {})) {
    if (request.method === 'elicitation/create') inputResponses[key] = await answer(request.params);
  }
  await client.callTool({ ...call, inputResponses, requestState: result.requestState });
  ```
- **Safety** — no string reaches the page as HTML. Records are drawn through `resolve.ref` as an
  `EntityRef`; links are `https:` only, show their host, and pass `resolve.link`, which may refuse
  them; nothing is loaded from an address the surface gives.
- **Accessibility** — a surface that asks is a `<form>` labelled by its title, any other a labelled
  region; the title is at `headingLevel` and its `heading` nodes one and two below, up to h6; a chart offers its data table; the byline says
  "Composed by <author>".

```js
const surface = new Surface(null, {
  document,                                   // from the model's show_surface call
  token: issuedToken,
  policy: (action) => (action.tool === 'mail.send' ? 'confirm' : 'allow'),
  resolve: { entities: ['company'], ref: (ref) => ({ id: ref.id, title: names[ref.id] }) },
  onreply: ({ detail }) => sendToolResult(detail.reply)
});
```
