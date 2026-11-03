import { badge, badgeGroup, h } from '../../src/index.js';

/** Every semantic intent, in documentation order. */
const KINDS = ['neutral', 'accent', 'success', 'warning', 'danger', 'info'];

/** Every fill treatment. */
const VARIANTS = ['soft', 'solid', 'outline'];

/** Workflow states as a record carries them: how it is doing, so each is a status with a dot. */
const STATES = [
  { label: 'Draft', kind: 'neutral' },
  { label: 'In review', kind: 'info' },
  { label: 'Approved', kind: 'success' },
  { label: 'Blocked', kind: 'danger' }
];

/** Labels as a record carries them: what it is, so each is a tag in its categorical tone. */
const LABELS = [
  { label: 'Billing', tone: 'violet' },
  { label: 'Customer', tone: 'teal' },
  { label: 'Logistics', tone: 'blue' },
  { label: 'Internal', tone: 'slate' }
];

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
  blurb: 'A status pill or a tag you place yourself: kind says how something is doing, tone '
    + 'what it is, and the shape follows.',

  examples: [
    {
      title: 'Statuses and tags',
      blurb: 'Two meanings, two shapes, one construction. A status — kind, how something is doing — '
        + 'is a pill, and a workflow state carries a dot centred in its round end. A tag — tone, what '
        + 'something is — has small corners. Both are one fill and no line, 12px at weight 500, and '
        + 'as tall as the row they sit in allows, so they follow the row height setting without making a '
        + 'row taller.',
      layout: 'stack',
      render: () => [
        h('div', { class: 'demo-row' },
          h('span', { class: 'demo-caption' }, 'status'),
          STATES.map(({ label, kind }) => badge({ label, kind, dot: true }))),
        h('div', { class: 'demo-row' },
          h('span', { class: 'demo-caption' }, 'tag'),
          LABELS.map(({ label, tone }) => badge({ label, tone })))
      ]
    },
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
        + 'so a project tagged red never reads as an error. When set it decides the colour and the '
        + 'tag shape, and kind is ignored for it; the variants still apply.',
      layout: 'stack',
      render: () => VARIANTS.map((variant) => h('div', { class: 'demo-row' },
        h('span', { class: 'demo-caption' }, variant),
        PROJECTS.map(({ label, tone }) => badge({ label, tone, variant }))))
    },
    {
      title: 'Sizes',
      blurb: 'The small size fits inside table cells, list rows, and board cards; the default sits '
        + 'next to headings, buttons, and in fields. Small is shorter and tighter, never smaller '
        + 'type: both sizes set 12px, and both take their height from --zx-row-height.',
      layout: 'stack',
      render: () => [
        h('div', { class: 'demo-row' },
          h('span', { class: 'demo-caption' }, 'md'),
          KINDS.map((kind) => badge({ label: kind, kind, dot: true })),
          LABELS.map(({ label, tone }) => badge({ label, tone }))),
        h('div', { class: 'demo-row' },
          h('span', { class: 'demo-caption' }, 'sm'),
          KINDS.map((kind) => badge({ label: kind, kind, size: 'sm', dot: true })),
          LABELS.map(({ label, tone }) => badge({ label, tone, size: 'sm' })))
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
      blurb: 'Badges replace the hand-rolled pills a record page would otherwise need, with no '
        + 'page-local CSS: the stage is a status, the labels are tags, and each reads the same here '
        + 'as in the list row and the field that edit it.',
      render: () => h('div', { class: 'demo-card demo-row' },
        h('strong', { style: { fontSize: 'var(--zx-text-lg)' } }, 'Bruckner Logistik — warehouse rollout'),
        badgeGroup([
          badge({ label: 'Negotiation', kind: 'accent', dot: true }),
          badge({ label: 'Logistics', tone: 'blue' }),
          badge({ label: 'Close: 2 Nov 2026', icon: 'calendar' }),
          badge({ label: 'At risk', kind: 'danger', variant: 'solid' })
        ]))
    }
  ]
};
