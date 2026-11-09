# WP70 — Opt-in record loading when saved views cannot be read

Branch: `wp/65-library-review-fixes`, from WP65. `AGENTS.md` applies.
The owner requested the simplest solution with reasoning and alternatives. Use an explicit
baseline fallback: keep current default behavior to avoid silently dropping saved filters, while
allowing record browsing from the caller's configured baseline after a registry read failure.

## Scope

- `src/zeyos/view.js`, `tests/unit/zeyos-view.test.js`.
- `docs/llms.md` through WP65's integration owner.
- No core files or saved-view storage format changes.

## Contract

- Add one opt-in option, `savedViewFallback: 'error' | 'baseline'` (default `'error'`).
- Unsupported/structurally invalid registry documents remain errors. `ready` still rejects so
  callers can inspect initialization failure; report that failure through the existing error path
  when baseline record loading is requested. Do not swallow it as a successful restoration.
- Baseline mode may continue ordinary record loading after a **registry read** failure, using
  configured fields/query/sort. Do not apply a partially read default or suppress a view/query
  application failure. Preserve transport retries so repaired storage can restore normally.
- Saved-view capture/save/apply/default operations still require successful initialization.
  Never rewrite, clear, migrate or otherwise mutate the unreadable document automatically.
- Keep existing default-error behavior and destruction/error reporting contracts intact.

## Acceptance

With `{version:99, views:[]}`, default mode blocks records as before; opt-in baseline mode reports
the error and loads baseline records. Repeated record loads cannot write the document; save/apply
remain blocked. Repairing the transport allows initialization to recover. View-application errors
are not mistaken for registry-read failure. Include valid/default/no-registry control cases.

## Alternatives and out of scope

Keeping current blocking behavior is compatible but does not restore browsing. Automatic deletion
or migration risks losing views and is excluded. A new registry version/migration system, implicit
filter removal for all callers, and edits to `src/zeyos/saved-views.js` are out of scope.
