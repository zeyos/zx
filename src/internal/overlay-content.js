/**
 * Content an overlay accepts: text, a node, or anything exposing `toElement()`. Strings are never
 * parsed as HTML.
 * @typedef {Node|string|number|{toElement: () => Node|null}|null|undefined} OverlayContent
 */

/**
 * Replaces a container's children with overlay content.
 * @param {Element} target Container to fill.
 * @param {OverlayContent} content Content to display; null or undefined leaves it empty.
 * @returns {void}
 */
export function replaceContent(target, content) {
  target.replaceChildren();
  appendContent(target, content);
}

/**
 * Appends overlay content to a container: a string or number as a text node, the result of
 * `toElement()`, or the node itself. Anything else is ignored.
 * @param {Element} target Container to append to.
 * @param {OverlayContent} content Content to append.
 * @returns {void}
 */
export function appendContent(target, content) {
  if (content == null) return;
  if (typeof content === 'string' || typeof content === 'number') {
    target.append(document.createTextNode(String(content)));
  } else if (typeof content.toElement === 'function') {
    const element = content.toElement();
    if (element) target.append(element);
  } else if (typeof content.nodeType === 'number') {
    target.append(content);
  }
}
