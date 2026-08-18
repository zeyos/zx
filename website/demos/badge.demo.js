import { badge, badgeGroup, h } from '../../src/index.js';

/** Every semantic intent, in documentation order. */
const KINDS = ['neutral', 'accent', 'success', 'warning', 'danger', 'info'];

/** Every fill treatment. */
const VARIANTS = ['soft', 'solid', 'outline'];

export default {
  title: 'Badge',
  group: 'Inputs',

  /**
   * Mounts the badge matrix, the dot and icon forms, groups, and a record header row.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    container.append(
      section('Kinds and variants',
        note('A badge is a factory, not a component: it returns a `<span>` you place yourself and '
          + 'throw away with the rest of your markup. `kind` carries the meaning, `variant` the '
          + 'weight — soft for the calm default, solid where the badge has to win the row, outline '
          + 'where a fill would be too much.'),
        grid(VARIANTS.flatMap((variant) => [
          caption(variant),
          row(...KINDS.map((kind) => badge({ label: kind, kind, variant })))
        ]))),

      section('Sizes',
        grid(
          caption('md'),
          row(...KINDS.map((kind) => badge({ label: kind, kind }))),
          caption('sm'),
          row(...KINDS.map((kind) => badge({ label: kind, kind, size: 'sm' }))),
          caption('sm solid'),
          row(...KINDS.map((kind) => badge({ label: kind, kind, variant: 'solid', size: 'sm' })))
        ),
        note('The small size fits inside table cells and list rows; the default size sits next to '
          + 'headings and buttons.')),

      section('Dots and icons',
        note('`dot: true` puts a status dot in front of the label — the quietest way to colour a '
          + 'row. `icon` takes any name from the icon layer instead. A badge without a label needs '
          + 'a `title`: it names the badge for assistive technology through `role="img"`.'),
        row(
          badge({ label: 'Live', kind: 'success', dot: true }),
          badge({ label: 'Paused', kind: 'warning', dot: true }),
          badge({ label: 'Stopped', kind: 'danger', dot: true }),
          badge({ label: 'Draft', dot: true }),
          badge({ label: 'Queued', kind: 'info', dot: true, variant: 'outline' })
        ),
        row(
          badge({ label: 'Approved', icon: 'check', kind: 'success' }),
          badge({ label: '3 issues', icon: 'warning', kind: 'warning', variant: 'solid' }),
          badge({ label: 'Locked', icon: 'lock', variant: 'outline' }),
          badge({ label: 'Starred', icon: 'star', kind: 'accent' }),
          badge({ icon: 'lock', kind: 'danger', title: 'Record is locked' }),
          badge({ dot: true, kind: 'success', title: 'Online' })
        )),

      section('Groups',
        note('`badgeGroup()` wraps badges in an inline row that wraps and keeps its own spacing, '
          + 'so a cell full of tags stays readable at any width.'),
        badgeGroup([
          badge({ label: 'invoice', kind: 'accent', variant: 'outline' }),
          badge({ label: 'recurring', kind: 'accent', variant: 'outline' }),
          badge({ label: 'net 30', kind: 'accent', variant: 'outline' }),
          badge({ label: 'EU VAT', kind: 'accent', variant: 'outline' }),
          badge({ label: '+4', variant: 'outline' })
        ])),

      section('Standing in for record-page pills',
        note('The record page header used a hand-rolled `.stage-pill` class for its status row. A '
          + 'badge replaces it without any page-local CSS, and gains the intent colours.'),
        h('div', {
          style: {
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--zx-space-3)',
            border: '1px solid var(--zx-color-border)', borderRadius: 'var(--zx-radius-lg)',
            background: 'var(--zx-color-bg-surface)', padding: 'var(--zx-space-4)'
          }
        },
        h('strong', { style: { fontSize: 'var(--zx-text-lg)' } }, 'Rewe Group — framework agreement'),
        badgeGroup([
          badge({ label: 'Negotiation', kind: 'accent', dot: true }),
          badge({ label: 'Owner: T. Kern' }),
          badge({ label: 'Close: 2 Nov 2026', icon: 'calendar' }),
          badge({ label: 'At risk', kind: 'danger', variant: 'solid' })
        ])))
    );
  }
};

/** @param {...Node} children @returns {HTMLElement} */
function row(...children) {
  return h('div', {
    style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--zx-space-2)' }
  }, children);
}

/** @param {...Node} children @returns {HTMLElement} */
function grid(...children) {
  return h('div', {
    style: {
      display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center',
      gap: 'var(--zx-space-2) var(--zx-space-4)'
    }
  }, children);
}

/** @param {string} text @returns {HTMLElement} */
function caption(text) {
  return h('span', {
    style: {
      color: 'var(--zx-color-text-muted)', fontFamily: 'var(--zx-font-mono)',
      fontSize: 'var(--zx-text-sm)'
    }
  }, text);
}

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', {
    style: {
      display: 'grid', gap: 'var(--zx-space-4)', marginBlockEnd: 'var(--zx-space-6)',
      border: '1px solid var(--zx-color-border)', borderRadius: 'var(--zx-radius-lg)',
      background: 'var(--zx-color-bg-surface)', padding: 'var(--zx-space-5)'
    }
  }, h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-xl)' } }, title), children);
}

/** @param {string} text @returns {HTMLElement} */
function note(text) {
  return h('p', {
    style: {
      margin: '0', maxInlineSize: '78ch', color: 'var(--zx-color-text-muted)', lineHeight: '1.7'
    }
  }, text);
}
