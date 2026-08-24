import { Component } from '../../core/component.js';
import { h, restoreTarget, safeHref, snapshotTarget } from '../../core/dom.js';
import { isElement, uid } from '../../core/util.js';
import { button } from '../button/button.js';

/** @typedef {string|Node|Component|null} CardContent */
/** @typedef {import('../button/button.js').ButtonOptions} ButtonOptions */
/** @typedef {Element|ButtonOptions} CardAction */
/**
 * @typedef {Object} CardLinkDescriptor
 * @property {string} href Native link destination; executable/data schemes are rejected.
 * @property {string} [target] Native browsing context.
 * @property {string} [rel] Native link relationship.
 * @property {(event: MouseEvent) => void} [onclick] Native click listener.
 */
/** @typedef {string|CardLinkDescriptor|null} CardLink */

/**
 * @typedef {Object} CardOptions
 * @property {string} [title=''] Card title.
 * @property {CardContent} [media=null] Optional image, avatar, icon, or other media.
 * @property {CardContent} [content=null] Main card content; enhanced children are adopted by default.
 * @property {CardAction[]} [actions=[]] Secondary native controls beside the title.
 * @property {CardContent} [footer=null] Optional metadata or trailing content.
 * @property {CardLink} [link=null] Optional native primary link rendered around the title.
 * @property {'outlined'|'raised'|'filled'} [variant='outlined'] Surface treatment.
 * @property {'vertical'|'horizontal'} [orientation='vertical'] Media/content arrangement.
 * @property {1|2|3|4|5|6} [headingLevel=3] Semantic title heading level.
 */

/**
 * Semantic content or record surface with optional media, native primary link, actions, and footer.
 * The root is never interactive: linked cards keep a real title anchor, so secondary controls are
 * siblings rather than invalid nested actions.
 * @extends {Component<CardOptions>}
 */
export class Card extends Component {
  static cssName = 'card';

  /** @type {Readonly<CardOptions>} */
  static defaults = {
    title: '',
    media: null,
    content: null,
    actions: [],
    footer: null,
    link: null,
    variant: 'outlined',
    orientation: 'vertical',
    headingLevel: 3
  };

  /**
   * Creates or enhances one card.
   * @param {Element|string|null} [target=null] Existing card container, selector, or null.
   * @param {CardOptions} [options={}] Card options.
   */
  constructor(target = null, options = {}) {
    super(target, options);
  }

  /** @returns {HTMLElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('article'));
    this.el = root;
    this._createdRoot = created;
    this._original = created ? null : snapshotTarget(root);
    this._cleaned = false;
    this._title = '';
    this._link = null;
    this._actionAbort = null;
    this._linkAbort = null;

    const originalContent = created ? [] : Array.from(root.childNodes);
    try {
      const headingLevel = normalizeHeadingLevel(this.options.headingLevel);
      const headingId = uid('zx-card-heading');
      const heading = h(`h${headingLevel}`, {
        ref: 'heading',
        class: 'zx-card__heading',
        id: headingId
      });
      const media = h('div', { ref: 'media', class: 'zx-card__media', hidden: true });
      const actions = h('div', {
        ref: 'actions',
        class: 'zx-card__actions',
        role: 'group',
        ariaLabel: 'Card actions',
        hidden: true
      });
      const content = h('div', { ref: 'content', class: 'zx-card__content', hidden: true });
      const footer = h('footer', { ref: 'footer', class: 'zx-card__footer', hidden: true });
      const header = h('header', { ref: 'header', class: 'zx-card__header' }, heading, actions);

      root.replaceChildren(h('div', { class: 'zx-card__layout' }, media,
        h('div', { class: 'zx-card__inner' }, header, content, footer)));
      root.dataset.variant = normalizeVariant(this.options.variant);
      root.dataset.orientation = normalizeOrientation(this.options.orientation);

      this.setTitle(this.options.title);
      this.setMedia(this.options.media);
      if (this.options.content !== null) this.setContent(this.options.content);
      else if (originalContent.length) {
        content.replaceChildren(...originalContent);
        content.hidden = false;
      }
      this.setActions(this.options.actions);
      this.setFooter(this.options.footer);
      this.setLink(this.options.link);
      return root;
    } catch (error) {
      this._actionAbort?.abort();
      this._linkAbort?.abort();
      if (!created) restoreTarget(root, this._original);
      throw error;
    }
  }

  /** Replaces the card title. @param {string} title Next title. @returns {this} */
  setTitle(title) {
    const next = String(title ?? '');
    if (this._link && !next.trim()) throw new TypeError('A linked Card requires a non-empty title');
    this._title = next;
    this._renderHeading();
    return this;
  }

  /** Replaces or removes the media region. @param {CardContent} content Media. @returns {this} */
  setMedia(content) {
    replaceCardContent(this.refs.media, content, 'Card media');
    this.refs.media.hidden = content === null;
    return this;
  }

  /** Replaces or clears the main content. @param {CardContent} content Content. @returns {this} */
  setContent(content) {
    replaceCardContent(this.refs.content, content, 'Card content');
    this.refs.content.hidden = content === null;
    return this;
  }

  /** Replaces the secondary action controls. @param {CardAction[]} actions Actions. @returns {this} */
  setActions(actions) {
    if (!Array.isArray(actions)) throw new TypeError('Card actions must be an array');
    const nextAbort = new AbortController();
    let controls;
    try {
      controls = actions.map((action) => {
        if (isElement(action)) return action;
        if (!action || typeof action !== 'object' || Array.isArray(action)) {
          throw new TypeError('Card actions must be Elements or button descriptors');
        }
        const descriptor = { ...action };
        const onclick = descriptor.onclick;
        delete descriptor.onclick;
        const control = button(descriptor);
        if (onclick !== undefined && typeof onclick !== 'function') {
          throw new TypeError('Card action onclick must be a function');
        }
        if (onclick) control.addEventListener('click', onclick, { signal: nextAbort.signal });
        return control;
      });
    } catch (error) {
      nextAbort.abort();
      throw error;
    }
    this._actionAbort?.abort();
    this._actionAbort = nextAbort;
    this.refs.actions.replaceChildren(...controls);
    this.refs.actions.hidden = controls.length === 0;
    this._syncHeader();
    return this;
  }

  /** Replaces or removes the footer. @param {CardContent} content Footer. @returns {this} */
  setFooter(content) {
    replaceCardContent(this.refs.footer, content, 'Card footer');
    this.refs.footer.hidden = content === null;
    return this;
  }

  /** Sets or removes the title's native primary link. @param {CardLink} link Link. @returns {this} */
  setLink(link) {
    const next = normalizeCardLink(link);
    if (next && !this._title.trim()) throw new TypeError('A linked Card requires a non-empty title');
    this._link = next;
    this.el.dataset.linked = next ? 'true' : 'false';
    this._renderHeading();
    return this;
  }

  /** Restores an enhanced target exactly, or removes an owned card. @returns {void} */
  destroy() {
    if (this._cleaned) return;
    this._cleaned = true;
    this._actionAbort?.abort();
    this._linkAbort?.abort();
    super.destroy();
    if (!this._createdRoot) restoreTarget(this.el, this._original);
  }

  /** @returns {void} */
  _renderHeading() {
    const title = this._title;
    const nextAbort = new AbortController();
    const node = this._link ? h('a', {
      class: 'zx-card__primary',
      href: this._link.href,
      target: this._link.target,
      rel: this._link.rel
    }, title) : h('span', { class: 'zx-card__title' }, title);
    if (this._link?.onclick) node.addEventListener('click', this._link.onclick, { signal: nextAbort.signal });
    this._linkAbort?.abort();
    this._linkAbort = nextAbort;
    this.refs.heading.replaceChildren(node);
    this.refs.heading.hidden = title === '';
    if (title) this.el.setAttribute('aria-labelledby', this.refs.heading.id);
    else this.el.removeAttribute('aria-labelledby');
    this._syncHeader();
  }

  /** @returns {void} */
  _syncHeader() {
    if (!this.refs.header) return;
    this.refs.header.hidden = this._title === '' && this.refs.actions.childElementCount === 0;
  }
}

/** @param {Element} host @param {CardContent} content @param {string} label */
function replaceCardContent(host, content, label) {
  if (content === null) {
    host.replaceChildren();
    return;
  }
  if (typeof content === 'string') {
    host.textContent = content;
    return;
  }
  const node = content instanceof Component ? content.toElement() : content;
  if (node instanceof Node) {
    host.replaceChildren(node);
    return;
  }
  throw new TypeError(`${label} must be a string, Node, Component, or null`);
}

/** @param {CardLink} value @returns {CardLinkDescriptor|null} */
function normalizeCardLink(value) {
  if (value === null) return null;
  const descriptor = typeof value === 'string' ? { href: value } : value;
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw new TypeError('Card link must be a URL string, descriptor, or null');
  }
  const href = safeHref(descriptor.href);
  if (href === null) {
    throw new TypeError('Card link requires a safe non-empty href');
  }
  if (descriptor.onclick !== undefined && typeof descriptor.onclick !== 'function') {
    throw new TypeError('Card link onclick must be a function');
  }
  const target = descriptor.target == null ? undefined : String(descriptor.target);
  let rel = descriptor.rel == null ? '' : String(descriptor.rel).trim();
  if (target === '_blank' && !/(^|\s)noopener(\s|$)/i.test(rel)) {
    rel = `${rel} noopener`.trim();
  }
  return { href, target, rel: rel || undefined, onclick: descriptor.onclick };
}

/** @param {unknown} value @returns {'outlined'|'raised'|'filled'} */
function normalizeVariant(value) {
  return ['raised', 'filled'].includes(String(value))
    ? /** @type {'raised'|'filled'} */ (value) : 'outlined';
}

/** @param {unknown} value @returns {'vertical'|'horizontal'} */
function normalizeOrientation(value) {
  return value === 'horizontal' ? 'horizontal' : 'vertical';
}

/** @param {unknown} value @returns {1|2|3|4|5|6} */
function normalizeHeadingLevel(value) {
  const level = Math.trunc(Number(value));
  return /** @type {1|2|3|4|5|6} */ (level >= 1 && level <= 6 ? level : 3);
}
