/**
 * Extracts the component API — options, methods, and events — from the source's JSDoc into
 * `docs/api.json`, which the documentation app renders as tables.
 *
 * `docs/llms.md` describes each component in prose, which is what an agent reads well and what a
 * person reads once. It cannot carry a type or a default per option without becoming a table in
 * markdown, and a hand-written table drifts from the code the moment someone changes a default.
 * The JSDoc already states all four things — `@property {number} [value=0] Description` — so the
 * table is generated from the declaration itself and cannot disagree with it.
 *
 * Each option also says how it is changed on a live component, where the source states it: the
 * setter that takes it, or that it is read at construction and needs a rebuild. See
 * `annotateUpdates()` for what that is derived from and where it stays silent.
 *
 * Run by `npm run build:api`, and by `build:site` before it assembles the site. The output is
 * committed, so a checkout serves the documentation without a build step, exactly as
 * `styles/tokens/modules.css` is.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceDir = join(root, 'src', 'components');
const elementsDir = join(root, 'src', 'elements');
const outFile = join(root, 'docs', 'api.json');

/**
 * Reads every `.js` file under `src/components/`.
 * @returns {Promise<{path: string, source: string}[]>}
 */
async function readSources() {
  const files = [];
  for (const entry of await readdir(sourceDir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const path = join(entry.parentPath ?? entry.path, entry.name);
    files.push({ path, source: await readFile(path, 'utf8') });
  }
  return files;
}

/**
 * Reads a balanced run starting at an opening delimiter, so a type containing its own braces —
 * `{(event: CustomEvent<{value: number}>) => void}` — is taken whole rather than to the first `}`.
 * @param {string} text
 * @param {number} start Index of the opening delimiter.
 * @param {string} open
 * @param {string} close
 * @returns {{value: string, end: number} | null}
 */
function balanced(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === open) depth += 1;
    else if (text[index] === close) {
      depth -= 1;
      if (depth === 0) return { value: text.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
}

/**
 * Joins a JSDoc block's lines, dropping the leading ` * ` and folding continuation lines into the
 * tag they belong to.
 * @param {string} block Comment body, without the `/**` and `*​/`.
 * @returns {string[]} One entry per tag, plus a leading entry for the untagged description.
 */
function tagLines(block) {
  const text = block.split('\n')
    .map((line) => line.replace(/^\s*\*ted?\s?/, '').replace(/^\s*\*\s?/, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return [''];

  // Public methods frequently keep a short tag on the same physical line as the sentence:
  // `/** Opens the panel. @returns {this} */`. Split only JSDoc tags we consume or preserve;
  // package names such as `@zeyos/client` remain ordinary prose.
  const entries = text.split(/\s+(?=@(?:typedef|property|param|returns|fires|event|type|extends|template)\b)/);
  if (entries[0].startsWith('@')) entries.unshift('');
  return entries;
}

/**
 * Parses one `@property` or `@param` tag into its type, name, default, and description.
 * @param {string} entry
 * @returns {{name: string, type: string, default: string|null, optional: boolean, description: string} | null}
 */
function parseMember(entry) {
  const afterTag = entry.replace(/^@\w+\s*/, '');
  const type = balanced(afterTag, 0, '{', '}');
  if (!type) return null;

  let rest = afterTag.slice(type.end).trim();
  let name = '';
  let fallback = null;
  let optional = false;

  if (rest.startsWith('[')) {
    const bracket = balanced(rest, 0, '[', ']');
    if (!bracket) return null;
    optional = true;
    const equals = bracket.value.indexOf('=');
    name = (equals === -1 ? bracket.value : bracket.value.slice(0, equals)).trim();
    fallback = equals === -1 ? null : bracket.value.slice(equals + 1).trim();
    rest = rest.slice(bracket.end).trim();
  } else {
    const match = /^([\w.$]+)\s*/.exec(rest);
    if (!match) return null;
    name = match[1];
    rest = rest.slice(match[0].length);
  }

  return { name, type: type.value.trim(), default: fallback, optional, description: rest.trim() };
}

/**
 * Splits an options typedef into the options proper and the `on*` listeners, which document the
 * component's events: the name is the tag without `on`, and the payload is the `CustomEvent`
 * type argument.
 * @param {ReturnType<typeof parseMember>[]} members
 * @returns {{options: object[], events: object[]}}
 */
function partition(members) {
  const options = [];
  const events = [];

  for (const member of members) {
    if (!/^on[a-z]/.test(member.name)) {
      options.push({
        name: member.name,
        type: member.type,
        default: member.default,
        description: member.description
      });
      continue;
    }
    const detail = /CustomEvent<([\s\S]*)>\s*\)/.exec(member.type);
    events.push({
      name: member.name.slice(2),
      payload: detail ? detail[1].trim() : null,
      // Kept whole. A listener's own sentence is usually thin ("Change listener."), so the
      // documentation app prefers the reference's note where there is one and falls back to this.
      description: member.description
    });
  }
  return { options, events };
}

/**
 * Collects the public methods of a class: the JSDoc's leading sentence, the signature rebuilt from
 * its `@param` tags, and the return type.
 * @param {string} source
 * @param {string} className
 * @returns {object[]}
 */
function methodsOf(source, className) {
  const start = source.indexOf(`export class ${className}`);
  if (start === -1) return [];
  const body = balanced(source, source.indexOf('{', start), '{', '}');
  if (!body) return [];

  const methods = [];
  // The comment must not run across a `*/`. An inline cast — `/** @type {X} */ (expr).focus()` —
  // is a comment that no method follows, and a pattern allowed to span one swallowed the next
  // method's doc block along with it, leaving that method undocumented: sixty-three of them,
  // `Dialog.open` and `Table.commitEdit` among them.
  const pattern = /\/\*\*((?:(?!\*\/)[\s\S])*?)\*\/\s*\n\s*(?:static\s+)?(?:async\s+)?([A-Za-z][\w]*)\s*\(/g;
  for (const match of body.value.matchAll(pattern)) {
    const [description, ...tags] = tagLines(match[1]);
    const name = match[2];
    // `render` is the base class's contract, not something a caller reaches for, and a method with
    // no sentence of its own has nothing to say in a table.
    if (name === 'constructor' || name === 'render' || !description) continue;

    const params = tags.filter((tag) => tag.startsWith('@param')).map(parseMember).filter(Boolean);
    const returns = tags.find((tag) => tag.startsWith('@returns'));
    const returnType = returns ? balanced(returns.replace(/^@returns\s*/, ''), 0, '{', '}') : null;

    methods.push({
      name,
      signature: `${name}(${params.map((p) => (p.optional ? `[${p.name}]` : p.name)).join(', ')})`,
      returns: returnType ? returnType.value.trim() : null,
      description
    });
  }
  return methods;
}

/**
 * The class a typedef documents. Usually the typedef's own base name, but not always — `tree.js`
 * declares `TreeOptions` for `TreeView` — so the file's exported classes decide.
 * @param {string} source
 * @param {string} base Typedef name without the `Options` suffix.
 * @returns {string}
 */
function classFor(source, base) {
  const exported = [...source.matchAll(/export class (\w+)/g)].map((match) => match[1]);
  if (exported.includes(base)) return base;
  // A differently named helper typedef is its own API record. Mapping every typedef in a
  // one-class file to that class made `PromptOptions` silently replace `DialogOptions`, and did
  // the same to other factory/helper records. Tree is the sole deliberate class-name alias.
  if (base === 'Tree' && exported.includes('TreeView')) return 'TreeView';
  return base;
}

/**
 * Replaces a payload named by a typedef with the shape it stands for, so an event row reads
 * `{row, id, index, event}` rather than `TableRowClickDetail`.
 * @param {string|null} payload
 * @param {Map<string, string[]>} shapes
 * @returns {string|null}
 */
function expandPayload(payload, shapes) {
  if (!payload) return null;
  const named = /^(\w+)$/.exec(payload.trim());
  const fields = named && shapes.get(named[1]);
  return fields ? `{${fields.join(', ')}}` : payload;
}

/**
 * Builds the API record for every component that declares an options typedef.
 * @returns {Promise<Record<string, object>>}
 */
export async function collectApi() {
  const components = {};
  const sources = await readSources();
  const pattern = /\/\*\*([\s\S]*?)\*\//g;

  // Every object typedef, so an event payload that names one can be shown as its shape. Both
  // spellings appear: a block of `@property` tags, and a one-liner with the shape inline.
  const shapes = new Map();
  for (const { source } of sources) {
    for (const inline of source.matchAll(/@typedef \{\{([^}]*)\}\} (\w+)/g)) {
      const fields = inline[1].split(',')
        .map((field) => field.split(':')[0].trim())
        .filter(Boolean);
      if (fields.length) shapes.set(inline[2], fields);
    }
    for (const match of source.matchAll(pattern)) {
      const entries = tagLines(match[1]);
      const typedef = entries.find((entry) => /^@typedef \{Object\} \w+/.test(entry));
      if (!typedef) continue;
      const name = /^@typedef \{Object\} (\w+)/.exec(typedef)[1];
      const fields = entries.filter((entry) => entry.startsWith('@property'))
        .map(parseMember).filter(Boolean).map((member) => member.name);
      if (fields.length) shapes.set(name, fields);
    }
  }

  for (const { source } of sources) {
    for (const match of source.matchAll(pattern)) {
      const entries = tagLines(match[1]);
      const typedef = entries.find((entry) => /^@typedef \{Object\} \w+Options\b/.test(entry));
      if (!typedef) continue;

      const base = /^@typedef \{Object\} (\w+)Options\b/.exec(typedef)[1];
      const className = classFor(source, base);
      const members = entries
        .filter((entry) => entry.startsWith('@property'))
        .map(parseMember)
        .filter(Boolean);
      // An exported class may deliberately add no constructor options of its own while still
      // owning public static methods (Grid is the Table-compatible preset extension point).
      // Keep that class record; helper typedefs with no members remain noise and are skipped.
      if (members.length === 0 && !source.includes(`export class ${className}`)) continue;

      const { options, events } = partition(members);
      components[className] = {
        options,
        events: events.map((event) => ({ ...event, payload: expandPayload(event.payload, shapes) })),
        methods: methodsOf(source, className)
      };
    }
  }

  await annotateUpdates(components, sources);

  return Object.fromEntries(Object.keys(components).sort().map((key) => [key, components[key]]));
}

/* ------------------------------------------------------- changing an option later -- */

/**
 * @typedef {Object} OptionUpdate
 * How an option is changed after construction. Exactly one of the two is present.
 * @property {string[]} [methods] The calls that change it on a live component, as they are written:
 *   `setTitle()`, `open()` and `close()`, `update({ label })`.
 * @property {true} [rebuild] The option is read at construction: the component is destroyed and
 *   created again to change it.
 */

/**
 * States, per option, how it is changed after construction — and only where the source says so.
 *
 * Two things in the source say it:
 *
 * 1. **A setter named after the option.** `title` and a public instance method `setTitle()`, on
 *    the class or one it extends. The naming convention is the library's own and holds everywhere.
 * 2. **The custom-element tables** (`src/elements/define.js`, `src/elements/kit.js`). A `<zx-*>`
 *    wrapper has to apply every attribute change to a live component, so its table states for each
 *    option either the call that does it (`set: (component, value) => component.setItems(value)`)
 *    or `rebuild: true` — "the component has no way to take this in place". That is a maintained,
 *    tested statement, but it exists only for the components that have a wrapper.
 *
 * A setter named after the option wins over the table, which is deliberately conservative (a
 * wrapper may rebuild for an option the class has since grown a setter for). An option neither
 * source covers gets no `update` at all: most of those are constructor-only, some are changed by a
 * method under another name (`disabled` by `disable()`), and telling the two apart from names would
 * be a guess. The documentation shows a blank there and says what a blank means.
 * @param {Record<string, {options: Array<Record<string, any>>}>} components API records, annotated in place.
 * @param {{path: string, source: string}[]} sources Component sources.
 * @returns {Promise<void>}
 */
async function annotateUpdates(components, sources) {
  const classes = classIndex(sources);
  const tables = await elementTables();

  for (const [className, record] of Object.entries(components)) {
    const methods = instanceMethods(className, classes);
    const table = tables.get(className);
    for (const option of record.options) {
      const setter = `set${option.name[0].toUpperCase()}${option.name.slice(1)}`;
      if (methods.has(setter)) {
        option.update = { methods: [`${setter}()`] };
        continue;
      }
      const entry = table?.get(option.name);
      if (!entry) continue;
      // A call the table names must be a public method of the class; anything else (a write to
      // `refs`, a helper reaching into the DOM) is the wrapper's business and no API to document.
      if (entry.calls?.length && entry.calls.every((call) => methods.has(call.name))) {
        option.update = { methods: entry.calls.map((call) => call.text) };
      } else if (entry.rebuild) {
        option.update = { rebuild: true };
      }
    }
  }
}

/**
 * Every exported class with the class it extends and the public instance methods it declares.
 * @param {{path: string, source: string}[]} sources
 * @returns {Map<string, {parent: string|null, methods: Set<string>}>}
 */
function classIndex(sources) {
  const classes = new Map();
  for (const { source } of sources) {
    for (const match of source.matchAll(/export class (\w+)(?:\s+extends\s+(\w+))?\s*\{/g)) {
      const body = balanced(source, match.index + match[0].length - 1, '{', '}');
      if (!body) continue;
      const methods = new Set();
      // Members sit at one indent step. Statics configure the class, not an instance, and a
      // leading underscore marks a member as internal.
      for (const member of body.value.matchAll(/^ {2}(?:async\s+)?([a-zA-Z]\w*)\s*\(/gm)) {
        if (member[1] !== 'constructor') methods.add(member[1]);
      }
      classes.set(match[1], { parent: match[2] ?? null, methods });
    }
  }
  return classes;
}

/**
 * The public instance methods of a class, inherited ones included.
 * @param {string} className
 * @param {Map<string, {parent: string|null, methods: Set<string>}>} classes
 * @returns {Set<string>}
 */
function instanceMethods(className, classes) {
  const methods = new Set();
  for (let name = className, depth = 0; name && classes.has(name) && depth < 12; depth += 1) {
    const entry = classes.get(name);
    for (const method of entry.methods) methods.add(method);
    name = entry.parent;
  }
  return methods;
}

/**
 * @typedef {{name: string, text: string}} SetterCall A method the wrapper calls: its name, and the
 *   call as the documentation writes it.
 * @typedef {Map<string, {calls?: SetterCall[], rebuild?: boolean}>} ElementTable By option name.
 */

/**
 * What the custom-element tables say about each wrapped component's options.
 * @returns {Promise<Map<string, ElementTable>>} By component class name.
 */
async function elementTables() {
  /** @type {Map<string, ElementTable>} */
  const tables = new Map();

  // `kit.js` exports its registrations, so its tables are read as the objects they are and each
  // live setter is run against a recorder to see which methods it calls.
  const { KIT_ELEMENTS } = await import(pathToFileURL(join(elementsDir, 'kit.js')).href);
  for (const [, Component, wrapper] of KIT_ELEMENTS) {
    const table = new Map();
    for (const definition of Object.values(wrapper.attrs ?? {})) {
      if (!definition.option) continue;
      if (typeof definition.set === 'function') table.set(definition.option, { calls: recordCalls(definition.set, definition.option) });
      else if (definition.rebuild) table.set(definition.option, { rebuild: true });
    }
    tables.set(Component.name, table);
  }

  // `define.js` keeps its tables to itself, so they are read from the source: one entry per line,
  // `name: kind({ … })`, inside a `const <NAME>_ATTRS = … attributes({ … })` block that the
  // registration list ties to a class. `tests/unit/api-reference.test.js` checks the reading
  // against the file, so a table written another way fails there instead of going unreported.
  const source = await readFile(join(elementsDir, 'define.js'), 'utf8');
  for (const [, suffix, className, tableName] of source.matchAll(/\['([\w-]+)', (\w+), \{[^}]*attrs: (\w+)\s*\}\]/g)) {
    const start = source.indexOf(`const ${tableName} =`);
    const open = start === -1 ? -1 : source.indexOf('attributes({', start);
    const block = open === -1 ? null : balanced(source, open + 'attributes('.length, '{', '}');
    if (!block) throw new Error(`build-api: cannot read the attribute table of <zx-${suffix}> (${tableName})`);

    const table = new Map();
    for (const line of block.value.split('\n')) {
      const entry = /^\s*(?:'([\w-]+)'|(\w+)):\s*\w+\(\{(.*)\}\),?\s*$/.exec(line);
      if (!entry) {
        if (line.trim() && !line.trim().startsWith('//')) {
          throw new Error(`build-api: unreadable entry in ${tableName}: ${line.trim()}`);
        }
        continue;
      }
      const body = entry[3];
      if (/\boption: null\b/.test(body)) continue;
      const attribute = entry[1] ?? entry[2];
      const option = /\bproperty: '(\w+)'/.exec(body)?.[1]
        ?? attribute.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
      const set = /\bset: (.*?)(?:, get: |$)/.exec(body)?.[1];
      if (set) table.set(option, { calls: sourceCalls(set, source) });
      else if (/\brebuild: true\b/.test(body)) table.set(option, { rebuild: true });
    }
    tables.set(className, table);
  }
  return tables;
}

/**
 * The component methods a setter written in `define.js` calls: those in its own text, or in the
 * body of the module function it names (`set: setDisabled`).
 * @param {string} set Source text of the `set` property.
 * @param {string} source The module.
 * @returns {SetterCall[]} Empty when the setter reaches past the public API.
 */
function sourceCalls(set, source) {
  let text = set;
  const helper = /^(\w+)$/.exec(set.trim());
  if (helper) {
    const start = source.indexOf(`function ${helper[1]}(`);
    const body = start === -1 ? null : balanced(source, source.indexOf('{', start), '{', '}');
    if (!body) return [];
    text = body.value;
  }
  // Writing to `refs` or the root element is not something an application is told to do.
  if (/component\.(refs|el)\b/.test(text)) return [];
  const names = [...new Set([...text.matchAll(/component\.(\w+)\(/g)].map((match) => match[1]))];
  return names.filter(isMutator).map((name) => ({ name, text: `${name}()` }));
}

/**
 * Runs a live setter against a stand-in component and reports the methods it called on it.
 * @param {(component: any, value: any) => void} set The table's setter.
 * @param {string} option Option the setter belongs to.
 * @returns {SetterCall[]} Empty when the setter reaches past the public API or could not be run.
 */
function recordCalls(set, option) {
  /** @type {Map<string, string>} */
  const calls = new Map();
  let opaque = false;

  /** @param {string|null} name @param {number} depth @returns {any} */
  const standIn = (name, depth) => new Proxy(function () {}, {
    get(_target, key) {
      if (key === Symbol.iterator) return function* () {};
      if (key === Symbol.toPrimitive) return () => '';
      if (typeof key === 'symbol') return undefined;
      return standIn(key, depth + 1);
    },
    set() { opaque = true; return true; },
    ownKeys: () => [],
    getOwnPropertyDescriptor: () => undefined,
    apply(_target, _self, args) {
      // Depth 1 is a method of the component itself; deeper is something reached through it.
      if (depth === 1 && name) {
        const [first] = args;
        const keys = first && typeof first === 'object' && !Array.isArray(first) ? Object.keys(first) : [];
        // `update({ label: value })` reads better with its argument than as a bare `update()`.
        calls.set(name, keys.length === 1 && keys[0] === option ? `${name}({ ${option} })` : `${name}()`);
      } else if (depth > 1) {
        opaque = true;
      }
      return standIn(null, depth + 1);
    }
  });

  // Both truths, so a setter that branches (`value ? expand() : collapse()`) shows both calls.
  for (const value of [true, false, 'value', []]) {
    try { set(standIn(null, 0), value); } catch { return []; }
  }
  if (opaque) return [];
  return [...calls].filter(([name]) => isMutator(name)).map(([name, text]) => ({ name, text }));
}

/** @param {string} name Method name. @returns {boolean} Whether it changes something, by its name. */
function isMutator(name) {
  return !/^(get|is|has)(?=[A-Z]|$)/.test(name);
}

// Importing this module must not write anything: `tests/unit/api-reference.test.js` calls
// `collectApi()` to check the committed file still matches the source.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const api = await collectApi();
  await writeFile(outFile, `${JSON.stringify(api, null, 2)}\n`);

  const stated = Object.values(api).flatMap((entry) => entry.options).filter((option) => option.update);
  const totals = Object.values(api).reduce((sum, entry) => ({
    options: sum.options + entry.options.length,
    methods: sum.methods + entry.methods.length,
    events: sum.events + entry.events.length
  }), { options: 0, methods: 0, events: 0 });

  console.log('Zx API → docs/api.json');
  console.log(`  ${Object.keys(api).length} components`);
  console.log(`  ${totals.options} options, ${totals.methods} methods, ${totals.events} events`);
  console.log(`  ${stated.filter((option) => option.update.methods).length} options with a setter, `
    + `${stated.filter((option) => option.update.rebuild).length} read at construction`);
}
