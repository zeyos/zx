# WP72 — Remaining input, storage and lifecycle corrections

Branch: `wp/71-review-maintenance`, from completed WP65. Implements WP71 M1–M7.
The owner authorized the remaining findings. AGENTS.md applies. No dependencies or publication.

## Scope

- `src/components/country-picker/country-picker.js`, `src/components/datebox/datebox.js`,
  `src/components/app-sidebar/app-sidebar.js`, `src/components/agent-thread/agent-thread.js`,
  `src/components/agent-thread/ag-ui.js`.
- Explicit core permission: `src/core/storage.js`, `src/core/keyboard.js` only.
- `src/components/dock/dock.js`, `src/components/split-view/split-view.js`,
  `src/components/composer/composer.js`, `website/layouts/kit.js`: exact-key legacy storage migration only.
- `website/demos/helpers.demo.js`: storage API example/wording only.
- Existing `tests/unit/{app-sidebar,storage,keyboard,agent-thread,ag-ui,datebox-parse,datebox-display}.test.js`;
  new `tests/regression/maintenance.js`.
- Public documentation/API updated by the integration owner. Message keys owned by WP73.

## Contract

1. CountryPicker searches secondary descriptions, including preferred entries.
2. Datebox unchanged native blur/Enter is silent and preserves the underlying Date even when
   display precision hides its time. Actual edited/clamped changes emit once. Explicit set semantics stay intact.
3. Disabled AppSidebar branches reject keyboard expansion/child focus as they reject pointer activation.
4. New storage uses an unambiguous versioned prefix distinct from legacy `zx:` (length-delimited namespace).
   Existing methods operate solely on the new namespace. Add `migrateLegacy(keys)` as explicit,
   exact-key, copy-only migration: valid legacy JSON may be copied when the destination is absent;
   existing new values win; malformed entries are skipped. Return migrated key names. Migration is
   once-only per namespace/key, with separate durable handled markers preserved by clear/remove so
   reconstructing a built-in consumer cannot resurrect legacy data. Malformed entries remain retryable. Never delete
   legacy keys or guess ownership of ambiguous colon-delimited names. clear/remove cannot resurrect
   legacy values automatically. Existing in-memory fallback and local/session selection remain.
   Built-in consumers explicitly migrate only their known persistence/draft keys before reading.
5. Empty focus traps focus the boundary with temporary tabindex=-1 if needed, keep Tab/Shift+Tab
   contained, restore the boundary tabindex and prior focus, and support later-added descendants.
6. AgentThread binds one scroll listener to its current host, removes it on reparent/rebind and destroy,
   and detects a new ancestor even if the former ancestor remains connected. Explicit scrollers also
   receive the listener. Do not alter unrelated feed behavior.
7. AG-UI elapsed durations use source time only with two finite source timestamps; local time only
   when both endpoints lack source timestamps; mixed/negative elapsed is omitted. Synthetic closes
   must not invent source endpoints. Preserve public timestamp rendering without combining clocks
   into an interval. Unknown completed reasoning uses `agUi.thoughtComplete`, added by WP73.

## Acceptance

Regression cases reproduce each defect; test colon namespaces/keys and legacy migration preservation,
quota fallback, both storage areas, empty-to-populated focus traps, reparented scroll hosts, paired and
mixed timestamp events and replay. Browser checks run in both themes. Run scoped unit tests and final
integration npm test/build/browser checks. Integration owner commits each component.

## Out of scope

Destructive legacy migration, automatic ownership inference, new storage backend, new components,
public signature removals, broad async redesign and other core files.
