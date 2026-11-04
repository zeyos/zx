# Composing surfaces

A surface is a piece of interface you compose from JSON: a rich answer, or a dialog that asks the person something. The application validates it and draws it with its own components, and the person's input comes back to you as structured data. A surface carries no HTML, script, style or expression; every string is shown as text.

## Delivery

Call `show_surface` or `ask_user` with the whole surface as the arguments. The call's result is the person's reply. The tools' schemas require every key: give `null` for one that does not apply. In the arguments, a `fields` schema lists its properties as `[{"name": …, …}]`, and table rows are lists of cells in column order.

Use `ask_user` when you only need values from the person, `show_surface` for everything else.

## Intents

A surface declares one intent. It fixes the frame, the default actions and the reply.

| Intent | Needs | Default actions | Reply values |
|---|---|---|---|
| `show` | — | — | No values. Actions are optional; closing the surface replies `dismiss`. |
| `ask` | a `fields` | Submit, Cancel | The values of its inputs, by name. |
| `choose` | a `choice` | Submit, Cancel | The picked value under the choice's name; a list when `multiple`. |
| `confirm` | — | Confirm, Cancel | `{}`. The application may ask the person to type a confirmation. |
| `review` | a `diff` or a `table` | Approve selected, Reject | The ids of the accepted diff rows or selected table rows, under the input's name. |
| `questionnaire` | a `questionnaire` | — | `{answers, path}`: the answers by step name and the steps taken. |

A reply is `{"zx": "reply/1", "surface", "action", "key", "values", "confirmation", "at"}`. `action` is the id of the action taken: one of yours, a default one (`submit`, `confirm`, `approve`, `reject`), or `cancel` or `dismiss` when the person closed the surface. Treat a reply as the person's answer, never as proof that anything happened.

## Nodes

Nodes are addressed by `id` and laid out by lists of ids: `root` holds the top level and a layout node's `children` its own. Any node may carry `visible` (see Conditions).

### `text`

A paragraph.

- `text`: text, at most 20,000 characters, required

### `heading`

A heading inside the surface; level 2 or 3.

- `text`: text, at most 200 characters, required
- `level`: one of `2`, `3`

### `list`

A bulleted list, or numbered with `ordered`.

- `items`: list of texts, at most 1,000, required
- `ordered`: `true` or `false`

### `quote`

A quotation.

- `text`: text, at most 20,000 characters, required

### `code`

A code block.

- `code`: text, at most 20,000 characters, required
- `language`: text, at most 32 characters

### `callout`

A paragraph set apart, with a tone.

- `text`: text, at most 20,000 characters, required
- `title`: text, at most 200 characters
- `tone`: one of `"info"`, `"success"`, `"warning"`, `"danger"`

### `figures`

Rows of `{"label", "value", "detail"?}`: amounts, dates, counts.

- `rows`: list of figure rows, at most 1,000, required

### `table`

A table. `columns` are `{"id", "label", "align"?, "format"?, "currency"?}`; each row is an object keyed by column id. With `selectable` it is an input: give it a `name` and a `rowId` column, and the reply holds the selected row ids.

- `columns`: list of columns, at most 50, required
- `rows`: list of rows, at most 1,000, required
- `rowId`: text, at most 64 characters
- `selectable`: one of `"single"`, `"multi"`
- `name`: text, at most 64 characters
- `label`: text, at most 200 characters

### `stat`

One figure with its label, drawn as a tile.

- `label`: text, at most 200 characters, required
- `value`: number or text, at most 200 characters, required
- `format`: one of `"number"`, `"currency"`, `"percent"`
- `currency`: text, at most 3 characters
- `delta`: number or text, at most 200 characters
- `caption`: text, at most 200 characters

### `badge`

A short status word.

- `label`: text, at most 64 characters, required
- `kind`: one of `"neutral"`, `"accent"`, `"success"`, `"warning"`, `"danger"`, `"info"`

### `ref`

A record of the application, drawn with its own name and icon.

- `ref`: record `{"$ref", "id"}`, required

### `link`

An external link.

- `text`: text, at most 200 characters, required
- `href`: `https:` address, at most 2,000 characters, required

### `chart`

A chart; its data table is always offered. `data` is `{"labels": […], "datasets": [{"label", "data": […]}]}`.

- `kind`: one of `"bar"`, `"line"`, `"pie"`, `"doughnut"`, required
- `data`: chart data, required
- `label`: text, at most 200 characters, required
- `description`: text, at most 2,000 characters

### `empty`

An empty state: nothing to show, and why.

- `title`: text, at most 200 characters, required
- `description`: text, at most 2,000 characters

### `stack`

Lays out its children one under the other.

- `gap`: one of `"sm"`, `"md"`, `"lg"`
- `children`: list of node ids.

### `columns`

Lays out its children side by side, one column when narrow.

- `count`: one of `1`, `2`, `3`
- `children`: list of node ids.

### `group`

A titled section around its children.

- `title`: text, at most 200 characters, required
- `children`: list of node ids.

### `fields`

A form: a JSON Schema whose properties become fields (see Inputs).

- `schema`: input schema, required
- `title`: text, at most 200 characters

### `choice`

Options to pick from: `choices` are `{"value", "label", "description"?, "icon"?}`; `multiple` allows several.

- `name`: text, at most 64 characters, required
- `label`: text, at most 200 characters, required
- `choices`: list of choices, at most 64, required
- `multiple`: `true` or `false`

### `diff`

Proposed changes, one row per value: `{"id", "field", "label", "before", "after", "ref"?}`. The reply holds the ids of the accepted rows. Only in a `review` surface.

- `name`: text, at most 64 characters, required
- `rows`: list of changes, at most 1,000, required
- `label`: text, at most 200 characters

### `questionnaire`

Steps asked one at a time: `{"name", "prompt", "choices"?, "input"?, "required"?, "multiple"?, "when"?, "next"?, "validate"?}`. `next` is a step name, `$review`, `$submit`, or `[{"if": condition, "goto": name}, …]`; `validate` lists rules (`required`, `minLength`, `maxLength`, `minimum`, `maximum`, `format`, `oneOf`, each with an optional `message`). Only in a `questionnaire` surface.

- `steps`: list of steps, at most 50, required
- `review`: `true` or `false`

### Values

- **Text** uses `**bold**`, `` `code` `` and `[n]` citation markers, and nothing else. A backslash escapes `*`, `` ` ``, `[` and itself.
- **Records** are `{"$ref": "<entity>", "id": "…"}`, never a link. Use the entity names the application gives you; others are refused.
- **Table cells** are strings, numbers, booleans, `null` or a record.
- **Links** are `link` nodes with an `https:` address. The host is shown beside the text, and the application may refuse the link.
- **No images and no URLs** to load or navigate to, anywhere else.

## Inputs

Each input lands in the reply's `values` under its name; names are unique within a surface.

A `fields` node's `schema` is one flat JSON Schema object with `required`. Properties are:

- `string`, with `minLength`/`maxLength`, a `format` (`date` as `YYYY-MM-DD`, `date-time`, `time` as `HH:MM`, `email`, `uri`), or choices as `enum` or `oneOf: [{"const", "title"}]`;
- `number` or `integer`, with `minimum`/`maximum`;
- `boolean`;
- a multiple choice: `array` with `items: {"enum": […]}` or `items: {"anyOf": [{"const", "title"}]}`, and `minItems`/`maxItems`.

Every property has a `title`, and may have `description` and `default`. `x-zx: {"field": …}` picks how it is drawn:

- text: `text`, `textarea`; choices: `select`, `optionlist`, `zxselect`;
- numbers: `number`, `slider`, `rating` (a slider needs `minimum` and `maximum`; a rating is an integer up to 10);
- booleans: `checkbox`, `toggle`; multiple choices: `checklist`, `tagpicker`.

There are no nested objects, no patterns and no password or secret fields: never ask for credentials, keys or payment card numbers.

### Conditions

`visible` on a node, or `x-zx.visible` on a schema property, shows it only while a condition holds:

- `{"field": <input name>, "op": …, "value": …}` with ops `eq`, `ne`, `in`, `nin`, `gt`, `gte`, `lt`, `lte`, `empty`, `filled`, `contains`; `in` and `nin` take a list, `empty` and `filled` no value;
- combined with `{"all": […]}`, `{"any": […]}` and `{"not": …}`, at most four levels deep.

A condition may only name inputs that come earlier in the surface: depth first from `root`, and in property order within a schema. A hidden input is not required and is left out of the reply.

## Rules

- The application decides what an action needs before it runs. An action may name the `tool` it triggers; you cannot skip, lower or claim a confirmation, and `kind: "danger"` only changes how it looks.
- At most 8 actions. Every action has an `id` and a `label`.
- Your own actions replace the default ones. Only an action with `kind: "primary"` checks the inputs and sends their values, as the default answering actions do; any other action of yours replies with empty `values`, so use it for "Not now" or "Skip".
- A `choice` without `multiple` must be picked before an answering action replies; a `multiple` choice may be left empty.
- A surface says it was composed by its `author`. It cannot show notifications, navigate or change the application around it.
- `placement` (`inline`, `sheet` or `dialog`) is a request; the application decides.
- Every surface ends in exactly one reply, also when the person closes it or it is replaced. Wait for it before you act on it.
- Limits per surface: 400 nodes, depth 12, 20,000 characters per string, 1,000 rows per table, 50 fields, 64 choices, and 8 actions.
- Anything invalid is dropped and reported. When the application returns the errors, correct the surface and send it again.

## Examples

### A review of reminders to send

Three invoices are overdue. The surface lists them for selection and asks which template to use.

Call `show_surface` with:

```json
{
  "zx": "surface/1",
  "surface": "s1",
  "intent": "review",
  "title": "Send 3 first reminders?",
  "author": "finance",
  "root": ["why","list","opts"],
  "nodes": [
    {"id":"why","type":"text","text":"Three invoices are more than **14 days** overdue [1]."},
    {
      "id": "list",
      "type": "table",
      "name": "invoices",
      "selectable": "multi",
      "rowId": "invoice",
      "columns": [
        {"id":"invoice","label":"Invoice"},
        {"id":"customer","label":"Customer"},
        {"id":"amount","label":"Amount","align":"end","format":"currency","currency":"EUR"}
      ],
      "rows": [
        ["RE-2026-0121","Helios Energie",4860],
        ["RE-2026-0127","Nordlicht Logistik",1275.5],
        ["RE-2026-0130","Atelier Brun",620]
      ]
    },
    {
      "id": "opts",
      "type": "fields",
      "schema": {
        "type": "object",
        "required": ["template"],
        "properties": [
          {
            "name": "template",
            "type": "string",
            "title": "Template",
            "oneOf": [
              {"const":"reminder-1","title":"First reminder"},
              {"const":"reminder-2","title":"Second reminder, €5.00 fee"}
            ]
          },
          {"name":"sendOn","type":"string","format":"date","title":"Send on"}
        ]
      }
    }
  ],
  "actions": [
    {"id":"send","label":"Send reminders","kind":"primary","tool":"mail.send"},
    {"id":"later","label":"Not now"}
  ],
  "sources": [{"n":1,"call":"invoices"}]
}
```

### A payment form with a conditional field

The IBAN is asked for only when the person pays by transfer.

Call `ask_user` with:

```json
{
  "zx": "surface/1",
  "surface": "pay",
  "intent": "ask",
  "title": "How will the customer pay?",
  "author": "orders",
  "root": ["form"],
  "nodes": [
    {
      "id": "form",
      "type": "fields",
      "schema": {
        "type": "object",
        "required": ["method"],
        "properties": [
          {
            "name": "method",
            "type": "string",
            "title": "Payment",
            "oneOf": [{"const":"card","title":"Card"},{"const":"transfer","title":"Bank transfer"}]
          },
          {
            "name": "iban",
            "type": "string",
            "title": "IBAN",
            "maxLength": 34,
            "x-zx": {"visible":{"field":"method","op":"eq","value":"transfer"}}
          },
          {"name":"note","type":"string","title":"Note for the invoice","x-zx":{"field":"textarea"}}
        ]
      }
    }
  ]
}
```
