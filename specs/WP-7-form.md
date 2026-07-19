# WP7 — Form system: Form, Fieldset, Field, ValueList, MultiValueEditor, FieldUpload

Branch: `wp7-form` from `main` (kernel merged; WP2 button/message preferred if merged).
Read `AGENTS.md`. Legacy reference: `../gx-bootstrap/src/classes/{Form,Fieldset,Field,
ValueList,MultiValueEditor,FieldUpload}.js`.

## Scope

```
src/components/field/field.js|css          # + type registry
src/components/fieldset/fieldset.js|css
src/components/form/form.js|css
src/components/value-list/value-list.js|css
src/components/multi-value-editor/multi-value-editor.js|css
src/components/field-upload/field-upload.js|css
demos/components/{form,value-list,multi-value-editor,field-upload}.demo.js
tests/unit/field-registry.test.js          # registry + built-in coercion logic (int/float)
src/index.js styles/zx.css
```

## field.js — `class Field` (cssName `field`) + registry

One labelled control: label, control, description, validation/highlight message.

```js
static defaults = { id:null, type:'text', label:'', description:'', value:undefined,
  placeholder:'', required:false, disabled:false, options:null /* for select/optionlist */,
  layout:'stack'|'inline', props:{} /* passthrough to the control adapter */ }
Field.register(type, adapter)   // adapter: (field, options) => ({
                                //   el,                       // control root Element
                                //   get(), set(value, opts),  // value access
                                //   focus(), setDisabled(b),
                                //   destroy()? })
Field.has(type)
```

Built-in types (registered in field.js): `text, password, textarea, checkbox (single bool),
int, float (blur coercion + validation, locale decimal comma accepted), select (native),
optionlist (radio group; options array|{value:label}), hidden, html (static content), custom
(options.adapter passed directly)`.
- Methods: `getValue()`, `setValue(v, {silent})`, `focus()`, `reset()` (to initial value),
  `setDisabled(b)`, `setHighlight(message, kind='danger'|'warning'|'success')`,
  `clearHighlight()`, `getInput()` (control root).
- Events: `change {value}`, `invalid {message}`.
- A11y: `<label for>` wiring via uid; description via `aria-describedby`; highlight message
  `role="alert"` when danger + `aria-invalid` on control.
- Unknown type: render a visible error field (never throw), log via console.warn.

## fieldset.js — `class Fieldset` (cssName `fieldset`)

`defaults: { title:'', columns:1|2|3, fields:{} /* id -> Field options | Field | Element |
Component */ }`. Methods: `addField(id, fieldOptions|Field) -> Field`, `getField(id)`,
`hasField(id)`, `getFields()`, `getValues()`, `setValues(obj, {silent})`, `getValue(id)`,
`setValue(id, v)`, `reset()`, `clear()`, `focus(id)`,
`setHighlights({id: message}, kind) -> count`, `clearHighlights()`.
Renders native `<fieldset><legend>`; columns via CSS grid + container query collapse to 1 col
when narrow.

## form.js — `class Form` (cssName `form`)

`defaults: { fieldsets:[], actions:[] /* button() descriptors */, novalidate:true }`.
Wraps a real `<form>`; Enter submits → `submit {values}` event (preventable), required/int/float
checks run first → on failure `invalid {errors}` + per-field highlights via msg key
`form.required` etc. Methods: proxy `getValues/setValues/getField/setValue/getValue/reset/
setHighlights/clearHighlights` across fieldsets; `addFieldset(fs)`; `setActions(list)`;
`submit()`. Event: `change {id, value}` (bubbled from any field).

## value-list.js — `class ValueList` (cssName `value-list`)

Tag/chips input (successor incl. legacy sortable). `defaults: { values:[], placeholder:'',
deletable:true, sortable:true, unique:true, validate:null /* (str)=>bool|string */ }`.
Enter adds; Backspace on empty input removes last; chips have × (deletable); drag to reorder
(HTML5 DnD or pointer-based, keyboard alternative: chip focus + Ctrl+ArrowLeft/Right moves).
Methods: `getValues()`, `setValues(arr, {silent})`, `addValue(v)`, `removeValue(v)`, `focus()`,
`enable()/disable()`. Events: `change {values}`, `add {value}`, `remove {value}`.
Chips focusable (`role="listbox"`/`option` or button semantics — pick per APG guidance and
document choice).

## multi-value-editor.js — `class MultiValueEditor` (cssName `multi-value-editor`)

Ordered value editor with explicit rows (successor; FIXES legacy dead delete + adds working
reorder). `defaults: { values:[], options:null /* allowed values */, addLabel }`.
Rows: value (text input or select when options given) + up/down buttons + working remove button
+ add row. Methods/events like ValueList (`getValues/setValues`, `change`). JSON-string legacy
getValue lives in compat, NOT here.

## field-upload.js — `class FieldUpload` (cssName `field-upload`)

Drag-drop/click upload area with progress (successor, fetch-based).
`defaults: { url:'', paramName:'upload', params:{}, headers:{}, multiple:false, accept:null,
maxSize:null, autoUpload:true, preview:true /* image thumbnail */, http:null /* injected Http */ }`.
Methods: `upload(files?)`, `abort()`, `clear()`, `setDisabled(b)`.
Events: `select {files}`, `progress {percent}`, `success {response}`, `error {error}`, `abort`.
Uses kernel Http (XHR fallback inside Http NOT required — use fetch; progress via
ReadableStream upload not portable → use XMLHttpRequest directly inside this component for
upload progress, documented; still zero deps).
A11y: drop zone is a labelled button; keyboard opens file dialog; drag state via
`data-state="dragover"`.

## Demos

- form: a realistic ZeyOS-ish "Edit contact" form — 2 fieldsets (2-col), all built-in types,
  required + int/float validation, submit/invalid logging, setValues/getValues/reset buttons,
  highlight showcase.
- value-list: tags with validation (email example), sortable demo, keyboard reorder.
- multi-value-editor: with free text and with options; reorder/delete.
- field-upload: fake endpoint (httpbin-style echo not available offline — point at a
  data: URL? No: implement demo with `http` injected as a stub Http that simulates latency and
  progress); image preview; error case.

## Acceptance criteria

1. `npm test` green: registry (register/override/unknown), int/float coercion incl. "1.234,56"
   comma locale and invalid input.
2. Form demo: Tab order logical; labels announce; required failure focuses first invalid field.
3. ValueList: full mouse + keyboard add/remove/reorder; MultiValueEditor delete/reorder work.
4. FieldUpload: simulated progress renders; abort works; keyboard accessible.
5. Light/dark × density clean; container-query column collapse works (narrow the demo panel).
6. Double create/destroy clean.
7. Committed on `wp7-form`.

## Out of scope

Widget field adapters (gxselect/date/... — WP7b); Editor/rich text (dropped, compat maps to
textarea); server persistence.
