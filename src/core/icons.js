const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @typedef {Object} IconOptions
 * @property {number|string} [size=16] Rendered width and height.
 * @property {string|null} [label=null] Accessible label; null marks the icon decorative.
 */

/**
 * Immutable map of kernel icon names to 16×16 SVG stroke path data.
 * @type {Readonly<Record<string, string>>}
 */
export const icons = Object.freeze({
  'chevron-down': 'M3 6l5 5 5-5',
  'chevron-up': 'M3 10l5-5 5 5',
  'chevron-left': 'M10 3L5 8l5 5',
  'chevron-right': 'M6 3l5 5-5 5',
  check: 'M2.5 8.5l3.5 3.5 7.5-8',
  x: 'M3 3l10 10M13 3L3 13',
  plus: 'M8 2.5v11M2.5 8h11',
  minus: 'M2.5 8h11',
  search: 'M11.5 11.5L14 14M7 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z',
  calendar: 'M3 3.5h10v10H3zM5 1.5v4M11 1.5v4M3 6.5h10',
  clock: 'M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8 4.5V8l2.5 1.5',
  trash: 'M3 4.5h10M6 4.5v-2h4v2M4.5 4.5l.7 9h5.6l.7-9M6.5 7v4M9.5 7v4',
  gear: 'M8 10.5A2.5 2.5 0 1 0 8 5a2.5 2.5 0 0 0 0 5.5zM6.5 1.8h3l.4 1.5 1.3.7 1.5-.5 1.5 2.6-1.1 1 .1 1.5 1.1 1-1.5 2.6-1.5-.5-1.3.7-.4 1.5h-3l-.4-1.5-1.3-.7-1.5.5-1.5-2.6 1.1-1-.1-1.5-1.1-1 1.5-2.6 1.5.5 1.3-.7z',
  eye: 'M1.5 8s2.5-4 6.5-4 6.5 4 6.5 4-2.5 4-6.5 4-6.5-4-6.5-4zM8 10.5A2.5 2.5 0 1 0 8 5a2.5 2.5 0 0 0 0 0 5.5z',
  lock: 'M4 7h8v7H4zM5.5 7V4.5a2.5 2.5 0 0 1 5 0V7M8 9.5v2',
  reload: 'M13 5V2l-1.4 1.4A6 6 0 1 0 14 8M13 2H9.5',
  list: 'M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.1M2.5 8h.1M2.5 12h.1',
  filter: 'M2 3h12L9.5 8v4L6.5 14V8z',
  dots: 'M3 8h.1M8 8h.1M13 8h.1',
  info: 'M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8 7v4M8 4.5h.1',
  warning: 'M8 2l6 11H2zM8 6v3.5M8 11.5h.1',
  error: 'M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM5.5 5.5l5 5M10.5 5.5l-5 5',
  success: 'M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM4.5 8l2.2 2.2 4.8-5',
  upload: 'M8 11V2M4.5 5.5L8 2l3.5 3.5M3 10v3h10v-3',
  drag: 'M5.5 3h.1M10.5 3h.1M5.5 8h.1M10.5 8h.1M5.5 13h.1M10.5 13h.1'
});

/**
 * Creates an inline SVG icon.
 * @param {string} name Icon name from `icons`.
 * @param {IconOptions} [options={}] Display and accessibility options.
 * @returns {SVGSVGElement}
 */
/** Legacy gx Factory icon names mapped to their Zx equivalents. */
const aliases = Object.freeze({
  settings: 'gear',
  clear: 'x',
  checked: 'check',
  question: 'info',
  range: 'filter',
  fields: 'list'
});

export function icon(name, { size = 16, label = null } = {}) {
  const pathData = icons[name] ?? icons[aliases[name]];
  if (!pathData) throw new RangeError(`Unknown icon: ${name}`);
  const svg = document.createElementNS(SVG_NS, 'svg');
  const path = document.createElementNS(SVG_NS, 'path');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('focusable', 'false');
  if (label === null) {
    svg.setAttribute('aria-hidden', 'true');
  } else {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  }
  path.setAttribute('d', pathData);
  svg.append(path);
  return svg;
}
