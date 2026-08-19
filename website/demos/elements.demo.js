import { Component, defineElements, h } from '../../src/index.js';

defineElements();

export default {
  title: 'Custom elements',
  group: 'Core',
  api: ['defineElements', 'Component'],
  blurb: 'Every Zx component also ships as a custom element, so a screen can be written as markup '
    + 'and configured with attributes instead of constructor calls.',

  examples: [
    {
      title: 'Form-associated elements',
      blurb: 'The elements participate in a native <form> through ElementInternals: they appear in '
        + 'FormData under their name, honour required and native :invalid, and restore their '
        + 'defaults on reset. Clear the priority select to see the validity state, then reset.',
      layout: 'stack',
      width: '520px',
      render: ({ log }) => {
        const markup = h.raw(`
          <form>
            <label class="demo-field">
              <span>Priority</span>
              <zx-select name="priority" value="normal" clearable required
                items='[{"ID":"normal","name":"Normal"},{"ID":"high","name":"High"}]'></zx-select>
            </label>
            <zx-toggle name="notifications" value="enabled" label="Notifications" checked></zx-toggle>
            <label class="demo-field">
              <span>Start date</span>
              <zx-datebox name="start" value="2026-07-20"></zx-datebox>
            </label>
            <div class="demo-row">
              <button type="submit">Read FormData</button>
              <button type="reset">Reset defaults</button>
            </div>
          </form>
        `);

        const form = /** @type {HTMLFormElement} */ (markup.querySelector('form'));
        Object.assign(form.style, { display: 'grid', gap: 'var(--zx-space-4)' });
        const report = (source) => log(`${source}: ${[...new FormData(form).entries()]
          .map(([name, value]) => `${name}=${value}`).join(', ')}`);
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          report('FormData');
        });
        form.addEventListener('reset', () => queueMicrotask(() => report('after reset')));
        return markup;
      }
    },
    {
      title: 'Attributes and properties reflect',
      blurb: 'A JSON attribute and a direct property assignment are two routes to the same state. '
        + 'setAttribute("items", \u2026) reparses the JSON; assigning an array to .items skips the '
        + 'serialisation entirely, which is what application code should do.',
      layout: 'stack',
      width: '420px',
      render: ({ log }) => {
        const markup = h.raw(`
          <div class="demo-stack">
            <zx-select value="a" items='[{"ID":"a","name":"Alpha"},{"ID":"b","name":"Beta"}]'></zx-select>
            <div class="demo-row">
              <button type="button" data-attribute>setAttribute('items', \u2026)</button>
              <button type="button" data-property>.items = [\u2026]</button>
              <button type="button" data-disabled>toggle disabled</button>
            </div>
          </div>
        `);

        const select = /** @type {HTMLElement & {items: unknown[], disabled: boolean}} */ (
          markup.querySelector('zx-select'));
        const report = (source) =>
          log(`${source} \u2192 items.length=${select.items.length}, disabled=${select.disabled}`);

        markup.querySelector('[data-attribute]').addEventListener('click', () => {
          select.setAttribute('items', JSON.stringify([
            { ID: 'c', name: 'Charlie' },
            { ID: 'd', name: 'Delta' },
            { ID: 'e', name: 'Echo' }
          ]));
          report('setAttribute');
        });
        markup.querySelector('[data-property]').addEventListener('click', () => {
          select.items = [{ ID: 'x', name: 'Property value' }];
          report('property');
        });
        markup.querySelector('[data-disabled]').addEventListener('click', () => {
          select.toggleAttribute('disabled');
          report('toggleAttribute');
        });
        return markup;
      }
    },
    {
      title: 'Declarative layout and data',
      blurb: 'Composite components take their whole configuration as JSON attributes, so a tab set '
        + 'or a table is one element in the markup. String content is inserted as text, never as '
        + 'HTML.',
      layout: 'stack',
      render: () => h.raw(`
        <zx-tabbox active="overview" tabs='[
          {"name":"overview","title":"Overview","content":"Tabs can be supplied as JSON."},
          {"name":"details","title":"Details","content":"String content is inserted as text."}]'></zx-tabbox>
        <zx-table row-id="id"
          columns='[{"id":"id","label":"ID","sortable":true},{"id":"name","label":"Name","sortable":true}]'
          data='[{"id":1,"name":"Ada"},{"id":2,"name":"Grace"}]'></zx-table>
      `)
    },
    {
      title: 'Disconnect cleanup',
      blurb: 'Removing the element runs disconnectedCallback, which destroys the backing component '
        + 'and unregisters it \u2014 so markup-driven screens do not leak listeners when a view is '
        + 'swapped out. The check below reads Component.from() back to prove it.',
      layout: 'stack',
      width: '420px',
      render: ({ log }) => {
        const markup = h.raw(`
          <div class="demo-stack">
            <zx-search placeholder="Remove this component"></zx-search>
            <div class="demo-row"><button type="button">Remove custom element</button></div>
          </div>
        `);

        const search = /** @type {HTMLElement & {component: Component|null}} */ (
          markup.querySelector('zx-search'));
        const button = /** @type {HTMLButtonElement} */ (markup.querySelector('button'));
        button.addEventListener('click', () => {
          const root = search.component?.el ?? null;
          search.remove();
          log(root !== null && Component.from(root) === null && search.component === null
            ? 'disconnectedCallback destroyed and unregistered the component.'
            : 'Cleanup check failed.');
          button.disabled = true;
        });
        return markup;
      }
    }
  ]
};
