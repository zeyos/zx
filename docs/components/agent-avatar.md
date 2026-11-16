# AgentAvatar

A generated face for an agent without a picture: a coloured shape or a pixel creature with eyes that take what the agent is doing.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/agent-avatar · All components: https://zx.zeyos.com/docs/components/index.md

A generated face for an agent that has no picture: a coloured silhouette — a geometric shape or a
pixel creature — with eyes that take the agent's activity. Everything about it is derived from a
seed, so the same agent has the same face on every screen; it is decorative by default, like
Avatar.

- **Options** — `seed` (the agent's stable id; `null` uses `name`, but a rename then changes the
  face), `name`, `tone` (the Avatar tones, or `null` to derive it), `body` and `eyes` (fix one
  trait instead of deriving it), `size: 'sm'|'md'|'lg'|<pixels>` (24 / 32 / 40px at the default
  spacing unit), `label`, `activity: 'idle'|'thinking'|'working'|'needs-you'|'blocked'|'offline'|null`,
  `activityLabel`, `indicator: true`, `animate: false`, and `phase: null|number`.
- **Silhouettes** — twelve, filled with the tone's `-solid`: circle, squircle, hexagon, triangle,
  drop, tilted pill, clover and dome, and four pixel creatures on an 8 × 8 grid of whole-pixel cells
  — tuft, beacon, cap and antler. Eyes are `round`, `oval` or `square`; a pixel creature draws
  square eyes on its grid, two cells wide with a one-cell pupil. Eyes are white with dark pupils, in `--zx-color-agent-eye` and `--zx-color-agent-pupil`, which keep their
  colour in both themes.
- **Traits** — `agentTraits(seed, overrides?)` returns `{tone, body, eyes, spacing}`. The tone is
  `avatarTone(seed)`, so the face matches an initials Avatar keyed the same way; each other trait
  hashes the same normalised key with its own salt. The tables `AGENT_BODIES`, `AGENT_PIXEL_BODIES`
  and `AGENT_EYES` are contract, order included. `agentFace(traits, activity, px)` returns the
  drawing as plain data (`{tag, part, attrs, children?}` in a 64-unit view box), for tests or a
  server.
- **Sizes** — small sizes draw less: no pupils below 20px, and larger eyes at 24px and below.
- **Activity** — the eyes take a static expression: open (idle), looking up and aside (thinking),
  lowered (working), wide (needs you), flat bars (blocked), closed on a faded, colourless face
  (offline). No mouths and nothing angry or sad. The Avatar activity dot (`indicator`) and the
  activity word in the accessible name stay the primary signal; the root carries `data-activity`.
  `animate: true` moves the root in the shared presence loop exactly as Avatar does and lets the eyes
  blink, drift and scan — never without the motion preference, and not inside a
  `data-zx-motion="reduced"` region. `phase` offsets both.
- **Methods** — `set(values)` (any option above), `setActivity(activity, label?)`,
  `getActivity()`, `getTraits()`, `destroy()`. No events: wrap it in a button or link to make it
  interactive.
- **Accessibility** — the SVG is always hidden. With `label` the root is `role="img"`, named
  "label, activity word"; without one it is `aria-hidden`, for use beside the agent's name.
