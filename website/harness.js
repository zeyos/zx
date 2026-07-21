// Component catalog. Each entry knows its demo file basename, which is used both to fetch the
// demo source (Source tab) and to extract its section from docs/llms.md (Docs tab).
const demoFiles = [
  'tokens', 'kernel',
  'button', 'check-button', 'toggle', 'search',
  'groupbox', 'panel', 'tabbox', 'navigation-bar',
  'message', 'modal', 'dialog', 'dropdown', 'menu-button',
  'select', 'checklist', 'permission',
  'date-picker', 'datebox', 'timebox',
  'table', 'data-filter',
  'form', 'form-widgets', 'elements',
  'value-list', 'multi-value-editor', 'field-upload'
];
const demos = demoFiles.map((file) => ({ file, load: () => import(`./demos/${file}.demo.js`) }));

const STORAGE_KEYS = { theme: 'zx-demo-theme', density: 'zx-demo-density' };
const SETTINGS = { theme: ['light', 'dark', 'auto'], density: ['cozy', 'compact'] };
const DOCS_URL = '../docs/llms.md';

const modules = await Promise.all(demos.map((entry) => entry.load()));
const registeredDemos = modules.map((module, index) => ({
  ...module.default,
  file: demos[index].file
}));

const root = document.querySelector('#demo-app');
const shell = createElement('div', 'demo-shell');
const sidebar = createElement('aside', 'demo-sidebar');
const navigation = createElement('nav', 'demo-navigation');
const main = createElement('main', 'demo-main');
const heading = createElement('h1', 'demo-title');
const stage = createElement('div', 'demo-stage');
const toolbar = createElement('div', 'demo-toolbar');
let activeDemo = 0;
let activeTab = 'demo';
let docsText = null;

sidebar.append(navigation);
main.append(heading, stage);
shell.append(sidebar, main);
root.append(shell, toolbar);

// Theme is owned by the shared site chrome (website/site.js); the harness only controls density.
const density = createSwitcher('Density', 'density');
toolbar.append(density.wrapper);

applySetting('density', readSetting('density'));
renderNavigation();
showDemo(0);

/** @param {string} tag @param {string} className @param {string} [text] @returns {HTMLElement} */
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** @param {'theme'|'density'} name @returns {string} */
function readSetting(name) {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS[name]);
    if (SETTINGS[name].includes(saved)) return saved;
  } catch { /* storage unavailable */ }
  return SETTINGS[name][0];
}

/** @param {'theme'|'density'} name @param {string} value @returns {void} */
function applySetting(name, value) {
  const dataKey = name === 'theme' ? 'zxTheme' : 'zxDensity';
  document.documentElement.dataset[dataKey] = value;
  try { localStorage.setItem(STORAGE_KEYS[name], value); } catch { /* current page only */ }
}

/** @param {string} labelText @param {'theme'|'density'} name */
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
    section.append(createElement('h2', 'demo-navigation__title', group));
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
 * Mounts one registered demo as a Demo | Source | Docs tab set.
 * @param {number} index
 * @returns {void}
 */
function showDemo(index) {
  const demo = registeredDemos[index];
  if (!demo) return;
  activeDemo = index;
  heading.textContent = demo.title;

  const tablist = createElement('div', 'demo-tabs');
  tablist.setAttribute('role', 'tablist');
  const panels = createElement('div', 'demo-panels');

  const demoPanel = createElement('div', 'demo-panel demo-preview');
  const sourcePanel = createElement('div', 'demo-panel demo-source');
  const docsPanel = createElement('div', 'demo-panel demo-docs');
  demo.mount(demoPanel);

  const tabs = [
    { id: 'demo', label: 'Demo', panel: demoPanel },
    { id: 'source', label: 'Source', panel: sourcePanel, load: () => loadSource(demo.file, sourcePanel) },
    { id: 'docs', label: 'Docs', panel: docsPanel, load: () => loadDocs(demo.file, docsPanel) }
  ];

  for (const tab of tabs) {
    const button = createElement('button', 'demo-tab', tab.label);
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.dataset.tab = tab.id;
    button.addEventListener('click', () => selectTab(tab.id));
    tablist.append(button);
    tab.panel.setAttribute('role', 'tabpanel');
    panels.append(tab.panel);
  }

  stage.replaceChildren(tablist, panels);
  if (!tabs.some((tab) => tab.id === activeTab)) activeTab = 'demo';
  selectTab(activeTab);

  function selectTab(id) {
    activeTab = id;
    for (const tab of tabs) {
      const selected = tab.id === id;
      tab.panel.hidden = !selected;
      const button = tablist.querySelector(`[data-tab="${tab.id}"]`);
      button.setAttribute('aria-selected', String(selected));
      if (selected && tab.load && !tab.panel.dataset.loaded) {
        tab.panel.dataset.loaded = 'true';
        tab.load();
      }
    }
  }

  for (const button of navigation.querySelectorAll('[data-demo-index]')) {
    const selected = Number(button.dataset.demoIndex) === index;
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
}

/**
 * Fetches and displays a demo module's source.
 * @param {string} file @param {HTMLElement} panel @returns {Promise<void>}
 */
async function loadSource(file, panel) {
  panel.textContent = 'Loading source…';
  try {
    const response = await fetch(`./demos/${file}.demo.js`);
    const text = await response.text();
    const pre = createElement('pre', 'demo-code');
    const code = document.createElement('code');
    code.textContent = text;
    pre.append(code);
    panel.replaceChildren(
      hint(`website/demos/${file}.demo.js`),
      pre
    );
  } catch (error) {
    panel.textContent = 'Could not load source: ' + error.message;
  }
}

/**
 * Extracts and renders the component's section from docs/llms.md.
 * @param {string} file @param {HTMLElement} panel @returns {Promise<void>}
 */
async function loadDocs(file, panel) {
  panel.textContent = 'Loading documentation…';
  try {
    if (docsText === null) docsText = await (await fetch(DOCS_URL)).text();
    const match = new RegExp(`<!--\\s*doc:${file}\\s*-->([\\s\\S]*?)<!--\\s*/doc\\s*-->`).exec(docsText);
    const article = createElement('div', 'demo-doc-body');
    if (match) {
      article.innerHTML = renderMarkdown(match[1]);
    } else {
      article.innerHTML = `<p>No dedicated section yet — see <a href="${DOCS_URL}">docs/llms.md</a>.</p>`;
    }
    panel.replaceChildren(hint('docs/llms.md'), article);
  } catch (error) {
    panel.textContent = 'Could not load documentation: ' + error.message;
  }
}

/** @param {string} text @returns {HTMLElement} */
function hint(text) {
  return createElement('p', 'demo-panel__hint', text);
}

/**
 * Minimal markdown → HTML for the component doc blocks (headings, paragraphs, inline code, bold,
 * links). Input is escaped first, so only the tags produced here are emitted.
 * @param {string} md @returns {string}
 */
function renderMarkdown(md) {
  const inline = (s) => escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  return md.trim().split(/\n{2,}/).map((block) => {
    let html = '';
    let paragraph = [];
    const flush = () => {
      if (paragraph.length) html += `<p>${inline(paragraph.join(' '))}</p>`;
      paragraph = [];
    };
    for (const line of block.split('\n')) {
      const headingThree = line.match(/^###\s+(.*)$/);
      if (headingThree) {
        flush();
        html += `<h3>${inline(headingThree[1])}</h3>`;
      } else if (line.trim()) {
        paragraph.push(line.trim());
      }
    }
    flush();
    return html;
  }).join('');
}

/** @param {string} value @returns {string} */
function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** @param {string} value @returns {string} */
function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
