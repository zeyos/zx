import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build, transform } from 'esbuild';
import { buildSubset, componentNames, resolveSubset } from '../../bin/zx-css.js';
import { compareSizes } from '../../tools/check-size.js';

/*
 * `zx-css` writes the stylesheet for the components an application uses, so a mistake here does
 * not fail anywhere near this repository: it renders somebody's Select unstyled. Everything below
 * runs against the real source tree, except the cases that have to stay true whatever the library
 * happens to contain, which get a small package of their own.
 */
const root = fileURLToPath(new URL('../../', import.meta.url));
const bin = join(root, 'bin/zx-css.js');
const CORE = 'styles/core.css';

/**
 * The import list `styles/zx.css` had when it was one flat list, which is the order the rules of
 * every existing consumer's stylesheet come in. New sheets may join it; these keep their places.
 */
const ORDER = `
  ./tokens/global.css ./tokens/themes.css ./tokens/semantic.css ./tokens/dark.css
  ./tokens/modules.css ./base.css ./icons.css ./prose.css
  kbd/kbd button/button badge/badge check-button/check-button empty-state/empty-state layout/layout
  truncate/truncate loading/spinner loading/progress-bar loading/inline-loading skeleton/skeleton
  copy/copy-button copy/copy-input prose/prose code-editor/code-editor toolbar/toolbar toggle/toggle
  groupbox/groupbox card/card aurora/aurora panel/panel master-panel/master-panel tabbox/tabbox
  navigation-bar/navigation-bar search/search app-icon/app-icon launcher/launcher avatar/avatar
  entity-ref/entity-ref file-item/file-item file-list/file-list activity-item/activity-item
  activity-list/activity-list account-menu/account-menu workspace-switcher/workspace-switcher
  app-rail/app-rail module-bar/module-bar app-sidebar/app-sidebar message/message modal/modal
  dialog/dialog sheet/sheet dropdown/dropdown tooltip/tooltip split-view/split-view dock/dock
  menu-button/menu-button context-menu/context-menu select/select checklist/checklist
  tag-picker/tag-picker number-field/number-field slider/slider rating/rating date-picker/date-picker
  date-picker/time-picker datebox/datebox date-picker/date-range-picker datebox/date-range-box
  timebox/timebox calendar/calendar view/record-view table/table table-view/table-view
  stat-tile/stat-tile card-view/card-view kanban-view/kanban-view view-settings/view-settings
  grid/grid chart/chart tree/tree finder/finder data-filter/data-filter filter-panel/filter-panel
  list-toolbar/list-toolbar filter/filter sort-control/sort-control pagination/pagination
  stepper/stepper breadcrumb/breadcrumb field/field fieldset/fieldset form/form
  value-list/value-list multi-value-editor/multi-value-editor field-upload/field-upload
  questionnaire/questionnaire block-view/block-view run-status/run-status composer/composer
  approval-card/approval-card run-trace/run-trace source-list/source-list agent-thread/agent-thread
  ./print.css
`.trim().split(/\s+/).map((entry) => (entry.startsWith('./') ? entry : `../src/components/${entry}.css`));

/**
 * @param {string} sheet Stylesheet relative to the root.
 * @returns {string[]} The `url()` of each import, as written.
 */
function importsOf(sheet) {
  return [...readFileSync(join(root, sheet), 'utf8').matchAll(/@import url\("([^"]+)"\)/g)]
    .map((match) => match[1]);
}

/** @returns {string[]} The component stylesheets in `zx.css`, relative to the root. */
function componentPart() {
  return importsOf('styles/zx.css')
    .filter((url) => url.startsWith('../src/components/'))
    .map((url) => url.slice('../'.length));
}

/** @param {string[]} subset A resolved subset. */
function assertOrdered(subset) {
  assert.equal(subset[0], CORE, 'a subset starts with the core sheet');
  assert.equal(new Set(subset).size, subset.length, 'a subset holds each file once');
  assert.deepEqual(subset.slice(1), componentPart().filter((sheet) => subset.includes(sheet)));
}

/**
 * Writes a throwaway package.
 * @param {Record<string, string>} files Paths and contents.
 * @param {import('node:test').TestContext} context Removes the package afterwards.
 * @returns {string} Its root.
 */
function fixture(files, context) {
  const directory = mkdtempSync(join(tmpdir(), 'zx-css-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), contents);
  }
  return directory;
}

/**
 * A package with three components: `a` draws `b` without importing it, and `b` and `c` stand alone.
 * @param {string} source The source of `a`.
 * @returns {Record<string, string>} Its files.
 */
function threeComponents(source) {
  return {
    'styles/zx.css': ['./core.css', '../src/components/c/c.css', '../src/components/b/b.css',
      '../src/components/a/a.css'].map((url) => `@import url("${url}");`).join('\n'),
    'styles/core.css': '.zx-scope { color: inherit; }',
    'src/components/a/a.css': '.zx-a { color: inherit; }',
    'src/components/a/a.js': source,
    'src/components/b/b.css': '.zx-b { color: inherit; }\n.zx-b__part { color: inherit; }',
    'src/components/b/b.js': '',
    'src/components/c/c.css': '.zx-c { color: inherit; }',
    'src/components/c/c.js': ''
  };
}

test('a leaf component is the core sheet and its own stylesheet', () => {
  const subset = resolveSubset(['kbd']);
  assertOrdered(subset);
  assert.deepEqual(subset, [CORE, 'src/components/kbd/kbd.css']);
});

test('Select draws its own listbox, so it needs its own stylesheet and no other', () => {
  const subset = resolveSubset(['select']);
  assertOrdered(subset);
  assert.deepEqual(subset, [CORE, 'src/components/select/select.css']);
});

test('Table brings the editors in its import graph, in zx.css order', () => {
  const subset = resolveSubset(['table']);
  assertOrdered(subset);
  for (const sheet of ['button/button', 'select/select', 'date-picker/date-picker', 'datebox/datebox', 'table/table']) {
    assert.ok(subset.includes(`src/components/${sheet}.css`), `${sheet}.css is missing from Table's subset`);
  }
  assert.equal(subset.includes('src/components/table-view/table-view.css'), false,
    'a sheet that only styles a table in context is not part of Table');
});

test('several components share one subset, each file once', () => {
  const subset = resolveSubset(['table', 'select', 'kbd', 'select']);
  assertOrdered(subset);
  assert.ok(subset.includes('src/components/kbd/kbd.css'));
});

test('a block reached only through a class name in source is in the subset', (context) => {
  const named = fixture(threeComponents("export const part = h('div', { class: 'zx-b__part' });\n"), context);
  assert.deepEqual(resolveSubset(['a'], { root: named }),
    [CORE, 'src/components/b/b.css', 'src/components/a/a.css']);

  // The real thing: CardView draws its loading rows with `zx-skeleton` and imports no Skeleton.
  assert.ok(resolveSubset(['card-view']).includes('src/components/skeleton/skeleton.css'));
});

test('a block reached through the import graph or a root class is in the subset', (context) => {
  const imported = fixture(threeComponents("import { B } from '../b/b.js';\n"), context);
  assert.ok(resolveSubset(['a'], { root: imported }).includes('src/components/b/b.css'));

  const rooted = fixture(threeComponents("class A { static cssName = 'c'; }\n"), context);
  assert.ok(resolveSubset(['a'], { root: rooted }).includes('src/components/c/c.css'));
});

test('a class in a comment and a DOM event of the same name reach nothing', (context) => {
  const quiet = fixture(threeComponents([
    '/** Looks like `.zx-b` but is not drawn here. */',
    "// import { B } from '../b/b.js';",
    "this.listen(trigger, 'zx-b', stop);",
    "for (const type of ['zx-c', 'zx-open']) this.listen(host, `zx-${type}`, stop);",
    ''
  ].join('\n')), context);
  assert.deepEqual(resolveSubset(['a'], { root: quiet }), [CORE, 'src/components/a/a.css']);
});

test('a block belongs to the sheet that defines it, not to one that styles it in context', (context) => {
  const inContext = threeComponents("export const part = 'zx-b';\n");
  inContext['src/components/c/c.css'] = '.zx-c .zx-b { color: inherit; }\n.zx-b .zx-c { color: inherit; }';
  assert.deepEqual(resolveSubset(['a'], { root: fixture(inContext, context) }),
    [CORE, 'src/components/b/b.css', 'src/components/a/a.css']);

  // `.zx-grid` is the layout primitive: `grid.css` is the Grid component's and never names it.
  const borrowed = threeComponents("export const part = 'zx-b';\n");
  borrowed['src/components/b/b.css'] = '.zx-b-billing { color: inherit; }';
  borrowed['src/components/c/c.css'] = '.zx-b { color: inherit; }';
  assert.deepEqual(resolveSubset(['a'], { root: fixture(borrowed, context) }),
    [CORE, 'src/components/c/c.css', 'src/components/a/a.css']);

  const button = threeComponents("export const part = 'zx-d zx-d__part';\n");
  button['src/components/c/c.css'] = '.zx-d { color: inherit; }\n.zx-d__part { color: inherit; }';
  assert.deepEqual(resolveSubset(['a'], { root: fixture(button, context) }),
    [CORE, 'src/components/c/c.css', 'src/components/a/a.css']);
});

test('every component together is the component part of zx.css', () => {
  const names = componentNames();
  assert.equal(new Set(names).size, names.length, 'two stylesheets share a component name');
  assert.deepEqual(resolveSubset(names), [CORE, ...componentPart()]);

  const union = new Set(names.flatMap((name) => resolveSubset([name])));
  assert.deepEqual(componentPart().filter((sheet) => !union.has(sheet)), []);
});

test('every component resolves, in order', () => {
  for (const name of componentNames()) assertOrdered(resolveSubset([name]));
});

test('no components resolve to the core sheet alone', () => {
  assert.deepEqual(resolveSubset([]), [CORE]);
});

test('an unknown component fails, listing the known ones', () => {
  assert.throws(() => resolveSubset(['select', 'nope']), (error) => {
    assert.match(error.message, /Unknown component: nope/);
    assert.match(error.message, /Known components: .*\bkbd\b.*\bselect\b.*\btable\b/);
    return true;
  });
});

test('zx-css --list prints the subset without writing', () => {
  const output = execFileSync(process.execPath, [bin, 'kbd', '--list'], { encoding: 'utf8' });
  assert.deepEqual(output.trim().split('\n'), resolveSubset(['kbd']));
});

test('zx-css --out writes one stylesheet that starts with the core sheet', (context) => {
  const directory = fixture({}, context);
  const out = join(directory, 'public/nested/zx.css');
  execFileSync(process.execPath, [bin, 'select', '--out', out], { encoding: 'utf8' });
  const css = readFileSync(out, 'utf8');
  assert.equal(css, buildSubset(['select']));
  assert.doesNotMatch(css, /@import/);
  assert.ok(css.indexOf('--zx-gray-0') < css.indexOf('.zx-select'), 'the tokens come first');
  assert.ok(css.indexOf('.zx-prose') < css.indexOf('.zx-select'), 'the whole core sheet comes first');
});

test('zx-css fails on an unknown component and on a missing destination', () => {
  const unknown = spawnSync(process.execPath, [bin, 'nope', '--list'], { encoding: 'utf8' });
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown component: nope\nKnown components: /);

  const bare = spawnSync(process.execPath, [bin, 'select'], { encoding: 'utf8' });
  assert.equal(bare.status, 1);
  assert.match(bare.stderr, /Usage:/);
  assert.equal(bare.stdout, '');
});

test('--min keeps every rule and value', async () => {
  const names = componentNames();
  const css = buildSubset(names);
  const min = buildSubset(names, { min: true });
  assert.ok(min.length < css.length * 0.9, 'minifying barely changed the size');
  assert.doesNotMatch(min, /\/\*/);

  // Normalised by a real CSS parser, a stylesheet and its minified form are the same stylesheet.
  // The parser leaves a custom property's value as written, so its spacing is evened out here.
  const normalise = async (source) => (await transform(source, { loader: 'css', minify: true })).code
    .replace(/\s+/g, ' ').replace(/ ?, ?/g, ',');
  assert.ok(await normalise(min) === await normalise(css), 'minifying changed the stylesheet');
});

test('--layer puts the whole subset in the zx layer', async () => {
  const css = buildSubset(['select'], { layer: true });
  assert.match(css, /^@layer zx \{/);
  assert.equal(rules(css.replace(/\/\*[\s\S]*?\*\//g, '')).length, 1);
  assert.match(buildSubset(['select'], { layer: true, min: true }), /^@layer zx\{/);
  const { warnings } = await transform(css, { loader: 'css' });
  assert.deepEqual(warnings, []);
});

/**
 * Splits a stylesheet into its top-level rules.
 * @param {string} css Stylesheet.
 * @returns {string[]} Rules, comments removed.
 */
function rules(css) {
  const found = [];
  let depth = 0;
  let start = 0;
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '"' || source[index] === "'") {
      index = source.indexOf(source[index], index + 1);
    } else if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}' || (source[index] === ';' && depth === 0)) {
      if (source[index] === '}') depth -= 1;
      if (depth === 0) {
        found.push(source.slice(start, index + 1).trim());
        start = index + 1;
      }
    }
  }
  return found;
}

/**
 * Bundles a stylesheet exactly as `tools/build.js` does.
 * @param {import('esbuild').BuildOptions} entry Entry point.
 * @param {boolean} minify Whether to minify.
 * @returns {Promise<string>} The bundle.
 */
async function bundle(entry, minify) {
  const result = await build({
    ...entry,
    absWorkingDir: root,
    bundle: true,
    minify,
    platform: 'browser',
    target: 'es2022',
    legalComments: 'eof',
    logLevel: 'silent',
    write: false,
    outfile: 'out.css'
  });
  return result.outputFiles[0].text;
}

test('zx.css keeps the order every existing consumer has', () => {
  const flat = [...importsOf('styles/core.css'), ...importsOf('styles/zx.css').slice(1)];
  assert.equal(importsOf('styles/zx.css')[0], './core.css');
  assert.deepEqual(flat.filter((url) => ORDER.includes(url)), ORDER);
  assert.equal(flat.at(-1), './print.css');
});

for (const minify of [false, true]) {
  test(`${minify ? 'zx.min.css' : 'zx.css'} holds the same rules in the same order`, async () => {
    const flat = [...importsOf('styles/core.css'), ...importsOf('styles/zx.css').slice(1)];
    const before = rules(await bundle({
      stdin: {
        contents: flat.map((url) => `@import url("${url}");`).join('\n'),
        resolveDir: join(root, 'styles'),
        loader: 'css'
      }
    }, minify));
    const after = rules(await bundle({ entryPoints: ['styles/zx.css'] }, minify));
    assert.ok(before.length > 1000, 'the stylesheet was not split into rules');
    assert.equal(after.length, before.length);
    const moved = after.findIndex((rule, index) => rule !== before[index]);
    assert.equal(moved, -1, `rule ${moved} moved: ${after[moved]?.slice(0, 120)}`);
  });
}

test('the core bundle is what zx.css starts with', async () => {
  const core = rules(await bundle({ entryPoints: ['styles/core.css'] }, false));
  const all = rules(await bundle({ entryPoints: ['styles/zx.css'] }, false));
  assert.ok(core.length > 100);
  assert.deepEqual(all.slice(0, core.length), core);
});

test('the layered bundle holds no import and leaves no rule outside the zx layer', async () => {
  for (const minify of [false, true]) {
    const layered = rules(await bundle({ entryPoints: ['styles/zx.layered.css'] }, minify));
    assert.ok(layered.length > 50);
    assert.deepEqual(layered.filter((rule) => !/^@layer zx\s*[{;]/.test(rule)), []);
  }
});

test('the size check passes at the budget and names every file over it', (context) => {
  const directory = fixture({ 'a.css': 'a'.repeat(1000), 'b.css': 'b', 'types/ignored.d.ts': 'x' }, context);
  const size = (file) => compareSizes(directory, { 'a.css': 1e6, 'b.css': 1e6 }).rows
    .find((row) => row.file === file).size;
  assert.ok(size('a.css') > 0);

  const within = compareSizes(directory, { 'a.css': size('a.css'), 'b.css': size('b.css') + 5 });
  assert.deepEqual(within.problems, []);
  assert.deepEqual(within.rows.map((row) => row.headroom), [0, 5]);
  assert.deepEqual(within.rows.map((row) => row.file), ['a.css', 'b.css']);

  const over = compareSizes(directory, { 'a.css': 1, 'b.css': 1 });
  assert.equal(over.problems.length, 2);
  assert.match(over.problems[0], /^a\.css: /);
  assert.match(over.problems[1], /^b\.css: /);

  assert.match(compareSizes(directory, { 'a.css': 1e6 }).problems[0], /^b\.css: has no budget/);
  assert.match(compareSizes(directory, { 'a.css': 1e6, 'b.css': 1e6, 'c.css': 1 }).problems[0],
    /^c\.css: has a budget but was not built/);
});

test('the budget lists every bundle the build writes, in whole bytes', () => {
  const budgets = JSON.parse(readFileSync(join(root, 'tools/size-budget.json'), 'utf8'));
  const script = readFileSync(join(root, 'tools/build.js'), 'utf8');
  const expected = [...script.matchAll(/file: '([^']+)'/g)].flatMap(([, file]) => {
    const dot = file.lastIndexOf('.');
    return [file, `${file.slice(0, dot)}.min${file.slice(dot)}`];
  });
  assert.deepEqual(Object.keys(budgets).sort(), expected.sort());
  for (const [file, budget] of Object.entries(budgets)) {
    assert.ok(Number.isInteger(budget) && budget > 0, `${file} has no budget in bytes`);
  }
});
