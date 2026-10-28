import { ListToolbar, Sheet, TableView, ViewSettings } from '../../src/index.js';

/**
 * The fields of an opportunity list, with the type each one has. The type decides the glyph a
 * row shows and whether the field can group records; `locked` keeps the title shown and in place.
 */
const FIELDS = [
  { id: 'name', label: 'Opportunity', type: 'text', locked: true },
  { id: 'company', label: 'Company', type: 'entity' },
  { id: 'stage', label: 'Stage', type: 'status' },
  { id: 'value', label: 'Value', type: 'money' },
  { id: 'probability', label: 'Probability', type: 'percent' },
  { id: 'owner', label: 'Owner', type: 'select' },
  { id: 'close', label: 'Close date', type: 'date' },
  { id: 'tags', label: 'Tags', type: 'tags' },
  { id: 'website', label: 'Website', type: 'url' },
  { id: 'contact', label: 'Contact email', type: 'email' }
];

/** The columns of a ticket table, for the example bound to a live view. */
const COLUMNS = [
  { id: 'subject', label: 'Subject', type: 'text', sortable: true, locked: true },
  { id: 'customer', label: 'Customer', type: 'entity', sortable: true },
  { id: 'status', label: 'Status', type: 'status', width: '8rem' },
  { id: 'priority', label: 'Priority', type: 'priority', width: '7rem' },
  { id: 'agent', label: 'Agent', type: 'select', width: '8rem' },
  { id: 'updated', label: 'Updated', type: 'date', width: '8rem' },
  { id: 'channel', label: 'Channel', type: 'select', visible: false },
  { id: 'replies', label: 'Replies', type: 'number', visible: false, align: 'end' },
  { id: 'reporter', label: 'Reporter email', type: 'email', visible: false }
];

/**
 * The rows the ticket table is handed.
 * @returns {Record<string, unknown>[]}
 */
function tickets() {
  return [
    { ID: 1, subject: 'Invoice layout breaks in print', customer: 'Alpine Works', status: 'Open', priority: 'High', agent: 'Nadine', updated: '2026-09-18', channel: 'Email', replies: 4, reporter: 'ap@alpine.example' },
    { ID: 2, subject: 'Import stops at row 4000', customer: 'Danube Systems', status: 'Waiting', priority: 'Normal', agent: 'Piet', updated: '2026-09-17', channel: 'Portal', replies: 2, reporter: 'it@danube.example' },
    { ID: 3, subject: 'Second address book missing', customer: 'Kestrel Retail', status: 'Open', priority: 'Low', agent: 'Ines', updated: '2026-09-17', channel: 'Phone', replies: 1, reporter: 'ops@kestrel.example' },
    { ID: 4, subject: 'Price list rounds to two places', customer: 'Nordvik Marine', status: 'Resolved', priority: 'Normal', agent: 'Nadine', updated: '2026-09-15', channel: 'Email', replies: 6, reporter: 'buyer@nordvik.example' },
    { ID: 5, subject: 'Tax key wrong on credit notes', customer: 'Salzach Bau', status: 'Open', priority: 'High', agent: 'Owen', updated: '2026-09-14', channel: 'Portal', replies: 3, reporter: 'fibu@salzach.example' }
  ];
}

/** The fields of a contact list: few enough that no search box is needed. */
const CONTACT_FIELDS = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'email' },
  { id: 'phone', label: 'Phone', type: 'text' },
  { id: 'company', label: 'Company', type: 'entity' },
  { id: 'birthday', label: 'Birthday', type: 'date', visible: false },
  { id: 'vip', label: 'VIP', type: 'boolean', visible: false }
];

export default {
  title: 'View settings',
  group: 'Data',
  api: ['ViewSettings'],
  blurb: 'The content of a view-settings drawer: arrange and hide the shown fields, add a hidden one '
    + 'back, and choose grouping and the board’s columns and swim lanes.',

  examples: [
    {
      title: 'Fields, grouping, and board',
      blurb: 'Ten fields of mixed types, so the hidden ones get a search: type, then press Enter or '
        + 'Add. Drag a handle, or focus it and use the arrow keys, Home, and End; Space picks a row '
        + 'up and drops it, Escape puts it back. The title is locked: it has no handle and no hide '
        + 'button. Every event is logged below.',
      layout: 'stack',
      width: '24rem',
      render: ({ cleanup, log }) => {
        const settings = new ViewSettings(null, {
          fields: FIELDS,
          hiddenFields: ['probability', 'tags', 'website', 'contact'],
          groupBy: 'stage',
          board: { columnBy: 'stage', swimlaneBy: null, showEmptyColumns: true },
          onfieldorderchange: ({ detail }) => log(`fieldorderchange ${detail.order.join(', ')}`),
          onfieldvisibilitychange: ({ detail }) => log(`fieldvisibilitychange hidden: ${detail.hidden.join(', ') || '—'}`),
          ongroupchange: ({ detail }) => log(`groupchange ${detail.field ?? 'none'}`),
          onboardchange: ({ detail }) => log(`boardchange columns ${detail.board.columnBy}, lanes `
            + `${detail.board.swimlaneBy ?? 'none'}, empty ${detail.board.showEmptyColumns}`),
          onchange: ({ detail }) => log(`change (${detail.reason})`)
        });
        cleanup(() => settings.destroy());
        return settings.toElement();
      }
    },
    {
      title: 'In a sheet, bound to a table',
      blurb: 'bind() connects a record view: hiding a field or dragging it here changes the table at '
        + 'once, and a change the table makes itself comes back. Grouping and board settings are '
        + 'only reported — the application decides what its views do with them.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const table = new TableView(null, { fields: COLUMNS, data: tickets(), fieldControls: false });
        const settings = new ViewSettings(null, {
          fields: COLUMNS,
          board: false,
          onchange: ({ detail }) => log(`change (${detail.reason}) shown: `
            + `${detail.state.fieldOrder.filter((id) => !detail.state.hiddenFields.includes(id)).join(', ')}`)
        });
        settings.bind(table);
        const sheet = new Sheet(null, { title: 'View settings', size: 360, content: settings });
        const toolbar = new ListToolbar(null, {
          search: false,
          tools: [{ id: 'view', icon: 'settings', label: 'View' }],
          onaction: ({ detail }) => {
            if (detail.id === 'view') sheet.open();
          }
        });
        cleanup(() => [toolbar, sheet, settings, table].forEach((component) => component.destroy()));
        return [toolbar.toElement(), table.toElement()];
      }
    },
    {
      title: 'Fields only',
      blurb: 'With grouping: false and board: false only the field list remains, and with eight '
        + 'fields or fewer the hidden ones are listed without a search box.',
      layout: 'stack',
      width: '24rem',
      render: ({ cleanup, log }) => {
        const settings = new ViewSettings(null, {
          fields: CONTACT_FIELDS,
          grouping: false,
          board: false,
          onchange: ({ detail }) => log(`change (${detail.reason}) hidden: ${detail.state.hiddenFields.join(', ') || '—'}`)
        });
        cleanup(() => settings.destroy());
        return settings.toElement();
      }
    }
  ]
};
