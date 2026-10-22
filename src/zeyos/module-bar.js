import { ModuleBar } from '../components/module-bar/module-bar.js';
import { normalizeAppItems } from '../internal/app-rail.js';
import { moduleIcon } from './icons.js';
import { mergeDestination, normalizeApplication } from './launcher.js';
import { moduleInfo } from './modules.js';

/** @typedef {import('../components/module-bar/module-bar.js').ModuleItem} ModuleItem */
/** @typedef {import('../components/module-bar/module-bar.js').ModuleBarOptions} ModuleBarOptions */
/** @typedef {import('../components/app-sidebar/app-sidebar.js').AppSidebarOptions} AppSidebarOptions */
/**
 * One entry of a module's menu, as the ZeyOS shell describes it: an object, or an
 * `[id, label, href]` array.
 * @typedef {Object} ZeyosMenuEntry
 * @property {string|number} [id] Entry identifier; a section needs none.
 * @property {string} label Entry label.
 * @property {string} [href] Destination.
 * @property {string} [target] Link browsing context.
 * @property {() => void} [invoke] Application-owned action.
 * @property {string|number} [badge] Count.
 * @property {string|Node} [icon] Icon name or node.
 * @property {boolean} [section] A heading over `children` rather than a destination.
 * @property {Array<ZeyosMenuEntry|Array<any>>} [children] Nested entries.
 */
/**
 * The ZeyOS shell state a module bar is built from. The application fields are the launcher's
 * (`buildZeyosLauncherConfig()`), so one state object can feed both.
 * @typedef {Object} ZeyosModuleBarState
 * @property {Record<string, string>|Array<string|Record<string, any>>} [modules={}] Permitted module catalogue.
 * @property {Array<Array<any>|Record<string, any>>} [menuApps=[]] Forks, weblets, and authoritative menu entries.
 * @property {string[]} [pinned] Application identifiers on the bar, in order; the rest are under "All modules".
 * @property {string|null} [activeIdentifier=null] Current module, `fork#…`, or `weblet#…` identifier.
 * @property {string|number|null} [active=null] Current menu entry, when it is more precise than the module.
 * @property {(module: string) => boolean} [canUseModule] Permission predicate.
 * @property {(app: unknown) => Record<string, any>|null} [resolveApplication] Maps an application to href/invoke/value metadata.
 * @property {Record<string, Array<ZeyosMenuEntry|Array<any>>>} [menus={}] Each application's menu, keyed by identifier.
 * @property {Record<string, string|number>} [badges={}] Badges keyed by application identifier or menu entry id.
 * @property {Record<string, string>} [groups={}] "All modules" group per application identifier.
 * @property {{forks?: string, weblets?: string}} [labels] Group labels for forks and weblets.
 * @property {(app: unknown, normalized: Record<string, any>) => Node|null} [renderApplicationIcon] Host icon renderer.
 */
/**
 * @typedef {Object} ZeyosModuleBarOptions
 * @property {boolean} [standardIcons=false] Use stock Font Awesome glyphs instead of the ZeyOS kit.
 * @property {'solid'|'tint'|'plain'} [appearance='solid'] Tile treatment; ZeyOS draws its modules solid.
 */

/**
 * Maps ZeyOS shell state to module bar items: every permitted module, fork, and weblet with its
 * kit icon, its identity colour (the payload's, else the registry's), its menu, and its badge.
 * A module with a menu is a panel module; one without is a destination.
 * @param {ZeyosModuleBarState} [state={}] Application-owned shell state.
 * @param {ZeyosModuleBarOptions} [options={}] Mapping options.
 * @returns {ModuleItem[]}
 */
export function zeyosModuleItems(state = {}, options = {}) {
  const pinned = Array.isArray(state.pinned) ? state.pinned.map(String) : null;
  const menus = state.menus && typeof state.menus === 'object' ? state.menus : {};
  const badges = state.badges && typeof state.badges === 'object' ? state.badges : {};
  const groups = state.groups && typeof state.groups === 'object' ? state.groups : {};
  const labels = { forks: 'Forks', weblets: 'Weblets', ...(state.labels ?? {}) };
  const seen = new Set();
  /** @type {Record<string, any>[]} */
  const items = [];
  const add = (raw, fallbackId = null, fallbackLabel = null) => {
    const app = normalizeApplication(raw, fallbackId, fallbackLabel);
    if (!app || seen.has(app.identifier)) return;
    if (app.type === 'module' && typeof state.canUseModule === 'function' && !state.canUseModule(app.module)) return;
    seen.add(app.identifier);
    const children = menuEntries(menus[app.identifier], badges);
    const destination = children.length ? {} : mergeDestination(app.raw, state.resolveApplication);
    const pin = pinned ? pinned.indexOf(app.identifier) : -1;
    const group = groups[app.identifier]
      ?? (app.type === 'fork' ? labels.forks : app.type === 'weblet' ? labels.weblets : undefined);
    items.push({
      id: app.identifier,
      label: app.label,
      // A factory, so a host renderer or the kit glyph is built per tile rather than shared.
      icon: () => (typeof state.renderApplicationIcon === 'function' ? state.renderApplicationIcon(app.raw, app) : null)
        ?? moduleIcon(app.module, { size: '1em', standard: Boolean(options.standardIcons) }),
      color: app.color ?? moduleInfo(app.module).color,
      module: app.module,
      ...(group ? { group } : {}),
      ...(badges[app.identifier] != null ? { badge: badges[app.identifier] } : {}),
      ...(pinned ? { pinned: pin >= 0 ? pin : false } : {}),
      ...(children.length ? { children } : destination)
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
  return normalizeAppItems(items);
}

/**
 * Builds plain ModuleBar options from ZeyOS shell state.
 * @param {ZeyosModuleBarState} [state={}] Application-owned shell state.
 * @param {ZeyosModuleBarOptions & ModuleBarOptions} [options={}] Mapping and ModuleBar options.
 * @returns {ModuleBarOptions}
 */
export function buildZeyosModuleBarConfig(state = {}, options = {}) {
  const { standardIcons = false, appearance = 'solid', ...barOptions } = options;
  return {
    ...barOptions,
    items: zeyosModuleItems(state, { standardIcons }),
    active: state.active ?? state.activeIdentifier ?? null,
    appearance
  };
}

/**
 * Builds AppSidebar options for the modules layout from ZeyOS shell state: the module strip beside
 * a panel with the current module's menu.
 * @param {ZeyosModuleBarState} [state={}] Application-owned shell state.
 * @param {ZeyosModuleBarOptions & AppSidebarOptions} [options={}] Mapping and AppSidebar options.
 * @returns {AppSidebarOptions}
 */
export function buildZeyosAppSidebarConfig(state = {}, options = {}) {
  const { standardIcons = false, appearance = 'solid', moduleBar = {}, ...sidebarOptions } = options;
  return {
    label: 'ZeyOS',
    ...sidebarOptions,
    layout: 'modules',
    items: zeyosModuleItems(state, { standardIcons }),
    active: state.active ?? state.activeIdentifier ?? null,
    moduleBar: { appearance, ...moduleBar }
  };
}

/**
 * Creates a ModuleBar from ZeyOS shell state.
 * @param {Element|string|null} target Bar target, or null to create one.
 * @param {ZeyosModuleBarState} [state={}] Application-owned shell state.
 * @param {ZeyosModuleBarOptions & ModuleBarOptions} [options={}] Mapping and ModuleBar options.
 * @returns {ModuleBar}
 */
export function zeyosModuleBar(target, state = {}, options = {}) {
  return new ModuleBar(target, buildZeyosModuleBarConfig(state, options));
}

/**
 * Normalizes a ZeyOS menu: objects and `[id, label, href]` arrays, sections, nested entries, and
 * badges looked up by entry id. Entries without a label, and leaves without an id, are dropped.
 * @param {unknown} entries Menu entries.
 * @param {Record<string, string|number>} badges Badges by id.
 * @returns {Record<string, any>[]}
 */
function menuEntries(entries, badges) {
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    if (Array.isArray(entry)) {
      const [id, label, href] = entry;
      if (id == null || label == null) return [];
      return [{
        id, label: String(label),
        ...(href != null ? { href: String(href) } : {}),
        ...(badges[String(id)] != null ? { badge: badges[String(id)] } : {})
      }];
    }
    if (!entry || typeof entry !== 'object' || entry.label == null) return [];
    const children = menuEntries(entry.children, badges);
    if (entry.section === true) {
      return children.length ? [{ ...(entry.id != null ? { id: entry.id } : {}), section: true, label: String(entry.label), children }] : [];
    }
    if (entry.id == null) return [];
    const picked = Object.fromEntries(['id', 'href', 'target', 'invoke', 'icon', 'value', 'disabled']
      .filter((key) => entry[key] !== undefined).map((key) => [key, entry[key]]));
    const badge = badges[String(entry.id)] ?? entry.badge;
    return [{
      ...picked,
      label: String(entry.label),
      ...(badge != null ? { badge } : {}),
      ...(children.length ? { children } : {})
    }];
  });
}
