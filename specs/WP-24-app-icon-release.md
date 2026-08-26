# WP-24 — AppIcon refinement and 4.2.0 release

## Objective

Refine AppIcon into a quiet, recognisable identity vessel that belongs to Xenon's Aurora and
material language, then promote the complete reviewed worktree as Zx 4.2.0 only after every
automated, browser, package, documentation, and release check passes.

## Scope

- AppIcon's CSS-native material, hover, selection, and shape treatment.
- The distinction between circular application identities and compact entity/module chips.
- AppIcon demos, Launcher/AppSidebar consumers, semantic material tokens, and focused tests.
- A complete review of all currently staged 4.2.0 changes and generated documentation artifacts.
- Version, changelog, commit, main push, tag, GitHub release, npm publication, and website deploy.

## Constraints

- Zero runtime dependencies and no new image assets.
- White, optically centred glyphs across every ZeyOS module colour.
- Existing `tile` and `circle` values remain supported; generic AppIcon keeps its tile default.
- Badges, labels, selection, keyboard focus, reduced motion/transparency, and forced colours remain
  accessible.
- Circular geometry identifies spacious application destinations; `moduleChip()` remains the tile
  primitive for entities and dense records.
- One repository writer. Reviewers are read-only and their advice is verified against source,
  computed styles, tests, and screenshots.
- Do not commit, push, tag, publish, or deploy while any known release blocker remains.

## Non-goals

- No new icon library, runtime dependency, animation system, or raster decoration.
- No unrelated public API redesign.
- No per-component Aurora gradients or translucent dense data planes.

## Acceptance criteria

1. AppIcon is predominantly a dark neutral lens with module colour expressed through a restrained
   bloom and edge, rather than a saturated glossy tile.
2. Reflection, depth, hover, and selection are subtle at 28–44 px and stable in light and dark
   themes.
3. `zeyosAppIcon()` defaults to a circle; `moduleChip()` and generic AppIcon retain tile defaults.
4. Launcher application identities and application rails are circular; record/entity icons remain
   compact tiles.
5. Glyph centres differ from their vessel centres by less than 0.6 px in browser smoke coverage;
   all glyphs compute to the white semantic token.
6. Flat, Glass, and Deep Glass remain visually and mechanically distinct, with opaque preference
   fallbacks and no layout-size changes.
7. Full unit/smoke/token suites, dist build, site build/check, package dry-run, desktop/mobile visual
   review, console review, and git diff checks pass.
8. Version 4.2.0 is documented consistently, committed on main, pushed, tagged through a published
   GitHub release, available from npm, and deployed at zx.zeyos.com.
