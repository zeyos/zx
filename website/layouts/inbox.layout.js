import { MasterPanel, Message, Search, Table, TreeView, button, h } from '../../src/index.js';

const FOLDERS = [
  {
    ID: 'inbox',
    name: 'Inbox',
    badge: 4,
    children: [
      { ID: 'inbox-sales', name: 'Sales', badge: 2 },
      { ID: 'inbox-support', name: 'Support', badge: 2 }
    ]
  },
  { ID: 'assigned', name: 'Assigned to me', badge: 3 },
  { ID: 'sent', name: 'Sent' },
  {
    ID: 'projects',
    name: 'Projects',
    children: [
      { ID: 'p-warehouse', name: 'Warehouse rollout' },
      { ID: 'p-portal', name: 'Customer portal' }
    ]
  },
  { ID: 'archive', name: 'Archive' }
];

const MESSAGES = [
  { ID: 1, folder: 'inbox-sales', from: 'Nadine Roth', subject: 'Renewal terms for Alpine Works', received: '09:12', unread: true, body: 'Alpine Works asked whether we can hold the current rate for another twelve months. Their renewal is due in March and they want the extended SLA bundled in.' },
  { ID: 2, folder: 'inbox-sales', from: 'Piet Vermeer', subject: 'Technical review — Northstar', received: '08:47', unread: true, body: 'Northstar would like a technical review before signing. They asked specifically about the API rate limits and the on-premise option.' },
  { ID: 3, folder: 'inbox-support', from: 'Camille Fournier', subject: 'Two open tickets on the reporting API', received: 'Yesterday', unread: true, body: 'Both tickets are about the same pagination edge case. I have a reproduction and a suggested fix.' },
  { ID: 4, folder: 'inbox-support', from: 'Owen Blythe', subject: 'Rate limit questions', received: 'Yesterday', unread: true, body: 'Kestrel is hitting the limit during their nightly export. Can we raise the ceiling for scheduled jobs?' },
  { ID: 5, folder: 'assigned', from: 'Tobias Kern', subject: 'Warehouse rollout — migration plan', received: 'Monday', unread: false, body: 'The migration plan is attached. I need sign-off before the end of the week so procurement can start.' },
  { ID: 6, folder: 'assigned', from: 'Ines Bauer', subject: 'Dispatch tool decommissioning', received: 'Monday', unread: false, body: 'We can shut the legacy dispatch tool down once the last three depots are migrated.' },
  { ID: 7, folder: 'assigned', from: 'Marta Silva', subject: 'Pricing for twelve seats', received: 'Friday', unread: false, body: 'Helios asked for a twelve-seat quote with the annual discount applied.' },
  { ID: 8, folder: 'sent', from: 'You', subject: 'Q2 summary sent to Finance', received: 'Friday', unread: false, body: 'Sent the Q2 summary over. No action needed.' },
  { ID: 9, folder: 'p-warehouse', from: 'Tobias Kern', subject: 'Floorplan revision 3', received: '2 Aug', unread: false, body: 'Revision 3 moves the packing stations to the north wall.' },
  { ID: 10, folder: 'archive', from: 'Ruth Salzmann', subject: 'Closed: onboarding questions', received: '12 Jul', unread: false, body: 'Everything resolved, closing this thread.' }
];

export default {
  title: 'Inbox (three panes)',
  group: 'Applications',
  blurb: 'The classic triage screen: a folder tree, a list of what is in the selected folder, and '
    + 'a reading pane — each pane keeping its own scroll.',

  /**
   * Mounts a three-pane inbox built from TreeView, Table, and a reading pane.
   * @param {HTMLElement} container Documentation stage.
   * @returns {void}
   */
  mount(container) {
    const messages = MESSAGES.map((message) => ({ ...message }));
    let folder = 'inbox-sales';
    let query = '';

    const folders = new TreeView(null, {
      items: FOLDERS,
      expanded: ['inbox'],
      selected: [folder],
      icons: false,
      onselect: (event) => {
        folder = event.detail.id;
        renderList();
      }
    });

    const list = new Table(null, {
      columns: [
        {
          id: 'from',
          label: 'From',
          sortable: true,
          width: '1.2fr',
          render: (row) => h('span', { style: { fontWeight: row.unread ? '650' : '400' } }, row.from)
        },
        {
          id: 'subject',
          label: 'Subject',
          sortable: true,
          width: '2fr',
          render: (row) => h('span', { style: { fontWeight: row.unread ? '650' : '400' } }, row.subject)
        },
        { id: 'received', label: 'Received', sortable: true, align: 'end', width: '0.8fr' }
      ],
      data: [],
      rowId: 'ID',
      sortMode: 'local',
      selectable: 'single',
      stickyHeader: true,
      emptyText: 'Nothing in this folder.',
      onrowclick: (event) => openMessage(event.detail.row)
    });

    const search = new Search(null, {
      placeholder: 'Search this folder',
      oninput: (event) => {
        query = event.detail.value;
        renderList();
      },
      onclear: () => {
        query = '';
        renderList();
      }
    });

    const reader = h('div', { class: 'reader' });
    const counter = h('span', { class: 'layout-hint' });

    const shell = new MasterPanel(null, {
      title: 'Messages',
      module: 'messages',
      content: h('div', { class: 'inbox' },
        h('div', { class: 'inbox__folders' }, folders.toElement()),
        h('div', { class: 'inbox__list' },
          h('div', { class: 'layout-toolbar' }, search.toElement(),
            h('span', { class: 'layout-toolbar__spacer' }), counter),
          list.toElement()),
        h('div', { class: 'inbox__reader' }, reader)),
      buttons: [
        {
          label: 'Compose',
          icon: 'plus',
          kind: 'primary',
          onclick: () => Message.info('A compose dialog would open here.')
        },
        { label: 'Refresh', icon: 'reload', onclick: () => renderList() }
      ],
      footer: 'Three panes · folder tree, message list, reading pane'
    });

    container.append(h('div', { class: 'layout-frame' }, shell.toElement()));
    renderList();
    showEmptyReader();

    /** Refills the message list from the selected folder and the search text. @returns {void} */
    function renderList() {
      const needle = query.trim().toLocaleLowerCase();
      const rows = messages.filter((message) => {
        if (message.folder !== folder) return false;
        if (needle === '') return true;
        return `${message.from} ${message.subject} ${message.body}`
          .toLocaleLowerCase().includes(needle);
      });
      list.setData(rows);
      const unread = rows.filter((row) => row.unread).length;
      counter.textContent = `${rows.length} message${rows.length === 1 ? '' : 's'}`
        + (unread > 0 ? ` · ${unread} unread` : '');
    }

    /**
     * Renders one message into the reading pane and marks it read.
     * @param {Record<string, unknown>} message Message row.
     * @returns {void}
     */
    function openMessage(message) {
      if (message.unread) {
        message.unread = false;
        list.updateRow(message.ID, message);
        renderList();
        list.setSelection([message.ID]);
      }
      reader.replaceChildren(
        h('header', { class: 'reader__head' },
          h('h2', { class: 'reader__subject' }, message.subject),
          h('p', { class: 'layout-hint' }, `${message.from} · ${message.received}`)),
        h('p', { class: 'reader__body' }, message.body),
        h('div', { class: 'layout-toolbar' },
          button({
            label: 'Reply',
            kind: 'primary',
            icon: 'chevron-left',
            onclick: () => Message.success(`Reply to ${message.from} drafted.`)
          }),
          button({
            label: 'Archive',
            icon: 'check',
            onclick: () => {
              message.folder = 'archive';
              renderList();
              showEmptyReader();
              Message.info('Moved to Archive.');
            }
          }))
      );
    }

    /** @returns {void} */
    function showEmptyReader() {
      reader.replaceChildren(h('div', { class: 'layout-empty' },
        h('p', {}, 'Select a message to read it here.')));
    }
  }
};
