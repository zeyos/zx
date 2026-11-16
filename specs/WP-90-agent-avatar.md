# WP90 — AgentAvatar: generated faces for agents

Branch: `wp/90-agent-avatar`, from `main`. AGENTS.md applies.

Product-owner request: generic, animated avatars for agents — colourful geometric shapes with eyes —
for an agent that has no picture of its own. Eight directions were studied side by side
(`specs/agent-avatar-2026-11/`, repository-only); the product owner chose **Token** — free-standing
coloured shapes — dropped the tinted-tile **Glyph** variant built in the first round, tried and
dropped pixel-creature bodies in favour of more geometric shapes, and asked for the **soft**
material from the materials study as an opt-in.

## Design

`AgentAvatar` draws a deterministic face from a seed (the agent's stable id, else its name): an SVG
in a 64-unit view box, built with `createElementNS`, never markup strings.

The face is a free-standing silhouette filled with the tone's `-solid`, with white eyes (`round`,
`oval`, `square`) and ink pupils. Fourteen geometric silhouettes — circle, squircle, hexagon,
triangle, drop, tilted pill, clover, dome, wedge, pentagon, trapezoid, cross, diamond,
octagon — whose polygons round their corners with a stroke the colour of the fill.

**Material.** `material: 'flat'|'soft'`, default `flat`, an application-wide choice rather than a
trait. `soft` (from the materials study) draws a per-instance `linearGradient` in user space
(0,4 → 0,60) with stops mixed in CSS from the tone and the two eye tokens: 10% toward the eye white
at the top, the plain tone from 30% to 50% — across the eye row, so white eyes keep their flat-fill
contrast — and 14% toward the pupil ink at the foot. The body reads it through
`--zx-agent-avatar-paint` (`url(#id)` with the solid fill as fallback). The id is unique per
instance (`crypto.randomUUID`), never a module counter, so pages pass duplicate-id audits. Soft is
drawn flat below 28px, when offline, in print and in forced colours.

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
| thinking | look up and to the side — the pupils, or below 20px, where there are none, the eyes themselves, one slightly smaller |
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

**The activity dot** is notched out of the face with a CSS mask (mirrored in right-to-left) instead
of an outline in a surface colour, so it reads on glass navigation and hover or current rows; a
hollow dot shows the background through it. An AgentThread `face` contributes only its five trait
strings; the thread draws it still and decorative whatever else the data carries.

**Run traces and activity.** `authorFace()` in `src/internal/agent-model.js` is the one reader of
a `face`: `true`, or a plain object's `seed`, `tone`, `body`, `eyes` and `material` strings; a
person or any other value draws initials. RunTrace hand-offs draw an author with `face` as its
still AgentAvatar; an ActivityItem avatar descriptor with `face` draws the actor as one, carrying
`name`, `label`, `size`, `tone`, `activity`, `activityLabel`, `animate` and `phase`.

**Navigation and threads.** `AppNavItem` (AppSidebar, the rail, flyouts) and `ModuleItem` take
`agent`: AgentAvatar options without size, label or motion, or `true`. `appNavIcon()` builds a
fresh AgentAvatar for every place an item is drawn — at rest, so it holds no listener or loop entry
and goes with its row — sized by the slot in each component's stylesheet, and always at the small
(24px) level of detail, so a menu reads as one calm, flat set and `soft` is drawn flat there. The activity's word
(`getActivityWord()`) joins the control's accessible name after the visible label, badge counts
included. A ModuleBar agent replaces the tile, whatever the appearance. AgentThread's `Author` takes
`face` (`{seed, tone, body, eyes, material}` or `true`) and draws the agent's AgentAvatar instead of
initials or an `icon` tile — `face` wins over `icon`. The Agent workspace layout draws every agent
with AgentAvatar, soft material: roster, inspector, chat head, task owners, notifications, the
palette and the route hint. Agent chat, Agent canvas and AI chat draw their agents' faces in the
thread and the navigation heading (and Agent canvas on its welcome); a model keeps its mark, and
Composer mention items take `agent` like navigation items and draw the agent's still face; each
Composer keeps one avatar per mentioned item id, reused while the list redraws on every keystroke
and destroyed with it. AI chat's `@` list and the Composer demo use it. Launcher items take `agent`
the same way — one owned avatar per item id, a tile's size for `kind: 'application'` — with the
activity's word as visually hidden text after the label, so the option's name keeps everything else
the row prints. The Agent workspace palette and the Launcher demo use it.

## API

```
new AgentAvatar(target, {
  seed: null, name: '', tone: null, body: null, eyes: null, material: 'flat',
  size: 'md', label: null, activity: null, activityLabel: null, indicator: true,
  animate: false, phase: null, msg
})
```

Methods: `set(values)`, `setActivity(activity, label?)`, `getActivity()`, `getTraits()`,
`destroy()`. No events — it is a display component; interaction belongs to a wrapping control.
Exports: `AgentAvatar`, `agentTraits`, `agentFace`, `AGENT_BODIES`, `AGENT_EYES`.

**Accessibility.** The SVG is always `aria-hidden`. With `label`, the root is `role="img"` named
"label, activity word"; without, it is decorative (`aria-hidden`). No live region. No keyboard map:
the component is not focusable.

## File scope

- This specification; `CHANGELOG.md`; the repository-only study `specs/agent-avatar-2026-11/`
  (`README.md`, `prototype.html|css|js`, `materials.html|css|js`), approved by the product owner as
  working material and never published (`specs/` is a private path in `tools/check-site.js`).
- `src/components/agent-avatar/agent-avatar.js`, `agent-avatar.css`, `agent-face.js`.
- `src/index.js` (exports), `styles/zx.css` (import).
- `src/internal/app-rail.js`, `src/components/app-sidebar/app-sidebar.js|css`,
  `src/components/app-rail/app-rail.css`, `src/components/module-bar/module-bar.js|css`:
  the `agent` item — explicitly in scope.
- `src/components/agent-thread/agent-thread.js`, `src/components/run-trace/run-trace.js`,
  `src/components/activity-item/activity-item.js`, `src/internal/agent-model.js`: `face`;
  `website/demos/run-trace.demo.js`, `activity-item.demo.js`, `activity-list.demo.js`.
- `src/components/composer/composer.js|css`, `website/demos/composer.demo.js`: mention `agent`.
- `src/components/launcher/launcher.js|css`, `website/demos/launcher.demo.js`: item `agent`.
- `website/layouts/agent-workspace.layout.js|css`, `agent-chat.layout.js`, `agent-canvas.layout.js`,
  `ai-chat.layout.js`; `website/demos/app-sidebar.demo.js`,
  `website/demos/module-bar.demo.js`.
- `styles/tokens/semantic.css`: the two `--zx-color-agent-*` tokens, in both colour paths —
  explicitly in scope.
- `tests/unit/agent-avatar.test.js`; a case in `tests/smoke/smoke.js`.
- `website/demos/agent-avatar.demo.js`; `website/docs.js` (`COMPONENT_IDS`).
- `docs/llms.md` (reference block), the generated `docs/api.json`, `docs/components/*`,
  `docs/llms-small.txt`, and the component lists in `docs/llms.txt`, `website/llms.txt` and
  `README.md`.
- `tools/size-budget.json`: the JS bundles grow by about 5 KB (3 KB minified); the ZeyOS bundle,
  whose AppSidebar and ModuleBar now draw agents, by about 6 KB (4 KB minified).
- `tools/check-language.js` and `tests/unit/language-audit.test.js`: a comma-joined name ("Quill,
  Offline") is explained when each part is — the German catalogue shares "Offline" with English.

## Validation

`npm test`; `npm run build` and `npm run check:size`; `node tools/run-smoke.js`; the demo page in
light and dark, at the default and a changed spacing unit, without console errors.

## Out of scope

Pointer-following gaze, mouths and emotional expressions, an `Avatar` fallback that draws a face,
animated avatars in navigation, an AvatarGroup/stack
component, a `<zx-agent-avatar>`
element, image export (`toDataURL`), the Glyph variant, pixel-creature bodies and the other studied
directions, and every material but `soft` (see `specs/agent-avatar-2026-11/`).
