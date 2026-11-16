# The website

## What the references do well

- **Beautiful UI** — one 960px column framed by a 1px hairline, a sticky left rail, *dashed*
  dividers; a deliberately small hero (21px semibold, −0.02em tracking, balanced wrap); numbered
  sections; neutral oklch role tokens (page / canvas / surface / inset / ink 1–3 / line soft and
  strong) mirrored for dark; six-layer, very soft shadows; shimmer text for "thinking"; one
  consistent fictional dataset throughout.
- **Radix** — every demo on a tinted stage, the code collapsed under a fade with an expand control;
  Anatomy, per-part API tables (props, data attributes, CSS variables), and a Keyboard Interactions
  table on every page.
- **Arc UI** — the install command in the page header, Preview / Code tabs, a "Live · keyboard
  ready" badge, **Copy page** as Markdown, When to use / When not to use; Geist display with Inter
  body; a word-staggered hero, view transitions.
- **affectUI** — When to use / When not to use naming the alternative; guides organised by the jobs
  agent-product teams search for (tool calls, human-in-the-loop, streaming without layout shift,
  token costs).
- **vercel-labs/ui** — restrained monochrome, tabular numbers everywhere, an interactive
  "ask → build → component" demo as the landing page, a one-click "Copy prompt" quick start.

## Moves for this site

All of these are product documentation or intentional public examples, so they sit inside the
AGENTS.md public-content rules.

1. **Lead with agents.** Rewrite the hero around agents composing interfaces: beside the headline, a
   live surface streams in next to its JSON (reuse a scenario from `agent-canvas`). Today
   `website/index.html` never says "agent".
2. **A "For agents" band** with Copy prompt, links to `llms-small.txt`, the surface guide and (later)
   the MCP server.
3. **Show, then claim.** Move "Real components, running right here" to second position; replace the
   six abstract value cards with three demonstrated claims (accessible by default, dependency-free,
   agent-safe), each with a live example.
4. **Demo stage.** Docs demos on a tinted stage with the code collapsed under a fade
   (`website/docs.css`); variant toggles inside demo cards.
5. **Per-component anatomy**: a keyboard table, state attributes, and the `--zx-*` tokens a
   component reads — the keyboard notes already exist in the reference text.
6. **Typography.** A smaller, tighter hero heading; `text-wrap: balance` on headings; tabular
   numerals in every data demo; Inter Display (optical size) for display sizes. See
   [fonts-icons.md](fonts-icons.md).
7. **Colour and depth.** Move the fixed `--site-*` hex values in `website/site.css` to oklch role
   tokens with softer multi-layer shadows; hairline or dashed rules between sections.
8. **Structure.** Number the home-page sections; a sticky table of contents on long docs pages.
9. **Showcase.** Filter tiles by kind (Templates, Patterns, Agents); show the components each layout
   uses (the `components` array already exists); feature `agent-canvas` first among patterns.
10. **Motion with a purpose.** Shimmer for "thinking", a number ticker on stat tiles in the hero
    demo, view transitions between docs pages — all behind `prefers-reduced-motion:
    no-preference`.
11. **Copy page / Copy prompt** on every component page (WP86).
12. **Housekeeping.** The source pages' header version reads `5.6.0`; the build and `site.js` stamp
    the real version, so readers never see it, but the source should match the package.
