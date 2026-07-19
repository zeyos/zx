const demos = [
  () => import('./components/tokens.demo.js'),
  () => import('./components/kernel.demo.js'),
  () => import('./components/button.demo.js'),
  () => import('./components/check-button.demo.js'),
  () => import('./components/toggle.demo.js'),
  () => import('./components/search.demo.js'),
  () => import('./components/groupbox.demo.js'),
  () => import('./components/message.demo.js')
];

const STORAGE_KEYS = {
  theme: 'zx-demo-theme',
  density: 'zx-demo-density'
};
const SETTINGS = {
  theme: ['light', 'dark', 'auto'],
  density: ['cozy', 'compact']
};

const modules = await Promise.all(demos.map((load) => load()));
const registeredDemos = modules.map((module) => module.default);
const root = document.querySelector('#demo-app');
const shell = createElement('div', 'demo-shell');
const sidebar = createElement('aside', 'demo-sidebar');
const brand = createElement('div', 'demo-brand', 'Zx');
const navigation = createElement('nav', 'demo-navigation');
const main = createElement('main', 'demo-main');
const heading = createElement('h1', 'demo-title');
const stage = createElement('div', 'demo-stage');
const toolbar = createElement('div', 'demo-toolbar');
let activeDemo = 0;

sidebar.append(brand, navigation);
main.append(heading, stage);
shell.append(sidebar, main);
root.append(shell, toolbar);

const theme = createSwitcher('Theme', 'theme');
const density = createSwitcher('Density', 'density');
toolbar.append(theme.wrapper, density.wrapper);

applySetting('theme', readSetting('theme'));
applySetting('density', readSetting('density'));
renderNavigation();
showDemo(0);

/**
 * Creates an HTML element with optional class and text.
 * @param {string} tag
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/**
 * Reads a persisted setting, falling back to its first valid option.
 * @param {'theme'|'density'} name
 * @returns {string}
 */
function readSetting(name) {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS[name]);
    if (SETTINGS[name].includes(saved)) return saved;
  } catch {
    // Storage can be unavailable in privacy-restricted contexts.
  }
  return SETTINGS[name][0];
}

/**
 * Applies and persists a harness setting.
 * @param {'theme'|'density'} name
 * @param {string} value
 * @returns {void}
 */
function applySetting(name, value) {
  const dataKey = name === 'theme' ? 'zxTheme' : 'zxDensity';
  document.documentElement.dataset[dataKey] = value;
  try {
    localStorage.setItem(STORAGE_KEYS[name], value);
  } catch {
    // The setting still applies for the current page.
  }
}

/**
 * Creates a labelled select for a harness setting.
 * @param {string} labelText
 * @param {'theme'|'density'} name
 * @returns {{wrapper: HTMLLabelElement, select: HTMLSelectElement}}
 */
function createSwitcher(labelText, name) {
  const wrapper = createElement('label', 'demo-switcher');
  const label = createElement('span', 'demo-switcher__label', labelText);
  const select = createElement('select', 'demo-switcher__select');
  select.setAttribute('aria-label', labelText);

  for (const value of SETTINGS[name]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = capitalize(value);
    select.append(option);
  }

  select.value = readSetting(name);
  select.addEventListener('change', () => {
    applySetting(name, select.value);
    showDemo(activeDemo);
  });
  wrapper.append(label, select);
  return { wrapper, select };
}

/** Renders demo links grouped by their declared group. */
function renderNavigation() {
  const groups = new Map();
  registeredDemos.forEach((demo, index) => {
    const entries = groups.get(demo.group) || [];
    entries.push({ demo, index });
    groups.set(demo.group, entries);
  });

  for (const [group, entries] of groups) {
    const section = createElement('section', 'demo-navigation__group');
    const title = createElement('h2', 'demo-navigation__title', group);
    section.append(title);

    for (const { demo, index } of entries) {
      const button = createElement('button', 'demo-navigation__item', demo.title);
      button.type = 'button';
      button.dataset.demoIndex = String(index);
      button.addEventListener('click', () => showDemo(index));
      section.append(button);
    }
    navigation.append(section);
  }
}

/**
 * Mounts one registered demo and updates navigation state.
 * @param {number} index
 * @returns {void}
 */
function showDemo(index) {
  const demo = registeredDemos[index];
  if (!demo) return;
  activeDemo = index;
  heading.textContent = demo.title;
  stage.replaceChildren();
  demo.mount(stage);

  for (const button of navigation.querySelectorAll('[data-demo-index]')) {
    const selected = Number(button.dataset.demoIndex) === index;
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
}

/**
 * Capitalizes a setting label.
 * @param {string} value
 * @returns {string}
 */
function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
