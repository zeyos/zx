import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

/*
 * Two properties of the stylesheets as a whole, neither of which belongs to any one component.
 *
 * The first is direction. A scan of the component tree finds no physical-direction declaration at
 * all: fifty stylesheets use logical properties and the rest need none, so Zx renders correctly in
 * an RTL document today. That state was reached by habit rather than by rule, though, and a habit
 * is one `margin-left: 8px` away from being untrue — the person who writes it will not know there
 * was a rule, which is why the failure below names the file, the selector, the declaration and the
 * replacement instead of saying "RTL".
 *
 * The second is print. `styles/print.css` is the only stylesheet in the package whose whole body is
 * inside a media query, and the only one whose correctness is "changes nothing until it is asked
 * for". Both halves of that are asserted here: it is imported last, and nothing in it escapes the
 * `@media print` block it is meant to live in.
 */
const COMPONENTS = fileURLToPath(new URL('../../src/components/', import.meta.url));
const STYLES = fileURLToPath(new URL('../../styles/', import.meta.url));

/** Physical longhands, each with the logical property that replaces it. */
const PHYSICAL_PROPERTIES = new Map([
  ['margin-left', 'margin-inline-start'],
  ['margin-right', 'margin-inline-end'],
  ['padding-left', 'padding-inline-start'],
  ['padding-right', 'padding-inline-end'],
  ['border-left', 'border-inline-start'],
  ['border-right', 'border-inline-end'],
  ['border-left-color', 'border-inline-start-color'],
  ['border-right-color', 'border-inline-end-color'],
  ['border-left-style', 'border-inline-start-style'],
  ['border-right-style', 'border-inline-end-style'],
  ['border-left-width', 'border-inline-start-width'],
  ['border-right-width', 'border-inline-end-width'],
  ['border-top-left-radius', 'border-start-start-radius'],
  ['border-top-right-radius', 'border-start-end-radius'],
  ['border-bottom-left-radius', 'border-end-start-radius'],
  ['border-bottom-right-radius', 'border-end-end-radius'],
  ['left', 'inset-inline-start'],
  ['right', 'inset-inline-end'],
  ['scroll-margin-left', 'scroll-margin-inline-start'],
  ['scroll-margin-right', 'scroll-margin-inline-end'],
  ['scroll-padding-left', 'scroll-padding-inline-start'],
  ['scroll-padding-right', 'scroll-padding-inline-end']
]);

/** Properties whose value may name a side, and that have a logical keyword for it. */
const KEYWORD_PROPERTIES = new Map([
  ['text-align', 'start / end'],
  ['text-align-last', 'start / end'],
  ['float', 'inline-start / inline-end'],
  ['clear', 'inline-start / inline-end']
]);

/**
 * Properties whose value may name a side and that have no logical keyword at all. These cannot be
 * rewritten, only paired with a `[dir="rtl"]` rule that flips them — so they are reported too, and
 * the pairing is what an allowlist entry asserts.
 */
const ORIGIN_PROPERTIES = new Set([
  'transform-origin', 'perspective-origin', 'object-position',
  'background-position', 'background-position-x'
]);

/** A side named as a whole word, so `var(--zx-pane-left)` and `overflow: hidden` are not sides. */
const SIDE = /(?<![\w-])(left|right)(?![\w-])/;

/**
 * The declarations that are allowed to name a physical side, each with the reason it is not a
 * mistake. Deliberately keyed on the exact declaration in the exact file: an allowlist that
 * exempts a property everywhere is not an allowlist, it is a hole, and the test below fails on an
 * entry that no longer matches anything so the list cannot quietly outlive its reason.
 */
const ALLOWED = [
  {
    file: 'sheet/sheet.css',
    declaration: 'transform-origin: left center',
    why: 'A transform origin is a point in the box, and `transform-origin` has no logical keyword '
      + 'to express it with. The sheet scales toward its own edge from here; flipping it for RTL '
      + 'is the job of a `[dir="rtl"]` rule beside the enter transition that already has one.'
  },
  {
    file: 'sheet/sheet.css',
    declaration: 'transform-origin: right center',
    why: 'The `data-side="end"` half of the pair above, for the same reason.'
  }
];

/**
 * Every innermost style rule in a directory of stylesheets. `@container` and `@media` wrappers
 * contain braces and so never match as a body themselves, which leaves exactly the style rules.
 * @param {string} root Directory to read.
 * @param {string} prefix Path prefix for the reported file name.
 * @returns {Promise<Array<{file: string, selector: string, declarations: string}>>}
 */
async function rules(root, prefix = '') {
  const all = [];
  for await (const entry of glob('**/*.css', { cwd: root })) {
    const css = stripComments(readFileSync(root + entry, 'utf8'));
    for (const [, selector, declarations] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      all.push({ file: prefix + entry, selector: selector.trim().replace(/\s+/g, ' '), declarations });
    }
  }
  return all;
}

/** @param {string} source @returns {string} */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Splits a declaration block into `property: value` pairs, normalized for comparison.
 * @param {string} block Text between the braces of one rule.
 * @returns {Array<{property: string, value: string, text: string}>}
 */
function declarations(block) {
  const found = [];
  for (const part of block.split(';')) {
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    const property = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).trim();
    if (!property || property.startsWith('--')) continue;
    found.push({ property, value, text: `${property}: ${value.replace(/\s+/g, ' ')}` });
  }
  return found;
}

/** Box shorthands whose four-value form addresses a physical left and right edge. */
const BOX_SHORTHANDS = new Set(['margin', 'padding', 'inset']);

/**
 * Splits a value on TOP-LEVEL whitespace, so `calc(-1 * var(--x))` stays one token.
 *
 * Counting spaces is what makes a naive version of this test useless: three of the shorthands in
 * this tree contain `calc()` and every one of them looks like four values to a `split(/\s+/)`.
 * @param {string} value Declaration value.
 * @returns {string[]}
 */
function topLevelParts(value) {
  const out = [];
  let depth = 0;
  let current = '';
  for (const character of value) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (/\s/.test(character) && depth === 0) {
      if (current) out.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  if (current) out.push(current);
  return out;
}

/**
 * Every declaration in the component tree that names a physical side, with the advice for it.
 * @returns {Promise<Array<{file: string, selector: string, text: string, fix: string}>>}
 */
async function physicalDeclarations() {
  const found = [];
  for (const { file, selector, declarations: block } of await rules(COMPONENTS)) {
    for (const { property, value, text } of declarations(block)) {
      const logical = PHYSICAL_PROPERTIES.get(property);
      if (logical) {
        found.push({ file, selector, text, fix: `use \`${logical}\`` });
        continue;
      }
      /*
       * A four-value box shorthand addresses `top right bottom left`, and there is no logical
       * spelling of it — `margin: a b c d` pins an edge physically however the document reads.
       * Only an ASYMMETRIC one is a bug: `padding: 4px 8px` and `margin: 0 0 8px 0` flip to
       * themselves, and flagging those would make the rule noise that gets switched off.
       */
      if (BOX_SHORTHANDS.has(property)) {
        const parts = topLevelParts(value);
        if (parts.length === 4 && parts[1] !== parts[3]) {
          found.push({
            file,
            selector,
            text,
            fix: `split it: \`${property}-block\` + \`${property}-inline\`, or the long forms`
          });
        }
        continue;
      }
      if (!SIDE.test(value)) continue;
      if (KEYWORD_PROPERTIES.has(property)) {
        found.push({ file, selector, text, fix: `use \`${KEYWORD_PROPERTIES.get(property)}\`` });
        continue;
      }
      if (ORIGIN_PROPERTIES.has(property)) {
        found.push({
          file,
          selector,
          text,
          fix: `\`${property}\` has no logical keyword: flip it in a [dir="rtl"] rule and allowlist it`
        });
      }
    }
  }
  return found;
}

/** @param {{file: string, text: string}} declaration @returns {boolean} */
function isAllowed(declaration) {
  return ALLOWED.some((entry) => entry.file === declaration.file
    && entry.declaration === declaration.text);
}

test('component CSS never names a physical side', async () => {
  const offenders = (await physicalDeclarations()).filter((found) => !isAllowed(found));
  const report = offenders
    .map((found) => `  src/components/${found.file}\n    ${found.selector}\n      ${found.text}   →   ${found.fix}`)
    .join('\n');

  assert.deepEqual(offenders, [],
    'Component stylesheets are written with logical properties, so one stylesheet serves an LTR\n'
    + 'and an RTL document without a mirrored copy. These declarations name a physical side:\n\n'
    + report
    + '\n\nRewrite each in its logical form. If the side really is physical — a transform origin, a\n'
    + 'shadow offset — add it to ALLOWED in tests/unit/logical-properties.test.js together with\n'
    + 'the reason, and pair it with a [dir="rtl"] rule that flips it.');
});

test('no allowlist entry outlives the declaration it excuses', async () => {
  const present = await physicalDeclarations();
  const stale = ALLOWED
    .filter((entry) => !present.some((found) => found.file === entry.file && found.text === entry.declaration))
    .map((entry) => `${entry.file} → ${entry.declaration}`);

  assert.deepEqual(stale, [],
    `these allowlist entries no longer match anything and should be deleted: ${stale.join(', ')}`);
});

test('the scanner would catch the declaration this work package removed', () => {
  // `table.css` carried the tree's one physical declaration — `text-align: left` on a column
  // asking for the legacy spelling of `start`. Without this, the scanner could be gutted and
  // still pass, because it is asserting the absence of something.
  const found = declarations('text-align: left; margin-left: 4px; transform-origin: left center;');
  assert.equal(found.length, 3);
  assert.equal(PHYSICAL_PROPERTIES.get('margin-left'), 'margin-inline-start');
  assert.ok(KEYWORD_PROPERTIES.has(found[0].property) && SIDE.test(found[0].value));
  assert.ok(ORIGIN_PROPERTIES.has(found[2].property) && SIDE.test(found[2].value));
  // A side that is only part of a name is not a side.
  assert.equal(SIDE.test('var(--zx-sheet-left)'), false);
  assert.equal(SIDE.test('inset-inline-start'), false);
});

test('styles/zx.css imports the print stylesheet, last', () => {
  const zx = readFileSync(STYLES + 'zx.css', 'utf8');
  const imported = [...zx.matchAll(/@import\s+url\("([^"]+)"\)/g)].map((match) => match[1]);
  assert.ok(imported.includes('./print.css'), 'styles/zx.css does not import ./print.css');
  assert.equal(imported.at(-1), './print.css',
    'print.css must be imported last: it is the last word on paper, and a component imported '
    + 'after it would win the ties it is supposed to win.');
});

test('the print stylesheet is inert on screen', () => {
  const body = stripComments(readFileSync(STYLES + 'print.css', 'utf8')).trim();
  assert.match(body, /^@media\s+print\s*\{/,
    'styles/print.css must open with its @media print block and contain nothing before it');

  let depth = 0;
  let close = -1;
  for (let index = body.indexOf('{'); index < body.length; index += 1) {
    if (body[index] === '{') depth += 1;
    else if (body[index] === '}' && --depth === 0) {
      close = index;
      break;
    }
  }
  assert.notEqual(close, -1, 'styles/print.css has unbalanced braces');
  assert.equal(body.slice(close + 1).trim(), '',
    'styles/print.css has rules outside its @media print block, so it is no longer inert on screen');
});

test('the print stylesheet stays on semantic tokens', async () => {
  /*
   * `tests/lint-tokens.js` reads the component tree and `styles/base.css`; this file is neither,
   * so the same rules are asserted here rather than left unenforced. Colour on paper is the one
   * place a raw value is most tempting — a printable grey — and the one place it would escape.
   */
  const css = stripComments(readFileSync(STYLES + 'print.css', 'utf8'));
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i, 'no hex colors');
  assert.doesNotMatch(css, /\brgba?\s*\(/i, 'no rgb() colors');
  assert.doesNotMatch(css, /\bhsla?\s*\(/i, 'no hsl() colors');
  assert.doesNotMatch(css, /(?<![\w-])(black|white|gray|grey|silver|red|green|blue|orange)(?![\w-])/i,
    'no named colors');
  assert.doesNotMatch(css, /var\(\s*--zx-(?:gray|green|red|amber|blue)-/,
    'no tier-1 palette tokens: print.css consumes the same semantic roles every component does');
});

test('only a status badge asks for its colour on paper', async () => {
  /*
   * `print-color-adjust: exact` overrides the reader's own ink-saving default, so it is spent on
   * the one case where the fill is half the meaning. Anywhere else it is a design system deciding
   * how much toner someone else's printer uses.
   */
  const wrong = (await rules(STYLES))
    .filter(({ file }) => file === 'print.css')
    .filter(({ declarations: block }) => /print-color-adjust/.test(block))
    .filter(({ selector }) => !selector.includes('.zx-badge'))
    .map(({ selector }) => selector);

  assert.deepEqual(wrong, [], `print-color-adjust belongs on status badges only, not on: ${wrong.join(', ')}`);
});
