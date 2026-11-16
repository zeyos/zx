# Composer — the message box of an agent conversation

The message box of an agent conversation: a growing text with Send and Stop, attachments, @-mentions, / commands, context chips, and queued messages.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/composer · All components: https://zx.zeyos.com/docs/components/index.md

A text that grows with what is written, Send (Stop while the agent works), attachments, `@`
mentions, `/` commands, extra tools, removable context chips, and a queue for messages written while
the agent works. It keeps only unsent messages: `send` hands the text, files, mentions and context to
the application, which owns the conversation and the transport.

- **Constructor** — `new Composer(null, options)` creates its own root; `new Composer(element,
  options)` takes over an element and restores it on `destroy()`.
- **Options** — `label` (accessible name of the text and of the `role="group"` root, English
  `Message`), `placeholder`, `value`, `submitKey: 'enter'|'mod+enter'`, `busy: false`,
  `queue: false`, `queueLimit: 10` (see Queue),
  `disabled: false`, `attachments: false`, `accept: ''` (the `<input type="file">` syntax),
  `maxFiles: 10`, `mentions: null|{trigger: '@', items}` where `items` is `[{id, label,
  description?, icon?, agent?}]` (`agent`: AgentAvatar options or `true` draws the item as its still
  face instead of the icon, with an activity's word in the option's name) or `(query) => items | Promise<items>`, `commands: null|LauncherItem[]`,
  `tools: []` (`[{id, label, icon, pressed?, expanded?, controls?, disabled?}]` — `pressed` makes a
  toggle, `expanded`/`controls` a disclosure; see Tools), `icons: {}` (`attach`, `commands` glyphs),
  `context: [{id, label,
  icon?, ref?}]`, `hint` (quiet text beside Send), `note` (a quiet line under the composer, also
  its description), `sendLabel: null` (visible text on Send, see Send), `draftKey: null`,
  `minRows: 1` (the text never shrinks below it, even empty; capped at `maxRows`), `maxRows: 10`
  (it scrolls beyond), `msg`.
- **Methods** — `focus()`, `getValue()`, `setValue(text)`, `insertText(text)` (types at the caret
  as the person would — text ending in `@` opens the suggestions), `clear()` (text, files and draft;
  context stays), `setBusy(busy)`, `isBusy()`, `setDisabled(disabled)`, `setHint(text)`,
  `setNote(text)` (an empty text hides either), `update(partial)`, `setTools(tools)`,
  `setToolPressed(id, pressed)`, `addFiles(files)`, `getFiles()`, `addContext(chip)` (replaces a
  chip with the same id), `removeContext(id)`, `getContext()`, `getQueue()`, `clearQueue()`,
  `removeQueued(id)`, `destroy()`. The setters emit nothing, except that `setBusy(false)` sends the
  next queued message; `clearQueue()` and `removeQueued(id)` emit `dequeue`.
- **update(partial)** — changes `label`, `placeholder`, `hint`, `note`, `submitKey`, `sendLabel`,
  `disabled` and `busy` in place; a key left out or `undefined` is kept, other keys are ignored.
  The text, its caret and selection, the focus, the attachments, the context chips and the draft
  all stay, so a placeholder that names the chosen model follows the model picker without
  recreating the composer: `composer.update({placeholder: 'Message Halden 3 Deep'})`.
  `label: null` returns to `composer.label`; an empty `placeholder` removes it.
- **Events** — `send {text, files, mentions, context}` is preventable: unless prevented, the text,
  files and draft clear; it never fires with an empty text and no files, nor while busy. `text` is
  trimmed; `mentions` are the picked items whose `@<label>` is still in the text. A message from the
  queue also carries `queued: true`. `queue {item, items}`, `dequeue {item, items, reason:
  'sent'|'removed'|'edited'|'cleared'}`; `items` is the queue as it then stands. `stop`,
  `input {text}`, `attach {files}` (preventable, before the files are added), `remove {kind:
  'file'|'context', id, file?, chip?}` (after the reader removes one), `mention {item}`,
  `command {item}` (the application's own item), `tool {id, tool}` (a copy of the tool as it
  stands, `pressed` included), `historyprevious`.
- **Keyboard** — `submitKey: 'enter'`: Enter sends, Shift+Enter breaks the line;
  `'mod+enter'`: Cmd+Enter (Ctrl+Enter elsewhere) sends, Enter breaks the line. A key during an IME
  composition never sends. Escape closes the suggestions, otherwise emits `stop` while busy (and is
  left alone when idle, so a surrounding dialog can close). ArrowUp on an empty text emits
  `historyprevious`; `/` on an empty text opens the commands. In the suggestions, Up and Down move,
  Enter or Tab picks, Escape closes. Tools are ordinary buttons in the tab order (Enter or Space).
  With `queue`, the send key queues while busy. Tab reaches each queued row, a toolbar of Edit and
  Remove: Left and Right move between them, Home and End go to the first and last, and Delete on
  either removes the row. No key is bound on the document.
- **Tools** — icon buttons in the bar after Attach and Commands, each named by its `label` (also
  its `title` tooltip). A boolean `pressed` makes a toggle with `aria-pressed`, drawn with the
  neutral current fill and an edge; without it the tool is a plain button. Pressing one emits
  `tool`; the composer never changes `pressed` itself — call `setToolPressed(id, !tool.pressed)`.
  `setTools(tools)` redraws them, keeping the focus on the tool with the same id (on the text when
  that tool is gone or disabled). An entry without `id`, `label` or `icon` is left out, as is a
  repeated id; other fields on a tool are handed back in `tool`. `icon` is a built-in glyph name or
  one the application registered with `registerIcons()`. Tools are disabled with the composer.
- **Send** — one button that swaps its glyph, name and `aria-keyshortcuts` between Send and Stop.
  With `sendLabel` (`'Start task'`) it shows the glyph and that text, which is also its accessible
  name; while busy it reads `composer.stop` ("Stop"). In a composer narrower than 24rem (a phone, a
  side column) the text is visually hidden and Send is the square glyph again — the text stays its
  accessible name and its tooltip.
- **Queue** — with `queue: true`, the send key while busy adds the message to the queue and clears
  the composer; the button stays Stop and Escape still stops the run. A queued message keeps the
  text, files, mentions and context chips it had when it was queued. The queue shows at the top of
  the box as a list labelled "Queued (2)", each row with its text on one line, Edit and Remove, and a
  polite status says "Queued; sends when the agent finishes" once per message. When `setBusy(false)`
  ends busy, the first message is sent as a normal `send`, and the next waits for the next time busy
  ends. Nothing is sent while the composer is disabled, and what is being written stays in the text.
  A prevented `send` keeps the message first in line. Edit takes the text, files and mentions back
  into the composer, removes the row and emits `input`; when something is already written or
  attached it asks first through `Dialog.confirm`. At `queueLimit` the send key is refused, the
  message stays where it is, and the hint says why until there is room. Stop keeps the queue, so the
  next message goes when the application ends busy: call `clearQueue()` in the `stop` listener to
  drop it with the run. The queue is session state: it is not kept with the draft, and `destroy()`
  drops it. Only a sent message belongs in the conversation, so queued messages are not thread items.
- **Mentions** — the query is the text after the trigger up to the caret, with no whitespace;
  picking writes `@<label> `. An array is filtered by label prefix, word prefix, label substring,
  then id prefix or a word of the description, ignoring case and accents. A function answers the
  query itself; a stale Promise is ignored.
- **Commands** — opened in a `Launcher` the composer creates on first use and destroys with
  itself; an item with `items` opens a page. The commands keep the order given. A Commands button
  in the bar opens the same list for pointer and touch.
- **Files** — the Attach button, pasting files, and dropping files on the composer (the root shows
  `data-state="dropping"` and a drop label meanwhile) add attachments, filtered by `accept` and
  capped by `maxFiles`.
- **Accessibility** — the `<textarea>` keeps its textbox role. While suggestions show it carries
  `aria-autocomplete="list"`, `aria-controls` (the listbox) and `aria-activedescendant` (the
  highlighted `role="option"`), and a polite status says how many there are. Attachments and
  context chips are labelled lists, each chip with a button named "Remove <name>". Send is never
  disabled while the composer is live (it is `aria-disabled` when there is nothing to send), so
  the focus it holds survives a run ending. A toggled tool states itself with `aria-pressed`, not
  colour alone. The queue is a labelled ordered list; each row's toolbar is named by its text, and
  when a message leaves the queue the focus stays on the row, on the row now in its place, or in the
  text.
- **Draft** — with `draftKey`, the unsent text is kept through `storage('composer')`, restored
  when the composer is created without a `value`, and cleared on send and `clear()`.
