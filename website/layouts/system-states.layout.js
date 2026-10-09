import {
  AccountMenu, AppSidebar, Avatar, CardView, Dialog, Field, InlineLoading, KanbanView, Message, Search, Table,
  Toggle, badge, button, emptyState, formatDate, h, icon, setButtonBusy, skeleton, skeletonTable, skeletonText, uid
} from '../../src/index.js';
import {
  DATE, adaptiveShell, allowsMotion, disposer, iconButton, iconTile, later, layoutContext, paneHeader, propList,
  sectionLabel, shortcutSheet, shortcuts, toaster, unavailable, workspaceHeader
} from './kit.js';
import { ME, company, person } from './fixtures.js';

/** The workspace's own sections. None of them is built here: this page is about states. */
const WORKSPACE = [
  { id: 'home', label: 'Home', icon: 'house' },
  { id: 'projects', label: 'Projects', icon: 'folder' },
  { id: 'tasks', label: 'My tasks', icon: 'square-check-regular' },
  { id: 'inbox', label: 'Inbox', icon: 'inbox' },
  { id: 'reports', label: 'Reports', icon: 'chart-column' }
];

/** The groups of states on this page, in order. The navigation and the number keys jump to them. */
const GROUPS = [
  { id: 'empty', label: 'Empty', icon: 'folder-open', blurb: 'What a view says before it has anything in it, and the next step when there is one.' },
  { id: 'loading', label: 'Loading', icon: 'hourglass-half', blurb: 'Placeholders shaped like the content on its way, and progress on the control that started it.' },
  { id: 'errors', label: 'Errors', icon: 'triangle-exclamation', blurb: 'What went wrong, whether anything was lost, and what to do next.' },
  { id: 'validation', label: 'Form validation', icon: 'pen-to-square', blurb: 'Errors at the field, in words that say how to fix them.' },
  { id: 'confirm', label: 'Confirmations', icon: 'circle-check-regular', blurb: 'A pause before anything that can’t be undone.' }
];

/** The projects the search and the loaded cards show. */
const PROJECTS = [
  { ID: 'warehouse', name: 'Warehouse rollout', company: 'bruckner', tasks: 24, due: '2026-11-02' },
  { ID: 'portal', name: 'Patient portal', company: 'meridian', tasks: 17, due: '2026-11-20' },
  { ID: 'grid', name: 'Grid monitoring', company: 'helios', tasks: 9, due: '2026-12-11' },
  { ID: 'brand', name: 'Brand refresh', company: 'atelier', tasks: 12, due: '2026-12-18' }
];

/** Tasks of the warehouse rollout: the loaded table and the loaded board column. */
const TASKS = [
  { key: 'WH-12', title: 'Order scanners', owner: 'tobias', due: '2026-10-14', status: 'doing' },
  { key: 'WH-13', title: 'Map picking routes', owner: 'lea', due: '2026-10-16', status: 'doing' },
  { key: 'WH-15', title: 'Train night shift', owner: 'ines', due: '2026-10-21', status: 'doing' },
  { key: 'WH-18', title: 'Retire terminals', owner: 'jonas', due: '2026-10-30', status: 'todo' }
];

/** Project codes the server already knows, for the validation that only the server can do. */
const TAKEN_CODES = ['WH-01', 'AW-01', 'OPS-1'];

/** How long the example's requests take, in milliseconds. */
const DELAY = { load: 1600, save: 900, check: 600, retry: 900 };

/** Keyboard reference, grouped as the help dialog shows it. `Mod` is ⌘ on macOS, Ctrl elsewhere. */
const SHORTCUTS = [
  ['Page', [['Simulate offline', 'O'], ['Replay loading', 'R'], ['Keyboard shortcuts', '?']]],
  ['Go to', GROUPS.map((group, index) => [group.label, String(index + 1)])],
  ['Layout', [['Show or hide navigation', 'Mod+B']]]
];

/** @param {string} iso Local date. @returns {Date} Noon that day, so no time zone moves it. */
function noon(iso) {
  return new Date(`${iso}T12:00:00`);
}

/** @param {string} id @returns {string} A person's full name. */
function nameOf(id) {
  return person(id)?.name ?? '';
}

export default {
  title: 'System states',
  category: 'Pattern',
  blurb: 'Every empty, loading, error, and confirmation state an application needs, side by side, with a switch to go offline.',
  components: [
    'EmptyState', 'Skeleton', 'Table', 'CardView', 'KanbanView', 'InlineLoading', 'Spinner', 'Message', 'Dialog',
    'Field', 'Toggle', 'Search', 'AppSidebar', 'AccountMenu', 'Avatar', 'Badge'
  ],

  /**
   * Mounts the states page: the workspace navigation, and one card per state in five groups, with a
   * switch in the header that takes the whole page offline.
   * @param {HTMLElement} container Gallery stage.
   * @param {import('./kit.js').LayoutContext} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const { preview } = context;
    const root = h('div', { class: 'states shell' });
    // Narrow, the navigation becomes a drawer opened from the page header.
    const shell = adaptiveShell(root, context, { keys: true });
    const notify = toaster(context, root);
    const openHelp = shortcutSheet(context, SHORTCUTS);

    const state = { offline: false };
    /** @type {{control: HTMLButtonElement, reason: HTMLElement}[]} Actions that need the network. */
    const networked = [];
    /** @type {Map<HTMLButtonElement, () => void>} Pending work behind each busy button. */
    const busy = new Map();
    /** @type {((loaded: boolean) => void)[]} Each loading example, drawn loading or loaded. */
    const loaders = [];
    let cancelLoad = () => {};

    /* ------------------------------------------------------------ navigation column -- */

    const workspace = keep(new AppSidebar(null, {
      label: 'Workspace', collapsible: false,
      items: WORKSPACE.map((item) => ({ ...item, invoke: () => notify(unavailable(item.label), 'info') }))
    }));
    const contents = keep(new AppSidebar(null, {
      label: 'On this page', collapsible: false, active: GROUPS[0].id,
      items: GROUPS.map((group) => ({ id: group.id, label: group.label, icon: group.icon, invoke: () => jump(group.id) }))
    }));
    const account = keep(new AccountMenu(null, {
      account: accountIdentity(),
      placement: 'top-start',
      items: [
        { label: 'Keyboard shortcuts', icon: 'keyboard', onselect: () => openHelp() },
        '-',
        { label: 'Sign out', icon: 'power-off', onselect: () => notify(unavailable('Signing out'), 'info') }
      ]
    }));
    const nav = h('div', { class: 'shell__nav' },
      workspaceHeader(),
      h('div', { class: 'shell__body' },
        workspace.toElement(),
        sectionLabel('On this page'),
        contents.toElement()),
      h('div', { class: 'shell__footer' }, account.toElement()));

    /* ----------------------------------------------------------------------- header -- */

    const offline = keep(new Toggle(null, {
      label: 'Simulate offline',
      onchange: ({ detail }) => setOffline(detail.checked)
    }));
    offline.el.classList.add('states__offline');
    offline.el.setAttribute('aria-keyshortcuts', 'O');
    offline.el.title = 'Simulate offline (O)';
    const help = iconButton('keyboard', 'Keyboard shortcuts', () => openHelp(), { shortcut: { label: '?', keys: '?' } });
    // On a phone the help button gives way; `?` and the account menu still open the reference.
    help.dataset.narrow = 'hide';

    // The page's offline banner: an inline message region, shown only while the page is offline.
    const bannerHost = h('div', { class: 'states__banner', hidden: true });
    const banner = keep(new Message(bannerHost, { closable: false, timeout: 0 }));
    let bannerHandle = /** @type {{close: () => void}|null} */ (null);

    /* ------------------------------------------------------------------- empty states -- */

    const newProject = button({ label: 'New project', icon: 'plus', kind: 'primary', onclick: () => notify(unavailable('Creating a project'), 'info') });
    const addTask = button({ label: 'Add task', icon: 'plus', onclick: () => notify(unavailable('Adding a task'), 'info') });

    const search = keep(new Search(null, {
      placeholder: 'Search projects', value: 'quarterly audit', debounce: 120,
      oninput: ({ detail }) => renderResults(detail.value)
    }));
    const results = h('div', { class: 'states__results' });

    const emptyCards = [
      card({
        title: 'First use',
        when: 'Nothing created yet: say what belongs here and offer to create it.',
        wide: true,
        stage: emptyState({
          icon: 'folder-plus', size: 'sm', title: 'No projects yet',
          description: 'Projects keep the tasks, files, and hours for one piece of work together.',
          actions: needsNetwork(newProject)
        })
      }),
      card({
        title: 'Empty list',
        when: 'A list that can be filled from where it is.',
        stage: emptyState({
          icon: 'square-check-regular', size: 'sm', title: 'No tasks in this list',
          description: 'Tasks you add here, or that are assigned to you, show up in this list.',
          actions: [addTask]
        })
      }),
      card({
        title: 'Nothing to do',
        when: 'Everything is done, so there is nothing to press.',
        stage: emptyState({
          icon: 'circle-check-regular', size: 'sm', title: 'You’re all caught up',
          description: 'New mentions, assignments, and approvals will appear here.'
        })
      }),
      card({
        title: 'No results',
        when: 'A search that matched nothing, with the way back to everything.',
        stage: [search.toElement(), results],
        fill: true,
        wide: true
      })
    ];

    /* ----------------------------------------------------------------- loading states -- */

    // Rows: the placeholder grid a table fills, then the table.
    const tableSkeleton = skeletonTable({ rows: 4, columns: 3 });
    const table = keep(new Table(null, {
      variant: 'plain',
      columns: [
        { id: 'title', label: 'Task', width: '2fr' },
        { id: 'owner', label: 'Owner', width: '1.2fr', render: (row) => nameOf(row.owner).split(' ')[0] },
        { id: 'due', label: 'Due', width: '1fr', render: (row) => formatDate(noon(row.due), DATE.short) }
      ],
      data: TASKS,
      rowId: 'key',
      stickyHeader: false
    }));
    const rowsStage = stage([tableSkeleton, table.toElement()], { fill: true });
    loaders.push((loaded) => {
      tableSkeleton.hidden = loaded;
      table.el.hidden = !loaded;
      setBusyRegion(rowsStage, !loaded);
    });

    // Cards: CardView draws its own placeholder cards while it loads.
    const cards = keep(new CardView(null, {
      label: 'Projects',
      fields: [
        { id: 'name', label: 'Project' },
        { id: 'company', label: 'Customer', render: (record) => company(record.company)?.name ?? '' },
        { id: 'due', label: 'Due', render: (record) => formatDate(noon(record.due), DATE.short) }
      ],
      data: PROJECTS,
      titleField: 'name',
      subtitleField: (record) => company(record.company)?.name ?? '',
      hiddenFields: ['name', 'company'],
      fieldControls: false,
      minCardWidth: '9rem',
      loadingCount: PROJECTS.length,
      headingLevel: 5
    }));
    const cardsStage = stage(cards.toElement(), { fill: true });
    loaders.push((loaded) => {
      if (loaded) cards.setData(PROJECTS);
      else cards.setLoading(true);
    });

    // A board column: placeholder cards in the column's shape, then the column.
    const columnSkeleton = h('div', { class: 'states__column' },
      h('div', { class: 'states__column-head' },
        skeleton({ width: '30%', height: '0.75rem' }),
        skeleton({ width: '0.75rem', height: '0.75rem' })),
      [0, 1, 2].map((index) => h('div', { class: 'states__ghost-card' },
        h('div', { class: 'states__ghost-line' }, skeleton({ width: '22%', height: '0.625rem' })),
        h('div', { class: 'states__ghost-line' }, skeleton({ width: index === 1 ? '78%' : '60%', height: '0.75rem' })),
        h('div', { class: 'states__ghost-line' }, skeleton({ width: 20, height: 20, radius: 'full' })))));
    const board = keep(new KanbanView(null, {
      label: 'Tasks in progress',
      fields: [{ id: 'title', label: 'Task' }],
      data: TASKS.filter((task) => task.status === 'doing'),
      recordId: 'key',
      columnBy: 'status',
      columns: [{ id: 'doing', label: 'In progress' }],
      titleField: 'title',
      identifier: 'key',
      assignees: (task) => nameOf(task.owner),
      fieldControls: false,
      history: false,
      onrecordclick: () => notify(unavailable('Opening a task'), 'info')
    }));
    const boardStage = stage([columnSkeleton, board.toElement()], { fill: true });
    loaders.push((loaded) => {
      columnSkeleton.hidden = loaded;
      board.el.hidden = !loaded;
      setBusyRegion(boardStage, !loaded);
    });

    // A whole page: title, facts, and description in placeholder form, then the page.
    const project = PROJECTS[0];
    const ownerAvatar = keep(new Avatar(null, { name: nameOf('tobias'), size: 'sm' }));
    const pageSkeleton = h('div', { class: 'states__page' },
      skeletonText({ lines: 2, heading: true, width: '70%', lastLineWidth: '55%' }),
      h('div', { class: 'states__page-facts' }, [0, 1, 2].flatMap((index) => [
        skeleton({ width: '70%', height: '0.75rem' }),
        skeleton({ width: index === 0 ? '85%' : '60%', height: index === 0 ? 20 : '0.75rem', radius: index === 0 ? 'full' : 'sm' })
      ])),
      skeletonText({ lines: 3 }));
    const pageContent = h('div', { class: 'states__page' },
      h('div', {},
        h('h5', { class: 'states__page-title' }, project.name),
        h('p', { class: 'meta' }, `${company(project.company)?.name} · ${project.tasks} tasks`)),
      propList([
        ['Owner', h('span', { class: 'person' }, ownerAvatar.toElement(), h('span', { class: 'person__name' }, nameOf('tobias')))],
        ['Status', badge({ label: 'In progress', kind: 'info', size: 'sm' })],
        ['Due', formatDate(noon(project.due), DATE.long)]
      ]),
      h('p', { class: 'states__page-text' },
        'Replace the handheld scanners in both warehouses and move picking to the new routes before the peak season starts.'));
    const pageStage = stage([pageSkeleton, pageContent], { fill: true });
    loaders.push((loaded) => {
      pageSkeleton.hidden = loaded;
      pageContent.hidden = !loaded;
      setBusyRegion(pageStage, !loaded);
    });

    // A busy button: disabled, the spinner where its icon would be, and the outcome beside it.
    const saveChanges = button({ label: 'Save changes', icon: 'check', onclick: () => saveNow() });
    const saveStatus = keep(new InlineLoading(null, { status: 'inactive' }));
    loaders.push((loaded) => {
      busy.get(saveChanges)?.();
      setBusy(saveChanges, !loaded);
      saveStatus.set(loaded ? 'success' : 'inactive', loaded ? savedText() : '');
    });

    // Saving in place: an edit saves itself, and the line beside it says how that went.
    const autosave = keep(new InlineLoading(null, { status: 'active', description: 'Saving…' }));
    const taskTitle = keep(new Field(null, { label: 'Task title', value: TASKS[0].title }));
    let cancelAutosave = () => {};
    taskTitle.getInput().addEventListener('input', () => {
      cancelAutosave();
      autosave.set('active', 'Saving…');
      cancelAutosave = later(context, () => autosave.set('success', savedText()), DELAY.save);
    }, { signal: context.signal });
    loaders.push((loaded) => {
      cancelAutosave();
      autosave.set(loaded ? 'success' : 'active', loaded ? savedText() : 'Saving…');
    });

    const replay = button({ label: 'Replay', icon: 'rotate-left', kind: 'ghost', shortcut: { label: 'R', keys: 'R' }, onclick: () => runLoading() });
    const loadingCards = [
      card({ title: 'Rows', when: 'A table or list whose columns are known.', stage: rowsStage }),
      card({ title: 'Cards', when: 'A collection drawn as cards.', stage: cardsStage }),
      card({ title: 'Board column', when: 'A board, one column at a time.', stage: boardStage }),
      card({ title: 'A whole page', when: 'A record opened from a link.', stage: pageStage }),
      card({
        title: 'Busy button',
        when: 'An action that takes a moment.',
        stage: h('div', { class: 'states__inline' }, saveChanges, saveStatus.toElement())
      }),
      card({
        title: 'Saving in place',
        when: 'Changes that save themselves. Type to see it again.',
        stage: [taskTitle.toElement(), h('div', { class: 'states__inline' }, autosave.toElement())],
        fill: true
      })
    ];

    /* -------------------------------------------------------------------------- errors -- */

    const retryOffline = button({ label: 'Try again', icon: 'arrows-rotate' });
    const offlineStatus = keep(new InlineLoading(null, { status: 'inactive' }));
    retryOffline.onclick = () => retry(retryOffline, offlineStatus, 'Still offline. Checking again in 30 seconds.');

    const retryLoad = button({ label: 'Try again', icon: 'arrows-rotate' });
    const loadStatus = keep(new InlineLoading(null, { status: 'inactive' }));
    retryLoad.onclick = () => retry(retryLoad, loadStatus, 'Still unavailable. Try again in a few minutes.');

    const askAccess = button({ label: 'Ask Ruth for access', icon: 'paper-plane' });
    const accessStatus = keep(new InlineLoading(null, { status: 'inactive' }));
    askAccess.onclick = () => {
      accessStatus.set('inactive', '');
      runBusy(askAccess, DELAY.retry, () => accessStatus.set('success', `Request sent to ${nameOf('ruth')}.`));
    };

    // Failed to save: the inline error under the document, the same error as a toast, and Save,
    // which in this example fails the first time and succeeds when retried.
    const docTitle = 'Q4 rollout plan';
    const saveDoc = button({ label: 'Save', onclick: () => attemptSave('save') });
    const toastError = button({ label: 'Show as toast', kind: 'ghost', onclick: () => showSaveToast() });
    const saveDocStatus = keep(new InlineLoading(null, { status: 'inactive' }));
    const saveErrorHost = h('div', { class: 'states__inline-message' });
    const saveError = keep(new Message(saveErrorHost, { closable: false, timeout: 0 }));
    let saveErrorHandle = /** @type {{close: () => void}|null} */ (null);
    let cancelSave = () => {};

    const errorCards = [
      card({
        title: 'Failed to save',
        when: 'An edit that did not reach the server.',
        stage: [
          h('div', { class: 'states__subject' },
            iconTile('file-lines', 'blue'),
            h('span', { class: 'states__subject-text' },
              h('span', { class: 'states__subject-title' }, docTitle),
              h('span', { class: 'meta' }, 'Edited 2 minutes ago'))),
          saveErrorHost
        ],
        fill: true,
        wide: true,
        actions: [saveDoc, toastError, saveDocStatus.toElement()]
      }),
      card({
        title: 'Offline',
        when: 'The connection dropped while a list was open.',
        stage: emptyState({
          icon: 'wifi-off', size: 'sm', title: 'You’re offline',
          description: 'Check your connection. Changes you make are kept on this device and sync when you’re back.',
          actions: [retryOffline, offlineStatus.toElement()]
        })
      }),
      card({
        title: 'Failed to load',
        when: 'The server could not answer.',
        stage: emptyState({
          icon: 'circle-exclamation', size: 'sm', title: 'Couldn’t load projects',
          description: 'Something went wrong on our side. Your data is safe; try again in a moment.',
          actions: [...needsNetwork(retryLoad), loadStatus.toElement()]
        })
      }),
      card({
        title: 'Permission denied',
        when: 'A link to something the reader can’t open.',
        stage: emptyState({
          icon: 'lock', size: 'sm', title: 'You don’t have access to Finance reports',
          description: `${nameOf('ruth')} manages this space. Ask her for access, or go back to your projects.`,
          actions: [...needsNetwork(askAccess), accessStatus.toElement()]
        })
      }),
      card({
        title: 'Not found',
        when: 'An old link, or a page that was moved or deleted.',
        stage: emptyState({
          icon: 'file-question', size: 'sm', title: 'Page not found',
          description: 'The link may be out of date, or the page was moved or deleted.',
          actions: [button({ label: 'Go to home', icon: 'house', onclick: () => notify(unavailable('Home'), 'info') })]
        })
      })
    ];

    /* --------------------------------------------------------------- form validation -- */

    const projectName = keep(new Field(null, {
      label: 'Project name', required: true, placeholder: 'For example, Warehouse rollout'
    }));
    const createProject = button({ label: 'Create project', onclick: () => validateName() });
    const nameStatus = keep(new InlineLoading(null, { status: 'inactive' }));
    projectName.getInput().addEventListener('input', () => {
      if (String(projectName.getValue()).trim()) projectName.clearHighlight();
      nameStatus.set('inactive', '');
    }, { signal: context.signal });

    const budget = keep(new Field(null, {
      type: 'int', label: 'Budget', value: '12k', description: 'In euros, as a whole number.'
    }));

    const projectCode = keep(new Field(null, {
      label: 'Project code', value: 'WH-01', description: 'Two to four letters, a dash, and a number.'
    }));
    const codeStatus = keep(new InlineLoading(null, { status: 'inactive' }));
    let cancelCheck = () => {};
    let checking = false;
    // The check waits for a pause in typing, so a half-typed code is never called wrong.
    projectCode.getInput().addEventListener('input', () => {
      cancelCheck();
      checking = false;
      projectCode.clearHighlight();
      codeStatus.set('inactive', '');
      cancelCheck = later(context, () => checkCode(), DELAY.check);
    }, { signal: context.signal });

    const validationCards = [
      card({
        title: 'Required field',
        when: 'Shown when the form is sent, cleared as soon as it’s filled.',
        stage: projectName.toElement(),
        fill: true,
        actions: [...needsNetwork(createProject), nameStatus.toElement()],
        note: 'Creating does nothing here.'
      }),
      card({
        title: 'Wrong format',
        when: 'Checked when the field is left, with the built-in message.',
        stage: budget.toElement(),
        fill: true
      }),
      card({
        title: 'Checked by the server',
        when: 'Some rules only the server knows. Offline, the check waits.',
        stage: projectCode.toElement(),
        fill: true,
        actions: [codeStatus.toElement()]
      })
    ];

    /* ------------------------------------------------------------------ confirmations -- */

    const deleteTask = button({ label: 'Delete task…', icon: 'trash', onclick: () => confirmDelete() });
    const deleteStatus = keep(new InlineLoading(null, { status: 'inactive' }));
    const deleteProject = button({ label: 'Delete project…', icon: 'trash', onclick: () => confirmDeleteProject() });
    const deleteProjectStatus = keep(new InlineLoading(null, { status: 'inactive' }));

    // The description as saved, and as edited since: discarding goes back to the saved text.
    const savedDescription = 'Replace the handheld scanners in both warehouses before the peak season.';
    const description = keep(new Field(null, {
      type: 'textarea', label: 'Description', props: { rows: 3 },
      value: `${savedDescription} Start with the night shift, then the day shift a week later.`
    }));
    const discard = button({ label: 'Close without saving', onclick: () => confirmDiscard() });
    const discardStatus = keep(new InlineLoading(null, { status: 'inactive' }));
    let dirty = true;
    description.getInput().addEventListener('input', () => {
      dirty = true;
      discardStatus.set('inactive', '');
    }, { signal: context.signal });

    const confirmCards = [
      card({
        title: 'Delete',
        when: 'Something that can’t be undone, named in the question.',
        stage: subject('square-check-regular', 'teal', TASKS[0].title, 'Warehouse rollout · 4 comments'),
        fill: true,
        actions: [...needsNetwork(deleteTask), deleteStatus.toElement()],
        note: 'Confirming deletes nothing here.'
      }),
      card({
        title: 'Type to confirm',
        when: 'For deletes that take a lot with them.',
        stage: subject('folder', 'amber', project.name, `${project.tasks} tasks · 6 people · 41 files`),
        fill: true,
        actions: [...needsNetwork(deleteProject), deleteProjectStatus.toElement()],
        note: 'Confirming deletes nothing here.'
      }),
      card({
        title: 'Discard changes',
        when: 'Leaving an edit that hasn’t been saved.',
        stage: description.toElement(),
        fill: true,
        actions: [discard, discardStatus.toElement()],
        note: 'Discarding goes back to the saved text.'
      })
    ];

    /* -------------------------------------------------------------------------- page -- */

    const sectionCards = {
      empty: emptyCards, loading: loadingCards, errors: errorCards, validation: validationCards, confirm: confirmCards
    };
    /** @type {Record<string, {section: HTMLElement, heading: HTMLElement}>} */
    const sections = {};
    const body = h('div', { class: 'shell__body shell__body--padded states__body', tabindex: '-1' },
      h('div', { class: 'states__sections' }, GROUPS.map((group) => {
        const headingId = uid('states-group');
        const heading = h('h3', { class: 'states__section-title', id: headingId, tabindex: '-1' }, group.label);
        const section = h('section', { class: 'states__section', 'aria-labelledby': headingId },
          h('header', { class: 'states__section-head' },
            h('div', { class: 'states__section-text' }, heading, h('p', { class: 'meta' }, group.blurb)),
            group.id === 'loading' ? h('div', { class: 'states__section-actions' }, needsNetwork(replay)) : null),
          h('div', { class: 'states__grid' }, sectionCards[group.id]));
        sections[group.id] = { section, heading };
        return section;
      })));

    const main = h('section', { class: 'shell__main', 'aria-label': 'System states' },
      paneHeader({
        title: 'System states',
        size: 'page',
        className: 'states__header',
        leading: shell.navToggle(),
        actions: [offline.toElement(), help]
      }),
      bannerHost,
      body);

    root.append(nav, main);
    container.append(root);

    shortcuts(root, {
      o: () => { offline.toggle(); },
      r: () => {
        if (state.offline) notify('Loading needs a connection. Turn off Simulate offline to replay it.', 'warning');
        else runLoading();
      },
      '?': () => openHelp(),
      ...Object.fromEntries(GROUPS.map((group, index) => [String(index + 1), () => jump(group.id)]))
    }, context);

    // The first state of everything: the searches that found nothing, the errors, the loading.
    renderResults(search.get());
    showSaveError();
    projectName.setHighlight('Enter a project name.');
    budget.setHighlight(budget.msg('field.int'));
    projectCode.setHighlight(takenMessage('WH-01'));
    runLoading();

    // The contents list follows the scroll: the group whose heading last passed the top is current.
    // While a jump scrolls the page, the group jumped to stays current.
    let jumping = false;
    if (!preview) {
      let frame = 0;
      body.addEventListener('scrollend', () => { jumping = false; }, { signal: context.signal });
      body.addEventListener('scroll', () => {
        if (frame || jumping) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          contents.setActive(currentGroup());
        });
      }, { passive: true, signal: context.signal });
      context.cleanup(() => cancelAnimationFrame(frame));
    }

    /* ----------------------------------------------------------------------- helpers -- */

    /**
     * One example: its name, when it occurs, the component in that state, and what to press.
     * @param {{title: string, when: string, stage: HTMLElement|HTMLElement[], fill?: boolean,
     *   wide?: boolean, actions?: Array<Node|null>, note?: string}} options `wide` takes two columns
     *   of the grid where there are two or more.
     * @returns {HTMLElement}
     */
    function card({ title, when, stage: content, fill = false, wide = false, actions, note }) {
      const place = content instanceof HTMLElement && content.classList.contains('states__stage')
        ? content : stage(content, { fill });
      return h('div', { class: 'surface states__card', dataset: { wide: wide ? '' : null } },
        h('div', { class: 'states__card-head' },
          h('h4', { class: 'surface__title' }, title),
          h('p', { class: 'states__when' }, when)),
        place,
        actions ? h('div', { class: 'states__actions' }, actions) : null,
        note ? h('p', { class: 'states__note' }, note) : null);
    }

    /**
     * The area of a card where the component is shown.
     * @param {HTMLElement|HTMLElement[]} content
     * @param {{fill?: boolean}} [options] `fill` lays the content out from the top at full width
     *   instead of centring it.
     * @returns {HTMLElement}
     */
    function stage(content, { fill = false } = {}) {
      return h('div', { class: 'states__stage', dataset: { fill: fill ? '' : null } }, content);
    }

    /**
     * What a confirmation is about: a kind tile, its name, and what goes with it.
     * @param {string} name Icon name.
     * @param {string} tone Categorical tone of the tile.
     * @param {string} title
     * @param {string} meta
     * @returns {HTMLElement}
     */
    function subject(name, tone, title, meta) {
      return h('div', { class: 'states__subject' },
        iconTile(name, tone),
        h('span', { class: 'states__subject-text' },
          h('span', { class: 'states__subject-title' }, title),
          h('span', { class: 'meta' }, meta)));
    }

    /**
     * Registers an action that needs the network. Offline it is disabled, and the reason beside it
     * says why.
     * @param {HTMLButtonElement} control
     * @returns {HTMLElement[]} The control and its reason, for an actions row.
     */
    function needsNetwork(control) {
      const reason = h('span', { class: 'states__reason', id: uid('states-reason'), hidden: true },
        icon('wifi-off', { size: 14 }), 'Needs a connection');
      networked.push({ control, reason });
      return [control, reason];
    }

    /** @param {HTMLButtonElement} control @returns {void} Disabled offline when it needs the network. */
    function syncDisabled(control) {
      const entry = networked.find((item) => item.control === control);
      control.disabled = Boolean(entry && state.offline);
    }

    /**
     * The busy button: a spinner in place of its icon, `aria-busy`, activation ignored — and still
     * focusable, so focus stays on it while the work runs.
     * @param {HTMLButtonElement} control
     * @param {boolean} on
     * @returns {void}
     */
    function setBusy(control, on) {
      setButtonBusy(control, on);
      syncDisabled(control);
    }

    /**
     * Makes a button busy for a while, then runs what it was doing.
     * @param {HTMLButtonElement} control
     * @param {number} ms
     * @param {() => void} done
     * @returns {void}
     */
    function runBusy(control, ms, done) {
      busy.get(control)?.();
      setBusy(control, true);
      if (preview) return;
      const cancel = later(context, () => {
        busy.delete(control);
        setBusy(control, false);
        done();
      }, ms);
      busy.set(control, () => {
        cancel();
        busy.delete(control);
      });
    }

    /** @param {HTMLElement} region @param {boolean} on @returns {void} */
    function setBusyRegion(region, on) {
      if (on) region.setAttribute('aria-busy', 'true');
      else region.removeAttribute('aria-busy');
    }

    /** @returns {string} What a finished save says, online or off. */
    function savedText() {
      return state.offline ? 'Saved on this device' : 'Saved';
    }

    /** Draws every loading example loading, then — after the time a request takes — loaded. */
    function runLoading() {
      cancelLoad();
      for (const loader of loaders) loader(false);
      if (preview) return;
      cancelLoad = later(context, () => {
        for (const loader of loaders) loader(true);
      }, DELAY.load);
    }

    /** Saves with the busy button. @returns {void} */
    function saveNow() {
      saveStatus.set('inactive', '');
      runBusy(saveChanges, DELAY.save, () => saveStatus.set('success', savedText()));
    }

    /**
     * Tries a failed request again: the button is busy while it runs, and the line beside it says
     * how it went. These examples stay in their state, so the answer is that it still failed.
     * @param {HTMLButtonElement} control
     * @param {InlineLoading} status
     * @param {string} outcome
     * @returns {void}
     */
    function retry(control, status, outcome) {
      status.set('inactive', '');
      runBusy(control, DELAY.retry, () => status.set('error', outcome));
    }

    /** @param {string} query @returns {void} The projects matching the search, or the empty state. */
    function renderResults(query) {
      const words = query.trim().toLowerCase();
      const matches = PROJECTS.filter((item) => `${item.name} ${company(item.company)?.name}`.toLowerCase().includes(words));
      results.replaceChildren(matches.length
        ? h('ul', { class: 'states__result-list', 'aria-label': 'Projects' }, matches.map((item) => h('li', { class: 'states__result' },
          iconTile('folder', 'slate'),
          h('span', { class: 'states__subject-text' },
            h('span', { class: 'states__subject-title' }, item.name),
            h('span', { class: 'meta' }, company(item.company)?.name)))))
        : emptyState({
          icon: 'magnifying-glass', size: 'sm', title: `No results for “${query.trim()}”`,
          description: 'Check the spelling, or try a shorter search.',
          actions: [{ label: 'Clear search', onclick: () => search.clear() }]
        }));
    }

    /** Shows the save error under the document, worded for the connection. @returns {void} */
    function showSaveError() {
      saveErrorHandle?.close();
      const text = state.offline
        ? `You’re offline, so “${docTitle}” couldn’t be saved. Your edits are kept on this device.`
        : `Couldn’t save “${docTitle}”. Your edits are still here.`;
      saveErrorHandle = saveError.show(text, {
        kind: 'error',
        action: {
          label: 'Retry',
          onclick: () => {
            // The message closes behind the press; focus moves on to Save rather than the page.
            saveErrorHandle = null;
            saveDoc.focus({ preventScroll: true });
            attemptSave('retry');
          }
        }
      });
    }

    /**
     * Saves the document. In this example a fresh save fails and a retry succeeds, so both halves
     * can be seen; offline, every attempt fails.
     * @param {'save'|'retry'|'toast'} source
     * @returns {void}
     */
    function attemptSave(source) {
      cancelSave();
      saveDocStatus.set('active', 'Saving…');
      const finish = () => {
        if (state.offline || source === 'save') {
          saveDocStatus.set('error', 'Not saved');
          showSaveError();
          if (source === 'toast') showSaveToast();
          return;
        }
        saveErrorHandle?.close();
        saveErrorHandle = null;
        saveDocStatus.set('success', 'Saved');
        if (source === 'toast') notify(`“${docTitle}” saved.`);
      };
      if (source === 'save') {
        runBusy(saveDoc, DELAY.save, finish);
        cancelSave = () => busy.get(saveDoc)?.();
      } else {
        cancelSave = later(context, finish, DELAY.save);
      }
    }

    /** Raises the save error as a toast, with its Retry. @returns {void} */
    function showSaveToast() {
      notify(state.offline
        ? `You’re offline, so “${docTitle}” couldn’t be saved. Your edits are kept on this device.`
        : `Couldn’t save “${docTitle}”. Your edits are still here.`, 'error', {
        action: { label: 'Retry', onclick: () => attemptSave('toast') }
      });
    }

    /** Sends the required-field form: an empty name is the error. @returns {void} */
    function validateName() {
      if (!String(projectName.getValue()).trim()) {
        projectName.setHighlight('Enter a project name.');
        nameStatus.set('inactive', '');
        projectName.focus();
        return;
      }
      projectName.clearHighlight();
      nameStatus.set('success', 'Looks good. Nothing was created.');
    }

    /** @param {string} code @returns {string} The server's answer for a code already in use. */
    function takenMessage(code) {
      return `${code} is already used by Warehouse rollout. Try another code.`;
    }

    /** Asks the server whether the project code is free — or says why it can’t yet. @returns {void} */
    function checkCode() {
      cancelCheck();
      checking = false;
      const code = String(projectCode.getValue()).trim().toUpperCase();
      if (!code) {
        codeStatus.set('inactive', '');
        projectCode.setHighlight('Enter a project code.');
        return;
      }
      if (!/^[A-Z]{2,4}-\d+$/.test(code)) {
        codeStatus.set('inactive', '');
        projectCode.setHighlight('Use two to four letters, a dash, and a number, like WH-02.');
        return;
      }
      if (state.offline) {
        codeStatus.set('inactive', '');
        projectCode.setHighlight('This code can’t be checked while you’re offline. It’s checked when you reconnect.', 'warning');
        return;
      }
      projectCode.clearHighlight();
      codeStatus.set('active', 'Checking…');
      checking = true;
      cancelCheck = later(context, () => {
        checking = false;
        codeStatus.set('inactive', '');
        if (TAKEN_CODES.includes(code)) projectCode.setHighlight(takenMessage(code));
        else projectCode.setHighlight(`${code} is free.`, 'success');
      }, DELAY.check);
    }

    /** The plain delete confirmation. @returns {Promise<void>} */
    async function confirmDelete() {
      const confirmed = await Dialog.confirm({
        title: `Delete “${TASKS[0].title}”?`,
        message: 'The task and its 4 comments will be deleted for everyone. This can’t be undone.',
        okLabel: 'Delete task',
        danger: true
      });
      if (context.signal.aborted) return;
      deleteStatus.set(confirmed ? 'success' : 'inactive', confirmed ? 'Confirmed. Nothing was deleted.' : 'Kept.');
    }

    /** The type-to-confirm delete. @returns {Promise<void>} */
    async function confirmDeleteProject() {
      const confirmed = await Dialog.confirm({
        title: `Delete the project “${project.name}”?`,
        message: `Its ${project.tasks} tasks, 41 files, and every hour booked on it will be deleted for everyone. This can’t be undone.`,
        okLabel: 'Delete project',
        danger: true,
        confirmText: project.name
      });
      if (context.signal.aborted) return;
      deleteProjectStatus.set(confirmed ? 'success' : 'inactive', confirmed ? 'Confirmed. Nothing was deleted.' : 'Kept.');
    }

    /** Leaving the edited description: confirm only when there is something to lose. @returns {Promise<void>} */
    async function confirmDiscard() {
      if (!dirty) {
        discardStatus.set('inactive', 'Nothing to discard. Edit the text first.');
        return;
      }
      const confirmed = await Dialog.confirm({
        title: 'Discard your changes?',
        message: 'You edited the description. If you close it now, the edits are lost.',
        okLabel: 'Discard',
        cancelLabel: 'Keep editing',
        danger: true
      });
      if (context.signal.aborted) return;
      if (!confirmed) {
        discardStatus.set('inactive', 'Still editing.');
        description.focus();
        return;
      }
      description.setValue(savedDescription, { silent: true });
      dirty = false;
      discardStatus.set('success', 'Changes discarded.');
    }

    /**
     * Takes the page offline or back: the banner, every action that needs the network, and the
     * checks that wait for it.
     * @param {boolean} on
     * @returns {void}
     */
    function setOffline(on) {
      state.offline = on;
      root.dataset.offline = on ? 'true' : 'false';
      account.setAccount(accountIdentity());
      for (const { control, reason } of networked) {
        reason.hidden = !on;
        if (on) control.setAttribute('aria-describedby', reason.id);
        else control.removeAttribute('aria-describedby');
        syncDisabled(control);
      }
      // A key press can take the page offline with focus on an action that now gives way.
      const active = document.activeElement;
      if (active instanceof HTMLButtonElement && active.disabled) {
        /** @type {HTMLElement|null} */ (offline.el.querySelector('[role="switch"]') ?? offline.el)?.focus({ preventScroll: true });
      }
      if (on) {
        bannerHost.hidden = false;
        bannerHandle?.close();
        bannerHandle = banner.show('You’re offline. Changes you make are kept on this device and sync when you reconnect. '
          + 'Actions that need a connection are paused.', { kind: 'warning' });
      } else {
        bannerHandle?.close();
        bannerHandle = null;
        bannerHost.hidden = true;
        notify('You’re back online.');
      }
      // A check under way when the connection goes waits for it; one that waited runs on return.
      if (on ? checking : projectCode.el.dataset.state === 'warning') checkCode();
    }

    /** @returns {Record<string, any>} The signed-in account, with presence that follows the connection. */
    function accountIdentity() {
      const me = person(ME);
      return {
        name: me?.name ?? '', secondary: me?.role,
        status: state.offline ? 'offline' : 'online', statusLabel: state.offline ? 'Offline' : 'Online'
      };
    }

    /**
     * Scrolls to a group of states and moves focus to its heading.
     * @param {string} id
     * @returns {void}
     */
    function jump(id) {
      const target = sections[id];
      if (!target) return;
      // From the drawer: close it first, so the page is no longer inert when the heading takes focus.
      if (root.dataset.navOpen === 'true') shell.closeNav();
      contents.setActive(id);
      const top = Math.min(Math.max(0, target.section.offsetTop - parseFloat(getComputedStyle(body).paddingTop)),
        body.scrollHeight - body.clientHeight);
      jumping = Math.abs(body.scrollTop - top) >= 1;
      body.scrollTo({ top, behavior: allowsMotion(context, root) ? 'smooth' : 'auto' });
      target.heading.focus({ preventScroll: true });
    }

    /** @returns {string} The group whose heading is at or above the top of the page body. */
    function currentGroup() {
      if (body.scrollTop + body.clientHeight >= body.scrollHeight - 2) return GROUPS[GROUPS.length - 1].id;
      const top = body.scrollTop + 64;
      let current = GROUPS[0].id;
      for (const group of GROUPS) {
        if (sections[group.id].section.offsetTop <= top) current = group.id;
      }
      return current;
    }
  }
};
