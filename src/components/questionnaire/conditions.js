// @ts-check
/**
 * Declarative questionnaire logic: conditions, branch targets and validation rules written as
 * plain JSON instead of functions, so they can be stored, sent and written by an agent.
 *
 * Everything here is pure and touches no DOM. The Questionnaire evaluates its items' `when`,
 * `next` and `validate` with these functions, and so does anything else that shows or hides an
 * input on a condition, so the two cannot drift.
 * @module questionnaire/conditions
 */

/**
 * The comparison a leaf condition makes.
 * - `eq`, `ne`: equal, not equal. A number compares with a numeric string by value.
 * - `in`, `nin`: the answer is (is not) one of `value`, a list. A multiple answer is "in" when any
 *   of its entries is.
 * - `gt`, `gte`, `lt`, `lte`: two numbers by value, two strings in code-point order (so ISO dates
 *   and times compare correctly). Anything else is never greater or less.
 * - A `Date` answer meets a string value in that value's shape: its local `YYYY-MM-DD` against a
 *   date, its local `YYYY-MM-DDTHH:MM` (`:SS` only when not zero) against a date-time.
 * - A value is never `null`: an unanswered item has no answer to compare, so test it with `empty`.
 * - `empty`, `filled`: the answer is (is not) absent: `null`, an empty or blank string, or a list
 *   with no non-empty entry. `false` and `0` are answers. These take no `value`.
 * - `contains`: a multiple answer holds `value`, or a text answer contains the string `value`.
 * @typedef {'eq'|'ne'|'in'|'nin'|'gt'|'gte'|'lt'|'lte'|'empty'|'filled'|'contains'} ConditionOp
 */

/** @typedef {string|number|boolean|null} ConditionValue */

/**
 * A test of one answer.
 * @typedef {Object} FieldCondition
 * @property {string} field Name of the answer tested.
 * @property {ConditionOp} op The comparison.
 * @property {ConditionValue|ConditionValue[]} [value] What the answer is compared with: a list
 *   for `in` and `nin`, nothing for `empty` and `filled`, one value otherwise.
 */

/**
 * A condition: a field test, or `{all: […]}`, `{any: […]}` or `{not: …}` around further
 * conditions, at most four levels deep counting the field test itself.
 * @typedef {FieldCondition|{all: Condition[]}|{any: Condition[]}|{not: Condition}} Condition
 */

/**
 * One entry of a branch list: `goto` is taken when `if` holds, or always when there is no `if`.
 * @typedef {Object} NextBranch
 * @property {Condition} [if] Condition to test. Only the last entry may leave it out.
 * @property {string} goto Item name, `$review` or `$submit`.
 */

/**
 * Where an item leads: an item name, `$review` (the review screen), `$submit` (straight to
 * submission), or a list of branches whose first match wins. No match falls through to the next
 * visible item.
 * @typedef {string|NextBranch[]} NextTarget
 */

/**
 * One validation rule. Each rule object carries exactly one rule key, and optionally the `message`
 * shown when it fails in place of the default.
 * - `{required: true}`: an answer must be given.
 * - `{minLength: n}`, `{maxLength: n}`: characters of a text answer, or entries of a multiple one.
 * - `{minimum: n}`, `{maximum: n}`: a number, or a numeric text answer.
 * - `{format: 'date'|'date-time'|'time'|'email'|'uri'}`: `YYYY-MM-DD`, an ISO 8601 date and time,
 *   `HH:MM` or `HH:MM:SS`, an email address, an absolute URI.
 * - `{oneOf: [values]}`: the answer, or every entry of a multiple one, is one of the values.
 *
 * Rules other than `required` pass an empty answer; there are no patterns.
 * @typedef {Object} ValidationRule
 * @property {boolean} [required] Whether an answer is needed.
 * @property {number} [minLength] Fewest characters or entries.
 * @property {number} [maxLength] Most characters or entries.
 * @property {number} [minimum] Lowest number.
 * @property {number} [maximum] Highest number.
 * @property {RuleFormat} [format] Named format the text must follow.
 * @property {ConditionValue[]} [oneOf] Allowed values.
 * @property {string} [message] Text shown when this rule fails.
 */

/** @typedef {'date'|'date-time'|'time'|'email'|'uri'} RuleFormat */

/**
 * A problem found in a declarative condition, branch list or rule list. `path` is a JSON Pointer
 * into the checked value (`''` for the value itself).
 * @typedef {Object} ConditionProblem
 * @property {string} path Where the problem is.
 * @property {string} message What is wrong.
 */

/**
 * Turns a message key and its arguments into text. Keys are the rule names, `minItems` and
 * `maxItems` for the list forms of `minLength` and `maxLength`, and the format name itself
 * (`date`, `date-time`, `time`, `email`, `uri`) for a failed `format`.
 * Called with the key and the interpolation values for `%1`, `%2`, ….
 * @typedef {(key: string, ...args: unknown[]) => string} RuleMessage
 */

/** Deepest a condition may nest, counting the field test itself. */
export const MAX_CONDITION_DEPTH = 4;

/** Every comparison a field condition may make. */
export const CONDITION_OPS = Object.freeze(/** @type {ConditionOp[]} */ ([
  'eq', 'ne', 'in', 'nin', 'gt', 'gte', 'lt', 'lte', 'empty', 'filled', 'contains'
]));

/** Every validation rule. */
export const RULE_NAMES = Object.freeze(['required', 'minLength', 'maxLength', 'minimum', 'maximum', 'format', 'oneOf']);

/** Every named format the `format` rule knows. */
export const RULE_FORMATS = Object.freeze(/** @type {RuleFormat[]} */ (['date', 'date-time', 'time', 'email', 'uri']));

/** The `next` target that opens the review screen. */
export const NEXT_REVIEW = '$review';

/** The `next` target that submits at once, skipping any review screen. */
export const NEXT_SUBMIT = '$submit';

/** English texts of the rule messages, keyed as `RuleMessage` describes. */
export const RULE_MESSAGES = Object.freeze({
  required: 'Enter an answer to continue.',
  minLength: 'Enter at least %1 characters.',
  maxLength: 'Enter at most %1 characters.',
  minItems: 'Choose at least %1.',
  maxItems: 'Choose at most %1.',
  minimum: 'Enter a number of at least %1.',
  maximum: 'Enter a number of at most %1.',
  oneOf: 'Choose one of the offered answers.',
  date: 'Enter a date as YYYY-MM-DD.',
  'date-time': 'Enter a date and time as YYYY-MM-DDTHH:MM.',
  time: 'Enter a time as HH:MM.',
  email: 'Enter an email address.',
  uri: 'Enter a full address, such as https://example.com.'
});

const OPS = new Set(CONDITION_OPS);
const VALUELESS_OPS = new Set(['empty', 'filled']);
const LIST_OPS = new Set(['in', 'nin']);
const FORMATS = new Set(RULE_FORMATS);

/**
 * The English rule message for a key, with `%1` filled in. The default `RuleMessage`.
 * @param {string} key Message key.
 * @param {...unknown} args Interpolation values for `%1`, `%2`, ….
 * @returns {string}
 */
export function ruleMessage(key, ...args) {
  const text = /** @type {Record<string, string>} */ (RULE_MESSAGES)[key] ?? key;
  return text.replace(/%(\d+)/g, (match, digit) => {
    const value = args[Number(digit) - 1];
    return value === undefined ? match : String(value);
  });
}

/**
 * Reports whether an answer counts as absent. An empty or blank string, a list with no non-empty
 * entry, `null` and `undefined` are "no answer"; `false` and `0` are answers.
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
 * Evaluates a condition against a set of answers. The caller decides which answers a condition
 * may see; the Questionnaire hands each item only the answers of visible items declared before it.
 * @param {Condition} condition Condition to evaluate.
 * @param {Record<string, unknown>} answers Answers by name.
 * @returns {boolean}
 * @throws {TypeError} When the condition is malformed or nests deeper than four levels; check it
 *   first with `checkCondition()` to report rather than throw.
 */
export function evaluate(condition, answers) {
  return evaluateAt(condition, answers ?? {}, 1);
}

/**
 * @param {unknown} condition @param {Record<string, unknown>} answers @param {number} depth
 * @returns {boolean}
 */
function evaluateAt(condition, answers, depth) {
  if (depth > MAX_CONDITION_DEPTH) {
    throw new TypeError(`A condition may nest at most ${MAX_CONDITION_DEPTH} levels`);
  }
  if (!isPlainObject(condition)) throw new TypeError('A condition must be an object');
  if (Object.hasOwn(condition, 'all')) {
    return listOf(condition.all, 'all').every((entry) => evaluateAt(entry, answers, depth + 1));
  }
  if (Object.hasOwn(condition, 'any')) {
    return listOf(condition.any, 'any').some((entry) => evaluateAt(entry, answers, depth + 1));
  }
  if (Object.hasOwn(condition, 'not')) return !evaluateAt(condition.not, answers, depth + 1);

  const { field, op, value } = condition;
  if (typeof field !== 'string' || field === '') throw new TypeError('A condition needs a "field"');
  if (typeof op !== 'string' || !OPS.has(/** @type {ConditionOp} */ (op))) {
    throw new TypeError(`Unknown condition op: ${String(op)}`);
  }
  if (LIST_OPS.has(op) && !Array.isArray(value)) throw new TypeError(`"${op}" needs a list as its value`);
  const answer = Object.hasOwn(answers, field) ? comparable(answers[field]) : undefined;
  return compare(/** @type {ConditionOp} */ (op), answer, value);
}

/** @param {unknown} list @param {string} name @returns {unknown[]} */
function listOf(list, name) {
  if (!Array.isArray(list)) throw new TypeError(`"${name}" needs a list of conditions`);
  return list;
}

/**
 * @param {ConditionOp} op @param {unknown} answer @param {unknown} value
 * @returns {boolean}
 */
function compare(op, answer, value) {
  switch (op) {
    case 'eq': return same(answer, value);
    case 'ne': return !same(answer, value);
    case 'in': return within(answer, /** @type {unknown[]} */ (value));
    case 'nin': return !within(answer, /** @type {unknown[]} */ (value));
    case 'gt': return order(answer, value) > 0;
    case 'gte': return order(answer, value) >= 0;
    case 'lt': return order(answer, value) < 0;
    case 'lte': return order(answer, value) <= 0;
    case 'empty': return isEmptyAnswer(answer);
    case 'filled': return !isEmptyAnswer(answer);
    case 'contains':
      if (Array.isArray(answer)) return answer.some((entry) => same(comparable(entry), value));
      return typeof answer === 'string' && typeof value === 'string' && answer.includes(value);
    default: return false;
  }
}

/** @param {unknown} answer @param {unknown[]} list @returns {boolean} */
function within(answer, list) {
  if (Array.isArray(answer)) return answer.some((entry) => list.some((candidate) => same(comparable(entry), candidate)));
  return list.some((candidate) => same(answer, candidate));
}

/**
 * Equality of an answer and a condition value: identical, or a number and a numeric string with
 * the same value.
 * @param {unknown} answer @param {unknown} value @returns {boolean}
 */
function same(answer, value) {
  if (answer === value) return true;
  if (answer instanceof Date) {
    if (typeof value !== 'string') return false;
    const [left, right] = datePair(answer, value);
    return left === right;
  }
  if (typeof value === 'number' && typeof answer === 'string') return toNumber(answer) === value;
  if (typeof answer === 'number' && typeof value === 'string') return toNumber(value) === answer;
  return false;
}

/**
 * Orders an answer against a value: negative, zero or positive, or `NaN` when they do not
 * compare — which makes every ordering op false.
 * @param {unknown} answer @param {unknown} value @returns {number}
 */
function order(answer, value) {
  if (answer instanceof Date) {
    if (typeof value !== 'string') return NaN;
    const [left, right] = datePair(answer, value);
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (typeof value === 'number') {
    const number = typeof answer === 'number' ? answer : typeof answer === 'string' ? toNumber(answer) : NaN;
    return Number.isFinite(number) ? number - value : NaN;
  }
  if (typeof value === 'string' && typeof answer === 'string') return answer < value ? -1 : answer > value ? 1 : 0;
  return NaN;
}

/** @param {string} text @returns {number} NaN unless the whole text is a finite number. */
function toNumber(text) {
  const trimmed = text.trim();
  if (trimmed === '') return NaN;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : NaN;
}

/**
 * Brings an answer into the shape conditions compare: an invalid `Date` counts as no answer. A
 * valid one is kept, and compared through `datePair()` in the shape of the value it meets.
 * @param {unknown} value @returns {unknown}
 */
function comparable(value) {
  if (value instanceof Date && Number.isNaN(value.getTime())) return null;
  return value;
}

/** @param {number} number @returns {string} */
const pad = (number) => String(number).padStart(2, '0');

/** @param {Date} date @returns {string} The local `YYYY-MM-DD`. */
function localDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A `Date` as a local date-time, `YYYY-MM-DDTHH:MM`, with `:SS` only when the seconds are not zero.
 * @param {Date} date @returns {string}
 */
function localDateTime(date) {
  const seconds = date.getSeconds() === 0 ? '' : `:${pad(date.getSeconds())}`;
  return `${localDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}${seconds}`;
}

/**
 * Puts a `Date` answer and a string value into one shape. Against a date-only value
 * (`YYYY-MM-DD`) the answer's local date is compared; against anything else its local date-time,
 * with a local date-time value normalised the same way (`T` separator, `:00` seconds dropped).
 * @param {Date} date @param {string} value @returns {[string, string]}
 */
function datePair(date, value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return [localDate(date), value];
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?$/i.exec(value);
  const normalised = match ? `${match[1]}T${match[2]}${match[3] && match[3] !== '00' ? `:${match[3]}` : ''}` : value;
  return [localDateTime(date), normalised];
}

/** @param {unknown} value @returns {string} Text a length rule measures. */
function textOf(value) {
  return value instanceof Date ? localDateTime(value) : String(value);
}

/**
 * Checks a condition's shape without evaluating it, and lists every problem rather than stopping
 * at the first. With `fields`, a field test may only name one of them — how a caller limits a
 * condition to the inputs declared before it.
 * @param {unknown} condition Condition to check.
 * @param {{fields?: Iterable<string>|null, maxDepth?: number}} [options]
 * @returns {ConditionProblem[]} Empty when the condition is well-formed.
 */
export function checkCondition(condition, options = {}) {
  const fields = options.fields == null ? null : new Set(options.fields);
  const maxDepth = Math.min(options.maxDepth ?? MAX_CONDITION_DEPTH, MAX_CONDITION_DEPTH);
  /** @type {ConditionProblem[]} */
  const problems = [];
  checkConditionAt(condition, '', 1, maxDepth, fields, problems);
  return problems;
}

/**
 * @param {unknown} condition @param {string} path @param {number} depth @param {number} maxDepth
 * @param {Set<string>|null} fields @param {ConditionProblem[]} problems
 */
function checkConditionAt(condition, path, depth, maxDepth, fields, problems) {
  if (depth > maxDepth) {
    problems.push({ path, message: `A condition may nest at most ${maxDepth} levels` });
    return;
  }
  if (!isPlainObject(condition)) {
    problems.push({ path, message: 'A condition must be an object' });
    return;
  }
  const keys = Object.keys(condition);
  const combinator = ['all', 'any', 'not'].find((key) => keys.includes(key));
  if (combinator) {
    if (keys.length !== 1) {
      problems.push({ path, message: `"${combinator}" cannot be combined with other keys` });
      return;
    }
    if (combinator === 'not') {
      checkConditionAt(condition.not, `${path}/not`, depth + 1, maxDepth, fields, problems);
      return;
    }
    const list = condition[combinator];
    if (!Array.isArray(list) || list.length === 0) {
      problems.push({ path: `${path}/${combinator}`, message: `"${combinator}" needs a non-empty list of conditions` });
      return;
    }
    list.forEach((entry, index) => checkConditionAt(entry, `${path}/${combinator}/${index}`, depth + 1, maxDepth, fields, problems));
    return;
  }

  for (const key of keys) {
    if (key !== 'field' && key !== 'op' && key !== 'value') problems.push({ path: `${path}/${escape(key)}`, message: 'Unknown key' });
  }
  const { field, op } = condition;
  if (typeof field !== 'string' || field === '') {
    problems.push({ path: `${path}/field`, message: 'A condition needs a "field" naming an input' });
  } else if (fields && !fields.has(field)) {
    problems.push({ path: `${path}/field`, message: `"${field}" is not an input declared before this condition` });
  }
  if (typeof op !== 'string' || !OPS.has(/** @type {ConditionOp} */ (op))) {
    problems.push({ path: `${path}/op`, message: `"op" must be one of ${CONDITION_OPS.join(', ')}` });
    return;
  }
  const hasValue = Object.hasOwn(condition, 'value');
  const { value } = condition;
  if (VALUELESS_OPS.has(op)) {
    if (hasValue) problems.push({ path: `${path}/value`, message: `"${op}" takes no value` });
  } else if (LIST_OPS.has(op)) {
    if (!Array.isArray(value) || value.length === 0 || !value.every(isScalar)) {
      problems.push({ path: `${path}/value`, message: `"${op}" needs a non-empty list of strings, numbers or booleans` });
    } else if (value.includes(null)) {
      // An unanswered item has no answer at all, so null would never match: say what does.
      problems.push({ path: `${path}/value`, message: `"${op}" cannot test for null; use "empty" or "filled"` });
    }
  } else if (!hasValue || !isScalar(value)) {
    problems.push({ path: `${path}/value`, message: `"${op}" needs a string, number or boolean value` });
  } else if (value === null) {
    problems.push({ path: `${path}/value`, message: `"${op}" cannot test for null; use "empty" or "filled"` });
  } else if (['gt', 'gte', 'lt', 'lte'].includes(op) && typeof value !== 'number' && typeof value !== 'string') {
    problems.push({ path: `${path}/value`, message: `"${op}" needs a number or a string` });
  } else if (op === 'contains' && typeof value === 'object') {
    problems.push({ path: `${path}/value`, message: '"contains" needs a string, number or boolean' });
  }
}

/**
 * Resolves where an item leads, given its answer. A list's first entry whose `if` holds — or that
 * has no `if` — wins; no match, like no `next`, gives `null`. A function form is called with the
 * answer and the answers and its result returned as a name.
 * @param {NextTarget|((answer: unknown, answers: Record<string, unknown>) => string|null)|null|undefined} next
 *   Branch target.
 * @param {unknown} answer The item's own answer.
 * @param {Record<string, unknown>} answers Answers the branch conditions may see.
 * @returns {string|null} An item name, `$review`, `$submit`, or `null` to fall through.
 * @throws {TypeError} When `next` or one of its conditions is malformed.
 */
export function resolveNext(next, answer, answers) {
  if (next == null || next === '') return null;
  if (typeof next === 'string') return next;
  if (typeof next === 'function') {
    const resolved = next(answer, answers);
    return resolved == null || resolved === '' ? null : String(resolved);
  }
  if (!Array.isArray(next)) throw new TypeError('"next" must be a name, a list of branches, or a function');
  for (const branch of next) {
    if (!isPlainObject(branch) || typeof branch.goto !== 'string' || branch.goto === '') {
      throw new TypeError('Each branch needs a "goto" name');
    }
    if (!Object.hasOwn(branch, 'if') || evaluate(/** @type {Condition} */ (branch.if), answers)) return branch.goto;
  }
  return null;
}

/**
 * Checks a declarative `next` without resolving it. With `targets`, every name must be one of
 * them or a sentinel; with `fields`, branch conditions may only name those.
 * @param {unknown} next Branch target to check.
 * @param {{targets?: Iterable<string>|null, fields?: Iterable<string>|null}} [options]
 * @returns {ConditionProblem[]} Empty when well-formed.
 */
export function checkNext(next, options = {}) {
  const targets = options.targets == null ? null : new Set(options.targets);
  /** @type {ConditionProblem[]} */
  const problems = [];
  /** @param {unknown} name @param {string} path */
  const checkTarget = (name, path) => {
    if (typeof name !== 'string' || name === '') problems.push({ path, message: 'A branch target must be a non-empty name' });
    else if (targets && name !== NEXT_REVIEW && name !== NEXT_SUBMIT && !targets.has(name)) {
      problems.push({ path, message: `Unknown target "${name}"` });
    }
  };
  if (typeof next === 'string') {
    checkTarget(next, '');
    return problems;
  }
  if (!Array.isArray(next) || next.length === 0) {
    problems.push({ path: '', message: '"next" must be a name or a non-empty list of branches' });
    return problems;
  }
  next.forEach((branch, index) => {
    const path = `/${index}`;
    if (!isPlainObject(branch)) {
      problems.push({ path, message: 'A branch must be an object' });
      return;
    }
    for (const key of Object.keys(branch)) {
      if (key !== 'if' && key !== 'goto') problems.push({ path: `${path}/${escape(key)}`, message: 'Unknown key' });
    }
    checkTarget(branch.goto, `${path}/goto`);
    if (Object.hasOwn(branch, 'if')) {
      for (const problem of checkCondition(branch.if, { fields: options.fields })) {
        problems.push({ path: `${path}/if${problem.path}`, message: problem.message });
      }
    } else if (index < next.length - 1) {
      problems.push({ path, message: 'Only the last branch may leave out "if"; the ones after it are never reached' });
    }
  });
  return problems;
}

/**
 * Runs validation rules in order and returns the first failure's message: the rule's own
 * `message`, or the default from `message`. Rules other than `required` pass an empty answer.
 * @param {ValidationRule[]} rules Rules to run.
 * @param {unknown} value The answer.
 * @param {RuleMessage} [message=ruleMessage] Resolves a default message.
 * @returns {string|null} The message, or `null` when every rule passes.
 * @throws {TypeError} When a rule is malformed; check them first with `checkRuleList()`.
 */
export function checkRules(rules, value, message = ruleMessage) {
  if (!Array.isArray(rules)) throw new TypeError('Validation rules must be a list');
  const answer = comparable(value);
  const empty = isEmptyAnswer(answer);
  for (const rule of rules) {
    const failure = failedRule(rule, answer, empty);
    if (!failure) continue;
    const own = /** @type {ValidationRule} */ (rule).message;
    return typeof own === 'string' && own !== '' ? own : message(failure.key, ...failure.args);
  }
  return null;
}

/**
 * @param {unknown} rule @param {unknown} answer @param {boolean} empty
 * @returns {{key: string, args: unknown[]}|null}
 */
function failedRule(rule, answer, empty) {
  const name = ruleName(rule);
  if (!name) throw new TypeError('Each validation rule needs exactly one rule key');
  const argument = /** @type {Record<string, unknown>} */ (rule)[name];
  if (name === 'required') return argument === true && empty ? { key: 'required', args: [] } : null;
  if (empty) return null;

  switch (name) {
    case 'minLength':
    case 'maxLength': {
      const limit = Number(argument);
      const list = Array.isArray(answer);
      const length = list ? /** @type {unknown[]} */ (answer).filter((entry) => !isEmptyAnswer(entry)).length
        : [...textOf(answer)].length;
      const failed = name === 'minLength' ? length < limit : length > limit;
      const key = list ? (name === 'minLength' ? 'minItems' : 'maxItems') : name;
      return failed ? { key, args: [limit] } : null;
    }
    case 'minimum':
    case 'maximum': {
      const limit = Number(argument);
      const number = typeof answer === 'number' ? answer : typeof answer === 'string' ? toNumber(answer) : NaN;
      const failed = !Number.isFinite(number) || (name === 'minimum' ? number < limit : number > limit);
      return failed ? { key: name, args: [limit] } : null;
    }
    case 'format': {
      const format = /** @type {RuleFormat} */ (argument);
      const entries = Array.isArray(answer) ? answer.filter((entry) => !isEmptyAnswer(entry)) : [answer];
      return entries.every((entry) => matchesFormat(format, comparable(entry))) ? null : { key: format, args: [] };
    }
    case 'oneOf': {
      const allowed = /** @type {unknown[]} */ (argument);
      const entries = Array.isArray(answer) ? answer.filter((entry) => !isEmptyAnswer(entry)) : [answer];
      return entries.every((entry) => allowed.some((candidate) => same(entry, candidate))) ? null : { key: 'oneOf', args: [] };
    }
    default: return null;
  }
}

/** @param {unknown} rule @returns {string|null} The rule key, when there is exactly one. */
function ruleName(rule) {
  if (!isPlainObject(rule)) return null;
  const names = Object.keys(rule).filter((key) => RULE_NAMES.includes(key));
  return names.length === 1 ? names[0] : null;
}

/**
 * Checks a rule list's shape without running it, and lists every problem.
 * @param {unknown} rules Rules to check.
 * @returns {ConditionProblem[]} Empty when well-formed.
 */
export function checkRuleList(rules) {
  /** @type {ConditionProblem[]} */
  const problems = [];
  if (!Array.isArray(rules)) return [{ path: '', message: 'Validation rules must be a list' }];
  rules.forEach((rule, index) => {
    const path = `/${index}`;
    if (!isPlainObject(rule)) {
      problems.push({ path, message: 'A rule must be an object' });
      return;
    }
    const names = Object.keys(rule).filter((key) => RULE_NAMES.includes(key));
    for (const key of Object.keys(rule)) {
      if (key !== 'message' && !RULE_NAMES.includes(key)) problems.push({ path: `${path}/${escape(key)}`, message: 'Unknown key' });
    }
    if (Object.hasOwn(rule, 'message') && typeof rule.message !== 'string') {
      problems.push({ path: `${path}/message`, message: '"message" must be a string' });
    }
    if (names.length !== 1) {
      problems.push({ path, message: `A rule needs exactly one of ${RULE_NAMES.join(', ')}` });
      return;
    }
    const name = names[0];
    const argument = rule[name];
    const at = `${path}/${name}`;
    if (name === 'required' && typeof argument !== 'boolean') problems.push({ path: at, message: '"required" must be true or false' });
    if ((name === 'minLength' || name === 'maxLength') && !(Number.isInteger(argument) && /** @type {number} */ (argument) >= 0)) {
      problems.push({ path: at, message: `"${name}" must be a whole number of zero or more` });
    }
    if ((name === 'minimum' || name === 'maximum') && !(typeof argument === 'number' && Number.isFinite(argument))) {
      problems.push({ path: at, message: `"${name}" must be a finite number` });
    }
    if (name === 'format' && !FORMATS.has(/** @type {RuleFormat} */ (argument))) {
      problems.push({ path: at, message: `"format" must be one of ${RULE_FORMATS.join(', ')}` });
    }
    if (name === 'oneOf' && !(Array.isArray(argument) && argument.length > 0 && argument.every(isScalar))) {
      problems.push({ path: at, message: '"oneOf" needs a non-empty list of strings, numbers, booleans or null' });
    }
  });
  return problems;
}

/**
 * Reports whether a value follows a named format.
 * @param {RuleFormat} format @param {unknown} value @returns {boolean}
 */
function matchesFormat(format, value) {
  // A Date or date-time Field answers with a Date: it is a date, and a date-time, whatever its time.
  if (value instanceof Date) return format === 'date' || format === 'date-time';
  if (typeof value !== 'string') return false;
  switch (format) {
    case 'date': return isDate(value);
    case 'date-time': {
      const match = /^(\d{4}-\d{2}-\d{2})[T ]([0-2]\d:[0-5]\d(?::[0-5]\d(?:\.\d+)?)?)(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/i.exec(value);
      return Boolean(match) && isDate(match[1]) && isTime(match[2].replace(/\.\d+$/, ''));
    }
    case 'time': return isTime(value);
    case 'email': return /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(value);
    case 'uri':
      if (!/^[a-z][a-z0-9+.-]*:\S+$/i.test(value)) return false;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    default: return false;
  }
}

/** @param {string} value @returns {boolean} A real calendar date written `YYYY-MM-DD`. */
function isDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** @param {string} value @returns {boolean} `HH:MM` or `HH:MM:SS` on a 24-hour clock. */
function isTime(value) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} value @returns {boolean} */
function isScalar(value) {
  return value === null || typeof value === 'string' || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value));
}

/** @param {string} key @returns {string} The key as one JSON Pointer segment. */
function escape(key) {
  return key.replace(/~/g, '~0').replace(/\//g, '~1');
}
