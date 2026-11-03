# WP58 — Visual comparison against any git ref

The token lint and `tools/audit-layout.js` check rules, but nothing compares what the library looks
like before and after a change. Regressions of the kind WP40, WP45 and WP46 fixed by hand reach
review unnoticed. This WP adds a tool that renders the working tree and a git ref side by side, on
the same machine, and reports what changed, section by section.

Work on the branch `wp/58-visual-diff`, from `main`. `AGENTS.md` applies. `src/core/**` is **not**
in scope. `CHANGELOG.md` is central: report changelog lines. Nothing in this WP is published: the
tool stays out of `tools/build-site.js` sources and the npm package.

## Decisions (binding)

1. **No stored baselines.** The tool compares the working tree against a git ref (`HEAD` by default)
   checked out into a temporary worktree, served side by side and rendered by the same browser.
   Nothing binary is committed, and fonts or anti-aliasing never differ between the two.
2. **Sections, not pages.** A difference is reported per section (one component's block on the
   theme page, one layout), so the report says what changed, not only that a page did.
3. **Deterministic rendering.** Reduced motion is emulated, carets and animations are stopped, web
   fonts are awaited, and the viewport and device scale factor are fixed.
4. **The diff runs in the browser, with no dependency.** Both screenshots are decoded into a canvas
   and compared with `getImageData`. A pixel differs when any channel differs by more than 2. A
   section differs when more than 0.05% of its pixels do, or when its size changed.
5. **It never fails silently on a mismatch.** The exit code is 1 when any section differs, 2 when
   the tool could not run, and 0 otherwise.

## §1 · Tool

**Scope:** new `tools/visual-diff.js`, `package.json` (`test:visual`), `docs/RELEASING.md` (one
step in the release checklist), `tools/check-site.js` (if a new private path needs listing).

- **Usage:** `node tools/visual-diff.js [--base <ref>] [--out <dir>] [--full] [--layouts [ids]]
  [--only <section>]`.
- **Default matrix:** `website/theme.html`, light and dark, at the default preset and geometry, at
  1440 × 900.
- **`--full`:** also the six accent presets, the spacing and radius settings the theme page offers,
  and 390 wide.
- **`--layouts`:** also every layout id from `website/layouts/index.js` (or the ids given), mounted
  through `tests/layouts/harness.html` at 1440 × 900, light and dark.
- **Sections** come from the page's own structure: one per component block on the theme page, one
  per layout. A section present on only one side is reported as added or removed.
- **Report:** `<out>/index.html`, a plain page listing the differing sections, largest change
  first, each with before, after and a diff image highlighting the changed pixels; plus
  `<out>/report.json` with the same data. Unchanged sections are counted, not shown.
- **Cleanup:** the temporary worktree and both servers are removed on exit, including after Ctrl+C
  or a failure.
- **Ports:** both servers take random free ports, so several runs can work at once.

## Out of scope

- Committed baselines, CI integration, and cross-machine comparison.
- Comparing individual demos on the documentation page.
- Any change to components, styles or the website.

## Acceptance criteria

1. `npm test` passes; `node tools/check-site.js` and `git diff --check` are clean.
2. Run against `HEAD` on an unchanged tree, the tool reports no differences, three times in a row.
3. With a one-line token change in the working tree (for example a different
   `--zx-radius`), it reports the affected sections and not the others, then the change is
   reverted.
4. `--layouts agent-chat` works and leaves no worktree or process behind.
5. Changelog lines are reported.
