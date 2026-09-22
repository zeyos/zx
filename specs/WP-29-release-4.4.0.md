# WP29 — Prepare the 4.4.0 release candidate

Prepares a local, fully testable 4.4.0 package candidate for the Kanban anatomy, rich action menus,
and reusable record primitives delivered by WP26–WP28. This work does not publish, tag, push, or
install the package into another repository.

## Files in scope

```
specs/WP-29-release-4.4.0.md
package.json
package-lock.json
CHANGELOG.md
```

No source, component, documentation-site, build-tool, workflow, or generated distribution file is
changed by this work package.

## Release metadata

- Set both package manifests to `4.4.0` without creating an implicit commit or tag.
- Keep a fresh empty `Unreleased` section at the top of the changelog.
- Move the existing unreleased additions, changes, and fixes into `4.4.0 — 2026-09-01` without
  rewriting their public release notes.

## Verification

1. `npm test`, `npm run build:types`, `npm run build`, and `npm run test:browser` pass.
2. `npm pack --dry-run` reports package version 4.4.0 and contains the expected public files only.
3. `git diff --check` passes.

## Out of scope

- Creating a commit, tag, GitHub release, or npm publication.
- Installing or vendoring the candidate in ZeyOS before the canonical release is published.
- Changing release automation, dependencies, package exports, or public API.

