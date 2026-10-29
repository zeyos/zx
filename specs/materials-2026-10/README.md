# Materials — exploration, October 2026

> Lifted into the product on 2026-10-29: the stylesheet defaults are the proposed Glass, and the
> studio's `MATERIAL_RECIPES` in `website/theme-presets.js` carry Deep glass, Frost, Smoke, Paper
> and Satin, composed from the per-theme glass ingredients (`--zx-color-glass-rim/-ring/-lift/
> -shade/-edge/-tint`). The prototype below keeps the exploration's own copies.
>
> Reviewed the same day in two rounds by two external models (GPT-6.1 Terra and Sol, read-only,
> transcripts kept outside the repository). Their consensus, applied: the shade became the pane's
> body in both themes with a coverage floor in the smoke contract; the lift stops short of the
> face; Deep glass lost its luminous bevel; Frost lost its polished rim; Smoke's body was a 95%
> share of a 12%/38%-alpha tint (11%/36% opaque) and is now the tint mixed into the overlay base;
> Paper's shadows tightened; Satin's card got its sheen through its shadow; resting cards on
> opaque materials take the surface shadow; the grain interpolates in sRGB at 3%; the toast
> composes its own status tint; the no-backdrop-filter fallback covers cards, chrome and
> controls and precedes the preference fallbacks; hovers never thin a pane's body; and Enamel,
> which both proposed, is the eighth material.

Repository-only. `specs/` never reaches the site or the package; nothing here is approved for
publication until it is lifted into `website/theme-presets.js` and the stylesheet defaults.

Open `specs/materials-2026-10/prototype.html` from the development server
(`npm run serve`, then `/specs/materials-2026-10/prototype.html`). Every cell renders the shell
chrome, a raised card, app icons, controls, a menu, a dialog and a toast over a page with a
table and categorical colour, lit by an Aurora, in one material and one theme, through the same
tokens the components read. The recipes are `materials.css`; a block there is what
`themeVars()` would export for that material.

## Why the current glass reads as dull

Measured on `theme.html` and in the prototype's first three rows:

1. **It is a grey tint, not a lit pane.** The overlay base is the raised grey at 62–72% with a
   blur behind it. In dark that is a 70% grey-800 slab: nothing behind it survives except a
   smear, and the slab is darker than the chrome beside it, so it reads as mud. In light it is a
   milky grey with the page's colour drained out.
2. **The reflection is in the wrong place.** The specular is a 145° corner wash at 48–58%
   strength. Glass does not do that; light sits on a pane's *edge* — a bright top rim and a cut
   outer edge — and the wash reads as a smudge on the surface.
3. **Deep glass is only "more".** It raises the blur, the saturation and the wash strength on
   the same recipe, so it becomes thinner, blurrier and muddier without becoming thicker. The
   card in the studio's material card is pixel-identical between Glass and Deep glass.
4. **No contrast management.** Translucency alone lowers text contrast; the recipe compensates by
   raising the base opacity, which is what kills the glass.

## Proposed: Glass and Deep glass

Both keep every role, every fallback (reduced transparency, increased contrast, forced colours,
no `backdrop-filter`) and every consumer unchanged; only the values move.

**Glass**

- *Lift, not grey.* The base drops to 56–60% (dark 50%) and a white lift gradient sits on it —
  heavy at the top, gone by two thirds — so the pane is lit from above instead of tinted.
- *Edge light.* `inset 0 1px 0` near white, a hairline inner ring, and in dark a 1px dark outer
  line, so the pane has a cut edge against the scene. The corner wash is gone
  (`--zx-overlay-specular-strength: 0%`).
- *The filter manages contrast.* `saturate()` keeps colour behind alive through the blur;
  `brightness()` moves a little up in light and down in dark so text keeps its contrast while
  the base stays thin.
- *A faint accent caustic* (6–8%) at the far corner ties the pane to the product colour.

**Deep glass** — a thick pane, drawn by what thickness does to light:

- thinner base (light 46%, dark 38%), wider blur (32–36px), more saturation (175–190%);
- a double rim: the 1px top line plus a soft inner glow along every edge (`inset 0 0 28px`);
- one narrow diagonal specular band instead of a wash;
- a stronger caustic, and a fine grey grain (an SVG `feTurbulence` data URI at ~7% alpha, no
  colour) so the diffusion stops looking like a plastic sheet.

## New materials worth offering

| Material | Character | Where it fits | Cost |
| --- | --- | --- | --- |
| **Frost** | milk glass: heavy diffusion, almost no reflection; colour behind becomes a wash, text reads as on paper | reading surfaces — dialogs, sheets, the launcher; products that want depth without sparkle | blur |
| **Smoke** | tinted glass that darkens the scene behind it: sunglass glass in dark, a grey-smoked pane in light | launchers, media, dashboards, dark-first products | blur |
| **Paper** | opaque, matte, layered: depth from stacked soft shadows and a fine tooth, no blur anywhere | documents, finance, print-adjacent products, low-end hardware | none |
| **Satin** | brushed, opaque: a vertical sheen on controls and chrome, a bright top rim and a darker foot | dense operational tools where controls must read as pressable without transparency | none |

Paper and Satin are the two that cost nothing to render and survive every fallback unchanged,
which also makes them honest answers for "reduced transparency" rather than a degraded glass.

## Lifting a material into the product

1. `website/theme-presets.js`: replace the `subtle` (stylesheet defaults) and `strong` recipes in
   `themeVars()` with the Glass and Deep glass blocks, and add the new ids to `MATERIALS`
   (`frost`, `smoke`, `paper`, `satin`). The grain data URI becomes one `:root` token
   (`--zx-glass-grain`) so the recipes reference it rather than restate it.
2. `styles/tokens/semantic.css`: the stylesheet defaults *are* Glass, so its glass and overlay
   roles take the new Glass values; `dark.css` takes the dark corrections.
3. `tests/unit/theme-presets.test.js` (or a new test): every material id resolves to a complete
   token set, light and dark, and the three preference fallbacks still override all of it.
4. The studio's Material control grows from three segments to a six-item choice with a one-line
   description each; the docs' theming guide and `docs/llms.md` describe the materials by
   character (the table above), not by numbers.
5. Verify on `theme.html` and on the layouts (`tools/shoot-layout.js crm --preset …`) in both
   themes; the audits must stay green — text on glass is the contrast risk, and the
   `brightness()` step is what protects it.
