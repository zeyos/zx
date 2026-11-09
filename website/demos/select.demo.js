import { flag, h, priorityIcon, Select, stack, statusIcon } from '../../src/index.js';
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

/** Spaces for the entity example: an icon each, and a colour that is a token or nothing at all. */
const SPACES = [
  { ID: 'eng', name: 'Engineering', description: '42 members', icon: 'code', color: 'var(--zx-color-tone-blue-fg)' },
  { ID: 'sales', name: 'Sales', description: '18 members', icon: 'star', color: 'var(--zx-color-tone-green-fg)' },
  { ID: 'support', name: 'Support', description: '11 members', icon: 'info', color: 'var(--zx-color-tone-violet-fg)' },
  { ID: 'archive', name: 'Archive', description: 'Closed projects', icon: 'folder' }
];

/** The built-in status ids `statusIcon()` draws, each with the text that always goes beside it. */
const STATUSES = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'todo', name: 'Todo' },
  { id: 'in-progress', name: 'In progress' },
  { id: 'in-review', name: 'In review' },
  { id: 'ready', name: 'Ready to merge' },
  { id: 'waiting', name: 'Waiting for feedback' },
  { id: 'done', name: 'Done' },
  { id: 'canceled', name: 'Canceled' },
  { id: 'duplicate', name: 'Duplicate' }
];

/** The priority levels `priorityIcon()` draws: null, then 0 (lowest) to 4 (highest). */
const PRIORITIES = [
  { level: null, name: 'No priority' },
  { level: 0, name: 'Lowest' },
  { level: 1, name: 'Low' },
  { level: 2, name: 'Medium' },
  { level: 3, name: 'High' },
  { level: 4, name: 'Highest' }
];

const PROJECTS = [
  { ID: 1, name: 'Deploy', team: 'UniBack / Katayo', group: 'TEAM PROJECTS', module: 'projects' },
  { ID: 2, name: 'Katayo', team: 'UniBack / Katayo', group: 'TEAM PROJECTS', module: 'projects' },
  { ID: 3, name: 'Website', team: 'UniBack / Katayo', group: 'TEAM PROJECTS', module: 'projects' },
  { ID: 4, name: 'Backend', team: 'Other projects', group: 'OTHER PROJECTS', module: 'projects' },
  { ID: 5, name: 'Frontend', team: 'Other projects', group: 'OTHER PROJECTS', module: 'projects' }
];

/** The languages an application ships, as BCP 47 tags. A tag with a region draws that region's flag. */
const APP_LOCALES = ['en-GB', 'en-US', 'de', 'de-AT', 'de-CH', 'fr', 'it'];

/** A longer list: the picker filters once it holds more than seven locales. */
const ALL_LOCALES = [
  'ar', 'cs', 'da', 'de', 'el', 'en', 'es', 'es-419', 'fi', 'fr', 'he', 'hi', 'hu', 'id', 'it',
  'ja', 'ko', 'nb', 'nl', 'pl', 'pt-BR', 'pt-PT', 'ro', 'ru', 'sk', 'sv', 'th', 'tr', 'uk', 'vi',
  'zh-Hans', 'zh-Hant'
];

/** Locales described as items: a name or a flag region of the application's own choosing. */
const CUSTOM_LOCALES = [
  { code: 'en', name: 'English', region: null },
  { code: 'de', name: 'Deutsch', region: null },
  { code: 'tlh', name: 'Klingon (fan translation)', description: 'Community-maintained', region: null }
];

/** The markets this example ships to, pinned above every other country. */
const MARKETS = ['DE', 'AT', 'CH'];

/** A restricted list: the countries a shipping form accepts, with a note per country. */
const SHIPPING = [
  { code: 'DE', description: 'Standard, 1–2 days' },
  { code: 'AT', description: 'Standard, 2–3 days' },
  { code: 'CH', description: 'Customs declaration required' },
  { code: 'FR', description: 'Standard, 3–4 days' },
  { code: 'IT', description: 'Standard, 3–5 days' },
  { code: 'NL', description: 'Standard, 2–3 days' }
];

/** Offices for the flag() example: a flag beside a name, outside any picker. */
const OFFICES = [
  { city: 'Vienna', country: 'AT' },
  { city: 'Munich', country: 'DE' },
  { city: 'Zurich', country: 'CH' },
  { city: 'Lisbon', country: 'PT' }
];

export default {
  title: 'Select',
  group: 'Inputs',
  blurb: 'An APG editable combobox: a real text input, a top-layer listbox, and three filtering '
    + 'modes — none, local, and a function you supply. Locale and country presets add Intl names, flags, and value normalization.',

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
              background: 'var(--zx-color-bg-muted)', color: 'var(--zx-color-text-muted)',
              fontWeight: '600'
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
      id: 'locale',
      preset: true,
      title: 'Select.locale()',
      blurb: 'locales lists the tags to offer, in the order given. A tag with a region draws that '
        + 'region\'s flag; the value is the canonical tag, and set() accepts any spelling of it. '
        + 'Where the platform has no flag emoji, a language chip stands in.',
      width: '320px',
      render: ({ cleanup, log }) => {
        const picker = Select.locale(null, {
          locales: APP_LOCALES,
          value: 'de_at'
        });
        log(`value=${picker.value}`);
        picker.on('change', ({ detail }) => log(`change value=${detail.value}`));
        cleanup(() => picker.destroy());
        return picker.toElement();
      }
    },
    {
      id: 'locale-language-chips',
      preset: true,
      title: 'Language chips instead of flags',
      blurb: 'A language is not a country. flags: "code" draws the language code instead, and '
        + 'display: "localized" names every locale in the interface language — set here with '
        + 'displayLocale. preferred pins the main languages above the filterable rest.',
      width: '320px',
      render: ({ cleanup, log }) => {
        const picker = Select.locale(null, {
          locales: ALL_LOCALES,
          preferred: ['en', 'de'],
          flags: 'code',
          display: 'localized',
          displayLocale: 'de',
          sort: true,
          clearable: true
        });
        picker.on('change', ({ detail }) => log(`change value=${detail.value}`));
        cleanup(() => picker.destroy());
        return picker.toElement();
      }
    },
    {
      id: 'locale-custom-items',
      preset: true,
      title: 'Flag regions and custom items',
      blurb: 'flagRegions decides the flag of a language whose likely region is not the one meant: '
        + 'English shows the United Kingdom here, Portuguese Brazil. An item can carry its own name, '
        + 'description, and region — null draws the chip.',
      width: '320px',
      render: ({ cleanup, log }) => {
        const regional = Select.locale(null, {
          locales: ['en', 'pt', 'es', 'zh'],
          flagRegions: { en: 'GB', pt: 'BR' },
          flags: 'emoji',
          value: 'en'
        });
        const custom = Select.locale(null, {
          locales: CUSTOM_LOCALES,
          label: 'Translation',
          value: 'tlh'
        });
        for (const picker of [regional, custom]) {
          picker.on('change', ({ detail }) => log(`change value=${detail.value}`));
          cleanup(() => picker.destroy());
        }
        return stack({ gap: 3 }, regional.toElement(), custom.toElement());
      }
    },
    {
      id: 'country',
      preset: true,
      title: 'Select.country()',
      blurb: 'Without countries the picker lists all of them, sorted by name. preferred pins a few '
        + 'above the rest; typing filters by name, code, or English name.',
      width: '320px',
      render: ({ cleanup, log }) => {
        const picker = Select.country(null, {
          preferred: MARKETS,
          clearable: true,
          value: 'at'
        });
        log(`value=${picker.value}`);
        picker.on('change', ({ detail }) => log(`change value=${detail.value}`));
        cleanup(() => picker.destroy());
        return picker.toElement();
      }
    },
    {
      id: 'country-restricted',
      preset: true,
      title: 'A restricted list in German',
      blurb: 'countries limits the choice and may carry a description per country. displayLocale '
        + 'names them in another language — search still finds "Germany" — and showCode or a '
        + 'description adds the secondary line.',
      width: '320px',
      render: ({ cleanup, log }) => {
        const picker = Select.country(null, {
          countries: SHIPPING,
          displayLocale: 'de',
          label: 'Lieferland',
          value: 'DE'
        });
        picker.on('change', ({ detail }) => log(`change value=${detail.value}`));
        cleanup(() => picker.destroy());
        return picker.toElement();
      }
    },
    {
      id: 'country-flags',
      preset: true,
      title: 'Flags outside a picker',
      blurb: 'flag() draws the same flag anywhere — a table cell, a profile. It is decorative, so put '
        + 'the name beside it. kind: "code" draws the chip, and src draws from a flag set the '
        + 'application serves (\'/flags/{code}.svg\').',
      width: '320px',
      render: () => stack({ gap: 2 }, ...OFFICES.map((office) => stack({ direction: 'row', gap: 2, align: 'center' },
        flag(office.country),
        flag(office.country, { kind: 'code' }),
        h('span', {}, office.city))))
    },
    {
      id: 'priority',
      title: 'Select.priority()',
      preset: true,
      blurb: 'Select.priority() builds the five-step ZeyOS priority scale, values 0 to 4. Each level '
        + 'is grey signal bars filled to its height; only the highest, the one that needs attention, '
        + 'is coloured. "No priority" (null) heads the list — clearable: false removes it. The labels '
        + 'come from the msg map you pass, so the preset localises with the rest of the application.',
      width: '360px',
      render: ({ cleanup, log }) => {
        const select = Select.priority(null, {
          value: 2,
          msg: {
            'priority.none': 'No priority',
            'priority.lowest': 'Lowest',
            'priority.low': 'Low',
            'priority.normal': 'Normal',
            'priority.high': 'High',
            'priority.highest': 'Highest'
          },
          onchange: ({ detail }) => log(`priority ${detail.value}`)
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
      id: 'glyphs',
      title: 'Status and priority glyphs',
      blurb: 'statusIcon(status) and priorityIcon(level) return the glyphs the two presets draw, '
        + 'so a list row, a board column, or a filter chip shows the same mark as the picker that '
        + 'changes it. They are decorative (aria-hidden): always put the status or priority in text '
        + 'beside them, or pass { label } for a glyph that stands alone. review and cancelled are '
        + 'accepted for in-review and canceled; { tone } and { indicator } restyle one status.',
      render: () => {
        const row = (glyph, text) => h('li', {
          style: { display: 'flex', alignItems: 'center', gap: 'var(--zx-space-2)' }
        }, glyph, h('span', {}, text));
        const list = (rows) => h('ul', {
          style: { display: 'grid', gap: 'var(--zx-space-2)', margin: '0', padding: '0', listStyle: 'none' }
        }, ...rows);
        return h('div', {
          style: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 'var(--zx-space-8)' }
        },
          list(STATUSES.map((status) => row(statusIcon(status.id), status.name))),
          list(PRIORITIES.map((priority) => row(priorityIcon(priority.level), priority.name))));
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
      id: 'entity-colors',
      title: 'Entity icons and colours',
      blurb: 'Without renderIcon, Select.entity() draws iconKey on a tile filled with colorKey — a '
        + 'colour, or a token reference such as var(--zx-color-tone-blue-fg) so the tile follows '
        + 'the theme. An entity without a colour gets a neutral tile. With no filter the input is '
        + 'read-only, and a click opens it without the keyboard focus ring.',
      width: '360px',
      render: ({ cleanup, log }) => {
        const select = Select.entity(null, {
          items: SPACES,
          value: 'eng',
          label: 'Space',
          onchange: ({ detail }) => log(`space ${detail.value}`)
        });
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
      blurb: 'A disabled Select fades as a whole — text, frame, and chevron — the way a disabled '
        + 'Field does.',
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
