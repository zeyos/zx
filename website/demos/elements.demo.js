import { Component, defineElements, h } from '../../src/index.js';

const sectionStyle = {
  display: 'grid',
  gap: 'var(--zx-space-4)',
  marginBlockEnd: 'var(--zx-space-6)',
  padding: 'var(--zx-space-5)',
  border: '1px solid var(--zx-color-border)',
  borderRadius: 'var(--zx-radius-lg)',
  background: 'var(--zx-color-bg-surface)'
};

const rowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--zx-space-3)'
};

const logStyle = {
  display: 'block',
  margin: '0',
  color: 'var(--zx-color-text-muted)',
  whiteSpace: 'pre-wrap'
};

export default {
  title: 'Custom elements',
  group: 'Core',

  /**
   * Mounts declarative custom-element, form-association, reflection, and lifecycle examples.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    defineElements();

    const sample = h.raw(`
      <div data-elements-demo>
        <section data-example="form">
          <h2>Form-associated elements</h2>
          <p>The required select starts with a default value. Clear it to expose native <code>:invalid</code>, then reset the form to restore all defaults.</p>
          <form data-elements-form>
            <div data-elements-fields>
              <label>
                <span>Priority</span>
                <zx-select name="priority" items='[{"ID":"normal","name":"Normal"},{"ID":"high","name":"High"}]' value="normal" clearable required></zx-select>
              </label>
              <zx-toggle name="notifications" value="enabled" label="Notifications" checked></zx-toggle>
              <label>
                <span>Start date</span>
                <zx-datebox name="start" value="2026-07-20"></zx-datebox>
              </label>
            </div>
            <div data-elements-actions>
              <button type="submit">Read FormData</button>
              <button type="reset">Reset defaults</button>
            </div>
          </form>
          <output data-form-log aria-live="polite">Submit to inspect the ElementInternals-backed FormData entries.</output>
        </section>

        <section data-example="reflection">
          <h2>Live attribute and property reflection</h2>
          <p>The first button changes the JSON attribute; the second assigns an array directly to <code>items</code>.</p>
          <zx-select data-reflect-select items='[{"ID":"a","name":"Alpha"},{"ID":"b","name":"Beta"}]' value="a"></zx-select>
          <div data-elements-actions>
            <button type="button" data-change-items>Change items attribute</button>
            <button type="button" data-set-items>Assign items property</button>
            <button type="button" data-toggle-disabled>Toggle disabled</button>
          </div>
          <output data-reflection-log aria-live="polite">items property contains 2 entries; disabled=false</output>
        </section>

        <section data-example="declarative">
          <h2>Declarative layout and data</h2>
          <zx-tabbox active="overview" tabs='[{"name":"overview","title":"Overview","content":"Tabs can be supplied as JSON."},{"name":"details","title":"Details","content":"String content is inserted as text."}]'></zx-tabbox>
          <zx-table row-id="id" columns='[{"id":"id","label":"ID","sortable":true},{"id":"name","label":"Name","sortable":true}]' data='[{"id":1,"name":"Ada"},{"id":2,"name":"Grace"}]'></zx-table>
        </section>

        <section data-example="lifecycle">
          <h2>Disconnect cleanup</h2>
          <zx-search data-lifecycle-search placeholder="Remove this component"></zx-search>
          <div data-elements-actions>
            <button type="button" data-remove-element>Remove custom element</button>
          </div>
          <output data-lifecycle-log aria-live="polite">The backing component is registered.</output>
        </section>
      </div>
    `);
    container.append(sample);

    const marker = /** @type {HTMLElement} */ (container.querySelector('[data-elements-demo]'));
    applyDemoStyles(marker);
    wireForm(marker);
    wireReflection(marker);
    wireLifecycle(marker);
  }
};

/** @param {HTMLElement} marker @returns {void} */
function applyDemoStyles(marker) {
  for (const section of marker.querySelectorAll('[data-example]')) Object.assign(section.style, sectionStyle);
  for (const row of marker.querySelectorAll('[data-elements-actions], [data-elements-fields]')) {
    Object.assign(row.style, rowStyle);
  }
  for (const output of marker.querySelectorAll('output')) Object.assign(output.style, logStyle);
  const table = marker.querySelector('zx-table');
  if (table) table.style.marginBlockStart = 'var(--zx-space-4)';
}

/** @param {HTMLElement} marker @returns {void} */
function wireForm(marker) {
  const form = /** @type {HTMLFormElement} */ (marker.querySelector('[data-elements-form]'));
  const log = /** @type {HTMLOutputElement} */ (marker.querySelector('[data-form-log]'));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const entries = Array.from(new FormData(form).entries());
    log.textContent = `FormData\n${entries.map(([name, value]) => `${name}: ${String(value)}`).join('\n')}`;
  });
  form.addEventListener('reset', () => {
    queueMicrotask(() => {
      const entries = Array.from(new FormData(form).entries());
      log.textContent = `Reset defaults\n${entries.map(([name, value]) => `${name}: ${String(value)}`).join('\n')}`;
    });
  });
}

/** @param {HTMLElement} marker @returns {void} */
function wireReflection(marker) {
  const select = /** @type {HTMLElement & {items: unknown[], disabled: boolean}} */ (
    marker.querySelector('[data-reflect-select]')
  );
  const log = /** @type {HTMLOutputElement} */ (marker.querySelector('[data-reflection-log]'));
  const report = (source) => {
    log.textContent = `${source}\nitems property contains ${select.items.length} entries; ` +
      `disabled=${String(select.disabled)}\nitems attribute=${select.getAttribute('items')}`;
  };
  marker.querySelector('[data-change-items]').addEventListener('click', () => {
    select.setAttribute('items', JSON.stringify([
      { ID: 'c', name: 'Charlie' },
      { ID: 'd', name: 'Delta' },
      { ID: 'e', name: 'Echo' }
    ]));
    report('Changed through setAttribute()');
  });
  marker.querySelector('[data-set-items]').addEventListener('click', () => {
    select.items = [{ ID: 'x', name: 'Property value' }];
    report('Assigned an array to the items property');
  });
  marker.querySelector('[data-toggle-disabled]').addEventListener('click', () => {
    select.toggleAttribute('disabled');
    report('Toggled the disabled attribute');
  });
}

/** @param {HTMLElement} marker @returns {void} */
function wireLifecycle(marker) {
  const search = /** @type {HTMLElement & {component: import('../../src/core/component.js').Component|null}} */ (
    marker.querySelector('[data-lifecycle-search]')
  );
  const log = /** @type {HTMLOutputElement} */ (marker.querySelector('[data-lifecycle-log]'));
  const button = /** @type {HTMLButtonElement} */ (marker.querySelector('[data-remove-element]'));
  const root = search.component?.el ?? null;
  button.addEventListener('click', () => {
    search.remove();
    const destroyed = root !== null && Component.from(root) === null && search.component === null;
    log.textContent = destroyed ?
      'disconnectedCallback destroyed and unregistered the component.' :
      'Cleanup check failed.';
    button.disabled = true;
  });
}
