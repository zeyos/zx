// @ts-check
import { h, safeHref } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { uid } from '../../core/util.js';
import { readViewField, renderViewField } from '../view/record-view.js';

/** @typedef {Record<string, any>} ViewRecord */
/** @typedef {import('../view/record-view.js').ViewField} ViewField */
/** @typedef {string|((record:ViewRecord,index:number)=>unknown)|null} RecordCardValueSource */

/**
 * @typedef {Object} RecordCardPreviewDescriptor
 * @property {string} src Image URL.
 * @property {string} [alt] Image alternative text.
 * @property {'cover'|'contain'|'fill'|'none'|'scale-down'} [fit='cover'] Image fitting behavior.
 */

/** @typedef {string|Node|RecordCardPreviewDescriptor|null} RecordCardPreview */

/**
 * @typedef {Object} RecordCardLinkDescriptor
 * @property {string} href Native link destination.
 * @property {string} [target] Native browsing context.
 * @property {string} [rel] Native link relationship.
 */

/** @typedef {string|RecordCardLinkDescriptor|null} RecordCardLink */

/**
 * @typedef {Object} RecordCardAction
 * @property {string} id Stable delegated-action identifier.
 * @property {string} [label=''] Visible action label.
 * @property {string|null} [icon=null] Optional Zx icon name.
 * @property {string} [title] Accessible/native title, especially for an icon-only action.
 * @property {string} [href] Optional safe native link destination; otherwise a button is rendered.
 * @property {string} [target] Native link browsing context.
 * @property {string} [rel] Native link relationship.
 * @property {boolean} [disabled=false] Whether a button action is unavailable.
 * @property {(record:ViewRecord,index:number,event:MouseEvent)=>void} [onclick]
 * Callback invoked by an owning view's delegated listener; this helper never installs listeners.
 */

/**
 * @typedef {Object} RecordCardOptions
 * @property {ViewField[]} [fields=[]] Complete fields, used to resolve title and subtitle sources.
 * @property {ViewField[]} [visibleFields=fields] Ordered fields rendered as labelled metadata.
 * @property {RecordCardValueSource} [titleField=null] Field id or explicit value resolver.
 * @property {RecordCardValueSource} [subtitleField=null] Field id or explicit value resolver.
 * @property {string|((record:ViewRecord,index:number)=>RecordCardPreview)} [preview]
 * Preview field id or explicit resolver.
 * @property {string|((record:ViewRecord,index:number)=>unknown)|null} [previewAlt=null]
 * Alternative-text field, literal text, or resolver.
 * @property {RecordCardLink|((record:ViewRecord,index:number)=>RecordCardLink)} [link]
 * @property {RecordCardAction[]|((record:ViewRecord,index:number)=>RecordCardAction[])} [actions=[]]
 * @property {false|'single'|'multi'} [selectable=false] Selection presentation.
 * @property {boolean} [selected=false] Current selection state.
 * @property {'outlined'|'raised'|'filled'} [variant='outlined'] Surface treatment.
 * @property {1|2|3|4|5|6} [headingLevel=3] Card title heading level.
 * @property {Node[]} [controls=[]] Listener-free, owner-created controls such as a move handle.
 */

/**
 * @typedef {Object} ResolvedRecordPreview
 * @property {Node|null} node Explicit preview node.
 * @property {string|null} src Safe image URL, or null when rejected.
 * @property {string} alt Alternative text.
 * @property {'cover'|'contain'|'fill'|'none'|'scale-down'} fit Image fitting behavior.
 * @property {boolean} rejected Whether a supplied URL was unsafe or malformed.
 */

/**
 * Builds the listener-free card anatomy shared by CardView and KanbanView. All primitive content
 * becomes text, URLs are normalized before reaching native attributes, and actions expose stable
 * data attributes for a component-owned delegated listener.
 *
 * The returned `<li>` belongs in a semantic `<ul>`/`<ol>`. When selectable it carries
 * `aria-selected`; multi-selection adds a native checkbox. It deliberately retains list-item
 * semantics rather than becoming an ARIA option because cards may contain native links and
 * buttons, which the listbox pattern does not permit inside an option. Preview images are paired
 * with a stable fallback. The owning component listens for image `error` and marks the fallback.
 *
 * @param {ViewRecord} record Record to render.
 * @param {number} index Current display index.
 * @param {RecordCardOptions} [options={}] Rendering options.
 * @returns {HTMLLIElement} Semantic record card list item.
 */
export function createRecordCard(record, index, options = {}) {
  const fields = Array.isArray(options.fields) ? options.fields : [];
  const visibleFields = Array.isArray(options.visibleFields) ? options.visibleFields : fields;
  const titleSource = options.titleField ?? fields[0]?.id ?? null;
  const subtitleSource = options.subtitleField ?? null;
  const title = resolveRecordCardContent(record, index, titleSource, fields);
  const subtitle = resolveRecordCardContent(record, index, subtitleSource, fields);
  const preview = resolveRecordPreview(record, index, options.preview, options.previewAlt, fields);
  const link = resolveRecordLink(record, index, options.link);
  const actions = resolveRecordActions(record, index, options.actions);
  const controls = normalizeControls(options.controls);
  const selectable = normalizeSelectable(options.selectable);
  const selected = Boolean(options.selected);
  const headingId = uid('zx-record-card-title');
  const headingLevel = normalizeHeadingLevel(options.headingLevel);

  const headingContent = link
    ? h('a', {
      class: 'zx-record-card__primary',
      href: link.href,
      target: link.target,
      rel: link.rel
    }, contentNode(title))
    : h('span', { class: 'zx-record-card__title' }, contentNode(title));
  const heading = h(`h${headingLevel}`, {
    class: 'zx-record-card__heading',
    id: headingId
  }, headingContent);
  const selection = selectable === 'multi' ? h('label', {
    class: 'zx-record-card__selection'
  }, h('input', {
    type: 'checkbox',
    checked: selected,
    dataset: { recordSelection: '' },
    ariaLabel: `Select ${textAlternative(title) || 'record'}`
  })) : null;
  const actionNodes = actions.map(createAction);
  const actionArea = actionNodes.length || controls.length ? h('div', {
    class: 'zx-record-card__actions',
    role: 'group',
    ariaLabel: `Actions for ${textAlternative(title) || 'record'}`
  }, controls, actionNodes) : null;
  const header = h('header', { class: 'zx-record-card__header' }, selection,
    h('div', { class: 'zx-record-card__titles' }, heading,
      isEmptyContent(subtitle) ? null : h('p', { class: 'zx-record-card__subtitle' }, contentNode(subtitle))),
    actionArea);
  const metadata = createMetadata(record, index, visibleFields, titleSource, subtitleSource);
  const body = h('div', { class: 'zx-record-card__body' }, header, metadata);
  const card = /** @type {HTMLLIElement} */ (h('li', {
    class: 'zx-record-card',
    tabindex: 0,
    ariaSelected: selectable ? String(selected) : undefined,
    ariaLabelledby: headingId,
    dataset: {
      recordIndex: String(index),
      variant: normalizeVariant(options.variant),
      selected: String(selected)
    }
  }, preview ? createPreview(preview) : null, body));
  return card;
}

/**
 * Resolves a preview without touching the DOM. Unsafe, malformed, and non-image URL schemes are
 * rejected into the same descriptor shape so callers can still render the stable fallback.
 * @param {ViewRecord} record Record.
 * @param {number} index Display index.
 * @param {RecordCardOptions['preview']} preview Preview field or resolver.
 * @param {RecordCardOptions['previewAlt']} previewAlt Alt field, literal, or resolver.
 * @param {ViewField[]} [fields=[]] Complete fields.
 * @returns {ResolvedRecordPreview|null} Resolved preview.
 */
export function resolveRecordPreview(record, index, preview, previewAlt, fields = []) {
  if (preview == null) return null;
  const candidate = typeof preview === 'function'
    ? preview(record, index)
    : readRecordSource(record, index, preview, fields, false);
  if (candidate == null || candidate === '') return null;
  const explicitAlt = resolvePreviewAlt(record, index, previewAlt, fields);
  if (isNode(candidate)) {
    return { node: candidate, src: null, alt: explicitAlt, fit: 'cover', rejected: false };
  }
  const descriptor = typeof candidate === 'object' && !Array.isArray(candidate)
    ? /** @type {RecordCardPreviewDescriptor} */ (candidate)
    : { src: String(candidate) };
  const source = typeof descriptor.src === 'string' ? descriptor.src : '';
  const src = safePreviewUrl(source);
  return {
    node: null,
    src,
    alt: descriptor.alt == null ? explicitAlt : String(descriptor.alt),
    fit: normalizePreviewFit(descriptor.fit),
    rejected: src === null
  };
}

/**
 * Resolves and validates a native title link without touching the DOM.
 * @param {ViewRecord} record Record.
 * @param {number} index Display index.
 * @param {RecordCardOptions['link']} link Link value or resolver.
 * @returns {RecordCardLinkDescriptor|null} Safe normalized link.
 */
export function resolveRecordLink(record, index, link) {
  const candidate = typeof link === 'function' ? link(record, index) : link;
  if (candidate == null) return null;
  const descriptor = typeof candidate === 'string' ? { href: candidate } : candidate;
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) return null;
  const href = safeHref(descriptor.href);
  if (href === null) return null;
  const target = descriptor.target == null ? undefined : String(descriptor.target);
  const rel = safeRel(descriptor.rel, target);
  return { href, ...(target ? { target } : {}), ...(rel ? { rel } : {}) };
}

/**
 * Resolves and clones delegated action descriptors. Invalid entries are omitted rather than
 * creating unnamed or ambiguously interactive controls.
 * @param {ViewRecord} record Record.
 * @param {number} index Display index.
 * @param {RecordCardOptions['actions']} actions Actions or resolver.
 * @returns {RecordCardAction[]} Normalized action copies.
 */
export function resolveRecordActions(record, index, actions) {
  const candidate = typeof actions === 'function' ? actions(record, index) : actions;
  if (!Array.isArray(candidate)) return [];
  return candidate.flatMap((action) => {
    if (!action || typeof action !== 'object' || Array.isArray(action)) return [];
    const id = String(action.id ?? '').trim();
    const label = String(action.label ?? '');
    const title = action.title == null ? '' : String(action.title);
    if (!id || (!label && !title)) return [];
    if (action.href != null && safeHref(action.href) === null) return [];
    return [{ ...action, id, label, ...(title ? { title } : {}) }];
  });
}

/** @param {ResolvedRecordPreview} preview @returns {HTMLElement} */
function createPreview(preview) {
  const fallback = h('span', {
    class: 'zx-record-card__preview-fallback',
    ariaHidden: 'true'
  }, icon('file', { size: 24 }));
  if (preview.node) {
    return h('div', { class: 'zx-record-card__preview' }, preview.node);
  }
  const image = preview.src ? h('img', {
    class: 'zx-record-card__preview-image',
    src: preview.src,
    alt: preview.alt,
    loading: 'lazy',
    decoding: 'async',
    dataset: { recordPreview: '' },
    style: { objectFit: preview.fit }
  }) : null;
  return h('div', {
    class: 'zx-record-card__preview',
    dataset: { failed: String(preview.rejected) }
  }, fallback, image);
}

/**
 * @param {ViewRecord} record
 * @param {number} index
 * @param {ViewField[]} fields
 * @param {RecordCardValueSource} titleSource
 * @param {RecordCardValueSource} subtitleSource
 * @returns {HTMLElement|null}
 */
function createMetadata(record, index, fields, titleSource, subtitleSource) {
  const titleId = typeof titleSource === 'string' ? titleSource : null;
  const subtitleId = typeof subtitleSource === 'string' ? subtitleSource : null;
  const visible = fields.filter((field) => field.duplicate || field.id !== titleId && field.id !== subtitleId);
  if (visible.length === 0) return null;
  return h('dl', { class: 'zx-record-card__metadata' }, visible.map((field) => h('div', {
    class: 'zx-record-card__field',
    dataset: { fieldId: field.id }
  }, h('dt', { class: 'zx-record-card__label' }, field.label),
  h('dd', { class: 'zx-record-card__value' }, contentNode(renderViewField(field, record, index))))));
}

/** @param {RecordCardAction} action @returns {HTMLElement} */
function createAction(action) {
  const label = String(action.label ?? '');
  const title = String(action.title ?? (label || action.id));
  const children = [action.icon ? icon(String(action.icon), { size: 14 }) : null,
    label ? h('span', { class: 'zx-record-card__action-label' }, label) : null];
  const href = action.href == null ? null : safeHref(action.href);
  if (href && !action.disabled) {
    const target = action.target == null ? undefined : String(action.target);
    return h('a', {
      class: 'zx-record-card__action',
      href,
      target,
      rel: safeRel(action.rel, target),
      title,
      ariaLabel: label || title,
      dataset: { recordAction: action.id }
    }, children);
  }
  return h('button', {
    class: 'zx-record-card__action',
    type: 'button',
    disabled: Boolean(action.disabled),
    title,
    ariaLabel: label || title,
    dataset: { recordAction: action.id }
  }, children);
}

/** @param {ViewRecord} record @param {number} index @param {RecordCardValueSource} source @param {ViewField[]} fields @returns {unknown} */
function resolveRecordCardContent(record, index, source, fields) {
  if (source == null) return '';
  if (typeof source === 'function') return source(record, index);
  const field = fields.find((candidate) => candidate.id === source);
  return field ? renderViewField(field, record, index) : record?.[source] ?? '';
}

/**
 * @param {ViewRecord} record @param {number} index @param {string} source @param {ViewField[]} fields
 * @param {boolean} literalFallback @returns {unknown}
 */
function readRecordSource(record, index, source, fields, literalFallback) {
  const field = fields.find((candidate) => candidate.id === source);
  if (field) return readViewField(field, record, index);
  if (Object.prototype.hasOwnProperty.call(record, source)) return record[source];
  return literalFallback ? source : null;
}

/** @param {ViewRecord} record @param {number} index @param {RecordCardOptions['previewAlt']} source @param {ViewField[]} fields @returns {string} */
function resolvePreviewAlt(record, index, source, fields) {
  if (source == null) return '';
  const value = typeof source === 'function'
    ? source(record, index)
    : readRecordSource(record, index, source, fields, true);
  return value == null ? '' : String(value);
}

/** @param {unknown} content @returns {Node|string} */
function contentNode(content) {
  return isNode(content) ? content : content == null ? '' : String(content);
}

/** @param {unknown} content @returns {boolean} */
function isEmptyContent(content) {
  return content == null || typeof content !== 'object' && String(content) === '';
}

/** @param {unknown} content @returns {string} */
function textAlternative(content) {
  if (isNode(content)) return content.textContent?.trim() ?? '';
  return content == null ? '' : String(content).trim();
}

/** @param {unknown} value @returns {value is Node} */
function isNode(value) {
  return Boolean(value && typeof value === 'object'
    && typeof /** @type {{nodeType?:unknown}} */ (value).nodeType === 'number');
}

/** @param {unknown} controls @returns {Node[]} */
function normalizeControls(controls) {
  return Array.isArray(controls) ? controls.filter(isNode) : [];
}

/** @param {unknown} value @returns {string|null} */
function safePreviewUrl(value) {
  const href = safeHref(value);
  if (!href) return null;
  try {
    const base = globalThis.location?.href ?? 'https://zx.invalid/';
    const protocol = new URL(href, base).protocol.toLowerCase();
    return ['http:', 'https:', 'blob:', 'file:'].includes(protocol) ? href : null;
  } catch {
    return null;
  }
}

/** @param {unknown} rel @param {string|undefined} target @returns {string|undefined} */
function safeRel(rel, target) {
  const tokens = String(rel ?? '').split(/\s+/).filter((token) => /^[a-z-]+$/i.test(token));
  if (target === '_blank' && !tokens.includes('noopener')) tokens.push('noopener');
  return tokens.length ? [...new Set(tokens)].join(' ') : undefined;
}

/** @param {unknown} value @returns {false|'single'|'multi'} */
function normalizeSelectable(value) {
  return value === 'single' || value === 'multi' ? value : false;
}

/** @param {unknown} value @returns {'outlined'|'raised'|'filled'} */
function normalizeVariant(value) {
  return value === 'raised' || value === 'filled' ? value : 'outlined';
}

/** @param {unknown} value @returns {1|2|3|4|5|6} */
function normalizeHeadingLevel(value) {
  const number = Number(value ?? 3);
  return /** @type {1|2|3|4|5|6} */ (Number.isInteger(number) && number >= 1 && number <= 6 ? number : 3);
}

/** @param {unknown} value @returns {'cover'|'contain'|'fill'|'none'|'scale-down'} */
function normalizePreviewFit(value) {
  return ['contain', 'fill', 'none', 'scale-down'].includes(String(value))
    ? /** @type {'contain'|'fill'|'none'|'scale-down'} */ (value) : 'cover';
}
