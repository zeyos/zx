# WP7b — Field widget adapters

Branch: `wp7b-field-adapters` from `main` (requires WP4 select, WP5 datetime, WP7 form merged;
WP2 toggle for the toggle adapter). Read `AGENTS.md` and `specs/WP-7-form.md` (adapter contract).

## Scope

```
src/components/select/field-adapter.js
src/components/checklist/field-adapter.js
src/components/date-picker/field-adapter.js      # registers 'date', 'month', 'datetime'
src/components/datebox/field-adapter.js          # if datebox owns 'date'/'datetime' — decide:
                                                 # 'date'/'datetime'/'month' → Datebox/MonthPicker-
                                                 # backed Datebox; document the mapping chosen
src/components/timebox/field-adapter.js          # 'time' (duration) via Timebox
src/components/value-list/field-adapter.js       # 'valuelist'
src/components/multi-value-editor/field-adapter.js  # 'multivalueeditor'
src/components/field-upload/field-adapter.js     # 'upload'
src/components/toggle/field-adapter.js           # 'toggle'
src/index.js                                     # side-effect import registering all adapters,
                                                 # exported as registerFieldAdapters() called by
                                                 # default from index.js
demos/components/form-widgets.demo.js            # form using every widget type
tests/unit/field-adapters.test.js                # registration + value round-trip (pure parts)
```

## Contract

Each adapter file:
```js
import { Field } from '../field/field.js';
import { Select } from './select.js';
Field.register('zxselect', (field, options) => {
  const c = new Select(null, { ...options.props, value: options.value });
  field.own(c);   // Field must destroy child component — add `own()` to Field if missing
                  // (small WP7 API addition allowed: register in field.js, one method)
  c.on('change', ({detail}) => field.emitChange(detail.value));
  return { el: c.el, get: () => c.value, set: (v, o) => c.set(v, o),
           focus: () => c.focus(), setDisabled: b => b ? c.disable() : c.enable() };
});
```
Type names to register: `zxselect` (Select; options.props passes items/valueKey/filter etc.),
`checklist`, `date`, `month`, `datetime`, `time`, `valuelist`, `multivalueeditor`, `upload`,
`toggle`. Value semantics: date/month/datetime get/set Date|null; time numeric per unit;
checklist array of ids; upload returns null (server-side value) like legacy.

## Acceptance criteria

1. `npm test` green; adapters registered by importing `src/index.js` (verify in test via
   `Field.has('zxselect')` etc. — jsdom-free: registry check only).
2. form-widgets demo: one Form containing every widget type; getValues() prints a complete
   object; setValues() round-trip; disable-all toggle works.
3. Field highlights render correctly on widget fields (setHighlight on a zxselect).
4. Light/dark × density; destroy of the whole Form destroys child components (no leaks —
   verify via Component registry count exposed in demo or manual check).
5. Committed on `wp7b-field-adapters`.

## Out of scope

New widget features; compat type-name aliases (`gxselect` → WP10).
