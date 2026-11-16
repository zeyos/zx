# Questionnaire

One question at a time, with branching, a path-aware progress bar, and any Zx field type as the answer.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/questionnaire · All components: https://zx.zeyos.com/docs/components/index.md

A guided, one-question-at-a-time flow: onboarding intake, a service-call checklist, an audit form,
a feedback survey. The questionnaire owns the ordered items, the active one, the answers,
validation, progress and navigation; the page, card, dialog or drawer around it owns closing,
persistence and transport.

The created root is a real `<form>`, so `new FormData(questionnaire.toElement())` reads the
applicable answers. When enhancing a non-form target, pass its contained `<form>` to `FormData`
or call `toFormData()`. Choices are native radios and checkboxes carrying the item name, and
arrow keys inside a choice group use the browser's navigation. Three
things separate it from a `Form` with one `Fieldset` per question: it branches, its answer control
can be any registered `Field` type, and its validation may be asynchronous.

- **Options** — `items: [{name, prompt, description?, section?, required?, multiple?, skippable?,
  choices?, input?, field?, when?, next?, validate?}]`, `answers: {}` and `active: null` (the
  resume pair), `progress: true`, `review: false`, `advance: 'manual'|'auto'`, `shortcuts: true`,
  `allowBack: true`.
- **Choices** — `[{value, label, description?, icon?, key?, disabled?, exclusive?}]`. `exclusive`
  is the "None of the above" behaviour: picking it clears the rest of a `multiple` item, and
  picking anything else clears it.
- **Methods** — `setItems()`, `getItems()`, `goTo(name)`, `next()`, `previous()`, `skip()`,
  `submit()`, `getAnswers()`, `getAnswer(name)`, `setAnswers(values, {silent})`,
  `setAnswer(name, value, {silent})`, `getActive()`, `getPath()`, `getProgress()`, `getState()`,
  `toFormData()`, `reset()`, `focus()`, `destroy()`. `next()`, `skip()` and `submit()` return
  **promises** — `next()` because an item's `validate` may be asynchronous, and `skip()` because
  skipping the last question submits. Everything else is synchronous. Async validation applies
  only to the answer and step it started on; editing, navigating, replacing items, resetting, or
  destroying the questionnaire invalidates a pending result. The last answer is validated once,
  and skipping an optional last question does not validate it again.
- **Events** — `change {name, value, answers}`, `navigate {from, to, reason}` **preventable**,
  `skip {name}`, `invalid {name, message}`, `submit {answers, path}` **preventable**,
  `complete {answers, path}`.
- **Branching** — `when(answers)` decides whether an item is asked at all, and `next` (a name, or
  `(answer, answers) => name`) decides what follows. Conditions **cascade**: each predicate sees
  only the answers of visible items declared before it, so hiding the VAT question also hides
  whatever depended on the VAT id. An answer to a conditioned-out question is kept internally —
  walk back into the branch and it is still there — but is left out of `getAnswers()` and
  `toFormData()` and native `new FormData(questionnaire.toElement())`, so an abandoned branch
  never submits stale data. Native form data includes applicable answers from earlier steps too. A `next` naming a hidden item
  walks forward from it rather than stranding the reader; naming an item that does not exist
  throws `RangeError`. `next: '$review'` opens the review screen and `next: '$submit'` submits at
  once, wherever the item stands; an item of that name goes first. A `when`, `next` or `validate`
  that is neither a function nor a declarative form (`false`, `[]`, `{}`) reads as absent, so
  `validate: strict && check` is safe.
- **Declarative logic** — `when`, `next` and `validate` also take plain JSON, so a questionnaire can
  be stored, sent, or written by an agent; the function forms keep working beside them.
  - A condition is `{field, op, value?}` with `op` one of `eq`, `ne`, `in`, `nin`, `gt`, `gte`,
    `lt`, `lte`, `empty`, `filled`, `contains`, combined with `{all: […]}`, `{any: […]}` and
    `{not: …}`, at most four levels deep. A `when` condition may only name items declared before
    it, and sees only their visible answers, so it cascades like a predicate. A `value` is never
    `null`: an unanswered item has no answer to compare, so test it with `empty` or `filled`. A
    `Date` answer compares by its local date against `YYYY-MM-DD`, and by its local
    `YYYY-MM-DDTHH:MM` against a date-time.
  - `next` may be a list of branches, `[{if: condition, goto: name}, …, {goto: name}]`; the first
    match wins, and no match falls through to the next visible item. A branch condition may also
    name the item itself.
  - `validate` may be a list of rules, each one key plus an optional `message`: `{required: true}`,
    `{minLength: n}`, `{maxLength: n}` (characters, or entries of a multiple answer),
    `{minimum: n}`, `{maximum: n}`, `{format: 'date'|'date-time'|'time'|'email'|'uri'}`,
    `{oneOf: [values]}`. Rules other than `required` pass an empty answer; there are no patterns.
    A `{required: true}` rule marks the item required, like `required: true`.
    A rule's own `message` wins; otherwise its text resolves through `msg()` under
    `questionnaire.rule.<rule>` (`minLength`, `maxLength`, `minItems`, `maxItems`, `minimum`,
    `maximum`, `oneOf`, `date`, `dateTime`, `time`, `email`, `uri`), the same keys a Surface's
    fields use.
  - A malformed condition, branch list or rule list throws `TypeError` when the items are set.
    `evaluate(condition, answers)`, `resolveNext(next, answer, answers)`, `checkRules(rules,
    value)` and the shape checks `checkCondition()`, `checkNext()` and `checkRuleList()` are pure
    exports of `src/components/questionnaire/conditions.js`, for evaluating the same JSON elsewhere.

  ```js
  items: [
    { name: 'method', prompt: 'How will you pay?', required: true,
      choices: [{ value: 'card', label: 'Card' }, { value: 'transfer', label: 'Bank transfer' }],
      next: [{ if: { field: 'method', op: 'eq', value: 'card' }, goto: '$submit' }] },
    { name: 'iban', prompt: 'IBAN', input: {},
      when: { field: 'method', op: 'eq', value: 'transfer' },
      validate: [{ required: true }, { minLength: 15, message: 'An IBAN has at least 15 characters.' }] }
  ]
  ```
- **Path and progress** — `getPath()` is the questionnaire's memory of the route walked, and
  `previous()` pops it: once a branch has been taken, "previous" is not `index - 1`. `getProgress()`
  returns `{index, answered, total, percent, section}` where `total` is the path plus the items
  still reachable — exact for a static flow, an estimate once a function `next` can jump somewhere
  the forward walk cannot predict.
- **Field answers** — `field: {type: 'date'|'number'|'zxselect'|'rating'|'upload'|…}` hands the
  answer to a `Field`, so any registered field type works, including ones an application registered
  itself. The `<legend>` already asks the question, so the Field's own label is hidden from sight
  but kept as the control's accessible name unless the item gives `field.label` explicitly; the
  Field draws its own highlight, so a failing answer shows one message, not two.
- **Validation** — `required` and declarative rules are checked synchronously; a function
  `validate(answer, answers)` may return a message, `null`, or a **promise** of either, and a rejection is reported as its message.
  While the check is pending the root carries `data-state="checking"` and `aria-busy="true"` and
  the actions are disabled.
- **Review** — `review: true` shows a summary of every answer on the path before submitting, each
  with an Edit that reopens that question; Continue from an edited question comes straight back to
  the review rather than replaying the tail.
- **Semantics** — the item is a `<fieldset>` and the prompt its `<legend>`; the description and the
  error are associated through `aria-describedby`, the error is a `role="alert"`, and a failing
  item carries `aria-invalid="true"`. `data-state` on the root is
  `asking`, `checking`, `review`, or `complete`. Submitting does not replace the content: it sets
  `data-state="complete"`, hides the actions, and emits `complete`, leaving the thank-you screen to
  the application.
- **Keyboard** — `1`–`9` then `a`–`z` pick the matching answer, assigned in choice order (an
  explicit `key` is reserved first, so adding one never renumbers the others) and shown as a key
  cap on each choice; the caps are `aria-hidden`, since a screen-reader user moves through the
  group with the arrow keys the radios already provide. `Enter` continues, except in a `multiline`
  input. Shortcuts are suppressed while focus is in a text control. Navigating moves focus to the
  new question's fieldset, which is what gets the prompt announced; failing validation moves it to
  the first answer control instead.
