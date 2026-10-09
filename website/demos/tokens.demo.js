import { moduleKeys } from '../../src/zeyos/modules.js';

const semanticColors = [
  'bg-page', 'bg-surface', 'bg-raised', 'bg-control', 'bg-muted', 'bg-hover', 'bg-selected',
  'bg-backdrop', 'border', 'border-strong', 'border-control', 'text', 'text-muted',
  'text-placeholder', 'text-invert', 'accent', 'accent-hover', 'accent-active', 'accent-subtle',
  'on-accent', 'ring', 'danger', 'danger-bg', 'warning', 'warning-bg', 'success', 'success-bg',
  'info', 'info-bg'
].map((name) => '--zx-color-' + name);

// Spacing steps are multiples of one unit and radius steps are fractions of one base, so each
// list starts with the value a theme actually sets.
const spacingTokens = ['--zx-space-unit',
  ...Array.from({ length: 8 }, (_, index) => '--zx-space-' + (index + 1))];
const radiusTokens = [
  '--zx-radius', '--zx-radius-sm', '--zx-radius-md', '--zx-radius-lg', '--zx-radius-xl',
  '--zx-radius-full'
];
const typeTokens = [
  '--zx-text-xs', '--zx-text-sm', '--zx-text-md', '--zx-text-lg', '--zx-text-xl', '--zx-text-2xl'
];
// Every ZeyOS module, from the configuration the tokens themselves are generated from. Entity and
// legacy names (`--zx-module-invoices`, `--zx-module-settings`) resolve too; see the Icons entry.
const moduleNames = moduleKeys();

export default {
  title: 'Design tokens',
  group: 'Core',
  demoTitle: 'Token specimens',

  /**
   * Mounts the design-token showcase.
   * @param {HTMLElement} container
   * @returns {void}
   */
  mount(container) {
    container.append(
      colorSection('Semantic colors', semanticColors),
      specimenSection('Spacing', spacingTokens, createSpaceSpecimen, 'width'),
      specimenSection('Radii', radiusTokens, createRadiusSpecimen, 'border-top-left-radius'),
      specimenSection('Type scale', typeTokens, createTypeSpecimen, 'font-size'),
      colorSection('Module colors', moduleNames.map((name) => '--zx-module-' + name)),
      nativeSection()
    );
  }
};

/**
 * Builds a section of resolved color swatches.
 * @param {string} title
 * @param {string[]} tokens
 * @returns {HTMLElement}
 */
function colorSection(title, tokens) {
  const section = createSection(title);
  const grid = element('div', 'token-grid');
  for (const token of tokens) grid.append(colorCard(token));
  section.append(grid);
  return section;
}

/**
 * Builds one resolved color card.
 * @param {string} token
 * @returns {HTMLElement}
 */
function colorCard(token) {
  const card = element('article', 'token-card');
  const swatch = element('div', 'token-card__swatch');
  const meta = element('div', 'token-card__meta');
  swatch.style.background = 'var(' + token + ')';
  meta.append(
    element('span', 'token-card__name', token),
    element('span', 'token-card__value', resolved(token))
  );
  card.append(swatch, meta);
  return card;
}

/**
 * Builds a token specimen section.
 * @param {string} title
 * @param {string[]} tokens
 * @param {(token: string) => HTMLElement} factory
 * @param {string} property CSS property the token is measured through, so a derived step reads
 *   as the pixels it resolves to rather than as the `calc()` that derives it.
 * @returns {HTMLElement}
 */
function specimenSection(title, tokens, factory, property) {
  const section = createSection(title);
  const specimens = element('div', 'token-specimens');
  for (const token of tokens) {
    const row = element('div', 'token-specimen');
    row.append(
      element('span', 'token-specimen__label', token + ': ' + measured(token, property)),
      factory(token)
    );
    specimens.append(row);
  }
  section.append(specimens);
  return section;
}

/** @param {string} token @returns {HTMLElement} */
function createSpaceSpecimen(token) {
  const specimen = element('span', 'token-specimen__space');
  specimen.style.inlineSize = 'var(' + token + ')';
  return specimen;
}

/** @param {string} token @returns {HTMLElement} */
function createRadiusSpecimen(token) {
  const specimen = element('span', 'token-specimen__radius');
  specimen.style.borderRadius = 'var(' + token + ')';
  return specimen;
}

/** @param {string} token @returns {HTMLElement} */
function createTypeSpecimen(token) {
  const specimen = element('span', '', 'ZeyOS Aa 0123');
  specimen.style.fontSize = 'var(' + token + ')';
  return specimen;
}

/** @returns {HTMLElement} */
function nativeSection() {
  const section = createSection('Native controls');
  const row = element('div', 'token-native-row');
  const button = element('button', '', 'Button');
  const input = document.createElement('input');
  const select = document.createElement('select');
  button.type = 'button';
  input.placeholder = 'Text input';
  input.setAttribute('aria-label', 'Text input specimen');
  for (const value of ['Select option', 'Another option']) {
    const option = document.createElement('option');
    option.textContent = value;
    select.append(option);
  }
  select.setAttribute('aria-label', 'Select specimen');
  row.append(button, input, select);
  section.append(row);
  return section;
}

/** @param {string} title @returns {HTMLElement} */
function createSection(title) {
  const section = element('section', 'token-section');
  section.append(element('h2', 'token-section__title', title));
  return section;
}

/**
 * Creates an element with optional class and text.
 * @param {string} tag
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** @param {string} token @returns {string} */
function resolved(token) {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

/**
 * Resolves a length token to pixels by applying it to a detached-from-layout probe.
 * @param {string} token
 * @param {string} property
 * @returns {string}
 */
function measured(token, property) {
  const probe = element('span');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.setProperty(property, 'var(' + token + ')');
  document.body.append(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
}
