# WP10 — Archived internal gx adapter

Status: archived for internal ZeyOS reference as of Zx 4.0.0.

The adapter in `src/compat/` records the option, method, and event translations that were used
during early development. It is not part of the Xenon Design System's public API or release
surface. Zx now provides `__()` directly, so applications do not need a compatibility layer for
DOM construction.

## Boundary

- `src/compat/` and `src/compat-entry.js` are internal, unexported source references.
- The build does not create compatibility bundles or a `window.gx` global.
- The npm package excludes the adapter, and the website does not publish compatibility or
  migration pages.
- Public components, documentation, examples, tests, and declarations must use Zx APIs directly.
- Changes to this archived code require a separate internal work item and must not widen the
  public package surface implicitly.

## Verification

1. `package.json` has no compatibility exports or compatibility side effects.
2. `npm run build` emits no compatibility asset.
3. `npm pack --dry-run --json` contains neither `src/compat/` nor `src/compat-entry.js`.
4. `node tools/check-site.js` confirms that the generated website contains no compatibility or
   migration route.
