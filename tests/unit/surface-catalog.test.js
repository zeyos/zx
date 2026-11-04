import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CATALOG, INTENTS, LIMITS, narrowCatalog, surfacePrompt, surfaceSchema, surfaceTools, workedExamples
} from '../../src/components/surface/catalog.js';
import { inlineSplitter } from '../../src/components/surface/stream.js';
import { createValidationState, validateDocument, validateOp } from '../../src/components/surface/validate.js';
import { agentCatalogFiles } from '../../tools/build-agent-catalog.js';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const api = JSON.parse(readFileSync(join(root, 'docs/api.json'), 'utf8'));

/* ------------------------------------------------------------------------------------------------
 * A JSON Schema validator for exactly the keywords the generator uses. Any other keyword fails
 * the test rather than being ignored, so a schema cannot pass by using what is not checked here.
 * --------------------------------------------------------------------------------------------- */

const ANNOTATIONS = new Set(['$schema', '$defs', 'title', 'description']);
const KEYWORDS = new Set(['$ref', 'type', 'enum', 'const', 'properties', 'required', 'additionalProperties', 'propertyNames',
  'items', 'minItems', 'maxItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'maxProperties', 'anyOf', 'not']);

/**
 * @param {object} root The schema with its `$defs`.
 * @returns {(value: unknown) => string[]} Lists the paths that fail.
 */
function compile(root) {
  const defs = root.$defs ?? {};
  const typeOf = (value) => (value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value);
  const matchesType = (type, value) => {
    const actual = typeOf(value);
    return type === actual || (type === 'number' && actual === 'integer');
  };
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  /** @returns {string[]} */
  const check = (schema, value, path) => {
    for (const key of Object.keys(schema)) {
      if (!KEYWORDS.has(key) && !ANNOTATIONS.has(key)) throw new Error(`Unsupported keyword ${key} at ${path}`);
    }
    if (schema.$ref) {
      const name = schema.$ref.replace('#/$defs/', '');
      if (!defs[name]) throw new Error(`Missing $defs/${name}`);
      return check(defs[name], value, path);
    }
    const errors = [];
    if (schema.type && ![].concat(schema.type).some((type) => matchesType(type, value))) return [`${path}: type`];
    if (schema.enum && !schema.enum.some((entry) => equal(entry, value))) return [`${path}: enum`];
    if (Object.hasOwn(schema, 'const') && !equal(schema.const, value)) return [`${path}: const`];
    if (schema.not && check(schema.not, value, path).length === 0) return [`${path}: not`];
    if (schema.anyOf && !schema.anyOf.some((branch) => check(branch, value, path).length === 0)) return [`${path}: anyOf`];
    if (typeof value === 'string') {
      if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: maxLength`);
      if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: minLength`);
      if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errors.push(`${path}: pattern`);
    }
    if (typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: minimum`);
      if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: maximum`);
    }
    if (Array.isArray(value)) {
      if (schema.maxItems !== undefined && value.length > schema.maxItems) return [`${path}: maxItems`];
      if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: minItems`);
      if (schema.items) value.forEach((entry, index) => errors.push(...check(schema.items, entry, `${path}/${index}`)));
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const keys = Object.keys(value);
      if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) return [`${path}: maxProperties`];
      for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${path}/${key}: required`);
      for (const key of keys) {
        if (schema.propertyNames) errors.push(...check(schema.propertyNames, key, `${path}/${key} (name)`));
        if (schema.properties && Object.hasOwn(schema.properties, key)) errors.push(...check(schema.properties[key], value[key], `${path}/${key}`));
        else if (schema.additionalProperties === false) errors.push(`${path}/${key}: additional`);
        else if (schema.additionalProperties) errors.push(...check(schema.additionalProperties, value[key], `${path}/${key}`));
      }
    }
    return errors;
  };
  return (value) => check(root, value, '');
}

/** Parses JSON so keys such as `__proto__` arrive as own properties. */
const parse = (value) => JSON.parse(typeof value === 'string' ? value : JSON.stringify(value));

/**
 * Fills in `null` for every key a strict schema requires and the value leaves out, as a model
 * under strict structured output writes it.
 */
function strictify(schema, value, defs) {
  if (schema.$ref) return strictify(defs[schema.$ref.replace('#/$defs/', '')], value, defs);
  if (schema.anyOf) {
    const validate = (branch, candidate) => compile({ ...branch, $defs: defs })(candidate).length === 0;
    for (const branch of schema.anyOf) {
      const filled = strictify(branch, value, defs);
      if (validate(branch, filled)) return filled;
    }
    return value;
  }
  if (Array.isArray(value) && schema.items) return value.map((entry) => strictify(schema.items, entry, defs));
  if (value && typeof value === 'object' && !Array.isArray(value) && schema.properties) {
    const out = {};
    for (const [key, member] of Object.entries(schema.properties)) {
      out[key] = Object.hasOwn(value, key) ? strictify(member, value[key], defs) : null;
    }
    return out;
  }
  return value;
}

/* ------------------------------------------------------------------------------------------------
 * The catalog against docs/api.json
 * --------------------------------------------------------------------------------------------- */

/** Every source file's text, for typedef lookups. */
const SOURCES = (() => {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.js')) files.push(readFileSync(path, 'utf8'));
    }
  };
  walk(join(root, 'src'));
  return files.join('\n');
})();

/** Splits a type at its top-level `|`. @param {string} type @returns {string[]} */
function alternatives(type) {
  const out = [];
  let depth = 0;
  let current = '';
  for (const char of type) {
    if ('<({['.includes(char)) depth += 1;
    if ('>)}]'.includes(char)) depth -= 1;
    if (char === '|' && depth === 0) {
      out.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  out.push(current.trim());
  return out.filter(Boolean);
}

/** The body of `@typedef {…} Name`, or null. @param {string} name @returns {string|null} */
function typedefBody(name) {
  const marker = new RegExp(`@typedef\\s+\\{`, 'g');
  for (let match = marker.exec(SOURCES); match; match = marker.exec(SOURCES)) {
    let depth = 0;
    let index = match.index + match[0].length - 1;
    const start = index;
    for (; index < SOURCES.length; index += 1) {
      if (SOURCES[index] === '{') depth += 1;
      if (SOURCES[index] === '}') depth -= 1;
      if (depth === 0) break;
    }
    const after = SOURCES.slice(index + 1, index + 1 + name.length + 2);
    const body = SOURCES.slice(start + 1, index).replace(/\s*\*\s*/g, ' ');
    // `@typedef {import('…').Name} Name` re-exports the declaration; keep looking for it.
    if (new RegExp(`^\\s+${name}\\b`).test(after) && !/^import\(/.test(body.trim())) return body;
  }
  return null;
}

/** The members of a typedef, from an object type or from `@property` tags. @returns {Map<string, string[]>} */
function membersOf(name) {
  const members = new Map();
  const add = (key, type) => members.set(key, [...(members.get(key) ?? []), type.trim()]);
  const body = typedefBody(name);
  if (body === 'Object') {
    const block = new RegExp(`@typedef\\s+\\{Object\\}\\s+${name}\\b([\\s\\S]*?)\\*/`).exec(SOURCES)?.[1] ?? '';
    for (const match of block.matchAll(/@property\s+\{([^}]*)\}\s+\[?([\w$]+)/g)) add(match[2], match[1]);
  } else if (body) {
    for (const branch of alternatives(body)) {
      const inner = branch.trim().replace(/^\{/, '').replace(/\}$/, '');
      for (const match of inner.matchAll(/([\w$]+)\??:\s*((?:[^,{}<>()]|<[^>]*>|\([^)]*\))+)/g)) add(match[1], match[2]);
    }
  }
  return members;
}

/** Catalog named types and the library types they map to. */
const NAMED = {
  Column: ['TableColumn'], Row: ['TableRow'], Figure: ['FigureRow'], Choice: ['QuestionnaireChoice'],
  DiffRow: ['TableRow'], Step: ['QuestionnaireItem'], ChartData: ['ChartData'],
  Schema: ['Record<string,FieldOptions|Field|Element|Component>']
};

/**
 * Whether a library type can take a catalog property's values.
 * @param {object} member The catalog property. @param {string} type The library type.
 */
function compatible(member, type, depth = 0) {
  const flat = type.replace(/\s+/g, '');
  let alts = alternatives(flat);
  // Resolve named aliases a level or three down: StatTileFormat → 'number'|'currency'|…
  for (let round = 0; round < 3; round += 1) {
    alts = alts.flatMap((alt) => {
      if (!/^[A-Z]\w*$/.test(alt) || Object.values(NAMED).flat().includes(alt)) return [alt];
      const body = typedefBody(alt);
      return body && body !== 'Object' ? alternatives(body.replace(/\s+/g, '')) : [alt];
    });
  }
  if (alts.some((alt) => ['unknown', '*', 'any'].includes(alt))) return true;
  const literal = (value) => alts.includes(typeof value === 'string' ? `'${value}'` : String(value));
  const has = (name) => alts.includes(name);
  if (member.enum) {
    return member.enum.every((value) => literal(value) || (typeof value === 'string' ? has('string') : has('number')));
  }
  switch (member.type) {
    case 'string': return has('string');
    case 'integer':
    case 'number': return has('number');
    case 'boolean': return has('boolean');
    case 'number|string': return has('number') && has('string');
    case 'string[]': return has('string[]') || has('Array<string>');
    case 'Ref': return false;
    default: {
      if (member.type.endsWith('[]')) {
        const targets = NAMED[member.type.slice(0, -2)] ?? [];
        return targets.some((target) => has(`${target}[]`) || has(`Array<${target}>`));
      }
      return (NAMED[member.type] ?? []).some((target) => has(target) || flat === target);
    }
  }
}

test('every catalog property names an option of its component in docs/api.json, with a compatible type', () => {
  let checked = 0;
  for (const entry of Object.values(CATALOG.nodes)) {
    if (entry.component === null) {
      for (const [name, member] of Object.entries(entry.props)) assert.equal(member.option, null, `${entry.type}.${name}: a node drawn by the surface maps to no option`);
      continue;
    }
    const component = api[entry.component];
    assert.ok(component, `${entry.type}: ${entry.component} is not in docs/api.json`);
    for (const [name, member] of Object.entries(entry.props)) {
      if (member.option === null) {
        assert.ok(entry.input && name === 'name', `${entry.type}.${name}: only an input's name is the surface's own`);
        continue;
      }
      const [, optionName, element, field] = /^(\w+)(\[\])?(?:\.(\w+))?$/.exec(member.option) ?? [];
      assert.ok(optionName, `${entry.type}.${name}: malformed option ${member.option}`);
      const option = component.options.find((candidate) => candidate.name === optionName);
      assert.ok(option, `${entry.type}.${name}: ${entry.component} has no option "${optionName}"`);
      if (!field) {
        if (member.type === 'Ref') assert.equal(option.type, 'unknown', `${entry.type}.${name}: a record maps to an identifier option`);
        else assert.ok(compatible(member, option.type), `${entry.type}.${name}: ${member.type} does not fit ${option.type}`);
      } else {
        const listed = /^(\w+)\[\]$/.exec(option.type.trim()) ?? /^Array<(\w+)>$/.exec(option.type.trim());
        assert.ok(element && listed, `${entry.type}.${name}: ${optionName} is not a list of entries (${option.type})`);
        const types = membersOf(listed[1]).get(field);
        assert.ok(types, `${entry.type}.${name}: ${listed[1]} has no member "${field}"`);
        assert.ok(types.some((type) => compatible(member, type)), `${entry.type}.${name}: ${member.type} does not fit ${listed[1]}.${field} (${types.join(' / ')})`);
      }
      checked += 1;
    }
  }
  assert.ok(checked > 40, `checked ${checked} properties`);
});

test('the compatibility check rejects what does not fit', () => {
  assert.equal(compatible({ type: 'string' }, 'number|null'), false);
  assert.equal(compatible({ type: 'string', enum: ['sideways'] }, "'neutral'|'accent'"), false);
  assert.equal(compatible({ type: 'Column[]' }, 'TableRow[]'), false);
  assert.equal(compatible({ type: 'string', enum: ['multi'] }, 'TableSelectionMode'), true);
});

/* ------------------------------------------------------------------------------------------------ */

test('the generated files match a fresh generation', () => {
  for (const [path, content] of Object.entries(agentCatalogFiles())) {
    assert.equal(readFileSync(join(root, path), 'utf8'), content, `${path} is stale: run npm run build:catalog`);
  }
});

test('catalog.js imports nothing that touches the DOM', () => {
  assert.equal(typeof globalThis.document, 'undefined');
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)) {
      assert.ok(match[1].startsWith('.'), `${file} imports a package: ${match[1]}`);
      visit(resolve(dirname(file), match[1]));
    }
  };
  visit(join(root, 'src/components/surface/catalog.js'));
  for (const file of seen) {
    assert.ok(!/src\/core\//.test(file), `catalog.js reaches ${file}`);
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\b(?:window|globalThis\.document|HTMLElement|customElements|requestAnimationFrame)\b/, file);
  }
});

test('the schema accepts the worked examples, as lines and as documents', () => {
  const { line, document } = surfaceSchema();
  const checkLine = compile(line);
  const checkDocument = compile(document);
  const tools = Object.fromEntries(surfaceTools().map((tool) => [tool.name, tool]));
  for (const example of workedExamples(CATALOG, 20)) {
    for (const op of example.lines) assert.deepEqual(checkLine(op), [], `${example.title}: ${JSON.stringify(op)}`);
    assert.deepEqual(checkDocument(example.document), [], example.title);
    assert.deepEqual(validateDocument(example.document).errors, [], example.title);
    const tool = example.intent === 'ask' ? tools.ask_user : tools.show_surface;
    const strict = strictify(tool.parameters, example.document, tool.parameters.$defs);
    assert.deepEqual(compile(tool.parameters)(strict), [], `${example.title} under ${tool.name}`);
    assert.deepEqual(validateDocument(strict).errors, [], `${example.title} with nulls`);
  }
});

test('the schema rejects the validator corpus', () => {
  const { line, document } = surfaceSchema();
  const checkLine = compile(line);
  const checkDocument = compile(document);
  const begin = { zx: 'surface/1', op: 'begin', surface: 's1', intent: 'show', title: 'T', author: 'agent', root: ['a'] };
  const link = (href) => ({ op: 'node', surface: 's1', id: 'a', type: 'link', text: 'x', href });
  const deep = `${'['.repeat(10000)}1${']'.repeat(10000)}`;
  const corpus = {
    'javascript: link': link('javascript:alert(1)'),
    'data: link': link('data:text/html,x'),
    'protocol-relative link': link('//evil.example'),
    'http: link': link('http://example.com'),
    'credentials in a link': link('https://user:pw@example.com'),
    '__proto__ at depth': '{"op":"data","surface":"s1","path":"/a","value":{"b":{"__proto__":{"x":1}}}}',
    '10,000-deep nesting': `{"op":"data","surface":"s1","path":"/a","value":${deep}}`,
    'an oversized string': { op: 'node', surface: 's1', id: 'a', type: 'text', text: 'x'.repeat(LIMITS.string + 1) },
    'an oversized list': { op: 'node', surface: 's1', id: 'a', type: 'list', items: Array(LIMITS.rows + 1).fill('x') },
    'an unknown intent': { ...begin, intent: 'wizard' },
    'an unknown node type': { op: 'node', surface: 's1', id: 'a', type: 'webview' },
    'an action setting its confirmation': { op: 'actions', surface: 's1', items: [{ id: 'go', label: 'Go', confirmation: 'none' }] },
    'a token in begin': { ...begin, token: 'x' },
    'root as one id': { ...begin, root: 'a' },
    'a $data pointer without its slash': { op: 'node', surface: 's1', id: 'a', type: 'text', text: { $data: 'x' } },
    'an inline child': { op: 'node', surface: 's1', id: 'a', type: 'stack', children: [{ id: 'b', type: 'text', text: 'x' }] },
    'a condition five deep': { op: 'node', surface: 's1', id: 'a', type: 'text', text: 'x', visible: { not: { not: { not: { not: { field: 'f', op: 'filled' } } } } } },
    'HTML-carrying keys': { op: 'node', surface: 's1', id: 'a', type: 'text', text: 'x', html: '<b>x</b>' }
  };
  for (const [name, op] of Object.entries(corpus)) assert.notDeepEqual(checkLine(parse(op)), [], name);
  assert.notDeepEqual(checkDocument({ zx: 'surface/1', surface: 's1', intent: 'show', title: 'T', author: 'a', root: [], nodes: [], token: 'x' }), [], 'a token in a document');
  // Duplicate ids, a data path through a non-object and a condition naming a later input are
  // valid JSON shapes; only the validator, which sees the whole stream, can tell.
});

test('the strict tools are usable with strict structured output', () => {
  const unsupported = new Set(['minLength', 'maxLength', 'minimum', 'maximum', 'pattern', 'minItems', 'maxItems', 'propertyNames', 'maxProperties', 'oneOf', 'not', 'allOf']);
  for (const tool of surfaceTools()) {
    assert.deepEqual(Object.keys(tool).sort(), ['description', 'name', 'parameters']);
    const { $defs, ...top } = tool.parameters;
    const visit = (schema, path) => {
      if (!schema || typeof schema !== 'object') return;
      if (Array.isArray(schema)) {
        schema.forEach((entry, index) => visit(entry, `${path}/${index}`));
        return;
      }
      for (const key of Object.keys(schema)) assert.ok(!unsupported.has(key), `${tool.name}: ${key} at ${path}`);
      if (schema.type === 'object') {
        assert.equal(schema.additionalProperties, false, `${tool.name}: open object at ${path}`);
        assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort(), `${tool.name}: optional key at ${path}`);
        for (const [key, member] of Object.entries(schema.properties)) visit(member, `${path}/properties/${key}`);
      }
      for (const key of ['items', 'anyOf']) if (schema[key]) visit(schema[key], `${path}/${key}`);
    };
    visit(top, '');
    for (const [name, def] of Object.entries($defs)) visit(def, `#/$defs/${name}`);
    // No recursion: the $ref graph is acyclic.
    const refs = (value) => JSON.stringify(value).match(/#\/\$defs\/\w+/g)?.map((ref) => ref.slice(8)) ?? [];
    const visiting = new Set();
    const done = new Set();
    const walk = (name) => {
      assert.ok(!visiting.has(name), `${tool.name}: $defs/${name} is recursive`);
      if (done.has(name)) return;
      visiting.add(name);
      for (const next of refs($defs[name])) walk(next);
      visiting.delete(name);
      done.add(name);
    };
    for (const name of refs(top)) walk(name);
  }
});

test('ask_user takes an ask surface only, and is left out without ask', () => {
  const tools = surfaceTools();
  assert.deepEqual(tools.map((tool) => tool.name), ['show_surface', 'ask_user']);
  assert.deepEqual(tools[1].parameters.properties.intent, { type: 'string', enum: ['ask'] });
  assert.ok(!JSON.stringify(tools[1].parameters).includes('node_diff'));
  const narrow = narrowCatalog(CATALOG, { intents: ['show', 'review'] });
  assert.deepEqual(surfaceTools(narrow).map((tool) => tool.name), ['show_surface']);
});

test('a narrowed catalog\'s schema, tools and prompt name only its intents and nodes', () => {
  const narrow = narrowCatalog(CATALOG, { intents: ['ask', 'confirm'], nodes: ['text', 'fields', 'stack'] });
  assert.deepEqual(Object.keys(narrow.intents), ['ask', 'confirm']);
  assert.deepEqual(Object.keys(narrow.nodes), ['text', 'stack', 'fields']);
  const gone = Object.keys(CATALOG.nodes).filter((type) => !Object.hasOwn(narrow.nodes, type));
  const goneIntents = INTENTS.filter((intent) => !Object.hasOwn(narrow.intents, intent));

  const { line, document } = surfaceSchema(narrow);
  const tools = surfaceTools(narrow);
  for (const schema of [line, document, ...tools.map((tool) => tool.parameters)]) {
    const text = JSON.stringify(schema);
    for (const type of gone) {
      assert.ok(!text.includes(`"node_${type}"`), `node_${type}`);
      assert.ok(!text.includes(`"enum":["${type}"]`), type);
    }
    for (const intent of goneIntents) assert.ok(!new RegExp(`"enum":\\[[^\\]]*"${intent}"`).test(text.replace(/"op":\{"type":"string","enum":\["\w+"\]\}/g, '')), intent);
  }
  assert.ok(compile(document)({ zx: 'surface/1', surface: 's', intent: 'ask', title: 'T', author: 'a', root: [], nodes: [{ id: 'x', type: 'table', columns: [], rows: [] }] }).length > 0);

  for (const mode of ['tool', 'inline']) {
    const prompt = surfacePrompt(narrow, { mode });
    for (const type of gone) assert.ok(!prompt.includes(`### \`${type}\``), `${mode}: ${type}`);
    for (const intent of goneIntents) assert.ok(!prompt.includes(`| \`${intent}\` |`) && !prompt.includes(`"intent": "${intent}"`) && !prompt.includes(`"intent":"${intent}"`), `${mode}: ${intent}`);
    for (const type of Object.keys(narrow.nodes)) assert.ok(prompt.includes(`### \`${type}\``), `${mode}: ${type}`);
    const fenced = prompt.match(/"type":\s*"(\w+)"/g) ?? [];
    for (const match of fenced) {
      const type = /"(\w+)"$/.exec(match)[1];
      assert.ok(['object', 'string', 'number', 'integer', 'boolean', 'array', ...Object.keys(narrow.nodes)].includes(type), `${mode}: example uses ${type}`);
    }
  }
});

test('narrowCatalog refuses unknown names, an intent left without its node, and widening', () => {
  assert.throws(() => narrowCatalog(CATALOG, { intents: ['wizard'] }), TypeError);
  assert.throws(() => narrowCatalog(CATALOG, { nodes: ['webview'] }), TypeError);
  assert.throws(() => narrowCatalog(CATALOG, { intents: ['ask'], nodes: ['text'] }), /needs a fields node/);
  assert.throws(() => narrowCatalog(CATALOG, { intents: ['choose'], nodes: ['text'] }), /choice/);
  assert.throws(() => narrowCatalog(CATALOG, { intents: ['review'], nodes: ['text'] }), /diff or table/);
  assert.ok(narrowCatalog(CATALOG, { intents: ['review'], nodes: ['table'] }));
  const narrow = narrowCatalog(CATALOG, { intents: ['show'], nodes: ['text'] });
  assert.throws(() => narrowCatalog(narrow, { nodes: ['text', 'stat'] }), TypeError, 'a narrowed catalog cannot be widened again');
  assert.throws(() => surfaceSchema({ ...CATALOG, nodes: { ...CATALOG.nodes, html: { type: 'html', props: {} } } }), TypeError);
  assert.ok(Object.isFrozen(narrow) && Object.isFrozen(CATALOG.nodes.text.props.text));
  const questionnaireGone = narrowCatalog(CATALOG, { intents: ['show', 'ask'] });
  assert.ok(!Object.hasOwn(questionnaireGone.nodes, 'questionnaire'), 'a node of a removed intent leaves with it');
});

test('the inline prompt\'s worked examples pass through inlineSplitter into valid operations', () => {
  const prompt = surfacePrompt(CATALOG, { mode: 'inline' });
  const blocks = [...prompt.matchAll(/^````text\n([\s\S]*?)\n````$/gm)].map((match) => match[1]);
  assert.equal(blocks.length, 2);
  const checkLine = compile(surfaceSchema().line);
  for (const block of blocks) {
    const lines = [];
    const errors = [];
    let prose = '';
    // Fed in uneven chunks, as a model streams.
    const splitter = inlineSplitter({ ontext: (text) => { prose += text; }, online: (line) => lines.push(line), onerror: (error) => errors.push(error) });
    for (let index = 0; index < block.length; index += 7) splitter.write(block.slice(index, index + 7));
    splitter.end();
    assert.deepEqual(errors, []);
    assert.ok(lines.length >= 2);
    assert.ok(!prose.includes('zx-surface') && !prose.includes('"op"'));
    const state = createValidationState();
    for (const text of lines) {
      const op = JSON.parse(text);
      assert.deepEqual(checkLine(op), [], text);
      assert.deepEqual(validateOp(op, state).errors, [], text);
    }
  }
});

test('the prompt has two worked examples per mode, appends the application\'s rules and rejects unknown modes', () => {
  const tool = surfacePrompt(CATALOG, { mode: 'tool', rules: ['Never offer discounts above 10 %.', '  '] });
  assert.equal((tool.match(/^Call `(?:show_surface|ask_user)` with:$/gm) ?? []).length, 2);
  assert.ok(tool.trimEnd().endsWith('}\n```') || tool.includes('## Rules of this application'));
  assert.ok(tool.indexOf('## Rules of this application') > tool.indexOf('## Rules\n'));
  assert.ok(tool.includes('- Never offer discounts above 10 %.'));
  assert.equal((surfacePrompt(CATALOG, { mode: 'inline' }).match(/^```zx-surface$/gm) ?? []).length, 2);
  assert.throws(() => surfacePrompt(CATALOG, { mode: 'email' }), TypeError);
  for (const text of [tool, surfacePrompt(CATALOG, { mode: 'inline' })]) {
    assert.doesNotMatch(text, /specs\/|WP-?\d|AGENTS\.md|review(?:er)?s? (?:fed|of the format)/i);
  }
});

test('the link pattern of the schema refuses what the validator refuses, with or without the u flag', async () => {
  const { HREF_PATTERN } = await import('../../src/components/surface/catalog.js');
  const plain = new RegExp(HREF_PATTERN);
  const unicode = new RegExp(HREF_PATTERN, 'u');
  const cases = {
    'https://ex.com/a?b=c#d': true, 'https://ex.com': true, 'HTTPS://ex.com': false, 'http://ex.com': false, '//ex.com': false,
    'https://u@ex.com': false, 'https://ex.com\\x': false, 'https://ex.com/a b': false, 'https://ex.com/\u0000': false,
    'https://ex.com​.io': false, 'https://ex­.com': false, 'https://ex.com/‮': false, 'https://ex.com/\u{E0041}': false,
    'https://ex.com/\u{1D173}': false, 'https://ex.com/\u{1F600}': true
  };
  for (const [href, expected] of Object.entries(cases)) {
    assert.equal(plain.test(href), expected, JSON.stringify(href));
    assert.equal(unicode.test(href), expected, `${JSON.stringify(href)} (u)`);
    const result = validateDocument({ zx: 'surface/1', surface: 's', intent: 'show', title: 'T', author: 'a', root: ['l'], nodes: [{ id: 'l', type: 'link', text: 'x', href }] });
    assert.equal(result.document.nodes[0].href !== undefined, expected, `validator: ${JSON.stringify(href)}`);
  }
});

test('narrowCatalog refuses a catalog with no node types', () => {
  assert.throws(() => narrowCatalog(CATALOG, { intents: ['confirm'], nodes: [] }), TypeError);
  assert.throws(() => narrowCatalog(CATALOG, { intents: [], nodes: ['text'] }), TypeError);
});

test('a narrowed catalog\'s tool descriptions and prompt name no excluded intent or node', () => {
  const narrow = narrowCatalog(CATALOG, { intents: ['show'], nodes: ['text', 'link'] });
  const tools = surfaceTools(narrow);
  const texts = {
    descriptions: tools.map((tool) => tool.description).join('\n'),
    schema: JSON.stringify(surfaceSchema(narrow)) + JSON.stringify(tools),
    tool: surfacePrompt(narrow, { mode: 'tool' }),
    inline: surfacePrompt(narrow, { mode: 'inline' })
  };
  for (const [name, text] of Object.entries(texts)) {
    for (const word of ['fields', 'table', 'choice', 'choices', 'form', 'review', 'questionnaire', 'confirm', 'diff', 'ask_user', 'values entered']) {
      assert.doesNotMatch(text, new RegExp(`\\b${word}\\b`), `${name}: ${word}`);
    }
  }
  assert.equal(surfaceTools(CATALOG)[0].description.includes('a questionnaire'), true);
});
