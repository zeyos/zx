import { h, icon } from '../../src/index.js';

/** A short internal page, as a team writes one: a heading, a paragraph, a list, and a table. */
const PAGE = {
  title: 'Quarterly close',
  lede: 'The finance team closes the books in the first five working days of a new quarter. This '
    + 'page is the checklist, and the reference for anyone who wants to know what happens when.',
  steps: [
    'Freeze posting for the closed period on day one.',
    'Reconcile bank accounts and clear suspense items.',
    'Review accruals with each cost-centre owner.'
  ],
  schedule: [
    ['Day 1', 'Posting freeze, bank reconciliation', '0'],
    ['Day 3', 'Accrual review', '14'],
    ['Day 5', 'Sign-off and reporting', '3']
  ]
};

export default {
  title: 'Prose',
  group: 'Core',
  blurb: 'The reading register for authored content: its own typeface, size, line height, and measure.',

  examples: [
    {
      title: 'A document',
      blurb: 'Put .zx-prose on the element that holds authored content — a page, a record\'s notes, '
        + 'a message, an answer — and write plain HTML inside it. It reads --zx-font-prose, '
        + '--zx-prose-size, --zx-prose-leading, and --zx-prose-measure, so a theme can set documents '
        + 'in a serif without touching the interface. Components placed inside keep their own styles.',
      layout: 'stack',
      render: () => h('article', { class: 'zx-prose' },
        h('h1', {}, PAGE.title),
        h('p', {}, PAGE.lede, ' Questions go to the ', h('a', { href: '#components/prose' }, 'close channel'),
          ', and anything ', h('mark', {}, 'posted after the freeze'), ' waits for the next period.'),
        h('aside', { class: 'zx-callout' },
          h('span', { class: 'zx-callout__icon' }, icon('info')),
          h('div', { class: 'zx-callout__body' },
            h('p', { class: 'zx-callout__title' }, 'Owner this quarter'),
            h('p', {}, 'Hanna runs the close. She posts the daily status by ten.'))),
        h('h2', {}, 'Before the close'),
        h('ol', {}, PAGE.steps.map((step) => h('li', {}, step))),
        h('h2', {}, 'Schedule'),
        h('table', {},
          h('thead', {}, h('tr', {},
            h('th', { scope: 'col' }, 'When'),
            h('th', { scope: 'col' }, 'What happens'),
            h('th', { scope: 'col', 'data-align': 'end' }, 'Open items'))),
          h('tbody', {}, PAGE.schedule.map(([when, what, count]) => h('tr', {},
            h('td', {}, when), h('td', {}, what), h('td', { 'data-align': 'end' }, count))))))
    },
    {
      title: 'Callouts and colour',
      blurb: 'A callout is neutral unless it is a status (data-kind) or a category (data-tone). '
        + 'Marks highlight in a tone — amber by default — and a bare span with data-tone colours '
        + 'its text; add data-fill to highlight it too.',
      layout: 'stack',
      render: () => h('div', { class: 'zx-prose', 'data-size': 'sm' },
        h('aside', { class: 'zx-callout', 'data-kind': 'warning' },
          h('span', { class: 'zx-callout__icon' }, icon('warning')),
          h('div', { class: 'zx-callout__body' }, h('p', {}, 'The posting freeze is not reversible.'))),
        h('aside', { class: 'zx-callout', 'data-tone': 'violet' },
          h('div', { class: 'zx-callout__body' }, h('p', {}, 'Research notes: a category, not a status.'))),
        h('p', {}, 'Highlight ', h('mark', {}, 'a decision'), ', ', h('mark', { 'data-tone': 'blue' }, 'a reference'),
          ', or set a ', h('span', { 'data-tone': 'teal' }, 'run of text'), ' and ',
          h('span', { 'data-tone': 'pink', 'data-fill': '' }, 'a filled one'), ' in a tone.'))
    },
    {
      title: 'Interface size',
      blurb: 'data-size="sm" sets prose at the interface size for comments, previews, and panels; '
        + 'data-zx-measure="full" drops the reading measure where the column already sets it.',
      layout: 'stack',
      render: () => h('div', { class: 'zx-prose', 'data-size': 'sm', 'data-zx-measure': 'full' },
        h('p', {}, 'Can we move the accrual review to day two? Cost-centre owners are travelling on day three.'),
        h('ul', {}, h('li', {}, 'Two owners confirmed'), h('li', {}, 'One still to answer')))
    }
  ]
};
