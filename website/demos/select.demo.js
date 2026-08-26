import { h, Select } from '../../src/index.js';
import { matchItems } from '../../src/components/select/filter.js';
import { demoZeyosAppIcon } from '../zeyos-demo-icons.js';

/** @param {number} count @param {string} prefix @returns {Array<{ID: number, name: string}>} */
function makeItems(count, prefix) {
  return Array.from({ length: count }, (_, index) => ({ ID: index, name: `${prefix} ${index + 1}` }));
}

/** @param {string} name @returns {string} */
function initials(name) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

const PROJECTS = [
  { ID: 1, name: 'Deploy', team: 'UniBack / Katayo', group: 'TEAM PROJECTS', module: 'projects' },
  { ID: 2, name: 'Katayo', team: 'UniBack / Katayo', group: 'TEAM PROJECTS', module: 'projects' },
  { ID: 3, name: 'Website', team: 'UniBack / Katayo', group: 'TEAM PROJECTS', module: 'projects' },
  { ID: 4, name: 'Backend', team: 'Other projects', group: 'OTHER PROJECTS', module: 'projects' },
  { ID: 5, name: 'Frontend', team: 'Other projects', group: 'OTHER PROJECTS', module: 'projects' }
];

export default {
  title: 'Select',
  group: 'Inputs',
  blurb: 'An APG editable combobox: a real text input, a top-layer listbox, and three filtering '
    + 'modes — none, local, and a function you supply.',

  examples: [
    {
      title: 'Read-only with a long list',
      blurb: 'Without a filter the input is read-only: it opens a list rather than accepting text. '
        + 'A hundred options stay usable because the listbox scrolls the active option into view '
        + 'as the arrow keys move through it.',
      width: '360px',
      render: ({ cleanup, log }) => {
        const select = new Select(null, {
          items: makeItems(100, 'Static item'),
          value: 9,
          placeholder: 'Choose an item'
        });
        select.on('change', ({ detail }) => log(`change value=${detail.value}`));
        cleanup(() => select.destroy());
        return select.toElement();
      }
    },
    {
      title: 'Local filtering',
      blurb: 'filter: "local" makes the input editable and matches as the reader types. '
        + 'searchKeys names the fields to search — here both the name and the department — and '
        + 'clearable adds the button that empties the field.',
      width: '360px',
      render: ({ cleanup, log }) => {
        const select = new Select(null, {
          items: [
            { ID: 1, name: 'Crème Brûlée', department: 'Dessert' },
            { ID: 2, name: 'Apple Strudel', department: 'Dessert' },
            { ID: 3, name: 'Vienna Roast', department: 'Coffee' },
            { ID: 4, name: 'Green Tea', department: 'Tea' },
            { ID: 5, name: 'Club Sandwich', department: 'Kitchen' }
          ],
          filter: 'local',
          searchKeys: ['name', 'department'],
          clearable: true,
          placeholder: 'Search food and drinks'
        });
        select.on('query', ({ detail }) => log(`query "${detail.query}"`));
        select.on('change', ({ detail }) => log(`change value=${detail.value}`));
        cleanup(() => select.destroy());
        return select.toElement();
      }
    },
    {
      title: 'Async filtering',
      blurb: 'A filter function returning a promise turns the Select into a remote search. '
        + 'debounce waits out the typing, and each new query aborts the request in flight — this '
        + 'fake source adds jitter so out-of-order responses would be visible if they were not '
        + 'discarded.',
      width: '360px',
      render: ({ cleanup, log }) => {
        let controller = null;
        const items = makeItems(80, 'Remote result');

        const select = new Select(null, {
          debounce: 40,
          placeholder: 'Type to fetch',
          clearable: true,
          filter: async (query) => {
            controller?.abort();
            controller = new AbortController();
            const { signal } = controller;
            await new Promise((resolve, reject) => {
              const timer = setTimeout(resolve, 100 + ((query.length * 137) % 420));
              signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new Error('Request aborted'));
              }, { once: true });
            });
            return matchItems(items, query, ['name']);
          }
        });
        select.on('loaded', ({ detail }) => log(`loaded items=${detail.items.length}`));
        cleanup(() => {
          controller?.abort();
          select.destroy();
        });
        return select.toElement();
      }
    },
    {
      title: 'Fixed choices above a search',
      blurb: 'fixedItems pins choices to the top of the list, above a rule. They are part of the '
        + 'control rather than of its data: a filter function replaces the item list on every '
        + 'query, and the pinned choices are narrowed locally instead — so they stay selectable, '
        + 'and a form that loads one back still resolves it.',
      width: '360px',
      render: ({ cleanup, log }) => {
        const select = new Select(null, {
          fixedItems: [
            { ID: 'none', name: 'Unassigned' },
            { ID: 'me', name: 'Assign to me' }
          ],
          items: [
            { ID: 1, name: 'Ava Stone' },
            { ID: 2, name: 'Ben Keller' },
            { ID: 3, name: 'Cara Müller' },
            { ID: 4, name: 'Dan Novak' }
          ],
          filter: 'local',
          value: 'me',
          placeholder: 'Search people'
        });
        select.on('change', ({ detail }) => log(`change value=${JSON.stringify(detail.value)}`));
        cleanup(() => select.destroy());
        return select.toElement();
      }
    },
    {
      title: 'Custom option rendering',
      blurb: 'renderItem draws the row inside the listbox and renderValue the text left in the '
        + 'input once something is chosen. The two are separate because a rich row rarely reads '
        + 'well on one line.',
      width: '360px',
      render: ({ cleanup }) => {
        const select = new Select(null, {
          items: [
            { ID: 'as', name: 'Ava Stone', role: 'Administrator' },
            { ID: 'bk', name: 'Ben Keller', role: 'Operations' },
            { ID: 'cm', name: 'Cara Müller', role: 'Sales' }
          ],
          value: 'bk',
          renderValue: (item) => item.name,
          renderItem: (item) => h('span', {
            style: { display: 'flex', alignItems: 'center', gap: 'var(--zx-space-2)' }
          },
          h('span', {
            ariaHidden: 'true',
            style: {
              display: 'grid', placeItems: 'center', inlineSize: '28px', blockSize: '28px',
              flex: 'none', borderRadius: 'var(--zx-radius-full)',
              background: 'var(--zx-color-bg-selected)', color: 'var(--zx-color-accent)',
              fontWeight: '700'
            }
          }, initials(item.name)),
          h('span', { style: { display: 'grid' } },
            h('strong', {}, item.name),
            h('small', { style: { color: 'var(--zx-color-text-muted)' } }, item.role)))
        });
        cleanup(() => select.destroy());
        return select.toElement();
      }
    },
    {
      title: 'A thousand options',
      blurb: 'Local filtering stays responsive at list sizes where a native <select> stops being '
        + 'usable, because only the matching options are in the DOM at any moment.',
      width: '360px',
      render: ({ cleanup }) => {
        const select = new Select(null, {
          items: makeItems(1000, 'Inventory record'),
          filter: 'local',
          placeholder: 'Filter 1,000 records'
        });
        cleanup(() => select.destroy());
        return select.toElement();
      }
    },
    {
      id: 'priority',
      title: 'Select.priority()',
      preset: true,
      blurb: 'Select.priority() builds the five-step ZeyOS priority scale, with its labels taken '
        + 'from the msg map you pass so the preset localises with the rest of the application.',
      width: '360px',
      render: ({ cleanup }) => {
        const select = Select.priority(null, {
          value: 2,
          msg: {
            'priority.lowest': 'Lowest',
            'priority.low': 'Low',
            'priority.normal': 'Normal',
            'priority.high': 'High',
            'priority.highest': 'Highest'
          }
        });
        select.refs.input.setAttribute('aria-label', 'Priority preset');
        cleanup(() => select.destroy());
        return select.toElement();
      }
    },
    {
      id: 'status',
      title: 'Select.status()',
      preset: true,
      blurb: 'Select.status() provides a compact workflow-status vocabulary with distinct shapes, '
        + 'semantic colors, and optional keyboard hints. Pass your own items to retain the same '
        + 'presentation with application-specific states.',
      width: '360px',
      render: ({ cleanup, log }) => {
        const select = Select.status(null, {
          value: 'in-progress',
          onchange: ({ detail }) => log(`status ${detail.value}`)
        });
        select.refs.input.setAttribute('aria-label', 'Workflow status');
        cleanup(() => select.destroy());
        return select.toElement();
      }
    },
    {
      id: 'zeyos-entity',
      title: 'Select.entity()',
      preset: true,
      blurb: 'Select.entity() is the rich Entity-box preset: optional Recent items stay above '
        + 'grouped results, duplicate result IDs are removed, and an application-owned create '
        + 'command stays at the bottom. The optional ZeyOS adapter composes this same preset.',
      width: '360px',
      render: ({ cleanup, log }) => {
        const select = Select.entity(null, {
          items: PROJECTS,
          recent: [PROJECTS[2], PROJECTS[0]],
          value: 3,
          subtitleKey: 'team',
          groupKey: 'group',
          clearable: true,
          noneLabel: 'No project',
          placeholder: 'Move to project…',
          filter: 'local',
          renderIcon: (item) => demoZeyosAppIcon(item.module, { size: 20, shape: 'tile' }),
          create: {
            label: 'Create new project…',
            group: 'NEW PROJECT',
            invoke: () => log('create project')
          },
          onchange: ({ detail }) => log(`project ${detail.value}`)
        });
        select.refs.input.setAttribute('aria-label', 'Project');
        cleanup(() => select.destroy());
        return select.toElement();
      }
    },
    {
      id: 'permission',
      title: 'Select.permission()',
      preset: true,
      blurb: 'Select.permission() is the record-access control: Private and Public pinned above '
        + 'the groups a record may be shared with, carrying the tri-state the ZeyOS API stores — '
        + 'false, true, or a group ID — so it binds straight to the record field. groups takes an '
        + 'array, or a function to query them as the reader types, as here.',
      width: '360px',
      render: ({ cleanup, log }) => {
        const groups = [
          { ID: 101, name: 'Executive team' },
          { ID: 102, name: 'Finance' },
          { ID: 103, name: 'Project Phoenix' },
          { ID: 104, name: 'Vienna office' }
        ];
        const select = Select.permission(null, {
          value: false,
          debounce: 40,
          groups: async (query) => {
            await new Promise((resolve) => setTimeout(resolve, 120));
            return matchItems(groups, query, ['name']);
          },
          onchange: ({ detail }) => log(`change value=${JSON.stringify(detail.value)}`)
        });
        select.refs.input.setAttribute('aria-label', 'Record permission');
        cleanup(() => select.destroy());
        return select.toElement();
      }
    },
    {
      title: 'Disabled',
      width: '360px',
      render: ({ cleanup }) => {
        const select = new Select(null, {
          items: makeItems(5, 'Static item'),
          value: 2,
          disabled: true
        });
        cleanup(() => select.destroy());
        return select.toElement();
      }
    }
  ]
};
