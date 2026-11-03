import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { ContextMenu } from '../components/context-menu/context-menu.js';
import { MenuButton } from '../components/menu-button/menu-button.js';

/**
 * One action a row offers: a repeated, secondary command such as "Add sub-page" or "Rename".
 * @typedef {Object} RowAction
 * @property {string} label What the action does; the tooltip, and with the row's name its
 *   accessible name.
 * @property {string} [icon] Icon name. Inline actions show only the icon.
 * @property {(subject: any) => void} onSelect Runs the action for the row's node or item.
 * @property {boolean} [disabled=false] Whether the action is unavailable on this row.
 * @property {boolean} [danger=false] Whether the action destroys something; menus colour it.
 */
/** @typedef {RowAction|Node} RowActionEntry */
/**
 * The controls built for one row.
 * @typedef {Object} RowActionStrip
 * @property {HTMLElement} element The strip, marked `data-zx-reveal`.
 * @property {RowAction[]} actions Every descriptor of the row, inline and folded, in order — what
 *   the row's context menu lists. Inline buttons and menu items carry indexes into it.
 * @property {MenuButton|null} menu The overflow menu, when actions were folded.
 * @property {() => void} destroy Destroys the overflow menu.
 */
/** A row never carries more controls than this before the rest fold into a menu. */
export const ROW_ACTION_LIMIT = 2;

/**
 * Whether an entry is a control of the application's own, placed in the row as given.
 * @param {unknown} entry Candidate entry.
 * @returns {entry is Node}
 */
export function isRowActionNode(entry) {
  return Boolean(entry) && typeof entry === 'object'
    && typeof /** @type {{nodeType?: unknown}} */ (entry).nodeType === 'number';
}

/**
 * Whether an entry is a usable action descriptor: a label and something to run.
 * @param {unknown} entry Candidate entry.
 * @returns {entry is RowAction}
 */
export function isRowAction(entry) {
  if (!entry || typeof entry !== 'object' || isRowActionNode(entry)) return false;
  const action = /** @type {Record<string, unknown>} */ (entry);
  return action.label != null && String(action.label) !== '' && typeof action.onSelect === 'function';
}

/**
 * Decides which entries a row shows and which fold into its overflow menu. One or two entries all
 * show; with more, the first shows and the descriptors after it fold, so a row carries at most two
 * controls of its own. A node is the application's control and never folds.
 * @param {unknown} entries What `rowActions` or `actions` returned.
 * @returns {{inline: RowActionEntry[], overflow: RowAction[]}}
 */
export function planRowActions(entries) {
  const valid = /** @type {RowActionEntry[]} */ ((Array.isArray(entries) ? entries : [])
    .filter((entry) => isRowActionNode(entry) || isRowAction(entry)));
  if (valid.length <= ROW_ACTION_LIMIT) return { inline: valid, overflow: [] };
  const [first, ...rest] = valid;
  return {
    inline: [first, ...rest.filter(isRowActionNode)],
    overflow: /** @type {RowAction[]} */ (rest.filter((entry) => !isRowActionNode(entry)))
  };
}

/**
 * An action control's accessible name, which says which row it acts on: on a list of rows every
 * "Rename" button is otherwise the same button. The action comes first, so a screen reader's
 * list of buttons still sorts by what they do.
 * @param {string} action Action label.
 * @param {string} name The row's name.
 * @returns {string}
 */
export function rowActionLabel(action, name) {
  const row = String(name ?? '').trim();
  return row ? `${String(action).trim()}: ${row}` : String(action).trim();
}

/**
 * Menu items for descriptors, valued by their index in `actions`.
 * @param {RowAction[]} actions The row's descriptors.
 * @param {RowAction[]} [only=actions] The descriptors to list.
 * @returns {Array<{label: string, icon?: string, value: number, danger: boolean, disabled: boolean}>}
 */
export function menuEntries(actions, only = actions) {
  return only.map((action) => ({
    label: String(action.label),
    icon: action.icon ? String(action.icon) : undefined,
    value: actions.indexOf(action),
    danger: Boolean(action.danger),
    disabled: Boolean(action.disabled)
  }));
}

/**
 * Builds a row's action strip: an icon button per inline descriptor, the given nodes, and the
 * overflow menu. Every control starts outside the Tab order; the host component makes the strip
 * of the row holding focus tabbable. Inline buttons carry `data-row-action`, an index into
 * `actions`, so the host runs them from its own delegated click listener.
 * @param {unknown} entries Row actions.
 * @param {{block: string, name: string, moreLabel?: string, run: (action: RowAction) => void}} options
 *   `block` names the parts (`zx-<block>__actions`, `zx-<block>__action`); `name` is the row's
 *   name; `moreLabel` names the overflow menu ("More actions"); `run` is called with a descriptor
 *   chosen from the overflow menu.
 * @returns {RowActionStrip|null} Null when nothing usable was given.
 */
export function renderRowActions(entries, { block, name, moreLabel = 'More actions', run }) {
  const plan = planRowActions(entries);
  if (plan.inline.length === 0) return null;
  const actions = /** @type {RowAction[]} */ ((Array.isArray(entries) ? entries : []).filter(isRowAction));
  const element = /** @type {HTMLElement} */ (h('span', { class: `zx-${block}__actions`, 'data-zx-reveal': '' }));

  for (const entry of plan.inline) {
    if (isRowActionNode(entry)) {
      element.append(entry);
      continue;
    }
    element.append(h('button', {
      type: 'button',
      class: ['zx-icon-btn', `zx-${block}__action`],
      ariaLabel: rowActionLabel(entry.label, name),
      title: String(entry.label),
      disabled: Boolean(entry.disabled),
      dataset: { rowAction: String(actions.indexOf(entry)) }
    }, icon(entry.icon ? String(entry.icon) : 'dots')));
  }

  let menu = null;
  if (plan.overflow.length > 0) {
    menu = new MenuButton(null, {
      icon: 'dots',
      label: '',
      kind: 'ghost',
      placement: 'bottom-end',
      items: menuEntries(actions, plan.overflow)
    });
    const trigger = menu.getTrigger();
    trigger.classList.add(`zx-${block}__action`, `zx-${block}__more`);
    trigger.setAttribute('aria-label', rowActionLabel(moreLabel, name));
    trigger.title = String(moreLabel);
    menu.on('select', (event) => {
      const action = actions[Number(/** @type {CustomEvent} */ (event).detail.value)];
      if (action && !action.disabled) run(action);
    });
    // The menu's own bubbling events stop at the trigger: a listener for the row component's
    // `zx-select` must never hear an action chosen from a row's menu.
    for (const type of ['zx-select', 'zx-open', 'zx-close']) {
      menu.listen(trigger, type, (event) => event.stopPropagation());
    }
    element.append(trigger);
  }

  setRowActionsTabbable(element, false);
  return {
    element,
    actions,
    menu,
    destroy: () => menu?.destroy()
  };
}

/**
 * Puts every control in a strip in or out of the Tab order.
 * @param {Element|null|undefined} element A strip.
 * @param {boolean} tabbable Whether its controls are Tab stops.
 * @returns {void}
 */
export function setRowActionsTabbable(element, tabbable) {
  if (!element) return;
  const controls = element.querySelectorAll('button, a[href], input, select, textarea, [tabindex]');
  for (const control of controls) /** @type {HTMLElement} */ (control).tabIndex = tabbable ? 0 : -1;
}

/**
 * The context menu of a component's rows: every descriptor of the row it opens on. Choosing an
 * item closes the menu, which returns focus to the row, and only then runs the action — so a
 * dialog the action opens records the row as the place to return to.
 * @param {Element} target The element holding the rows.
 * @param {string} selector The rows.
 * @param {(row: Element) => {actions: RowAction[], subject: unknown}|null} resolve The row's
 *   descriptors and what their `onSelect` receives.
 * @returns {ContextMenu}
 */
export function rowActionMenu(target, selector, resolve) {
  const menu = new ContextMenu(target, {
    selector,
    items: (context) => {
      const found = context ? resolve(context) : null;
      return found ? menuEntries(found.actions) : [];
    }
  });
  menu.on('select', (event) => {
    const { value, context } = /** @type {CustomEvent} */ (event).detail;
    event.preventDefault();
    const found = context ? resolve(context) : null;
    const action = found?.actions[Number(value)];
    menu.close();
    if (action && !action.disabled) action.onSelect(found.subject);
  });
  return menu;
}
