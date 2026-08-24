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
 * Run by `npm run build:api`, and by `build:site` before it assembles the site. The output is
 * committed, so a checkout serves the documentation without a build step, exactly as
 * `styles/tokens/modules.css` is.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceDir = join(root, 'src', 'components');
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

  return Object.fromEntries(Object.keys(components).sort().map((key) => [key, components[key]]));
}

// Importing this module must not write anything: `tests/unit/api-reference.test.js` calls
// `collectApi()` to check the committed file still matches the source.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const api = await collectApi();
  await writeFile(outFile, `${JSON.stringify(api, null, 2)}\n`);

  const totals = Object.values(api).reduce((sum, entry) => ({
    options: sum.options + entry.options.length,
    methods: sum.methods + entry.methods.length,
    events: sum.events + entry.events.length
  }), { options: 0, methods: 0, events: 0 });

  console.log('Zx API → docs/api.json');
  console.log(`  ${Object.keys(api).length} components`);
  console.log(`  ${totals.options} options, ${totals.methods} methods, ${totals.events} events`);
}
