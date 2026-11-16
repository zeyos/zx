# WP83 — Message: a plain card, border highlights, and stacks

Branch: `wp/83-message-stack`, from `wp/82-application-feedback`. AGENTS.md applies.

Maintainer request: the toast's kind-tinted gradient goes; a message is a plain card on the
overlay material, and a border — still or animated — is the way to make one stand out. Messages can
be stacked into one pile that opens to show them all, inline and floating alike.

## Items and required result

| ID | Scope | Required result |
| --- | --- | --- |
| S1 | Message CSS | A message is the overlay material with a neutral border and no kind tint: no gradient, no kind-coloured border or fill. The kind shows in the icon. The opaque fallbacks (no backdrop filter, reduced transparency, more contrast) are a neutral raised surface. |
| S2 | Message | `highlight: false \| true \| 'border' \| 'animated'` per message and as an instance default. `'border'` (and `true`) draws the border in the kind colour; `'animated'` adds a light travelling around the border, still under reduced motion (a kind-coloured border). Expressed as `data-highlight` on the message. `Message.progress()` accepts it. |
| S3 | Message | `stack: true` collapses the visible messages into one pile, the newest in front and up to two behind it, the rest hidden. The pile opens (all visible messages laid out) while the pointer is over it or focus is inside it; a press on it (touch included) keeps it open until a press outside it or Escape; `expanded: true` keeps it open. Timers hold while it is open by interaction. Works for an inline area and for floating regions, at every placement, bottom placements piling towards the top. An open floating stack taller than the viewport scrolls; closing a message from the keyboard keeps focus in the stack. |
| S4 | Message | `expand()`, `collapse()`, `isExpanded()`, `setStack(enabled)` on an instance, `expand`/`collapse` events; `Message.setStack(enabled)` / `Message.getStack()` for floating regions, applying to live regions at once. Floating regions stack by default (maintainer decision); `setStack(false)` restores the list. The root carries `data-stack` and `data-state="collapsed"\|"expanded"`. Focus order follows the visual order. |
| S5 | Message | The stack geometry is a pure, exported helper with unit tests. |

## File scope

- This specification.
- `src/components/message/**`, `website/demos/message.demo.js`.
- `styles/tokens/semantic.css` — the comment on `--zx-overlay-toast-image` only.
- `tests/unit/message-*.test.js`, `tests/unit/theme-presets.test.js` (the toast-image assertions),
  `tests/unit/css-subset.test.js` (the minifier comparison evens out `@property` descriptors),
  `tests/regression/message-stack.js`.
- `docs/llms.md` (the Message section), `docs/api.json` (generated), `CHANGELOG.md`.

## Validation

`npm test`; `node tools/run-regressions.js message-stack wp82-overlays overlays`; the demo in both
themes at desktop and phone width.

## Out of scope

Swipe to dismiss, a "clear all" control, new tier-2 tokens.
