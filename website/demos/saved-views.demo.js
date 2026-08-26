import { CardView, KanbanView, TableView, button, h } from '../../src/index.js';
import { createSavedViewRegistry } from '../../src/zeyos/saved-views.js';

const SAVED_VIEW_SCOPE = Object.freeze({
  userId: 'ada',
  workspaceId: 'vienna',
  resource: 'opportunities'
});

function savedViewRecords() {
  return [
    { ID: 101, opportunity: 'Northwind European workspace renewal', account: 'Northwind GmbH', stage: 'Qualified', owner: 'Ada Lovelace', value: 48000 },
    { ID: 102, opportunity: 'Aurora fleet analytics', account: 'Aurora AB', stage: 'Proposal', owner: 'Grace Hopper', value: 73500 },
    { ID: 103, opportunity: 'Contoso service rollout', account: 'Contoso Ltd.', stage: 'Proposal', owner: 'Ada Lovelace', value: 29800 },
    { ID: 104, opportunity: 'Fabrikam office automation', account: 'Fabrikam AG', stage: 'Negotiation', owner: 'Grace Hopper', value: 112000 }
  ];
}

function savedViewFields() {
  const money = new Intl.NumberFormat('en', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0
  });
  return [
    { id: 'opportunity', label: 'Opportunity', sortable: true },
    { id: 'account', label: 'Account', sortable: true },
    { id: 'stage', label: 'Stage', sortable: true },
    { id: 'owner', label: 'Owner', sortable: true },
    {
      id: 'value', label: 'Value', sortable: true,
      render: (_record, _index, value) => money.format(Number(value) || 0),
      sortValue: (record) => record.value
    }
  ];
}

function seededSavedViewDocument(scope) {
  const createdAt = '2026-08-25T08:00:00.000Z';
  return {
    version: 1,
    scope: { ...scope },
    defaultId: 'pipeline-table',
    views: [
      {
        id: 'pipeline-table', name: 'Pipeline table', type: 'table',
        state: {
          version: 1,
          fieldOrder: ['opportunity', 'account', 'stage', 'owner', 'value'],
          hiddenFields: [],
          sort: { id: 'value', dir: 'desc' }
        },
        filters: {}, search: '', createdAt, updatedAt: createdAt
      },
      {
        id: 'proposal-cards', name: 'Proposal cards', type: 'card',
        state: {
          version: 1,
          fieldOrder: ['opportunity', 'account', 'value', 'owner', 'stage'],
          hiddenFields: ['stage'],
          sort: { id: 'opportunity', dir: 'asc' },
          groupBy: null,
          minCardWidth: '16rem',
          maxColumns: 2,
          variant: 'outlined'
        },
        filters: { stage: 'Proposal' }, search: '', createdAt, updatedAt: createdAt
      },
      {
        id: 'stage-board', name: 'Stage board', type: 'kanban',
        state: {
          version: 1,
          fieldOrder: ['opportunity', 'account', 'owner', 'value', 'stage'],
          hiddenFields: ['stage'],
          sort: null,
          columnOrder: ['Qualified', 'Proposal', 'Negotiation'],
          swimlaneOrder: [],
          collapsedColumns: [],
          collapsedSwimlanes: [],
          showCounts: true,
          showEmptyColumns: true,
          variant: 'outlined'
        },
        filters: {}, search: '', createdAt, updatedAt: createdAt
      }
    ]
  };
}

// A demo-only server stand-in: defensive copies, atomic writes, and one deterministic failure.
function createMemorySavedViewTransport(initialDocument) {
  const clone = (value) => value == null ? null : JSON.parse(JSON.stringify(value));
  let confirmed = clone(initialDocument);
  let nextFailure = null;
  return {
    async load() {
      if (nextFailure) {
        const error = nextFailure;
        nextFailure = null;
        throw error;
      }
      return clone(confirmed);
    },
    async save(_scope, document) {
      if (nextFailure) {
        const error = nextFailure;
        nextFailure = null;
        throw error;
      }
      confirmed = clone(document);
    },
    async remove() {
      if (nextFailure) {
        const error = nextFailure;
        nextFailure = null;
        throw error;
      }
      confirmed = null;
    },
    failNext(message = 'Demo server is offline') {
      nextFailure = new Error(message);
    },
    snapshot() {
      return clone(confirmed);
    }
  };
}

function createSavedViewRenderer(type, onStateChange) {
  const common = {
    fields: savedViewFields(),
    data: savedViewRecords(),
    recordId: 'ID',
    selectable: 'multi',
    onstatechange: onStateChange
  };
  if (type === 'card') {
    return new CardView(null, {
      ...common,
      titleField: 'opportunity',
      subtitleField: 'account',
      groupBy: 'stage',
      groupOrder: ['Qualified', 'Proposal', 'Negotiation'],
      maxColumns: 3
    });
  }
  if (type === 'kanban') {
    return new KanbanView(null, {
      ...common,
      columnBy: 'stage',
      columns: ['Qualified', 'Proposal', 'Negotiation'].map((id) => ({ id, label: id })),
      titleField: 'opportunity',
      subtitleField: 'account',
      hiddenFields: ['stage'],
      moveMode: 'external'
    });
  }
  return new TableView(null, {
    ...common,
    table: { height: 300, responsive: 'sm', stickyHeader: true }
  });
}

export default {
  title: 'Saved record views',
  group: 'Data',
  api: ['SavedViewRegistry', 'TableView', 'CardView', 'KanbanView'],
  blurb: 'Application-owned named-view workflow over one user, workspace, and resource scope.',
  examples: [
    {
      title: 'Named views with explicit persistence',
      blurb: 'The picker owns dirty drafts, presentation switching, query state, confirmations, '
        + 'and errors. The injected transport stores one atomic document and never sees records.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const transport = createMemorySavedViewTransport(seededSavedViewDocument(SAVED_VIEW_SCOPE));
        const registry = createSavedViewRegistry(transport, SAVED_VIEW_SCOPE);
        let currentType = 'table';
        let currentView = null;
        let activeId = null;
        let dirty = false;
        let applying = false;
        let deleteArmed = false;
        let query = { filters: {}, search: '' };

        const picker = h('select', { ariaLabel: 'Saved view', disabled: true });
        const typePicker = h('select', { ariaLabel: 'Presentation type' },
          h('option', { value: 'table' }, 'Table'),
          h('option', { value: 'card' }, 'Cards'),
          h('option', { value: 'kanban' }, 'Kanban'));
        const name = h('input', {
          type: 'text', ariaLabel: 'Saved view name', placeholder: 'View name', maxlength: 160
        });
        const search = h('input', {
          type: 'search', ariaLabel: 'Search records', placeholder: 'Search opportunities'
        });
        const stage = h('select', { ariaLabel: 'Filter by stage' },
          h('option', { value: '' }, 'All stages'),
          ...['Qualified', 'Proposal', 'Negotiation'].map((value) => h('option', { value }, value)));
        const status = h('p', { class: 'demo-caption', role: 'status', ariaLive: 'polite' });
        const host = h('div');

        const setStatus = (message) => {
          status.textContent = message;
          log(message);
        };
        const markDirty = () => {
          if (applying) return;
          dirty = true;
          picker.dataset.dirty = 'true';
          setStatus('Unsaved draft — Save, Save as, or Discard before choosing another view.');
        };
        const filteredRecords = () => savedViewRecords().filter((record) => {
          const stageMatch = !query.filters.stage || record.stage === query.filters.stage;
          const text = `${record.opportunity} ${record.account} ${record.owner}`.toLowerCase();
          return stageMatch && text.includes(query.search.trim().toLowerCase());
        });
        const applyQuery = () => {
          currentView?.setData(filteredRecords());
          search.value = query.search;
          stage.value = String(query.filters.stage ?? '');
        };
        const replaceRenderer = (type, state = null) => {
          currentView?.destroy();
          currentType = type;
          typePicker.value = type;
          currentView = createSavedViewRenderer(type, markDirty);
          if (state) currentView.setViewState(state);
          host.replaceChildren(currentView.toElement());
          applyQuery();
        };
        replaceRenderer(currentType);

        const refreshPicker = async () => {
          const [entries, defaultEntry] = await Promise.all([registry.list(), registry.getDefault()]);
          picker.replaceChildren(h('option', { value: '' }, 'Unsaved draft'));
          for (const entry of entries) {
            const marker = defaultEntry?.id === entry.id ? '★ ' : '';
            picker.append(h('option', { value: entry.id }, `${marker}${entry.name} · ${entry.type}`));
          }
          picker.value = activeId ?? '';
          picker.disabled = false;
        };
        const applySaved = async (id) => {
          applying = true;
          try {
            let result = await registry.apply(id, currentView, {
              type: currentType,
              onQuery: (next) => {
                query = { filters: next.filters, search: next.search };
                applyQuery();
              }
            });
            if (result.status === 'type-mismatch') {
              replaceRenderer(result.expectedType);
              result = await registry.apply(id, currentView, {
                type: currentType,
                onQuery: (next) => {
                  query = { filters: next.filters, search: next.search };
                  applyQuery();
                }
              });
            }
            if (!result.applied) {
              setStatus('That saved view no longer exists. The current draft was not changed.');
              return;
            }
            activeId = result.entry.id;
            name.value = result.entry.name;
            dirty = false;
            deleteArmed = false;
            delete picker.dataset.dirty;
            await refreshPicker();
            setStatus(`Applied ${result.entry.name} as ${result.entry.type}.`);
          } finally {
            applying = false;
          }
        };
        const run = (operation) => {
          Promise.resolve().then(operation).catch((error) => {
            setStatus(`${error.message}. The live draft and confirmed saved-view list were kept.`);
          });
        };
        const capture = async (id = null) => {
          const selected = id ? await registry.get(id) : null;
          const entry = await registry.capture(currentView, {
            ...(id ? { id } : {}),
            name: id ? selected.name : name.value,
            type: currentType,
            filters: query.filters,
            search: query.search
          });
          activeId = entry.id;
          name.value = entry.name;
          dirty = false;
          delete picker.dataset.dirty;
          await refreshPicker();
          setStatus(`${id ? 'Saved' : 'Saved as'} ${entry.name}.`);
        };

        picker.addEventListener('change', () => {
          const id = picker.value;
          if (dirty) {
            picker.value = activeId ?? '';
            setStatus('Switch blocked: Save, Save as, or Discard the current draft first.');
            return;
          }
          if (id) run(() => applySaved(id));
        });
        typePicker.addEventListener('change', () => {
          const state = currentView.getViewState();
          replaceRenderer(typePicker.value, state);
          markDirty();
        });
        search.addEventListener('input', () => {
          query = { ...query, search: search.value };
          applyQuery();
          markDirty();
        });
        stage.addEventListener('change', () => {
          query = { ...query, filters: stage.value ? { stage: stage.value } : {} };
          applyQuery();
          markDirty();
        });

        const save = button({
          label: 'Save', kind: 'primary',
          onclick: () => activeId ? run(() => capture(activeId)) : setStatus('Use Save as for a new view.')
        });
        const saveAs = button({ label: 'Save as', onclick: () => run(() => capture()) });
        const rename = button({
          label: 'Rename',
          onclick: () => run(async () => {
            if (!activeId) throw new Error('Select a saved view before renaming');
            const entry = await registry.rename(activeId, name.value);
            await refreshPicker();
            setStatus(`Renamed to ${entry.name}; the live draft was not recaptured.`);
          })
        });
        const makeDefault = button({
          label: 'Make default',
          onclick: () => run(async () => {
            if (!activeId) throw new Error('Select a saved view before making it default');
            const entry = await registry.setDefault(activeId);
            await refreshPicker();
            setStatus(`${entry.name} is the default for this exact scope.`);
          })
        });
        const discard = button({
          label: 'Discard draft',
          onclick: () => run(async () => {
            if (activeId) await applySaved(activeId);
            else {
              applying = true;
              replaceRenderer(currentType);
              dirty = false;
              delete picker.dataset.dirty;
              applying = false;
              setStatus('Unsaved draft discarded.');
            }
          })
        });
        const remove = button({
          label: 'Delete', kind: 'danger',
          onclick: () => run(async () => {
            if (!activeId) throw new Error('Select a saved view before deleting');
            if (!deleteArmed) {
              deleteArmed = true;
              setStatus('Delete is armed. Activate Delete again to confirm.');
              return;
            }
            const oldId = activeId;
            const removed = await registry.remove(oldId);
            if (!removed) throw new Error('That saved view was already deleted');
            activeId = null;
            dirty = true;
            deleteArmed = false;
            picker.dataset.dirty = 'true';
            await refreshPicker();
            setStatus('Saved name deleted; the live renderer remains as an unsaved draft.');
          })
        });
        const failSave = button({
          label: 'Test failed Save',
          onclick: () => run(async () => {
            if (!activeId) throw new Error('Select a saved view before testing a failed save');
            currentView.setSort('account', currentView.getSort()?.dir === 'asc' ? 'desc' : 'asc');
            const before = JSON.stringify(transport.snapshot());
            transport.failNext();
            try {
              await registry.capture(currentView, {
                id: activeId,
                name: (await registry.get(activeId)).name,
                type: currentType,
                filters: query.filters,
                search: query.search
              });
            } catch (error) {
              const unchanged = before === JSON.stringify(transport.snapshot());
              setStatus(`${error.message}; draft kept, confirmed document ${unchanged ? 'unchanged' : 'changed unexpectedly'}.`);
            }
          })
        });

        run(async () => {
          await registry.ready();
          const initial = await registry.getDefault();
          await refreshPicker();
          if (initial) await applySaved(initial.id);
        });
        cleanup(() => {
          currentView?.destroy();
          registry.destroy();
        });

        return [
          h('p', { class: 'demo-caption' },
            'Scope: user ada · workspace vienna · resource opportunities. The server still owns authorization.'),
          h('div', { class: 'demo-row' }, picker, typePicker, name, save, saveAs, rename),
          h('div', { class: 'demo-row' }, search, stage, makeDefault, discard, remove, failSave),
          status,
          host
        ];
      }
    }
  ]
};
