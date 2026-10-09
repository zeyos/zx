import {
  AccountMenu, AppSidebar, Avatar, Dialog, FileItem, Form, MenuButton, Search, TreeView, badge, button,
  emptyState, formatDate, formatRelativeTime, h, uid
} from '../../src/index.js';
import {
  DATE, adaptiveShell, disposer, dot, iconButton, layoutContext, listTime, modShortcut, paneHeader, renderScope,
  sectionLabel, shortcuts, toaster, unavailable, workspaceHeader
} from './kit.js';
import { ME, NOW, company, person } from './fixtures.js';

/** The fixed mailboxes, and which messages each one shows. */
const MAILBOXES = [
  { id: 'inbox', label: 'Inbox', icon: 'inbox', match: (message) => message.box === 'inbox' },
  { id: 'assigned', label: 'Assigned to me', icon: 'circle-user', match: (message) => message.box === 'inbox' && message.assignee === ME },
  { id: 'sent', label: 'Sent', icon: 'paper-plane', match: (message) => message.box === 'sent' },
  { id: 'archive', label: 'Archive', icon: 'box-archive', match: (message) => message.box === 'archive' }
];

/**
 * The shared folders, nested. A folder lists the inbox conversations filed in it or in a folder
 * beneath it; archived ones are found under Archive.
 */
const FOLDERS = [
  { ID: 'customers', name: 'Customers', children: [{ ID: 'sales', name: 'Sales' }, { ID: 'support', name: 'Support' }] },
  { ID: 'projects', name: 'Projects', children: [{ ID: 'warehouse', name: 'Warehouse rollout' }, { ID: 'portal', name: 'Customer portal' }] }
];

/**
 * The conversations. `from` is a staff id or `client:<company id>`; `thread` holds each message
 * in order, oldest first, and the conversation sorts by its latest.
 */
const MESSAGES = [
  {
    id: 'm1', box: 'inbox', folder: 'sales', unread: true, subject: 'Renewal terms for next year',
    thread: [{ from: 'client:alpine', at: '2026-10-08T09:12', body: ['Hi Ines,', 'our renewal is due at the end of March. Could you hold the current rate for another twelve months if we bundle the extended SLA into the new term?', 'Procurement would like a draft by the end of October.', 'Best regards, Hannah'] }]
  },
  {
    id: 'm2', box: 'inbox', folder: 'sales', unread: true, assignee: 'ines', subject: 'Technical review for Meridian Health',
    thread: [{ from: 'piet', at: '2026-10-08T08:47', body: ['Meridian want a technical review before they sign. They asked about the API rate limits and whether patient data can stay in Switzerland.', 'Can you join on Tuesday at 14:00?'] }]
  },
  {
    id: 'm3', box: 'inbox', folder: 'support', unread: true, assignee: 'ines', subject: 'Kestrel hits the export limit',
    thread: [{ from: 'owen', at: '2026-10-07T16:20', body: ['Kestrel’s nightly export stops at the scheduled-job limit around 02:00. I raised their trial ceiling to 500 requests a minute for now.', 'Should we make that the default for paid plans?'] }]
  },
  {
    id: 'm4', box: 'inbox', folder: 'support', unread: false, subject: 'Pagination fix for the reporting API',
    thread: [
      { from: 'ines', to: 'camille', at: '2026-10-06T17:30', body: ['Two customers report duplicate rows when they page through large reports. Can you take a look?'] },
      { from: 'camille', at: '2026-10-07T11:05', body: ['Found it: the cursor skips ties on the sort column. The fix is ready for review and ships with Tuesday’s release.'], file: { name: 'pagination-fix.diff', size: 18432, mime: 'text/plain' } }
    ]
  },
  {
    id: 'm5', box: 'inbox', folder: 'warehouse', unread: false, assignee: 'ines', subject: 'Migration plan for sign-off',
    thread: [{ from: 'tobias', at: '2026-10-05T14:30', body: ['The migration plan for the last three depots is attached. I need your sign-off by Friday so procurement can order the scanners.'], file: { name: 'Migration plan.xlsx', size: 74120, mime: 'application/vnd.ms-excel' } }]
  },
  {
    id: 'm6', box: 'inbox', folder: 'warehouse', unread: false, subject: 'Cut-over weekend for the Munich depot',
    thread: [{ from: 'client:bruckner', at: '2026-10-05T09:10', body: ['Hello Ines,', 'the weekend of 24 October works for us. Our night shift will stay on the old system until Saturday 06:00.', 'Felix'] }]
  },
  {
    id: 'm7', box: 'inbox', folder: 'portal', unread: false, subject: 'Sign-in screens ready for review',
    thread: [{ from: 'marta', at: '2026-10-02T15:45', body: ['The new sign-in and password reset screens are ready. Comments by Wednesday, please.'] }]
  },
  {
    id: 'm8', box: 'inbox', folder: null, unread: false, assignee: 'ines', subject: 'Q3 invoices ready for approval',
    thread: [{ from: 'ruth', at: '2026-10-01T10:20', body: ['All 41 invoices for the third quarter are checked and waiting for your approval in the finance queue.'] }]
  },
  {
    id: 'm9', box: 'sent', folder: null, unread: false, subject: 'Stocktake schedule',
    thread: [{ from: 'ines', at: '2026-09-29T08:30', to: 'lea', body: ['Lea, can we move the stocktake to the last week of September? The auditors arrive on 2 October.'] }]
  },
  {
    id: 'm10', box: 'archive', folder: null, unread: false, subject: 'Stocktake finished',
    thread: [{ from: 'lea', at: '2026-09-25T17:10', body: ['The stocktake is done. Two pallets of scanners were miscounted in Hamburg; the numbers are corrected.'] }]
  },
  {
    id: 'm11', box: 'archive', folder: 'sales', unread: false, subject: 'Thank you for the workshop',
    thread: [{ from: 'client:atelier', at: '2026-09-22T12:00', body: ['Thanks again for the workshop last week. We will send our pricing questions shortly.', 'Sofia'] }]
  }
];

/**
 * Resolves a sender or recipient to a name, an address, and where they work.
 * @param {string} id A staff id, `client:<company id>`, or a plain address.
 * @returns {{name: string, email: string, org: string}}
 */
function contact(id) {
  if (id.startsWith('client:')) {
    const client = company(id.slice(7));
    return { name: client?.contact ?? '', email: client?.email ?? '', org: client?.name ?? '' };
  }
  const member = person(id);
  return member ? { name: member.name, email: member.email, org: member.role } : { name: id, email: id, org: '' };
}

/** @param {Record<string, any>} message @returns {Record<string, any>} The latest entry of its thread. */
function latest(message) {
  return message.thread[message.thread.length - 1];
}

/** @param {string} id Folder id. @returns {string[]} The folder and every folder beneath it. */
function folderFamily(id) {
  const node = FOLDERS.flatMap((entry) => [entry, ...(entry.children ?? [])]).find((entry) => entry.ID === id);
  return node ? [node.ID, ...(node.children ?? []).map((child) => child.ID)] : [id];
}

/** @param {Date} date @returns {string} The day bucket a list row is grouped under. */
function dayGroup(date) {
  const days = Math.floor((new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()).getTime()
    - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This week';
  return 'Earlier';
}

export default {
  title: 'Inbox',
  category: 'Pattern',
  blurb: 'Three panes for triage: mailboxes and folders, the conversations in one, and the open thread with a reply.',
  components: ['TreeView', 'Search', 'Form', 'Dialog', 'FileItem', 'MenuButton', 'Avatar', 'Message'],

  /**
   * Mounts the shared inbox: mailboxes and folders, the message list, and the reading pane.
   * @param {HTMLElement} container Gallery stage.
   * @param {import('./kit.js').LayoutContext} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const messages = MESSAGES.map((message) => ({ ...message, thread: message.thread.map((entry) => ({ ...entry })) }));
    const state = { scope: 'inbox', unreadOnly: false, query: '', open: 'm1', replying: false };
    // Components drawn for one rendering of a region are released when it is drawn again.
    const listParts = renderScope(context);
    const readerParts = renderScope(context);
    const dialogParts = renderScope(context);
    const root = h('div', { class: 'inbox shell' });
    // Narrow, the navigation becomes a drawer, and a phone shows the list or the open conversation.
    const shell = adaptiveShell(root, context, { backLabel: 'Back to messages' });

    // ----------------------------------------------------------------- navigation --

    const mailboxes = keep(new AppSidebar(null, {
      label: 'Mailboxes',
      collapsible: false,
      active: state.scope,
      items: mailboxItems()
    }));
    const folders = keep(new TreeView(null, {
      label: 'Folders',
      items: folderItems(),
      expanded: ['customers', 'projects'],
      icons: false,
      onselect: ({ detail }) => setScope(`folder:${detail.id}`)
    }));
    const account = keep(new AccountMenu(null, {
      account: { name: person(ME).name, secondary: person(ME).role, status: 'online' },
      items: [{ label: 'Preferences', value: 'prefs', icon: 'gear' }, '-', { label: 'Sign out', value: 'out' }],
      placement: 'top-start',
      onselect: ({ detail }) => notify(unavailable(detail.value === 'out' ? 'Signing out' : 'Preferences'), 'info')
    }));
    const nav = h('div', { class: 'shell__nav' },
      workspaceHeader(),
      h('div', { class: 'nav-action' }, button({
        label: 'New message', icon: 'pen-to-square', kind: 'primary', shortcut: { label: 'C', keys: 'C' },
        onclick: () => compose()
      })),
      h('div', { class: 'shell__body' },
        mailboxes.toElement(),
        sectionLabel('Folders', iconButton('folder-plus', 'New folder', () => {
          leaveNav();
          notify(unavailable('Creating folders'), 'info');
        })),
        h('div', { class: 'inbox__tree' }, folders.toElement())),
      h('div', { class: 'shell__footer' }, account.toElement()));

    // ----------------------------------------------------------------- list column --

    const search = keep(new Search(null, {
      placeholder: 'Search messages',
      debounce: 120,
      oninput: ({ detail }) => { state.query = detail.value; renderList(); },
      onclear: () => { state.query = ''; renderList(); }
    }));
    const filterButtons = [['all', 'All'], ['unread', 'Unread']].map(([id, label]) => h('button', {
      type: 'button', class: 'segmented__item', role: 'radio', dataset: { filter: id },
      onclick: () => { state.unreadOnly = id === 'unread'; renderList(); }
    }, label));
    const filter = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Show' }, filterButtons);
    filter.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      state.unreadOnly = !state.unreadOnly;
      renderList();
      filterButtons[state.unreadOnly ? 1 : 0].focus();
    }, { signal: context.signal });

    const listTitle = h('span');
    const listBody = h('div', { class: 'shell__body' });
    const list = h('section', { class: 'shell__list', 'aria-label': 'Messages' },
      paneHeader({ leading: shell.navToggle(), title: listTitle, actions: filter }),
      h('div', { class: 'shell__toolbar' }, search.toElement()),
      listBody);

    // ---------------------------------------------------------------- reading pane --

    // On a phone the header keeps its buttons and lets the count go.
    const position = h('span', { class: 'meta inbox__position', 'data-narrow': 'hide' });
    // Shown on a phone only, where the conversation replaces the list.
    const back = iconButton('arrow-left', 'Back to messages', () => showList(), { shortcut: { label: 'Esc', keys: 'Escape' } });
    back.classList.add('shell__back');
    const unreadButton = iconButton('envelope', 'Mark as unread', () => toggleUnread(), { shortcut: { label: 'U', keys: 'U' } });
    const archiveButton = iconButton('box-archive', 'Archive', () => archive(), { shortcut: { label: 'E', keys: 'E' } });
    const move = keep(new MenuButton(iconButton('folder', 'Move to folder'), {
      kind: 'ghost',
      placement: 'bottom-end',
      onselect: ({ detail }) => moveTo(String(detail.value))
    }));
    const more = keep(new MenuButton(iconButton('ellipsis', 'More actions'), {
      kind: 'ghost',
      placement: 'bottom-end',
      items: [
        { label: 'Forward', value: 'forward', icon: 'share' },
        { label: 'Print', value: 'print', icon: 'print' },
        '-',
        { label: 'Delete conversation', value: 'delete', icon: 'trash-can', danger: true }
      ],
      onselect: ({ detail }) => (detail.value === 'delete' ? remove()
        : notify(unavailable(detail.value === 'forward' ? 'Forwarding' : 'Printing'), 'info'))
    }));
    const replyButton = button({ label: 'Reply', icon: 'reply', shortcut: { label: 'R', keys: 'R' }, onclick: () => openReply() });
    const readerActions = h('div', { class: 'inbox__actions' }, archiveButton, unreadButton, move.toElement(), replyButton, more.toElement());
    const readerBody = h('div', { class: 'shell__body shell__body--padded', tabindex: '-1', 'aria-label': 'Conversation' });

    const replyText = h('textarea', {
      class: 'inbox__reply-input', rows: 5, placeholder: 'Write a reply…', 'aria-label': 'Reply',
      'aria-keyshortcuts': modShortcut('Enter').keys
    });
    const replyTo = h('span', { class: 'meta' });
    const sendButton = button({ label: 'Send', icon: 'paper-plane', kind: 'primary', shortcut: modShortcut('Enter', '↵'), onclick: () => sendReply() });
    const composer = h('section', { class: 'surface inbox__composer', 'aria-label': 'Reply' },
      replyTo, replyText,
      h('div', { class: 'inbox__composer-actions' },
        button({ label: 'Discard', kind: 'ghost', onclick: () => closeReply() }), sendButton));
    shortcuts(replyText, { 'Mod+Enter': () => sendReply() }, context);
    // Single keys are the text's own, so the layout's Escape never sees one typed here: the reply
    // closes from its text as well, keeping what was written.
    replyText.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || event.isComposing) return;
      event.preventDefault();
      closeReply();
    }, { signal: context.signal });

    const main = h('section', { class: 'shell__main', 'aria-label': 'Reading pane' },
      paneHeader({
        leading: [
          shell.navToggle(),
          back,
          iconButton('angle-up', 'Previous message', () => step(-1), { shortcut: { label: 'K', keys: 'K' } }),
          iconButton('angle-down', 'Next message', () => step(1), { shortcut: { label: 'J', keys: 'J' } }),
          position
        ],
        actions: readerActions
      }),
      readerBody);

    root.append(nav, list, main);
    const notify = toaster(context, root);

    shortcuts(root, {
      j: () => step(1),
      k: () => step(-1),
      e: () => archive(),
      u: () => toggleUnread(),
      r: () => openReply(),
      c: () => compose(),
      '/': () => search.focus(),
      // Escape closes the reply first, then on a phone goes back to the list; with nothing to
      // close it is not ours.
      Escape: () => {
        if (state.replying) closeReply();
        else if (shell.single() && shell.pane() === 'main') showList();
        else return false;
      }
    }, context);

    renderList();
    openMessage(state.open, { markRead: false });
    container.append(root);

    // -------------------------------------------------------------------- scopes --

    /** @returns {Array<Record<string, any>>} The mailboxes, with their unread counts. */
    function mailboxItems() {
      return MAILBOXES.map((box) => {
        const unread = messages.filter((message) => box.match(message) && message.unread).length;
        return { id: box.id, label: box.label, icon: box.icon, badge: box.id === 'sent' ? undefined : unread || undefined, invoke: () => setScope(box.id) };
      });
    }

    /** @returns {Array<Record<string, any>>} The folder tree, with unread counts. */
    function folderItems() {
      const count = (id) => messages.filter((message) => message.box === 'inbox' && message.unread
        && folderFamily(id).includes(message.folder)).length || undefined;
      return FOLDERS.map((entry) => ({
        ...entry, badge: count(entry.ID), children: entry.children.map((child) => ({ ...child, badge: count(child.ID) }))
      }));
    }

    /** Refreshes every unread count in the navigation. @returns {void} */
    function updateCounts() {
      mailboxes.setItems(mailboxItems());
      folders.setItems(folderItems());
      if (state.scope.startsWith('folder:')) folders.setSelection([state.scope.slice(7)]);
    }

    /**
     * Shows a mailbox or a folder in the list. One selection lives across both navigations.
     * @param {string} scope A mailbox id or `folder:<id>`.
     * @returns {void}
     */
    function setScope(scope) {
      const fromDrawer = leaveNav();
      state.scope = scope;
      const inFolder = scope.startsWith('folder:');
      mailboxes.setActive(inFolder ? null : scope);
      if (!inFolder) folders.clearSelection();
      renderList();
      const first = visible()[0];
      if (first) openMessage(first.id);
      else showEmpty();
      listBody.scrollTop = 0;
      // A new mailbox starts at its list, wherever a phone was before.
      shell.show('list', { focus: false });
      if (fromDrawer) focusList();
    }

    /**
     * Closes the navigation drawer, if it is open, before a choice made in it moves the focus:
     * the other columns are inert while it is open, so nothing in them could take the focus.
     * @returns {boolean} Whether it was open.
     */
    function leaveNav() {
      if (root.dataset.navOpen !== 'true') return false;
      shell.closeNav();
      return true;
    }

    /** Puts the focus on the open conversation's row, the first row, or the list's title. @returns {void} */
    function focusList() {
      const target = listBody.querySelector('[aria-current="true"]') ?? listBody.querySelector('button');
      if (target instanceof HTMLElement) {
        target.focus();
        return;
      }
      // An empty list: its title says where the focus is, without raising a phone's keyboard.
      const title = list.querySelector('.shell__title');
      if (title instanceof HTMLElement) {
        title.tabIndex = -1;
        title.focus();
      }
    }

    /** On a phone, goes back from the conversation to the list, onto its row. @returns {void} */
    function showList() {
      shell.show('list', { focus: false });
      focusList();
    }

    /**
     * Shortcuts listen on the layout's root, so a redraw or a vanished button must never leave the
     * focus on the page body: it goes to the conversation's subject when that pane is showing on
     * its own, and to the list otherwise.
     * @returns {void}
     */
    function keepFocus() {
      const active = document.activeElement;
      const lost = !active || active === document.body || (root.contains(active) && !active.checkVisibility());
      if (context.preview || !lost) return;
      const subject = readerBody.querySelector('h2');
      if (shell.single() && shell.pane() === 'main' && subject instanceof HTMLElement) {
        subject.tabIndex = -1;
        subject.focus();
      } else {
        focusList();
      }
    }

    /** @returns {{label: string, match: (message: Record<string, any>) => boolean}} The current scope. */
    function scopeOf() {
      if (state.scope.startsWith('folder:')) {
        const id = state.scope.slice(7);
        const family = folderFamily(id);
        const node = FOLDERS.flatMap((entry) => [entry, ...entry.children]).find((entry) => entry.ID === id);
        return { label: node?.name ?? 'Folder', match: (message) => message.box === 'inbox' && family.includes(message.folder) };
      }
      return MAILBOXES.find((box) => box.id === state.scope) ?? MAILBOXES[0];
    }

    // ---------------------------------------------------------------------- list --

    /** @returns {Record<string, any>[]} The conversations in scope, newest first, filtered. */
    function visible() {
      const scope = scopeOf();
      const needle = state.query.trim().toLowerCase();
      return messages
        .filter((message) => scope.match(message) && (!state.unreadOnly || message.unread))
        .filter((message) => !needle || [message.subject, ...message.thread.flatMap((entry) => [contact(entry.from).name, ...entry.body])]
          .join(' ').toLowerCase().includes(needle))
        .sort((a, b) => latest(b).at.localeCompare(latest(a).at));
    }

    /** Redraws the list, grouped by day, and marks the open conversation. @returns {void} */
    function renderList() {
      listParts.reset();
      const rows = visible();
      listTitle.textContent = scopeOf().label;
      for (const item of filterButtons) {
        const checked = (item.dataset.filter === 'unread') === state.unreadOnly;
        item.setAttribute('aria-checked', String(checked));
        item.tabIndex = checked ? 0 : -1;
      }
      // Redrawing replaces the rows; focus that was on one follows the open row.
      const hadFocus = listBody.contains(document.activeElement);
      let group = '';
      listBody.replaceChildren(...(rows.length ? rows.flatMap((message) => {
        const label = dayGroup(new Date(latest(message).at));
        const heading = label === group ? [] : [h('div', { class: 'list-group' }, label)];
        group = label;
        return [...heading, listRow(message)];
      }) : [emptyState({
        icon: state.query || state.unreadOnly ? 'filter' : 'inbox', size: 'sm',
        title: state.query || state.unreadOnly ? 'No messages match' : 'Nothing here',
        description: state.query || state.unreadOnly ? 'Clear the search or show all messages.' : 'Messages filed here will show up in this list.'
      })]));
      updatePosition();
      if (hadFocus) listBody.querySelector('[aria-current="true"]')?.focus();
    }

    /**
     * One conversation in the list: who wrote last, the subject, and the start of the message.
     * @param {Record<string, any>} message
     * @returns {HTMLElement}
     */
    function listRow(message) {
      const entry = latest(message);
      const sender = message.box === 'sent' ? contact(entry.to ?? ME) : contact(entry.from);
      return h('button', {
        type: 'button', class: 'list-row inbox__row',
        'aria-current': message.id === state.open ? 'true' : null,
        dataset: { id: message.id, unread: message.unread ? '' : null },
        onclick: () => {
          openMessage(message.id);
          shell.show('main');
        }
      },
      listParts.own(new Avatar(null, { name: sender.name, size: 'sm' })).toElement(),
      h('span', { class: 'list-row__top' },
        message.unread ? dot('accent') : null,
        h('span', { class: 'list-row__title' }, message.box === 'sent' ? `To ${sender.name}` : sender.name),
        message.thread.length > 1 ? h('span', { class: 'inbox__count' }, String(message.thread.length)) : null,
        h('span', { class: 'list-row__meta' }, listTime(entry.at))),
      h('span', { class: 'inbox__subject' }, message.subject),
      h('span', { class: 'list-row__snippet' }, entry.body.join(' ')),
      message.unread ? h('span', { class: 'visually-hidden' }, 'Unread') : null);
    }

    /** Shows "2 of 7" beside the previous and next buttons. @returns {void} */
    function updatePosition() {
      const rows = visible();
      const index = rows.findIndex((message) => message.id === state.open);
      position.textContent = index === -1 ? '' : `${index + 1} of ${rows.length}`;
    }

    // -------------------------------------------------------------- reading pane --

    /** @returns {Record<string, any>|undefined} The open conversation. */
    function current() {
      return messages.find((message) => message.id === state.open);
    }

    /**
     * Opens a conversation in the reading pane and marks it read.
     * @param {string} id
     * @param {{markRead?: boolean}} [options] A thumbnail shows the first state as it is.
     * @returns {void}
     */
    function openMessage(id, { markRead = !context.preview } = {}) {
      const message = messages.find((entry) => entry.id === id);
      if (!message) return;
      state.open = id;
      state.replying = false;
      if (markRead && message.unread) {
        message.unread = false;
        updateCounts();
      }
      renderList();
      renderReader();
    }

    /** Draws the open conversation: subject, its messages, and the reply composer. @returns {void} */
    function renderReader() {
      readerParts.reset();
      const message = current();
      if (!message) {
        showEmpty();
        return;
      }
      readerActions.hidden = false;
      const folder = message.folder ? FOLDERS.flatMap((entry) => [entry, ...entry.children]).find((entry) => entry.ID === message.folder) : null;
      unreadButton.setAttribute('aria-label', message.unread ? 'Mark as read' : 'Mark as unread');
      unreadButton.title = `${message.unread ? 'Mark as read' : 'Mark as unread'} (U)`;
      archiveButton.disabled = message.box !== 'inbox';
      move.setItems(FOLDERS.flatMap((entry) => [entry, ...entry.children]).map((entry) => ({
        label: entry.name, value: entry.ID, icon: 'folder', disabled: entry.ID === message.folder
      })));
      const assignee = message.assignee ? person(message.assignee) : null;
      replyTo.textContent = `To ${contact(latest(message).from === ME ? latest(message).to ?? ME : latest(message).from).name}`;
      readerBody.replaceChildren(h('article', { class: 'inbox__thread' },
        h('header', { class: 'inbox__thread-head' },
          h('h2', { class: 'record-title record-title--sm' }, message.subject),
          h('p', { class: 'inbox__thread-meta' },
            folder ? badge({ label: folder.name, tone: 'slate', size: 'sm', icon: 'folder' }) : null,
            assignee ? h('span', {}, `Assigned to ${assignee.id === ME ? 'you' : assignee.name}`) : null,
            h('span', {}, `${message.thread.length} ${message.thread.length === 1 ? 'message' : 'messages'}`))),
        ...message.thread.map((entry) => messageCard(entry)),
        state.replying ? composer : null));
      readerBody.scrollTop = 0;
      keepFocus();
    }

    /**
     * One message of a thread: sender, time, body, and its attachment.
     * @param {Record<string, any>} entry
     * @returns {HTMLElement}
     */
    function messageCard(entry) {
      const sender = contact(entry.from);
      const at = new Date(entry.at);
      return h('section', { class: 'inbox__message', 'aria-label': `Message from ${sender.name}` },
        h('header', { class: 'inbox__message-head' },
          readerParts.own(new Avatar(null, { name: sender.name, size: 'md' })).toElement(),
          h('div', { class: 'inbox__sender' },
            h('span', { class: 'inbox__sender-name' }, entry.from === ME ? 'You' : sender.name),
            h('span', { class: 'meta' }, entry.from === ME ? `to ${contact(entry.to ?? ME).name}` : `${sender.email} · ${sender.org}`)),
          h('time', { class: 'meta inbox__time', datetime: at.toISOString() },
            `${formatDate(at, DATE.dateTime)} · ${formatRelativeTime(at, { now: NOW })}`)),
        h('div', { class: 'inbox__body' }, entry.body.map((text) => h('p', {}, text))),
        entry.file ? readerParts.own(new FileItem(null, {
          id: entry.file.name, name: entry.file.name, size: entry.file.size, mime: entry.file.mime,
          actions: [{ id: 'download', label: 'Download', icon: 'download', onselect: () => notify(unavailable('Downloading'), 'info') }]
        })).toElement() : null);
    }

    /** The reading pane when nothing is open. @returns {void} */
    function showEmpty() {
      readerParts.reset();
      state.open = null;
      readerActions.hidden = true;
      position.textContent = '';
      readerBody.replaceChildren(emptyState({ icon: 'envelope-open', title: 'No conversation selected', description: 'Pick a message from the list to read it here.' }));
      // Nothing left to read: a phone goes back to the list.
      if (shell.single()) shell.show('list', { focus: false });
      keepFocus();
    }

    /** @param {1|-1} direction @returns {void} Opens the next or previous conversation. */
    function step(direction) {
      const rows = visible();
      if (rows.length === 0) return;
      const index = rows.findIndex((message) => message.id === state.open);
      const next = rows[Math.min(rows.length - 1, Math.max(0, index + direction))];
      openMessage(next.id);
      if (!context.preview) listBody.querySelector(`[data-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' });
    }

    /** Marks the open conversation unread, or read again. @returns {void} */
    function toggleUnread() {
      const message = current();
      if (!message) return;
      message.unread = !message.unread;
      updateCounts();
      renderList();
      renderReader();
      notify(message.unread ? 'Marked as unread.' : 'Marked as read.', 'info');
    }

    /**
     * Moves the open conversation out of the list and opens the next one.
     * @param {(message: Record<string, any>) => void} change What happens to it.
     * @returns {void}
     */
    function takeOut(change) {
      const message = current();
      const rows = visible();
      const index = rows.indexOf(message);
      change(message);
      updateCounts();
      renderList();
      const next = visible()[Math.min(index, visible().length - 1)];
      if (next) openMessage(next.id);
      else showEmpty();
    }

    /** Archives the open conversation, with a way back. @returns {void} */
    function archive() {
      const message = current();
      if (!message || message.box !== 'inbox') return;
      takeOut((entry) => { entry.box = 'archive'; entry.unread = false; });
      notify(h('span', { class: 'toast-action' }, 'Conversation archived.',
        h('button', { type: 'button', class: 'link-button', onclick: () => { message.box = 'inbox'; updateCounts(); renderList(); } }, 'Undo')), 'info');
    }

    /** @param {string} folder Folder id. @returns {void} Files the open conversation elsewhere. */
    function moveTo(folder) {
      const message = current();
      if (!message) return;
      const name = FOLDERS.flatMap((entry) => [entry, ...entry.children]).find((entry) => entry.ID === folder)?.name;
      if (scopeOf().match({ ...message, folder })) {
        message.folder = folder;
        updateCounts();
        renderReader();
      } else {
        takeOut((entry) => { entry.folder = folder; });
      }
      notify(`Moved to ${name}.`);
    }

    /** Deletes the open conversation once confirmed. @returns {Promise<void>} */
    async function remove() {
      const message = current();
      if (!message) return;
      const confirmed = await Dialog.confirm({
        title: 'Delete this conversation?',
        message: `“${message.subject}” and its ${message.thread.length === 1 ? 'message' : `${message.thread.length} messages`} are deleted for everyone in the team.`,
        okLabel: 'Delete conversation',
        danger: true
      });
      if (!confirmed) return;
      takeOut((entry) => { messages.splice(messages.indexOf(entry), 1); });
      notify('Conversation deleted.');
    }

    // --------------------------------------------------------------------- reply --

    /** Opens the reply composer under the thread. @returns {void} */
    function openReply() {
      if (!current() || context.preview) return;
      state.replying = true;
      renderReader();
      readerBody.scrollTop = readerBody.scrollHeight;
      replyText.focus();
    }

    /** Closes the composer, keeping what was written for next time. @returns {void} */
    function closeReply() {
      state.replying = false;
      composer.remove();
      replyButton.focus();
    }

    /** Sends the reply: it joins the thread, and the conversation moves to the top. @returns {void} */
    function sendReply() {
      const message = current();
      const text = replyText.value.trim();
      if (!message || !text) {
        replyText.focus();
        return;
      }
      const last = latest(message);
      message.thread.push({
        from: ME, to: last.from === ME ? last.to : last.from, at: formatDate(NOW, '%Y-%m-%dT%H:%M'),
        body: text.split(/\n{2,}/)
      });
      replyText.value = '';
      state.replying = false;
      renderList();
      renderReader();
      notify('Reply sent.');
    }

    /** Writes a new message in a dialog; sending files it under Sent. @returns {void} */
    function compose() {
      if (context.preview) return;
      // From the navigation drawer: close it first, so the dialog hands the focus back to its toggle.
      leaveNav();
      const form = dialogParts.own(new Form(null, {
        fieldsets: [{ fields: {
          to: { type: 'text', label: 'To', required: true, placeholder: 'name@company.example' },
          subject: { type: 'text', label: 'Subject', required: true },
          body: { type: 'textarea', label: 'Message', props: { rows: 6 } }
        } }]
      }));
      const dialog = dialogParts.own(new Dialog(null, {
        title: 'New message',
        content: h('div', { class: 'form-sheet' }, form.toElement()),
        buttons: [{ label: 'Cancel', action: 'cancel' }, { label: 'Send', kind: 'primary', action: () => form.submit() }]
      }));
      form.on('submit', ({ detail }) => {
        messages.push({
          id: uid('message'), box: 'sent', folder: null, unread: false, subject: detail.values.subject,
          thread: [{ from: ME, to: detail.values.to.trim(), at: formatDate(NOW, '%Y-%m-%dT%H:%M'), body: [detail.values.body || ''] }]
        });
        dialog.close();
        if (state.scope === 'sent') renderList();
        notify(`Message to ${detail.values.to} sent.`);
      });
      dialog.on('close', () => dialogParts.reset());
      dialog.open();
    }
  }
};
