import { Launcher } from '../components/launcher/launcher.js';
import { moduleChip, zeyosAppIcon } from './icons.js';
import { moduleInfo } from './modules.js';

/** Static application identifiers present in the current ZeyOS shell prototype. */
export const ZEYOS_LAUNCHER_APPLICATIONS = Object.freeze([
  'accounts', 'actionsteps', 'admin', 'auth', 'billing', 'calendar', 'campaigns', 'collection',
  'contacts', 'contracts', 'control', 'coupons', 'dev', 'documents', 'inventory', 'mailinglists',
  'main', 'messages', 'links', 'notes', 'objects', 'opportunities', 'payments', 'pricelists',
  'procurement', 'production', 'projects', 'tasks', 'tickets'
]);

/**
 * @typedef {Object} ZeyosLauncherState
 * @property {Record<string, string>|Array<string|Record<string, any>>} [modules={}] Permitted module catalogue.
 * @property {Array<Array<any>|Record<string, any>>} [menuApps=[]] Forks/weblets and authoritative menu entries.
 * @property {string[]} [pinned=[]] Application identifiers in pinned order.
 * @property {Array<Array<any>|Record<string, any>>} [recent=[]] Recent records.
 * @property {string|null} [activeIdentifier=null] Current module, `fork#…`, or `weblet#…` identifier.
 * @property {(module: string) => boolean} [canUseModule] Permission predicate.
 * @property {(query: string, context: {signal: AbortSignal}) => Promise<unknown>|unknown} [search] Record search loader.
 * @property {(context: {signal: AbortSignal}) => Promise<unknown>|unknown} [loadRecent] Recent-record loader.
 * @property {(app: unknown) => Record<string, any>|null} [resolveApplication] Maps an app to href/invoke/value metadata.
 * @property {(record: unknown) => Record<string, any>|null} [resolveRecord] Maps a record to href/invoke/value metadata.
 * @property {Record<string, any>} [labels] Localized applications/recent/results/entity labels and hints.
 * @property {(app: unknown, normalized: Record<string, any>) => Node|null} [renderApplicationIcon] Host icon renderer for modules, forks, and weblets.
 * @property {(record: unknown, normalized: Record<string, any>) => Node|null} [renderRecordIcon] Host record icon renderer.
 * @property {(app: unknown, normalized: Record<string, any>) => Node|null} [renderWebletIcon] Legacy weblet-only icon renderer.
 */

/**
 * @typedef {Object} ZeyosLauncherOptions
 * @property {boolean} [standardIcons=false] Use stock icon fallbacks instead of the optional ZeyOS kit.
 * @property {Array<Record<string, any>>} [items] Extra generic Launcher items.
 * @property {Array<Record<string, any>>} [sources] Extra generic Launcher sources.
 */

/**
 * Builds a generic Launcher configuration from explicitly injected ZeyOS shell state. It never
 * reads PG/C globals and never resolves a route itself.
 * @param {ZeyosLauncherState} [state={}] Application-owned shell state.
 * @param {ZeyosLauncherOptions & Record<string, any>} [options={}] Adapter and Launcher options.
 * @returns {Record<string, any>} Plain Launcher options.
 */
export function buildZeyosLauncherConfig(state = {}, options = {}) {
  const {
    standardIcons = false,
    items: extraItems = [],
    sources: extraSources = [],
    ...launcherOptions
  } = options;
  const labels = launcherLabels(state.labels);
  const iconOptions = {
    standardIcons,
    renderApplicationIcon: state.renderApplicationIcon,
    renderWebletIcon: state.renderWebletIcon
  };
  const applications = normalizeZeyosLauncherApplications(state, iconOptions);
  const recent = typeof state.loadRecent === 'function' ? []
    : normalizeZeyosLauncherRecords(state.recent ?? [], {
      query: '', labels, resolveRecord: state.resolveRecord,
      renderRecordIcon: state.renderRecordIcon, standardIcons
    });
  const sources = [];
  if (typeof state.loadRecent === 'function') {
    sources.push({
      id: 'zeyos-recent',
      minQuery: 0,
      when: 'empty',
      order: 'source',
      load: async (_query, context) => normalizeZeyosLauncherRecords(
        await state.loadRecent(context),
        {
          query: '', labels, resolveRecord: state.resolveRecord,
          renderRecordIcon: state.renderRecordIcon, standardIcons
        }
      )
    });
  }
  if (typeof state.search === 'function') {
    sources.push({
      id: 'zeyos-records',
      minQuery: 1,
      when: 'query',
      order: 'source',
      load: async (query, context) => normalizeZeyosLauncherRecords(
        await state.search(query, context),
        {
          query, labels, resolveRecord: state.resolveRecord,
          renderRecordIcon: state.renderRecordIcon, standardIcons
        }
      )
    });
  }
  sources.push(...extraSources);
  return {
    ...launcherOptions,
    items: [...applications, ...recent, ...extraItems],
    sources,
    hints: options.hints ?? {
      move: labels.move,
      open: labels.open,
      close: labels.close
    }
  };
}

/**
 * Creates the ZeyOS-configured Launcher. State and route resolvers remain caller-owned inputs.
 * @param {ZeyosLauncherState} [state={}] Injected shell state.
 * @param {ZeyosLauncherOptions & Record<string, any>} [options={}] Adapter and Launcher options.
 * @returns {Launcher}
 */
export function zeyosLauncher(state = {}, options = {}) {
  return new Launcher(null, buildZeyosLauncherConfig(state, options));
}

/**
 * Normalizes module, fork, and weblet applications while preserving menu authority and pin order.
 * @param {ZeyosLauncherState} [state={}] Injected shell state.
 * @param {{standardIcons?: boolean, renderApplicationIcon?: Function, renderWebletIcon?: Function}} [options={}] Icon options.
 * @returns {Array<Record<string, any>>}
 */
export function normalizeZeyosLauncherApplications(state = {}, options = {}) {
  const labels = launcherLabels(state.labels);
  const pinned = Array.isArray(state.pinned) ? state.pinned.map(String) : [];
  const seen = new Set();
  const items = [];
  const add = (raw, fallbackId = null, fallbackLabel = null) => {
    const app = normalizeApplication(raw, fallbackId, fallbackLabel);
    if (!app || seen.has(app.identifier)) return;
    if (app.type === 'module' && typeof state.canUseModule === 'function'
      && !state.canUseModule(app.module)) return;
    seen.add(app.identifier);
    const resolved = mergeDestination(app.raw, state.resolveApplication);
    const pin = pinned.indexOf(app.identifier);
    const icon = () => {
      const custom = typeof options.renderApplicationIcon === 'function'
        ? options.renderApplicationIcon(app.raw, app)
        : app.type === 'weblet' && typeof options.renderWebletIcon === 'function'
          ? options.renderWebletIcon(app.raw, app) : null;
      return custom ?? zeyosAppIcon(app.module, {
        size: 36,
        standard: Boolean(options.standardIcons),
        color: app.color
      });
    };
    items.push({
      id: app.identifier,
      label: app.label,
      keywords: [app.identifier, app.module],
      group: labels.applications,
      groupOrder: 0,
      kind: 'application',
      icon,
      pinned: pin >= 0 ? pin : undefined,
      current: app.identifier === state.activeIdentifier,
      disabled: !resolved.href && typeof resolved.invoke !== 'function',
      ...resolved,
      _zeyos: app
    });
  };

  for (const raw of Array.isArray(state.menuApps) ? state.menuApps : []) add(raw);
  if (Array.isArray(state.modules)) {
    for (const module of state.modules) {
      if (typeof module === 'string') add([module, moduleInfo(module).label]);
      else add(module, module?.id ?? module?.module, module?.label);
    }
  } else {
    for (const [module, label] of Object.entries(state.modules ?? {})) add([module, label]);
  }
  return items;
}

/**
 * Normalizes recent records or grouped search payloads without losing server/group order.
 * @param {unknown} payload Recent/search payload.
 * @param {{query?: string, labels?: Record<string, any>, resolveRecord?: Function, renderRecordIcon?: Function, standardIcons?: boolean}} [options={}] Mapping options.
 * @returns {Array<Record<string, any>>}
 */
export function normalizeZeyosLauncherRecords(payload, options = {}) {
  const query = String(options.query ?? '');
  const labels = launcherLabels(options.labels);
  const records = flattenRecords(payload, query);
  const groupOrders = new Map();
  return records.flatMap(({ raw, group }, itemOrder) => {
    const record = normalizeRecord(raw, group, query);
    if (!record) return [];
    const groupName = query === '' ? labels.recent
      : record.group === '' ? labels.results
        : labels.entities[record.group] ?? record.group;
    if (!groupOrders.has(groupName)) groupOrders.set(groupName, groupOrders.size + 1);
    const resolved = mergeDestination(record.raw, options.resolveRecord);
    return [{
      id: `record:${record.entity}:${record.fork ?? ''}:${record.ID}`,
      label: record.name,
      description: record.sec,
      keywords: [record.entity, record.ID, record.fork ?? ''],
      group: groupName,
      groupOrder: groupOrders.get(groupName),
      itemOrder,
      kind: 'record',
      when: query === '' ? 'empty' : 'query',
      icon: () => {
        const custom = typeof options.renderRecordIcon === 'function'
          ? options.renderRecordIcon(record.raw, record) : null;
        return custom ?? moduleChip(record.entity, {
          size: 28,
          standard: Boolean(options.standardIcons)
        });
      },
      disabled: !resolved.href && typeof resolved.invoke !== 'function',
      ...resolved,
      _zeyos: record
    }];
  });
}

/** @param {{module?: string, fork?: unknown, weblet?: unknown}} state @returns {string} */
export function zeyosActiveIdentifier(state = {}) {
  if (state.weblet != null && state.weblet !== '') return `weblet#${state.weblet}`;
  if (state.fork != null && state.fork !== '') return `fork#${state.fork}`;
  return String(state.module ?? '');
}

/** @param {unknown} raw @param {string|null} fallbackId @param {unknown} fallbackLabel @returns {Record<string, any>|null} */
function normalizeApplication(raw, fallbackId, fallbackLabel) {
  if (Array.isArray(raw)) {
    if (raw.length < 2) return null;
    if (raw.length === 2) {
      const module = String(raw[0]);
      return { raw, identifier: module, label: String(raw[1]), module, type: 'module', color: null };
    }
    if (raw.length === 4) {
      const module = String(raw[2] || 'default');
      return {
        raw, identifier: `fork#${raw[0]}`, label: String(raw[1]), module, type: 'fork',
        color: normalizeServerColor(raw[3])
      };
    }
    return {
      raw, identifier: `weblet#${raw[0]}`, label: String(raw[1]), module: 'weblets',
      type: 'weblet', color: normalizeServerColor(raw[8])
    };
  }
  if (!raw || typeof raw !== 'object') return null;
  const identifier = String(raw.identifier ?? raw.id ?? fallbackId ?? '');
  if (!identifier) return null;
  const type = identifier.startsWith('fork#') ? 'fork'
    : identifier.startsWith('weblet#') ? 'weblet' : 'module';
  return {
    raw,
    identifier,
    label: String(raw.label ?? fallbackLabel ?? moduleInfo(identifier).label),
    module: String(raw.module ?? (type === 'module' ? identifier : type === 'fork' ? 'default' : 'weblets')),
    type,
    color: normalizeServerColor(raw.color)
  };
}

/** @param {unknown} payload @param {string} query @returns {Array<{raw: unknown, group: string}>} */
function flattenRecords(payload, query) {
  if (Array.isArray(payload)) return payload.map((raw) => ({ raw, group: raw?.group ?? '' }));
  if (!payload || typeof payload !== 'object') return [];
  const result = [];
  for (const [group, rows] of Object.entries(payload)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!Array.isArray(row)) {
        result.push({ raw: row, group });
        continue;
      }
      // Search payloads use [ID,fork,name,sec] under an entity key; top results carry entity last.
      const raw = group === '' && row.length >= 5
        ? { ID: row[0], fork: row[1], name: row[2], sec: row[3], entity: row[4], group }
        : { ID: row[0], fork: row[1], name: row[2], sec: row[3], entity: group, group };
      result.push({ raw, group });
    }
  }
  return result;
}

/** @param {unknown} raw @param {string} group @param {string} query @returns {Record<string, any>|null} */
function normalizeRecord(raw, group, query) {
  if (Array.isArray(raw)) {
    if (query === '' && raw.length >= 4) {
      return {
        raw, entity: String(raw[0]), ID: raw[1], fork: raw[2] ?? null,
        name: String(raw[3]), sec: String(raw[4] ?? ''), group: ''
      };
    }
    return null;
  }
  if (!raw || typeof raw !== 'object' || raw.ID == null || raw.name == null) return null;
  return {
    raw,
    entity: String(raw.entity ?? group ?? 'records'),
    ID: raw.ID,
    fork: raw.fork ?? null,
    name: String(raw.name),
    sec: String(raw.sec ?? ''),
    group: String(raw.group ?? group ?? '')
  };
}

/** @param {unknown} raw @param {unknown} resolver @returns {Record<string, any>} */
function mergeDestination(raw, resolver) {
  const direct = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const resolved = typeof resolver === 'function' ? resolver(raw) : null;
  const destination = resolved && typeof resolved === 'object' ? resolved : {};
  return Object.fromEntries(['href', 'target', 'invoke', 'value'].flatMap((key) => {
    const value = destination[key] ?? direct[key];
    return value === undefined ? [] : [[key, value]];
  }));
}

/** @param {unknown} value @returns {string|null} */
function normalizeServerColor(value) {
  const source = String(value ?? '').trim();
  if (!source) return null;
  const color = source.startsWith('#') ? source : `#${source}`;
  return /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(color) ? color : null;
}

/** @param {unknown} input @returns {Record<string, any>} */
function launcherLabels(input) {
  const labels = input && typeof input === 'object' ? input : {};
  return {
    applications: String(labels.applications ?? 'Applications'),
    recent: String(labels.recent ?? 'Recent'),
    results: String(labels.results ?? 'Top results'),
    entities: labels.entities && typeof labels.entities === 'object' ? labels.entities : {},
    move: String(labels.move ?? 'Move'),
    open: String(labels.open ?? 'Open'),
    close: String(labels.close ?? 'Close')
  };
}
