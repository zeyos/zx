import { Component, defineElements, h } from '../../src/index.js';

defineElements();

/** Who takes part in the conversation: the keys its items name as `author`. */
const AUTHORS = {
  me: { name: 'Hanna Weber', kind: 'person' },
  finance: { name: 'Finance agent', tone: 'violet' }
};

/** The conversation so far, as plain items. @returns {object[]} */
function conversation() {
  return [
    { id: 'ask', type: 'user', text: 'Which invoices are late?' },
    {
      id: 'answer',
      type: 'answer',
      author: 'finance',
      blocks: [{ type: 'p', text: 'Three invoices are late, **€4,515.50** in all [1].' }],
      sources: [{ id: 'ledger', title: 'Invoices · September', kind: 'file' }]
    }
  ];
}

export default {
  title: 'Custom elements',
  group: 'Core',
  api: ['defineElements', 'Component'],
  blurb: 'Form controls, containers, the agent kit and the data views also ship as custom elements, so a '
    + 'screen can be written as markup and configured with attributes instead of constructor calls.',

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
      title: 'An agent conversation in markup',
      blurb: 'A thread, a composer and a run status written as markup and driven the way a framework '
        + 'drives them: the script sets properties and listens for events by their plain names. '
        + 'Rich data stays on the property, so the conversation is never serialised into an attribute. '
        + 'Send a message, then press Stop while the agent is working.',
      layout: 'stack',
      width: '560px',
      render: ({ log }) => {
        const markup = h.raw(`
          <div class="demo-stack">
            <zx-run-status compact state="done"></zx-run-status>
            <zx-agent-thread label="Invoices"></zx-agent-thread>
            <zx-composer label="Message" placeholder="Ask the finance agent"></zx-composer>
          </div>
        `);

        const status = /** @type {HTMLElement & {state: string}} */ (markup.querySelector('zx-run-status'));
        const thread = /** @type {HTMLElement & {authors: object, items: object[]}} */ (
          markup.querySelector('zx-agent-thread'));
        const composer = /** @type {HTMLElement & {busy: boolean}} */ (markup.querySelector('zx-composer'));

        let items = conversation();
        let reply = 0;
        const add = (item) => {
          items = [...items, { id: `item-${items.length}`, ...item }];
          thread.items = items;
        };
        const settle = (state) => {
          clearTimeout(reply);
          composer.busy = false;
          status.state = state;
        };

        thread.authors = AUTHORS;
        thread.items = items;

        composer.addEventListener('send', (event) => {
          log(`send: ${event.detail.text}`);
          add({ type: 'user', text: event.detail.text });
          composer.busy = true;
          status.state = 'running';
          reply = window.setTimeout(() => {
            add({
              type: 'answer',
              author: 'finance',
              blocks: [{ type: 'p', text: 'I will check the ledger and come back to you.' }]
            });
            settle('done');
          }, 1500);
        });
        composer.addEventListener('stop', () => {
          log('stop');
          settle('stopped');
        });
        thread.addEventListener('cite', (event) => log(`cite: ${event.detail.source?.title}`));
        thread.addEventListener('action', (event) => log(`action: ${event.detail.action}`));
        return markup;
      }
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
