# Avatar

A stable-size user image with a deterministic fallback — initials on a tone picked from the name — and an optional text-described presence indicator.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/avatar · All components: https://zx.zeyos.com/docs/components/index.md

A fixed-geometry user image with a deterministic fallback: initials on a tint from the categorical
tone palette, picked by a stable hash of the name. Image loading or failure never changes layout,
and the component is decorative by default so adjacent identity text is not announced twice.

- **Options** — `src`, `name`, `initials`, `label`, `size: 'sm'|'md'|'lg'|<pixels>` (24 / 32 /
  40px at the default spacing unit), `shape: 'circle'|'rounded'|'square'`, `tone:
  'blue'|'teal'|'green'|'amber'|'orange'|'red'|'pink'|'violet'|'slate'|null`, `status:
  'online'|'away'|'busy'|'offline'|null`, `statusLabel`, `activity:
  'idle'|'thinking'|'working'|'needs-you'|'blocked'|'offline'|null`, `activityLabel`, `animate: false`, and `phase: null|number`.
- **Fallback** — no ring; the `--zx-color-tone-*-bg` fill with its `-fg` ink, initials at 0.4× the
  size (never under 10px), weight 600, one initial below 24px. `tone: null` derives the tone with
  `avatarTone(name)` (exported from the module): FNV-1a over the trimmed, NFC-normalised,
  lower-cased name, mapped onto the eight chromatic tones, so a person keeps their colour on every
  screen. `slate`, the neutral, is reserved for an avatar with no name and can be set explicitly.
  The root carries `data-tone`. `avatarInitials(name, limit = 2)` returns the initials.
- **Agent activity** — `activity` draws what an agent is doing as a dot whose shape differs as
  well as its tone: solid success (working), solid info (thinking), solid warning (needs you), a
  danger square (blocked), a hollow ring (idle), and a dashed ring (offline). Its word ("Needs
  you", or `activityLabel`) joins the accessible name and the dot's tooltip, and the root carries
  `data-activity`. When both are given, `activity` wins over `status`. `animate: true` moves the
  avatar with its activity — idle breathes, thinking sways, working bobs, needs-you leans and
  blinks — in the one `requestAnimationFrame` loop every animated avatar on the page shares: only
  on screen, never while the page is hidden, and back at rest under reduced motion (the system's
  or a `data-zx-motion="reduced"` region). While it is on, the loop owns the root's `transform`. `phase` sets where in its activity's cycle the avatar moves, as a fraction from 0 up to 1
  (whole turns wrap): two avatars of one agent on the same screen — a roster and an inspector —
  at `phase: 0` and `phase: 0.5` move half a cycle apart. `null` derives the phase from the name
  (or the initials), so avatars of the same agent without a phase move in step.
- **Methods** — `set(values)` (any option above, `phase` included, applied while the avatar moves), `setStatus(status, label?)`,
  `setActivity(activity, label?)`, `getActivity()`, `hasImage()`, `destroy()`.
- **Accessibility** — set `label` only when the avatar stands alone. Presence is supplementary
  status, not the account's accessible name; supply `statusLabel` when it conveys information.
