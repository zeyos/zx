# Calendar

A dependency-free scheduling surface with agenda, day, week, month, and year views; local-time event layout; range selection; and pointer or keyboard editing.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/calendar · All components: https://zx.zeyos.com/docs/components/index.md

A dependency-free scheduling surface for operational events. One component owns agenda, day,
week, month, and year views; local-time range math; timed collision columns; multi-day lanes;
loading and empty states; pointer range selection; and equivalent pointer/keyboard move and resize
interactions. Visible ranges use an exclusive `end`, so `dateschange` can be passed directly to a
windowed loader.

- **Options** — `events`, `date`, `view: 'month'`, `views: ['agenda','day','week','month','year']`,
  `locale`, `weekStart: 1`, `weekNumbers: true`, `workweek: false`, `agendaDays: 14`,
  `slotDuration: 30`, `slotMinTime: 0`, `slotMaxTime: 1440`, `scrollTime: 480`, `eventLimit: 3`,
  `selectable: false`, `editable: false`, `eventStartEditable` (`true`/`false` overrides
  `editable` for moving), `eventDurationEditable` (`true`/`false` overrides `editable` for
  resizing; a string or function instead names the per-event resize field, `'durationEditable'`
  by default), `optimistic: true`, `nowIndicator: true`, `now`, `disabled`, `msg`, and `renderEvent(event)`.
- **Messages** — every key is namespaced `calendar.*`: `calendar.today`, `calendar.previous`,
  `calendar.next`, `calendar.new`, `calendar.agenda`/`day`/`week`/`month`/`year` (the view
  switch), `calendar.viewSwitch`, `calendar.label` (the root's name), `calendar.loading`,
  `calendar.noEvents`, `calendar.allDay`, `calendar.more` and `calendar.weekNumber` (`%1`),
  `calendar.dayEvent`/`calendar.dayEvents`, `calendar.resize`, `calendar.moveStarted`,
  `calendar.resizeStarted`, `calendar.editPreview` (`%1` title, `%2`–`%3` the times),
  `calendar.editCancelled`, `calendar.editCommitted`. Until 6.0 the bare keys of earlier versions
  (`today`, `next`, `loading`, …, and `calendar` for `calendar.label`) are still honoured, read
  right after the namespaced key in the `msg` option and in the host translator; rename them.
  The built-in English now lives in the default catalogue rather than in `Calendar.defaults.msg`,
  so a host translator reaches every calendar string.
- **Event input** — generic records default to `{id,title,start,end,allDay,color,location,editable,
  durationEditable}`. Every field has a string-or-function reader (`eventId`, `eventTitle`,
  `eventStart`, …); numeric dates use `dateUnit: 'milliseconds'|'seconds'`. Inputs are normalized
  atomically, duplicate IDs and inverted intervals throw, Dates are copied, text is never parsed as
  HTML, and suspicious CSS colour strings are ignored.
- **Methods** — `getEvents()`, `setEvents()`, `addEvent()`, `updateEvent()`, `removeEvent()`,
  `getDate()`, `setDate()`, `getView()`, `setView()`, `prev()`, `next()`, `today()`,
  `setLoading()`, `focusEvent()`, `destroy()`. `prev()`/`next()` step one visible period and clamp
  the day of month into the target month, so a 29th–31st anchor cannot skip a shorter month; the
  same arithmetic is exported as `calendarPageDate()` and `addCalendarMonths()`.
- **Events** — `dateschange {view,start,end}`, `viewchange {view,oldView}`, `eventclick`,
  `eventdblclick`, `dateclick {date,allDay,view}`, `select {start,end,allDay,view}`,
  `new {date,view}`, `moreclick {date,count}`, `eventschange {events}`, and cancelable
  `eventchange {event,oldEvent,action,delta,jsEvent,revert}`.
- **Persistence** — `optimistic: true` updates local events before `eventchange`; call the
  idempotent, version-guarded `detail.revert()` if persistence fails. With `optimistic: false`, the
  component stays controlled: it emits the proposal without changing data, and the application
  applies an accepted response through `updateEvent()` or `setEvents()`. Zx does not send requests.
- **View layout** — agenda days keep every event in one vertically stacked content column. Month
  uses a continuous seven-day grid with full-height day boundaries and event lanes overlaid below
  the date labels; today is indicated with accent text instead of a decorative edge highlight.
- **Appearance** — the view switch is one framed control with the current view on the neutral
  `--zx-color-bg-current` fill; weekday headings are sentence case; inner grid lines use
  `--zx-color-border-subtle`; the New button is the solid primary (`--zx-color-accent-solid`).
- **Pointer editing** — a timed move preserves the point where the event was grabbed and snaps the
  resulting start to `slotDuration`. The lower grip stretches the event in its original day column,
  while pointer capture keeps either interaction active if the pointer leaves the event surface.
- **Keyboard** — time slots and date grids use arrow-key navigation, Home/End, PageUp/PageDown,
  Enter/Space activation, and roving focus. On an editable event, Space grabs it, arrows propose a
  slot/day move (or change the focused resize grip), Space drops, and Escape cancels. Live status
  text announces the edit and its proposed times.
- **ZeyOS binding** — `zeyosCalendar()` maps current appointment occurrence rows (`ID`, `name`,
  `location`, `color`, `datefrom`, `dateto`, and association text). `calendarEventToZeyosPatch()`
  returns the base `ID` with Unix-second dates. Pass the instance's `timeZone` to both so an all-day
  appointment is recognised from midnight in that zone and lands on the right days for a viewer
  elsewhere; without it the viewer's own midnight is used. The current server already expands recurrence into
  the requested window; recurrence rules, DAV synchronization, permissions, and routes therefore
  remain in ZeyOS instead of being reimplemented in core.
