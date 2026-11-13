import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';

/*
 * What a consumer's bundler can drop when it imports one export.
 *
 * `dist/zx.esm.js` is one file listed in `sideEffects`, so a bundler shakes it statement by
 * statement: a class goes only when nothing with a possible side effect refers to it. A frozen
 * table of classes at module level, or a spread in a static initialiser, is such a reference, and
 * it costs the whole class with everything it imports. Nothing in a diff shows that, and the
 * library still works, so the bundles are checked here.
 *
 * The sources mark such expressions `@__PURE__`. esbuild removes those marks when it minifies, so
 * this holds for `dist/zx.esm.js`, the package entry, and not for `dist/zx.esm.min.js`.
 *
 * The package promises one side effect: the entry registers the component-backed Field adapters
 * (`tests/unit/package-contract.test.js`). Those components therefore stay; everything else goes.
 */
const root = fileURLToPath(new URL('../../', import.meta.url));

/** Component classes the Field adapters do not reach, including every custom-element wrapper target. */
const UNRELATED = [
  'Calendar', 'CardView', 'KanbanView', 'RecordView', 'Table', 'Chart', 'TreeView', 'AgentThread',
  'Composer', 'BlockView', 'RunTrace', 'ApprovalCard', 'SourceList', 'RunStatus', 'Dialog', 'Tabbox',
  'Groupbox', 'Search', 'CheckButton', 'Surface', 'Questionnaire', 'Launcher', 'Grid'
];

/** @param {string} source Unminified bundle. @param {string} name Class name. @returns {boolean} */
const declaresClass = (source, name) => new RegExp(`\\b(?:class ${name}|${name}\\d* = class)\\b`).test(source);

/**
 * Bundles `src/index.js` the way `tools/build.js` writes `dist/zx.esm.js`.
 * @returns {Promise<string>} The distribution module's source.
 */
async function distribution() {
  const result = await build({
    absWorkingDir: root, entryPoints: ['src/index.js'], bundle: true, write: false, format: 'esm',
    platform: 'browser', target: 'es2022', legalComments: 'eof', logLevel: 'silent'
  });
  return result.outputFiles[0].text;
}

/**
 * Bundles a consumer that imports from the distribution module, which keeps its side effects as
 * the `sideEffects` entry for `dist/zx.esm.js` says.
 * @param {string} library The distribution module's source.
 * @param {string} contents Consumer source importing from `zx-dist`.
 * @returns {Promise<string>} The consumer's unminified bundle.
 */
async function consume(library, contents) {
  const result = await build({
    stdin: { contents, resolveDir: root, sourcefile: 'consumer.js' },
    bundle: true, treeShaking: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
    legalComments: 'none', logLevel: 'silent',
    plugins: [{
      name: 'zx-dist',
      setup(context) {
        context.onResolve({ filter: /^zx-dist$/ }, () => ({ path: 'zx.esm.js', namespace: 'zx-dist', sideEffects: true }));
        context.onLoad({ filter: /.*/, namespace: 'zx-dist' }, () => ({ contents: library, loader: 'js' }));
      }
    }]
  });
  return result.outputFiles[0].text;
}

test('one export from the distribution bundle leaves the unrelated components behind', async () => {
  const library = await distribution();
  for (const name of [...UNRELATED, 'Select', 'Slider']) {
    assert.ok(declaresClass(library, name), `${name} is not recognisable in the bundle; adjust the pattern`);
  }

  const consumer = await consume(library, "import { button } from 'zx-dist'; console.log(button);");
  assert.deepEqual(UNRELATED.filter((name) => declaresClass(consumer, name)), [],
    'a module-level statement or static initialiser pins these classes');
  // The promised registration, and so the components behind it, stays.
  assert.match(consumer, /registerFieldAdapters\(\);/);
  assert.ok(declaresClass(consumer, 'Select') && declaresClass(consumer, 'Slider'));
  // Today about a quarter of the bundle; pinned tables made it seven tenths.
  assert.ok(consumer.length < library.length * 0.4,
    `${consumer.length} of ${library.length} bytes are kept for one helper`);
});

test('the custom elements stay out of a bundle that does not define them, and in one that does', async () => {
  const library = await distribution();
  const without = await consume(library, "import { Toggle } from 'zx-dist'; console.log(Toggle);");
  assert.doesNotMatch(without, /customElements\.define\(/);
  assert.doesNotMatch(without, /"kanban-view", KanbanView\d*,/);

  const using = await consume(library, "import { defineElements } from 'zx-dist'; defineElements();");
  assert.match(using, /customElements\.define\(/);
  for (const name of ['Toggle', 'Table', 'Dialog', 'KanbanView', 'Chart']) {
    assert.ok(declaresClass(using, name), `${name} is missing from a bundle that defines the elements`);
  }
});

test('the source entry and the per-component files keep only what they import', async () => {
  /** @param {string} contents @returns {Promise<string[]>} Source modules with bytes in the bundle. */
  const modules = async (contents) => {
    const result = await build({
      absWorkingDir: root, stdin: { contents, resolveDir: root, sourcefile: 'consumer.js' },
      bundle: true, treeShaking: true, write: false, metafile: true, format: 'esm', platform: 'browser',
      target: 'es2022', logLevel: 'silent'
    });
    const [output] = Object.values(result.metafile.outputs);
    return Object.keys(output.inputs).filter((path) => output.inputs[path].bytesInOutput > 0);
  };

  const entry = await modules("import { button } from './src/index.js'; console.log(button);");
  assert.ok(entry.includes('src/components/select/field-adapter.js'), 'the entry registers its adapters');
  assert.deepEqual(entry.filter((path) => /^src\/(?:elements\/|components\/(?:calendar|card-view|kanban-view|table|chart|view)\/)/.test(path)), []);

  const granular = await modules(
    "import { Slider } from './src/components/slider/slider.js';"
    + "import { Toggle } from './src/components/toggle/toggle.js';"
    + "import { setTranslator } from './src/core/i18n.js'; console.log(Slider, Toggle, setTranslator);");
  assert.ok(granular.includes('src/core/i18n.js'));
  // No registration and no entry: only the two components and what they are built from.
  assert.deepEqual(granular.filter((path) => /field-adapter\.js$|^src\/(?:index\.js|elements\/|components\/(?:field|select)\/)/.test(path)), []);
  assert.ok(granular.length < entry.length / 2, `${granular.length} modules against ${entry.length} through the entry`);
});
