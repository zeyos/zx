import { dateToUnixSeconds, unixSecondsToDate } from './query.js';

/** @typedef {Record<string, unknown>} FieldMeta */
/**
 * @typedef {Object} FieldTypeStrategy
 * @property {Record<string, unknown>|((meta: FieldMeta) => Record<string, unknown>)} field Zx Field descriptor fragment.
 * @property {Record<string, unknown>|((meta: FieldMeta) => Record<string, unknown>)} column Zx Table column fragment.
 */
/**
 * @typedef {Object} ResolveFieldOptions
 * @property {string[]} [fields] Curated allow-list; its order becomes the output order.
 * @property {string[]} [exclude] Field ids to omit.
 * @property {Record<string, string>} [labels] Per-field label overrides.
 */

/**
 * Extensible ZeyOS semantic/DB type registry. Keys are normalized to lowercase. Built-in choices:
 * references use `zxselect`; monetary/numeric data uses `float`; Unix timestamps use date widgets;
 * enums use native Field options; booleans use `toggle`; arrays use `valuelist`; and long structured
 * text uses `textarea`. Extend it through {@link registerFieldType} rather than replacing entries.
 * @type {Record<string, FieldTypeStrategy>}
 */
export const TYPE_MAP = Object.create(null);

const warnedUnknownTypes = new Set();

/**
 * Registers or replaces a field/column strategy for a semantic format or DB type.
 * @param {string} typeOrFormat Semantic format or database type.
 * @param {FieldTypeStrategy} strategy Field and column descriptor builders/fragments.
 * @returns {FieldTypeStrategy} The registered strategy.
 */
export function registerFieldType(typeOrFormat, strategy) {
  const key = normalizeType(typeOrFormat);
  if (!key) throw new TypeError('ZeyOS field type must not be empty');
  if (!strategy || typeof strategy !== 'object') throw new TypeError('Field type strategy must be an object');
  for (const part of ['field', 'column']) {
    const value = strategy[part];
    if (typeof value !== 'function' && (!value || typeof value !== 'object' || Array.isArray(value))) {
      throw new TypeError(`Field type strategy requires a ${part} builder or descriptor`);
    }
  }
  TYPE_MAP[key] = strategy;
  return strategy;
}

/**
 * Converts normalized ZeyOS field metadata to a Zx Field configuration. Semantic `format` wins
 * over the database `type`; relations and enums are detected before scalar DB types. Read-only
 * fields become disabled controls and NOT NULL/required metadata becomes `required: true`.
 * @param {FieldMeta} meta Normalized metadata containing at least `id` or `name`.
 * @returns {Record<string, unknown>} Plain Zx Field descriptor.
 */
export function fieldToZxField(meta) {
  const normalized = normalizeMeta(meta);
  const strategy = strategyFor(normalized);
  const fragment = strategyPart(strategy.field, normalized);
  const descriptor = {
    id: normalized.id,
    type: 'text',
    label: fieldLabel(normalized),
    ...fragment
  };
  if (normalized.description != null) descriptor.description = String(normalized.description);
  if (normalized.required === true || normalized.nullable === false) descriptor.required = true;
  if (isReadonly(normalized)) {
    descriptor.readonly = true;
    descriptor.disabled = true;
    descriptor.props = { ...(descriptor.props ?? {}), readOnly: true };
  }
  return descriptor;
}

/**
 * Converts normalized ZeyOS field metadata to a Zx Table column configuration. Renderers return
 * strings only (never DOM): references/enums show labels, numeric columns are right-aligned,
 * booleans show a check, and Unix seconds are formatted as dates.
 * @param {FieldMeta} meta Normalized metadata containing at least `id` or `name`.
 * @returns {Record<string, unknown>} Plain Zx Table column descriptor.
 */
export function fieldToZxColumn(meta) {
  const normalized = normalizeMeta(meta);
  const strategy = strategyFor(normalized);
  return {
    id: normalized.id,
    label: fieldLabel(normalized),
    sortable: normalized.sortable !== false,
    ...strategyPart(strategy.column, normalized)
  };
}

/**
 * Resolves a resource's runtime client schema into ordered normalized field metadata. The current
 * client returns names from `schema.fields(resource)` and definitions from
 * `schema.describe(resource).fields`; embedded `enum` data is authoritative. A compatible
 * `schema.enums(resource, field)` is used when supplied by another client version/stub.
 * @param {Record<string, any>} client Injected `@zeyos/client` instance.
 * @param {string} resource Schema resource name such as `tickets`.
 * @param {ResolveFieldOptions} [opts={}] Curation options.
 * @returns {FieldMeta[]} Ordered normalized metadata.
 */
export function resolveFields(client, resource, opts = {}) {
  const schema = client?.schema;
  if (!schema || typeof schema.fields !== 'function' || typeof schema.describe !== 'function') {
    throw new TypeError('ZeyOS client must expose schema.fields() and schema.describe()');
  }
  const described = schema.describe(resource);
  const describedFields = normalizeFieldCollection(described?.fields);
  const listedFields = normalizeFieldCollection(schema.fields(resource));
  const available = new Map();

  for (const [id, listed] of listedFields) {
    available.set(id, { ...listed, ...(describedFields.get(id) ?? {}) });
  }
  for (const [id, definition] of describedFields) {
    if (!available.has(id)) available.set(id, { ...definition });
  }

  const requested = Array.isArray(opts.fields) ? opts.fields.map(String) : [...available.keys()];
  const excluded = new Set(Array.isArray(opts.exclude) ? opts.exclude.map(String) : []);
  const labels = opts.labels && typeof opts.labels === 'object' ? opts.labels : {};
  const result = [];

  for (const id of requested) {
    if (excluded.has(id) || !available.has(id)) continue;
    const definition = available.get(id) ?? {};
    const meta = { ...definition, id, name: id, resource: String(resource) };
    const enumValues = definition.enums ?? definition.enum ?? schemaEnum(schema, resource, id);
    if (enumValues != null) {
      meta.enums = enumValues;
      if (meta.enum == null) meta.enum = enumValues;
    }
    if (Object.prototype.hasOwnProperty.call(labels, id)) meta.label = String(labels[id]);
    result.push(meta);
  }
  return result;
}

const plainColumn = { field: { type: 'text' }, column: {} };
const intColumn = { field: { type: 'int' }, column: { align: 'right' } };
const floatColumn = {
  field: { type: 'float' },
  column: (meta) => ({ align: 'right', render: numberRenderer(meta) })
};
const moneyColumn = {
  field: { type: 'float' },
  column: (meta) => ({ align: 'right', render: numberRenderer(meta, true) })
};
const entityColumn = {
  field: (meta) => ({ type: 'zxselect', props: { entity: referencedResource(meta) } }),
  column: (meta) => ({ render: (row) => entityLabel(rowValue(row, meta), row, meta) })
};
const booleanColumn = {
  field: { type: 'toggle' },
  column: (meta) => ({
    align: 'center',
    render: (row) => Boolean(rowValue(row, meta)) ? '✓' : '',
    sortValue: (row) => Number(Boolean(rowValue(row, meta)))
  })
};
const enumColumn = {
  field: (meta) => ({ type: enumFieldType(meta), options: enumOptions(meta) }),
  column: (meta) => ({ render: enumRenderer(meta) })
};
const priorityColumn = {
  field: { type: 'zxselect', props: { preset: 'priority' } },
  column: (meta) => ({ render: enumRenderer(meta, priorityOptions()) })
};
const percentColumn = {
  field: { type: 'float', props: { min: 0, max: 100 } },
  column: (meta) => ({
    align: 'right',
    render: (row) => formatPercent(rowValue(row, meta)),
    sortValue: (row) => finiteNumber(rowValue(row, meta))
  })
};
const dateColumn = dateStrategy('date');
const dateTimeColumn = dateStrategy('datetime');

for (const type of ['string', 'text', 'character', 'character varying', 'varchar', 'email', 'tel', 'url', 'uri']) {
  registerFieldType(type, plainColumn);
}
for (const type of ['integer', 'smallint', 'bigint', 'int', 'int2', 'int4', 'int8', 'int32', 'int64']) {
  registerFieldType(type, intColumn);
}
for (const type of ['number', 'numeric', 'decimal', 'real', 'double', 'double precision', 'float']) {
  registerFieldType(type, floatColumn);
}
for (const type of ['money', 'currency', 'price', 'pricebilling', 'priceprocurement', 'priceproduction']) {
  registerFieldType(type, moneyColumn);
}
for (const type of ['entity', 't_entity']) registerFieldType(type, entityColumn);
for (const type of ['boolean', 'checked']) registerFieldType(type, booleanColumn);
for (const type of ['list', 'enum']) registerFieldType(type, enumColumn);
for (const type of ['progress', 'percent']) registerFieldType(type, percentColumn);
for (const type of ['date']) registerFieldType(type, dateColumn);
for (const type of ['datetime', 'date-time']) registerFieldType(type, dateTimeColumn);
registerFieldType('priority', priorityColumn);
registerFieldType('text[]', { field: { type: 'valuelist' }, column: {} });
registerFieldType('json', { field: { type: 'textarea' }, column: {} });
registerFieldType('longtext', { field: { type: 'textarea' }, column: {} });

// Typed-input semantics share a plain column, but add the appropriate native input hint.
for (const type of ['email', 'tel', 'url', 'uri']) {
  registerFieldType(type, {
    field: { type: 'text', props: { type: type === 'uri' ? 'url' : type } },
    column: {}
  });
}

/** @param {'date'|'datetime'} type @returns {FieldTypeStrategy} */
function dateStrategy(type) {
  return {
    field: { type },
    column: (meta) => ({
      render: (row) => formatUnixDate(rowValue(row, meta), type === 'datetime'),
      sortValue: (row) => unixSortValue(rowValue(row, meta))
    })
  };
}

/** @param {FieldMeta} meta @returns {FieldTypeStrategy} */
function strategyFor(meta) {
  const key = strategyKey(meta);
  const strategy = TYPE_MAP[key];
  if (strategy) return strategy;
  if (!warnedUnknownTypes.has(key)) {
    warnedUnknownTypes.add(key);
    console.warn(`[zx.zeyos] Unknown field type or format "${key || 'unknown'}" for "${meta.id}"; using text.`);
  }
  return plainColumn;
}

/** @param {FieldMeta} meta @returns {string} */
function strategyKey(meta) {
  const semantic = normalizeType(meta.format ?? meta.semanticFormat ?? meta.semanticType ?? meta.widget);
  if (semantic && TYPE_MAP[semantic]) return semantic;
  if (referencedResource(meta) || normalizeType(meta.type) === 't_entity') return 'entity';
  if (String(meta.id).toLowerCase() === 'priority') return 'priority';
  if (meta.enums != null || meta.enum != null) return 'enum';

  const raw = normalizeType(meta.type);
  if (raw === 'bigint' || raw === 'int64') {
    const id = String(meta.id).toLowerCase();
    if (id === 'date' && meta.indexed) return 'date';
    if (/(?:date|time)$/.test(id)) return 'datetime';
  }
  if (isLongText(meta, raw)) return 'longtext';
  if (raw && TYPE_MAP[raw]) return raw;
  if (raw.endsWith('[]')) return raw === 'text[]' ? 'text[]' : 'text[]';
  if (raw === 'json' || raw === 'jsonb') return 'json';
  if (/^character varying(?:\(\d+\))?$/.test(raw)) return 'character varying';
  // An unfamiliar semantic hint is not useful on its own; the runtime DB type is the
  // reliable fallback exposed by the current client.
  return raw || semantic;
}

/** @param {FieldMeta} meta @returns {FieldMeta & {id: string}} */
function normalizeMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new TypeError('Field metadata must be an object');
  const id = meta.id ?? meta.name ?? meta.field ?? meta.identifier ?? meta.reference;
  if (id == null || String(id).trim() === '') throw new TypeError('Field metadata requires an id or name');
  return { ...meta, id: String(id) };
}

/** @param {unknown} part @param {FieldMeta} meta @returns {Record<string, unknown>} */
function strategyPart(part, meta) {
  const value = typeof part === 'function' ? part(meta) : part;
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

/** @param {unknown} value @returns {string} */
function normalizeType(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** @param {FieldMeta} meta @returns {string} */
function fieldLabel(meta) {
  const label = meta.label ?? meta.title ?? meta.displayName;
  return label == null || label === '' ? humanize(meta.id) : String(label);
}

/** @param {unknown} value @returns {string} */
function humanize(value) {
  const source = String(value ?? '').split('.').at(-1) ?? '';
  if (source === 'ID') return 'ID';
  const words = source
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : source;
}

/** @param {FieldMeta} meta @returns {boolean} */
function isReadonly(meta) {
  return meta.readonly === true || meta.readOnly === true || meta.writable === false || meta.mutable === false;
}

/** @param {FieldMeta} meta @param {string} raw @returns {boolean} */
function isLongText(meta, raw) {
  if (meta.long === true || meta.multiline === true) return true;
  const length = Number(meta.maxLength ?? raw.match(/^character varying\((\d+)\)$/)?.[1]);
  return Number.isFinite(length) && length > 255;
}

/** @param {FieldMeta} meta @returns {string|null} */
function referencedResource(meta) {
  for (const candidate of [meta.entity, meta.fk, meta.relation, meta.reference, meta.references]) {
    if (typeof candidate === 'string' && candidate) return candidate;
    if (candidate && typeof candidate === 'object') {
      const resource = candidate.resource ?? candidate.target ?? candidate.table ?? candidate.entity;
      if (typeof resource === 'string' && resource) return resource;
    }
  }
  return null;
}

/** @param {unknown} collection @returns {Map<string, FieldMeta>} */
function normalizeFieldCollection(collection) {
  const fields = new Map();
  if (Array.isArray(collection)) {
    for (const entry of collection) {
      if (typeof entry === 'string') fields.set(entry, {});
      else if (entry && typeof entry === 'object') {
        const id = entry.id ?? entry.name ?? entry.field;
        if (id != null) fields.set(String(id), { ...entry });
      }
    }
  } else if (collection && typeof collection === 'object') {
    for (const [id, definition] of Object.entries(collection)) {
      fields.set(id, definition && typeof definition === 'object' ? { ...definition } : {});
    }
  }
  return fields;
}

/** @param {Record<string, any>} schema @param {string} resource @param {string} field @returns {unknown} */
function schemaEnum(schema, resource, field) {
  if (typeof schema.enums !== 'function') return null;
  const found = schema.enums(resource, field);
  if (found && typeof found === 'object' && !Array.isArray(found) && Object.prototype.hasOwnProperty.call(found, field)) {
    return found[field];
  }
  return found ?? null;
}

/** @param {FieldMeta} meta @returns {Record<string, string>} */
function enumOptions(meta) {
  return normalizeEnumOptions(meta.enums ?? meta.enum ?? meta.options);
}

/** @param {unknown} values @returns {Record<string, string>} */
function normalizeEnumOptions(values) {
  if (typeof values === 'string') {
    try {
      return normalizeEnumOptions(JSON.parse(values));
    } catch {
      return {};
    }
  }
  if (Array.isArray(values)) {
    return Object.fromEntries(values.map((entry, index) => {
      if (Array.isArray(entry)) {
        const [value = index, label = value] = entry;
        return [String(value), String(label)];
      }
      if (entry && typeof entry === 'object') {
        const value = entry.value ?? entry.id ?? index;
        return [String(value), String(entry.label ?? entry.name ?? value)];
      }
      return [String(index), String(entry)];
    }));
  }
  if (values && typeof values === 'object') {
    return Object.fromEntries(Object.entries(values).map(([value, label]) => [value, String(label)]));
  }
  return {};
}

/** @param {FieldMeta} meta @returns {'optionlist'|'select'} */
function enumFieldType(meta) {
  return Object.keys(enumOptions(meta)).length <= 5 ? 'optionlist' : 'select';
}

/** @returns {Record<string, string>} */
function priorityOptions() {
  return { '0': 'LOWEST', '1': 'LOW', '2': 'MEDIUM', '3': 'HIGH', '4': 'HIGHEST' };
}

/** @param {FieldMeta} meta @param {Record<string, string>} [fallback] @returns {(row: Record<string, unknown>) => string} */
function enumRenderer(meta, fallback = {}) {
  const labels = { ...fallback, ...enumOptions(meta) };
  return (row) => {
    const value = rowValue(row, meta);
    if (value == null) return '';
    return labels[String(value)] ?? String(value);
  };
}

/** @param {FieldMeta} meta @param {boolean} [currency=false] @returns {(row: Record<string, unknown>) => string} */
function numberRenderer(meta, currency = false) {
  let formatter;
  try {
    formatter = new Intl.NumberFormat(meta.locale, currency && meta.currency
      ? { style: 'currency', currency: String(meta.currency) }
      : {});
  } catch {
    formatter = new Intl.NumberFormat();
  }
  return (row) => {
    const value = finiteNumber(rowValue(row, meta));
    return value == null ? '' : formatter.format(value);
  };
}

/** @param {unknown} value @returns {number|null} */
function finiteNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** @param {unknown} value @returns {string} */
function formatPercent(value) {
  const number = finiteNumber(value);
  return number == null ? '' : `${new Intl.NumberFormat().format(number)}%`;
}

/** @param {unknown} value @param {boolean} includeTime @returns {string} */
function formatUnixDate(value, includeTime) {
  if (value == null || value === '') return '';
  try {
    const date = value instanceof Date ? value : unixSecondsToDate(/** @type {number|string} */ (value));
    if (!date || !Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, includeTime
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { dateStyle: 'medium' }).format(date);
  } catch {
    return '';
  }
}

/** @param {unknown} value @returns {number|null} */
function unixSortValue(value) {
  if (value instanceof Date) return dateToUnixSeconds(value);
  return finiteNumber(value);
}

/** @param {Record<string, unknown>} row @param {FieldMeta} meta @returns {unknown} */
function rowValue(row, meta) {
  if (!row || typeof row !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(row, meta.id)) return row[meta.id];
  const path = String(meta.path ?? meta.field ?? meta.id).split('.');
  let value = row;
  for (const part of path) {
    if (!value || typeof value !== 'object') return undefined;
    value = value[part];
  }
  return value;
}

/** @param {unknown} value @param {Record<string, unknown>} row @param {FieldMeta} meta @returns {string} */
function entityLabel(value, row, meta) {
  if (value && typeof value === 'object') {
    const label = value.label ?? value.name ?? value.title ?? value.number ?? value.ID ?? value.id;
    return label == null ? '' : String(label);
  }
  const labelField = meta.labelField;
  if (typeof labelField === 'string' && row[labelField] != null) return String(row[labelField]);
  for (const key of [`${meta.id}.name`, `${meta.id}_label`, `${meta.id}Label`]) {
    if (row[key] != null) return String(row[key]);
  }
  return value == null ? '' : String(value);
}
