import { AgentThread } from '../components/agent-thread/agent-thread.js';
import { ApprovalCard } from '../components/approval-card/approval-card.js';
import { BlockView } from '../components/block-view/block-view.js';
import { CardView } from '../components/card-view/card-view.js';
import { Chart } from '../components/chart/chart.js';
import { Composer } from '../components/composer/composer.js';
import { KanbanView } from '../components/kanban-view/kanban-view.js';
import { RunStatus } from '../components/run-status/run-status.js';
import { RunTrace } from '../components/run-trace/run-trace.js';
import { SourceList } from '../components/source-list/source-list.js';
import { TreeView } from '../components/tree/tree.js';
import {
  attributes, bool, data, flag, forward, normalizeNumberOrString, normalizeSelectable, number, prop,
  records, recordsPatch, reflectPlain, text
} from './definitions.js';

/** @typedef {import('./definitions.js').ElementAttribute} ElementAttribute */

/* Options rebuilt on change: the component has no way to take them in place. */

/** @param {Partial<ElementAttribute>} [options={}] @returns {ElementAttribute} */
const rebuiltText = (options = {}) => text({ rebuild: true, ...options });
/** @param {number|null} value @returns {ElementAttribute} */
const rebuiltNumber = (value) => number({ default: value, rebuild: true });
/** @param {unknown} value @returns {ElementAttribute} */
const rebuiltData = (value) => data({ default: value, rebuild: true });
/** @returns {ElementAttribute} */
const rebuiltBool = () => bool({ rebuild: true });
/** @returns {ElementAttribute} */
const rebuiltProp = () => prop({ default: null, rebuild: true });
/** @returns {ElementAttribute} The `msg` table every message-bearing component takes. */
const messages = () => rebuiltData(null);

/**
 * A text in markup, or something markup cannot write (a function, a node, a date) on the property.
 * @param {Partial<ElementAttribute>} [options={}]
 * @returns {ElementAttribute}
 */
const textOrValue = (options = {}) => text({ serialize: reflectPlain('string'), ...options });

/** @param {string} key @returns {(component: any, value: unknown) => void} A setter through `update()`. */
const updates = (key) => (component, value) => component.update({ [key]: value });

/**
 * A setter through a record view's saved state, which replaces all of it, so the rest is read back.
 * @param {string} key State key.
 * @returns {(component: any, value: unknown) => void}
 */
const viewState = (key) => (component, value) => {
  component.setViewState({ ...component.getViewState(), [key]: value }, { silent: true });
};

/** @param {any} component @param {Array<{id: string}>|null} chips @returns {void} */
function setContext(component, chips) {
  for (const chip of component.getContext()) component.removeContext(chip.id);
  for (const chip of chips ?? []) component.addContext(chip);
}

/** @param {any} component @returns {boolean} Whether the card lists an edit. */
function isEdited(component) {
  const keys = component.getEditedKeys();
  return keys === null || keys.length > 0;
}

/** @param {unknown} value @returns {unknown} `'icon'`, or a boolean from the attribute's text. */
function normalizeCompact(value) {
  if (value === '' || value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

const AGENT_THREAD_ATTRS = attributes({
  items: data({ default: [], set: (component, value) => component.setItems(value), get: (component) => component.getItems() }),
  authors: rebuiltData({}),
  me: rebuiltText({ default: 'me' }),
  label: rebuiltText({ default: null }),
  'heading-level': rebuiltNumber(3),
  'empty-state': rebuiltData(null),
  'follow-output': flag({ rebuild: true }),
  scroller: rebuiltProp(),
  'answer-actions': rebuiltData(['copy', 'regenerate', 'branch']),
  icons: rebuiltData({}),
  'user-actions': rebuiltData([]),
  'trace-icons': rebuiltData({}),
  'source-icons': rebuiltData({}),
  'surface-options': rebuiltData({}),
  now: rebuiltProp(),
  'format-time': rebuiltProp(),
  locale: rebuiltText(),
  msg: messages()
});

const COMPOSER_ATTRS = attributes({
  label: text({ default: null, set: updates('label') }),
  placeholder: text({ default: '', set: updates('placeholder') }),
  value: text({ default: '', reflect: false, set: (component, value) => component.setValue(value), get: (component) => component.getValue() }),
  'submit-key': text({ default: 'enter', set: updates('submitKey') }),
  busy: bool({ set: (component, value) => component.setBusy(value), get: (component) => component.isBusy() }),
  disabled: bool({ set: (component, value) => component.setDisabled(value) }),
  attachments: rebuiltBool(),
  accept: rebuiltText({ default: '' }),
  'max-files': rebuiltNumber(10),
  mentions: rebuiltData(null),
  commands: rebuiltData(null),
  context: data({ default: [], set: setContext, get: (component) => component.getContext() }),
  hint: text({ default: '', set: (component, value) => component.setHint(value) }),
  note: text({ default: '', set: (component, value) => component.setNote(value) }),
  'draft-key': rebuiltText({ default: null }),
  'min-rows': rebuiltNumber(1),
  'max-rows': rebuiltNumber(10),
  icons: rebuiltData({}),
  tools: data({ default: [], set: (component, value) => component.setTools(value) }),
  'send-label': text({ default: null, set: updates('sendLabel') }),
  queue: rebuiltBool(),
  'queue-limit': rebuiltNumber(10),
  msg: messages()
});

const BLOCK_VIEW_ATTRS = attributes({
  blocks: data({ default: [], set: (component, value) => component.setBlocks(value), get: (component) => component.getBlocks() }),
  'heading-level': rebuiltNumber(3),
  size: rebuiltText({ default: 'sm' }),
  streaming: bool({
    set: (component, value) => (value ? component.setBlocks(component.getBlocks(), { streaming: true }) : component.end()),
    get: (component) => component.isStreaming()
  }),
  sources: data({ default: null, set: (component, value) => component.setSources(value) }),
  msg: messages()
});

const RUN_TRACE_ATTRS = attributes({
  steps: data({ default: [], set: (component, value) => component.setSteps(value), get: (component) => component.getSteps() }),
  open: bool({ set: (component, value) => (value ? component.expand() : component.collapse()), get: (component) => component.isOpen() }),
  label: text({ default: null, set: (component, value) => component.setLabel(value) }),
  authors: rebuiltData({}),
  'show-arguments': flag({ rebuild: true }),
  'max-result': rebuiltNumber(4000),
  summary: flag({ rebuild: true }),
  'kind-icons': flag({ default: null, rebuild: true }),
  selectable: rebuiltBool(),
  ticking: rebuiltBool(),
  now: rebuiltProp(),
  'format-time': rebuiltProp(),
  icons: rebuiltData({}),
  msg: messages()
});

const APPROVAL_CARD_ATTRS = attributes({
  // Off the attribute, where the browser would show it as a tooltip over the whole card.
  title: text({ default: '', reflect: false, set: updates('title') }),
  description: text({ default: '', set: updates('description') }),
  icon: text({ default: null, set: updates('icon') }),
  tone: text({ default: 'blue', set: updates('tone') }),
  'heading-level': rebuiltNumber(3),
  status: text({ default: 'pending', set: (component, value) => component.setStatus(value), get: (component) => component.getStatus() }),
  details: data({ default: null, set: updates('details') }),
  preview: data({ default: null, set: updates('preview') }),
  fields: data({ default: null, set: updates('fields') }),
  values: data({ default: {}, set: updates('values'), get: (component) => component.getValues() }),
  'confirm-text': text({ default: null, set: updates('confirmText') }),
  reason: text({ default: 'optional', set: updates('reason') }),
  edited: bool({ set: updates('edited'), get: isEdited }),
  'edited-keys': data({ default: null, set: updates('editedKeys'), get: (component) => component.getEditedKeys() }),
  'reject-reason': text({ default: null, set: (component, value) => component.setStatus(component.getStatus(), { reason: value }) }),
  'answered-by': text({ default: null, set: (component, value) => component.setStatus(component.getStatus(), { by: value }) }),
  'answered-at': textOrValue({ default: null, set: (component, value) => component.setStatus(component.getStatus(), { at: value }) }),
  now: rebuiltProp(),
  keys: flag({ rebuild: true }),
  msg: messages()
});

const SOURCE_LIST_ATTRS = attributes({
  sources: data({ default: [], set: (component, value) => component.setSources(value), get: (component) => component.getSources() }),
  label: rebuiltText(),
  layout: rebuiltText({ default: 'chips' }),
  numbered: flag({ rebuild: true }),
  icons: rebuiltData({}),
  msg: messages()
});

const RUN_STATUS_ATTRS = attributes({
  state: text({ default: 'queued', set: updates('state') }),
  summary: text({ default: '', set: updates('summary') }),
  steps: data({ default: null, set: updates('steps') }),
  started: textOrValue({ default: null, set: updates('started') }),
  finished: textOrValue({ default: null, set: updates('finished') }),
  'work-ms': number({ default: null, set: updates('workMs'), get: (component) => component.getState().workMs }),
  'waiting-since': textOrValue({ default: null, set: updates('waitingSince') }),
  tokens: data({ default: null, set: updates('tokens') }),
  'token-budget': number({ default: null, set: updates('tokenBudget') }),
  cost: data({ default: null, set: updates('cost') }),
  model: text({ default: null, set: updates('model') }),
  actions: data({ default: [], set: updates('actions') }),
  ticking: flag({ set: updates('ticking') }),
  compact: text({ default: false, normalize: normalizeCompact, set: updates('compact') }),
  now: rebuiltProp(),
  locale: rebuiltText(),
  msg: messages()
});

const RECORD_VIEW_ATTRS = Object.freeze({
  fields: data({ default: [], set: (component, value) => component.setFields(value), get: (component) => component.getFields() }),
  data: data({ default: [], set: (component, value) => component.setData(value), get: (component) => component.getData() }),
  'record-id': textOrValue({ default: 'ID', rebuild: true }),
  sort: data({ default: null, set: (component, value) => component.setSort(value?.id ?? null, value?.dir, { silent: true }), get: (component) => component.getSort() }),
  'sort-mode': rebuiltText({ default: 'local' }),
  selectable: rebuiltText({ default: false, normalize: normalizeSelectable }),
  'selection-trigger': rebuiltText({ default: 'checkbox' }),
  selection: data({ default: [], set: (component, value) => component.setSelection(value, { silent: true }), get: (component) => component.getSelectionIds() }),
  'field-order': data({ default: [], set: (component, value) => component.setFieldOrder(value, { silent: true }), get: (component) => component.getFieldOrder() }),
  'hidden-fields': data({ default: [], set: viewState('hiddenFields'), get: (component) => component.getHiddenFields() }),
  'field-controls': flag({ rebuild: true, serialize: reflectPlain('flag') }),
  'empty-text': textOrValue({ default: null, rebuild: true })
});

const CARD_VIEW_ATTRS = attributes({
  ...RECORD_VIEW_ATTRS,
  'title-field': textOrValue({ default: null, rebuild: true }),
  'subtitle-field': textOrValue({ default: null, rebuild: true }),
  preview: textOrValue({ rebuild: true }),
  'preview-alt': textOrValue({ default: null, rebuild: true }),
  link: rebuiltData(undefined),
  actions: rebuiltData([]),
  'group-by': textOrValue({ default: null, rebuild: true }),
  'group-order': data({ default: [], set: viewState('groupOrder') }),
  'min-card-width': text({ default: '15rem', normalize: normalizeNumberOrString, set: viewState('minCardWidth') }),
  'max-columns': number({ default: null, set: viewState('maxColumns') }),
  variant: text({ default: 'outlined', set: viewState('variant') }),
  'loading-count': rebuiltNumber(6),
  'heading-level': rebuiltNumber(3),
  label: rebuiltText({ default: null }),
  keyboard: rebuiltText({ default: 'tabs' }),
  'collapsible-groups': rebuiltBool(),
  'collapsed-groups': data({ default: [], set: viewState('collapsedGroups'), get: (component) => component.getCollapsedGroups() }),
  'render-group-heading': rebuiltProp()
});

const KANBAN_VIEW_ATTRS = attributes({
  ...RECORD_VIEW_ATTRS,
  'column-by': textOrValue({ default: 'status', rebuild: true }),
  columns: data({ default: null, set: (component, value) => component.setColumns(value) }),
  'swimlane-by': textOrValue({ default: null, rebuild: true }),
  swimlanes: data({ default: null, set: (component, value) => component.setSwimlanes(value) }),
  'title-field': textOrValue({ default: null, rebuild: true }),
  'subtitle-field': textOrValue({ default: null, rebuild: true }),
  preview: textOrValue({ default: null, rebuild: true }),
  'preview-alt': textOrValue({ default: null, rebuild: true }),
  link: rebuiltData(null),
  actions: rebuiltData([]),
  'move-mode': rebuiltText({ default: 'local' }),
  'drag-from': rebuiltText({ default: 'card' }),
  'move-handle': rebuiltText({ default: 'keyboard' }),
  'entity-icon': textOrValue({ default: null, rebuild: true }),
  identifier: textOrValue({ default: null, rebuild: true }),
  status: textOrValue({ default: null, rebuild: true }),
  'status-tones': rebuiltData({}),
  priority: textOrValue({ default: null, rebuild: true }),
  'priority-tones': rebuiltData({}),
  progress: textOrValue({ default: null, rebuild: true }),
  'progress-max': rebuiltNumber(100),
  assignees: textOrValue({ default: null, rebuild: true }),
  'max-avatars': rebuiltNumber(3),
  'multi-move': flag({ rebuild: true }),
  'auto-scroll': flag({ rebuild: true }),
  'wip-policy': rebuiltText({ default: 'warn' }),
  rules: rebuiltData([]),
  search: text({ default: '', set: (component, value) => component.setSearch(value, { silent: true }), get: (component) => component.getSearch() }),
  'search-fields': rebuiltData(null),
  filter: prop({ default: null, set: (component, value) => component.setFilter(value) }),
  'search-control': rebuiltBool(),
  history: flag({ rebuild: true }),
  'history-limit': rebuiltNumber(50),
  'history-controls': rebuiltBool(),
  'column-height': rebuiltText({ default: null }),
  'allow-add': bool({ rebuild: true, serialize: reflectPlain('boolean') }),
  'context-menu': bool({ rebuild: true, serialize: reflectPlain('boolean') }),
  'render-card': rebuiltProp(),
  'render-column-header': rebuiltProp(),
  'render-swimlane-header': rebuiltProp(),
  'render-column-empty': rebuiltProp(),
  'render-drag-preview': rebuiltProp(),
  labels: rebuiltData({}),
  'column-order': data({ default: [], set: (component, value) => component.setColumnOrder(value, { silent: true }), get: (component) => component.getColumnOrder() }),
  'swimlane-order': data({ default: [], set: (component, value) => component.setSwimlaneOrder(value, { silent: true }), get: (component) => component.getSwimlaneOrder() }),
  'collapsed-columns': data({ default: [], set: viewState('collapsedColumns'), get: (component) => component.getCollapsedColumns() }),
  'collapsed-swimlanes': data({ default: [], set: viewState('collapsedSwimlanes'), get: (component) => component.getCollapsedSwimlanes() }),
  'show-counts': flag({ rebuild: true }),
  'show-empty-columns': flag({ rebuild: true }),
  variant: rebuiltText({ default: 'outlined' }),
  label: rebuiltText()
});

const TREE_ATTRS = attributes({
  items: data({ default: [], set: (component, value) => component.setItems(value), get: (component) => component.getItems() }),
  'value-key': textOrValue({ default: 'ID', rebuild: true }),
  'label-key': textOrValue({ default: 'name', rebuild: true }),
  'children-key': rebuiltText({ default: 'children' }),
  expanded: rebuiltData([]),
  selection: rebuiltText({ default: 'single', normalize: normalizeSelectable }),
  selected: data({ default: [], set: (component, value) => component.setSelection(value), get: (component) => component.getSelection() }),
  checkboxes: rebuiltBool(),
  checked: data({ default: [], set: (component, value) => component.setChecked(value), get: (component) => component.getChecked() }),
  icons: flag({ rebuild: true }),
  'render-label': rebuiltProp(),
  'row-actions': rebuiltProp(),
  'more-label': rebuiltText({ default: null }),
  load: rebuiltProp(),
  filter: text({ default: '', set: (component, value) => component.setFilter(value) }),
  label: rebuiltText({ default: null }),
  'empty-text': rebuiltText(),
  height: rebuiltText({ default: null, normalize: normalizeNumberOrString }),
  msg: messages()
});

const CHART_ATTRS = attributes({
  adapter: prop({ default: null, set: (component, value) => component.setAdapter(value) }),
  type: text({ default: 'bar', set: (component, value) => component.setType(value) }),
  data: data({ default: { labels: [], datasets: [] }, set: (component, value) => component.setData(value) }),
  'chart-options': data({ default: {}, set: (component, value) => component.update(value) }),
  label: rebuiltText({ default: null }),
  description: rebuiltText({ default: '' }),
  summary: rebuiltText({ default: 'hidden' }),
  // New data ends a load on its own, so the property reads the chart rather than what it was told.
  loading: bool({ set: (component, value) => component.setLoading(value), get: (component) => component.el.dataset.state === 'loading' }),
  'empty-text': rebuiltText(),
  'loading-text': rebuiltText(),
  'error-text': rebuiltText(),
  'aspect-ratio': rebuiltText({ default: '16 / 9' })
});

const RECORD_VIEW_METHODS = Object.freeze({
  ...forward(
    'setData', 'addData', 'updateRecord', 'removeRecord', 'setFields', 'mountFieldControls', 'setFieldVisible',
    'toggleField', 'moveField', 'setFieldOrder', 'setSort', 'setSelection', 'clearSelection', 'toggleSelection',
    'setLoading'
  ),
  setViewState: recordsPatch
});

const RECORD_VIEW_EVENTS = Object.freeze([
  'recordclick', 'recorddblclick', 'datachange', 'selectionchange', 'sortchange', 'fieldvisibilitychange',
  'fieldorderchange', 'statechange', 'recordaction'
]);

/**
 * The agent kit and the data views, as `[suffix, Component, wrapper options]`. None of them is a
 * form control, so none is form-associated.
 * @type {ReadonlyArray<[string, typeof import('../core/component.js').Component, import('./define.js').ElementWrapperOptions]>}
 */
export const KIT_ELEMENTS = Object.freeze([
  ['agent-thread', AgentThread, {
    attrs: AGENT_THREAD_ATTRS,
    methods: forward(
      'setItems', 'upsert', 'patch', 'appendText', 'appendBlock', 'announce', 'remove', 'get', 'getItems',
      'getComponent', 'surface', 'reveal', 'setArtifactState', 'scrollToEnd'
    ),
    events: ['action', 'approve', 'edit', 'reject', 'cite', 'artifact', 'reveal', 'open', 'reply']
  }],
  ['composer', Composer, {
    attrs: COMPOSER_ATTRS,
    methods: {
      ...forward('focus', 'setValue', 'insertText', 'clear', 'setToolPressed', 'addFiles', 'addContext', 'removeContext',
        'getQueue', 'clearQueue', 'removeQueued'),
      setBusy: records('busy'),
      setHint: records('hint'),
      setNote: records('note'),
      setDisabled: records('disabled'),
      setTools: records('tools'),
      update: recordsPatch
    },
    events: ['send', 'stop', 'input', 'attach', 'remove', 'mention', 'command', 'tool', 'historyprevious', 'queue', 'dequeue']
  }],
  ['block-view', BlockView, {
    attrs: BLOCK_VIEW_ATTRS,
    methods: {
      ...forward('setBlocks', 'append', 'appendText', 'end', 'stop', 'setArtifactState'),
      setSources: records('sources')
    },
    events: ['cite', 'artifact', 'end']
  }],
  ['run-trace', RunTrace, {
    attrs: RUN_TRACE_ATTRS,
    methods: { ...forward('setSteps', 'upsert', 'expand', 'collapse', 'reveal'), setLabel: records('label') },
    events: ['toggle', 'reveal', 'select', 'open']
  }],
  ['approval-card', ApprovalCard, {
    attrs: APPROVAL_CARD_ATTRS,
    methods: { ...forward('focus', 'handleKey'), update: recordsPatch, setStatus: records('status') },
    events: ['approve', 'edit', 'reject']
  }],
  ['source-list', SourceList, {
    attrs: SOURCE_LIST_ATTRS,
    methods: forward('setSources', 'highlight'),
    events: ['select']
  }],
  ['run-status', RunStatus, {
    attrs: RUN_STATUS_ATTRS,
    methods: { update: recordsPatch },
    events: ['action']
  }],
  ['card-view', CardView, {
    attrs: CARD_VIEW_ATTRS,
    methods: { ...RECORD_VIEW_METHODS, ...forward('setGroupCollapsed') },
    events: [...RECORD_VIEW_EVENTS, 'groupcollapse']
  }],
  ['kanban-view', KanbanView, {
    attrs: KANBAN_VIEW_ATTRS,
    methods: {
      ...RECORD_VIEW_METHODS,
      ...forward(
        'setColumnOrder', 'moveColumn', 'setSwimlaneOrder', 'moveSwimlane', 'setColumnCollapsed', 'toggleColumn',
        'setSwimlaneCollapsed', 'toggleSwimlane', 'moveRecord', 'moveRecords', 'undo', 'redo', 'clearHistory'
      ),
      setColumns: records('columns'),
      setSwimlanes: records('swimlanes'),
      setSearch: records('search'),
      setFilter: records('filter')
    },
    events: [...RECORD_VIEW_EVENTS, 'recordmove', 'movereject', 'recordadd', 'searchchange', 'historychange']
  }],
  ['tree', TreeView, {
    attrs: TREE_ATTRS,
    methods: {
      ...forward(
        'setItems', 'expand', 'collapse', 'toggle', 'expandAll', 'collapseAll', 'reveal', 'select', 'setSelection',
        'clearSelection', 'setChecked', 'check', 'focusNode'
      ),
      setFilter: records('filter')
    },
    events: ['select', 'expand', 'collapse', 'activate', 'check', 'error']
  }],
  ['chart', Chart, {
    attrs: CHART_ATTRS,
    methods: {
      ...forward('setError', 'clearError', 'resize', 'refreshTheme'),
      setData: records('data'),
      setType: records('type'),
      update: records('chartOptions'),
      setAdapter: records('adapter'),
      setLoading: ([loading = true]) => ({ loading })
    },
    events: ['ready', 'update', 'select', 'error']
  }]
]);
