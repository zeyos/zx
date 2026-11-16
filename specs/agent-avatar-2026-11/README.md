# Agent avatars — exploration, November 2026

> Outcome, 2026-11-16: the product owner chose **Token**; it is `AgentAvatar` in WP90
> (`specs/WP-90-agent-avatar.md`). A first round also shipped **Glyph** as a second variant; the
> owner dropped it. A second round added four pixel-creature bodies; the owner dropped those too in
> favour of six more geometric shapes (triforce, pentagon, trapezoid, cross, diamond, octagon),
> and took **Soft** from the materials study below as an opt-in `material`. The prototypes keep the
> study's own copies of every option, except `materials.html`, which draws whatever the shipped
> table holds and so now shows the geometric set. The first
> prototype's trait hashing has a flaw the component fixes: FNV-1a's low bits make a salted trait a
> function of the tone, so it gives one body per tone.

Repository-only. `specs/` never reaches the site or the package; nothing here is approved for
publication until a work package lifts it into a component.

Open `specs/agent-avatar-2026-11/prototype.html` from the development server (`npm run serve`,
then `/specs/agent-avatar-2026-11/prototype.html`). Every option renders the same twelve agent
names, a size ladder (16–128px), the six `AgentActivity` states, and three in-context uses (a
chat message, a list row, a stack, an empty-state hero), with the existing Avatar activity dot.
The controls switch theme, accent preset, the roster's activity, motion and the dot.

Sparred on 2026-11-16 with two external models (GPT-6 Sol at xhigh, read-only; Fable), each
answering the same brief independently. Their transcripts are kept outside the repository.

## The options

| # | Option | From | One line |
|---|---|---|---|
| 1 | Token | Fable | Free-standing solid silhouettes (8) with white eyes and ink pupils. |
| 2 | Peek | Fable (its pick) | Tinted rounded tile, one solid body rising from the bottom edge; posture is state. |
| 3 | Pebble | Codex (its pick) | Asymmetric tinted body, tone-ink outline and eyes, one solid facet. |
| 4 | Totem | both | Two-tone constructivist stack: head with eyes, neck, base, cap. |
| 5 | Orbit | Codex | Solid core with ink eyes and one satellite that turns while working. |
| 6 | Visor | Fable | Device face: an ink visor slot with light pips; expression is pip geometry. |
| 7 | Prism | Codex | Angular face plate, translucent inset, slanted slot eyes. |
| 8 | Glyph | Fable | Today's Avatar fallback tile with eye glyphs in place of initials. |

Considered and dropped by the sparring partners: a single watching eye ("Lens" — reads as
surveillance in software that reads customer records), a folded-corner tile (mistaken for an
AppIcon), and organic blobs or gradient orbs (the industry default for assistant identities;
indistinguishable at 24px).

## Where both partners agreed

- A new **`AgentAvatar`** component rather than a `kind` on `Avatar`: different SVG, scaling and
  motion rules; the shape generator lives in a pure internal module so `Avatar` can adopt it later
  as a fallback.
- `seed` (a stable agent id) separate from `name`, so renaming an agent does not change its face;
  tone from `avatarTone()` so an agent's initials tile and face agree.
- **No mouths.** Blocked is flat, offline is closed — never angry, sad or "dead".
- State is readable from **static geometry** (eye shape, posture); motion only decorates it, and
  the existing activity dot and word stay.
- Eye and blink motion belongs in the shared presence loop (CSS keyframes would ignore a
  `data-zx-motion="reduced"` region) — which means a spec must allow touching
  `src/internal/presence-loop.js`.
- Version the generator: trait tables and hashing are a contract the moment anyone ships.

## Open points for the spec

- Eyes on solid tone fills need a white and an ink that do not flip with the theme. The study
  borrows tier-1 `--zx-gray-0` / `--zx-gray-950`; a component needs two semantic tokens.
- `h()` builds HTML only; the component needs its own `createElementNS` helper or an `h.svg`.
- Amber-500 with white eyes is the weakest contrast pair and should be measured.
- Stacks: there is no AvatarGroup yet; containerless options (Token, Totem, Orbit, Prism) stack
  badly.

## Body materials (second round)

`materials.html` draws the shipped geometry (`agentTraits()` + `agentFace()`) with eleven body
treatments, each on every silhouette, the size ladder, the six activities, and page, raised and
Aurora backdrops. Sparred again with GPT-6 Sol (xhigh, read-only) and Fable on the same brief.

Both partners, independently: **flat stays the default**. Most avatars render at 16–40px, where no
material survives, and white eyes have little contrast headroom (3.7–4.3:1 on the solids; lighten a
body by more than about 10% under the eyes and green drops below 3:1). Ranked:

| Treatment | Verdict |
|---|---|
| Flat | Default. |
| Soft (Fable) / Matte depth (Codex) | On-brand: a quiet tonal ramp that only darkens near the eyes. The one gradient worth an opt-in. |
| Lip | Robust hard underside, a little toy-like; fits the pixel creatures. |
| Rim | Utility for avatars on surfaces of their own colour. |
| Fold, Ceramic | Acceptable for large illustration only. |
| Duotone | The most colourful; two colours per agent weaken identity and colour-blind distinctness. |
| Sticker, Gloss, Glass | Off-brand or gimmicks; Glass changes colour with its backdrop. |

Implementation notes for any gradient: `gradientUnits="userSpaceOnUse"` (clover is five shapes),
paint both fill and stroke (polygons round their corners with a stroke), a deterministic id per tone
and material (`zx-agent-avatar-soft-blue`) instead of a counter, a flat fallback after `url()`, flat
below 28px, when offline, in print and in forced colours.

Both partners also questioned mixing pixel creatures into the hashed pool (two idioms in one
roster); the owner then removed them.
