import { badge, badgeGroup, h } from '../../src/index.js';

/** Every semantic intent, in documentation order. */
const KINDS = ['neutral', 'accent', 'success', 'warning', 'danger', 'info'];

/** Every fill treatment. */
const VARIANTS = ['soft', 'solid', 'outline'];

/** Projects as a record carries them: a name and the categorical tone the team gave it. */
const PROJECTS = [
  { label: 'Website relaunch', tone: 'blue' },
  { label: 'Warehouse', tone: 'teal' },
  { label: 'Onboarding', tone: 'green' },
  { label: 'Q4 audit', tone: 'amber' },
  { label: 'Field sales', tone: 'orange' },
  { label: 'Incidents', tone: 'red' },
  { label: 'Brand', tone: 'pink' },
  { label: 'Research', tone: 'violet' },
  { label: 'Internal', tone: 'slate' }
];

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
      title: 'Tones',
      blurb: 'tone is categorical colour — what a badge is (a project, a label, a module), not how '
        + 'it is doing. It comes from its own palette, apart from the accent and the status kinds, '
        + 'so a project tagged red never reads as an error. When set it decides the colour and kind '
        + 'is ignored for it; the variants still apply.',
      layout: 'stack',
      render: () => VARIANTS.map((variant) => h('div', { class: 'demo-row' },
        h('span', { class: 'demo-caption' }, variant),
        PROJECTS.map(({ label, tone }) => badge({ label, tone, variant }))))
    },
    {
      title: 'Sizes',
      blurb: 'The small size fits inside table cells, list rows, and board cards; the default sits '
        + 'next to headings and buttons. A small badge with a dot keeps the readable text size.',
      layout: 'stack',
      render: () => [
        h('div', { class: 'demo-row' },
          h('span', { class: 'demo-caption' }, 'md'),
          KINDS.map((kind) => badge({ label: kind, kind }))),
        h('div', { class: 'demo-row' },
          h('span', { class: 'demo-caption' }, 'sm'),
          KINDS.map((kind) => badge({ label: kind, kind, size: 'sm' }))),
        h('div', { class: 'demo-row' },
          h('span', { class: 'demo-caption' }, 'sm, dot'),
          KINDS.map((kind) => badge({ label: kind, kind, size: 'sm', dot: true })))
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
        badge({ label: 'Invoice', tone: 'blue' }),
        badge({ label: 'Recurring', tone: 'violet' }),
        badge({ label: 'Net 30', tone: 'slate' }),
        badge({ label: 'EU VAT', tone: 'teal' }),
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
