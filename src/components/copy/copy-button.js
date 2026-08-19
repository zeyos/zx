import { h } from '../../core/dom.js';
import { copyToClipboard } from '../../core/export.js';
import { icon as createIcon } from '../../core/icons.js';

/**
 * @typedef {Object} CopyButtonOptions
 * @property {string|(() => string)} [text=''] Text to copy, or a function returning it — a
 *   function is what a button beside a live value wants, so the copy is never stale.
 * @property {string} [label=''] Visible label. Empty renders an icon-only ghost button.
 * @property {string} [title='Copy'] Accessible name, and the native tooltip on the icon-only form.
 * @property {string} [feedback='Copied'] Confirmation announced and shown after a copy.
 * @property {number} [feedbackDuration=2000] Milliseconds the confirmation stays.
 * @property {'md'|'sm'} [size='md'] Control size.
 * @property {'default'|'primary'|'ghost'} [kind='ghost'] Visual intent.
 * @property {(text: string, copied: boolean) => void} [oncopy] Called with the text and whether
 *   the clipboard accepted it.
 */

/** @type {Readonly<CopyButtonOptions>} */
const buttonDefaults = Object.freeze({
  text: '',
  label: '',
  title: 'Copy',
  feedback: 'Copied',
  feedbackDuration: 2000,
  size: 'md',
  kind: 'ghost'
});

/**
 * Creates a button that copies a string and confirms it in place.
 *
 * The confirmation is the point: a clipboard write is silent, so without it nobody knows whether
 * the click worked. It swaps the glyph for a tick and speaks through a live region, then reverts.
 * A failed write — no permission, an insecure context — leaves the button untouched and reports
 * `false` to `oncopy`, rather than claiming a copy that did not happen.
 *
 * @param {CopyButtonOptions} [opts={}] Copy-button options.
 * @returns {HTMLButtonElement}
 */
export function copyButton(opts = {}) {
  const options = { ...buttonDefaults, ...opts };
  const iconOnly = !options.label;
  const element = /** @type {HTMLButtonElement} */ (h('button', {
    class: ['zx-copy-button', iconOnly ? 'zx-icon-btn' : 'zx-btn'],
    type: 'button',
    dataset: { size: options.size === 'sm' ? 'sm' : 'md', kind: iconOnly ? null : options.kind },
    title: iconOnly ? String(options.title) : null,
    ariaLabel: iconOnly ? String(options.title) : null
  }));

  const glyph = h('span', { class: 'zx-copy-button__icon', ariaHidden: 'true' },
    createIcon('copy', { size: options.size === 'sm' ? 12 : 14 }));
  const status = h('span', { class: 'zx-copy-button__status', role: 'status' });
  element.append(glyph);
  if (!iconOnly) element.append(h('span', { class: 'zx-copy-button__label' }, String(options.label)));
  element.append(status);

  let timer = 0;
  element.addEventListener('click', async () => {
    const text = typeof options.text === 'function' ? String(options.text()) : String(options.text ?? '');
    const copied = await copyToClipboard(text);
    options.oncopy?.(text, copied);
    if (!copied) return;

    clearTimeout(timer);
    element.dataset.copied = 'true';
    glyph.replaceChildren(createIcon('check', { size: options.size === 'sm' ? 12 : 14 }));
    status.textContent = String(options.feedback);
    timer = setTimeout(() => {
      if (!element.isConnected) return;
      delete element.dataset.copied;
      glyph.replaceChildren(createIcon('copy', { size: options.size === 'sm' ? 12 : 14 }));
      status.textContent = '';
    }, Math.max(0, Number(options.feedbackDuration) || 0));
  });
  return element;
}
