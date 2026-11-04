// @ts-check
/**
 * The input schemas of a surface: a restricted JSON Schema, turned into Fieldset fields and used
 * to check what a person submits.
 *
 * The subset is the one MCP elicitation's form mode uses: one flat object with `required`, whose
 * properties are `string`, `number`, `integer` or `boolean` (a `string` may offer `enum` or `oneOf`
 * of `{const, title}`, and carry `format` `date`, `date-time`, `time`, `email` or `uri`), or a
 * multiple choice: an `array` whose `items` are such an `enum` or `anyOf` of `{const, title}`.
 * `minimum`/`maximum`, `minLength`/`maxLength`, `minItems`/`maxItems`, `default`, `title` and
 * `description` complete it. An `x-zx` member may name the Field type that draws a property and
 * carry its `visible` condition. There are no patterns, no nesting and no secret inputs.
 *
 * The module touches no DOM, so it runs unchanged in a browser and on a server.
 */
import { checkRules, isEmptyAnswer, ruleMessage } from '../questionnaire/conditions.js';

/** @typedef {import('../questionnaire/conditions.js').RuleMessage} RuleMessage */
/** @typedef {import('../questionnaire/conditions.js').Condition} Condition */
/** @typedef {import('../questionnaire/conditions.js').ConditionProblem} ConditionProblem */

/** @typedef {'date'|'date-time'|'time'|'email'|'uri'} SchemaFormat */

/**
 * One choice of an `enum` written with its title.
 * @typedef {{const: string, title: string}} SchemaChoice
 */

/**
 * The surface's own hint on a property.
 * @typedef {Object} SchemaHint
 * @property {string} [field] The Field type that draws the property; see `FIELD_TYPES`.
 * @property {Condition} [visible] Shows the property only while the condition holds.
 */

/**
 * One property of an input schema.
 * @typedef {Object} SchemaProperty
 * @property {'string'|'number'|'integer'|'boolean'|'array'} type What the value is.
 * @property {string} [title] The label. Every property should have one.
 * @property {string} [description] A supporting line under the field.
 * @property {unknown} [default] The value the field starts with.
 * @property {string[]} [enum] The allowed values of a `string`, shown as they are.
 * @property {SchemaChoice[]} [oneOf] The allowed values of a `string`, each with a title.
 * @property {SchemaFormat} [format] A named format of a `string`.
 * @property {number} [minimum] Lowest number.
 * @property {number} [maximum] Highest number.
 * @property {number} [minLength] Fewest characters.
 * @property {number} [maxLength] Most characters.
 * @property {{type?: 'string', enum?: string[], anyOf?: SchemaChoice[]}} [items] The choices of
 *   an `array`.
 * @property {number} [minItems] Fewest choices of an `array`.
 * @property {number} [maxItems] Most choices of an `array`.
 * @property {SchemaHint} [x-zx] The surface's own hint.
 */

/**
 * An input schema: one flat object.
 * @typedef {Object} InputSchema
 * @property {'object'} type Always `object`.
 * @property {Record<string, SchemaProperty>} properties The inputs, in the order they are shown.
 * @property {string[]} [required] The inputs that need a value.
 * @property {string} [$schema] The JSON Schema dialect; ignored.
 */

/**
 * A construct outside the subset, or a malformed one. `path` is a JSON Pointer into the schema.
 * @typedef {{path: string, message: string}} SchemaProblem
 */

/**
 * The options of one Fieldset field, as `schemaToFields()` returns them.
 * @typedef {Object} SchemaField
 * @property {string} type Registered Field type.
 * @property {string} label Visible label: the title, or the property name.
 * @property {string} [description] Supporting line.
 * @property {boolean} required Whether a value is needed.
 * @property {unknown} [value] The starting value.
 * @property {string} [placeholder] Placeholder text.
 * @property {Record<string, string>} [options] Values and labels of a `select` or `optionlist`.
 * @property {Record<string, unknown>} [props] Properties of the control.
 */

/**
 * A value that failed its schema.
 * @typedef {{name: string, message: string}} ValueProblem
 */

/**
 * What `checkValue()` returns.
 * @typedef {Object} CheckedValues
 * @property {Record<string, string|number|boolean|string[]>} values The submitted values as JSON:
 *   every visible property that has a value, in schema order. Hidden properties, empty optional
 *   ones and names outside the schema are left out.
 * @property {ValueProblem[]} errors One entry per invalid property, in schema order.
 */

/** The named string formats. */
export const SCHEMA_FORMATS = Object.freeze(/** @type {SchemaFormat[]} */ (['date', 'date-time', 'time', 'email', 'uri']));

/** Most properties one schema may declare. */
export const MAX_SCHEMA_PROPERTIES = 50;

/** Most choices one property may offer. */
export const MAX_SCHEMA_CHOICES = 64;

/**
 * The Field types a property may name in `x-zx.field`, by what the property is. The first is the
 * default. No kind offers a password, hidden, HTML, upload or custom field.
 */
export const FIELD_TYPES = Object.freeze({
  text: Object.freeze(['text', 'textarea']),
  date: Object.freeze(['date']),
  'date-time': Object.freeze(['datetime']),
  time: Object.freeze(['text']),
  email: Object.freeze(['text']),
  uri: Object.freeze(['text']),
  choice: Object.freeze(['select', 'optionlist', 'zxselect']),
  number: Object.freeze(['number', 'slider', 'rating']),
  boolean: Object.freeze(['checkbox', 'toggle']),
  multiple: Object.freeze(['checklist', 'tagpicker'])
});

/** Highest `maximum` a `rating` field may have. */
const MAX_RATING = 10;

/** Names a property may not have. */
const FORBIDDEN_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

/** What a property name looks like: it becomes a key of the reply's `values`. */
const NAME = /^(?!(?:__proto__|constructor|prototype)$)[A-Za-z_][A-Za-z0-9_.-]{0,63}$/;

const TOP_KEYS = new Set(['type', 'properties', 'required', '$schema']);
const COMMON_KEYS = ['type', 'title', 'description', 'default', 'x-zx'];
const KEYS = Object.freeze({
  string: new Set([...COMMON_KEYS, 'enum', 'oneOf', 'format', 'minLength', 'maxLength']),
  number: new Set([...COMMON_KEYS, 'minimum', 'maximum']),
  integer: new Set([...COMMON_KEYS, 'minimum', 'maximum']),
  boolean: new Set(COMMON_KEYS),
  array: new Set([...COMMON_KEYS, 'items', 'minItems', 'maxItems'])
});

/**
 * Lists the constructs of a schema that lie outside the subset, and the malformed ones. An empty
 * list means `schemaToFields()` and `checkValue()` can take the schema. An `x-zx.visible`
 * condition is only checked for being an object here; its grammar and the inputs it may name
 * belong to the surface that holds the schema.
 * @param {unknown} schema Schema to check.
 * @returns {SchemaProblem[]}
 */
export function unsupported(schema) {
  /** @type {SchemaProblem[]} */
  const problems = [];
  if (!isObject(schema)) return [{ path: '', message: 'A schema must be an object' }];
  for (const key of Object.keys(schema)) {
    if (!TOP_KEYS.has(key)) problems.push({ path: `/${escape(key)}`, message: `"${key}" is not supported in an input schema` });
  }
  if (schema.type !== 'object') problems.push({ path: '/type', message: 'An input schema must be of type "object"' });
  if (Object.hasOwn(schema, '$schema') && typeof schema.$schema !== 'string') {
    problems.push({ path: '/$schema', message: '"$schema" must be a string' });
  }
  const properties = schema.properties;
  if (!isObject(properties)) {
    problems.push({ path: '/properties', message: 'An input schema needs "properties"' });
    return problems;
  }
  const names = Object.keys(properties);
  if (names.length > MAX_SCHEMA_PROPERTIES) {
    problems.push({ path: '/properties', message: `An input schema may have at most ${MAX_SCHEMA_PROPERTIES} properties` });
  }
  for (const name of names) {
    const path = `/properties/${escape(name)}`;
    if (FORBIDDEN_NAMES.has(name) || !NAME.test(name)) {
      problems.push({ path, message: `"${name}" is not a usable property name` });
      continue;
    }
    for (const problem of propertyProblems(properties[name])) problems.push({ path: path + problem.path, message: problem.message });
  }
  if (Object.hasOwn(schema, 'required')) {
    const required = schema.required;
    if (!Array.isArray(required) || !required.every((name) => typeof name === 'string')) {
      problems.push({ path: '/required', message: '"required" must be a list of property names' });
    } else {
      required.forEach((name, index) => {
        if (!Object.hasOwn(properties, name)) problems.push({ path: `/required/${index}`, message: `"${name}" is not a property` });
      });
    }
  }
  return problems;
}

/**
 * Lists what is wrong with one property. Paths are relative to the property.
 * @param {unknown} property
 * @returns {SchemaProblem[]}
 */
export function propertyProblems(property) {
  /** @type {SchemaProblem[]} */
  const problems = [];
  if (!isObject(property)) return [{ path: '', message: 'A property must be an object' }];
  const type = property.type;
  if (typeof type !== 'string' || !Object.hasOwn(KEYS, type)) {
    return [{ path: '/type', message: Array.isArray(type)
      ? 'A property has exactly one type'
      : `Type ${JSON.stringify(type)} is not supported; use string, number, integer, boolean or a multiple-choice array` }];
  }
  const allowed = KEYS[/** @type {keyof typeof KEYS} */ (type)];
  for (const key of Object.keys(property)) {
    if (!allowed.has(key)) problems.push({ path: `/${escape(key)}`, message: `"${key}" is not supported on a ${type} property` });
  }
  for (const key of ['title', 'description']) {
    if (Object.hasOwn(property, key) && typeof property[key] !== 'string') problems.push({ path: `/${key}`, message: `"${key}" must be a string` });
  }
  for (const key of ['minLength', 'maxLength', 'minItems', 'maxItems']) {
    if (Object.hasOwn(property, key) && !(Number.isInteger(property[key]) && /** @type {number} */ (property[key]) >= 0)) {
      problems.push({ path: `/${key}`, message: `"${key}" must be a whole number of zero or more` });
    }
  }
  for (const key of ['minimum', 'maximum']) {
    if (Object.hasOwn(property, key) && !finite(property[key])) problems.push({ path: `/${key}`, message: `"${key}" must be a finite number` });
  }
  if (finite(property.minimum) && finite(property.maximum) && property.minimum > property.maximum) {
    problems.push({ path: '/minimum', message: '"minimum" is greater than "maximum"' });
  }
  if (type === 'string') {
    const hasEnum = Object.hasOwn(property, 'enum');
    const hasOneOf = Object.hasOwn(property, 'oneOf');
    if (hasEnum && hasOneOf) problems.push({ path: '/oneOf', message: 'Use either "enum" or "oneOf", not both' });
    if (hasEnum) problems.push(...enumProblems(property.enum, '/enum'));
    if (hasOneOf) problems.push(...choiceProblems(property.oneOf, '/oneOf'));
    if (Object.hasOwn(property, 'format')) {
      if (!SCHEMA_FORMATS.includes(/** @type {SchemaFormat} */ (property.format))) {
        problems.push({ path: '/format', message: `"format" must be one of ${SCHEMA_FORMATS.join(', ')}` });
      } else if (hasEnum || hasOneOf) {
        problems.push({ path: '/format', message: 'A property with choices takes no "format"' });
      }
    }
  }
  if (type === 'array') {
    const items = property.items;
    if (!isObject(items)) {
      problems.push({ path: '/items', message: 'A multiple choice needs "items" with "enum" or "anyOf"' });
    } else {
      for (const key of Object.keys(items)) {
        if (key !== 'type' && key !== 'enum' && key !== 'anyOf') problems.push({ path: `/items/${escape(key)}`, message: `"${key}" is not supported in "items"` });
      }
      if (Object.hasOwn(items, 'type') && items.type !== 'string') problems.push({ path: '/items/type', message: 'Choices are strings' });
      if (Object.hasOwn(items, 'enum') === Object.hasOwn(items, 'anyOf')) {
        problems.push({ path: '/items', message: '"items" needs exactly one of "enum" and "anyOf"' });
      } else if (Object.hasOwn(items, 'enum')) {
        problems.push(...enumProblems(items.enum, '/items/enum'));
      } else {
        problems.push(...choiceProblems(items.anyOf, '/items/anyOf'));
      }
    }
  }
  if (Object.hasOwn(property, 'default')) {
    const fault = defaultProblem(/** @type {SchemaProperty} */ (property), property.default);
    if (fault) problems.push({ path: '/default', message: fault });
  }
  if (Object.hasOwn(property, 'x-zx')) {
    const hint = property['x-zx'];
    if (!isObject(hint)) {
      problems.push({ path: '/x-zx', message: '"x-zx" must be an object' });
    } else {
      for (const key of Object.keys(hint)) {
        if (key !== 'field' && key !== 'visible') problems.push({ path: `/x-zx/${escape(key)}`, message: `"${key}" is not supported in "x-zx"` });
      }
      if (Object.hasOwn(hint, 'visible') && !isObject(hint.visible)) {
        problems.push({ path: '/x-zx/visible', message: '"visible" must be a condition' });
      }
      if (Object.hasOwn(hint, 'field')) {
        const fault = fieldProblem(/** @type {SchemaProperty} */ (property), hint.field);
        if (fault) problems.push({ path: '/x-zx/field', message: fault });
      }
    }
  }
  return problems;
}

/**
 * Turns a schema into the options of Fieldset fields, keyed and ordered by property name. Run
 * `unsupported()` first: a schema outside the subset throws.
 * @param {InputSchema} schema An input schema within the subset.
 * @returns {Record<string, SchemaField>}
 * @throws {TypeError} When the schema is outside the subset.
 */
export function schemaToFields(schema) {
  const problems = unsupported(schema);
  if (problems.length) throw new TypeError(`Unsupported input schema: ${problems.map(describe).join('; ')}`);
  const required = new Set(schema.required ?? []);
  /** @type {Record<string, SchemaField>} */
  const fields = {};
  for (const [name, property] of Object.entries(schema.properties)) {
    fields[name] = propertyField(name, property, required.has(name));
  }
  return fields;
}

/**
 * The Fieldset field for one property.
 * @param {string} name @param {SchemaProperty} property @param {boolean} required
 * @returns {SchemaField}
 */
function propertyField(name, property, required) {
  const kind = kindOf(property);
  const type = property['x-zx']?.field ?? FIELD_TYPES[kind][0];
  /** @type {SchemaField} */
  const field = { type, label: property.title || name, required };
  if (property.description) field.description = property.description;
  const hasDefault = Object.hasOwn(property, 'default');
  if (hasDefault) field.value = property.default;
  /** @type {Record<string, unknown>} */
  const props = {};

  switch (kind) {
    case 'text':
    case 'email':
    case 'uri':
    case 'time':
      if (property.minLength !== undefined) props.minLength = property.minLength;
      if (property.maxLength !== undefined) props.maxLength = property.maxLength;
      if (kind === 'email') props.inputMode = 'email';
      if (kind === 'uri') props.inputMode = 'url';
      if (kind === 'time') {
        props.inputMode = 'numeric';
        field.placeholder = 'HH:MM';
      }
      if (kind === 'email' || kind === 'uri' || kind === 'time') props.spellcheck = false;
      break;
    case 'date':
    case 'date-time':
      break;
    case 'choice': {
      const choices = choicesOf(property);
      if (type === 'zxselect') {
        props.items = choices.map(([value, label]) => ({ value, label }));
        props.valueKey = 'value';
        props.labelKey = 'label';
        props.clearable = !required;
      } else {
        /** @type {Record<string, string>} */
        const options = {};
        // A native select starts on its first option, so an empty one comes first unless the
        // field is required and already has its value.
        if (type === 'select' && !(required && hasDefault)) options[''] = '';
        // Choice values become keys: defined, never assigned, so `__proto__` stays a value.
        for (const [value, label] of choices) Object.defineProperty(options, value, { value: label, enumerable: true, writable: true, configurable: true });
        field.options = options;
      }
      break;
    }
    case 'number':
      if (type === 'rating') {
        props.max = property.maximum ?? 5;
        props.clearable = !required;
      } else {
        if (property.minimum !== undefined) props.min = property.minimum;
        if (property.maximum !== undefined) props.max = property.maximum;
        if (property.type === 'integer') props.step = 1;
        if (type === 'number' && property.type === 'integer') props.precision = 0;
        if (type === 'slider') props.showValue = true;
      }
      break;
    case 'boolean':
      if (!hasDefault) field.value = false;
      break;
    case 'multiple': {
      const items = choicesOf(property).map(([value, label]) => ({ value, label }));
      props.items = items;
      props.valueKey = 'value';
      props.labelKey = 'label';
      if (type === 'checklist') props.search = items.length > 8;
      if (type === 'tagpicker' && property.maxItems !== undefined) props.max = property.maxItems;
      break;
    }
    default:
      break;
  }
  if (Object.keys(props).length) field.props = props;
  return field;
}

/**
 * Checks submitted values against a schema and returns them as JSON. Hidden properties are skipped
 * entirely: they are not required and not part of the result. Whatever a Field holds internally
 * comes back as JSON: a `Date` becomes `YYYY-MM-DD` for a `date`, a local `YYYY-MM-DDTHH:MM:SS`
 * for a `date-time` and `HH:MM` for a `time`; a numeric string becomes a number for a `number` or
 * `integer`.
 * @param {InputSchema} schema An input schema within the subset.
 * @param {Record<string, unknown>} values The submitted values by property name.
 * @param {Iterable<string>} [hidden=[]] Names of the properties hidden at the moment.
 * @param {RuleMessage} [message] Resolves a message key, as `checkRules()` does.
 * @returns {CheckedValues}
 * @throws {TypeError} When the schema is outside the subset.
 */
export function checkValue(schema, values, hidden = [], message = ruleMessage) {
  const problems = unsupported(schema);
  if (problems.length) throw new TypeError(`Unsupported input schema: ${problems.map(describe).join('; ')}`);
  const skip = new Set(hidden);
  const required = new Set(schema.required ?? []);
  const source = isObject(values) ? values : {};
  /** @type {CheckedValues} */
  const result = { values: {}, errors: [] };
  for (const [name, property] of Object.entries(schema.properties)) {
    if (skip.has(name)) continue;
    const value = toJsonValue(property, Object.hasOwn(source, name) ? source[name] : undefined);
    const empty = isEmptyAnswer(value) || (property.type === 'boolean' && value !== true && value !== false);
    if (empty) {
      if (required.has(name)) result.errors.push({ name, message: message('required') });
      continue;
    }
    const typeKey = typeProblem(property, value);
    const fault = typeKey ? typeMessage(typeKey, message) : checkRules(rulesOf(property), value, message);
    if (fault) {
      result.errors.push({ name, message: fault });
      continue;
    }
    result.values[name] = /** @type {string|number|boolean|string[]} */ (value);
  }
  return result;
}

/**
 * Brings what a Field holds into the JSON a reply carries. Values that cannot be brought are
 * returned as they are, for `checkValue()` to report.
 * @param {SchemaProperty} property The property's schema.
 * @param {unknown} value What the Field holds.
 * @returns {unknown}
 */
export function toJsonValue(property, value) {
  if (value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const format = property.type === 'string' ? property.format : undefined;
    const date = `${String(value.getFullYear()).padStart(4, '0')}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    const time = `${pad(value.getHours())}:${pad(value.getMinutes())}`;
    if (format === 'time') return time;
    if (format === 'date-time') return `${date}T${time}:${pad(value.getSeconds())}`;
    return date;
  }
  switch (property.type) {
    case 'number':
    case 'integer':
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') return null;
        const number = Number(trimmed);
        return Number.isFinite(number) ? number : value;
      }
      return value;
    case 'string':
      return typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
    case 'array':
      return Array.isArray(value) ? value.map((entry) => (typeof entry === 'number' && Number.isFinite(entry) ? String(entry) : entry)) : value;
    default:
      return value;
  }
}

/**
 * The values a property offers, each with its label, in order.
 * @param {SchemaProperty} property
 * @returns {Array<[string, string]>}
 */
export function choicesOf(property) {
  const source = property.type === 'array' ? property.items ?? {} : property;
  if (Array.isArray(source.enum)) return source.enum.map((value) => [value, value]);
  const list = property.type === 'array' ? /** @type {{anyOf?: SchemaChoice[]}} */ (source).anyOf : property.oneOf;
  return Array.isArray(list) ? list.map((choice) => [choice.const, choice.title]) : [];
}

/**
 * What a property is, which decides the Field types it may use.
 * @param {SchemaProperty} property
 * @returns {keyof typeof FIELD_TYPES}
 */
export function kindOf(property) {
  switch (property.type) {
    case 'boolean': return 'boolean';
    case 'number':
    case 'integer': return 'number';
    case 'array': return 'multiple';
    default:
      if (Array.isArray(property.enum) || Array.isArray(property.oneOf)) return 'choice';
      return property.format && Object.hasOwn(FIELD_TYPES, property.format) ? /** @type {keyof typeof FIELD_TYPES} */ (property.format) : 'text';
  }
}

/**
 * The declarative rules a property's constraints amount to.
 * @param {SchemaProperty} property
 * @returns {import('../questionnaire/conditions.js').ValidationRule[]}
 */
function rulesOf(property) {
  /** @type {import('../questionnaire/conditions.js').ValidationRule[]} */
  const rules = [];
  if (property.type === 'string') {
    if (property.format) rules.push({ format: property.format });
    if (property.minLength !== undefined) rules.push({ minLength: property.minLength });
    if (property.maxLength !== undefined) rules.push({ maxLength: property.maxLength });
  }
  if (property.type === 'array') {
    if (property.minItems !== undefined) rules.push({ minLength: property.minItems });
    if (property.maxItems !== undefined) rules.push({ maxLength: property.maxItems });
  }
  if (property.type === 'number' || property.type === 'integer') {
    if (property.minimum !== undefined) rules.push({ minimum: property.minimum });
    if (property.maximum !== undefined) rules.push({ maximum: property.maximum });
  }
  const choices = choicesOf(property);
  if (choices.length) rules.push({ oneOf: choices.map(([value]) => value) });
  return rules;
}

/** English texts of the type messages, used when the message function does not know the key. */
export const TYPE_MESSAGES = Object.freeze({
  string: 'Enter text.',
  number: 'Enter a number.',
  integer: 'Enter a whole number.',
  boolean: 'Choose yes or no.',
  array: 'Choose from the list.'
});

/**
 * Checks a value's JSON type against its property.
 * @param {SchemaProperty} property @param {unknown} value
 * @returns {keyof typeof TYPE_MESSAGES|null} The message key of the expected type, or null when
 *   the type fits.
 */
function typeProblem(property, value) {
  switch (property.type) {
    case 'string': return typeof value === 'string' ? null : 'string';
    case 'number': return typeof value === 'number' && Number.isFinite(value) ? null : 'number';
    case 'integer': return Number.isInteger(value) ? null : 'integer';
    case 'boolean': return typeof value === 'boolean' ? null : 'boolean';
    default: return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? null : 'array';
  }
}

/**
 * @param {keyof typeof TYPE_MESSAGES} key @param {RuleMessage} message
 * @returns {string} The message's text for the key, or the English default.
 */
function typeMessage(key, message) {
  const text = message(key);
  return text && text !== key ? text : TYPE_MESSAGES[key];
}

/** @param {unknown} list @param {string} path @returns {SchemaProblem[]} */
function enumProblems(list, path) {
  if (!Array.isArray(list) || list.length === 0) return [{ path, message: '"enum" needs a non-empty list of strings' }];
  if (list.length > MAX_SCHEMA_CHOICES) return [{ path, message: `At most ${MAX_SCHEMA_CHOICES} choices` }];
  if (!list.every((value) => typeof value === 'string')) return [{ path, message: 'Choices are strings' }];
  if (new Set(list).size !== list.length) return [{ path, message: 'Choices must differ' }];
  return [];
}

/** @param {unknown} list @param {string} path @returns {SchemaProblem[]} */
function choiceProblems(list, path) {
  if (!Array.isArray(list) || list.length === 0) return [{ path, message: 'Needs a non-empty list of {const, title}' }];
  if (list.length > MAX_SCHEMA_CHOICES) return [{ path, message: `At most ${MAX_SCHEMA_CHOICES} choices` }];
  /** @type {SchemaProblem[]} */
  const problems = [];
  const seen = new Set();
  list.forEach((choice, index) => {
    if (!isObject(choice) || Object.keys(choice).some((key) => key !== 'const' && key !== 'title')
      || typeof choice.const !== 'string' || typeof choice.title !== 'string') {
      problems.push({ path: `${path}/${index}`, message: 'A choice is {const, title} with two strings' });
    } else if (seen.has(choice.const)) {
      problems.push({ path: `${path}/${index}/const`, message: 'Choices must differ' });
    } else {
      seen.add(choice.const);
    }
  });
  return problems;
}

/**
 * @param {SchemaProperty} property @param {unknown} value
 * @returns {string|null} Why the default does not fit, or null.
 */
function defaultProblem(property, value) {
  if (typeProblem(property, value)) return `"default" must be a ${property.type === 'array' ? 'list of strings' : property.type}`;
  const choices = choicesOf(property).map(([choice]) => choice);
  if (choices.length) {
    const entries = Array.isArray(value) ? value : [value];
    if (!entries.every((entry) => choices.includes(/** @type {string} */ (entry)))) return '"default" must be one of the choices';
  }
  return null;
}

/**
 * @param {SchemaProperty} property @param {unknown} field
 * @returns {string|null} Why the hint does not fit, or null.
 */
function fieldProblem(property, field) {
  let kind;
  try {
    kind = kindOf(property);
  } catch {
    return 'The property has no usable type';
  }
  const allowed = FIELD_TYPES[kind] ?? [];
  if (typeof field !== 'string' || !allowed.includes(field)) {
    return `"field" must be one of ${allowed.join(', ')} for this property`;
  }
  if (field === 'slider' && !(finite(property.minimum) && finite(property.maximum))) {
    return 'A slider needs "minimum" and "maximum"';
  }
  if (field === 'rating') {
    if (property.type !== 'integer') return 'A rating is an integer';
    if (property.minimum !== undefined && property.minimum > 1) return 'A rating starts at 0 or 1';
    if (property.maximum !== undefined && !(property.maximum >= 1 && property.maximum <= MAX_RATING)) {
      return `A rating goes up to at most ${MAX_RATING}`;
    }
  }
  return null;
}

/** @param {SchemaProblem} problem @returns {string} */
function describe(problem) {
  return problem.path ? `${problem.path}: ${problem.message}` : problem.message;
}

/** @param {unknown} value @returns {value is number} */
function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/** @param {number} value @returns {string} */
function pad(value) {
  return String(value).padStart(2, '0');
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {string} key @returns {string} */
function escape(key) {
  return key.replace(/~/g, '~0').replace(/\//g, '~1');
}
