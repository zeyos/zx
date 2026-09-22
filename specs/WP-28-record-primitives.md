# WP28 — Record primitives

Adds the dense, reusable presentation primitives required by ZeyOS records: linked entity
references, file rows and collections, and chronological activity entries and feeds. The
components own rendering, accessibility, lifecycle, and cancelable interaction boundaries;
applications retain routing, authorization, transport, persistence, and business rules.

## Files in scope

```
specs/WP-28-record-primitives.md
src/components/entity-ref/entity-ref.js
src/components/entity-ref/entity-ref.css
src/components/file-item/file-item.js
src/components/file-item/file-item.css
src/components/file-list/file-list.js
src/components/file-list/file-list.css
src/components/activity-item/activity-item.js
src/components/activity-item/activity-item.css
src/components/activity-list/activity-list.js
src/components/activity-list/activity-list.css
src/index.js                                      # exports for these components and pure normalizers
styles/zx.css                                    # imports for these component styles only
website/demos/entity-ref.demo.js
website/demos/file-item.demo.js
website/demos/file-list.demo.js
website/demos/activity-item.demo.js
website/demos/activity-list.demo.js
website/docs.js                                  # registration for these demos only
tests/unit/entity-ref.test.js
tests/unit/file-list.test.js
tests/unit/activity-item.test.js
tests/unit/activity-list.test.js
tests/smoke/smoke.js                             # cases for these five component classes only
tests/smoke/smoke-dist.html                      # global bundle checks for these components only
README.md                                        # component index entries only
docs/llms.md                                     # supported component sections only
docs/llms.txt                                    # supported component summary only
website/llms.txt                                 # supported component summary only
docs/api.json                                    # regenerated public API metadata
CHANGELOG.md                                     # Unreleased entry only
```

`src/core/**`, Kanban, menus, account navigation, and every other component are unchanged. No
runtime dependency is added.

## EntityRef

`EntityRef` is a compact identity row for a person, organisation, project, or other record. It
accepts a title, optional icon, subtitle, labelled metadata, a safe native primary link, and a
small secondary action group. Native anchors preserve modifier-click, targets, and download
behavior. Executable URLs are discarded; `_blank` links gain `noopener`.

Primary activation and descriptor action selection emit cancelable component and bubbling DOM
events before callbacks run. Caller-supplied action Elements retain their own behavior. The
component never decides routes, permissions, context menus, or record mutations.

## FileItem and FileList

`FileItem` composes `EntityRef` with byte-size/MIME metadata, durable and transient status, and
optional determinate or indeterminate progress. Supported statuses are `ready`, `temporary`,
`waiting`, `uploading`, `processing`, `success`, and `error`. Download destinations are native
safe links; data transport, authentication, preview generation, and object lifecycle stay with
the application.

`FileList` renders an accessible labelled list with loading and empty states, stable item lookup,
and add/update/remove APIs. It forwards cancelable item activation/action events with the file
snapshot and list position. Explicit duplicate ids are rejected.

## ActivityItem and ActivityList

`ActivityItem` presents an actor, avatar, title/content, timestamp, metadata, attachments, and
descriptor or caller-supplied actions. `ActivityList` owns chronological ordering, optional date
grouping, loading/empty states, item updates, and event forwarding. Applications own posting,
editing policy, reactions, subscriptions, permissions, and persistence.

## Accessibility and lifecycle

- Identity and file destinations use native anchors, while actions without destinations use
  native buttons.
- Metadata remains labelled for assistive technology even when its visual label is clipped.
- File progress exposes `role="progressbar"`; indeterminate work omits `aria-valuenow`.
- Collections use native lists and labelled status/empty regions without manufacturing selection
  semantics.
- Enhanced targets are restored exactly on destroy. Owned roots and child components are cleaned
  up, and all component DOM listeners use `this.listen()`.

## Out of scope

- Fetching, uploads, downloads, retries, preview viewers, or file persistence.
- Application routes, access checks, record editing, or context-menu policy.
- Activity composers, rich-text parsing, reactions, realtime delivery, or channel filtering.
- A broad generic `Card` redesign or changes to Kanban cards.

## Acceptance criteria

1. Entity references render dense, text-safe identity, metadata, native links, and cancelable
   descriptor actions at all three sizes.
2. File rows cover durable, temporary, waiting, active, successful, and failed states, including
   accessible known and unknown progress.
3. File and activity collections expose deterministic normalization, reject duplicate explicit
   ids, and show loading/empty content correctly.
4. Activity entries support actor identity, timestamps, metadata, attachments, and action slots;
   grouping and sorting never mutate caller data.
5. Each public component has a registered demo and a source/global distribution smoke case that
   creates, updates, destroys, and recreates it.
6. `npm test`, `npm run build`, and `npm run test:browser` pass.

## Release

These are backward-compatible public additions for the **4.4.0 minor release**. This work package
does not change the package version or publish artifacts.
