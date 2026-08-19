import { badge, badgeGroup, h } from '../../src/index.js';

/** Every semantic intent, in documentation order. */
const KINDS = ['neutral', 'accent', 'success', 'warning', 'danger', 'info'];

/** Every fill treatment. */
const VARIANTS = ['soft', 'solid', 'outline'];

export default {
  title: 'Badge',
  group: 'Inputs',
  blurb: 'A status pill you place yourself: kind carries the meaning, variant the weight.',

  examples: [
    {
      title: 'Kinds and variants',
      blurb: 'A badge is a factory, not a component: it returns a <span> you place yourself and '
        + 'throw away with the rest of your markup. Soft is the calm default, solid wins the row, '
        + 'outline sits where a fill would be too much.',
      layout: 'stack',
      render: () => VARIANTS.map((variant) => h('div', { class: 'demo-row' },
        h('span', { class: 'demo-caption' }, variant),
        KINDS.map((kind) => badge({ label: kind, kind, variant }))))
    },
    {
      title: 'Sizes',
      blurb: 'The small size fits inside table cells and list rows; the default sits next to '
        + 'headings and buttons.',
      layout: 'stack',
      render: () => [
        h('div', { class: 'demo-row' },
          h('span', { class: 'demo-caption' }, 'md'),
          KINDS.map((kind) => badge({ label: kind, kind }))),
        h('div', { class: 'demo-row' },
          h('span', { class: 'demo-caption' }, 'sm'),
          KINDS.map((kind) => badge({ label: kind, kind, size: 'sm' })))
      ]
    },
    {
      title: 'Dots and icons',
      blurb: 'dot: true puts a status dot in front of the label — the quietest way to colour a '
        + 'row — and icon takes any name from the icon layer instead. A badge with no label needs '
        + 'a title: it becomes the accessible name through role="img".',
      layout: 'stack',
      render: () => [
        h('div', { class: 'demo-row' },
          badge({ label: 'Live', kind: 'success', dot: true }),
          badge({ label: 'Paused', kind: 'warning', dot: true }),
          badge({ label: 'Stopped', kind: 'danger', dot: true }),
          badge({ label: 'Draft', dot: true }),
          badge({ label: 'Queued', kind: 'info', dot: true, variant: 'outline' })),
        h('div', { class: 'demo-row' },
          badge({ label: 'Approved', icon: 'check', kind: 'success' }),
          badge({ label: '3 issues', icon: 'warning', kind: 'warning', variant: 'solid' }),
          badge({ label: 'Locked', icon: 'lock', variant: 'outline' }),
          badge({ label: 'Starred', icon: 'star', kind: 'accent' }),
          badge({ icon: 'lock', kind: 'danger', title: 'Record is locked' }),
          badge({ dot: true, kind: 'success', title: 'Online' }))
      ]
    },
    {
      title: 'Groups',
      blurb: 'badgeGroup wraps badges in an inline row that wraps and keeps its own spacing, so a '
        + 'cell full of tags stays readable at any width.',
      render: () => badgeGroup([
        badge({ label: 'invoice', kind: 'accent', variant: 'outline' }),
        badge({ label: 'recurring', kind: 'accent', variant: 'outline' }),
        badge({ label: 'net 30', kind: 'accent', variant: 'outline' }),
        badge({ label: 'EU VAT', kind: 'accent', variant: 'outline' }),
        badge({ label: '+4', variant: 'outline' })
      ])
    },
    {
      title: 'A record header status row',
      blurb: 'Badges replace the hand-rolled status pills a record page would otherwise need, '
        + 'with no page-local CSS and the intent colours included.',
      render: () => h('div', { class: 'demo-card demo-row' },
        h('strong', { style: { fontSize: 'var(--zx-text-lg)' } }, 'Rewe Group — framework agreement'),
        badgeGroup([
          badge({ label: 'Negotiation', kind: 'accent', dot: true }),
          badge({ label: 'Owner: T. Kern' }),
          badge({ label: 'Close: 2 Nov 2026', icon: 'calendar' }),
          badge({ label: 'At risk', kind: 'danger', variant: 'solid' })
        ]))
    }
  ]
};
