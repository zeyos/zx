# WP90 — AgentAvatar: generated faces for agents

Branch: `wp/90-agent-avatar`, from `main`. AGENTS.md applies.

Product-owner request: generic, animated avatars for agents — colourful geometric shapes with eyes —
for an agent that has no picture of its own. Eight directions were studied side by side
(`specs/agent-avatar-2026-11/`, repository-only); the product owner chose **Token** — free-standing
coloured shapes — asked for pixel-creature shapes beside the geometric ones, and dropped the
tinted-tile **Glyph** variant built in the first round.

## Design

`AgentAvatar` draws a deterministic face from a seed (the agent's stable id, else its name): an SVG
in a 64-unit view box, built with `createElementNS`, never markup strings.

The face is a free-standing silhouette filled with the tone's `-solid`, with white eyes (`round`,
`oval`, `square`) and ink pupils. Twelve silhouettes: eight geometric — circle, squircle, hexagon,
triangle, drop, tilted pill, clover, dome — and four original pixel creatures on an 8 × 8 grid of
8-unit cells, so every cell is whole pixels at the presets — tuft, beacon, cap, antler (designs
from the materials sparring round; none uses an arcade sprite's grammar). Each is one crisp path of
row runs. A pixel creature draws its eyes on the grid: two-by-two cells with a one-cell pupil that
moves cell by cell with the activity (down-aside idle, up-aside thinking, lids lowered to the bottom
row working, centred needs-you, a flat bar blocked, a thin line offline).

**Traits.** `agentTraits(seed, overrides)` is pure: tone from `avatarTone(seed)` (so an agent's
initials tile and its face agree when they share a key), every other trait from 32-bit FNV-1a over
the same normalised key plus a per-trait salt, finished with the MurmurHash3 mixer (FNV-1a's low
bits alone would make every trait a function of the tone), so traits are independent of each other
and of the tone. The trait tables (`AGENT_BODIES`, `AGENT_PIXEL_BODIES`, `AGENT_EYES`) and their order are
contract: reordering them re-faces every agent. `tone`, `body` and `eyes` options override single
traits; an unknown value is ignored.

**Geometry.** `agentFace(traits, activity, px)` is pure and returns the shapes to draw as plain data
(`{ tag, part, attrs }`), so geometry is unit tested without a DOM. `px` is the rendered size
(presets count as 24 / 32 / 40): the pupils go below 20px and the eyes grow at 24px and below.

**Expression is static.** Each activity changes the eyes' geometry, so it reads with motion off:

| Activity | Eyes |
| --- | --- |
| idle | open, seeded shape |
| thinking | look up and to the side (pupils, or the eyes themselves); one eye slightly smaller |
| working | look down, lids lowered (62% height) |
| needs-you | 20% larger, looking straight out |
| blocked | flat bars |
| offline | closed (a shallow downward arc), the whole face desaturated and faded |

No mouths, no brows, nothing angry, sad or "dead". The Avatar activity dot (`indicator`, on by
default) and the activity word in the accessible name remain the primary signal.

**Motion** (`animate: true`, with an activity): the root joins the shared presence loop exactly as
Avatar does (breathe, sway, bob, lean). The eyes blink (a double blink for needs-you), drift while
thinking and scan while working through CSS keyframes inside `prefers-reduced-motion:
no-preference`; `styles/base.css` already stops them inside a `data-zx-motion="reduced"` region.
`phase` (or one derived from the seed) offsets the eye animations too.

**Colour.** Tier-2 only: the tone roles, plus two new semantic tokens for what eyes on a solid fill
need regardless of theme — `--zx-color-agent-eye` (white) and `--zx-color-agent-pupil` (near
black). Forced colours draw the body in `CanvasText`, eyes in `Canvas`.

## API

```
new AgentAvatar(target, {
  seed: null, name: '', tone: null, body: null, eyes: null,
  size: 'md', label: null, activity: null, activityLabel: null, indicator: true,
  animate: false, phase: null, msg
})
```

Methods: `set(values)`, `setActivity(activity, label?)`, `getActivity()`, `getTraits()`,
`destroy()`. No events — it is a display component; interaction belongs to a wrapping control.
Exports: `AgentAvatar`, `agentTraits`, `agentFace`, `AGENT_BODIES`, `AGENT_PIXEL_BODIES`,
`AGENT_EYES`.

**Accessibility.** The SVG is always `aria-hidden`. With `label`, the root is `role="img"` named
"label, activity word"; without, it is decorative (`aria-hidden`). No live region. No keyboard map:
the component is not focusable.

## File scope

- This specification; `CHANGELOG.md`; `specs/agent-avatar-2026-11/README.md` (outcome note).
- `src/components/agent-avatar/agent-avatar.js`, `agent-avatar.css`, `agent-face.js`.
- `src/index.js` (exports), `styles/zx.css` (import).
- `styles/tokens/semantic.css`: the two `--zx-color-agent-*` tokens, in both colour paths —
  explicitly in scope.
- `tests/unit/agent-avatar.test.js`; a case in `tests/smoke/smoke.js`.
- `website/demos/agent-avatar.demo.js`; `website/docs.js` (`COMPONENT_IDS`).
- `docs/llms.md` (reference block), the generated `docs/api.json`, `docs/components/*`,
  `docs/llms-small.txt`, and the component lists in `docs/llms.txt`, `website/llms.txt` and
  `README.md`.
- `tools/size-budget.json`: the JS bundles grow by about 5 KB (3 KB minified).

## Validation

`npm test`; `npm run build` and `npm run check:size`; `node tools/run-smoke.js`; the demo page in
light and dark, at the default and a changed spacing unit, without console errors.

## Out of scope

Pointer-following gaze, mouths and emotional expressions, an `Avatar` fallback that draws a face,
AgentThread or RunTrace adopting AgentAvatar, an AvatarGroup/stack component, a `<zx-agent-avatar>`
element, image export (`toDataURL`), the Glyph variant and the other studied directions, and body
materials (gradients, gloss, glass): those are being explored in `specs/agent-avatar-2026-11/`
and need a decision first.
