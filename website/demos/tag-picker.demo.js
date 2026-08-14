import { TagPicker, h } from '../../src/index.js';

const SKILLS = [
  { ID: 'js', name: 'JavaScript' }, { ID: 'ts', name: 'TypeScript' },
  { ID: 'css', name: 'CSS' }, { ID: 'html', name: 'HTML' },
  { ID: 'sql', name: 'SQL' }, { ID: 'php', name: 'PHP' },
  { ID: 'go', name: 'Go' }, { ID: 'rust', name: 'Rust' },
  { ID: 'python', name: 'Python' }, { ID: 'java', name: 'Java' }
];

const CUSTOMERS = [
  { ID: 1, name: 'Alpine Works GmbH', city: 'Innsbruck' },
  { ID: 2, name: 'Northstar Systems', city: 'Rotterdam' },
  { ID: 3, name: 'Atelier West', city: 'Lyon' },
  { ID: 4, name: 'Danube Systems AG', city: 'Linz' },
  { ID: 5, name: 'Helios Energie', city: 'Porto' },
  { ID: 6, name: 'Bruckner Logistik', city: 'Salzburg' },
  { ID: 7, name: 'Kestrel Analytics', city: 'Bristol' }
];

export default {
  title: 'Tag picker',
  group: 'Inputs',
  blurb: 'A multi-select combobox that keeps its selection visible as removable tags inside the '
    + 'control — for picking several values out of a large catalogue.',

  /**
   * Mounts catalogue, free-form, limited, and asynchronous tag pickers.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = output('Type to filter, Enter to pick, Backspace to remove the last tag.');

    const skills = new TagPicker(null, {
      items: SKILLS,
      values: ['js', 'css'],
      placeholder: 'Add a skill',
      onchange: (event) => write(log, `skills → [${event.detail.values.join(', ')}]`)
    });

    const labels = new TagPicker(null, {
      items: [{ ID: 'urgent', name: 'Urgent' }, { ID: 'billing', name: 'Billing' }],
      values: ['urgent'],
      allowCreate: true,
      placeholder: 'Add or create a label',
      oncreate: (event) => write(log, `created label “${event.detail.item.name}”`),
      onchange: (event) => write(log, `labels → [${event.detail.values.join(', ')}]`)
    });

    const limited = new TagPicker(null, {
      items: CUSTOMERS,
      searchKeys: ['name', 'city'],
      max: 3,
      placeholder: 'Up to three customers',
      renderItem: (item) => h('span', {},
        item.name,
        h('span', { style: { color: 'var(--zx-color-text-muted)' } }, ` · ${item.city}`)),
      onchange: (event) => write(log, `customers → ${event.detail.items.map((i) => i.name).join(', ')}`)
    });

    const remote = new TagPicker(null, {
      placeholder: 'Search customers…',
      minQuery: 1,
      debounce: 250,
      filter: async (query) => {
        write(log, `remote query “${query}”…`);
        await new Promise((resolve) => setTimeout(resolve, 220));
        const needle = query.toLocaleLowerCase();
        return CUSTOMERS.filter((item) => item.name.toLocaleLowerCase().includes(needle));
      },
      onchange: (event) => write(log, `remote → [${event.detail.values.join(', ')}]`)
    });

    const readonly = new TagPicker(null, {
      items: SKILLS, values: ['ts', 'go'], readonly: true
    });

    container.append(
      section('Picking from a catalogue',
        field('Skills', skills.toElement()),
        field('Customers (searches name and city, max 3)', limited.toElement()),
        note('The maximum is enforced in both directions: once three tags are set, the remaining '
          + 'options are marked `aria-disabled` rather than silently ignoring the click.')),
      section('Creating and loading',
        field('Labels (creates unknown values)', labels.toElement()),
        field('Remote search (debounced, min. 1 character)', remote.toElement())),
      section('Read-only', field('Locked selection', readonly.toElement())),
      section('Programmatic API',
        row(
          h('button', { class: 'zx-btn', type: 'button', onclick: () => skills.addValue('rust') },
            "addValue('rust')"),
          h('button', { class: 'zx-btn', type: 'button', onclick: () => skills.removeValue('css') },
            "removeValue('css')"),
          h('button', { class: 'zx-btn', type: 'button', onclick: () => skills.clear() }, 'clear()'),
          h('button', { class: 'zx-btn', type: 'button', onclick: () => skills.focus() }, 'focus()')
        )),
      log
    );
  }
};

/** @param {...Node} children @returns {HTMLElement} */
function row(...children) {
  return h('div', { style: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--zx-space-3)'
  } }, children);
}

/** @param {string} label @param {Node} control @returns {HTMLElement} */
function field(label, control) {
  return h('label', { style: {
    display: 'grid', gap: 'var(--zx-space-1)', maxInlineSize: '520px'
  } },
  h('span', { style: { color: 'var(--zx-color-text-muted)', fontSize: 'var(--zx-text-sm)' } }, label),
  control);
}

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', { style: {
    display: 'grid', gap: 'var(--zx-space-4)', marginBlockEnd: 'var(--zx-space-6)',
    border: '1px solid var(--zx-color-border)', borderRadius: 'var(--zx-radius-lg)',
    background: 'var(--zx-color-bg-surface)', padding: 'var(--zx-space-5)'
  } }, h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-xl)' } }, title), children);
}

/** @param {string} text @returns {HTMLElement} */
function note(text) {
  return h('p', { style: {
    margin: '0', maxInlineSize: '78ch', color: 'var(--zx-color-text-muted)', lineHeight: '1.7'
  } }, text);
}

/** @param {string} text @returns {HTMLOutputElement} */
function output(text) {
  return /** @type {HTMLOutputElement} */ (h('output', {
    ariaLive: 'polite', style: { display: 'block', color: 'var(--zx-color-text-muted)' }
  }, text));
}

/** @param {HTMLElement} log @param {string} text @returns {void} */
function write(log, text) {
  log.textContent = text;
}
