# Fonts and icons

## Today

- `--zx-font-sans` puts Inter first; `--zx-font-mono` puts "Geist Mono" first
  (`styles/tokens/global.css`). The package ships neither font; only the website self-hosts Inter
  (variable, Latin 48 KB + Latin Extended 85 KB, OFL). **Geist Mono is named but never shipped** —
  without a local install, code falls through to the system monospace.
- Icons: 52 bundled Lucide glyphs (61 names with aliases), 24 grid, stroke 1.75, ISC and Feather MIT
  notices inline; Font Awesome opt-in; `registerIcons()` takes any viewBox, stroke or fill.

## Ioskeley Mono

An OFL-1.1 custom build of Iosevka (v2.2.0, October 2026, one maintainer), styled after a
commercial typeface but not a copy. 10 weights, upright and italic, Normal and SemiCondensed;
Standard, Term and NL (no ligatures) families; Nerd Font builds. Static TTF and WOFF2 only — about
96 KB per upright weight, no variable font, no npm package.

**Verdict:** excellent for editors, terminals and logs; too heavy to be a UI library default (one
weight ≈ 4× Geist Mono's 23 KB variable file). Offer it as a **documented opt-in**: the Term family
suits RunTrace output, CodeEditor and terminal panes. Its name alludes to a commercial trademark, so
reference it rather than bundle it.

## Recommendations

**Fonts**

- Add an opt-in `@zeyos/zx/fonts.css` (WP96) shipping Inter variable (Latin + Latin Extended,
  ≈ 133 KB) and Geist Mono variable (≈ 23 KB) with their OFL texts. Keep fonts out of the default
  CSS, so applications that self-host or use system fonts pay nothing.
- Document the swap: one `--zx-font-mono` / `--zx-font-sans` override, with tested stacks for
  Ioskeley Mono, JetBrains Mono, IBM Plex Mono and Commit Mono; Geist and IBM Plex Sans for UI.
- Website: Inter Display for headings (optical size), Inter for text, Geist Mono for code — or the
  whole Geist family (Sans, Mono, Serif) for one coherent voice; Instrument Serif or Fraunces only
  for marketing display type.
- Never bundle: Berkeley Mono (commercial), Fontshare fonts (redistribution terms unclear).

**Icons**

- Stay on Lucide as the bundled set; update 1.53 → current and add the glyphs new surface nodes need.
- Publish the valid icon names in the agent catalogue so a model does not guess `choice.icon`.
- One generator script that turns an upstream set into a `registerIcons()` map keyed by Zx's
  canonical names; document Tabler (MIT, 6,500 icons, same 24/2 grid) as the first alternative.
  Ship separate icon-pack packages only on demand.
- Avoid Remix Icon for now (its repository licence changed in January 2026 while npm still says
  Apache-2.0).

**Licensing notes for the package**

OFL allows bundling in packages, commercial ones included, with the licence and copyright kept and
the font not sold on its own. Keep the ISC/MIT notices in `icons.js`. Third-party assets in a future
Pro package stay under their own licences, listed in a NOTICE file.
