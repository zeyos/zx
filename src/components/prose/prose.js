import { h } from '../../core/dom.js';
import { copyToClipboard } from '../../core/export.js';
import { translate } from '../../core/i18n.js';
import { icon } from '../../core/icons.js';

/**
 * @typedef {Object} ProseAnchorsOptions
 * @property {string} [selector='h2[id], h3[id], h4[id]'] The headings that get a link, inside a
 *   `.zx-prose` under the root. A heading without an `id` has nothing to link to and is skipped.
 * @property {string} [label] The link's accessible name; `%1` is the heading. By default the
 *   `prose.copyLinkTo` message ("Copy link to %1").
 * @property {string} [title] The link's tooltip, by default the `prose.copyLink` message ("Copy link").
 * @property {string} [feedback] What the live region says after a copy, by default the `prose.copied`
 *   message ("Link copied").
 * @property {number} [feedbackDuration=2000] Milliseconds the tick and the message stay.
 * @property {(id: string) => string} [href] The address copied for a heading id. Defaults to the
 *   current address with its hash replaced (`sectionHref(location.href, id)`).
 * @property {(url: string, copied: boolean) => void} [oncopy] Called with the address and whether
 *   the clipboard took it.
 */

/**
 * @typedef {Object} ProseAnchors
 * @property {() => void} refresh Links headings added since, re-attaches the live region if the
 *   content was replaced, and updates the address of every link. Call it after re-rendering.
 * @property {() => void} destroy Removes every link, the live region, and the listener.
 */

/** @type {Readonly<Required<Omit<ProseAnchorsOptions, 'href'|'oncopy'|'label'|'title'|'feedback'>>>} */
const defaults = Object.freeze({
  selector: 'h2[id], h3[id], h4[id]',
  feedbackDuration: 2000
});

/**
 * The address of a section: `base` with its hash replaced by the heading's id. The query is kept,
 * and the id is encoded as a fragment.
 * @param {string} base Absolute address, usually `location.href`.
 * @param {string} id Heading id.
 * @returns {string}
 */
export function sectionHref(base, id) {
  const url = new URL(String(base));
  url.hash = String(id);
  return url.href;
}

/**
 * Gives every section heading of authored content a link to itself. Each `h2`–`h4` with an `id`
 * inside a `.zx-prose` under `root` ends in a small link (`<a class="zx-prose__anchor" href="#id">`)
 * that rests out of sight and shows while the heading is pointed at or the link has focus. A plain
 * click copies the section's address and confirms in place, without moving the page or touching
 * the location, so an application's own routing is left alone; a middle or modified click is left
 * to the browser, which opens the address.
 *
 * The heading becomes the reveal host (`data-zx-reveal-host`), so the link is always visible on a
 * touch screen and under a contrast preference, and it stays in the Tab order.
 *
 * @param {Element|string} root The content, or an element holding it; a selector is resolved in
 *   the document.
 * @param {ProseAnchorsOptions} [options={}] Anchor options.
 * @returns {ProseAnchors}
 */
export function proseAnchors(root, options = {}) {
  const target = typeof root === 'string' ? document.querySelector(root) : root;
  if (!(target instanceof Element)) throw new TypeError('proseAnchors root could not be resolved');
  const settings = {
    label: translate('prose.copyLinkTo'), title: translate('prose.copyLink'), feedback: translate('prose.copied'),
    ...defaults, ...options
  };
  const abort = new AbortController();
  /** @type {Map<HTMLAnchorElement, HTMLElement>} Link → its heading. */
  const anchors = new Map();
  /** @type {Set<HTMLElement>} Headings this call made reveal hosts. */
  const hosts = new Set();
  const status = h('span', { class: 'zx-prose__status', role: 'status' });
  let timer = 0;

  const hrefFor = (/** @type {string} */ id) => (typeof settings.href === 'function'
    ? String(settings.href(id))
    : sectionHref(globalThis.location?.href ?? 'about:blank', id));

  const refresh = () => {
    if (abort.signal.aborted) return;
    for (const [anchor, heading] of anchors) {
      if (anchor.isConnected && heading.contains(anchor) && heading.id) {
        anchor.setAttribute('href', `#${heading.id}`);
        continue;
      }
      anchor.remove();
      anchors.delete(anchor);
    }
    const headings = /** @type {HTMLElement[]} */ ([...target.querySelectorAll(String(settings.selector))]);
    for (const heading of headings) {
      if (!heading.id || !heading.closest('.zx-prose')) continue;
      if ([...anchors.values()].includes(heading)) continue;
      const text = (heading.textContent ?? '').trim();
      const anchor = /** @type {HTMLAnchorElement} */ (h('a', {
        class: 'zx-prose__anchor',
        href: `#${heading.id}`,
        ariaLabel: String(settings.label).replace('%1', text),
        title: String(settings.title),
        'data-zx-reveal': ''
      }, icon('link-2')));
      if (!heading.hasAttribute('data-zx-reveal-host')) {
        heading.setAttribute('data-zx-reveal-host', '');
        hosts.add(heading);
      }
      heading.append(anchor);
      anchors.set(anchor, heading);
    }
    // The live region sits beside the content, never inside a heading, whose name it would join.
    if (!status.isConnected) target.append(status);
  };

  target.addEventListener('click', async (event) => {
    const anchor = /** @type {Element} */ (event.target)?.closest?.('.zx-prose__anchor');
    if (!(anchor instanceof HTMLAnchorElement) || !anchors.has(anchor)) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const heading = anchors.get(anchor);
    const url = hrefFor(heading?.id ?? '');
    const copied = await copyToClipboard(url);
    if (abort.signal.aborted) return;
    settings.oncopy?.(url, copied);
    if (!copied) return;
    clearTimeout(timer);
    for (const other of anchors.keys()) delete other.dataset.copied;
    anchor.dataset.copied = 'true';
    anchor.replaceChildren(icon('check'));
    if (!status.isConnected) target.append(status);
    status.textContent = String(settings.feedback);
    timer = setTimeout(() => {
      delete anchor.dataset.copied;
      anchor.replaceChildren(icon('link-2'));
      status.textContent = '';
    }, Math.max(0, Number(settings.feedbackDuration) || 0));
  }, { signal: abort.signal });

  refresh();

  return {
    refresh,
    destroy() {
      if (abort.signal.aborted) return;
      abort.abort();
      clearTimeout(timer);
      for (const anchor of anchors.keys()) anchor.remove();
      anchors.clear();
      for (const heading of hosts) heading.removeAttribute('data-zx-reveal-host');
      hosts.clear();
      status.remove();
    }
  };
}
