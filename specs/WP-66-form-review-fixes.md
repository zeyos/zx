# WP66 — Correct form validation, commits and picker updates

Branch: `wp/65-library-review-fixes`, from WP65. `AGENTS.md` and WP65's regression contract apply.

## Scope

- `src/components/questionnaire/questionnaire.js`
- `src/components/number-field/number-field.js`
- `src/components/filter-panel/filter-panel.js`
- `src/components/slider/slider.js`
- `src/components/select/select.js`
- `src/components/locale-picker/locale-picker.js`
- `src/components/datebox/datebox.js`
- Existing `tests/unit/{questionnaire,questionnaire-conditions,number-field,filter-panel,slider,select-filter,locale-picker}.test.js`
  and `tests/regression/forms.js`.

No core files, shared documentation, generated API files, dependencies or other components change.
Report any public documentation change to the integration owner.

## Required corrections

1. **P1 / F1: validated answer equals submitted answer.** Async validation must not advance,
   submit or complete using an answer that changed while the validator awaited. Guard both UI and
   programmatic changes, navigation/item replacement and destruction. Prefer invalidating stale
   validation over silently replacing user input; preserve synchronous validation and cancellation.
2. **F2: final transitions validate once.** `next()` validates the final answer once before
   submission. Skipping a skippable final item must not validate the skipped answer. Explicit
   `submit()` still validates an active unvalidated answer, and vetoes remain honored.
3. **F3: item definitions replace cached controls.** `setItems()` may retain unchanged Fields, but
   a changed field definition/required state must rebuild or update the control. Transfer compatible
   values through the new Field's value API; do not reuse an incompatible control by name alone.
4. **F4: native submission agrees with answers.** `new FormData(questionnaire.toElement())`
   must represent all currently applicable answers, in the same shape as `toFormData()`, including
   earlier steps. Avoid duplicate names/values for the active controls, exclude hidden branches,
   preserve array semantics, and restore an enhanced target on destruction.
5. **F5: Slider number-input commits.** `showInput:true` emits one committed change when its
   normalized value changes, including through Field; intermediate input events remain available.
6. **F6: locale-aware number stepping.** Grouped input `1,234` in en-US steps to 1235, with
   corresponding decimal/group parsing for other configured locales and existing bounds/wrapping.
7. **F7: FilterPanel value matches its control.** Initial values and `setValue()` use the same
   numeric bounds/step normalization as displayed controls, including ranges and live/draft modes.
8. **F8: Select preserves typed queries.** Opening caused by text input must not select the newly
   edited text. Explicit opening can retain the existing select-label convenience.
9. **F9: catalogue replacement invalidates queries.** An older pending async response cannot
   replace `setItems()` data; preserve selection, loading state and normal later queries.
10. **F10: locale extensions are accepted.** Valid Unicode/private-use locale tags retain their
    full canonical ID. Name them through a usable base locale and fallback, without throwing.
11. **F11: nested Datebox Escape.** A handled month/year-picker Escape closes only that picker;
    the following Escape closes the calendar and restores input focus.

## Regression acceptance

Reproduce F1 with a deferred validator and an answer changed before completion: no unchecked
submit/complete event. Assert single final validation, final skip, changed field definitions,
multi-step native FormData and branch exclusion. Exercise Slider through Field, grouped stepping,
out-of-range FilterPanel values, real Select typing, stale response replacement, extension tags,
and both nested Escape stages. Include ordinary success/control cases and destroy safety.

## Out of scope

CountryPicker secondary-text search, unchanged Datebox blur events, pluralization, translation
catalogues, broad value-API redesign and saved-view behavior.
