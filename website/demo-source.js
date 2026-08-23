/*
 * Reading a demo module's helpers back out of its own text.
 *
 * An example's snippet is recovered from the function the browser just ran, so it shows exactly
 * what is on screen — but only the part that lives inside the example. The data a demo hands its
 * component almost always sits at the top of the module: `catalogue()` for the tree, `makeRows()`
 * for the table, `COLUMNS` for pagination. A snippet that calls one of those without ever showing
 * it leaves the reader guessing what shape the component actually wants, which is the one thing
 * the documentation exists to answer.
 *
 * This module finds those declarations in the module source and hands back the ones an example
 * depends on, transitively. Nothing here is written by hand or kept in step by convention: the
 * site is served unminified, so the module text is the documentation.
 */

/** How many lines one declaration may span before it is taken for a scan gone wrong. */
const MAX_DECLARATION_LINES = 400;

/** Opens a top-level declaration, capturing the keyword and the name it binds. */
const DECLARATION =
  /^(?:export\s+)?(?:(?:async\s+)?(function)\s*\*?\s*|(?:const|let|var)\s+)([A-Za-z_$][\w$]*)\s*[=(]/;

/** A `/` following one of these words opens a regular expression rather than a division. */
const REGEX_PRECEDING = /\b(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;

/** Characters that end a value, after which a `/` can only be a division. */
const VALUE_END = ')]\'"`';

/**
 * Blanks out everything a scanner must not read as structure — string bodies, template text,
 * comments, regular expressions — keeping the length and every newline, so an offset into the
 * result still points at the same character of the original. Interpolations inside a template
 * literal are real code and are left readable; only the text around them goes.
 * @param {string} source
 * @returns {string}
 */
export function maskLiterals(source) {
  /** Innermost context last. A `code` frame is either the module itself or one `${…}`. */
  const frames = [{ kind: 'code', braces: 0, interpolation: false }];
  let out = '';
  let index = 0;

  /** @param {string} value Emitted with everything but its newlines blanked. */
  const blank = (value) => { out += value.replace(/[^\n]/g, ' '); };

  while (index < source.length) {
    const frame = frames[frames.length - 1];
    const char = source[index];
    const next = source[index + 1];

    if (frame.kind === 'template') {
      if (char === '\\') { blank(source.slice(index, index + 2)); index += 2; continue; }
      if (char === '`') { frames.pop(); out += '`'; index += 1; continue; }
      if (char === '$' && next === '{') {
        frames.push({ kind: 'code', braces: 0, interpolation: true });
        out += '${';
        index += 2;
        continue;
      }
      out += char === '\n' ? '\n' : ' ';
      index += 1;
      continue;
    }

    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', index);
      blank(source.slice(index, end === -1 ? source.length : end));
      index = end === -1 ? source.length : end;
      continue;
    }
    if (char === '/' && next === '*') {
      const close = source.indexOf('*/', index + 2);
      const end = close === -1 ? source.length : close + 2;
      blank(source.slice(index, end));
      index = end;
      continue;
    }
    if (char === "'" || char === '"') {
      const end = closingQuote(source, index);
      out += char;
      blank(source.slice(index + 1, end - 1));
      out += source[end - 1] === char ? char : source[end - 1] ?? '';
      index = end;
      continue;
    }
    if (char === '`') {
      frames.push({ kind: 'template' });
      out += '`';
      index += 1;
      continue;
    }
    if (char === '/' && regexAllowed(out)) {
      const end = closingSlash(source, index);
      blank(source.slice(index, end));
      index = end;
      continue;
    }
    if (char === '{') frame.braces += 1;
    if (char === '}') {
      if (frame.braces === 0 && frame.interpolation) frames.pop();
      else frame.braces = Math.max(0, frame.braces - 1);
    }
    out += char;
    index += 1;
  }
  return out;
}

/**
 * @param {string} source
 * @param {number} start Index of the opening quote.
 * @returns {number} The index just past the string, closing quote included when there is one. An
 *   unterminated string stops at its newline, which the caller then emits itself.
 */
function closingQuote(source, start) {
  const quote = source[start];
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === '\\') { index += 1; continue; }
    if (source[index] === quote) return index + 1;
    if (source[index] === '\n') return index;
  }
  return source.length;
}

/**
 * @param {string} source
 * @param {number} start Index of the opening slash.
 * @returns {number} The index just past the closing slash and its flags.
 */
function closingSlash(source, start) {
  let inClass = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\\') { index += 1; continue; }
    if (char === '\n') return index;
    if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    else if (char === '/' && !inClass) return index + 1 + /^[a-z]*/.exec(source.slice(index + 1))[0].length;
  }
  return source.length;
}

/**
 * Whether the slash about to be read opens a regular expression. What came before decides: a value
 * — `)`, `]`, a string, a name, a number — means division; anything else, an operator or a
 * keyword, means a literal.
 * @param {string} emitted Everything masked so far.
 * @returns {boolean}
 */
function regexAllowed(emitted) {
  const before = emitted.replace(/\s+$/, '');
  if (!before) return true;
  const last = before[before.length - 1];
  if (VALUE_END.includes(last)) return false;
  if (/[\w$]/.test(last)) return REGEX_PRECEDING.test(before);
  return true;
}

/**
 * Every declaration a demo module makes at its top level, keyed by the name it binds. Imports and
 * the default export are not things a reader looks up, so they are left out.
 * @param {string} source The demo module's own text.
 * @returns {Map<string, {name: string, label: string, code: string, order: number}>}
 */
export function topLevelDeclarations(source) {
  const lines = source.split('\n');
  const masked = maskLiterals(source).split('\n');
  const declarations = new Map();
  let depth = 0;
  let index = 0;

  while (index < lines.length) {
    const match = depth === 0 ? DECLARATION.exec(masked[index]) : null;
    const end = match ? declarationEnd(masked, index, match[1] === 'function') : null;
    if (end === null) {
      depth += netDepth(masked[index]);
      index += 1;
      continue;
    }

    const start = commentStart(lines, index);
    const code = lines.slice(start, end + 1).join('\n').trimEnd();
    declarations.set(match[2], {
      name: match[2],
      label: labelFor(code, match[2]),
      code,
      order: declarations.size
    });
    index = end + 1;
  }
  return declarations;
}

/**
 * @param {string[]} masked
 * @param {number} start
 * @param {boolean} isFunction A function body ends at the brace that closes it; every other
 *   declaration ends at the semicolon that terminates the statement.
 * @returns {number | null} The last line of the declaration, or null when it never terminates.
 */
function declarationEnd(masked, start, isFunction) {
  let depth = 0;
  let opened = false;
  for (let index = start; index < masked.length && index - start < MAX_DECLARATION_LINES; index += 1) {
    if (/[([{]/.test(masked[index])) opened = true;
    depth += netDepth(masked[index]);
    if (depth > 0) continue;
    if (isFunction ? opened : masked[index].includes(';')) return index;
  }
  return null;
}

/**
 * @param {string} line Already masked, so brackets inside strings and comments are gone.
 * @returns {number} How much deeper the line leaves the scanner.
 */
function netDepth(line) {
  let depth = 0;
  for (const char of line) {
    if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') depth -= 1;
  }
  return depth;
}

/**
 * Walks back over the comment written directly above a declaration. Its JSDoc carries the shape of
 * the data, which is half the reason for showing the declaration at all.
 * @param {string[]} lines
 * @param {number} start
 * @returns {number} The first line to show.
 */
function commentStart(lines, start) {
  let index = start;
  while (index > 0) {
    const previous = lines[index - 1];
    if (/^\s*\/\//.test(previous)) { index -= 1; continue; }
    if (/\*\/\s*$/.test(previous)) {
      let open = index - 1;
      while (open > 0 && !/^\s*\/\*/.test(lines[open])) open -= 1;
      if (!/^\s*\/\*/.test(lines[open])) break;
      index = open;
      continue;
    }
    break;
  }
  return index;
}

/**
 * @param {string} code The declaration, comment included.
 * @param {string} name
 * @returns {string} The name as a reader would write it: callable things keep their parentheses.
 */
function labelFor(code, name) {
  const at = code.search(/^(?:export\s+)?(?:async\s+)?(?:function|const|let|var)\b/m);
  const declaration = at === -1 ? code : code.slice(at);
  const callable = /^(?:export\s+)?(?:async\s+)?function\b/.test(declaration)
    || new RegExp(`^[^\\n]*\\b${name}\\s*=\\s*(?:async\\s*)?(?:function\\b|\\(|[A-Za-z_$][\\w$]*\\s*=>)`)
      .test(declaration);
  return callable ? `${name}()` : name;
}

/**
 * The names a snippet reads. Property accesses and object keys are excluded: `row.money` and
 * `{ money: 4 }` name a field, not the `money` helper that happens to share its spelling.
 * @param {string} code
 * @returns {Set<string>}
 */
export function referencedNames(code) {
  const masked = maskLiterals(code);
  const names = new Set();
  for (const match of masked.matchAll(/[A-Za-z_$][\w$]*/g)) {
    const before = masked.slice(0, match.index).replace(/\s+$/, '');
    const previous = before[before.length - 1] ?? '';
    if (previous === '.') continue;
    const after = masked.slice(match.index + match[0].length);
    // The `$` of an interpolation survives masking, and is punctuation rather than a name.
    if (match[0] === '$' && after.startsWith('{')) continue;
    const isKey = /^\s*:/.test(after) && (previous === '' || previous === '{' || previous === ',');
    if (!isKey) names.add(match[0]);
  }
  return names;
}

/**
 * The module-level declarations one snippet depends on, in the order the module declares them. A
 * helper that leans on another helper brings it along, so the tabs beside an example always add up
 * to something that would run.
 * @param {string} source The demo module's own text.
 * @param {string} snippet The example's source.
 * @returns {{name: string, label: string, code: string}[]}
 */
export function collectDependencies(source, snippet) {
  const declarations = topLevelDeclarations(source);
  if (declarations.size === 0) return [];

  const found = new Map();
  const queue = [...referencedNames(snippet)];
  while (queue.length) {
    const name = queue.shift();
    if (found.has(name)) continue;
    const declaration = declarations.get(name);
    if (!declaration) continue;
    found.set(name, declaration);
    queue.push(...referencedNames(declaration.code));
  }
  return [...found.values()].sort((left, right) => left.order - right.order);
}
