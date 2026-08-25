# WP20 — Calendar

Branch: work on `main`. Read `AGENTS.md`, WP5, WP18, and WP19 first. This package adds the
dependency-free scheduling surface missing from Xenon's Data family while preserving the existing
ZeyOS appointment model and application boundaries.

## Objective

Add a product-neutral `Calendar` for agenda, day, week, month, and year planning. It renders local
time, overlapping and multi-day events, supports selection plus pointer/keyboard moving and
resizing, and emits cancelable proposals that an application can persist. The optional ZeyOS
binding maps current appointment records (`ID`, `name`, `location`, `color`, `datefrom`, `dateto`)
without moving recurrence, DAV, permission, or persistence policy into Zx.

## Scope

```
specs/WP-20-calendar.md
src/index.js
src/components/calendar/calendar-model.js
src/components/calendar/calendar.js
src/components/calendar/calendar.css
src/zeyos/calendar.js
src/zeyos/index.js
styles/zx.css
tests/unit/calendar.test.js
tests/unit/zeyos-calendar.test.js
tests/unit/type-bindings.test.js
tests/smoke/smoke.js
website/docs.js
website/demos/calendar.demo.js
website/theme-showcase.js
docs/llms.md
docs/llms.txt
website/llms.txt
README.md
DESIGN-SYSTEM.md
CHANGELOG.md
docs/api.json
```

Generated bundles, declarations, and `site/` are verification output. They are not committed unless
the repository already tracks them.

## Product and architecture boundaries

- `Calendar` is a local-time view/controller over caller-supplied occurrences. It owns rendering,
  focus, selection, optimistic local mutation, revert behavior, and lifecycle only.
- Recurrence expansion stays server/application-owned. Current ZeyOS calendar endpoints already
  expand appointment occurrences through `f_timespan`; the adapter consumes that result.
- Saving, authorization, conflict detection, DAV synchronization, invitations, routing, filters,
  resources/rooms, and server loading remain application-owned.
- Zx core source remains product-neutral. ZeyOS field names and Unix-second conversion live only in
  `src/zeyos/calendar.js`.
- No runtime or development dependency is added.

## Calendar event and view contracts

Core events use `{id, title, start, end, allDay?, color?, location?, editable?,
durationEditable?, data?}`. Start/end accept `Date`, ISO strings, or numeric timestamps governed by
`dateUnit: 'milliseconds'|'seconds'`. Configurable string/function readers let callers retain their
own records; normalization is atomic and rejects invalid dates, reversed ranges, and duplicate IDs.

Views are:

- `agenda`: grouped chronological rows over `agendaDays` (14 by default), including empty days.
- `day` and `week`: an all-day/multi-day rail above a scrollable time grid, configurable slot
  bounds/duration, overlap columns, a current-time line, and weekend treatment.
- `month`: complete week rows with day navigation, lane-assigned multi-day spans, overflow counts,
  and week numbers when enabled.
- `year`: twelve compact month grids with per-day activity density and day activation.

The toolbar supplies previous/next, Today, an accessible live range title, view buttons, and a New
command. Narrow containers wrap the toolbar and keep the view strip horizontally reachable;
agenda is the intended compact presentation but the chosen view is never silently changed.

## Editing and application ownership

`editable`, `eventStartEditable`, and `eventDurationEditable` gate moving/resizing globally and can
be narrowed per event. Pointer edits snap to `slotDuration`; keyboard editing uses Space to grab or
drop, arrows to move, a resize handle for duration changes, and Escape to cancel. The live region
announces every state. Selection works across time slots and emits a local `[start,end)` range.

Every edit emits `eventchange` with the old event, proposed event, action (`move` or `resize`),
delta, originating interaction, and an idempotent `revert()` callback.

- `optimistic: true` (default) applies the proposal immediately; `revert()` restores it if the host
  rejects or fails to persist. Preventing the component event reverts synchronously.
- `optimistic: false` leaves local data untouched; the host confirms by calling `setEvents()` or
  `updateEvent()` with its authoritative result.

`dateschange` announces every visible `[start,end)` window for remote loading. `eventclick`,
`eventdblclick`, `dateclick`, `select`, `viewchange`, and `new` are cancelable host hooks; none
performs navigation, opens an editor, or calls a backend.

Public methods include `getEvents`, `setEvents`, `addEvent`, `updateEvent`, `removeEvent`,
`getDate`, `setDate`, `getView`, `setView`, `prev`, `next`, `today`, `setLoading`, `focusEvent`, and
`destroy`.

## ZeyOS binding

`zeyosAppointmentToEvent()` and `zeyosAppointmentsToEvents()` map Unix seconds and preserve the
source record. `buildZeyosCalendarOptions()` composes reader defaults without overwriting explicit
caller options. `zeyosCalendar(target, options)` accepts an `appointments` array and returns a
normal `Calendar` instance. Empty ZeyOS color strings use the semantic accent; hex values without
`#` are normalized for CSS.

Associated `events` rows may use `assoc_name`/`entity`; the adapter creates a useful label while
keeping identifiers and routes application-owned.

## Accessibility

- Date/time cells use the APG grid model: one roving tab stop, arrow navigation, Home/End row
  bounds, PageUp/PageDown period navigation, and Enter/Space activation.
- Event controls are real buttons with date/time/location names. Dragging is never the only edit
  path; focused move and resize controls expose the same result from the keyboard.
- `aria-current="date"`, selected/grabbed states, column/row semantics, labelled grids, a polite
  range heading, and a dedicated live status region remain synchronized.
- Focus survives rerenders by stable event ID or date-time key. Reduced-motion and forced-colour
  presentations stay usable.

## Documentation and visual direction

Register Calendar under `Data`. The primary demo uses the full interactive week planner with
realistic ZeyOS-style business records, overlap, a multi-day item, drag/resize, selection, and event
logging. A second demo shows `optimistic: false`; a third feeds current appointment records through
the ZeyOS adapter. The component's own toolbar demonstrates all five views.

The visual source of truth is the approved true-white Xenon calendar concept: open grid geometry,
semantic borders and typography, restrained event tint/rails, compact toolbar controls, no nested
card shell, no gradients/glass, and an agenda list at narrow widths. Component CSS consumes only
tier-2 semantic tokens; caller event colors enter through a validated custom property.

## Non-goals

- Recurrence-rule parsing/expansion, exceptions, series editing, time-zone conversion, resource or
  room columns, invitation workflows, CalDAV, saved filters, routing, persistence, offline queues,
  conflict resolution, undo history beyond one proposal's `revert()`, or virtualized year/timeline
  schedulers.
- A third-party calendar/date library, framework, drag library, icon package, or copied vendor CSS.
- Automatically switching a caller's selected view at a breakpoint.

## Acceptance criteria

1. DOM-free tests cover visible ranges, DST-safe local-day movement, event normalization,
   overlap/lane layout, immutable proposals, and ZeyOS Unix-second/color mapping.
2. Browser smoke creates/destroys Calendar on owned and enhanced roots; switches all views;
   exercises date selection, optimistic and controlled changes, revert, keyboard move/resize,
   loading, and target restoration without leaked timers/listeners.
3. Day/week render correct timed overlap columns and all-day spans; month assigns cross-week spans
   and overflow; year and agenda expose every visible day accessibly.
4. Pointer and keyboard edits produce the same snapped proposal. `optimistic: false` never mutates
   local data, while optimistic edits revert exactly once and do not clobber a later authoritative
   update.
5. Light/dark × cozy/compact, narrow agenda, and forced/reduced-motion presentations have no
   clipping, unreadable text, scroll traps, raw component colors, or console errors.
6. The Data documentation includes all five views, copyable core and ZeyOS event shapes, both
   mutation modes, application-owned recurrence/persistence notes, and generated API tables.
7. `npm test`, `npm run build`, `npm run build:site`, `npm run test:browser`, `git diff --check`,
   and source/dist site checks pass. `package.json` still has no `dependencies` field.
