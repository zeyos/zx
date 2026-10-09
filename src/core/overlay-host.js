import { resolveElement } from './dom.js';

const SCOPE_SELECTOR = '.zx-scope, [data-zx-theme], [data-zx-preset]';

/**
 * Finds the closest styling scope for a top-layer element.
 *
 * Popovers and dialogs escape clipping even when their DOM parent is inside an application shell,
 * so keeping them below that parent preserves inherited theme, preset, material, and product
 * token overrides without sacrificing top-layer behaviour. The document body remains the safe
 * fallback for unscoped applications.
 *
 * @param {Element|string|null} [source=null] Element or selector whose styling scope should own the overlay.
 * @returns {Element}
 */
export function overlayHost(source = null) {
  const context = source == null
    ? (document.activeElement instanceof Element ? document.activeElement : null)
    : resolveElement(source);
  const scope = context?.closest?.(SCOPE_SELECTOR) ?? null;
  if (!scope || scope === document.documentElement || scope === document.body) return document.body;
  return scope;
}

/**
 * Like `overlayHost()`, but declines to guess for a source that is not in the document yet.
 *
 * A component created before its anchor is connected cannot know which themed region the anchor
 * will end up in: the anchor's ancestors are not there yet, so `overlayHost()` would answer
 * `<body>`, outside every `[data-zx-theme]` and `.zx-scope`. This returns null instead, so the
 * overlay can stay detached until it first opens and resolve its host with `overlayHost()` then,
 * when the anchor is in place. The focused-element default (`source` null) is always connected and
 * resolves exactly as `overlayHost()` does.
 *
 * @param {Element|string|null} [source=null] Element or selector whose styling scope should own the overlay.
 * @returns {Element|null} The host, or null while the source is not connected to the document.
 */
export function connectedOverlayHost(source = null) {
  if (source == null) return overlayHost(null);
  const context = resolveElement(source);
  return context?.isConnected ? overlayHost(context) : null;
}
