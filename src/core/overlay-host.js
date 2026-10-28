import { resolveElement } from './dom.js';

const SCOPE_SELECTOR = '.zx-scope, [data-zx-theme], [data-zx-preset]';

/**
 * Open dialogs an anchored overlay must live inside. A modal one makes everything outside its
 * subtree inert, and a focus-trapping one sends Tab back into itself, so a panel parked outside
 * either could be seen but never used. `:popover-open` is the floating non-modal Sheet.
 */
const DIALOG_SELECTOR = 'dialog:modal, dialog[open], dialog:popover-open';

/**
 * Finds the closest styling scope for a top-layer element.
 *
 * Popovers and dialogs escape clipping even when their DOM parent is inside an application shell,
 * so keeping them below that parent preserves inherited theme, preset, material, and product
 * token overrides without sacrificing top-layer behaviour. The document body remains the safe
 * fallback for unscoped applications.
 *
 * Never answers a dialog: this is where a dialog itself, or anything at rest, belongs.
 *
 * @param {Element|string|null} [source=null] Element or selector whose styling scope should own the overlay.
 * @returns {Element}
 */
export function overlayScope(source = null) {
  return scopeOf(contextOf(source));
}

/**
 * Finds the element an anchored overlay should live in while it is open.
 *
 * A source inside an open `<dialog>` — modal, focus-trapping, or a floating non-modal Sheet — is
 * hosted by that dialog: the panel still rises into the top layer above it, and being in its
 * subtree is what keeps the panel out of `showModal()`'s inertness and inside a focus trap's
 * reach. Anywhere else the answer is the nearest styling scope, as `overlayScope()` gives it.
 *
 * Without a source the focused element supplies the scope, and no dialog is chosen: what is
 * being hosted then is not anchored to the focused element, only themed by it.
 *
 * @param {Element|string|null} [source=null] Element or selector the overlay is anchored to.
 * @returns {Element}
 */
export function overlayHost(source = null) {
  const context = contextOf(source);
  return (source == null ? null : openDialogOf(context)) ?? scopeOf(context);
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
 * @param {{dialog?: boolean}} [options={}] `dialog: false` answers the styling scope only, as
 *   `overlayScope()` does — where a closed panel rests until it opens.
 * @returns {Element|null} The host, or null while the source is not connected to the document.
 */
export function connectedOverlayHost(source = null, options = {}) {
  const host = options.dialog === false ? overlayScope : overlayHost;
  if (source == null) return host(null);
  const context = resolveElement(source);
  return context?.isConnected ? host(context) : null;
}

/**
 * The open dialog an element sits in, or null.
 * @param {Element|null|undefined} element
 * @returns {Element|null}
 */
export function openDialogOf(element) {
  if (!element || typeof element.closest !== 'function') return null;
  try {
    return element.closest(DIALOG_SELECTOR);
  } catch {
    // A browser without `:modal` or `:popover-open` still knows an open dialog by its attribute.
    return element.closest('dialog[open]');
  }
}

/** @param {Element|string|null} source @returns {Element|null} */
function contextOf(source) {
  return source == null
    ? (document.activeElement instanceof Element ? document.activeElement : null)
    : resolveElement(source);
}

/** @param {Element|null} context @returns {Element} */
function scopeOf(context) {
  const scope = context?.closest?.(SCOPE_SELECTOR) ?? null;
  if (!scope || scope === document.documentElement || scope === document.body) return document.body;
  return scope;
}
