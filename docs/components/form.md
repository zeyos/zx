# Form / Fieldset / Field

Fieldsets of typed fields with one values object in and out — the schema-shaped way to build a record editor.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/form · All components: https://zx.zeyos.com/docs/components/index.md

## Form

- **Options** — `fieldsets: []`, `actions: [button descriptors]`, `novalidate: true`,
  `idPrefix: null` (handed to the fieldsets it builds; a fieldset's own wins).
- **Methods** (proxied across the fieldsets) — `getValues()`, `setValues()`, `getField()`,
  `setValue()`, `getValue()`, `reset()`, `setHighlights()`, `clearHighlights()`, `addFieldset()`,
  `setActions()`, `submit()`.
- **Events** — `submit {values}` (preventable; required/int/float validation runs first),
  `invalid {errors}`, `change {id, value}`.

## Fieldset

- **Options** — `title` (the legend: a quiet sentence-case caption, small, medium weight, muted —
  the fields are the content), `columns: 1|2|3`, `fields: { id: Field-options }`,
  `idPrefix: null`.
- **Keys and ids** — a field key names the value, not an element: it is the field's `name` (and
  a native control's `name`) and its `data-field-id`, never a DOM id by itself. Control ids are
  `<idPrefix>-<key>`, with a prefix generated per instance unless `idPrefix` is given, so a form
  mounted twice repeats no id and a field `stage` never collides with a `#stage` elsewhere; the
  label, description, and message ids derive from it (`<id>-label`). Radio groups are named after
  the control id. An `id` in the field options that differs from the key is used as given.
- **Methods** — `addField(id, opts|Field|element|component)`, `getField`/`hasField`/`getFields`,
  `getValues`/`setValues`/`getValue`/`setValue`, `reset`, `clear`, `focus(id)`,
  `setHighlights`/`clearHighlights`.
- **Adopting a component** — `addField(id, component)` wraps any component (or element) that is
  not a registered field type and drives it through its own API. Values: `getValue`/`setValue`,
  `get`/`set`, `getValues`/`setValues`, `isChecked`/`setChecked`, or a `value` property, tried in
  that order (a Toggle reads its on-value, as the `toggle` type does); an element is read through
  `value`, or `checked` for a checkbox or radio. Disabled: `setDisabled(bool)`, then
  `enable()`/`disable()`, then a `disabled` property; a plain wrapper gets `aria-disabled` and its
  form controls disabled. Read-only: `setReadonly`/`setReadOnly` or the element's `readOnly`. The
  component's own `change` becomes the field's `change`, once per edit. Writes keep the caller's
  `silent`: `setValues(values)` lets the component emit its own `change` to its own listeners and
  the field emit one `change`; `setValues(values, {silent: true})` and `reset()` stay quiet.
  Removing the field puts the component back, unsubscribes from it, and undoes the disabled and
  read-only state the field set.

## Field

- **Options** — `id` (the control's DOM id; generated when omitted), `name` (the field name and
  native control `name`; defaults to `id` on a standalone field), `type: 'text'`, `label`,
  `description`, `value`, `placeholder`, `required`, `disabled`, `readonly` (shown and focusable,
  not editable; ignored by types whose control has no read-only state, such as `checkbox`,
  `select`, `zxselect`, `date`, `time`), `options`, `layout: 'stack'|'inline'`, `props: {}`.
- **Properties** — `controlId` (the control's DOM id), `name`.
- **Built-in types** — `text`, `password`, `textarea`, `checkbox`, `int`, `float`, `select`,
  `optionlist`, `hidden`, `html` (display content as text: no input frame, a control's height,
  inset like the values around it in a quiet form).
- **Methods** — `getValue`/`setValue`, `focus`, `reset`, `setDisabled`, `setReadonly`,
  `setHighlight(msg, kind)`, `clearHighlight`, `getInput`, `own(child)`, plus the statics
  `Field.register(type, adapter)` and `Field.has(type)`.
- **Events** — `change {value}`, once per committed edit whatever the type (a typed value on
  leaving the input, a slider on release, `code` when the editor loses focus after an edit);
  `input {value}` for every keystroke or drag step from the types that tell the two apart
  (`code`, `slider`); `invalid {message}`.
- **Adapters** — `Field.register(type, (field, options) => ({el, get, set, focus, setDisabled,
  setReadonly?, destroy?, labelTarget?}))`. An adapter whose widget reports its own commits
  forwards them with `field.emit('change', {value})` and stops the native `change` its inner
  control bubbles (`field.listen(widget.el, 'change', (e) => e.stopImmediatePropagation())`), so
  the Field does not report the same edit twice.
- **Labels** — small, medium weight, in the muted text colour: quieter than the values they name.
  With `layout: 'inline'` the label lines up with the control's first line.

## Quiet fields

Inside any element with `data-zx-fields="quiet"` — an inspector, a property list, an inline record
— fields read as values rather than a wall of boxes. Native inputs, selects and textareas, and the
composite controls (`Select`, `TagPicker`, `NumberField`, `Datebox`, `DateRangeBox`, `Timebox`)
show no border, fill, chevron, stepper or calendar button until hovered (the hover fill and the
affordances come back) and their full field chrome and focus ring while focused or open. A
NumberField's value starts where a quiet text input's text starts, and `html` display content is
inset to match. Disabled
and read-only controls never light up; an invalid Datebox keeps its danger border. It is a context
attribute, not an option: set it on the container.
