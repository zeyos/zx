// @ts-check
import { viewRecordId } from '../view/record-view.js';

/** @typedef {Record<string, any>} KanbanRecord */
/** @typedef {import('./kanban-view.js').KanbanColumn} KanbanColumn */
/** @typedef {import('./kanban-view.js').KanbanSwimlane} KanbanSwimlane */
/** @typedef {import('./kanban-view.js').KanbanMovePoint} KanbanMovePoint */
/** @typedef {import('./kanban-view.js').KanbanAccessor} KanbanAccessor */

/**
 * @typedef {Object} KanbanRule
 * @property {string} id Stable rule id, written to the card's `data-rule` list.
 * @property {(record: KanbanRecord, context: {index:number,column:string,lane:string|null}) => boolean} when
 * Predicate deciding whether the rule applies to one record.
 * @property {'neutral'|'accent'|'success'|'warning'|'danger'|'info'} [tone='accent'] Visual intent.
 * The first matching rule paints the card marker; later matches only contribute badges.
 * @property {string} [label=''] Badge text. A rule without a label is marker-only.
 * @property {string|null} [icon=null] Optional badge icon name.
 * @property {string} [description=''] Text joined into the card's accessible description so a
 * rule is never communicated by colour alone.
 */

/**
 * @typedef {Object} KanbanMoveEvaluation
 * @property {boolean} allowed Whether the move may proceed to the cancelable event.
 * @property {KanbanRejectReason|null} reason Refusal reason, or null when allowed.
 * @property {number|null} limit The limit the destination count was measured against.
 * @property {number} count Resulting record count in the constrained scope.
 * @property {boolean} limitExceeded Whether an applicable limit would be exceeded.
 * @property {boolean} limitReached Whether an applicable limit would be met exactly.
 * @property {'warn'|'block'} policy Effective work-in-progress policy.
 */

/**
 * @typedef {'accept'|'transition'|'wip'|'lane-accept'|'lane-transition'|'lane-wip'|'destination'|'grouping'} KanbanRejectReason
 */

/**
 * @typedef {Object} KanbanHistoryEntry
 * @property {KanbanRecord[]} records Record order before or after one committed move.
 * @property {unknown[]} selection Selected record ids at that moment.
 * @property {string} [label] Human-readable description of the step.
 */

/**
 * @typedef {Object} KanbanHistory
 * @property {(entry: KanbanHistoryEntry) => void} push Records a step and drops the redo stack.
 * @property {(current: KanbanHistoryEntry) => KanbanHistoryEntry|null} undo Steps back.
 * @property {(current: KanbanHistoryEntry) => KanbanHistoryEntry|null} redo Steps forward.
 * @property {() => boolean} canUndo Whether a step back exists.
 * @property {() => boolean} canRedo Whether a step forward exists.
 * @property {() => void} clear Empties both stacks.
 * @property {() => {undo:number,redo:number}} depth Current stack depths.
 */

/** Rule tones, in the order they are documented. */
const RULE_TONES = Object.freeze(['neutral', 'accent', 'success', 'warning', 'danger', 'info']);

/**
 * Validates and clones ordered card rules. Rules are pure presentation: they never change a
 * record, a move, or a policy decision.
 * @param {unknown} rules Configured rules.
 * @returns {KanbanRule[]} Normalized rules.
 */
export function normalizeKanbanRules(rules) {
  if (rules == null) return [];
  if (!Array.isArray(rules)) throw new TypeError('Kanban rules must be an array or null');
  const seen = new Set();
  return rules.map((rule, index) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      throw new TypeError(`Kanban rule at index ${index} must be an object`);
    }
    const source = /** @type {Record<string, any>} */ (rule);
    const id = String(source.id ?? '').trim();
    if (!id) throw new TypeError(`Kanban rule at index ${index} requires an id`);
    if (seen.has(id)) throw new TypeError(`Duplicate Kanban rule: ${id}`);
    if (typeof source.when !== 'function') {
      throw new TypeError(`Kanban rule ${id} requires a when predicate`);
    }
    seen.add(id);
    return {
      id,
      when: source.when,
      tone: RULE_TONES.includes(source.tone) ? source.tone : 'accent',
      label: source.label == null ? '' : String(source.label),
      icon: source.icon == null ? null : String(source.icon),
      description: source.description == null ? '' : String(source.description)
    };
  });
}

/**
 * Returns the rules matching one record, in configured order. A predicate that throws is treated
 * as "does not apply" so one broken rule cannot take the board down.
 * @param {KanbanRule[]} rules Normalized rules.
 * @param {KanbanRecord} record Record.
 * @param {{index:number,column:string,lane:string|null}} context Position context.
 * @returns {KanbanRule[]} Matching rules.
 */
export function resolveKanbanRules(rules, record, context) {
  if (!Array.isArray(rules) || !rules.length) return [];
  return rules.filter((rule) => {
    try {
      return rule.when(record, context) === true;
    } catch {
      return false;
    }
  });
}

/**
 * Decides whether a proposed move may proceed, and reports the work-in-progress consequence either
 * way. Checks run in a fixed order — transition, eligibility, then capacity — so a refusal always
 * names the first constraint the move violates rather than an arbitrary one.
 *
 * Counts exclude the moving records, so a reorder inside one column is measured against the column
 * it is already in rather than being told it doubles the load.
 *
 * @param {Object} input Evaluation input.
 * @param {KanbanRecord[]} input.records Records being moved together.
 * @param {KanbanColumn} input.column Destination column descriptor.
 * @param {KanbanSwimlane|null} input.swimlane Destination lane descriptor, or null.
 * @param {import('./kanban-view.js').KanbanMoveContext} input.context Context passed to `accept`.
 * @param {KanbanMovePoint} input.from Origin of the primary record.
 * @param {number} input.columnCount Records already in the destination column, movers excluded.
 * @param {number} input.laneCount Records already in the destination lane, movers excluded.
 * @param {number} input.cellCount Records already in the destination column and lane, movers excluded.
 * @param {'warn'|'block'} [input.policy='warn'] Board work-in-progress policy.
 * @returns {KanbanMoveEvaluation} Decision and capacity report.
 */
export function evaluateKanbanMove(input) {
  const { records, column, swimlane, context, from } = input;
  const moving = Math.max(1, records.length);
  const policy = column?.wipPolicy === 'block' || column?.wipPolicy === 'warn'
    ? column.wipPolicy : input.policy === 'block' ? 'block' : 'warn';
  /** @param {KanbanRejectReason} reason @param {Partial<KanbanMoveEvaluation>} [extra] @returns {KanbanMoveEvaluation} */
  const refuse = (reason, extra = {}) => ({
    allowed: false, reason, limit: null, count: 0,
    limitExceeded: false, limitReached: false, policy, ...extra
  });

  const blockedTransition = allowsKanbanTransition(column, swimlane, from);
  if (blockedTransition) return refuse(blockedTransition);
  for (const record of records) {
    if (column.accept && column.accept(record, context) === false) return refuse('accept');
    if (swimlane?.accept && swimlane.accept(record, context) === false) return refuse('lane-accept');
  }

  /** @type {{reason:KanbanRejectReason,limit:number,count:number}[]} */
  const capacities = [];
  if (column.limit != null) {
    capacities.push({ reason: 'wip', limit: column.limit, count: input.columnCount + moving });
  }
  const cellLimit = swimlane ? readLaneLimit(column.laneLimits, swimlane.id) : null;
  if (cellLimit != null) {
    capacities.push({ reason: 'wip', limit: cellLimit, count: input.cellCount + moving });
  }
  if (swimlane?.limit != null) {
    capacities.push({ reason: 'lane-wip', limit: swimlane.limit, count: input.laneCount + moving });
  }
  const violated = capacities.find((capacity) => capacity.count > capacity.limit);
  const reported = violated ?? capacities.find((capacity) => capacity.count === capacity.limit) ?? capacities[0];
  if (violated && policy === 'block') {
    return refuse(violated.reason, {
      limit: violated.limit, count: violated.count, limitExceeded: true
    });
  }
  return {
    allowed: true,
    reason: null,
    limit: reported ? reported.limit : null,
    count: reported ? reported.count : 0,
    limitExceeded: Boolean(violated),
    limitReached: Boolean(reported && !violated && reported.count === reported.limit),
    policy
  };
}

/**
 * Reports which transition allow-list, if any, refuses one origin. A move that stays on an axis is
 * never judged by that axis's rule: reordering inside a column is not a transition into it.
 * @param {KanbanColumn} column Destination column.
 * @param {KanbanSwimlane|null} swimlane Destination lane, or null.
 * @param {KanbanMovePoint} from Origin.
 * @returns {'transition'|'lane-transition'|null} Refusing rule, or null when the origin is admitted.
 */
export function allowsKanbanTransition(column, swimlane, from) {
  if (column.id !== from.column && !allowsOrigin(column.from, from.column)) return 'transition';
  if (swimlane && swimlane.id !== from.lane && !allowsOrigin(swimlane.from, from.lane)) {
    return 'lane-transition';
  }
  return null;
}

/**
 * Splits a search string into lowercase terms. Quoted groups stay together so `"needs review"`
 * matches a phrase rather than two independent words.
 * @param {unknown} search Raw search string.
 * @returns {string[]} Lowercase terms.
 */
export function kanbanSearchTerms(search) {
  const text = search == null ? '' : String(search).trim().toLowerCase();
  if (!text) return [];
  return [...text.matchAll(/"([^"]*)"|(\S+)/g)]
    .map((match) => (match[1] ?? match[2] ?? '').trim())
    .filter(Boolean);
}

/**
 * Reports whether searchable text contains every term.
 * @param {string} text Concatenated searchable text.
 * @param {string[]} terms Lowercase terms.
 * @returns {boolean} Whether the record matches.
 */
export function matchesKanbanSearch(text, terms) {
  if (!terms.length) return true;
  const haystack = text.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/**
 * Bounded undo/redo stack over whole record-order snapshots. Snapshots are shallow arrays of the
 * very record objects the board already holds, so a step costs one array rather than a deep clone;
 * this is safe precisely because a Kanban move clones the record it changes and never mutates one.
 * @param {number} [limit=50] Maximum remembered steps.
 * @returns {KanbanHistory} History controller.
 */
export function createKanbanHistory(limit = 50) {
  const max = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.floor(Number(limit)) : 50;
  /** @type {KanbanHistoryEntry[]} */
  let undoStack = [];
  /** @type {KanbanHistoryEntry[]} */
  let redoStack = [];
  return {
    push(entry) {
      undoStack.push(entry);
      if (undoStack.length > max) undoStack = undoStack.slice(-max);
      redoStack = [];
    },
    undo(current) {
      const entry = undoStack.pop();
      if (!entry) return null;
      redoStack.push(current);
      if (redoStack.length > max) redoStack = redoStack.slice(-max);
      return entry;
    },
    redo(current) {
      const entry = redoStack.pop();
      if (!entry) return null;
      undoStack.push(current);
      if (undoStack.length > max) undoStack = undoStack.slice(-max);
      return entry;
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    clear() {
      undoStack = [];
      redoStack = [];
    },
    depth: () => ({ undo: undoStack.length, redo: redoStack.length })
  };
}

/**
 * Reorders records around one or more already-cloned moved records. The input array and every
 * input record remain untouched. Movers keep their relative order and land contiguously, so a
 * multi-card move reads on the board exactly as it read before it was picked up.
 *
 * The destination index is relative to the records remaining in the destination column and lane
 * after the movers are lifted out — the same frame of reference a user sees while dragging.
 *
 * @param {KanbanRecord[]} records Current records.
 * @param {{id:unknown,record:KanbanRecord}[]} entries Moving ids paired with their cloned records.
 * @param {{recordId:string|((record:KanbanRecord)=>unknown),columnBy:KanbanAccessor,swimlaneBy:KanbanAccessor,destination:KanbanMovePoint}} options Accessors and destination.
 * @returns {{records:KanbanRecord[],moves:{id:unknown,from:KanbanMovePoint}[],to:KanbanMovePoint}|null}
 */
export function reorderKanbanRecords(records, entries, options) {
  if (!Array.isArray(records) || !Array.isArray(entries) || !entries.length) return null;
  const sources = entries.map((entry) => ({
    ...entry,
    index: records.findIndex((record) => Object.is(viewRecordId(record, options.recordId), entry.id))
  }));
  if (sources.some((source) => source.index < 0 || !source.record || typeof source.record !== 'object')) {
    return null;
  }
  sources.sort((left, right) => left.index - right.index);

  const moves = sources.map((source) => ({
    id: source.id,
    from: locateKanbanRecord(records, source.index, options)
  }));
  const movingIndices = new Set(sources.map((source) => source.index));
  const next = records.filter((_, index) => !movingIndices.has(index));
  const destinationRecords = next.filter((record, index) =>
    normalizeAxisId(readKanbanAccessor(record, index, options.columnBy)) === options.destination.column
    && (options.swimlaneBy == null
      || normalizeAxisId(readKanbanAccessor(record, index, options.swimlaneBy)) === options.destination.lane));
  const targetIndex = clampKanbanIndex(options.destination.index, destinationRecords.length);
  let insertion = next.length;
  if (destinationRecords[targetIndex]) insertion = next.indexOf(destinationRecords[targetIndex]);
  else if (destinationRecords.length) insertion = next.indexOf(destinationRecords.at(-1)) + 1;
  next.splice(insertion, 0, ...sources.map((source) => source.record));
  return {
    records: next,
    moves,
    to: {
      column: options.destination.column,
      lane: options.swimlaneBy == null ? null : options.destination.lane,
      index: targetIndex
    }
  };
}

/**
 * Resolves one record's column, lane, and position within its bucket.
 * @param {KanbanRecord[]} records Records.
 * @param {number} index Position in `records`.
 * @param {{recordId:string|((record:KanbanRecord)=>unknown),columnBy:KanbanAccessor,swimlaneBy:KanbanAccessor}} options Accessors.
 * @returns {KanbanMovePoint} Location.
 */
export function locateKanbanRecord(records, index, options) {
  const record = records[index];
  const column = normalizeAxisId(readKanbanAccessor(record, index, options.columnBy));
  const lane = options.swimlaneBy == null ? null
    : normalizeAxisId(readKanbanAccessor(record, index, options.swimlaneBy));
  const group = records.filter((candidate, candidateIndex) =>
    normalizeAxisId(readKanbanAccessor(candidate, candidateIndex, options.columnBy)) === column
    && (options.swimlaneBy == null
      || normalizeAxisId(readKanbanAccessor(candidate, candidateIndex, options.swimlaneBy)) === lane));
  const id = viewRecordId(record, options.recordId);
  return {
    column, lane,
    index: group.findIndex((candidate) => Object.is(viewRecordId(candidate, options.recordId), id))
  };
}

/**
 * Translates a position among *rendered* cards into a position among all records in the same
 * column and lane. Search and filters hide records without removing them, and a drop between two
 * visible cards must land between them in the underlying data rather than at the same ordinal.
 * @param {boolean[]} visibility Per-record visibility inside the bucket, in record order.
 * @param {number} visibleIndex Zero-based position among the visible records.
 * @returns {number} Zero-based position among all records in the bucket.
 */
export function absoluteKanbanIndex(visibility, visibleIndex) {
  const target = clampKanbanIndex(visibleIndex, visibility.filter(Boolean).length);
  let seen = 0;
  for (let index = 0; index < visibility.length; index += 1) {
    if (!visibility[index]) continue;
    if (seen === target) return index;
    seen += 1;
  }
  return visibility.length;
}

/**
 * Reads a grouping accessor without touching field descriptors.
 * @param {KanbanRecord} record Record.
 * @param {number} index Display index.
 * @param {KanbanAccessor} accessor Accessor.
 * @returns {unknown} Raw value.
 */
export function readKanbanAccessor(record, index, accessor) {
  return typeof accessor === 'function' ? accessor(record, index) : accessor == null ? null : record?.[accessor];
}

/**
 * Normalizes any grouping value to its stable string id.
 * @param {unknown} value Raw value.
 * @returns {string} Axis id.
 */
export function normalizeAxisId(value) {
  return value == null ? '' : String(value);
}

/**
 * Clamps a requested position into an insertable range, treating anything unusable as "append".
 * @param {unknown} value Requested index.
 * @param {number} maximum Highest insertable position.
 * @returns {number} Clamped index.
 */
export function clampKanbanIndex(value, maximum) {
  if (value == null || !Number.isFinite(Number(value))) return maximum;
  return Math.max(0, Math.min(maximum, Math.trunc(Number(value))));
}

/**
 * Reports whether a transition allow-list admits an origin.
 * @param {unknown} allowed Allow-list, `null`/absent for any origin.
 * @param {string|null} origin Origin id.
 * @returns {boolean} Whether the origin is admitted.
 */
function allowsOrigin(allowed, origin) {
  if (allowed == null) return true;
  if (!Array.isArray(allowed)) return true;
  if (!allowed.length) return false;
  return allowed.some((entry) => String(entry) === '*' || String(entry) === normalizeAxisId(origin));
}

/**
 * Reads one lane's limit inside a column.
 * @param {unknown} laneLimits Lane limit map.
 * @param {string} lane Lane id.
 * @returns {number|null} Limit, or null when unconstrained.
 */
function readLaneLimit(laneLimits, lane) {
  if (!laneLimits || typeof laneLimits !== 'object') return null;
  const value = /** @type {Record<string, unknown>} */ (laneLimits)[lane];
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}
