# Filter — dynamic backend-neutral expressions

A backend-neutral, nested filter authoring component.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/filter · All components: https://zx.zeyos.com/docs/components/index.md

An authoring component for typed, nested filter expressions. It never evaluates application data
or interpolates query text: it emits a versioned, JSON-safe AST for an allowlisted application
adapter to compile into its own backend query language.

- **AST** — `{version: 1, root: {kind:'group', id, logic:'and'|'or', children}}`; children are
  stable-ID groups or `{kind:'condition', id, field, operator, value}` records. Unknown field or
  operator IDs survive parsing and render as unavailable/invalid instead of being silently lost.
- **Fields** — `{id,label,type,operators?,defaultOperator?,choices?,loadChoices?,editor?,minQuery?,
  debounce?}`. Built-in types cover text, number/money, date/datetime, boolean, enum/status/
  priority/country/currency/unit/entity, and tags. Compatible operators and their arity come from
  the exported `filterOperators` matrix; applications may explicitly override/add operator IDs. The
  labels in that matrix are English data. `Filter` shows a built-in operator through its
  `filter.op.<id>` message, and an operator the `operators` option supplies through its own `label`.
- **Relative dates** — `withinLast` and `withinNext` take a span, not two dates: the editor is a
  whole-number amount and a unit select, and the value is the pair `[amount, unit]` with `unit` one
  of `RELATIVE_DATE_UNITS` (`'days'|'weeks'|'months'`), e.g. `[7, 'days']`. `validate()` requires a
  positive whole amount and a known unit; `relativeDateValueError(value)` is the same check for an
  adapter. A value that is not such a pair (two dates) shows as an empty amount.
- **Options** — `fields`, `value`, `operators`, `allowGroups: true`, `maxDepth: 3`,
  `maxConditions: 50`, `autoApply: false`, `readonly`, `disabled`, `applyLabel`, `clearLabel`,
  `searchable: false`, `layout: 'standard'|'compact'`, `rootLogic: null|'and'|'or'`,
  `showApply: true`, `showRootActions: true`.
- **Searchable conditions** — opt in to local-search `Select` controls for fields, operators and
  static single-choice/boolean values. Uncommitted search text never becomes a condition value.
  Multi-choice, async and custom editors retain their existing contracts. Compact rows keep field,
  operator, value and removal together, wrapping the value below on narrow containers.
- **Embedding** — hide internal Apply and duplicate root Add controls when the parent drawer owns
  submission. `rootLogic` fixes the authored root logic; incompatible saved expressions remain
  visible and invalid until corrected, never silently rewritten. Removing the last condition
  returns keyboard focus to Add filter.
- **Methods** — `getValue()`, atomic `setValue()`, `addCondition()`, `addGroup()`, `update()`,
  `remove()`, `move()`, `validate()`, `apply()`, `clear()`, `focus()`, `setReadonly()`,
  `enable()`/`disable()`.
- **Events** — `change {value,valid,errors,reason,nodeId}`, `apply {value}`, `invalid {errors}`,
  and abortable async-choice lifecycle `query`, `loaded`, `error`. `apply()` returns null and
  focuses the first invalid condition when validation fails.
- **Pure exports** — `emptyFilterAst`, `filterCondition`, `filterGroup`, `parseFilterAst`,
  `cloneFilterAst`, `cloneFilterValue`, `stringifyFilterAst`, and `validateFilterAst`.
- **Boundary** — keep the AST in saved views/audit state and compile it in a backend-specific
  adapter with an allowlist and bound parameters. Do not put SQL, URL query fragments, functions,
  DOM nodes, Dates, non-finite numbers, or other executable/non-JSON values into conditions.
