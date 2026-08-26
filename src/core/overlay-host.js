import { resolveElement } from './dom.js';

const SCOPE_SELECTOR = '.zx-scope, [data-zx-theme], [data-zx-density], [data-zx-preset]';

/**
 * Finds the closest styling scope for a top-layer element.
 *
 * Popovers and dialogs escape clipping even when their DOM parent is inside an application shell,
 * so keeping them below that parent preserves inherited theme, density, material, and product
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
