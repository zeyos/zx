# AgentAvatar

A generated face for an agent without a picture: a coloured geometric shape with a face that takes what the agent is doing.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/agent-avatar · All components: https://zx.zeyos.com/docs/components/index.md

A generated face for an agent that has no picture: a coloured geometric silhouette with a face —
eyes, a mouth, sometimes a blush — that takes the agent's activity. Everything about it is derived
from a seed, so the same agent has the same face on every screen; it is decorative by default, like
Avatar.

- **Options** — `seed` (the agent's stable id; `null` uses `name`, but a rename then changes the
  face), `name`, `tone` (the Avatar tones, or `null` to derive it), `body`, `eyes`, `mouth` and
  `cheeks` (fix one trait instead of deriving it), `spacing: 0|1|2` (the eye spacing),
  `material: 'flat'|'soft'`, `size: 'sm'|'md'|'lg'|<pixels>` (24 / 32 / 40px at the default
  spacing unit), `label`, `activity: 'idle'|'thinking'|'working'|'needs-you'|'blocked'|'offline'|null`,
  `activityLabel`, `expression: null|'calm'|'happy'|'listening'|'thinking'|'focused'|'alert'|'worried'|'asleep'`,
  `indicator: true`, `animate: false`, and `phase: null|number`.
- **Silhouettes** — fourteen, filled with the tone's `-solid`: circle, squircle, hexagon,
  triangle, drop, tilted pill, clover, dome, wedge, pentagon, trapezoid, cross, diamond and
  octagon; polygons round their corners.
- **Face** — six eye shapes (`AGENT_EYES`): `round`, `oval` and `square` are white with dark pupils
  that look where the agent looks; `dot`, `capsule` and `pixel` are their solid siblings, in that
  order. Three mouths (`AGENT_MOUTHS`): `smile`, `grin` (open) and `cat`; `mouth: 'none'` is never
  derived and draws eyes only. `cheeks: true` adds a soft blush — the pink and red tones lifted
  toward the eye white, fading out at the edge — while the face is calm, happy or listening: below
  and outside the eyes, or beside the mouth on the pill, wedge, diamond, triangle and cross, which
  have no room there. On the tilted pill the features of a face with a mouth lean with it. The
  features are drawn in `--zx-color-agent-eye` and `--zx-color-agent-pupil`, which keep their colour
  in both themes.
- **Material** — `material: 'soft'` paints the body with a quiet vertical ramp: 10% toward the eye
  white at the top, the plain tone from 25% to 55% — across the eyes, which keep their flat-fill
  contrast — and 14% toward the pupil ink at the foot. It is an application-wide choice, not a
  trait. A soft avatar is drawn flat below 28px, when offline, in print and in forced colours; the
  root carries `data-material`.
- **Traits** — `agentTraits(seed, overrides?)` returns `{tone, body, eyes, spacing, mouth, cheeks}`.
  The tone is `avatarTone(seed)`, so the face matches an initials Avatar keyed the same way; each
  other trait hashes the same normalised key with its own salt. The tables `AGENT_BODIES`,
  `AGENT_EYES` and `AGENT_MOUTHS` are contract, order and length included; a table may only grow by
  exactly its own length, each new entry a sibling of the one it doubles, so every agent keeps what
  it had or takes its sibling — as the eye table grew from three shapes to six.
  `agentFace(traits, activity, px, expression?)` returns the drawing as plain data
  (`{tag, part, attrs, children?}` in a 64-unit view box), for tests or a server: the body in a
  `shape` group, then a `features` group holding `cheeks`, `eyes` and `mouth`. Traits without a
  `mouth` draw eyes only.
- **Sizes** — small sizes draw less: no mouth or pupils below 20px, no blush below 28px, and larger
  eyes at 24px and below.
- **Expression** — each activity has one: calm (idle), thinking — looking up and aside, mouth pressed
  flat — (thinking), focused — eyes lowered — (working), alert — eyes wide, mouth open round — (needs
  you), worried — mouth turned down; flat bars for eyes on a face without a mouth — (blocked), and
  asleep — eyes closed on a faded, colourless face — (offline). `expression` shows one on purpose:
  `happy` (smiling eyes, a bigger smile) when a run finishes or a person arrives, `listening` (a
  tilted head) while a person types to the agent, or any activity's own. RunStatus shows `happy`
  when its run is done. The root carries `data-expression`. The Avatar activity dot (`indicator`)
  and the activity word in the accessible name stay the primary signal, and follow `activity`
  whatever the expression; the root carries `data-activity`.
  The dot is notched out of the face with a mask rather than ringed in a surface colour, so it reads
  on any background, glass navigation included.
  `animate: true` moves the root in the shared presence loop exactly as Avatar does and lets the eyes
  blink, drift and scan — never without the motion preference, and not inside a
  `data-zx-motion="reduced"` region. `phase` offsets both.
- **Methods** — `set(values)` (any option above), `setActivity(activity, label?)` (which clears an
  `expression`, so the face shows the new activity), `getActivity()`, `getActivityWord()` (the localized word, for a host that names its own
  control), `getTraits()`, `destroy()`. No events: wrap it in a button or link to make it
  interactive.
- **In navigation** — `AppSidebar` and `ModuleBar` items take `agent` (these options, or `true`)
  and draw the AgentAvatar in place of their icon or tile, with the activity in the control's
  name, and their `activity`, `activityLabel`, `expression` and `indicator`; Composer mention items
  and Launcher items take `agent` too; AgentThread and RunTrace authors and ActivityItem avatar
  descriptors take `face`. Only a face's traits are read there, so agent-supplied data cannot
  animate, name or change the expression of it.
- **Elsewhere** — `emptyState()`, ApprovalCard and RunStatus take `agent` (traits and `name`, or
  `true`) in place of their icon: still and decorative, ApprovalCard's face looking up at you while
  the request waits, RunStatus's with the run's expression. KanbanView assignee descriptors take
  `face`, so an agent on a card's team is drawn as its face. The thread adapters
  (`connectAgUi()`, `connectUiMessageStream()`) draw the faces the thread's own `authors` give.
  Message `leading` and Card `media` accept an AgentAvatar like any other component.
- **Accessibility** — the SVG is always hidden. With `label` the root is `role="img"`, named
  "label, activity word"; without one it is `aria-hidden`, for use beside the agent's name.
