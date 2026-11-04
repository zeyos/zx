// @ts-check
/**
 * The surface catalog: every intent and node a surface may use, and what is generated from it.
 *
 * The catalog is curated by hand. `surfaceSchema()`, `surfaceTools()` and `surfacePrompt()` turn it
 * — or a catalog narrowed by `narrowCatalog()` — into the JSON Schema of the format, function-
 * calling tool definitions and the guide a model reads, so a model is told exactly what will
 * render. The module imports nothing that touches the DOM: a server can import it directly to
 * build the same tools and prompt it hands to its model.
 */
import { CONDITION_OPS, MAX_CONDITION_DEPTH, RULE_FORMATS } from '../questionnaire/conditions.js';
import { FIELD_TYPES, MAX_SCHEMA_CHOICES, MAX_SCHEMA_PROPERTIES, SCHEMA_FORMATS } from './schema.js';

/** The version a `begin` operation and a document carry. */
export const SURFACE_VERSION = 'surface/1';

/** The version every reply carries. */
export const REPLY_VERSION = 'reply/1';

/** The limits of one surface. Anything over a limit is dropped and reported. */
export const LIMITS = Object.freeze({
  /** Nodes per surface. */
  nodes: 400,
  /** Depth of the node tree, counting the root's children as 1. */
  depth: 12,
  /** Characters per string. */
  string: 20000,
  /** Rows per table or diff, and entries per list or other array. */
  rows: 1000,
  /** Input schema properties per surface. */
  fields: MAX_SCHEMA_PROPERTIES,
  /** Choices per choice node or schema property. */
  choices: MAX_SCHEMA_CHOICES,
  /** Actions per surface. */
  actions: 8,
  /** Characters of the surface's data, written as JSON. */
  data: 1000000,
  /** Nesting of a `visible`, `when` or `if` condition. */
  condition: MAX_CONDITION_DEPTH,
  /** Nesting of any JSON value inside one operation, counting the operation as 1. */
  value: 32,
  /** Columns per table. */
  columns: 50,
  /** Table cells across all tables of a surface; a `$data` binding counts each time it is used. */
  cells: 100000,
  /** Datasets per chart. */
  datasets: 12,
  /** Steps per questionnaire. */
  steps: 50,
  /** Sources per surface. */
  sources: 50,
  /** Characters of a title, label or other short text. */
  label: 200,
  /** Characters of a description. */
  description: 2000,
  /** Characters of an id, a name, an author or a tool. */
  name: 64,
  /** Characters of a link address. */
  href: 2000
});

/** The six intents, in the order the guide presents them. */
export const INTENTS = Object.freeze(/** @type {SurfaceIntent[]} */ (['show', 'ask', 'choose', 'confirm', 'review', 'questionnaire']));

/** Where a surface asks to be placed. */
export const PLACEMENTS = Object.freeze(/** @type {SurfacePlacement[]} */ (['inline', 'sheet', 'dialog']));

/** Action ids kept for closing a surface. An action of the surface's own cannot use them. */
export const RESERVED_ACTIONS = Object.freeze(['cancel', 'dismiss']);

/** What an id looks like: a node, an action, a row or a surface. Never `constructor` or `prototype`. */
export const ID_PATTERN = '^(?!(?:constructor|prototype)$)[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$';

/**
 * What an input name, a column id, a row key or a step name looks like: it becomes a key of the
 * reply's `values` or of a row, so `__proto__`, `constructor` and `prototype` are excluded.
 */
export const NAME_PATTERN = '^(?!(?:__proto__|constructor|prototype)$)[A-Za-z_][A-Za-z0-9_.-]{0,63}$';

/** Invisible format characters (Unicode `Cf`) in the Basic Multilingual Plane, as a class body. */
const CF_BMP = '\\u00AD\\u0600-\\u0605\\u061C\\u06DD\\u070F\\u0890\\u0891\\u08E2\\u180E\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u206F\\uFEFF\\uFFF9-\\uFFFB';

/** The format characters beyond it, written as surrogate pairs so a pattern reads the same with or without the `u` flag. */
const CF_ASTRAL = [[0x110BD, 0x110BD], [0x110CD, 0x110CD], [0x13430, 0x1343F], [0x1BCA0, 0x1BCA3], [0x1D173, 0x1D17A], [0xE0001, 0xE0001], [0xE0020, 0xE007F]]
  .flatMap(([from, to]) => Array.from({ length: to - from + 1 }, (_, offset) => {
    const text = String.fromCodePoint(from + offset);
    return [...Array(text.length).keys()].map((index) => `\\u${text.charCodeAt(index).toString(16).toUpperCase().padStart(4, '0')}`).join('');
  }))
  .join('|');

/**
 * What a link address looks like: `https://` in lower case, a host without credentials, and no
 * whitespace, control, backslash or invisible format characters anywhere. The validator applies
 * the same pattern, then parses the address.
 */
export const HREF_PATTERN = `^(?!.*(?:${CF_ASTRAL}))https://[^\\s/?#@\\\\\\u0000-\\u001F\\u007F${CF_BMP}]+(?:[/?#][^\\s\\\\\\u0000-\\u001F\\u007F${CF_BMP}]*)?$`;

/** What an icon name looks like. */
export const ICON_PATTERN = '^[a-z0-9][a-z0-9-]{0,39}$';

/** Keys refused anywhere, at any depth. */
export const FORBIDDEN_KEYS = Object.freeze(['__proto__', 'constructor', 'prototype']);

/** @typedef {'show'|'ask'|'choose'|'confirm'|'review'|'questionnaire'} SurfaceIntent */
/** @typedef {'inline'|'sheet'|'dialog'} SurfacePlacement */

/**
 * The value types a catalog property may have. Named types are described by the JSON Schema
 * `$defs` of the same name.
 * @typedef {'string'|'integer'|'number'|'boolean'|'number|string'|'string[]'|'Href'|'Ref'|'Column[]'|'Row[]'|'Figure[]'|'ChartData'|'Choice[]'|'DiffRow[]'|'Schema'|'Step[]'} CatalogType
 */

/**
 * One property of a node.
 * @typedef {Object} CatalogProp
 * @property {CatalogType} type What the value is.
 * @property {ReadonlyArray<string|number>} [enum] The values allowed.
 * @property {number} [max] Most characters of a string, or entries of a list.
 * @property {boolean} [required] Whether the node needs it to render.
 * @property {string|null} option The component option the property maps to: an option name, or
 *   `<option>[].<member>` for a member of a list option's entries. `null` when the surface itself
 *   consumes it (an input's `name`, a link's text and address).
 */

/**
 * One node type. `visible` is common to every node and not listed in `props`.
 * @typedef {Object} CatalogNode
 * @property {string} type The node type.
 * @property {string|null} component The component that draws it, as `docs/api.json` names it;
 *   `null` for a node the surface draws itself.
 * @property {SurfaceIntent} [intentOnly] The one intent the node may appear in.
 * @property {boolean} children Whether it lays out `children`.
 * @property {boolean} input Whether its value lands in the reply's `values`.
 * @property {Readonly<Record<string, CatalogProp>>} props Its properties.
 */

/**
 * One intent: the frame, default actions and reply shape of a surface.
 * @typedef {Object} CatalogIntent
 * @property {SurfaceIntent} intent The intent.
 * @property {ReadonlyArray<string>} requires Node types of which the surface needs at least one;
 *   empty when it needs none.
 * @property {ReadonlyArray<string>} actions The default actions, by label.
 * @property {string} reply What the reply's `values` hold.
 */

/**
 * The catalog, or a narrowed one.
 * @typedef {Object} SurfaceCatalog
 * @property {string} version The format version, `surface/1`.
 * @property {Readonly<Partial<Record<SurfaceIntent, CatalogIntent>>>} intents The intents.
 * @property {Readonly<Record<string, CatalogNode>>} nodes The node types.
 */

/** @param {CatalogType} type @param {Partial<CatalogProp>} [rest] @returns {CatalogProp} */
const prop = (type, rest = {}) => ({ type, option: null, ...rest });

const TONES = ['info', 'success', 'warning', 'danger'];

/** @type {Record<string, CatalogNode>} */
const NODES = {
  text: {
    type: 'text', component: 'BlockView', children: false, input: false,
    props: { text: prop('string', { required: true, max: LIMITS.string, option: 'blocks[].text' }) }
  },
  heading: {
    type: 'heading', component: 'BlockView', children: false, input: false,
    props: {
      text: prop('string', { required: true, max: LIMITS.label, option: 'blocks[].text' }),
      level: prop('integer', { enum: [2, 3], option: 'blocks[].level' })
    }
  },
  list: {
    type: 'list', component: 'BlockView', children: false, input: false,
    props: {
      items: prop('string[]', { required: true, max: LIMITS.rows, option: 'blocks[].items' }),
      ordered: prop('boolean', { option: 'blocks[].ordered' })
    }
  },
  quote: {
    type: 'quote', component: 'BlockView', children: false, input: false,
    props: { text: prop('string', { required: true, max: LIMITS.string, option: 'blocks[].text' }) }
  },
  code: {
    type: 'code', component: 'BlockView', children: false, input: false,
    props: {
      code: prop('string', { required: true, max: LIMITS.string, option: 'blocks[].code' }),
      language: prop('string', { max: 32, option: 'blocks[].language' })
    }
  },
  callout: {
    type: 'callout', component: 'BlockView', children: false, input: false,
    props: {
      text: prop('string', { required: true, max: LIMITS.string, option: 'blocks[].text' }),
      title: prop('string', { max: LIMITS.label, option: 'blocks[].title' }),
      tone: prop('string', { enum: TONES, option: 'blocks[].tone' })
    }
  },
  figures: {
    type: 'figures', component: 'BlockView', children: false, input: false,
    props: { rows: prop('Figure[]', { required: true, max: LIMITS.rows, option: 'blocks[].rows' }) }
  },
  table: {
    type: 'table', component: 'Table', children: false, input: true,
    props: {
      columns: prop('Column[]', { required: true, max: LIMITS.columns, option: 'columns' }),
      rows: prop('Row[]', { required: true, max: LIMITS.rows, option: 'data' }),
      rowId: prop('string', { max: LIMITS.name, option: 'rowId' }),
      selectable: prop('string', { enum: ['single', 'multi'], option: 'selectable' }),
      name: prop('string', { max: LIMITS.name }),
      label: prop('string', { max: LIMITS.label, option: 'label' })
    }
  },
  stat: {
    type: 'stat', component: 'StatTile', children: false, input: false,
    props: {
      label: prop('string', { required: true, max: LIMITS.label, option: 'label' }),
      value: prop('number|string', { required: true, max: LIMITS.label, option: 'value' }),
      format: prop('string', { enum: ['number', 'currency', 'percent'], option: 'format' }),
      currency: prop('string', { max: 3, option: 'currency' }),
      delta: prop('number|string', { max: LIMITS.label, option: 'delta' }),
      caption: prop('string', { max: LIMITS.label, option: 'caption' })
    }
  },
  badge: {
    type: 'badge', component: 'Badge', children: false, input: false,
    props: {
      label: prop('string', { required: true, max: LIMITS.name, option: 'label' }),
      kind: prop('string', { enum: ['neutral', 'accent', 'success', 'warning', 'danger', 'info'], option: 'kind' })
    }
  },
  ref: {
    type: 'ref', component: 'EntityRef', children: false, input: false,
    props: { ref: prop('Ref', { required: true, option: 'id' }) }
  },
  link: {
    type: 'link', component: null, children: false, input: false,
    props: {
      text: prop('string', { required: true, max: LIMITS.label }),
      href: prop('Href', { required: true, max: LIMITS.href })
    }
  },
  chart: {
    type: 'chart', component: 'Chart', children: false, input: false,
    props: {
      kind: prop('string', { required: true, enum: ['bar', 'line', 'pie', 'doughnut'], option: 'type' }),
      data: prop('ChartData', { required: true, option: 'data' }),
      label: prop('string', { required: true, max: LIMITS.label, option: 'label' }),
      description: prop('string', { max: LIMITS.description, option: 'description' })
    }
  },
  empty: {
    type: 'empty', component: 'EmptyState', children: false, input: false,
    props: {
      title: prop('string', { required: true, max: LIMITS.label, option: 'title' }),
      description: prop('string', { max: LIMITS.description, option: 'description' })
    }
  },
  stack: {
    type: 'stack', component: 'Stack', children: true, input: false,
    props: { gap: prop('string', { enum: ['sm', 'md', 'lg'], option: 'gap' }) }
  },
  columns: {
    type: 'columns', component: 'LayoutGrid', children: true, input: false,
    props: { count: prop('integer', { enum: [1, 2, 3], option: 'columns' }) }
  },
  group: {
    type: 'group', component: 'Groupbox', children: true, input: false,
    props: { title: prop('string', { required: true, max: LIMITS.label, option: 'title' }) }
  },
  fields: {
    type: 'fields', component: 'Fieldset', children: false, input: true,
    props: {
      schema: prop('Schema', { required: true, option: 'fields' }),
      title: prop('string', { max: LIMITS.label, option: 'title' })
    }
  },
  choice: {
    type: 'choice', component: 'Questionnaire', children: false, input: true,
    props: {
      name: prop('string', { required: true, max: LIMITS.name }),
      label: prop('string', { required: true, max: LIMITS.label, option: 'items[].prompt' }),
      choices: prop('Choice[]', { required: true, max: LIMITS.choices, option: 'items[].choices' }),
      multiple: prop('boolean', { option: 'items[].multiple' })
    }
  },
  diff: {
    type: 'diff', component: 'Table', intentOnly: 'review', children: false, input: true,
    props: {
      name: prop('string', { required: true, max: LIMITS.name }),
      rows: prop('DiffRow[]', { required: true, max: LIMITS.rows, option: 'data' }),
      label: prop('string', { max: LIMITS.label, option: 'label' })
    }
  },
  questionnaire: {
    type: 'questionnaire', component: 'Questionnaire', intentOnly: 'questionnaire', children: false, input: true,
    props: {
      steps: prop('Step[]', { required: true, max: LIMITS.steps, option: 'items' }),
      review: prop('boolean', { option: 'review' })
    }
  }
};

/** @type {Record<SurfaceIntent, CatalogIntent>} */
const INTENT_ENTRIES = {
  show: { intent: 'show', requires: [], actions: [], reply: 'No values. Actions are optional; closing the surface replies `dismiss`.' },
  ask: { intent: 'ask', requires: ['fields'], actions: ['Submit', 'Cancel'], reply: 'The values of its inputs, by name.' },
  choose: { intent: 'choose', requires: ['choice'], actions: ['Submit', 'Cancel'], reply: 'The picked value under the choice\'s name; a list when `multiple`.' },
  confirm: { intent: 'confirm', requires: [], actions: ['Confirm', 'Cancel'], reply: '`{}`. The application may ask the person to type a confirmation.' },
  review: { intent: 'review', requires: ['diff', 'table'], actions: ['Approve selected', 'Reject'], reply: 'The ids of the accepted diff rows or selected table rows, under the input\'s name.' },
  questionnaire: { intent: 'questionnaire', requires: ['questionnaire'], actions: ['Cancel'], reply: '`{answers, path}`: the answers by step name and the steps taken.' }
};

/**
 * The full catalog. Frozen; narrow it with `narrowCatalog()`.
 * @type {SurfaceCatalog}
 */
export const CATALOG = deepFreeze({
  version: SURFACE_VERSION,
  intents: INTENT_ENTRIES,
  nodes: NODES
});

/**
 * Returns a catalog limited to some intents and node types. It can only narrow: a name the
 * catalog does not have is refused, and so is an intent whose required node would be removed
 * (`ask` without `fields`, `choose` without `choice`, `review` without `diff` or `table`,
 * `questionnaire` without `questionnaire`). A node that belongs to one intent leaves with it.
 * @param {SurfaceCatalog} catalog The catalog to narrow: `CATALOG` or an already narrowed one.
 * @param {{intents?: SurfaceIntent[], nodes?: string[]}} [options] What to keep; all when left out.
 * @returns {SurfaceCatalog} A new frozen catalog.
 * @throws {TypeError} For an unknown name, an intent left without its required node, or a
 *   catalog that is not the library's.
 */
export function narrowCatalog(catalog, options = {}) {
  assertCatalog(catalog);
  const intents = options.intents ?? /** @type {SurfaceIntent[]} */ (Object.keys(catalog.intents));
  const nodes = options.nodes ?? Object.keys(catalog.nodes);
  if (!Array.isArray(intents) || !Array.isArray(nodes)) throw new TypeError('"intents" and "nodes" must be lists of names');
  for (const name of intents) {
    if (typeof name !== 'string' || !Object.hasOwn(catalog.intents, name)) throw new TypeError(`Unknown intent: ${String(name)}`);
  }
  for (const name of nodes) {
    if (typeof name !== 'string' || !Object.hasOwn(catalog.nodes, name)) throw new TypeError(`Unknown node type: ${String(name)}`);
  }
  const keptIntents = new Set(intents);
  const keptNodes = nodes.filter((name) => {
    const only = catalog.nodes[name].intentOnly;
    return !only || keptIntents.has(only);
  });
  if (!keptNodes.length) throw new TypeError('A catalog keeps at least one node type');
  if (!intents.length) throw new TypeError('A catalog keeps at least one intent');
  for (const name of intents) {
    const entry = /** @type {CatalogIntent} */ (catalog.intents[name]);
    if (entry.requires.length && !entry.requires.some((type) => keptNodes.includes(type))) {
      throw new TypeError(`The intent "${name}" needs a ${entry.requires.join(' or ')} node`);
    }
  }
  /** @type {Record<string, CatalogIntent>} */
  const keptIntentEntries = {};
  for (const name of INTENTS) if (keptIntents.has(name)) keptIntentEntries[name] = /** @type {CatalogIntent} */ (catalog.intents[name]);
  /** @type {Record<string, CatalogNode>} */
  const keptNodeEntries = {};
  for (const name of Object.keys(CATALOG.nodes)) if (keptNodes.includes(name)) keptNodeEntries[name] = catalog.nodes[name];
  return Object.freeze({
    version: SURFACE_VERSION,
    intents: Object.freeze(keptIntentEntries),
    nodes: Object.freeze(keptNodeEntries)
  });
}

/**
 * Throws unless the catalog is the library's, or narrowed from it: every intent and node entry
 * must be the library's own frozen entry, so a catalog cannot be widened by building one by hand.
 * @param {unknown} catalog
 * @returns {asserts catalog is SurfaceCatalog}
 * @throws {TypeError} When the catalog is not the library's.
 */
export function assertCatalog(catalog) {
  if (!isObject(catalog) || catalog.version !== SURFACE_VERSION || !isObject(catalog.intents) || !isObject(catalog.nodes)) {
    throw new TypeError('Not a surface catalog');
  }
  for (const [name, entry] of Object.entries(catalog.intents)) {
    if (/** @type {Record<string, unknown>} */ (CATALOG.intents)[name] !== entry) throw new TypeError(`The catalog's intent "${name}" is not the library's`);
  }
  for (const [name, entry] of Object.entries(catalog.nodes)) {
    if (CATALOG.nodes[name] !== entry) throw new TypeError(`The catalog's node "${name}" is not the library's`);
  }
}

/* ------------------------------------------------------------------------------------------------
 * JSON Schema
 * --------------------------------------------------------------------------------------------- */

/** The JSON Schema dialect of everything generated here. */
const DIALECT = 'https://json-schema.org/draft/2020-12/schema';

/**
 * Two profiles share one generator. `full` is the format as a validator reads it: limits,
 * patterns, data and bindings. `strict` is what providers' strict structured output accepts:
 * every object closed and every key required (optional ones nullable), no recursion, no length or
 * range constraints, maps written as lists, and no data or bindings.
 * @typedef {'full'|'strict'} Profile
 */

/**
 * @typedef {Record<string, any>} JsonSchema
 */

/**
 * Builds the `$defs` and node schemas of one profile for a catalog.
 * @param {SurfaceCatalog} catalog @param {Profile} profile
 */
function schemaKit(catalog, profile) {
  const strict = profile === 'strict';
  /** @type {Record<string, JsonSchema>} */
  const defs = {};
  /** @param {string} name @returns {JsonSchema} */
  const ref = (name) => ({ $ref: `#/$defs/${name}` });
  /** @param {JsonSchema} schema @returns {JsonSchema} */
  const nullable = (schema) => (strict ? { anyOf: [schema, { type: 'null' }] } : schema);
  /**
   * @param {number} [max] @param {string} [pattern]
   * @returns {JsonSchema}
   */
  const string = (max, pattern) => {
    /** @type {JsonSchema} */
    const schema = { type: 'string' };
    if (!strict && pattern) schema.pattern = pattern;
    if (!strict && max) schema.maxLength = max;
    return schema;
  };
  /**
   * @param {JsonSchema} items @param {number} [max] @param {number} [min=0]
   * @returns {JsonSchema}
   */
  const list = (items, max, min = 0) => {
    /** @type {JsonSchema} */
    const schema = { type: 'array', items };
    if (!strict && min) schema.minItems = min;
    if (!strict && max) schema.maxItems = max;
    return schema;
  };
  /**
   * @param {number} [min] @param {number} [max]
   * @returns {JsonSchema}
   */
  const integer = (min, max) => {
    /** @type {JsonSchema} */
    const schema = { type: 'integer' };
    if (!strict && min !== undefined) schema.minimum = min;
    if (!strict && max !== undefined) schema.maximum = max;
    return schema;
  };
  /**
   * A closed object. In the strict profile every key is required and the optional ones accept
   * null.
   * @param {Record<string, JsonSchema>} properties @param {string[]} required
   * @returns {JsonSchema}
   */
  const object = (properties, required) => {
    if (!strict) return { type: 'object', properties, required, additionalProperties: false };
    /** @type {Record<string, JsonSchema>} */
    const all = {};
    for (const [key, schema] of Object.entries(properties)) all[key] = required.includes(key) ? schema : nullable(schema);
    return { type: 'object', properties: all, required: Object.keys(properties), additionalProperties: false };
  };
  const notForbidden = { not: { enum: [...FORBIDDEN_KEYS] } };
  const scalar = { anyOf: [string(LIMITS.string), { type: 'number' }, { type: 'boolean' }, { type: 'null' }] };

  defs.Id = string(LIMITS.name, ID_PATTERN);
  defs.Name = string(LIMITS.name, NAME_PATTERN);
  defs.Scalar = scalar;
  defs.Ref = object({ $ref: string(LIMITS.name, NAME_PATTERN), id: string(LIMITS.label) }, ['$ref', 'id']);
  defs.Cell = { anyOf: [string(LIMITS.string), { type: 'number' }, { type: 'boolean' }, { type: 'null' }, ref('Ref')] };

  // Conditions are unrolled to their four levels rather than recursive, which both bounds them
  // and keeps the strict profile free of recursion.
  defs.Condition1 = object({
    field: ref('Name'),
    op: { type: 'string', enum: [...CONDITION_OPS] },
    value: { anyOf: [string(LIMITS.label), { type: 'number' }, { type: 'boolean' }, { type: 'null' }, list(scalar, LIMITS.choices, 1)] }
  }, ['field', 'op']);
  for (let level = 2; level <= MAX_CONDITION_DEPTH; level += 1) {
    const inner = ref(`Condition${level - 1}`);
    defs[`Condition${level}`] = {
      anyOf: [
        ref('Condition1'),
        object({ all: list(inner, 0, 1) }, ['all']),
        object({ any: list(inner, 0, 1) }, ['any']),
        object({ not: inner }, ['not'])
      ]
    };
  }
  defs.Condition = ref(`Condition${MAX_CONDITION_DEPTH}`);

  defs.Column = object({
    id: ref('Name'),
    label: string(LIMITS.label),
    align: { type: 'string', enum: ['start', 'center', 'end'] },
    format: { type: 'string', enum: ['text', 'number', 'currency', 'percent', 'date'] },
    currency: string(3)
  }, ['id', 'label']);
  defs.Row = strict
    ? list(ref('Cell'), LIMITS.columns)
    : {
      anyOf: [
        { type: 'object', propertyNames: { ...notForbidden, pattern: NAME_PATTERN }, additionalProperties: ref('Cell'), maxProperties: LIMITS.columns },
        list(ref('Cell'), LIMITS.columns)
      ]
    };
  defs.Figure = object({ label: string(LIMITS.label), detail: string(LIMITS.label), value: string(LIMITS.label) }, ['label', 'value']);
  defs.ChartData = object({
    labels: list({ anyOf: [string(LIMITS.label), { type: 'number' }] }, LIMITS.rows),
    datasets: list(object({
      label: string(LIMITS.label),
      data: list({ anyOf: [{ type: 'number' }, { type: 'null' }] }, LIMITS.rows)
    }, ['label', 'data']), LIMITS.datasets, 1)
  }, ['labels', 'datasets']);
  defs.Choice = object({
    value: string(LIMITS.label),
    label: string(LIMITS.label),
    description: string(LIMITS.description),
    icon: string(40, ICON_PATTERN)
  }, ['value', 'label']);
  defs.DiffRow = object({
    id: ref('Id'),
    field: ref('Name'),
    label: string(LIMITS.label),
    before: ref('Scalar'),
    after: ref('Scalar'),
    ref: ref('Ref')
  }, ['id', 'field', 'label', 'before', 'after']);

  const choiceList = list(object({ const: string(LIMITS.label), title: string(LIMITS.label) }, ['const', 'title']), LIMITS.choices, 1);
  const allFieldTypes = [...new Set(Object.values(FIELD_TYPES).flat())];
  /** @type {Record<string, JsonSchema>} */
  const propertyMembers = {
    type: { type: 'string', enum: ['string', 'number', 'integer', 'boolean', 'array'] },
    title: string(LIMITS.label),
    description: string(LIMITS.description),
    default: { anyOf: [string(LIMITS.string), { type: 'number' }, { type: 'boolean' }, list(string(LIMITS.label), LIMITS.choices)] },
    enum: list(string(LIMITS.label), LIMITS.choices, 1),
    oneOf: choiceList,
    format: { type: 'string', enum: [...SCHEMA_FORMATS] },
    minimum: { type: 'number' },
    maximum: { type: 'number' },
    minLength: integer(0),
    maxLength: integer(0),
    items: object({ type: { type: 'string', enum: ['string'] }, enum: list(string(LIMITS.label), LIMITS.choices, 1), anyOf: choiceList }, []),
    minItems: integer(0),
    maxItems: integer(0),
    'x-zx': object({ field: { type: 'string', enum: allFieldTypes }, visible: ref('Condition') }, [])
  };
  defs.Property = object(propertyMembers, ['type']);
  defs.NamedProperty = object({ name: ref('Name'), ...propertyMembers }, ['name', 'type']);
  defs.Schema = object({
    type: { type: 'string', enum: ['object'] },
    properties: strict
      ? list(ref('NamedProperty'), MAX_SCHEMA_PROPERTIES)
      : {
        anyOf: [
          { type: 'object', propertyNames: { ...notForbidden, pattern: NAME_PATTERN }, additionalProperties: ref('Property'), maxProperties: MAX_SCHEMA_PROPERTIES },
          list(ref('NamedProperty'), MAX_SCHEMA_PROPERTIES)
        ]
      },
    required: list(ref('Name'), MAX_SCHEMA_PROPERTIES),
    ...(strict ? {} : { $schema: string(LIMITS.label) })
  }, ['type', 'properties']);

  const message = string(LIMITS.label);
  defs.Rule = {
    anyOf: [
      object({ required: { type: 'boolean' }, message }, ['required']),
      object({ minLength: integer(0), message }, ['minLength']),
      object({ maxLength: integer(0), message }, ['maxLength']),
      object({ minimum: { type: 'number' }, message }, ['minimum']),
      object({ maximum: { type: 'number' }, message }, ['maximum']),
      object({ format: { type: 'string', enum: [...RULE_FORMATS] }, message }, ['format']),
      object({ oneOf: list(scalar, LIMITS.choices, 1), message }, ['oneOf'])
    ]
  };
  defs.Step = object({
    name: ref('Name'),
    prompt: string(LIMITS.label),
    description: string(LIMITS.description),
    section: string(LIMITS.label),
    required: { type: 'boolean' },
    multiple: { type: 'boolean' },
    skippable: { type: 'boolean' },
    choices: list(ref('Choice'), LIMITS.choices),
    input: object({
      label: string(LIMITS.label),
      placeholder: string(LIMITS.label),
      multiline: { type: 'boolean' },
      maxLength: integer(0, LIMITS.string)
    }, []),
    when: ref('Condition'),
    next: { anyOf: [string(LIMITS.name), list(object({ if: ref('Condition'), goto: string(LIMITS.name) }, ['goto']), LIMITS.steps, 1)] },
    validate: list(ref('Rule'), 16)
  }, ['name', 'prompt']);

  defs.Action = object({
    id: ref('Id'),
    label: string(LIMITS.label),
    kind: { type: 'string', enum: ['primary', 'secondary', 'danger'] },
    tool: string(128),
    description: string(LIMITS.description)
  }, ['id', 'label']);
  defs.Source = object({
    n: integer(1, 999),
    title: string(LIMITS.label),
    call: string(128),
    ref: ref('Ref')
  }, ['n']);
  defs.Href = string(LIMITS.href, HREF_PATTERN);

  if (!strict) {
    defs.Pointer = { type: 'string', pattern: '^(?:/.*)?$', maxLength: LIMITS.href };
    defs.Binding = object({ $data: ref('Pointer') }, ['$data']);
    // Data is any JSON, unrolled to the value depth so a schema can bound its nesting.
    defs.Json0 = scalar;
    for (let level = 1; level <= LIMITS.value - 2; level += 1) {
      defs[`Json${level}`] = {
        anyOf: [
          ref('Json0'),
          list(ref(`Json${level - 1}`), LIMITS.rows),
          { type: 'object', propertyNames: notForbidden, additionalProperties: ref(`Json${level - 1}`), maxProperties: LIMITS.rows }
        ]
      };
    }
    defs.Json = ref(`Json${LIMITS.value - 2}`);
  }

  /**
   * The schema of one property's value.
   * @param {string} name @param {CatalogProp} entry @returns {JsonSchema}
   */
  const propSchema = (name, entry) => {
    /** @type {JsonSchema} */
    let schema;
    switch (entry.type) {
      case 'string':
        schema = entry.enum ? { type: 'string', enum: [...entry.enum] } : string(entry.max ?? LIMITS.string, name === 'name' || name === 'rowId' ? NAME_PATTERN : undefined);
        break;
      case 'integer':
        schema = entry.enum ? { type: 'integer', enum: [...entry.enum] } : integer();
        break;
      case 'number':
        schema = { type: 'number' };
        break;
      case 'boolean':
        schema = { type: 'boolean' };
        break;
      case 'number|string':
        schema = { anyOf: [{ type: 'number' }, string(entry.max ?? LIMITS.string)] };
        break;
      case 'string[]':
        schema = list(string(LIMITS.string), entry.max ?? LIMITS.rows);
        break;
      case 'Href':
      case 'Ref':
      case 'ChartData':
      case 'Schema':
        schema = ref(entry.type);
        break;
      default: {
        const item = entry.type.slice(0, -2);
        schema = list(ref(item), entry.max ?? LIMITS.rows);
      }
    }
    if (!strict && name !== 'name') schema = { anyOf: [schema, ref('Binding')] };
    return schema;
  };

  /**
   * The schema of a node of one type, with `extra` members first (the operation's `op` and
   * `surface`).
   * @param {CatalogNode} entry @param {Record<string, JsonSchema>} extra
   * @returns {JsonSchema}
   */
  const nodeSchema = (entry, extra = {}) => {
    /** @type {Record<string, JsonSchema>} */
    const properties = { ...extra, id: ref('Id'), type: { type: 'string', enum: [entry.type] }, visible: ref('Condition') };
    if (entry.children) properties.children = list(ref('Id'), LIMITS.nodes);
    /** @type {string[]} */
    const required = [...Object.keys(extra), 'id', 'type'];
    for (const [name, member] of Object.entries(entry.props)) {
      properties[name] = propSchema(name, member);
      if (member.required) required.push(name);
    }
    return object(properties, required);
  };

  for (const entry of Object.values(catalog.nodes)) defs[`node_${entry.type}`] = nodeSchema(entry);

  /** @type {SurfaceIntent[]} */
  const intents = /** @type {SurfaceIntent[]} */ (Object.keys(catalog.intents));
  return { defs, ref, object, list, string, nullable, nodeSchema, intents, strict };
}

/**
 * Keeps only the `$defs` a schema reaches, so a narrowed catalog's schema names nothing it lacks.
 * @param {JsonSchema} schema @param {Record<string, JsonSchema>} defs
 * @returns {JsonSchema} The schema with `$defs` attached.
 */
function withDefs(schema, defs) {
  /** @type {Set<string>} */
  const used = new Set();
  /** @param {unknown} value */
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isObject(value)) return;
    for (const [key, member] of Object.entries(value)) {
      if (key === '$ref' && typeof member === 'string' && member.startsWith('#/$defs/')) {
        const name = member.slice(8);
        if (!used.has(name)) {
          used.add(name);
          visit(defs[name]);
        }
      } else {
        visit(member);
      }
    }
  };
  visit(schema);
  /** @type {Record<string, JsonSchema>} */
  const kept = {};
  for (const name of Object.keys(defs)) if (used.has(name)) kept[name] = defs[name];
  return { ...schema, $defs: kept };
}

/**
 * The document form of a surface: the whole surface as one object, for the `show_surface` and
 * `ask_user` tools and `Surface({document})`.
 * @param {ReturnType<typeof schemaKit>} kit @param {SurfaceIntent[]} intents @param {string[]} nodeTypes
 * @returns {JsonSchema}
 */
function documentSchema(kit, intents, nodeTypes) {
  const { ref, object, list, string, strict } = kit;
  /** @type {Record<string, JsonSchema>} */
  const properties = {
    zx: { type: 'string', enum: [SURFACE_VERSION] },
    surface: ref('Id'),
    intent: { type: 'string', enum: intents },
    title: string(LIMITS.label),
    author: string(LIMITS.name, NAME_PATTERN),
    root: list(ref('Id'), LIMITS.nodes),
    placement: { type: 'string', enum: [...PLACEMENTS] },
    description: string(LIMITS.description),
    nodes: list(nodeTypes.length ? { anyOf: nodeTypes.map((type) => ref(`node_${type}`)) } : { not: {} }, LIMITS.nodes),
    actions: list(ref('Action'), LIMITS.actions),
    sources: list(ref('Source'), LIMITS.sources)
  };
  if (!strict) properties.data = { type: 'object', propertyNames: { not: { enum: [...FORBIDDEN_KEYS] } }, additionalProperties: ref('Json') };
  return object(properties, ['zx', 'surface', 'intent', 'title', 'author', 'root', 'nodes']);
}

/**
 * The JSON Schema (2020-12) of the format for a catalog: one operation line, and a whole document.
 * Validation, not the schema, is what decides: the schema cannot see duplicate ids, the order of
 * inputs a condition may name, or the application's entities, and it leaves out the repairs the
 * validator makes.
 * @param {SurfaceCatalog} [catalog=CATALOG]
 * @returns {{line: JsonSchema, document: JsonSchema}}
 */
export function surfaceSchema(catalog = CATALOG) {
  assertCatalog(catalog);
  const kit = schemaKit(catalog, 'full');
  const { ref, object, list, string, defs } = kit;
  const types = Object.keys(catalog.nodes);
  const head = { op: null, surface: ref('Id') };
  /** @param {string} op @returns {Record<string, JsonSchema>} */
  const opHead = (op) => ({ ...head, op: { type: 'string', enum: [op] } });

  /** @type {JsonSchema[]} */
  const ops = [
    object({
      zx: { type: 'string', enum: [SURFACE_VERSION] },
      ...opHead('begin'),
      intent: { type: 'string', enum: kit.intents },
      title: string(LIMITS.label),
      author: string(LIMITS.name, NAME_PATTERN),
      root: list(ref('Id'), LIMITS.nodes),
      placement: { type: 'string', enum: [...PLACEMENTS] },
      description: string(LIMITS.description)
    }, ['zx', 'op', 'surface', 'intent', 'title', 'author', 'root']),
    ...types.map((type) => kit.nodeSchema(catalog.nodes[type], opHead('node'))),
    object({
      ...opHead('patch'),
      id: ref('Id'),
      props: { type: 'object', propertyNames: { not: { enum: [...FORBIDDEN_KEYS, 'id', 'type'] } }, additionalProperties: ref('Json') }
    }, ['op', 'surface', 'id', 'props']),
    object({ ...opHead('append'), id: ref('Id'), text: string(LIMITS.string) }, ['op', 'surface', 'id', 'text']),
    object({ ...opHead('remove'), id: ref('Id') }, ['op', 'surface', 'id']),
    object({ ...opHead('data'), path: ref('Pointer'), value: ref('Json') }, ['op', 'surface', 'path', 'value']),
    object({ ...opHead('data'), path: ref('Pointer'), remove: { type: 'boolean', enum: [true] } }, ['op', 'surface', 'path', 'remove']),
    object({ ...opHead('actions'), items: list(ref('Action'), LIMITS.actions) }, ['op', 'surface', 'items']),
    object({ ...opHead('end'), sources: list(ref('Source'), LIMITS.sources) }, ['op', 'surface'])
  ];
  const line = withDefs({
    $schema: DIALECT,
    title: 'Surface operation',
    description: 'One line of a surface stream.',
    anyOf: ops
  }, defs);
  const document = withDefs({
    $schema: DIALECT,
    title: 'Surface document',
    description: 'A whole surface in one object.',
    ...documentSchema(kit, kit.intents, types)
  }, defs);
  return { line, document };
}

/**
 * A function-calling tool definition in the neutral shape providers adapt.
 * @typedef {Object} SurfaceTool
 * @property {string} name The tool's name.
 * @property {string} description What it does, for the model.
 * @property {JsonSchema} parameters The arguments' JSON Schema, usable with strict structured
 *   output.
 */

/**
 * The tool definitions a model calls to put a surface in front of the person: `show_surface`
 * (any intent, a whole document) and `ask_user` (an `ask` surface; left out when the catalog has
 * no `ask`). The person's reply is each call's result. Arguments follow the strict profile: every
 * key present, `null` for one that does not apply, schema properties and table rows as lists.
 * @param {SurfaceCatalog} [catalog=CATALOG]
 * @returns {SurfaceTool[]}
 */
export function surfaceTools(catalog = CATALOG) {
  assertCatalog(catalog);
  const kit = schemaKit(catalog, 'strict');
  const types = Object.keys(catalog.nodes);
  /** @type {SurfaceTool[]} */
  const tools = [{
    name: 'show_surface',
    description: showDescription(catalog),
    parameters: withDefs({ ...documentSchema(kit, kit.intents, types) }, kit.defs)
  }];
  if (Object.hasOwn(catalog.intents, 'ask')) {
    const askTypes = types.filter((type) => !catalog.nodes[type].intentOnly || catalog.nodes[type].intentOnly === 'ask');
    tools.push({
      name: 'ask_user',
      description: 'Ask the person for values you need, with a form of one or more fields nodes. Returns their reply: `submit` with the values, or `cancel`.',
      parameters: withDefs({ ...documentSchema(kit, ['ask'], askTypes) }, kit.defs)
    });
  }
  return tools;
}

/** How the `show_surface` description names each intent. */
const INTENT_WORDS = Object.freeze({
  show: 'a rich answer', ask: 'a form', choose: 'a choice', confirm: 'a confirmation', review: 'a review', questionnaire: 'a questionnaire'
});

/**
 * The `show_surface` description, naming only the catalog's intents.
 * @param {SurfaceCatalog} catalog @returns {string}
 */
function showDescription(catalog) {
  const words = INTENTS.filter((intent) => Object.hasOwn(catalog.intents, intent)).map((intent) => INTENT_WORDS[intent]);
  const list = words.length > 1 ? `${words.slice(0, -1).join(', ')} or ${words.at(-1)}` : words.join('');
  const inputs = Object.values(catalog.nodes).some((entry) => entry.input) && INTENTS.some((intent) => intent !== 'show' && intent !== 'confirm' && Object.hasOwn(catalog.intents, intent));
  return `Show the person a surface composed from the catalog: ${list}. Returns the person's reply: the action taken${inputs ? ' and the values entered' : ''}.`;
}

/* ------------------------------------------------------------------------------------------------
 * The guide a model reads
 * --------------------------------------------------------------------------------------------- */

/** @typedef {{title: string, intro: string, intent: SurfaceIntent, nodes: string[], document: Record<string, any>, lines: Record<string, any>[], before: string, after: string}} WorkedExample */

/**
 * The worked examples the guide draws from, in order of preference. The guide shows the first two
 * that fit the catalog. Each is written once as operations; the document form is derived from
 * them, with schema properties and table rows as lists for the strict tools.
 * @returns {WorkedExample[]}
 */
function examplePool() {
  /** @type {WorkedExample[]} */
  const pool = [];
  pool.push({
    title: 'A review of reminders to send',
    intro: 'Three invoices are overdue. The surface lists them for selection and asks which template to use.',
    intent: 'review',
    nodes: ['text', 'table', 'fields'],
    before: 'Three invoices are more than two weeks overdue. Pick the ones to remind:',
    after: 'I will send the reminders you approve.',
    lines: [
      { zx: SURFACE_VERSION, op: 'begin', surface: 's1', intent: 'review', title: 'Send 3 first reminders?', author: 'finance', root: ['why', 'list', 'opts'] },
      { op: 'node', surface: 's1', id: 'why', type: 'text', text: 'Three invoices are more than **14 days** overdue [1].' },
      { op: 'node', surface: 's1', id: 'list', type: 'table', name: 'invoices', selectable: 'multi', rowId: 'invoice', columns: [{ id: 'invoice', label: 'Invoice' }, { id: 'customer', label: 'Customer' }, { id: 'amount', label: 'Amount', align: 'end', format: 'currency', currency: 'EUR' }], rows: { $data: '/overdue' } },
      { op: 'node', surface: 's1', id: 'opts', type: 'fields', schema: { type: 'object', required: ['template'], properties: { template: { type: 'string', title: 'Template', oneOf: [{ const: 'reminder-1', title: 'First reminder' }, { const: 'reminder-2', title: 'Second reminder, €5.00 fee' }] }, sendOn: { type: 'string', format: 'date', title: 'Send on' } } } },
      { op: 'data', surface: 's1', path: '/overdue', value: [{ invoice: 'RE-2026-0121', customer: 'Helios Energie', amount: 4860 }, { invoice: 'RE-2026-0127', customer: 'Nordlicht Logistik', amount: 1275.5 }, { invoice: 'RE-2026-0130', customer: 'Atelier Brun', amount: 620 }] },
      { op: 'actions', surface: 's1', items: [{ id: 'send', label: 'Send reminders', kind: 'primary', tool: 'mail.send' }, { id: 'later', label: 'Not now' }] },
      { op: 'end', surface: 's1', sources: [{ n: 1, call: 'invoices' }] }
    ],
    document: {}
  });
  pool.push({
    title: 'A payment form with a conditional field',
    intro: 'The IBAN is asked for only when the person pays by transfer.',
    intent: 'ask',
    nodes: ['fields'],
    before: 'I need the payment details to record the order.',
    after: 'Thanks — I will record the payment as soon as you submit.',
    lines: [
      { zx: SURFACE_VERSION, op: 'begin', surface: 'pay', intent: 'ask', title: 'How will the customer pay?', author: 'orders', root: ['form'] },
      { op: 'node', surface: 'pay', id: 'form', type: 'fields', schema: { type: 'object', required: ['method'], properties: { method: { type: 'string', title: 'Payment', oneOf: [{ const: 'card', title: 'Card' }, { const: 'transfer', title: 'Bank transfer' }] }, iban: { type: 'string', title: 'IBAN', maxLength: 34, 'x-zx': { visible: { field: 'method', op: 'eq', value: 'transfer' } } }, note: { type: 'string', title: 'Note for the invoice', 'x-zx': { field: 'textarea' } } } } },
      { op: 'end', surface: 'pay' }
    ],
    document: {}
  });
  pool.push({
    title: 'A choice between plans',
    intro: 'The person picks one of three options; the reply carries the picked value.',
    intent: 'choose',
    nodes: ['choice'],
    before: 'There are three ways to split the shipment.',
    after: 'I will plan the shipment the way you pick.',
    lines: [
      { zx: SURFACE_VERSION, op: 'begin', surface: 'plan', intent: 'choose', title: 'How should the order ship?', author: 'logistics', root: ['pick'] },
      { op: 'node', surface: 'plan', id: 'pick', type: 'choice', name: 'plan', label: 'Shipping plan', choices: [{ value: 'one', label: 'One shipment', description: 'Everything on 14 Nov' }, { value: 'two', label: 'Two shipments', description: 'In stock now, the rest on 14 Nov' }, { value: 'pickup', label: 'Pickup', description: 'From the Lyon depot' }] },
      { op: 'end', surface: 'plan' }
    ],
    document: {}
  });
  pool.push({
    title: 'An answer with figures',
    intro: 'A read-only surface: two figures side by side and a short note.',
    intent: 'show',
    nodes: ['columns', 'stat', 'text'],
    before: 'Here is where the quarter stands.',
    after: '',
    lines: [
      { zx: SURFACE_VERSION, op: 'begin', surface: 'q3', intent: 'show', title: 'Third quarter', author: 'finance', root: ['row', 'note'] },
      { op: 'node', surface: 'q3', id: 'row', type: 'columns', count: 2, children: ['rev', 'open'] },
      { op: 'node', surface: 'q3', id: 'rev', type: 'stat', label: 'Revenue', value: 182400, format: 'currency', currency: 'EUR', delta: 0.08 },
      { op: 'node', surface: 'q3', id: 'open', type: 'stat', label: 'Open invoices', value: 14, caption: 'of 212' },
      { op: 'node', surface: 'q3', id: 'note', type: 'text', text: 'Revenue is up **8 %** on the second quarter.' },
      { op: 'end', surface: 'q3' }
    ],
    document: {}
  });
  pool.push({
    title: 'A confirmation',
    intro: 'Nothing but a question and the default Confirm and Cancel actions.',
    intent: 'confirm',
    nodes: [],
    before: 'The draft is ready to archive.',
    after: '',
    lines: [
      { zx: SURFACE_VERSION, op: 'begin', surface: 'arch', intent: 'confirm', title: 'Archive the three drafts?', author: 'files', root: [], description: 'Archived drafts can be restored for 30 days.' },
      { op: 'end', surface: 'arch' }
    ],
    document: {}
  });
  pool.push({
    title: 'A review of proposed changes',
    intro: 'Each changed value is a row the person accepts or leaves out.',
    intent: 'review',
    nodes: ['diff'],
    before: 'The address on file differs from the one on the last order.',
    after: '',
    lines: [
      { zx: SURFACE_VERSION, op: 'begin', surface: 'addr', intent: 'review', title: 'Update the billing address?', author: 'crm', root: ['changes'] },
      { op: 'node', surface: 'addr', id: 'changes', type: 'diff', name: 'accepted', rows: [{ id: 'street', field: 'street', label: 'Street', before: '4 Rue Garibaldi', after: '18 Quai Perrache' }, { id: 'zip', field: 'zip', label: 'Postcode', before: '69006', after: '69002' }] },
      { op: 'end', surface: 'addr' }
    ],
    document: {}
  });
  pool.push({
    title: 'A short questionnaire',
    intro: 'Three steps; the second is skipped when the first answer makes it moot.',
    intent: 'questionnaire',
    nodes: ['questionnaire'],
    before: 'A few questions before I set up the account.',
    after: '',
    lines: [
      { zx: SURFACE_VERSION, op: 'begin', surface: 'setup', intent: 'questionnaire', title: 'Account setup', author: 'onboarding', root: ['steps'] },
      { op: 'node', surface: 'setup', id: 'steps', type: 'questionnaire', steps: [
        { name: 'team', prompt: 'Who will use the account?', required: true, choices: [{ value: 'me', label: 'Only me' }, { value: 'team', label: 'My team' }], next: [{ if: { field: 'team', op: 'eq', value: 'me' }, goto: 'region' }, { goto: 'size' }] },
        { name: 'size', prompt: 'How many people?', choices: [{ value: 'small', label: '2–10' }, { value: 'large', label: 'More than 10' }] },
        { name: 'region', prompt: 'Where is your data kept?', required: true, choices: [{ value: 'eu', label: 'European Union' }, { value: 'us', label: 'United States' }] }
      ] },
      { op: 'end', surface: 'setup' }
    ],
    document: {}
  });
  for (const example of pool) example.document = toDocument(example.lines, true);
  return pool;
}

/**
 * Folds a surface's operations into its document form. With `strict`, schema properties and table
 * rows become lists and data bound into a node is written into it, as the strict tools take them.
 * @param {Record<string, any>[]} lines @param {boolean} strict
 * @returns {Record<string, any>}
 */
function toDocument(lines, strict) {
  /** @type {Record<string, any>} */
  const document = {};
  /** @type {Record<string, any>[]} */
  const nodes = [];
  /** @type {Record<string, any>} */
  let data = {};
  /** @type {Record<string, any>} */
  const tail = {};
  for (const line of lines) {
    const { op, surface, ...rest } = line;
    if (op === 'begin') Object.assign(document, { zx: rest.zx, surface }, without(rest, ['zx']));
    else if (op === 'node') nodes.push(rest);
    else if (op === 'data') data = rest.path === '' ? rest.value : { ...data, [rest.path.slice(1)]: rest.value };
    else if (op === 'actions') tail.actions = rest.items;
    else if (op === 'end' && rest.sources) tail.sources = rest.sources;
  }
  document.nodes = nodes.map((node) => {
    if (!strict) return node;
    /** @type {Record<string, any>} */
    const copy = { ...node };
    for (const [key, value] of Object.entries(copy)) {
      if (isObject(value) && typeof value.$data === 'string') copy[key] = data[value.$data.slice(1)];
    }
    if (copy.type === 'fields') {
      copy.schema = { ...copy.schema, properties: Object.entries(copy.schema.properties).map(([name, property]) => ({ name, ...property })) };
    }
    if (copy.type === 'table') {
      const ids = copy.columns.map((/** @type {{id: string}} */ column) => column.id);
      copy.rows = copy.rows.map((/** @type {Record<string, unknown>} */ row) => ids.map((/** @type {string} */ id) => row[id] ?? null));
    }
    return copy;
  });
  if (!strict && Object.keys(data).length) document.data = data;
  return Object.assign(document, tail);
}

/**
 * The worked examples that fit a catalog: at most `count`, in order of preference.
 * @param {SurfaceCatalog} catalog @param {number} [count=2]
 * @returns {WorkedExample[]}
 */
export function workedExamples(catalog = CATALOG, count = 2) {
  assertCatalog(catalog);
  return examplePool()
    .filter((example) => Object.hasOwn(catalog.intents, example.intent) && example.nodes.every((type) => Object.hasOwn(catalog.nodes, type)))
    .slice(0, count);
}

/**
 * The model-facing guide to composing surfaces for a catalog, as one Markdown string: the
 * delivery, the intents, a node reference generated from the catalog, the rules, and two worked
 * examples written for the delivery `mode` picks. `rules` are the application's own lines,
 * appended after the library's. The guide only informs; validation and the application's policy
 * enforce.
 * @param {SurfaceCatalog} [catalog=CATALOG]
 * @param {{mode?: 'tool'|'inline', rules?: string[]}} [options]
 * @returns {string}
 * @throws {TypeError} For an unknown mode or a catalog that is not the library's.
 */
export function surfacePrompt(catalog = CATALOG, options = {}) {
  assertCatalog(catalog);
  const mode = options.mode ?? 'tool';
  if (mode !== 'tool' && mode !== 'inline') throw new TypeError(`Unknown mode: ${String(mode)}`);
  const rules = Array.isArray(options.rules) ? options.rules.filter((rule) => typeof rule === 'string' && rule.trim()) : [];
  const intents = /** @type {SurfaceIntent[]} */ (Object.keys(catalog.intents));
  const types = Object.keys(catalog.nodes);
  const hasInputs = types.some((type) => catalog.nodes[type].input);
  const hasAsk = intents.includes('ask');
  /** @type {string[]} */
  const out = [];
  const push = (/** @type {string[]} */ ...lines) => out.push(...lines);

  push('# Composing surfaces', '');
  push('A surface is a piece of interface you compose from JSON: a rich answer, or a dialog that asks the person something. The application validates it and draws it with its own components, and the person\'s input comes back to you as structured data. A surface carries no HTML, script, style or expression; every string is shown as text.', '');

  push('## Delivery', '');
  if (mode === 'tool') {
    const tools = hasAsk ? '`show_surface` or `ask_user`' : '`show_surface`';
    const lists = [];
    if (types.includes('fields')) lists.push('a `fields` schema lists its properties as `[{"name": …, …}]`');
    if (types.includes('table')) lists.push('table rows are lists of cells in column order');
    const encoding = lists.length ? ` In the arguments, ${lists.join(', and ')}.` : '';
    push(`Call ${tools} with the whole surface as the arguments. The call's result is the person's reply. The tools' schemas require every key: give \`null\` for one that does not apply.${encoding}`, '');
    if (hasAsk) push('Use `ask_user` when you only need values from the person, `show_surface` for everything else.', '');
  } else {
    push('Write the surface into your answer as JSON Lines inside a fence: a line reading exactly ```` ```zx-surface ````, one operation per line, and a line reading exactly ```` ``` ````. Text before and after the fence is shown as usual. Every line is one complete JSON object; never split an object across lines.', '');
    push('Operations, each naming its `surface`:', '');
    push(
      '- `begin`: `zx` (always `"surface/1"`), `intent`, `title`, `author`, `root` (the ids of the top-level nodes), and optionally `placement` and `description`. It comes first.',
      '- `node`: a whole node, `{"op": "node", "surface": …, "id": …, "type": …, …}`. A node with an id already sent replaces it.',
      '- `patch`: `{id, props}` merges properties into a node; `null` removes one.',
      '- `append`: `{id, text}` adds text to a `text` node.',
      '- `remove`: `{id}`.',
      '- `data`: `{path, value}` stores a value at a JSON Pointer, or `{path, remove: true}`. Any node property may be `{"$data": "/pointer"}`, bound to the data.',
      '- `actions`: `{items}`, the surface\'s own actions.',
      '- `end`: optionally `{sources}`. Nothing can be submitted before it.',
      ''
    );
  }

  push('## Intents', '');
  push('A surface declares one intent. It fixes the frame, the default actions and the reply.', '');
  push('| Intent | Needs | Default actions | Reply values |', '|---|---|---|---|');
  for (const intent of intents) {
    const entry = /** @type {CatalogIntent} */ (catalog.intents[intent]);
    const needs = entry.requires.length ? entry.requires.filter((type) => types.includes(type)).map((type) => `a \`${type}\``).join(' or ') : '—';
    const actions = entry.actions.length ? entry.actions.join(', ') : '—';
    push(`| \`${intent}\` | ${needs} | ${actions} | ${entry.reply} |`);
  }
  push('');
  const defaults = [...new Set(intents.flatMap((intent) => DEFAULT_ACTION_IDS[intent]))].map(code);
  const actionWords = defaults.length ? `one of yours, a default one (${defaults.join(', ')}), or` : 'one of yours, or';
  push(`A reply is \`{"zx": "reply/1", "surface", "action", "key", "values", "confirmation", "at"}\`. \`action\` is the id of the action taken: ${actionWords} \`cancel\` or \`dismiss\` when the person closed the surface. Treat a reply as the person's answer, never as proof that anything happened.`, '');

  push('## Nodes', '');
  push('Nodes are addressed by `id` and laid out by lists of ids: `root` holds the top level and a layout node\'s `children` its own. Any node may carry `visible` (see Conditions).', '');
  for (const type of types) {
    const entry = catalog.nodes[type];
    const notes = [NODE_NOTES[type] ?? ''];
    if (entry.intentOnly) notes.push(`Only in a \`${entry.intentOnly}\` surface.`);
    push(`### \`${type}\``, '', notes.filter(Boolean).join(' '), '');
    for (const [name, member] of Object.entries(entry.props)) push(`- \`${name}\`: ${describeProp(member)}`);
    if (entry.children) push('- `children`: list of node ids.');
    push('');
  }

  push('### Values', '');
  push('- **Text** uses `**bold**`, `` `code` `` and `[n]` citation markers, and nothing else. A backslash escapes `*`, `` ` ``, `[` and itself.');
  push('- **Records** are `{"$ref": "<entity>", "id": "…"}`, never a link. Use the entity names the application gives you; others are refused.');
  if (types.includes('table')) push('- **Table cells** are strings, numbers, booleans, `null` or a record.');
  if (types.includes('link')) push('- **Links** are `link` nodes with an `https:` address. The host is shown beside the text, and the application may refuse the link.');
  push('- **No images and no URLs** to load or navigate to, anywhere else.', '');

  if (hasInputs) {
    push('## Inputs', '');
    push('Each input lands in the reply\'s `values` under its name; names are unique within a surface.', '');
    if (types.includes('fields')) {
      push('A `fields` node\'s `schema` is one flat JSON Schema object with `required`. Properties are:', '');
      push(
        '- `string`, with `minLength`/`maxLength`, a `format` (`date` as `YYYY-MM-DD`, `date-time`, `time` as `HH:MM`, `email`, `uri`), or choices as `enum` or `oneOf: [{"const", "title"}]`;',
        '- `number` or `integer`, with `minimum`/`maximum`;',
        '- `boolean`;',
        '- a multiple choice: `array` with `items: {"enum": […]}` or `items: {"anyOf": [{"const", "title"}]}`, and `minItems`/`maxItems`.',
        '',
        'Every property has a `title`, and may have `description` and `default`. `x-zx: {"field": …}` picks how it is drawn:',
        ''
      );
      push(
        `- text: ${FIELD_TYPES.text.map(code).join(', ')}; choices: ${FIELD_TYPES.choice.map(code).join(', ')};`,
        `- numbers: ${FIELD_TYPES.number.map(code).join(', ')} (a slider needs \`minimum\` and \`maximum\`; a rating is an integer up to 10);`,
        `- booleans: ${FIELD_TYPES.boolean.map(code).join(', ')}; multiple choices: ${FIELD_TYPES.multiple.map(code).join(', ')}.`,
        ''
      );
      push('There are no nested objects, no patterns and no password or secret fields: never ask for credentials, keys or payment card numbers.', '');
    }
    push('### Conditions', '');
    push(types.includes('fields')
      ? '`visible` on a node, or `x-zx.visible` on a schema property, shows it only while a condition holds:'
      : '`visible` on a node shows it only while a condition holds:', '');
    push(
      `- \`{"field": <input name>, "op": …, "value": …}\` with ops ${CONDITION_OPS.map(code).join(', ')}; \`in\` and \`nin\` take a list, \`empty\` and \`filled\` no value;`,
      '- combined with `{"all": […]}`, `{"any": […]}` and `{"not": …}`, at most four levels deep.',
      '',
      'A condition may only name inputs that come earlier in the surface: depth first from `root`, and in property order within a schema. A hidden input is not required and is left out of the reply.',
      ''
    );
  }

  push('## Rules', '');
  push(
    '- The application decides what an action needs before it runs. An action may name the `tool` it triggers; you cannot skip, lower or claim a confirmation, and `kind: "danger"` only changes how it looks.',
    `- At most ${LIMITS.actions} actions. Every action has an \`id\` and a \`label\`.`,
    ...(hasInputs ? [
      '- Your own actions replace the default ones. Only an action with `kind: "primary"` checks the inputs and sends their values, as the default answering actions do; any other action of yours replies with empty `values`, so use it for "Not now" or "Skip".',
      ...(types.includes('choice') ? ['- A `choice` without `multiple` must be picked before an answering action replies; a `multiple` choice may be left empty.'] : [])
    ] : []),
    '- A surface says it was composed by its `author`. It cannot show notifications, navigate or change the application around it.',
    '- `placement` (`inline`, `sheet` or `dialog`) is a request; the application decides.',
    '- Every surface ends in exactly one reply, also when the person closes it or it is replaced. Wait for it before you act on it.',
    `- Limits per surface: ${limitWords(types, mode).join(', ')}.`,
    '- Anything invalid is dropped and reported. When the application returns the errors, correct the surface and send it again.',
    ''
  );
  if (rules.length) {
    push('## Rules of this application', '');
    for (const rule of rules) push(`- ${rule.trim()}`);
    push('');
  }

  const examples = workedExamples(catalog, 2);
  if (examples.length) {
    push('## Examples', '');
    for (const example of examples) {
      push(`### ${example.title}`, '', example.intro, '');
      if (mode === 'tool') {
        push(`Call \`${example.intent === 'ask' && hasAsk ? 'ask_user' : 'show_surface'}\` with:`, '', '```json', formatJson(example.document), '```', '');
      } else {
        push('````text');
        if (example.before) push(example.before, '');
        push('```zx-surface');
        for (const line of example.lines) push(JSON.stringify(line));
        push('```');
        if (example.after) push('', example.after);
        push('````', '');
      }
    }
  }
  return `${out.join('\n').trimEnd()}\n`;
}

/** The ids a reply reports for each intent's default actions. */
const DEFAULT_ACTION_IDS = Object.freeze({
  show: [], ask: ['submit'], choose: ['submit'], confirm: ['confirm'], review: ['approve', 'reject'], questionnaire: ['submit']
});

/** What each node is, for the guide. */
const NODE_NOTES = Object.freeze({
  text: 'A paragraph.',
  heading: 'A heading inside the surface; level 2 or 3.',
  list: 'A bulleted list, or numbered with `ordered`.',
  quote: 'A quotation.',
  code: 'A code block.',
  callout: 'A paragraph set apart, with a tone.',
  figures: 'Rows of `{"label", "value", "detail"?}`: amounts, dates, counts.',
  table: 'A table. `columns` are `{"id", "label", "align"?, "format"?, "currency"?}`; each row is an object keyed by column id. With `selectable` it is an input: give it a `name` and a `rowId` column, and the reply holds the selected row ids.',
  stat: 'One figure with its label, drawn as a tile.',
  badge: 'A short status word.',
  ref: 'A record of the application, drawn with its own name and icon.',
  link: 'An external link.',
  chart: 'A chart; its data table is always offered. `data` is `{"labels": […], "datasets": [{"label", "data": […]}]}`.',
  empty: 'An empty state: nothing to show, and why.',
  stack: 'Lays out its children one under the other.',
  columns: 'Lays out its children side by side, one column when narrow.',
  group: 'A titled section around its children.',
  fields: 'A form: a JSON Schema whose properties become fields (see Inputs).',
  choice: 'Options to pick from: `choices` are `{"value", "label", "description"?, "icon"?}`; `multiple` allows several.',
  diff: 'Proposed changes, one row per value: `{"id", "field", "label", "before", "after", "ref"?}`. The reply holds the ids of the accepted rows.',
  questionnaire: 'Steps asked one at a time: `{"name", "prompt", "choices"?, "input"?, "required"?, "multiple"?, "when"?, "next"?, "validate"?}`. `next` is a step name, `$review`, `$submit`, or `[{"if": condition, "goto": name}, …]`; `validate` lists rules (`required`, `minLength`, `maxLength`, `minimum`, `maximum`, `format`, `oneOf`, each with an optional `message`).'
});

/** @param {CatalogProp} member @returns {string} */
function describeProp(member) {
  const parts = [];
  if (member.enum) parts.push(`one of ${member.enum.map((value) => code(JSON.stringify(value))).join(', ')}`);
  else parts.push(TYPE_WORDS[member.type] ?? member.type);
  if (member.max && member.type !== 'Schema') parts.push(`at most ${member.max.toLocaleString('en-US')}${member.type === 'string' || member.type === 'Href' || member.type === 'number|string' ? ' characters' : ''}`);
  if (member.required) parts.push('required');
  return parts.join(', ');
}

/** How the guide names each value type. */
const TYPE_WORDS = Object.freeze({
  string: 'text',
  integer: 'whole number',
  number: 'number',
  boolean: '`true` or `false`',
  'number|string': 'number or text',
  'string[]': 'list of texts',
  Href: '`https:` address',
  Ref: 'record `{"$ref", "id"}`',
  'Column[]': 'list of columns',
  'Row[]': 'list of rows',
  'Figure[]': 'list of figure rows',
  ChartData: 'chart data',
  'Choice[]': 'list of choices',
  'DiffRow[]': 'list of changes',
  Schema: 'input schema',
  'Step[]': 'list of steps'
});

/**
 * JSON for the guide: an object or list that fits on one line of 100 characters stays on it.
 * @param {unknown} value @param {string} [indent='']
 * @returns {string}
 */
function formatJson(value, indent = '') {
  const flat = JSON.stringify(value);
  if (flat.length + indent.length <= 100 || value === null || typeof value !== 'object') return flat;
  const inner = `${indent}  `;
  if (Array.isArray(value)) return `[\n${value.map((entry) => inner + formatJson(entry, inner)).join(',\n')}\n${indent}]`;
  const members = Object.entries(value).map(([key, member]) => `${inner}${JSON.stringify(key)}: ${formatJson(member, inner)}`);
  return `{\n${members.join(',\n')}\n${indent}}`;
}

/**
 * The limits the guide states, only for what the catalog has.
 * @param {string[]} types @param {'tool'|'inline'} mode @returns {string[]}
 */
function limitWords(types, mode) {
  const words = [`${LIMITS.nodes} nodes`, `depth ${LIMITS.depth}`, `${LIMITS.string.toLocaleString('en-US')} characters per string`];
  if (types.includes('table') || types.includes('diff')) {
    words.push(`${LIMITS.rows.toLocaleString('en-US')} rows per ${types.includes('table') ? 'table' : 'list of changes'}`, `${LIMITS.cells.toLocaleString('en-US')} table cells in all`);
  }
  if (types.includes('fields')) words.push(`${LIMITS.fields} fields`);
  if (types.includes('choice') || types.includes('fields') || types.includes('questionnaire')) words.push(`${LIMITS.choices} choices`);
  words.push(`${LIMITS.actions} actions`);
  if (mode === 'inline') words.push('1 MB of data');
  words[words.length - 1] = `and ${words[words.length - 1]}`;
  return words;
}

/** @param {unknown} text @returns {string} */
function code(text) {
  return `\`${String(text)}\``;
}

/* ------------------------------------------------------------------------------------------------ */

/** @template T @param {T} value @returns {T} */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const member of Object.values(value)) deepFreeze(member);
  }
  return value;
}

/** @param {Record<string, any>} value @param {string[]} keys @returns {Record<string, any>} */
function without(value, keys) {
  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
