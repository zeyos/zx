# WP11 — Ship: smoke page, docs, build, dist

Branch: `wp11-ship` from `main` (everything merged). Read `AGENTS.md`.

## Scope

```
tools/build.js
tests/smoke/smoke.html  tests/smoke/smoke.js
README.md               # rewrite
MIGRATION.md            # gx → zx guide
demos/index.html        # final polish only if needed
package.json            # add "build": "node tools/build.js"
```

## tools/build.js (esbuild API, ~60 lines)

Outputs to `dist/`:
- `zx.esm.js` — bundle of `src/index.js`, ESM, minify:false + `zx.esm.min.js` minified.
- `zx.global.js` (+ `.min.js`) — IIFE, `globalName: 'zx'`, from `src/index.js`.
- `zx-compat.global.js` (+ `.min.js`) — IIFE from `src/compat-entry.js` (bundles zx + compat;
  assigns window.zx and window.gx itself — no globalName needed, entry does assignment).
- `zx.css` (+ `.min.css`) — bundle styles/zx.css with esbuild CSS (resolves @imports).
- Prints a size report table (raw/minified/gzip via node:zlib).

## tests/smoke/smoke.{html,js}

No-build page importing `../../src/index.js`. For EVERY exported component: instantiate with
minimal viable options into a container, run a per-type exercise (open/close overlays, setData
table, set/get values, emit-path checks), destroy, instantiate again, destroy. Collect
window.onerror + unhandled rejections. Assert container childless after each destroy. Render a
PASS/FAIL table (component × create/exercise/destroy/re-create) + summary banner; expose
`window.__zxSmoke = {passed, failed, results}` for automation.

## README.md (rewrite)

What Zx is; quick start (ESM + global script); component index table with one-line descriptions
grouped like the demo sidebar; theming guide (tokens, data-zx-theme/density, custom theme
example overriding ~8 semantic tokens); browser support statement; dev workflow (serve/test/
build); compat layer usage (script order, installGlobals) linking MIGRATION.md.

## MIGRATION.md

Per legacy class: old snippet → new snippet (use the WP10 mapping tables); the
"intentionally not reproduced" list with rationale & workaround; script-tag swap recipe for
`net.zeyon.lib.gx-3000/assets/` deployments (gx-core.js+gx-zeyos.js+css → zx.global.js+
zx-compat.global.js+zx.css); note that `__()`/globals need `gx.compat.installGlobals()`.

## Acceptance criteria

1. `npm run build` succeeds from clean checkout (only devDep esbuild); size report prints;
   `zx.global.min.js` parses in isolation (node --check equivalent or new Function smoke).
2. Loading `dist/zx.global.js` + `dist/zx.css` in a plain HTML file (add
   `tests/smoke/smoke-dist.html` doing exactly this) exposes working `window.zx` — Dialog.alert
   opens; compat bundle exposes `window.gx` and a legacy Toggle works.
3. smoke.html: all components PASS in a real browser (orchestrator will run it).
4. `npm test` still green; README/MIGRATION accurate against actual exports (spot-check 10
   claims).
5. Committed on `wp11-ship`.

## Out of scope

npm publishing; CI; versioning policy; ZeyOS app-lib packaging (orchestrator does M5).
