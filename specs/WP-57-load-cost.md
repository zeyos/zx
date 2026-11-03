# WP57 — Load only what you use: CSS subsets, a layered build, a size budget

The full ESM bundle is 1 MB minified (278 KB gzipped), and the stylesheet is one file of 426 KB
minified (55 KB gzipped). An application can already import one component's JavaScript
(`@zeyos/zx/src/components/select/select.js`), but it still has to load every component's CSS. The
library also offers no way to keep application styles ahead of its own without specificity work,
and nothing notices when a bundle grows. This WP fixes all three without changing anything for
existing consumers.

Work on the branch `wp/57-load-cost`, from `main`. `AGENTS.md` applies. `src/core/**` is **not** in
scope. `CHANGELOG.md` is central: report changelog lines. `docs/api.json` is regenerated. Public
files must not mention this spec.

This WP explicitly permits changes to `package.json`, `tools/build.js`, `styles/zx.css` and
`.github/workflows/ci.yml`, within the sections below.

## Decisions (binding)

1. **Existing consumers see no change.** `dist/zx.css` and `dist/zx.min.css` keep their content and
   order. A test compares the order of the rules they contain before and after.
2. **A subset is resolved, not guessed.** A component's stylesheet subset is its own CSS, plus the
   CSS of every block it reaches:
   - every component module in its static import graph;
   - every `zx-<block>` class named in the source of a module in that graph, because a component may
     draw another's markup without importing it.

   The subset keeps the order of `styles/zx.css`, contains each file once, and always starts with
   the core sheet.
3. **Layering is opt-in.** A layered build puts the whole library in `@layer zx`, so any unlayered
   application rule wins without a specificity fight. The plain build stays unlayered, because
   layering also lets any unlayered third-party CSS (a reset, for one) override Zx.
4. **Budgets are visible in review.** Gzipped sizes are checked against a committed budget. Raising
   a budget means editing that file in the same change, where a reviewer sees it.

## §1 · Core sheet and per-component subsets

**Scope:** new `styles/core.css`, `styles/zx.css`, `tools/build.js`, new `bin/zx-css.js`,
`package.json` (`exports`, `files`, `bin`), `tests/unit/css-subset.test.js`,
`tests/unit/package-exports.test.js`, `tests/smoke/**` (acceptance 4), `docs/llms.md`,
`README.md` (installation).

- **`styles/core.css`:** the tokens, `base.css`, `icons.css` and `prose.css`, the sheets every
  component needs. `styles/zx.css` imports it first and then the components, in today's order.
  The build adds `dist/zx.core.css` and `dist/zx.core.min.css`.
- **`zx-css`** (`bin/zx-css.js`, shipped as the package's `bin`, Node only, no dependencies):
  - `npx zx-css select table --out public/zx.css` writes one stylesheet for those components
    under Decision 2, minified with `--min`, layered with `--layer`.
  - `--list` prints the files a subset contains, in order, without writing.
  - An unknown component name fails, listing the known ones.
  - The resolver is exported (`resolveSubset(names, {root})`) so the unit test and the build share
    it.
- **Exports:** `./zx.core.css`, `./zx.core.min.css`, `./zx.layered.css` and
  `./src/components/*.css`, each covered by `package-exports.test.js`.

## §2 · Layered build

**Scope:** `tools/build.js`, new `styles/zx.layered.css`, `package.json`, `docs/llms.md`.

- `styles/zx.layered.css` is `@import url("./zx.css") layer(zx);`. The build writes
  `dist/zx.layered.css` and `dist/zx.layered.min.css`, bundled so no `@import` remains.
- `docs/llms.md` explains when to choose it and the trade-off of Decision 3.

## §3 · Size budget

**Scope:** new `tools/check-size.js`, new `tools/size-budget.json`, `package.json`
(`check:size`), `.github/workflows/ci.yml` (one step after the build).

- `tools/size-budget.json` lists each `dist/` file with its gzipped budget in bytes. The first
  budgets are today's sizes rounded up to the next 5 KB.
- `npm run check:size` builds and then compares. It prints a table of file, size, budget and
  headroom, and fails naming every file over budget.
- CI runs it after `npm run build`.

## Out of scope

- Splitting the JavaScript bundles, or making component modules import their own CSS.
- Shadow DOM, constructable stylesheets, and CSS minification beyond what the build does today.
- Changing any component's CSS.

## Acceptance criteria

1. `npm test`, `npm run build`, `npm run check:size` and `npm run test:browser` pass;
   `node tools/check-site.js` and `git diff --check` are clean.
2. Unit tests cover:
   - the subset of a leaf component (Kbd), a composite one (Select) and Table, each in
     `zx.css` order with no duplicates;
   - a block reached only through a class name in source;
   - the subset of every component together equalling the component part of `zx.css`;
   - an unknown name failing.
3. `dist/zx.css` keeps its rule order, checked by a test.
4. A page loading `zx.core.css` and the `zx-css` subset for Select renders a Select identically to
   one loading `zx.css`, checked in the smoke suite by comparing computed styles.
5. Changelog lines are reported.
