/**
 * DOM-free step-list logic shared by {@link Stepper}: validation, normalization, and the
 * index arithmetic behind `next()` / `previous()`.
 * @module components/stepper/steps
 */

/**
 * @typedef {Object} StepDefinition
 * @property {string} name Stable step name, unique within the stepper.
 * @property {string} title Visible step title.
 * @property {string} [description] Secondary line rendered under the title.
 * @property {boolean} [optional=false] Marks the step as skippable.
 * @property {boolean} [disabled=false] Whether the step can be activated.
 */

/**
 * @typedef {Object} NormalizedStep
 * @property {string} name Stable step name.
 * @property {string} title Visible step title.
 * @property {string|null} description Secondary line, or null.
 * @property {boolean} optional Whether the step is skippable.
 * @property {boolean} disabled Whether the step can be activated.
 */

/**
 * Validates and normalizes a step list. Every step needs a unique non-empty name; every other
 * property is coerced to its documented type.
 * @param {StepDefinition[]} list Step definitions.
 * @returns {NormalizedStep[]} Normalized copies — the input objects are never mutated.
 * @throws {TypeError} When the list or a step is malformed.
 * @throws {RangeError} When two steps share a name.
 */
export function normalizeSteps(list) {
  if (!Array.isArray(list)) throw new TypeError('Stepper steps must be an array');
  const names = new Set();
  return list.map((step) => {
    if (!step || typeof step !== 'object' || Array.isArray(step)) {
      throw new TypeError('Step definition must be an object');
    }
    if (typeof step.name !== 'string' || step.name === '') {
      throw new TypeError('Step name must be a non-empty string');
    }
    if (names.has(step.name)) throw new RangeError(`Step already exists: ${step.name}`);
    names.add(step.name);
    return {
      name: step.name,
      title: String(step.title ?? ''),
      description: step.description == null ? null : String(step.description),
      optional: Boolean(step.optional),
      disabled: Boolean(step.disabled)
    };
  });
}

/**
 * Returns the index of a step by name.
 * @param {NormalizedStep[]} steps Normalized steps.
 * @param {string|null} name Step name.
 * @returns {number} Zero-based index, or -1 when the name is unknown or null.
 */
export function stepIndex(steps, name) {
  if (name === null) return -1;
  return steps.findIndex((step) => step.name === name);
}

/**
 * Resolves the next enabled step in a direction, skipping disabled steps. Starting from -1 walks
 * in from the matching end, so `resolveStepIndex(steps, -1, 1)` is the first enabled step.
 * @param {NormalizedStep[]} steps Normalized steps.
 * @param {number} from Zero-based index to start from, or -1 for "outside the list".
 * @param {number} direction Positive to move forward, negative to move backward.
 * @returns {number} Zero-based index, or -1 when no enabled step lies that way.
 */
export function resolveStepIndex(steps, from, direction) {
  const step = direction < 0 ? -1 : 1;
  let cursor = from < 0 ? (step > 0 ? 0 : steps.length - 1) : from + step;
  while (cursor >= 0 && cursor < steps.length) {
    if (!steps[cursor].disabled) return cursor;
    cursor += step;
  }
  return -1;
}

/**
 * Names of the steps a move marks complete. Advancing past a step completes it — including every
 * step skipped over by a jump — while moving backwards completes nothing, so a user can walk back
 * through a wizard without erasing their progress.
 * @param {NormalizedStep[]} steps Normalized steps.
 * @param {number} from Zero-based index being left, or -1 when nothing was active.
 * @param {number} to Zero-based index being activated.
 * @returns {string[]} Names to add to the completed set, in step order.
 */
export function completedByAdvance(steps, from, to) {
  if (from < 0 || to <= from) return [];
  return steps.slice(from, to).map((step) => step.name);
}

/**
 * @typedef {Object} StepStateContext
 * @property {number} [activeIndex=-1] Zero-based active index, or -1 when nothing is active.
 * @property {Set<string>|string[]} [completed] Completed step names.
 * @property {Set<string>|string[]} [errored] Errored step names.
 */

/**
 * Resolves the rendered state of one step. Errors win over everything, so a step the user has to
 * come back and fix stays visible as a problem even while it is the active one; being active in
 * turn wins over being complete, because where the user stands matters more than where they have
 * already been.
 * @param {NormalizedStep} step Normalized step.
 * @param {number} index Zero-based index of the step.
 * @param {StepStateContext} [context={}] Rail state.
 * @returns {'upcoming'|'active'|'complete'|'error'}
 */
export function stepState(step, index, context = {}) {
  const { activeIndex = -1, completed, errored } = context;
  if (contains(errored, step.name)) return 'error';
  if (index === activeIndex) return 'active';
  if (contains(completed, step.name)) return 'complete';
  return 'upcoming';
}

/**
 * @param {Set<string>|string[]|undefined|null} source Set or array of names.
 * @param {string} name Name to look for.
 * @returns {boolean}
 */
function contains(source, name) {
  if (!source) return false;
  return source instanceof Set ? source.has(name) : source.includes(name);
}
