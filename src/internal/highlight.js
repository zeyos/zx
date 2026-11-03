// @ts-check
/**
 * A small syntax tokenizer for code an agent writes into an answer. It recognises comments,
 * strings, numbers, and keywords — enough to make code readable, never enough to be an editor —
 * and returns segments, never markup, so the caller builds text nodes and spans from them.
 */

/** @typedef {'comment'|'string'|'number'|'keyword'} TokenKind */
/** @typedef {{text: string, token: TokenKind|null}} CodeSegment */

/** A string in single, double, or back quotes; unterminated while it is still being streamed. */
const STRING = /'(?:[^'\\\n]|\\.)*'?|"(?:[^"\\\n]|\\.)*"?|`(?:[^`\\]|\\.)*`?/;
/** A number, digit separators included: `30_000`, `0.5`, `1e3`. */
const NUMBER = /\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b/;
/** A name or a keyword. */
const WORD = /[A-Za-z_$][\w$]*/;

/**
 * What the tokenizer recognises in one language. Comments, strings, numbers, and words are
 * matched in that order from left to right, so a quote inside a comment or a digit inside a name
 * never starts a token of its own.
 * @param {RegExp} comment Line or block comment.
 * @param {string} keywords Space-separated, lower case for caseless languages.
 * @param {{caseless?: boolean, string?: RegExp}} [options]
 * @returns {{pattern: RegExp, keywords: Set<string>, caseless: boolean}}
 */
function grammar(comment, keywords, options = {}) {
  const parts = [['comment', comment], ['string', options.string ?? STRING], ['number', NUMBER], ['word', WORD]];
  return {
    pattern: new RegExp(parts.map(([name, part]) => `(?<${name}>${/** @type {RegExp} */ (part).source})`).join('|'), 'g'),
    keywords: new Set(keywords.split(' ')),
    caseless: Boolean(options.caseless)
  };
}

const SCRIPT_KEYWORDS = 'async await break case catch class const continue debugger default delete do else export '
  + 'extends false finally for from function if import in instanceof let new null of return static super switch '
  + 'this throw true try typeof undefined var void while yield';

const GRAMMARS = Object.freeze({
  javascript: grammar(/\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/, SCRIPT_KEYWORDS),
  typescript: grammar(/\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/, `${SCRIPT_KEYWORDS} abstract as declare enum implements interface keyof `
    + 'namespace private protected public readonly type'),
  json: grammar(/(?!)/, 'true false null', { string: /"(?:[^"\\\n]|\\.)*"?/ }),
  sql: grammar(/--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/, 'and as asc between by case count delete desc distinct else end exists from '
    + 'group having in inner insert interval into is join left limit not null on or order outer right select set sum '
    + 'then union update values when where with', { caseless: true, string: /'(?:[^'\n]|'')*'?/ }),
  python: grammar(/#[^\n]*/, 'and as assert async await break class continue def del elif else except false finally for '
    + 'from global if import in is lambda none nonlocal not or pass raise return true try while with yield', { caseless: false }),
  shell: grammar(/(?<!\S)#[^\n]*/, 'case do done elif else esac export fi for function if in local read return then until while'),
  css: grammar(/\/\*[\s\S]*?(?:\*\/|$)/, 'important inherit initial none unset auto')
});

/** Language names an answer may use, mapped to the grammar that reads them. */
const ALIASES = Object.freeze({
  js: 'javascript', javascript: 'javascript', mjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', typescript: 'typescript', tsx: 'typescript',
  json: 'json',
  sql: 'sql',
  py: 'python', python: 'python',
  sh: 'shell', bash: 'shell', shell: 'shell', zsh: 'shell',
  css: 'css'
});

/**
 * Whether code in this language is coloured.
 * @param {unknown} language
 * @returns {boolean}
 */
export function isHighlighted(language) {
  return Object.hasOwn(ALIASES, String(language ?? '').toLowerCase());
}

/**
 * Splits code into plain and coloured segments. An unknown language is one plain segment.
 * Python's `True`/`None` and SQL's upper-case keywords are matched without regard to case.
 * @param {unknown} language
 * @param {unknown} source
 * @returns {CodeSegment[]}
 */
export function highlight(language, source) {
  const code = source == null ? '' : String(source);
  const name = ALIASES[/** @type {keyof typeof ALIASES} */ (String(language ?? '').toLowerCase())];
  const syntax = name ? GRAMMARS[/** @type {keyof typeof GRAMMARS} */ (name)] : null;
  if (!syntax) return code ? [{ text: code, token: null }] : [];
  const caseless = syntax.caseless || name === 'python';
  /** @type {CodeSegment[]} */
  const out = [];
  let plain = 0;
  for (const match of code.matchAll(syntax.pattern)) {
    if (match[0] === '') continue;
    const groups = /** @type {Record<string, string|undefined>} */ (match.groups);
    /** @type {TokenKind|null} */
    const token = groups.comment ? 'comment' : groups.string ? 'string' : groups.number ? 'number'
      : groups.word && syntax.keywords.has(caseless ? groups.word.toLowerCase() : groups.word) ? 'keyword' : null;
    if (!token) continue;
    const start = Number(match.index);
    if (start > plain) out.push({ text: code.slice(plain, start), token: null });
    out.push({ text: match[0], token });
    plain = start + match[0].length;
  }
  if (plain < code.length) out.push({ text: code.slice(plain), token: null });
  return out;
}
