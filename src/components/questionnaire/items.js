// @ts-check
/**
 * Pure questionnaire logic: normalization, visibility, branch resolution, validation, and
 * progress. Nothing here touches the DOM, so the rules a branching questionnaire lives or dies by
 * are testable in Node.
 * @module questionnaire/items
 */

/**
 * @typedef {Object} QuestionnaireChoice
 * @property {string|number} value Answer value, unique within its item.
 * @property {string} label Visible answer text.
 * @property {string} [description=''] Supporting line under the label.
 * @property {string|null} [icon=null] Icon name drawn before the label.
 * @property {string} [key] Shortcut key. Assigned `1`–`9` then `a`–`z` when omitted.
 * @property {boolean} [disabled=false] Whether the choice can be picked.
 * @property {boolean} [exclusive=false] Whether picking it clears every other choice of a
 *   `multiple` item — the "None of the above" behaviour.
 */

/**
 * @typedef {Object} QuestionnaireInput
 * @property {string} [label='Other'] Accessible name of the freeform control.
 * @property {string} [placeholder=''] Placeholder text. Never a substitute for the label.
 * @property {boolean} [multiline=false] Whether to render a `textarea`.
 * @property {number} [maxLength=0] Native maximum length, 0 for none.
 */

/**
 * @typedef {Object} QuestionnaireItem
 * @property {string} name Unique key. Doubles as the native input name.
 * @property {string} prompt The question. Rendered as the item's `<legend>`.
 * @property {string} [description=''] Supporting line, associated via `aria-describedby`.
 * @property {string} [section=''] Grouping label shown in the counter and the review list.
 * @property {boolean} [required=false] Whether an answer is needed to advance.
 * @property {boolean} [multiple=false] Whether several choices can be picked at once.
 * @property {boolean} [skippable=false] Whether the Skip action is offered.
 * @property {QuestionnaireChoice[]} [choices=[]] Fixed answers.
 * @property {QuestionnaireInput|null} [input=null] Freeform answer offered beside the choices.
 * @property {Object|null} [field=null] Any registered Zx `Field` type used as the answer control.
 * @property {((answers: Record<string, unknown>) => boolean)|null} [when=null] Visibility predicate.
 * @property {string|((answer: unknown, answers: Record<string, unknown>) => string|null)|null} [next=null]
 *   Branch target: an item name, or a function returning one.
 * @property {((answer: unknown, answers: Record<string, unknown>) => string|null|Promise<string|null>)|null} [validate=null]
 *   Extra validation returning an error message, or null when the answer is acceptable.
 */

/**
 * @typedef {Object} NormalizedItem
 * @property {string} name Unique key.
 * @property {string} prompt The question.
 * @property {string|null} description Supporting line, or null.
 * @property {string} section Grouping label, empty when ungrouped.
 * @property {boolean} required Whether an answer is needed.
 * @property {boolean} multiple Whether several choices can be picked.
 * @property {boolean} skippable Whether Skip is offered.
 * @property {NormalizedChoice[]} choices Fixed answers with shortcut keys assigned.
 * @property {Required<QuestionnaireInput>|null} input Freeform answer, or null.
 * @property {Object|null} field Field options, or null.
 * @property {((answers: Record<string, unknown>) => boolean)|null} when Visibility predicate.
 * @property {string|((answer: unknown, answers: Record<string, unknown>) => string|null)|null} next Branch target.
 * @property {((answer: unknown, answers: Record<string, unknown>) => string|null|Promise<string|null>)|null} validate Extra validation.
 */

/**
 * @typedef {Object} NormalizedChoice
 * @property {string|number} value Answer value.
 * @property {string} label Visible answer text.
 * @property {string|null} description Supporting line, or null.
 * @property {string|null} icon Icon name, or null.
 * @property {string} key Shortcut key, a single lowercase character, or empty when the item has
 *   more choices than there are keys to hand out.
 * @property {boolean} disabled Whether the choice can be picked.
 * @property {boolean} exclusive Whether picking it clears the other choices.
 */

/**
 * @typedef {Object} ResolvedFlow
 * @property {Record<string, unknown>} answers Answers of visible items only, in declaration order.
 * @property {NormalizedItem[]} visible Items whose conditions currently pass.
 */

/**
 * @typedef {Object} QuestionnaireProgress
 * @property {number} index Zero-based position of the active item along the path walked so far.
 * @property {number} answered How many items on the path carry an answer.
 * @property {number} total Path length plus the items still reachable. An estimate whenever a
 *   function `next` is involved, since a dynamic jump is unknowable before the answer exists.
 * @property {number} percent Completion share of `total`, 0–100.
 * @property {string} section Section of the active item, empty when ungrouped.
 */

/** Shortcut keys handed out in order: the digits first, then the letters. */
const SHORTCUT_KEYS = '123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Normalizes and validates a list of item definitions. Never mutates its input.
 * @param {QuestionnaireItem[]} list Item definitions.
 * @returns {NormalizedItem[]}
 * @throws {TypeError} When the list, an item, or a name is malformed, or a name repeats.
 */
export function normalizeItems(list) {
  if (!Array.isArray(list)) throw new TypeError('Questionnaire items must be an array');
  /** @type {Set<string>} */
  const seen = new Set();
  return list.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError('Each questionnaire item must be an object');
    }
    if (typeof item.name !== 'string' || item.name.trim() === '') {
      throw new TypeError('Each questionnaire item needs a non-empty string name');
    }
    const name = item.name;
    if (seen.has(name)) throw new TypeError(`Item already exists: ${name}`);
    seen.add(name);

    const choices = normalizeChoices(item.choices ?? [], name);
    const field = item.field && typeof item.field === 'object' ? { ...item.field } : null;
    const input = normalizeInput(item.input);
    if (choices.length === 0 && !field && !input) {
      throw new TypeError(`Item "${name}" needs choices, an input, or a field`);
    }
    return {
      name,
      prompt: String(item.prompt ?? name),
      description: item.description == null || item.description === '' ? null : String(item.description),
      section: item.section == null ? '' : String(item.section),
      required: Boolean(item.required),
      multiple: Boolean(item.multiple),
      skippable: Boolean(item.skippable),
      choices,
      input,
      field,
      when: typeof item.when === 'function' ? item.when : null,
      next: typeof item.next === 'function' || (typeof item.next === 'string' && item.next) ? item.next : null,
      validate: typeof item.validate === 'function' ? item.validate : null
    };
  });
}

/**
 * Normalizes an item's choices and hands out the shortcut keys. Explicit keys are reserved before
 * any are assigned, so adding one to the third choice never renumbers the others.
 * @param {QuestionnaireChoice[]} list Choice definitions.
 * @param {string} [itemName=''] Owning item name, used in error messages.
 * @returns {NormalizedChoice[]}
 * @throws {TypeError} When the list or a choice is malformed, or a value repeats.
 */
export function normalizeChoices(list, itemName = '') {
  if (!Array.isArray(list)) throw new TypeError('Questionnaire choices must be an array');
  /** @type {Set<string>} */
  const values = new Set();
  const prepared = list.map((choice) => {
    if (!choice || typeof choice !== 'object' || Array.isArray(choice)) {
      throw new TypeError('Each questionnaire choice must be an object');
    }
    if (choice.value == null || choice.value === '') {
      throw new TypeError(`Each choice of "${itemName}" needs a value`);
    }
    const value = typeof choice.value === 'number' ? choice.value : String(choice.value);
    const key = String(value);
    if (values.has(key)) throw new TypeError(`Choice already exists in "${itemName}": ${key}`);
    values.add(key);
    return {
      value,
      label: String(choice.label ?? value),
      description: choice.description == null || choice.description === '' ? null : String(choice.description),
      icon: choice.icon == null || choice.icon === '' ? null : String(choice.icon),
      key: typeof choice.key === 'string' && choice.key ? choice.key.slice(0, 1).toLowerCase() : '',
      disabled: Boolean(choice.disabled),
      exclusive: Boolean(choice.exclusive)
    };
  });

  const taken = new Set(prepared.map((choice) => choice.key).filter(Boolean));
  let cursor = 0;
  for (const choice of prepared) {
    if (choice.key) continue;
    while (cursor < SHORTCUT_KEYS.length && taken.has(SHORTCUT_KEYS[cursor])) cursor += 1;
    // More choices than keys is legal; the surplus simply has no shortcut.
    if (cursor >= SHORTCUT_KEYS.length) break;
    choice.key = SHORTCUT_KEYS[cursor];
    taken.add(choice.key);
    cursor += 1;
  }
  return prepared;
}

/**
 * Reports whether an item's `when` predicate passes for a given set of answers. An item without
 * one is always visible, and a predicate that throws hides nothing — a broken condition must not
 * strand the reader mid-questionnaire.
 * @param {NormalizedItem} item Item to test.
 * @param {Record<string, unknown>} answers Answers visible to the predicate.
 * @returns {boolean}
 */
export function isVisible(item, answers) {
  if (typeof item.when !== 'function') return true;
  try {
    return item.when(answers) !== false;
  } catch {
    return true;
  }
}

/**
 * Resolves visibility and the effective answers in one forward pass.
 *
 * Conditions have to cascade: if "VAT id" is conditioned out because the customer turned out to be
 * a private buyer, a question conditioned on the VAT id must disappear with it. Walking the items
 * in declaration order and letting each predicate see only the answers of *visible* items before
 * it gives exactly that, and terminates — a predicate can never depend on its own visibility.
 *
 * The raw store keeps answers to conditioned-out items, so walking back into a branch restores
 * what was typed there; they are simply not part of the resolved answers.
 * @param {NormalizedItem[]} items All items.
 * @param {Record<string, unknown>} raw Every answer given, including hidden ones.
 * @returns {ResolvedFlow}
 */
export function resolveFlow(items, raw) {
  /** @type {Record<string, unknown>} */
  const answers = {};
  /** @type {NormalizedItem[]} */
  const visible = [];
  for (const item of items) {
    if (!isVisible(item, answers)) continue;
    visible.push(item);
    if (Object.prototype.hasOwnProperty.call(raw, item.name)) answers[item.name] = raw[item.name];
  }
  return { answers, visible };
}

/**
 * Returns the items whose conditions currently pass, in declaration order.
 * @param {NormalizedItem[]} items All items.
 * @param {Record<string, unknown>} raw Every answer given.
 * @returns {NormalizedItem[]}
 */
export function visibleItems(items, raw) {
  return resolveFlow(items, raw).visible;
}

/**
 * Resolves which item follows the given one.
 *
 * A `next` of `null` falls through to the next visible item in declaration order. A string, or a
 * function returning a string, names a target: when that target is currently hidden the walk
 * continues forward from it rather than stranding the reader on an invisible question.
 * @param {NormalizedItem[]} items All items.
 * @param {NormalizedItem} item Item being left.
 * @param {Record<string, unknown>} raw Every answer given.
 * @returns {string|null} Name of the next item, or null at the end of the questionnaire.
 * @throws {RangeError} When `next` names an item that does not exist.
 */
export function resolveNext(items, item, raw) {
  const { answers, visible } = resolveFlow(items, raw);
  const shown = new Set(visible.map((candidate) => candidate.name));

  let target = null;
  if (typeof item.next === 'string') target = item.next;
  else if (typeof item.next === 'function') {
    const resolved = item.next(answers[item.name], answers);
    target = resolved == null || resolved === '' ? null : String(resolved);
  }

  let from = items.indexOf(item);
  if (target !== null) {
    const index = items.findIndex((candidate) => candidate.name === target);
    if (index < 0) throw new RangeError(`Unknown questionnaire item: ${target}`);
    if (shown.has(target)) return target;
    // The named target is conditioned out, so continue the walk from where it sits.
    from = index;
  }

  for (let index = from + 1; index < items.length; index += 1) {
    if (shown.has(items[index].name)) return items[index].name;
  }
  return null;
}

/**
 * Reports whether an answer counts as absent. An empty string, an empty array, null, and undefined
 * are all "no answer"; `false` and `0` are answers.
 * @param {unknown} value Answer value.
 * @returns {boolean}
 */
export function isEmptyAnswer(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.every((entry) => isEmptyAnswer(entry));
  return false;
}

/**
 * Runs the synchronous part of validation: the required check. An item's own `validate` may be
 * asynchronous and is awaited by the component instead.
 * @param {NormalizedItem} item Item to check.
 * @param {unknown} answer Current answer.
 * @param {(key: string) => string} message Message resolver, called with a message key.
 * @returns {string|null} Error message, or null when the answer passes.
 */
export function validateAnswer(item, answer, message) {
  if (!item.required || !isEmptyAnswer(answer)) return null;
  return message(item.choices.length > 0 ? 'questionnaire.required' : 'questionnaire.requiredInput');
}

/**
 * Applies "None of the above" exclusivity to a multiple-choice selection.
 *
 * Picking an exclusive choice drops everything else; picking anything else drops the exclusive
 * ones. The result is returned in choice order, so the answer never depends on click order.
 * @param {NormalizedChoice[]} choices The item's choices.
 * @param {Array<string|number>} selected Values currently selected.
 * @param {string|number|null} [toggled=null] Value the reader just switched on.
 * @returns {Array<string|number>}
 */
export function applyExclusive(choices, selected, toggled = null) {
  const keep = new Set(selected.map((value) => String(value)));
  const exclusive = new Set(choices.filter((choice) => choice.exclusive).map((choice) => String(choice.value)));
  if (exclusive.size > 0 && toggled !== null && keep.has(String(toggled))) {
    if (exclusive.has(String(toggled))) keep.forEach((value) => value !== String(toggled) && keep.delete(value));
    else exclusive.forEach((value) => keep.delete(value));
  }
  return choices.filter((choice) => keep.has(String(choice.value))).map((choice) => choice.value);
}

/**
 * Computes progress along the path actually walked.
 *
 * The index is the position within `path`, not within `items`: once a branch has been taken, the
 * declaration index says nothing about how far the reader has come. `total` adds the items still
 * reachable under the current answers, which is exact for static flows and an estimate as soon as
 * a function `next` can jump somewhere the walk cannot predict.
 * @param {NormalizedItem[]} items All items.
 * @param {Record<string, unknown>} raw Every answer given.
 * @param {string[]} path Item names visited so far, active item last.
 * @returns {QuestionnaireProgress}
 */
export function progressOf(items, raw, path) {
  const { answers, visible } = resolveFlow(items, raw);
  const shown = new Map(visible.map((item) => [item.name, item]));
  const walked = path.filter((name) => shown.has(name));
  const active = walked.length > 0 ? shown.get(walked[walked.length - 1]) : null;
  const answered = walked.filter((name) => !isEmptyAnswer(answers[name])).length;

  const seen = new Set(walked);
  const from = active ? visible.indexOf(active) : -1;
  const remaining = visible.slice(from + 1).filter((item) => !seen.has(item.name)).length;

  const total = walked.length + remaining;
  return {
    index: Math.max(0, walked.length - 1),
    answered,
    total,
    percent: total === 0 ? 0 : Math.round((answered / total) * 100),
    section: active?.section ?? ''
  };
}

/** @param {unknown} input @returns {Required<QuestionnaireInput>|null} */
function normalizeInput(input) {
  if (!input) return null;
  const source = typeof input === 'object' && !Array.isArray(input) ? /** @type {QuestionnaireInput} */ (input) : {};
  return {
    label: String(source.label ?? 'Other'),
    placeholder: String(source.placeholder ?? ''),
    multiline: Boolean(source.multiline),
    maxLength: Math.max(0, Number(source.maxLength) || 0)
  };
}
