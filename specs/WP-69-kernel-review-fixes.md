# WP69 — Kernel, transport, streamed content and site assets

Branch: `wp/65-library-review-fixes`, from WP65. `AGENTS.md` and WP65 apply.
This WP **explicitly permits** changes to `src/core/http.js`, `src/core/dom.js` and
`src/core/keyboard.js`, and no other core files.

## Scope

- The three core files named above.
- `src/components/field-upload/field-upload.js`
- `src/components/agent-thread/agent-thread.js`
- `website/index.html`, new `website/index.js`, `tools/build-site.js`, `tools/check-site.js`
  (only entry-asset handling/verification).
- `tests/unit/http.test.js`, `tests/unit/keyboard.test.js`, `tests/unit/dom-builder.test.js`,
  `tests/unit/site-assets.test.js`, `tests/regression/kernel.js`.
- Public documentation/generated output coordinated through WP65.

## Required corrections (P2)

1. **K1: false-valued legacy errors are success.** `parseResult({result, error:false})` and
   `error:0` return result; preserve actual string/object errors, null/absent errors and plain JSON.
2. **K2: upload and HTTP contracts agree.** Http request options support caller AbortSignal and
   multipart `paramName` (default `files` for compatibility). Abort listeners/timers are cleaned
   on every outcome; timeout has an identifiable reason distinct from caller abort. FieldUpload
   uses a real progress-capable transport for the shipped Http (XHR is already available), honors
   base URL/headers/response/error handling as applicable, and keeps custom injected transports
   working. Do not pretend fetch reports upload progress. Verify aborted requests cannot report
   success to the component.
3. **K3: streamed text survives metadata patches.** Rebuilding an answer preserves the live
   blocks when partial metadata changes do not explicitly replace them, with and without versions.
   Explicit blocks/versions replacements and replay semantics remain authoritative.
4. **K4: h() enforces trusted HTML and safe links.** Reject dangerous HTML sink properties
   (`innerHTML`, `outerHTML`, `srcdoc`) before mutation; trusted HTML continues through `h.raw()`.
   Route href through `safeHref` and preserve safe relative, http(s), mailto/tel and fragment links
   already supported. Do not break normal DOM property/event/dataset/ARIA behavior or compact
   builder's documented safe behavior. Regression-test casing and attribute fallback paths.
5. **K5: roving groups release removed nodes.** Restore and forget original tabindex records
   for removed items; reinserted items are remembered from their new baseline. Preserve temporary
   unavailable items, MutationObserver behavior and idempotent destroy.
6. **K6: repeated-letter typeahead cycles.** Successive identical letters search after the last
   matching item and wrap; distinct-letter buffering continues to match a prefix. Preserve the
   public two-parameter function signature and support changed item lists and modifier exclusion.
7. **K7: landing assets use one revision.** Move the landing-page inline module into its own
   module entry or otherwise reliably revision-stamp imports. Source zero-build serving and built
   root/versioned routes must work. Add a guard against executable root entries importing an
   unversioned library alongside revisioned assets.

## Regression acceptance

Use Node tests for HTTP parsing/options/abort/timeout, keyboard typeahead and site-asset invariants.
Use browser tests for actual h() sinks/links and valid properties, removed/reinserted roving items,
FieldUpload cancellation/multipart/progress behavior without a remote upload, and streamed answer
metadata patches. Run existing agent-stream replay and DOM tests. Build and verify fresh site output.

## Out of scope

Other utility changes, empty focus traps, scroll subscription changes, registry redesign,
client semantics migration, dependency updates, untrusted HTML feature support and publication.
