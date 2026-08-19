/**
 * The icon layer. Two renderers sit behind one `icon()` call:
 *
 * - **built-in** (default) — the inline SVG glyphs below, no network, no stylesheet, no font.
 * - **Font Awesome** — `<i>` elements carrying Font Awesome classes, after an application opts in
 *   with `useFontAwesome()` or `loadFontAwesome(kit)`. Zx never loads a kit by itself.
 *
 * Both renderers put `zx-icon` on the element, so component CSS can style either.
 * @module zx/core/icons
 */

import { faIconClasses, kitUrl, loadFontAwesomeKit, parseIconSpec } from './fontawesome.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @typedef {Object} IconOptions
 * @property {number|string} [size=16] Rendered width and height.
 * @property {string|null} [label=null] Accessible label; null marks the icon decorative.
 * @property {string|string[]} [class] Extra class names added to the element.
 * @property {string} [style] Font Awesome style for this icon only (`'solid'`, `'duotone'`, …).
 * @property {string} [family] Font Awesome family for this icon only (`'classic'`, `'sharp'`, …).
 * @property {boolean} [fixedWidth] Adds Font Awesome's `fa-fw` for column-aligned glyphs.
 */

/**
 * Icon glyphs from Font Awesome Free 6 (solid, plus `square` from regular), fontawesome.com,
 * licensed CC BY 4.0 (https://fontawesome.com/license/free). Path data is embedded unmodified so
 * the library carries no webfont, stylesheet, or package dependency. Each entry is
 * `[viewBox, path]`; Font Awesome glyphs are filled (not stroked) and use per-glyph 512-unit view
 * boxes — outlines such as `square` are a filled path with a counter-wound hole.
 * Extend the set with `registerIcons()`; read every available name with `iconNames()`.
 * @type {Readonly<Record<string, [string, string]>>}
 */
export const icons = Object.freeze({
  'chevron-down': ['0 0 512 512', 'M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z'],
  'chevron-up': ['0 0 512 512', 'M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 173.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192z'],
  'chevron-left': ['0 0 320 512', 'M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 256 246.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z'],
  'chevron-right': ['0 0 320 512', 'M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L210.7 256 73.4 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z'],
  check: ['0 0 448 512', 'M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z'],
  x: ['0 0 384 512', 'M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z'],
  plus: ['0 0 448 512', 'M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z'],
  minus: ['0 0 448 512', 'M432 256c0 17.7-14.3 32-32 32L48 288c-17.7 0-32-14.3-32-32s14.3-32 32-32l352 0c17.7 0 32 14.3 32 32z'],
  search: ['0 0 512 512', 'M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z'],
  calendar: ['0 0 448 512', 'M128 0c17.7 0 32 14.3 32 32V64H288V32c0-17.7 14.3-32 32-32s32 14.3 32 32V64h48c26.5 0 48 21.5 48 48v48H0V112C0 85.5 21.5 64 48 64H96V32c0-17.7 14.3-32 32-32zM0 192H448V464c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V192z'],
  clock: ['0 0 512 512', 'M256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM232 120V256c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z'],
  trash: ['0 0 448 512', 'M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z'],
  gear: ['0 0 512 512', 'M481.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z'],
  eye: ['0 0 576 512', 'M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1-288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z'],
  lock: ['0 0 448 512', 'M144 144v48H304V144c0-44.2-35.8-80-80-80s-80 35.8-80 80zM80 192V144C80 64.5 144.5 0 224 0s144 64.5 144 144v48h16c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V256c0-35.3 28.7-64 64-64H80z'],
  reload: ['0 0 512 512', 'M386.3 160H336c-17.7 0-32 14.3-32 32s14.3 32 32 32H464c17.7 0 32-14.3 32-32V64c0-17.7-14.3-32-32-32s-32 14.3-32 32v51.2L414.4 97.6c-87.5-87.5-229.3-87.5-316.8 0s-87.5 229.3 0 316.8s229.3 87.5 316.8 0c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0c-62.5 62.5-163.8 62.5-226.3 0s-62.5-163.8 0-226.3s163.8-62.5 226.3 0L386.3 160z'],
  list: ['0 0 512 512', 'M40 48C26.7 48 16 58.7 16 72v48c0 13.3 10.7 24 24 24H88c13.3 0 24-10.7 24-24V72c0-13.3-10.7-24-24-24H40zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zM16 232v48c0 13.3 10.7 24 24 24H88c13.3 0 24-10.7 24-24V232c0-13.3-10.7-24-24-24H40c-13.3 0-24 10.7-24 24zM40 368c-13.3 0-24 10.7-24 24v48c0 13.3 10.7 24 24 24H88c13.3 0 24-10.7 24-24V392c0-13.3-10.7-24-24-24H40z'],
  filter: ['0 0 512 512', 'M3.9 54.9C10.5 40.9 24.5 32 40 32H472c15.5 0 29.5 8.9 36.1 22.9s4.6 30.5-5.2 42.5L320 320.9V448c0 12.1-6.8 23.2-17.7 28.6s-23.8 4.3-33.5-3l-64-48c-8.1-6-12.8-15.5-12.8-25.6V320.9L9 97.3C-.7 85.4-2.8 68.8 3.9 54.9z'],
  dots: ['0 0 448 512', 'M8 256a56 56 0 1 1 112 0A56 56 0 1 1 8 256zm160 0a56 56 0 1 1 112 0 56 56 0 1 1-112 0zm216-56a56 56 0 1 1 0 112 56 56 0 1 1 0-112z'],
  info: ['0 0 512 512', 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z'],
  warning: ['0 0 512 512', 'M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0-64 0 32 32 0 1 0 64 0z'],
  error: ['0 0 512 512', 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1-64 0z'],
  success: ['0 0 512 512', 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z'],
  upload: ['0 0 512 512', 'M288 109.3V352c0 17.7-14.3 32-32 32s-32-14.3-32-32V109.3l-73.4 73.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l128-128c12.5-12.5 32.8-12.5 45.3 0l128 128c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 109.3zM64 352H192c0 35.3 28.7 64 64 64s64-28.7 64-64H448c35.3 0 64 28.7 64 64v32c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V416c0-35.3 28.7-64 64-64z'],
  drag: ['0 0 320 512', 'M40 352l48 0c22.1 0 40 17.9 40 40l0 48c0 22.1-17.9 40-40 40l-48 0c-22.1 0-40-17.9-40-40l0-48c0-22.1 17.9-40 40-40zm192 0l48 0c22.1 0 40 17.9 40 40l0 48c0 22.1-17.9 40-40 40l-48 0c-22.1 0-40-17.9-40-40l0-48c0-22.1 17.9-40 40-40zM40 176l48 0c22.1 0 40 17.9 40 40l0 48c0 22.1-17.9 40-40 40l-48 0c-22.1 0-40-17.9-40-40l0-48c0-22.1 17.9-40 40-40zm192 0l48 0c22.1 0 40 17.9 40 40l0 48c0 22.1-17.9 40-40 40l-48 0c-22.1 0-40-17.9-40-40l0-48c0-22.1 17.9-40 40-40zM40 0L88 0c22.1 0 40 17.9 40 40l0 48c0 22.1-17.9 40-40 40L40 128C17.9 128 0 110.1 0 88L0 40C0 17.9 17.9 0 40 0zM232 0l48 0c22.1 0 40 17.9 40 40l0 48c0 22.1-17.9 40-40 40l-48 0c-22.1 0-40-17.9-40-40l0-48c0-22.1 17.9-40 40-40z'],
  star: ['0 0 576 512', 'M287.9 0c9.2 0 17.6 5.2 21.6 13.5l68.6 141.3 153.2 22.6c9 1.3 16.5 7.6 19.3 16.3s.5 18.1-5.9 24.5L433.6 328.4l26.2 155.6c1.5 9-2.2 18.1-9.7 23.5s-17.3 6-25.3 1.7l-137-73.2L151 509.1c-8.1 4.3-17.9 3.7-25.3-1.7s-11.2-14.5-9.7-23.5l26.2-155.6L31.1 218.2c-6.5-6.4-8.7-15.9-5.9-24.5s10.3-14.9 19.3-16.3l153.2-22.6L266.3 13.5C270.4 5.2 278.7 0 287.9 0z'],
  heart: ['0 0 512 512', 'M47.6 300.4L228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z'],
  tag: ['0 0 448 512', 'M0 80V229.5c0 17 6.7 33.3 18.7 45.3l176 176c25 25 65.5 25 90.5 0L418.7 317.3c25-25 25-65.5 0-90.5l-176-176c-12-12-28.3-18.7-45.3-18.7H48C21.5 32 0 53.5 0 80zm112 32a32 32 0 1 1 0 64 32 32 0 1 1 0-64z'],
  folder: ['0 0 512 512', 'M64 480H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H298.5c-17 0-33.3-6.7-45.3-18.7L226.7 50.7c-12-12-28.3-18.7-45.3-18.7H64C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64z'],
  'folder-open': ['0 0 576 512', 'M88.7 223.8L0 375.8V96C0 60.7 28.7 32 64 32H181.5c17 0 33.3 6.7 45.3 18.7l26.5 26.5c12 12 28.3 18.7 45.3 18.7H416c35.3 0 64 28.7 64 64v32H144c-22.8 0-43.8 12.1-55.3 31.8zm27.6 16.1C122.1 230 132.6 224 144 224H544c11.5 0 22 6.1 27.7 16.1s5.7 22.2-.1 32.1l-112 192C453.9 474 443.4 480 432 480H32c-11.5 0-22-6.1-27.7-16.1s-5.7-22.2 .1-32.1l112-192z'],
  file: ['0 0 384 512', 'M0 64C0 28.7 28.7 0 64 0H224V128c0 17.7 14.3 32 32 32H384V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V64zm384 64H256V0L384 128z'],
  copy: ['0 0 448 512', 'M208 0L332.1 0c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9L448 336c0 26.5-21.5 48-48 48l-192 0c-26.5 0-48-21.5-48-48l0-288c0-26.5 21.5-48 48-48zM48 128l80 0 0 64-64 0 0 256 192 0 0-32 64 0 0 48c0 26.5-21.5 48-48 48L48 512c-26.5 0-48-21.5-48-48L0 176c0-26.5 21.5-48 48-48z'],
  square: ['0 0 448 512', 'M384 80c8.8 0 16 7.2 16 16V416c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V96c0-8.8 7.2-16 16-16H384zM64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64z'],
  code: ['0 0 640 512', 'M392.8 1.2c-17-4.9-34.7 5-39.6 22l-128 448c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l128-448c4.9-17-5-34.7-22-39.6zm80.6 120.1c-12.5 12.5-12.5 32.8 0 45.3L562.7 256l-89.4 89.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l112-112c12.5-12.5 12.5-32.8 0-45.3l-112-112c-12.5-12.5-32.8-12.5-45.3 0zm-306.7 0c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3l112 112c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256l89.4-89.4c12.5-12.5 12.5-32.8 0-45.3z'],
  book: ['0 0 448 512', 'M96 0C43 0 0 43 0 96V416c0 53 43 96 96 96H384h32c17.7 0 32-14.3 32-32s-14.3-32-32-32V384c17.7 0 32-14.3 32-32V32c0-17.7-14.3-32-32-32H384 96zm0 384H352v64H96c-17.7 0-32-14.3-32-32s14.3-32 32-32zm32-240c0-8.8 7.2-16 16-16H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16zm16 48H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16s7.2-16 16-16z']
});

/** Legacy gx Factory icon names mapped to their Zx equivalents. */
const aliases = Object.freeze({
  settings: 'gear',
  clear: 'x',
  checked: 'check',
  question: 'info',
  range: 'filter',
  fields: 'list'
});

/** @type {Record<string, [string, string]>} Glyphs added at runtime by `registerIcons`. */
const extraGlyphs = Object.create(null);

/**
 * @typedef {Object} IconConfig
 * @property {'builtin'|'fontawesome'} provider Renderer used for bare icon names.
 * @property {string} style Default Font Awesome style (`'solid'`, `'regular'`, `'duotone'`, …).
 * @property {string} family Default Font Awesome family (`'classic'`, `'sharp'`, …).
 * @property {boolean} fixedWidth Whether Font Awesome icons get `fa-fw` by default.
 * @property {string|null} kit Kit token or URL passed to the last `loadFontAwesome()` call.
 */

/** @type {IconConfig} */
const config = {
  provider: 'builtin',
  style: 'solid',
  family: 'classic',
  fixedWidth: false,
  kit: null
};

/**
 * Reads the active icon configuration.
 * @returns {IconConfig} A copy — mutating it does not change the configuration.
 */
export function getIconConfig() {
  return { ...config };
}

/**
 * Sets how bare icon names are rendered. Explicitly prefixed names (`'fa:user'`,
 * `'builtin:check'`) and literal class lists (`'fa-solid fa-user'`) always ignore this.
 * @param {Partial<IconConfig>} options Values to change.
 * @returns {IconConfig} The configuration after the change.
 */
export function configureIcons(options = {}) {
  for (const key of ['provider', 'style', 'family', 'fixedWidth', 'kit']) {
    if (options[key] !== undefined) config[key] = options[key];
  }
  return getIconConfig();
}

/**
 * Switches bare icon names to Font Awesome. Use this when the kit, or a self-hosted Font Awesome
 * stylesheet, is already on the page; use `loadFontAwesome()` to inject a kit as well.
 * @param {Partial<Omit<IconConfig, 'provider'>>} [options={}] Default style, family, modifiers.
 * @returns {IconConfig} The configuration after the change.
 */
export function useFontAwesome(options = {}) {
  return configureIcons({ ...options, provider: 'fontawesome' });
}

/**
 * Switches bare icon names back to the inline SVG glyphs bundled with Zx.
 * @returns {IconConfig} The configuration after the change.
 */
export function useBuiltinIcons() {
  return configureIcons({ provider: 'builtin' });
}

/**
 * Loads a Font Awesome kit and renders bare icon names with it. The script is injected once per
 * URL; a kit the page already embeds is adopted instead of loaded again.
 * @param {string|(Partial<Omit<IconConfig, 'provider'>> & {kit: string, activate?: boolean})} options
 *   Kit token/URL, or an options object naming one.
 * @returns {Promise<IconConfig>} Resolves with the configuration once the kit has loaded.
 */
export async function loadFontAwesome(options) {
  const settings = typeof options === 'string' ? { kit: options } : { ...options };
  const { kit, activate = true, ...rest } = settings;
  if (!kit) throw new TypeError('loadFontAwesome() needs a kit token or URL');
  configureIcons({ ...rest, kit: kitUrl(kit) });
  await loadFontAwesomeKit(kit);
  return activate ? useFontAwesome() : getIconConfig();
}

/**
 * Adds inline SVG glyphs to the built-in set, or replaces existing ones. Entries use the same
 * `[viewBox, path]` shape as `icons`.
 * @param {Record<string, [string, string]>} glyphs Glyphs keyed by icon name.
 * @returns {void}
 */
export function registerIcons(glyphs) {
  for (const [name, entry] of Object.entries(glyphs)) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new TypeError(`Icon "${name}" must be a [viewBox, path] pair`);
    }
    extraGlyphs[name] = [String(entry[0]), String(entry[1])];
  }
}

/**
 * Lists every inline SVG glyph name available, built-in and registered.
 * @returns {string[]} Sorted icon names.
 */
export function iconNames() {
  return [...new Set([...Object.keys(icons), ...Object.keys(extraGlyphs)])].sort();
}

/**
 * Creates an icon element.
 *
 * Bare names (`'check'`) render through the active provider: the bundled inline SVG set by
 * default, or Font Awesome after `useFontAwesome()` / `loadFontAwesome()`. A name can also select
 * its renderer itself — `'fa:user'`, `'duotone:user'`, `'kit:zeyos-notes'`, `'builtin:check'`, or
 * a literal Font Awesome class list such as `'fa-solid fa-user'`.
 *
 * @param {string} name Icon name or spec.
 * @param {IconOptions} [options={}] Display and accessibility options.
 * @returns {SVGSVGElement|HTMLElement} An `<svg>` for inline glyphs, an `<i>` for Font Awesome.
 */
export function icon(name, options = {}) {
  const spec = parseIconSpec(name);
  if (spec.classes) return faIcon(spec.classes, options);

  const resolved = aliases[spec.name] ?? spec.name;
  if (spec.provider === 'builtin') return builtinIcon(resolved, options);
  if (spec.provider === 'fa') {
    return faIcon(faIconClasses(resolved, {
      style: spec.style ?? options.style ?? config.style,
      family: options.family ?? config.family,
      fixedWidth: options.fixedWidth ?? config.fixedWidth
    }), options);
  }

  if (config.provider === 'fontawesome') {
    return faIcon(faIconClasses(resolved, {
      style: options.style ?? config.style,
      family: options.family ?? config.family,
      fixedWidth: options.fixedWidth ?? config.fixedWidth
    }), options);
  }

  return builtinIcon(resolved, options);
}

/**
 * Renders one of the bundled inline SVG glyphs.
 * @param {string} name Resolved glyph name.
 * @param {IconOptions} options Display and accessibility options.
 * @returns {SVGSVGElement}
 */
function builtinIcon(name, options) {
  const entry = extraGlyphs[name] ?? icons[name];
  if (!entry) throw new RangeError(`Unknown icon: ${name}`);
  const [viewBox, pathData] = entry;
  const { size = 16 } = options;
  const svg = document.createElementNS(SVG_NS, 'svg');
  const path = document.createElementNS(SVG_NS, 'path');
  svg.setAttribute('class', classList('zx-icon', options.class));
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('focusable', 'false');
  applyLabel(svg, options.label ?? null);
  path.setAttribute('d', pathData);
  svg.append(path);
  return svg;
}

/**
 * Renders a Font Awesome icon element. The glyph itself comes from the kit or stylesheet the
 * application loaded; Zx only writes the classes.
 * @param {string[]} classes Font Awesome class names.
 * @param {IconOptions} options Display and accessibility options.
 * @returns {HTMLElement}
 */
function faIcon(classes, options) {
  const { size = 16 } = options;
  const element = document.createElement('i');
  element.className = classList('zx-icon', ...classes, options.class);
  element.style.fontSize = typeof size === 'number' ? `${size}px` : String(size);
  applyLabel(element, options.label ?? null);
  return element;
}

/**
 * Marks an icon decorative, or names it for assistive technology.
 * @param {Element} element Icon element.
 * @param {string|null} label Accessible label; null marks the icon decorative.
 * @returns {void}
 */
function applyLabel(element, label) {
  if (label === null) {
    element.setAttribute('aria-hidden', 'true');
    return;
  }
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', label);
}

/**
 * Joins class names, accepting strings, arrays, and nullish values.
 * @param {...(string|string[]|null|undefined)} values Class name sources.
 * @returns {string}
 */
function classList(...values) {
  return values.flat().filter(Boolean).join(' ');
}
